"""
Temporal reconstruction and event ordering service for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §3.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.constants import (
    CLOCK_SKEW_TOLERANCE_SECONDS,
    DELAY_THRESHOLD_SECONDS,
    FLAG_DELAYED,
    FLAG_NORMAL,
    FLAG_ORDERING_AMBIGUOUS,
    FLAG_OUT_OF_ORDER,
    FLAG_PRIORITY,
    FLAG_TIMESTAMP_UNCERTAIN,
    TIMESTAMP_STATUS_NAIVE,
    TIMESTAMP_STATUS_OK,
)


def get_primary_flag(flags: List[str]) -> str:
    """Return the highest priority flag according to FLAG_PRIORITY."""
    for p in FLAG_PRIORITY:
        if p in flags:
            return p
    return FLAG_NORMAL


def count_inversions(seq_a: List[str], seq_b: List[str]) -> int:
    """
    Count the number of pairs that appear in different relative orders in seq_a vs seq_b.
    (Kendall-tau inversion count).
    """
    pos_b = {item: i for i, item in enumerate(seq_b)}
    # Project seq_a into positions in seq_b
    ranks = [pos_b[x] for x in seq_a if x in pos_b]

    inversions = 0
    n = len(ranks)
    for i in range(n):
        for j in range(i + 1, n):
            if ranks[i] > ranks[j]:
                inversions += 1
    return inversions


def reconstruct_timeline(
    events: List[Dict[str, Any]],
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Reconstructs chronological timeline from events list.
    Calculates delay_seconds, out_of_order flags, clock skew ambiguities, and inversions.
    """
    # Filter by time window if provided
    unordered_events: List[Dict[str, Any]] = []
    ordered_candidates: List[Dict[str, Any]] = []

    # Record original arrival sequence (by ingested_at, then row_number/id)
    arrival_sorted = sorted(
        events,
        key=lambda e: (
            e.get("ingested_at") or datetime.min.replace(tzinfo=timezone.utc),
            e.get("row_number") or 0,
            e.get("id") or "",
        ),
    )
    arrival_sequence = [e["id"] for e in arrival_sorted if e.get("id")]

    for ev in events:
        ev_time = ev.get("event_time")
        if not ev_time or ev.get("timestamp_status") not in (TIMESTAMP_STATUS_OK, TIMESTAMP_STATUS_NAIVE):
            # Unordered event
            flags = [FLAG_TIMESTAMP_UNCERTAIN]
            unordered_events.append({
                "id": ev["id"],
                "event_time": None,
                "ingested_at": ev.get("ingested_at"),
                "delay_seconds": None,
                "event_type": ev.get("event_type", "other"),
                "source": ev.get("source", "unknown"),
                "actor": ev.get("actor"),
                "source_device": ev.get("source_device"),
                "target": ev.get("target"),
                "outcome": ev.get("outcome", "unknown"),
                "flags": flags,
                "primary_flag": FLAG_TIMESTAMP_UNCERTAIN,
                "ordering_ambiguous": False,
                "signal_ids": ev.get("signal_ids", []),
            })
            continue

        # Check time window bounds
        if from_time and ev_time < from_time:
            continue
        if to_time and ev_time > to_time:
            continue

        ordered_candidates.append(ev)

    # 1. Sort events with valid event_time by (event_time, ingested_at, id)
    chrono_sorted = sorted(
        ordered_candidates,
        key=lambda e: (
            e["event_time"],
            e.get("ingested_at") or datetime.min.replace(tzinfo=timezone.utc),
            e.get("id") or "",
        ),
    )

    # Compute inversions against arrival order
    chrono_ids = [e["id"] for e in chrono_sorted]
    inversions = count_inversions(arrival_sequence, chrono_ids)

    # Position in arrival order map
    arrival_rank = {eid: idx for idx, eid in enumerate(arrival_sequence)}

    # Map events to TimelineEvent shapes with flags
    timeline_events: List[Dict[str, Any]] = []
    n_chrono = len(chrono_sorted)

    for i, ev in enumerate(chrono_sorted):
        eid = ev["id"]
        ev_time = ev["event_time"]
        ingested_at = ev.get("ingested_at")

        # Delay
        delay_seconds = ev.get("delay_seconds")
        if delay_seconds is None and ingested_at and ev_time:
            delay_seconds = int((ingested_at - ev_time).total_seconds())

        flags = set()

        # Out-of-order check: an earlier-arriving event (lower arrival_rank) has a LATER event_time
        # or a later-arriving event has an EARLIER event_time
        my_arrival = arrival_rank.get(eid, 0)
        # Check if any event appearing before this in chronology arrived later
        # OR if any event appearing after this in chronology arrived earlier
        is_out_of_order = False
        for j in range(i):
            earlier_chrono_id = chrono_sorted[j]["id"]
            if arrival_rank.get(earlier_chrono_id, 0) > my_arrival:
                is_out_of_order = True
                break
        if not is_out_of_order:
            for j in range(i + 1, n_chrono):
                later_chrono_id = chrono_sorted[j]["id"]
                if arrival_rank.get(later_chrono_id, 0) < my_arrival:
                    is_out_of_order = True
                    break

        if is_out_of_order:
            flags.add(FLAG_OUT_OF_ORDER)

        if delay_seconds is not None and delay_seconds > DELAY_THRESHOLD_SECONDS:
            flags.add(FLAG_DELAYED)

        # Ambiguous ordering check: event_time diff <= CLOCK_SKEW_TOLERANCE_SECONDS with different source
        ordering_ambiguous = False
        # Check predecessor and successor
        for neighbor_idx in (i - 1, i + 1):
            if 0 <= neighbor_idx < n_chrono:
                neighbor = chrono_sorted[neighbor_idx]
                neighbor_time = neighbor["event_time"]
                diff = abs((ev_time - neighbor_time).total_seconds())
                if diff <= CLOCK_SKEW_TOLERANCE_SECONDS and neighbor.get("source") != ev.get("source"):
                    ordering_ambiguous = True
                    flags.add(FLAG_ORDERING_AMBIGUOUS)
                    break

        if not flags:
            flags.add(FLAG_NORMAL)

        flag_list = list(flags)
        primary_flag = get_primary_flag(flag_list)

        timeline_events.append({
            "id": eid,
            "event_time": ev_time,
            "ingested_at": ingested_at,
            "delay_seconds": delay_seconds,
            "event_type": ev.get("event_type", "other"),
            "source": ev.get("source", "unknown"),
            "actor": ev.get("actor"),
            "source_device": ev.get("source_device"),
            "target": ev.get("target"),
            "outcome": ev.get("outcome", "unknown"),
            "flags": flag_list,
            "primary_flag": primary_flag,
            "ordering_ambiguous": ordering_ambiguous,
            "signal_ids": ev.get("signal_ids", []),
        })

    return {
        "events": timeline_events,
        "arrival_sequence": arrival_sequence,
        "inversions": inversions,
        "unordered": unordered_events,
    }
