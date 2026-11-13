"""
Timestamp parsing and normalization utilities.
Follows rules in 01_PRODUCT_AND_REASONING_SPEC.md §2.3.
"""

from datetime import datetime, timezone
from typing import Optional, Tuple
from dateutil import parser as dt_parser
from app.core.constants import (
    TIMESTAMP_STATUS_OK,
    TIMESTAMP_STATUS_MISSING,
    TIMESTAMP_STATUS_MALFORMED,
    TIMESTAMP_STATUS_NAIVE,
)


def parse_and_normalize_timestamp(raw_value: Optional[str]) -> Tuple[Optional[datetime], str]:
    """
    Parse a timestamp string into an aware UTC datetime and return (datetime_utc, timestamp_status).
    - If value is missing/empty: (None, 'missing')
    - If unparseable: (None, 'malformed')
    - If naive (no timezone): convert assuming UTC, status 'naive_assumed_utc'
    - If already aware: convert to UTC, status 'ok'
    """
    if raw_value is None:
        return None, TIMESTAMP_STATUS_MISSING

    val_str = str(raw_value).strip()
    if not val_str:
        return None, TIMESTAMP_STATUS_MISSING

    try:
        dt = dt_parser.parse(val_str)
        if dt.tzinfo is None:
            # Naive timestamp assumed UTC
            dt_utc = dt.replace(tzinfo=timezone.utc)
            return dt_utc, TIMESTAMP_STATUS_NAIVE
        else:
            # Aware timestamp converted to UTC
            dt_utc = dt.astimezone(timezone.utc)
            return dt_utc, TIMESTAMP_STATUS_OK
    except Exception:
        return None, TIMESTAMP_STATUS_MALFORMED
