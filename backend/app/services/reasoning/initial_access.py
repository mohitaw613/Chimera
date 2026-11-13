"""
Initial access candidate ranker and root-cause reasoning.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §7.
"""

from typing import Any, Dict, List
from app.core.constants import MITRE_MAPPINGS


def rank_initial_access_candidates(
    events: List[Dict[str, Any]],
    signals: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Ranks earliest-in-time entry events into suspicious subgraphs carrying signals.
    Attaches fixed epistemic caveat and MITRE technique tag.
    """
    signal_map: Dict[str, List[Dict[str, Any]]] = {}
    for s in signals:
        signal_map.setdefault(s["event_id"], []).append(s)

    # Filter to events that carried initial access relevant signals:
    # unusual_login_hour, new_device_association, failed_then_success
    candidates_pool = []
    for ev in events:
        eid = ev["id"]
        ev_sigs = signal_map.get(eid, [])
        if not ev_sigs:
            continue

        sig_names = [s["signal"] for s in ev_sigs]
        is_relevant = any(
            name in ("unusual_login_hour", "new_device_association", "failed_then_success")
            for name in sig_names
        ) or ev.get("source_ip") is not None

        if is_relevant and ev.get("event_type") == "authentication" and ev.get("outcome") == "success":
            reasons = [s["reason"] for s in ev_sigs]
            candidates_pool.append({
                "event": ev,
                "signals": ev_sigs,
                "reason": "; ".join(reasons) or "Anomalous authentication entry into network environment",
            })

    # Sort candidates chronologically (earliest first)
    candidates_pool.sort(key=lambda c: (
        c["event"].get("event_time"),
        c["event"].get("ingested_at") or c["event"].get("event_time"),
        c["event"]["id"],
    ))

    results = []
    for rank, cand in enumerate(candidates_pool[:3], start=1):
        ev = cand["event"]
        actor = ev.get("actor") or "unknown"
        entity_id = f"user:{actor.lower()}"

        results.append({
            "rank": rank,
            "event_id": ev["id"],
            "entity_id": entity_id,
            "reason": cand["reason"],
            "evidence_ids": [ev["id"]],
            "caveat": "Candidate only — mechanism (phishing, credential theft, valid-account misuse) not determinable from these logs.",
            "technique": MITRE_MAPPINGS["initial_access"],
        })

    return results
