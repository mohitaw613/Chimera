"""
Temporal reconstruction unit tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, 01_PRODUCT_AND_REASONING_SPEC.md §3.
"""

from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.core.constants import (
    FLAG_DELAYED,
    FLAG_ORDERING_AMBIGUOUS,
    FLAG_OUT_OF_ORDER,
    FLAG_TIMESTAMP_UNCERTAIN,
    TIMESTAMP_STATUS_MALFORMED,
    TIMESTAMP_STATUS_OK,
)
from app.services.temporal.event_ordering import count_inversions, reconstruct_timeline
from main import app

client = TestClient(app)


def test_inversions_count():
    arrival = ["A", "C", "D", "B"]
    chrono = ["A", "B", "C", "D"]
    # Pairs out of order: (B, C) and (B, D) = 2 inversions
    invs = count_inversions(arrival, chrono)
    assert invs == 2


def test_temporal_reconstruction_ordering_and_delay_flags():
    # Arrival sequence A, C, D, B
    base_time = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
    ingest_base = datetime(2026, 11, 14, 10, 30, 0, tzinfo=timezone.utc)

    event_a = {
        "id": "evt_A",
        "event_time": base_time,  # 10:00
        "ingested_at": ingest_base,  # 10:30 (arrived 1st)
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "auth_log",
    }
    event_c = {
        "id": "evt_C",
        "event_time": base_time + timedelta(minutes=8),  # 10:08
        "ingested_at": ingest_base + timedelta(seconds=1),  # 10:30:01 (arrived 2nd)
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "service_log",
    }
    event_d = {
        "id": "evt_D",
        "event_time": base_time + timedelta(minutes=12),  # 10:12
        "ingested_at": ingest_base + timedelta(seconds=2),  # 10:30:02 (arrived 3rd)
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "network_log",
    }
    event_b = {
        "id": "evt_B",
        "event_time": base_time + timedelta(minutes=3),  # 10:03
        "ingested_at": ingest_base + timedelta(seconds=3),  # 10:30:03 (arrived 4th, 27m after event_time)
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "auth_log",
    }

    raw_events = [event_a, event_c, event_d, event_b]
    timeline = reconstruct_timeline(raw_events)

    chrono_ids = [e["id"] for e in timeline["events"]]
    # Must be ordered by event_time: A -> B -> C -> D
    assert chrono_ids == ["evt_A", "evt_B", "evt_C", "evt_D"]

    # Inversion count
    assert timeline["inversions"] == 2

    # Check evt_B flags: delayed (delay > 300s) AND out_of_order (arrived after C and D, but occurred earlier)
    evt_b_res = next(e for e in timeline["events"] if e["id"] == "evt_B")
    assert FLAG_DELAYED in evt_b_res["flags"]
    assert FLAG_OUT_OF_ORDER in evt_b_res["flags"]
    assert evt_b_res["delay_seconds"] == 27 * 60 + 3


def test_ambiguous_ordering_clock_skew():
    t0 = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(seconds=1)  # 1s diff <= 2s tolerance

    ev1 = {
        "id": "evt_1",
        "event_time": t0,
        "ingested_at": t0,
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "auth_log",
    }
    ev2 = {
        "id": "evt_2",
        "event_time": t1,
        "ingested_at": t1,
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "service_log",  # Different source
    }

    timeline = reconstruct_timeline([ev1, ev2])
    assert timeline["events"][0]["ordering_ambiguous"] is True
    assert timeline["events"][1]["ordering_ambiguous"] is True
    assert FLAG_ORDERING_AMBIGUOUS in timeline["events"][0]["flags"]


def test_unordered_events_handling():
    t0 = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)
    ev_ok = {
        "id": "evt_ok",
        "event_time": t0,
        "ingested_at": t0,
        "timestamp_status": TIMESTAMP_STATUS_OK,
        "source": "auth_log",
    }
    ev_bad = {
        "id": "evt_bad",
        "event_time": None,
        "ingested_at": t0,
        "timestamp_status": TIMESTAMP_STATUS_MALFORMED,
        "source": "auth_log",
    }

    timeline = reconstruct_timeline([ev_ok, ev_bad])
    assert len(timeline["events"]) == 1
    assert timeline["events"][0]["id"] == "evt_ok"
    assert len(timeline["unordered"]) == 1
    assert timeline["unordered"][0]["id"] == "evt_bad"
    assert FLAG_TIMESTAMP_UNCERTAIN in timeline["unordered"][0]["flags"]
