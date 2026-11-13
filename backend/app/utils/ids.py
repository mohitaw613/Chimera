"""
Identifier generation utilities for CHIMERA.
Ensures deterministic, stable IDs as mandated by specification.
"""

import hashlib
import uuid
from typing import Optional
from app.core.constants import DEVICE_PREFIXES, NODE_DEVICE, NODE_SERVICE


def generate_investigation_id() -> str:
    """Generate a random investigation ID."""
    return f"inv_{uuid.uuid4().hex[:12]}"


def generate_file_id() -> str:
    """Generate a unique file ID."""
    return f"file_{uuid.uuid4().hex[:10]}"


def format_event_id(sequence_number: int) -> str:
    """Format canonical event ID: evt_000001."""
    return f"evt_{sequence_number:06d}"


def normalize_entity_id(raw_name: str, entity_type: str) -> str:
    """
    Normalize entity IDs: lowercase, prefixed with type.
    user:jdoe, device:ws-114, service:file01, ip:10.0.0.1, external:203.0.113.45
    """
    clean_name = raw_name.strip().lower()
    prefix = entity_type.strip().lower()
    return f"{prefix}:{clean_name}"


def determine_target_entity_type(target_str: str) -> str:
    """
    A target that matches a known device pattern (SRV-, WS-, HOST-) is a DEVICE;
    otherwise SERVICE. (Configurable via DEVICE_PREFIXES).
    """
    t_lower = target_str.strip().lower()
    for prefix in DEVICE_PREFIXES:
        if t_lower.startswith(prefix):
            return NODE_DEVICE
    return NODE_SERVICE


def generate_edge_id(source: str, target: str, rel_type: str, status: str) -> str:
    """
    Generate deterministic edge ID: edge_{sha1(source|target|type|status)[:8]}
    """
    seed = f"{source}|{target}|{rel_type}|{status}"
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:8]
    return f"edge_{digest}"
