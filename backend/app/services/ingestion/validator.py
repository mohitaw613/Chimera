"""
Event validator and deduplication service for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §2.3.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.constants import (
    DELAY_THRESHOLD_SECONDS,
    FLAG_DELAYED,
    FLAG_NORMAL,
    FLAG_TIMESTAMP_UNCERTAIN,
    TIMESTAMP_STATUS_NAIVE,
    TIMESTAMP_STATUS_OK,
)


def compute_event_fingerprint(event_data: Dict[str, Any]) -> Tuple:
    """
    Computes a deduplication fingerprint for an event:
    (event_time_iso, event_type, actor, source_device, target, outcome, source)
    """
    event_time = event_data.get("event_time")
    time_str = event_time.isoformat() if isinstance(event_time, datetime) else str(event_time)
    return (
        time_str,
        str(event_data.get("event_type")),
        str(event_data.get("actor")),
        str(event_data.get("source_device")),
        str(event_data.get("target")),
        str(event_data.get("outcome")),
        str(event_data.get("source")),
    )


def assign_initial_flags_and_delay(
    event_data: Dict[str, Any],
    default_ingest_time: datetime,
) -> Dict[str, Any]:
    """
    Computes ingested_at (if missing), delay_seconds, and preliminary arrival flags.
    """
    ingested_at = event_data.get("ingested_at")
    if not ingested_at:
        ingested_at = default_ingest_time
        event_data["ingested_at"] = ingested_at

    event_time = event_data.get("event_time")
    delay_seconds: Optional[int] = None
    flags: List[str] = []

    # Check timestamp certainty
    status = event_data.get("timestamp_status", TIMESTAMP_STATUS_OK)
    if status not in (TIMESTAMP_STATUS_OK, TIMESTAMP_STATUS_NAIVE):
        flags.append(FLAG_TIMESTAMP_UNCERTAIN)

    # Compute delay if event_time is valid
    if event_time is not None:
        delta = (ingested_at - event_time).total_seconds()
        delay_seconds = int(delta)
        if delay_seconds > DELAY_THRESHOLD_SECONDS:
            flags.append(FLAG_DELAYED)

    if not flags:
        flags.append(FLAG_NORMAL)

    event_data["delay_seconds"] = delay_seconds
    event_data["arrival_flags"] = flags
    return event_data
