"""
Edge provenance and epistemic integrity tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, 00_MASTER_INSTRUCTIONS.md §2, §3.
USP: Every edge has >=1 valid evidence_ids pointing to stored events in the same investigation.
"""

from datetime import datetime, timezone
import uuid
import pytest
from app.core.constants import (
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)
from app.database.connection import SessionLocal
from app.database.models import Entity, Event, EvidenceLink, Investigation, Relationship
from app.services.graph.builder import persist_graph_to_database
from app.services.graph.relationships import extract_relationships_from_events


def test_provenance_and_evidence_integrity():
    db = SessionLocal()
    test_inv_id = f"inv_prov_{uuid.uuid4().hex[:8]}"
    try:
        # Create investigation
        inv = Investigation(
            id=test_inv_id,
            name="Provenance Test Case",
            status="analyzed",
        )
        db.add(inv)
        db.commit()

        # Create two events
        t0 = datetime(2026, 11, 14, 2, 0, 0, tzinfo=timezone.utc)
        ev1 = Event(
            id=f"evt_prov_{uuid.uuid4().hex[:6]}",
            investigation_id=inv.id,
            row_number=1,
            event_time=t0,
            ingested_at=t0,
            event_type="authentication",
            source="auth_log",
            actor="jdoe",
            source_device="WS-101",
            target="SRV-FILE01",
            outcome="success",
            timestamp_status="ok",
            arrival_flags=["normal"],
            raw_record={"actor": "jdoe", "target": "SRV-FILE01"},
            attributes={},
        )
        ev2 = Event(
            id=f"evt_prov_{uuid.uuid4().hex[:6]}",
            investigation_id=inv.id,
            row_number=2,
            event_time=t0,
            ingested_at=t0,
            event_type="service_access",
            source="service_log",
            actor="jdoe",
            source_device="WS-101",
            target="FileShare",
            outcome="success",
            timestamp_status="ok",
            arrival_flags=["normal"],
            raw_record={"actor": "jdoe", "target": "FileShare"},
            attributes={},
        )
        db.add_all([ev1, ev2])
        db.commit()

        events_dict = [
            {
                "id": ev1.id,
                "event_time": ev1.event_time,
                "ingested_at": ev1.ingested_at,
                "event_type": ev1.event_type,
                "outcome": ev1.outcome,
                "actor": ev1.actor,
                "source_device": ev1.source_device,
                "target": ev1.target,
                "source": ev1.source,
                "timestamp_status": ev1.timestamp_status,
                "flags": ev1.arrival_flags,
            },
            {
                "id": ev2.id,
                "event_time": ev2.event_time,
                "ingested_at": ev2.ingested_at,
                "event_type": ev2.event_type,
                "outcome": ev2.outcome,
                "actor": ev2.actor,
                "source_device": ev2.source_device,
                "target": ev2.target,
                "source": ev2.source,
                "timestamp_status": ev2.timestamp_status,
                "flags": ev2.arrival_flags,
            },
        ]

        entities, relationships = extract_relationships_from_events(events_dict)
        persist_graph_to_database(db, inv.id, entities, relationships)

        # Assert 100% provenance integrity:
        # Every relationship has >=1 evidence_ids, each pointing to an event in this investigation
        stored_rels = db.query(Relationship).filter(Relationship.investigation_id == inv.id).all()
        assert len(stored_rels) > 0

        for rel in stored_rels:
            links = db.query(EvidenceLink).filter(EvidenceLink.relationship_id == rel.id).all()
            assert len(links) >= 1, f"Relationship {rel.id} has no evidence links!"

            for link in links:
                ev = db.query(Event).filter(Event.id == link.event_id).first()
                assert ev is not None, f"Evidence event {link.event_id} does not exist!"
                assert ev.investigation_id == inv.id, "Evidence event belongs to a different investigation!"

    finally:
        # Clean up
        db.query(EvidenceLink).filter(EvidenceLink.investigation_id == test_inv_id).delete(synchronize_session=False)
        db.query(Relationship).filter(Relationship.investigation_id == test_inv_id).delete(synchronize_session=False)
        db.query(Entity).filter(Entity.investigation_id == test_inv_id).delete(synchronize_session=False)
        db.query(Event).filter(Event.investigation_id == test_inv_id).delete(synchronize_session=False)
        db.query(Investigation).filter(Investigation.id == test_inv_id).delete(synchronize_session=False)
        db.commit()
        db.close()
