"""
Investigation gaps detection service.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §6.2.
"""

from datetime import datetime
from typing import Any, Dict, List, Set
from app.core.constants import (
    CORRELATION_WINDOW_SECONDS,
    EVENT_TYPE_EXTERNAL_CONNECTION,
    EVENT_TYPE_MAINTENANCE,
    EVENT_TYPE_PRIVILEGE_CHANGE,
    FLAG_TIMESTAMP_UNCERTAIN,
    SERVICE_ACCOUNT_PREFIXES,
    STATUS_NEEDS_VERIFICATION,
)


def evaluate_investigation_gaps(
    events: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
    signals: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Identifies explicit investigative gaps to ensure epistemic honesty:
    - Initiator not established on privilege modification
    - Missing change-approval record
    - Unverified service account ownership
    - Unattributed external network egress
    - Unconfirmed initial access mechanism
    - Unverified causal links on relationships
    - Clock skew / timestamp uncertainty
    """
    gaps: List[Dict[str, Any]] = []
    gap_count = 0

    # 1. Check for needs_verification relationships
    needs_verif_edges = [r for r in relationships if r.get("status") == STATUS_NEEDS_VERIFICATION]
    if needs_verif_edges:
        gap_count += 1
        edge_ids = [r["id"] for r in needs_verif_edges]
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "high",
            "title": "Causal connection unverified across key associations",
            "description": f"{len(needs_verif_edges)} relationship(s) are based strictly on temporal proximity; direct causation is not established by raw logs.",
            "related_edge_ids": edge_ids,
            "resolves_with": "Host command execution history, EDR process lineage, or auditd audit trail",
        })

    # 2. Privilege changes without actor
    priv_events = [e for e in events if e.get("event_type") == EVENT_TYPE_PRIVILEGE_CHANGE]
    priv_without_actor = [e for e in priv_events if not e.get("actor")]
    if priv_without_actor:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "high",
            "title": "Initiator of the privilege modification is not established",
            "description": f"{len(priv_without_actor)} privilege modification event(s) record a target role change without an explicit initiating actor field.",
            "related_edge_ids": [r["id"] for r in needs_verif_edges],
            "resolves_with": "Directory or identity provider audit log specifying initiating session credentials",
        })

    # 3. Missing change approval covering privilege change
    maintenance_events = [e for e in events if e.get("event_type") == EVENT_TYPE_MAINTENANCE]
    unapproved_privs = []
    for pe in priv_events:
        p_time = pe.get("event_time")
        if not p_time:
            continue
        p_tgt = str(pe.get("target", "")).lower()
        matched_maint = False
        for me in maintenance_events:
            m_time = me.get("event_time")
            if m_time and abs((p_time - m_time).total_seconds()) <= CORRELATION_WINDOW_SECONDS:
                m_tgt = str(me.get("target", "")).lower()
                if p_tgt and m_tgt and (p_tgt in m_tgt or m_tgt in p_tgt):
                    matched_maint = True
                    break
        if not matched_maint:
            unapproved_privs.append(pe)

    if unapproved_privs:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "medium",
            "title": "No available change-approval record",
            "description": f"{len(unapproved_privs)} privilege change(s) have no corresponding approved maintenance ticket within the 15-minute correlation window.",
            "related_edge_ids": [],
            "resolves_with": "Enterprise ITSM / ServiceNow ticket audit trail confirming authorized emergency change",
        })

    # 4. Service account owner metadata
    service_actors = {
        e.get("actor")
        for e in events
        if e.get("actor") and any(e.get("actor", "").lower().startswith(p) for p in SERVICE_ACCOUNT_PREFIXES)
    }
    if service_actors:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "medium",
            "title": "No verified account ownership data",
            "description": f"Service accounts ({', '.join(service_actors)}) lack directory ownership, department, and interactive permission metadata in available logs.",
            "related_edge_ids": [],
            "resolves_with": "Active Directory / IdP service principal ownership registry",
        })

    # 5. External connections without process/user attribution
    ext_events = [e for e in events if e.get("event_type") == EVENT_TYPE_EXTERNAL_CONNECTION]
    if ext_events:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "medium",
            "title": "No attribution of the external connection to an account",
            "description": f"{len(ext_events)} outbound network egress connection(s) lack process executable name, PID, or authenticated user attribution in flow records.",
            "related_edge_ids": [],
            "resolves_with": "Endpoint socket telemetry / NetFlow with process GUID attribution",
        })

    # 6. Initial access mechanism
    has_unusual_auth = any(s.get("signal") in ("unusual_login_hour", "new_device_association", "failed_then_success") for s in signals)
    if has_unusual_auth:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "high",
            "title": "Initial access mechanism not confirmed",
            "description": "Log records show anomalous initial authentication, but mechanism (phishing token theft, brute force, credential stuffing, or valid-account misuse) cannot be proven from telemetry alone.",
            "related_edge_ids": [],
            "resolves_with": "Email security gateway logs, perimeter VPN MFA challenge records, or endpoint forensic triage",
        })

    # 7. Uncertain timestamps
    uncertain_events = [e for e in events if FLAG_TIMESTAMP_UNCERTAIN in e.get("arrival_flags", []) or e.get("timestamp_status") in ("missing", "malformed")]
    if uncertain_events:
        gap_count += 1
        gaps.append({
            "id": f"gap_{gap_count:04d}",
            "severity": "low",
            "title": f"Ordering uncertain for {len(uncertain_events)} events",
            "description": f"{len(uncertain_events)} event record(s) contain missing or unverified timestamps, preventing authoritative sequence verification.",
            "related_edge_ids": [],
            "resolves_with": "Synchronized NTP server audit logs and clock offset adjustments",
        })

    return gaps
