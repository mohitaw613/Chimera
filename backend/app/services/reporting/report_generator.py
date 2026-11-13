"""
Deterministic forensic report generator for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §9.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import (
    BLAST_RADIUS_LABEL,
    HEURISTIC_SCORE_LABEL,
    SYNTHETIC_DATA_BADGE,
)
from app.database.models import (
    Entity,
    Event,
    EvidenceLink,
    Gap,
    Hypothesis,
    InitialAccessCandidate,
    Investigation,
    Relationship,
    Signal,
    UploadedFile,
)
from app.services.graph.blast_radius import calculate_blast_radius
from app.services.graph.builder import build_networkx_graph


def generate_investigation_report(
    db: Session,
    investigation_id: str,
) -> Dict[str, Any]:
    """Generates complete structured report dictionary from database records."""
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise ValueError(f"Investigation {investigation_id} not found")

    files = db.query(UploadedFile).filter(UploadedFile.investigation_id == investigation_id).all()
    events = db.query(Event).filter(Event.investigation_id == investigation_id).order_by(Event.event_time.asc()).all()
    entities = db.query(Entity).filter(Entity.investigation_id == investigation_id).all()
    relationships = db.query(Relationship).filter(Relationship.investigation_id == investigation_id).all()
    signals = db.query(Signal).filter(Signal.investigation_id == investigation_id).all()
    gaps = db.query(Gap).filter(Gap.investigation_id == investigation_id).all()
    hypotheses = db.query(Hypothesis).filter(Hypothesis.investigation_id == investigation_id).all()
    candidates = db.query(InitialAccessCandidate).filter(InitialAccessCandidate.investigation_id == investigation_id).order_by(InitialAccessCandidate.rank.asc()).all()

    # Time span
    valid_times = [e.event_time for e in events if e.event_time]
    time_span = {
        "start": min(valid_times).isoformat() if valid_times else None,
        "end": max(valid_times).isoformat() if valid_times else None,
    }

    # Blast radius for top risk candidate or first user entity
    top_entity_id = candidates[0].entity_id if candidates else (entities[0].id if entities else "user:unknown")
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
    blast_radius = calculate_blast_radius(graph, top_entity_id, max_hops=3)

    # Deterministic narrative synthesis
    finding_text = (
        f"The available evidence supports a connected sequence of suspicious activity "
        f"({len(relationships)} reconstructed relationships across {len(entities)} entities). "
        f"The complete attack path and initial access mechanism remain unconfirmed. "
        f"Investigation incomplete ({len(gaps)} open gaps)."
    )

    narrative = (
        f"CHIMERA analyzed {len(events)} log records across {len(files)} forensic sources. "
        f"A total of {len(signals)} anomaly signals were detected, highlighting multi-stage activity. "
        f"Hypothesis {hypotheses[0].key if hypotheses else 'H1'} scored {hypotheses[0].score if hypotheses else 50}% "
        f"under deterministic evidence weighting ({HEURISTIC_SCORE_LABEL}). "
        f"{len(gaps)} investigative gaps remain unverified, precluding an authoritative attribution verdict."
    )

    return {
        "investigation": {
            "id": investigation.id,
            "name": investigation.name,
            "description": investigation.description,
            "status": investigation.status,
            "created_at": investigation.created_at.isoformat(),
            "analyzed_at": investigation.analyzed_at.isoformat() if investigation.analyzed_at else None,
            "is_synthetic": investigation.is_synthetic,
            "synthetic_badge": SYNTHETIC_DATA_BADGE,
        },
        "overview": {
            "total_files": len(files),
            "total_events": len(events),
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "total_signals": len(signals),
            "total_gaps": len(gaps),
            "time_span": time_span,
        },
        "finding": {
            "text": finding_text,
            "open_gaps": len(gaps),
            "incomplete": len(gaps) > 0,
        },
        "narrative": narrative,
        "narrative_label": "Deterministic forensic summary of computed findings",
        "hypotheses": [
            {
                "key": h.key,
                "name": h.name,
                "score": h.score,
                "status": h.status,
                "score_label": HEURISTIC_SCORE_LABEL,
                "explanation": h.explanation,
                "missing_evidence": h.missing_evidence or [],
                "contributions": h.contributions or [],
            }
            for h in hypotheses
        ],
        "initial_access_candidates": [
            {
                "rank": c.rank,
                "event_id": c.event_id,
                "entity_id": c.entity_id,
                "reason": c.reason,
                "caveat": c.caveat,
            }
            for c in candidates
        ],
        "blast_radius": blast_radius,
        "gaps": [
            {
                "id": g.id,
                "severity": g.severity,
                "title": g.title,
                "description": g.description,
                "resolves_with": g.resolves_with,
            }
            for g in gaps
        ],
        "reproducibility": {
            "engine_version": "1.0.0",
            "deterministic_rules": True,
            "file_hashes": [
                {"filename": f.original_filename, "sha256": f.sha256, "rows": f.rows_total}
                for f in files
            ],
            "report_generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }
