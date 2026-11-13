"""
Analysis, Timeline, Signals, and Hypotheses REST API endpoints.
Spec reference: 02_ARCHITECTURE_DATA_API.md §5.3.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.constants import MITRE_MAPPINGS
from app.database.connection import get_db
from app.database.models import (
    Event,
    Gap,
    Hypothesis,
    InitialAccessCandidate,
    Investigation,
    Signal,
)
from app.schemas.event import TimelineResponse
from app.schemas.hypothesis import (
    GapResponse,
    HypothesesOverviewResponse,
    HypothesisResponse,
    InitialAccessCandidateResponse,
    SignalResponse,
)
from app.services.pipeline import run_analysis_pipeline
from app.services.temporal.event_ordering import reconstruct_timeline

router = APIRouter(tags=["Analysis, Reasoning & Hypotheses"])


@router.post(
    "/investigations/{investigation_id}/analyze",
    summary="Trigger end-to-end deterministic forensic analysis",
)
def trigger_analysis(investigation_id: str, db: Session = Depends(get_db)):
    try:
        result = run_analysis_pipeline(db, investigation_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis pipeline failed: {str(e)}",
        )


@router.get(
    "/investigations/{investigation_id}/timeline",
    response_model=TimelineResponse,
    summary="Reconstructed chronological timeline with arrival and delay flags",
)
def get_timeline(
    investigation_id: str,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    events_records = db.query(Event).filter(Event.investigation_id == investigation_id).all()
    signals = db.query(Signal).filter(Signal.investigation_id == investigation_id).all()
    event_signals_map = {}
    for sig in signals:
        if sig.event_id:
            event_signals_map.setdefault(sig.event_id, []).append(sig.id)

    events_data = []
    for ev in events_records:
        events_data.append({
            "id": ev.id,
            "row_number": ev.row_number,
            "event_time": ev.event_time,
            "ingested_at": ev.ingested_at,
            "event_type": ev.event_type,
            "source": ev.source,
            "actor": ev.actor,
            "source_device": ev.source_device,
            "target": ev.target,
            "outcome": ev.outcome,
            "timestamp_status": ev.timestamp_status,
            "delay_seconds": ev.delay_seconds,
            "signal_ids": event_signals_map.get(ev.id, []),
        })

    result = reconstruct_timeline(events_data, from_time=from_time, to_time=to_time)
    return TimelineResponse(**result)


@router.get(
    "/investigations/{investigation_id}/signals",
    response_model=List[SignalResponse],
    summary="Detected rule-based anomaly signals",
)
def get_signals(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    signals = db.query(Signal).filter(Signal.investigation_id == investigation_id).all()
    return [SignalResponse.model_validate(s) for s in signals]


@router.get(
    "/investigations/{investigation_id}/hypotheses",
    response_model=HypothesesOverviewResponse,
    summary="Competing hypotheses (H1, H2, H3), open gaps, and initial access candidates",
)
def get_hypotheses(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if investigation.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis out of date — re-run analysis",
        )

    db_hypotheses = db.query(Hypothesis).filter(Hypothesis.investigation_id == investigation_id).all()
    db_gaps = db.query(Gap).filter(Gap.investigation_id == investigation_id).all()
    db_candidates = db.query(InitialAccessCandidate).filter(InitialAccessCandidate.investigation_id == investigation_id).order_by(InitialAccessCandidate.rank.asc()).all()

    hyp_responses = []
    for h in db_hypotheses:
        hyp_responses.append(
            HypothesisResponse(
                id=h.id,
                key=h.key,
                name=h.name,
                score=h.score,
                score_type=h.score_type,
                status=h.status,
                explanation=h.explanation,
                missing_evidence=h.missing_evidence or [],
                contributions=h.contributions or [],
            )
        )

    candidate_responses = []
    for c in db_candidates:
        candidate_responses.append(
            InitialAccessCandidateResponse(
                rank=c.rank,
                event_id=c.event_id,
                entity_id=c.entity_id,
                reason=c.reason,
                evidence_ids=c.evidence_ids or [],
                caveat=c.caveat,
                technique=MITRE_MAPPINGS["initial_access"],
            )
        )

    open_gaps = len(db_gaps)
    finding_text = (
        f"The available evidence supports a connected sequence of suspicious activity. "
        f"The complete attack path and initial access mechanism remain unconfirmed. "
        f"Investigation incomplete ({open_gaps} open gaps)."
    )

    return HypothesesOverviewResponse(
        hypotheses=hyp_responses,
        gaps=[GapResponse.model_validate(g) for g in db_gaps],
        initial_access=candidate_responses,
        finding={
            "text": finding_text,
            "open_gaps": open_gaps,
            "incomplete": open_gaps > 0,
        },
    )


@router.get(
    "/investigations/{investigation_id}/blast-radius/{entity_id}",
    summary="Compute potential exposure (blast radius) paths from entity",
)
def get_blast_radius(
    investigation_id: str,
    entity_id: str,
    max_hops: int = Query(3, ge=1, le=5),
    include_unverified: bool = Query(True),
    db: Session = Depends(get_db),
):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if investigation.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis out of date — re-run analysis",
        )

    from app.database.models import Entity, Relationship
    from app.services.graph.blast_radius import calculate_blast_radius
    from app.services.graph.builder import build_networkx_graph

    entities = db.query(Entity).filter(Entity.investigation_id == investigation_id).all()
    relationships = db.query(Relationship).filter(Relationship.investigation_id == investigation_id).all()

    ent_dicts = [{"id": e.id, "entity_type": e.entity_type, "label": e.label} for e in entities]
    rel_dicts = [
        {
            "id": r.id,
            "source_entity_id": r.source_entity_id,
            "target_entity_id": r.target_entity_id,
            "relationship_type": r.relationship_type,
            "status": r.status,
            "confidence": r.confidence,
        }
        for r in relationships
    ]

    graph = build_networkx_graph(ent_dicts, rel_dicts)
    result = calculate_blast_radius(
        graph=graph,
        start_entity_id=entity_id,
        max_hops=max_hops,
        include_unverified=include_unverified,
    )
    return result


@router.get(
    "/investigations/{investigation_id}/report",
    summary="Generate comprehensive deterministic forensic investigation report",
)
def get_report(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if investigation.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis out of date — re-run analysis",
        )

    from app.services.reporting.report_generator import generate_investigation_report
    report_data = generate_investigation_report(db, investigation_id)
    return report_data
