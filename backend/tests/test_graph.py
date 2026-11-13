"""
Attack graph construction rules R1-R7 unit tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, 01_PRODUCT_AND_REASONING_SPEC.md §4.1.
"""

from datetime import datetime, timezone, timedelta
import pytest
from app.core.constants import (
    EDGE_ACCESSED,
    EDGE_ASSOCIATED_WITH,
    EDGE_AUTHENTICATED_TO,
    EDGE_CONNECTED_TO,
    EDGE_MODIFIED,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)
from app.services.graph.relationships import extract_relationships_from_events


def test_rules_r1_to_r5_on_incident_sequence():
    t0 = datetime(2026, 11, 14, 2, 0, 0, tzinfo=timezone.utc)

    # I1: Auth jdoe -> WS-207
    e1 = {
        "id": "evt_000001",
        "event_time": t0,
        "event_type": "authentication",
        "outcome": "success",
        "actor": "jdoe",
        "source_device": "WS-101",
        "target": "WS-207",
        "source": "auth_log",
    }
    # I2: Lateral auth from WS-207 to SRV-FILE01
    e2 = {
        "id": "evt_000002",
        "event_time": t0 + timedelta(minutes=5),
        "event_type": "authentication",
        "outcome": "success",
        "actor": "jdoe",
        "source_device": "WS-207",
        "target": "SRV-FILE01",
        "source": "auth_log",
    }
    # I3: WS-207 accesses FileShare
    e3 = {
        "id": "evt_000003",
        "event_time": t0 + timedelta(minutes=10),
        "event_type": "service_access",
        "outcome": "success",
        "actor": "jdoe",
        "source_device": "WS-207",
        "target": "FileShare",
        "source": "service_log",
    }
    # I4: Privilege change on FileShare with NO actor
    e4 = {
        "id": "evt_000004",
        "event_time": t0 + timedelta(minutes=13),
        "event_type": "privilege_change",
        "outcome": "success",
        "actor": None,  # No actor!
        "target": "FileShare",
        "source": "service_log",
    }
    # I5: External connection from SRV-FILE01 to 203.0.113.45
    e5 = {
        "id": "evt_000005",
        "event_time": t0 + timedelta(minutes=18),
        "event_type": "external_connection",
        "outcome": "success",
        "source_device": "SRV-FILE01",
        "target": "203.0.113.45",
        "attributes": {"dest_ip": "203.0.113.45"},
        "source": "network_log",
    }

    events = [e1, e2, e3, e4, e5]
    entities, relationships = extract_relationships_from_events(events)

    # R1: user:jdoe —AUTHENTICATED_TO→ device:ws-207 (observed)
    r1 = next(
        r for r in relationships
        if r["source_entity_id"] == "user:jdoe"
        and r["target_entity_id"] == "device:ws-207"
        and r["relationship_type"] == EDGE_AUTHENTICATED_TO
    )
    assert r1["status"] == STATUS_OBSERVED
    assert "evt_000001" in r1["evidence_ids"]

    # Lateral hop: device:ws-101 —CONNECTED_TO→ device:ws-207 (observed)
    r1_lat = next(
        r for r in relationships
        if r["source_entity_id"] == "device:ws-101"
        and r["target_entity_id"] == "device:ws-207"
        and r["relationship_type"] == EDGE_CONNECTED_TO
    )
    assert r1_lat["status"] == STATUS_OBSERVED

    # R2: device:ws-207 —ACCESSED→ service:fileshare (observed)
    r2 = next(
        r for r in relationships
        if r["source_entity_id"] == "device:ws-207"
        and r["target_entity_id"] == "service:fileshare"
        and r["relationship_type"] == EDGE_ACCESSED
    )
    assert r2["status"] == STATUS_OBSERVED

    # R3b: device:ws-207 —ASSOCIATED_WITH→ event:evt_000004 (needs_verification!)
    r3b = next(
        r for r in relationships
        if r["source_entity_id"] == "device:ws-207"
        and r["target_entity_id"] == "event:evt_000004"
        and r["relationship_type"] == EDGE_ASSOCIATED_WITH
    )
    assert r3b["status"] == STATUS_NEEDS_VERIFICATION
    assert "evt_000003" in r3b["evidence_ids"]  # Preceding motivating event!
    assert "evt_000004" in r3b["evidence_ids"]

    # R4: device:srv-file01 —CONNECTED_TO→ external:203.0.113.45 (observed)
    r4 = next(
        r for r in relationships
        if r["source_entity_id"] == "device:srv-file01"
        and r["target_entity_id"] == "external:203.0.113.45"
        and r["relationship_type"] == EDGE_CONNECTED_TO
    )
    assert r4["status"] == STATUS_OBSERVED

    # R5: event:evt_000004 —ASSOCIATED_WITH→ external:203.0.113.45 (inferred!)
    r5 = next(
        r for r in relationships
        if r["source_entity_id"] == "event:evt_000004"
        and r["target_entity_id"] == "external:203.0.113.45"
        and r["relationship_type"] == EDGE_ASSOCIATED_WITH
    )
    assert r5["status"] == STATUS_INFERRED
