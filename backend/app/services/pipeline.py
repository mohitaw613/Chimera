"""
Analysis pipeline orchestration for CHIMERA.
Spec reference: 02_ARCHITECTURE_DATA_API.md §1, §5.3.
Synchronous, deterministic, idempotent execution.
"""

from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy.orm import Session

from app.database.models import (
    Entity,
    Event,
    EvidenceLink,
    Gap,
    Hypothesis,
    HypothesisEvidence,
    InitialAccessCandidate,
    Investigation,
    Relationship,
    Signal,
)
from app.services.graph.builder import persist_graph_to_database
from app.services.graph.relationships import extract_relationships_from_events
from app.services.reasoning.hypothesis_engine import evaluate_hypotheses
from app.services.reasoning.initial_access import rank_initial_access_candidates
from app.services.reasoning.investigation_gaps import evaluate_investigation_gaps
from app.services.reasoning.signals import evaluate_signals


def run_analysis_pipeline(db: Session, investigation_id: str) -> Dict[str, Any]:
    """
    Executes the full forensic reasoning pipeline:
    1. Load all stored events for this investigation.
    2. Extract anomaly signals.
    3. Construct entities & relationships (rules R1-R7).
    4. Detect investigative gaps.
    5. Evaluate competing hypotheses (H1, H2, H3).
    6. Rank initial access candidates.
    7. Atomically persist derived tables to SQLite.
    8. Update investigation status to 'analyzed'.
    """
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise ValueError(f"Investigation {investigation_id} not found")

    events_records = db.query(Event).filter(Event.investigation_id == investigation_id).all()
    if not events_records:
        raise ValueError("Cannot analyze investigation with zero evidence events")

    events_data = [
        {
            "id": ev.id,
            "row_number": ev.row_number,
            "event_time": ev.event_time,
            "ingested_at": ev.ingested_at,
            "event_type": ev.event_type,
            "source": ev.source,
            "actor": ev.actor,
            "source_device": ev.source_device,
            "target": ev.target,
            "source_ip": ev.source_ip,
            "outcome": ev.outcome,
            "timestamp_status": ev.timestamp_status,
            "arrival_flags": ev.arrival_flags or [],
            "delay_seconds": ev.delay_seconds,
            "raw_record": ev.raw_record or {},
            "attributes": ev.attributes or {},
        }
        for ev in events_records
    ]

    # 1. Signals
    signals = evaluate_signals(events_data)

    # 2. Graph & Entities
    entities, relationships = extract_relationships_from_events(events_data, investigation_id=investigation_id)

    # 3. Gaps
    gaps = evaluate_investigation_gaps(events_data, relationships, signals)

    # 4. Hypotheses
    hypotheses = evaluate_hypotheses(events_data, relationships, signals, gaps)

    # 5. Initial Access Candidates
    initial_access_candidates = rank_initial_access_candidates(events_data, signals, relationships)

    # 6. Database Persistence (Clean old derived data and store fresh)
    # Remove old derived data
    db.query(Signal).filter(Signal.investigation_id == investigation_id).delete(synchronize_session=False)
    db.query(Gap).filter(Gap.investigation_id == investigation_id).delete(synchronize_session=False)
    db.query(InitialAccessCandidate).filter(InitialAccessCandidate.investigation_id == investigation_id).delete(synchronize_session=False)

    old_hyps = db.query(Hypothesis).filter(Hypothesis.investigation_id == investigation_id).all()
    old_hyp_ids = [h.id for h in old_hyps]
    if old_hyp_ids:
        db.query(HypothesisEvidence).filter(HypothesisEvidence.hypothesis_id.in_(old_hyp_ids)).delete(synchronize_session=False)
        db.query(Hypothesis).filter(Hypothesis.investigation_id == investigation_id).delete(synchronize_session=False)

    # Persist graph
    persist_graph_to_database(db, investigation_id, entities, relationships)

    # Persist signals
    for s in signals:
        db_sig = Signal(
            id=f"{investigation_id}_{s['id']}",
            investigation_id=investigation_id,
            signal=s["signal"],
            entity_id=s["entity_id"],
            event_id=s["event_id"],
            reason=s["reason"],
            severity=s["severity"],
            kind=s["kind"],
        )
        db.add(db_sig)

    # Persist gaps
    for g in gaps:
        db_gap = Gap(
            id=f"{investigation_id}_{g['id']}",
            investigation_id=investigation_id,
            severity=g["severity"],
            title=g["title"],
            description=g["description"],
            related_edge_ids=g.get("related_edge_ids", []),
            resolves_with=g["resolves_with"],
        )
        db.add(db_gap)

    # Persist hypotheses
    for h in hypotheses:
        db_hyp = Hypothesis(
            id=f"{investigation_id}_{h['key']}",
            investigation_id=investigation_id,
            key=h["key"],
            name=h["name"],
            score=h["score"],
            score_type=h["score_type"],
            status=h["status"],
            explanation=h["explanation"],
            missing_evidence=h["missing_evidence"],
            contributions=h["contributions"],
        )
        db.add(db_hyp)

    # Persist initial access candidates
    for cand in initial_access_candidates:
        db_cand = InitialAccessCandidate(
            id=f"{investigation_id}_iac_{cand['rank']}",
            investigation_id=investigation_id,
            rank=cand["rank"],
            event_id=cand["event_id"],
            entity_id=cand["entity_id"],
            reason=cand["reason"],
            evidence_ids=cand["evidence_ids"],
            caveat=cand["caveat"],
        )
        db.add(db_cand)

    # Update investigation status
    analyzed_at = datetime.now(timezone.utc)
    investigation.status = "analyzed"
    investigation.analyzed_at = analyzed_at
    db.commit()

    return {
        "status": "analyzed",
        "analyzed_at": analyzed_at.isoformat(),
        "counts": {
            "events": len(events_data),
            "entities": len(entities),
            "relationships": len(relationships),
            "signals": len(signals),
            "gaps": len(gaps),
        },
    }
