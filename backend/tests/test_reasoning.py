"""
Evidence reasoning, signals, gaps, and hypotheses unit tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, 01_PRODUCT_AND_REASONING_SPEC.md §5, §6.
"""

from datetime import datetime, timezone, timedelta
import pytest
from app.services.graph.relationships import extract_relationships_from_events
from app.services.reasoning.hypothesis_engine import evaluate_hypotheses
from app.services.reasoning.initial_access import rank_initial_access_candidates
from app.services.reasoning.investigation_gaps import evaluate_investigation_gaps
from app.services.reasoning.signals import evaluate_signals


def test_signals_evaluation():
    # 02:00 UTC auth = outside business hours (07:00-19:00)
    t0 = datetime(2026, 11, 14, 2, 0, 0, tzinfo=timezone.utc)

    # 3 failures then success on WS-207
    events = [
        {
            "id": "evt_fail_1",
            "event_time": t0,
            "event_type": "authentication",
            "outcome": "failure",
            "actor": "jdoe",
            "source_device": "WS-101",
            "target": "WS-207",
            "source": "auth_log",
        },
        {
            "id": "evt_fail_2",
            "event_time": t0 + timedelta(seconds=30),
            "event_type": "authentication",
            "outcome": "failure",
            "actor": "jdoe",
            "source_device": "WS-101",
            "target": "WS-207",
            "source": "auth_log",
        },
        {
            "id": "evt_fail_3",
            "event_time": t0 + timedelta(seconds=60),
            "event_type": "authentication",
            "outcome": "failure",
            "actor": "jdoe",
            "source_device": "WS-101",
            "target": "WS-207",
            "source": "auth_log",
        },
        {
            "id": "evt_succ_1",
            "event_time": t0 + timedelta(seconds=90),
            "event_type": "authentication",
            "outcome": "success",
            "actor": "jdoe",
            "source_device": "WS-101",
            "target": "WS-207",
            "source": "auth_log",
        },
    ]

    signals = evaluate_signals(events)
    sig_names = [s["signal"] for s in signals]

    assert "unusual_login_hour" in sig_names
    assert "new_device_association" in sig_names
    assert "failed_then_success" in sig_names


def test_gaps_on_actorless_privilege_change():
    t0 = datetime(2026, 11, 14, 2, 0, 0, tzinfo=timezone.utc)

    e1 = {
        "id": "evt_access",
        "event_time": t0,
        "event_type": "service_access",
        "outcome": "success",
        "actor": "jdoe",
        "source_device": "WS-207",
        "target": "FileShare",
        "source": "service_log",
    }
    e2 = {
        "id": "evt_priv",
        "event_time": t0 + timedelta(minutes=5),
        "event_type": "privilege_change",
        "outcome": "success",
        "actor": None,  # No actor!
        "target": "FileShare",
        "source": "service_log",
    }

    events = [e1, e2]
    entities, relationships = extract_relationships_from_events(events)
    signals = evaluate_signals(events)
    gaps = evaluate_investigation_gaps(events, relationships, signals)

    gap_titles = [g["title"] for g in gaps]
    # Gap regarding unestablished initiator must be generated
    assert any("Initiator of the privilege modification is not established" in t for t in gap_titles)
    # Gap regarding unverified causal connection must be generated
    assert any("Causal connection unverified" in t for t in gap_titles)


def test_hypotheses_scoring_arithmetic():
    t0 = datetime(2026, 11, 14, 2, 0, 0, tzinfo=timezone.utc)

    events = [
        {
            "id": "evt_1",
            "event_time": t0,
            "event_type": "authentication",
            "outcome": "success",
            "actor": "jdoe",
            "source_device": "WS-101",
            "target": "WS-207",
            "source": "auth_log",
        },
        {
            "id": "evt_2",
            "event_time": t0 + timedelta(minutes=5),
            "event_type": "privilege_change",
            "outcome": "success",
            "actor": None,
            "target": "WS-207",
            "source": "service_log",
        },
    ]

    entities, relationships = extract_relationships_from_events(events)
    signals = evaluate_signals(events)
    gaps = evaluate_investigation_gaps(events, relationships, signals)
    hyps = evaluate_hypotheses(events, relationships, signals, gaps)

    h1 = next(h for h in hyps if h["key"] == "H1")
    assert 0 <= h1["score"] <= 100
    assert h1["score_type"] == "heuristic"
    assert len(h1["contributions"]) > 0

    # Ensure H3 formula matches min(100, 25 * open_gap_count)
    h3 = next(h for h in hyps if h["key"] == "H3")
    assert h3["score"] == min(100, 25 * len(gaps))
