"""
Rule-based transparent anomaly signals engine.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §5.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Tuple

from app.core.constants import (
    BUSINESS_HOURS_END,
    BUSINESS_HOURS_START,
    CORRELATION_WINDOW_SECONDS,
    DENSE_N,
    EVENT_TYPE_AUTHENTICATION,
    EVENT_TYPE_EXTERNAL_CONNECTION,
    EVENT_TYPE_MAINTENANCE,
    EVENT_TYPE_PRIVILEGE_CHANGE,
    OUTCOME_FAILURE,
    OUTCOME_SUCCESS,
    SERVICE_ACCOUNT_PREFIXES,
)


def evaluate_signals(
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Evaluates rule-based signals over chronologically sorted events:
    - unusual_login_hour
    - new_device_association
    - service_account_interactive_login
    - failed_then_success
    - privilege_change_event
    - new_external_endpoint
    - dense_sequence
    """
    valid_events = [e for e in events if e.get("event_time") is not None]
    sorted_events = sorted(valid_events, key=lambda e: (e["event_time"], e.get("ingested_at") or e["event_time"], e.get("id") or ""))

    signals: List[Dict[str, Any]] = []
    sig_count = 0

    seen_user_device_pairs: Set[Tuple[str, str]] = set()
    seen_external_ips: Set[str] = set()
    auth_failure_history: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    maintenance_events: List[Dict[str, Any]] = []

    # First pass: collect maintenance records
    for ev in sorted_events:
        if ev.get("event_type") == EVENT_TYPE_MAINTENANCE:
            maintenance_events.append(ev)

    for ev in sorted_events:
        eid = ev["id"]
        ev_time: datetime = ev["event_time"]
        etype = ev.get("event_type")
        outcome = ev.get("outcome")
        actor = ev.get("actor")
        src_dev = ev.get("source_device")
        target = ev.get("target")

        # 1. unusual_login_hour
        if etype == EVENT_TYPE_AUTHENTICATION and outcome == OUTCOME_SUCCESS and actor:
            actor_lower = actor.lower()
            is_service = any(actor_lower.startswith(p) for p in SERVICE_ACCOUNT_PREFIXES)
            if not is_service:
                hour = ev_time.hour
                if hour < BUSINESS_HOURS_START or hour >= BUSINESS_HOURS_END:
                    sig_count += 1
                    signals.append({
                        "id": f"sig_{sig_count:04d}",
                        "signal": "unusual_login_hour",
                        "entity_id": f"user:{actor_lower}",
                        "event_id": eid,
                        "reason": f"Authentication occurred at {ev_time.strftime('%H:%M')} UTC (outside business hours 07:00–19:00 UTC)",
                        "severity": "medium",
                        "kind": "anomaly",
                    })

        # 2. new_device_association
        if etype == EVENT_TYPE_AUTHENTICATION and outcome == OUTCOME_SUCCESS and actor and (target or src_dev):
            device_name = target if target and ("ws-" in target.lower() or "srv-" in target.lower()) else src_dev
            if device_name:
                pair = (actor.lower(), device_name.lower())
                if pair not in seen_user_device_pairs:
                    seen_user_device_pairs.add(pair)
                    sig_count += 1
                    signals.append({
                        "id": f"sig_{sig_count:04d}",
                        "signal": "new_device_association",
                        "entity_id": f"user:{actor.lower()}",
                        "event_id": eid,
                        "reason": f"First observed association between {actor} and {device_name} in available telemetry",
                        "severity": "medium",
                        "kind": "first_observed",
                    })

        # 3. service_account_interactive_login
        if etype == EVENT_TYPE_AUTHENTICATION and outcome == OUTCOME_SUCCESS and actor and (src_dev or target):
            actor_lower = actor.lower()
            is_service = any(actor_lower.startswith(p) for p in SERVICE_ACCOUNT_PREFIXES)
            device_str = (target or src_dev or "").lower()
            if is_service and ("ws-" in device_str or "workstation" in device_str):
                sig_count += 1
                signals.append({
                    "id": f"sig_{sig_count:04d}",
                    "signal": "service_account_interactive_login",
                    "entity_id": f"user:{actor_lower}",
                    "event_id": eid,
                    "reason": f"Service account '{actor}' authenticated interactively to workstation '{device_str}'",
                    "severity": "high",
                    "kind": "anomaly",
                })

        # 4. failed_then_success
        if etype == EVENT_TYPE_AUTHENTICATION:
            dev_str = (target or src_dev or "unknown").lower()
            user_str = (actor or "unknown").lower()
            key = (user_str, dev_str)
            if outcome == OUTCOME_FAILURE:
                auth_failure_history.setdefault(key, []).append(ev)
            elif outcome == OUTCOME_SUCCESS:
                if key in auth_failure_history:
                    recent_fails = [
                        f for f in auth_failure_history[key]
                        if (ev_time - f["event_time"]).total_seconds() <= CORRELATION_WINDOW_SECONDS
                    ]
                    if len(recent_fails) >= 3:
                        sig_count += 1
                        signals.append({
                            "id": f"sig_{sig_count:04d}",
                            "signal": "failed_then_success",
                            "entity_id": f"user:{user_str}",
                            "event_id": eid,
                            "reason": f"{len(recent_fails)} consecutive authentication failures preceding success within correlation window",
                            "severity": "medium",
                            "kind": "anomaly",
                        })

        # 5. privilege_change_event
        if etype == EVENT_TYPE_PRIVILEGE_CHANGE:
            actor_lower = (actor or "").lower()
            is_service = any(actor_lower.startswith(p) for p in SERVICE_ACCOUNT_PREFIXES)
            # Check nearby approved maintenance
            has_approval = False
            for m in maintenance_events:
                if abs((ev_time - m["event_time"]).total_seconds()) <= CORRELATION_WINDOW_SECONDS:
                    m_tgt = str(m.get("target", "")).lower()
                    ev_tgt = str(target or "").lower()
                    if m_tgt and ev_tgt and (m_tgt in ev_tgt or ev_tgt in m_tgt):
                        has_approval = True
                        break

            severity = "high" if (is_service or not has_approval) else "medium"
            ent_id = f"user:{actor_lower}" if actor else f"service:{str(target).lower()}"
            sig_count += 1
            signals.append({
                "id": f"sig_{sig_count:04d}",
                "signal": "privilege_change_event",
                "entity_id": ent_id,
                "event_id": eid,
                "reason": f"Privilege change recorded on '{target or 'host'}' (approval status: {'verified' if has_approval else 'unverified'})",
                "severity": severity,
                "kind": "anomaly",
            })

        # 6. new_external_endpoint
        if etype == EVENT_TYPE_EXTERNAL_CONNECTION:
            dest_ip = ev.get("attributes", {}).get("dest_ip") or target
            if dest_ip and dest_ip not in seen_external_ips:
                seen_external_ips.add(dest_ip)
                sig_count += 1
                signals.append({
                    "id": f"sig_{sig_count:04d}",
                    "signal": "new_external_endpoint",
                    "entity_id": f"external:{dest_ip}",
                    "event_id": eid,
                    "reason": f"Outbound connection to newly observed external IP: {dest_ip}",
                    "severity": "medium",
                    "kind": "anomaly",
                })

    # 7. dense_sequence
    # Check if >= DENSE_N distinct suspicious signals occurred within correlation window
    if len(signals) >= DENSE_N:
        for i in range(len(signals)):
            window_sigs = [signals[i]]
            ev_i = next(e for e in valid_events if e["id"] == signals[i]["event_id"])
            t_i = ev_i["event_time"]
            for j in range(i + 1, len(signals)):
                ev_j = next(e for e in valid_events if e["id"] == signals[j]["event_id"])
                t_j = ev_j["event_time"]
                if (t_j - t_i).total_seconds() <= CORRELATION_WINDOW_SECONDS:
                    window_sigs.append(signals[j])
            if len(window_sigs) >= DENSE_N:
                sig_count += 1
                signals.append({
                    "id": f"sig_{sig_count:04d}",
                    "signal": "dense_sequence",
                    "entity_id": signals[i]["entity_id"],
                    "event_id": signals[i]["event_id"],
                    "reason": f"Cluster of {len(window_sigs)} distinct suspicious signals within 15-minute window",
                    "severity": "high",
                    "kind": "anomaly",
                })
                break

    return signals
