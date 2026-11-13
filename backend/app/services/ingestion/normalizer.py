"""
Record normalizer for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §2.2, §2.3.
Transforms raw record dicts into canonical representations.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from dateutil import parser as date_parser

from app.core.constants import (
    EVENT_TYPES,
    EVENT_TYPE_KEYWORD_MAPPINGS,
    EVENT_TYPE_OTHER,
    FIELD_ALIASES,
    OUTCOMES,
    OUTCOME_KEYWORD_MAPPINGS,
    OUTCOME_UNKNOWN,
    SERVICE_ACCOUNT_PREFIXES,
    TIMESTAMP_STATUS_MALFORMED,
    TIMESTAMP_STATUS_MISSING,
    TIMESTAMP_STATUS_NAIVE,
    TIMESTAMP_STATUS_OK,
)


def _find_field_value(
    record: Dict[str, Any],
    canonical_name: str,
    custom_mapping: Optional[Dict[str, str]] = None,
) -> Tuple[Optional[Any], Optional[str]]:
    """
    Search record for a canonical field using custom mapping or FIELD_ALIASES.
    Returns (value, matched_key) or (None, None).
    """
    record_lower_map = {str(k).lower(): k for k in record.keys()}

    # Check custom mapping first
    if custom_mapping and canonical_name in custom_mapping:
        mapped_key = custom_mapping[canonical_name]
        if mapped_key in record:
            return record[mapped_key], mapped_key
        if mapped_key.lower() in record_lower_map:
            orig_k = record_lower_map[mapped_key.lower()]
            return record[orig_k], orig_k

    # Check aliases
    aliases = FIELD_ALIASES.get(canonical_name, [canonical_name])
    for alias in aliases:
        alias_lower = alias.lower()
        if alias_lower in record_lower_map:
            orig_k = record_lower_map[alias_lower]
            val = record[orig_k]
            if val is not None and str(val).strip() != "":
                return val, orig_k

    return None, None


def normalize_event_type(raw_val: Any) -> str:
    """Normalize raw event type/action to canonical enum."""
    if not raw_val:
        return EVENT_TYPE_OTHER
    val_str = str(raw_val).strip().lower()
    if val_str in EVENT_TYPES:
        return val_str
    for kw, target_type in EVENT_TYPE_KEYWORD_MAPPINGS.items():
        if kw in val_str:
            return target_type
    return EVENT_TYPE_OTHER


def normalize_outcome(raw_val: Any) -> str:
    """Normalize raw outcome string/bool to canonical outcome enum."""
    if raw_val is None:
        return OUTCOME_UNKNOWN
    val_str = str(raw_val).strip().lower()
    if val_str in OUTCOMES:
        return val_str
    if val_str in OUTCOME_KEYWORD_MAPPINGS:
        return OUTCOME_KEYWORD_MAPPINGS[val_str]
    return OUTCOME_UNKNOWN


def parse_timestamp(raw_val: Any) -> Tuple[Optional[datetime], str]:
    """
    Parse timestamp into UTC datetime and determine timestamp_status.
    Returns (utc_datetime_or_None, status).
    """
    if raw_val is None or str(raw_val).strip() == "":
        return None, TIMESTAMP_STATUS_MISSING

    try:
        val_str = str(raw_val).strip()
        parsed = date_parser.parse(val_str)
        if parsed.tzinfo is None:
            # Naive timestamp: assume UTC and flag naive_assumed_utc
            utc_dt = parsed.replace(tzinfo=timezone.utc)
            return utc_dt, TIMESTAMP_STATUS_NAIVE
        else:
            # Timezone aware: convert to UTC
            utc_dt = parsed.astimezone(timezone.utc)
            return utc_dt, TIMESTAMP_STATUS_OK
    except Exception:
        return None, TIMESTAMP_STATUS_MALFORMED


def normalize_record(
    raw_record: Dict[str, Any],
    default_source: str,
    custom_mapping: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Normalize raw record into canonical dictionary fields according to spec 01 §2.
    """
    consumed_keys = set()

    # event_time
    raw_time, time_k = _find_field_value(raw_record, "event_time", custom_mapping)
    if time_k:
        consumed_keys.add(time_k)
    event_time, timestamp_status = parse_timestamp(raw_time)

    # ingested_at
    raw_ingest, ingest_k = _find_field_value(raw_record, "ingested_at", custom_mapping)
    if ingest_k:
        consumed_keys.add(ingest_k)
    ingested_at, _ = parse_timestamp(raw_ingest) if raw_ingest else (None, "missing")

    # event_type
    raw_type, type_k = _find_field_value(raw_record, "event_type", custom_mapping)
    if type_k:
        consumed_keys.add(type_k)
    event_type = normalize_event_type(raw_type)

    # actor
    raw_actor, actor_k = _find_field_value(raw_record, "actor", custom_mapping)
    if actor_k:
        consumed_keys.add(actor_k)
    actor = str(raw_actor).strip() if raw_actor is not None else None

    # source_device
    raw_dev, dev_k = _find_field_value(raw_record, "source_device", custom_mapping)
    if dev_k:
        consumed_keys.add(dev_k)
    source_device = str(raw_dev).strip() if raw_dev is not None else None

    # target
    raw_target, target_k = _find_field_value(raw_record, "target", custom_mapping)
    if target_k:
        consumed_keys.add(target_k)
    target = str(raw_target).strip() if raw_target is not None else None

    # source_ip
    raw_src_ip, ip_k = _find_field_value(raw_record, "source_ip", custom_mapping)
    if ip_k:
        consumed_keys.add(ip_k)
    source_ip = str(raw_src_ip).strip() if raw_src_ip is not None else None

    # dest_ip
    raw_dst_ip, dst_k = _find_field_value(raw_record, "dest_ip", custom_mapping)
    if dst_k:
        consumed_keys.add(dst_k)
    dest_ip = str(raw_dst_ip).strip() if raw_dst_ip is not None else None

    # outcome
    raw_outcome, outcome_k = _find_field_value(raw_record, "outcome", custom_mapping)
    if outcome_k:
        consumed_keys.add(outcome_k)
    outcome = normalize_outcome(raw_outcome)

    # source
    raw_src, src_k = _find_field_value(raw_record, "source", custom_mapping)
    if src_k:
        consumed_keys.add(src_k)
    source = str(raw_src).strip() if raw_src is not None else default_source

    # Collect unmapped attributes
    attributes: Dict[str, Any] = {}
    if dest_ip:
        attributes["dest_ip"] = dest_ip

    for k, v in raw_record.items():
        if k not in consumed_keys:
            attributes[k] = v

    # Check for service account metadata
    if actor:
        actor_lower = actor.lower()
        if any(actor_lower.startswith(p) for p in SERVICE_ACCOUNT_PREFIXES):
            attributes["account_kind"] = "service"

    return {
        "event_time": event_time,
        "ingested_at": ingested_at,
        "event_type": event_type,
        "source": source,
        "actor": actor,
        "source_device": source_device,
        "target": target,
        "source_ip": source_ip,
        "outcome": outcome,
        "timestamp_status": timestamp_status,
        "raw_record": raw_record,
        "attributes": attributes,
    }
