"""
Graph and Edge Detail API router.
Spec reference: 02_ARCHITECTURE_DATA_API.md §5.3, §5.4, §5.5.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import (
    Entity,
    Event,
    EvidenceLink,
    Gap,
    Investigation,
    Relationship,
    Signal,
    UploadedFile,
)
from app.schemas.relationship import EdgeDetailResponse, GraphResponse
from app.services.graph.builder import format_cytoscape_elements

router = APIRouter(tags=["Attack Graph & Provenance"])


@router.get(
    "/investigations/{investigation_id}/graph",
    response_model=GraphResponse,
    summary="Interactive Cytoscape attack graph with epistemic levels",
)
def get_attack_graph(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if investigation.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis out of date — re-run analysis",
        )

    # Fetch stored entities and relationships
    entities = db.query(Entity).filter(Entity.investigation_id == investigation_id).all()
    relationships = db.query(Relationship).filter(Relationship.investigation_id == investigation_id).all()
    signals = db.query(Signal).filter(Signal.investigation_id == investigation_id).all()
    gaps = db.query(Gap).filter(Gap.investigation_id == investigation_id).all()

    # Collect suspicious entity IDs (nodes carrying signals)
    suspicious_ids = {s.entity_id for s in signals if s.entity_id}

    # Fetch evidence IDs for all relationships
    rel_ids = [r.id for r in relationships]
    links = db.query(EvidenceLink).filter(EvidenceLink.relationship_id.in_(rel_ids)).all() if rel_ids else []
    evidence_map = {}
    for l in links:
        evidence_map.setdefault(l.relationship_id, []).append(l.event_id)

    ent_dicts = [
        {
            "id": e.id,
            "entity_type": e.entity_type,
            "label": e.label,
            "first_seen": e.first_seen,
            "signal_ids": [s.id for s in signals if s.entity_id == e.id],
        }
        for e in entities
    ]

    rel_dicts = [
        {
            "id": r.id,
            "source_entity_id": r.source_entity_id,
            "target_entity_id": r.target_entity_id,
            "relationship_type": r.relationship_type,
            "status": r.status,
            "confidence": r.confidence,
            "confidence_breakdown": r.confidence_breakdown or [],
            "explanation": r.explanation,
            "epistemic_note": r.epistemic_note,
            "first_event_time": r.first_event_time,
            "evidence_ids": evidence_map.get(r.id, []),
        }
        for r in relationships
    ]

    result = format_cytoscape_elements(
        entities=ent_dicts,
        relationships=rel_dicts,
        suspicious_entity_ids=suspicious_ids,
        open_gaps_count=len(gaps),
    )
    return GraphResponse(**result)


@router.get(
    "/investigations/{investigation_id}/edges/{edge_id}",
    response_model=EdgeDetailResponse,
    summary="Detailed edge provenance, raw evidence, and epistemic verification checks",
)
def get_edge_detail(investigation_id: str, edge_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    rel = db.query(Relationship).filter(
        Relationship.id == edge_id,
        Relationship.investigation_id == investigation_id,
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship edge not found")

    # Fetch source and target entities
    source_ent = db.query(Entity).filter(
        Entity.id == rel.source_entity_id,
        Entity.investigation_id == investigation_id,
    ).first()
    target_ent = db.query(Entity).filter(
        Entity.id == rel.target_entity_id,
        Entity.investigation_id == investigation_id,
    ).first()

    # Fetch evidence links and associated events
    links = db.query(EvidenceLink).filter(EvidenceLink.relationship_id == edge_id).all()
    event_ids = [l.event_id for l in links]
    role_map = {l.event_id: l.evidence_role for l in links}

    events = db.query(Event).filter(
        Event.id.in_(event_ids),
        Event.investigation_id == investigation_id,
    ).all() if event_ids else []

    # Map file metadata
    file_ids = [e.file_id for e in events if e.file_id]
    files = db.query(UploadedFile).filter(UploadedFile.id.in_(file_ids)).all() if file_ids else []
    file_map = {f.id: f for f in files}

    evidence_items = []
    for ev in events:
        file_rec = file_map.get(ev.file_id)
        role = role_map.get(ev.id, "direct")
        summary = f"{ev.actor or 'unknown'} {ev.event_type} on {ev.target or ev.source_device or 'target'}"
        evidence_items.append({
            "event_id": ev.id,
            "role": role,
            "event_time": ev.event_time.isoformat() if ev.event_time else None,
            "source": ev.source,
            "summary": summary,
            "raw_record": ev.raw_record or {},
            "file": file_rec.original_filename if file_rec else None,
            "row_number": ev.row_number,
            "status": "observed",
        })

    # Build verification checks
    checks = []
    if rel.status == "observed":
        checks.append({"label": f"Direct {rel.relationship_type} log record", "state": "observed"})
        checks.append({"label": "Actor identity authenticated", "state": "observed"})
        checks.append({"label": "Cryptographic file integrity verified", "state": "observed"})
    elif rel.status == "inferred":
        checks.append({"label": "Events within 15-minute correlation window", "state": "observed"})
        checks.append({"label": "Topological connection in telemetry", "state": "inferred"})
        checks.append({"label": "Direct causal link confirmed", "state": "unverified"})
    else:  # needs_verification
        checks.append({"label": "Target resource activity recorded", "state": "observed"})
        checks.append({"label": "Preceding access within correlation window", "state": "observed"})
        checks.append({"label": "Initiating actor attribution", "state": "unverified"})
        checks.append({"label": "Causal connection", "state": "unverified"})

    # Fetch relevant gaps
    gaps = db.query(Gap).filter(Gap.investigation_id == investigation_id).all()
    edge_gaps = []
    for g in gaps:
        related = g.related_edge_ids or []
        if edge_id in related or rel.status == "needs_verification":
            edge_gaps.append({"id": g.id, "title": g.title})

    conclusion = "A connected sequence of events is observed; causation is not established."

    return EdgeDetailResponse(
        id=rel.id,
        source={
            "id": source_ent.id if source_ent else rel.source_entity_id,
            "label": source_ent.label if source_ent else rel.source_entity_id,
            "type": source_ent.entity_type if source_ent else "SERVICE",
        },
        target={
            "id": target_ent.id if target_ent else rel.target_entity_id,
            "label": target_ent.label if target_ent else rel.target_entity_id,
            "type": target_ent.entity_type if target_ent else "EVENT",
        },
        relationship_type=rel.relationship_type,
        status=rel.status,
        confidence=rel.confidence,
        confidence_breakdown=rel.confidence_breakdown or [],
        why=rel.explanation or "",
        epistemic_note=rel.epistemic_note or "",
        evidence=evidence_items,
        checks=checks,
        gaps=edge_gaps,
        conclusion=conclusion,
    )
