"""
Entity extraction and ID normalization for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §2.3, §4.
"""

from typing import Dict, Optional, Tuple
from app.core.constants import (
    DEVICE_PREFIXES,
    NODE_DEVICE,
    NODE_EVENT,
    NODE_EXTERNAL,
    NODE_SERVICE,
    NODE_USER,
)


def normalize_entity_id(raw_name: str, default_type: str) -> Tuple[str, str]:
    """
    Normalizes an entity name to lowercase, prefixed ID: e.g. user:jdoe, device:ws-114.
    Returns (entity_id, entity_type).
    """
    clean = str(raw_name).strip().lower()
    if clean.startswith("user:"):
        return clean, NODE_USER
    if clean.startswith("device:"):
        return clean, NODE_DEVICE
    if clean.startswith("service:"):
        return clean, NODE_SERVICE
    if clean.startswith("external:"):
        return clean, NODE_EXTERNAL
    if clean.startswith("event:"):
        return clean, NODE_EVENT

    # Target classification: check known device prefixes
    if default_type in (NODE_DEVICE, NODE_SERVICE):
        if any(clean.startswith(p) for p in DEVICE_PREFIXES):
            return f"device:{clean}", NODE_DEVICE
        return f"service:{clean}", NODE_SERVICE

    if default_type == NODE_USER:
        return f"user:{clean}", NODE_USER

    if default_type == NODE_EXTERNAL:
        return f"external:{clean}", NODE_EXTERNAL

    return f"{default_type.lower()}:{clean}", default_type


def classify_target(target_name: str) -> Tuple[str, str]:
    """Classifies a target string as either DEVICE or SERVICE."""
    return normalize_entity_id(target_name, NODE_SERVICE)
