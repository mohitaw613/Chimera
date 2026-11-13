"""
Evidence upload and ingestion API router.
Spec reference: 02_ARCHITECTURE_DATA_API.md §5.2.
"""

from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
import shutil
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.constants import (
    MAX_UPLOAD_MB,
    STATUS_OBSERVED,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
)
from app.database.connection import get_db
from app.database.models import Event, Investigation, UploadedFile, Relationship, EvidenceLink
from app.schemas.event import EventResponse, EventsListResponse
from app.services.ingestion.parser import get_parser_for_filename
from app.services.ingestion.normalizer import normalize_record
from app.services.ingestion.validator import assign_initial_flags_and_delay, compute_event_fingerprint

router = APIRouter(tags=["Evidence & Ingestion"])


@router.post(
    "/investigations/{investigation_id}/upload",
    status_code=status.HTTP_200_OK,
    summary="Upload multi-source forensic evidence logs",
)
async def upload_evidence(
    investigation_id: str,
    files: List[UploadFile] = File(...),
    field_mapping: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    custom_mapping: Optional[Dict[str, str]] = None
    if field_mapping:
        try:
            custom_mapping = json.loads(field_mapping)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON in field_mapping parameter")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    results = []

    # Get highest existing event sequence globally so events.id never clashes
    max_evt_id = db.query(func.max(Event.id)).scalar()
    if max_evt_id and max_evt_id.startswith("evt_"):
        try:
            event_seq = int(max_evt_id[4:])
        except ValueError:
            event_seq = 0
    else:
        event_seq = 0

    # Fetch existing event fingerprints for deduplication within this investigation
    existing_events = db.query(Event).filter(Event.investigation_id == investigation_id).all()
    fingerprint_map: Dict[Any, Event] = {}
    for ev in existing_events:
        fp = (
            ev.event_time.isoformat() if ev.event_time else "None",
            str(ev.event_type),
            str(ev.actor),
            str(ev.source_device),
            str(ev.target),
            str(ev.outcome),
            str(ev.source),
        )
        fingerprint_map[fp] = ev

    upload_time = datetime.now(timezone.utc)

    for file_index, file in enumerate(files):
        # Validate extension
        filename = file.filename or "unknown.log"
        lower_name = filename.lower()
        if not (lower_name.endswith(".csv") or lower_name.endswith(".json") or lower_name.endswith(".jsonl")):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format for '{filename}'. Allowed formats: .csv, .json, .jsonl",
            )

        # Read content and enforce size limit
        content = await file.read()
        size_bytes = len(content)
        if size_bytes > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"File '{filename}' exceeds maximum allowed size of {MAX_UPLOAD_MB} MB",
            )

        # SHA-256 fingerprint
        sha256_hash = hashlib.sha256(content).hexdigest()

        # Save to disk with globally unique file_id
        file_id = f"file_{investigation_id}_{sha256_hash[:8]}"
        stored_filename = f"{investigation_id}_{file_id}_{filename}"
        stored_path = os.path.join(settings.UPLOAD_DIR, stored_filename)
        with open(stored_path, "wb") as f_out:
            f_out.write(content)

        # Parse file
        try:
            parser = get_parser_for_filename(filename)
            raw_records, parse_errors = parser.parse(content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse '{filename}': {str(e)}")

        default_source = os.path.splitext(filename)[0]
        rows_total = len(raw_records) + len(parse_errors)
        rows_ok = 0
        rows_flagged = 0
        rows_failed = len(parse_errors)

        # Process records
        for offset, (row_number, raw_record) in enumerate(raw_records):
            normalized = normalize_record(raw_record, default_source=default_source, custom_mapping=custom_mapping)

            # Assign sequential ingested_at if not present in record
            ingest_offset = timedelta(microseconds=(file_index * 10000) + offset)
            row_default_ingest = upload_time + ingest_offset

            event_data = assign_initial_flags_and_delay(normalized, row_default_ingest)

            # Check deduplication
            fp = compute_event_fingerprint(event_data)
            if fp in fingerprint_map:
                existing_ev = fingerprint_map[fp]
                attrs = dict(existing_ev.attributes or {})
                dup_count = attrs.get("duplicate_count", 1) + 1
                attrs["duplicate_count"] = dup_count
                dup_rows = attrs.get("duplicate_rows", [])
                dup_rows.append({"file_id": file_id, "row_number": row_number, "raw_record": raw_record})
                attrs["duplicate_rows"] = dup_rows
                existing_ev.attributes = attrs
                rows_ok += 1
                continue

            event_seq += 1
            event_id = f"evt_{event_seq:06d}"

            is_flagged = any(f in event_data["arrival_flags"] for f in ["timestamp_uncertain", "delayed"])
            if is_flagged:
                rows_flagged += 1
            else:
                rows_ok += 1

            new_event = Event(
                id=event_id,
                investigation_id=investigation_id,
                file_id=file_id,
                row_number=row_number,
                event_time=event_data["event_time"],
                ingested_at=event_data["ingested_at"],
                event_type=event_data["event_type"],
                source=event_data["source"],
                actor=event_data["actor"],
                source_device=event_data["source_device"],
                target=event_data["target"],
                source_ip=event_data["source_ip"],
                outcome=event_data["outcome"],
                timestamp_status=event_data["timestamp_status"],
                arrival_flags=event_data["arrival_flags"],
                delay_seconds=event_data["delay_seconds"],
                raw_record=event_data["raw_record"],
                attributes=event_data["attributes"],
            )
            db.add(new_event)
            fingerprint_map[fp] = new_event

        # Save uploaded file record
        file_record = UploadedFile(
            id=file_id,
            investigation_id=investigation_id,
            original_filename=filename,
            stored_path=stored_path,
            sha256=sha256_hash,
            size_bytes=size_bytes,
            uploaded_at=upload_time,
            rows_total=rows_total,
            rows_ok=rows_ok,
            rows_flagged=rows_flagged,
            rows_failed=rows_failed,
        )
        db.add(file_record)

        results.append({
            "file_id": file_id,
            "filename": filename,
            "sha256": sha256_hash,
            "rows_total": rows_total,
            "rows_ok": rows_ok,
            "rows_flagged": rows_flagged,
            "rows_failed": rows_failed,
            "errors": [err.to_dict() for err in parse_errors],
        })

    # Update investigation status: if already analyzed, mark stale; otherwise ingested
    if investigation.status == "analyzed":
        investigation.status = "stale"
    else:
        investigation.status = "ingested"

    db.commit()

    return {"files": results}


@router.get(
    "/investigations/{investigation_id}/events",
    response_model=EventsListResponse,
    summary="Paginated canonical events query",
)
def get_events(
    investigation_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = None,
    actor: Optional[str] = None,
    device: Optional[str] = None,
    flag: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    query = db.query(Event).filter(Event.investigation_id == investigation_id)

    if event_type:
        query = query.filter(Event.event_type == event_type)
    if actor:
        query = query.filter(Event.actor.ilike(f"%{actor}%"))
    if device:
        query = query.filter(
            (Event.source_device.ilike(f"%{device}%")) | (Event.target.ilike(f"%{device}%"))
        )
    if flag:
        query = query.filter(Event.arrival_flags.contains(flag))
    if q:
        query = query.filter(
            (Event.actor.ilike(f"%{q}%"))
            | (Event.source_device.ilike(f"%{q}%"))
            | (Event.target.ilike(f"%{q}%"))
            | (Event.source.ilike(f"%{q}%"))
            | (Event.source_ip.ilike(f"%{q}%"))
        )

    total = query.count()
    items = query.order_by(Event.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

    return EventsListResponse(
        items=[EventResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/events/{event_id}",
    summary="Get full event details with provenance and raw records",
)
def get_event_detail(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    file_info = None
    if event.file_id:
        file_rec = db.query(UploadedFile).filter(UploadedFile.id == event.file_id).first()
        if file_rec:
            file_info = {
                "filename": file_rec.original_filename,
                "row_number": event.row_number,
                "sha256": file_rec.sha256,
            }

    # Find edges using this event as evidence
    evidence_links = db.query(EvidenceLink).filter(EvidenceLink.event_id == event_id).all()
    used_by_relationships = [link.relationship_id for link in evidence_links]

    event_data = EventResponse.model_validate(event).model_dump()
    event_data["file"] = file_info
    event_data["used_by_relationships"] = used_by_relationships
    return event_data


@router.get(
    "/investigations/{investigation_id}/ingestion-status",
    summary="Ingestion summary and file statistics",
)
def get_ingestion_status(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    files = db.query(UploadedFile).filter(UploadedFile.investigation_id == investigation_id).all()
    total_events = db.query(func.count(Event.id)).filter(Event.investigation_id == investigation_id).scalar() or 0

    return {
        "status": investigation.status,
        "total_files": len(files),
        "total_events": total_events,
        "files": [
            {
                "file_id": f.id,
                "filename": f.original_filename,
                "sha256": f.sha256,
                "rows_total": f.rows_total,
                "rows_ok": f.rows_ok,
                "rows_flagged": f.rows_flagged,
                "rows_failed": f.rows_failed,
            }
            for f in files
        ],
    }
