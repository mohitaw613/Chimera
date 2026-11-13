"""
Attack graph edge construction rules R1-R7 and confidence calculation.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §4.1, §4.2, §4.3.
"""

from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional, Tuple

from app.core.constants import (
    CORRELATION_WINDOW_SECONDS,
    EDGE_ACCESSED,
    EDGE_ASSOCIATED_WITH,
    EDGE_AUTHENTICATED_TO,
    EDGE_CONNECTED_TO,
    EDGE_MODIFIED,
    EVENT_TYPE_AUTHENTICATION,
    EVENT_TYPE_EXTERNAL_CONNECTION,
    EVENT_TYPE_MAINTENANCE,
    EVENT_TYPE_PRIVILEGE_CHANGE,
    EVENT_TYPE_SERVICE_ACCESS,
    FLAG_ORDERING_AMBIGUOUS,
    FLAG_TIMESTAMP_UNCERTAIN,
    NODE_DEVICE,
    NODE_EVENT,
    NODE_EXTERNAL,
    NODE_SERVICE,
    NODE_USER,
    OUTCOME_FAILURE,
    OUTCOME_SUCCESS,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)
from app.services.graph.entity_extractor import classify_target, normalize_entity_id


def generate_edge_id(source_id: str, target_id: str, edge_type: str, status: str, investigation_id: str = "") -> str:
    """Stable edge ID: edge_{sha1(investigation_id|source|target|type|status)[:8]}"""
    raw = f"{investigation_id}|{source_id}|{target_id}|{edge_type}|{status}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"edge_{digest[:8]}"


def calculate_edge_confidence(
    status: str,
    evidence_events: List[Dict[str, Any]],
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Computes heuristic evidence confidence and breakdown according to spec 01 §4.2:
    - observed: base 0.85 + 0.05*(n_corroborating - 1), cap 1.00
    - inferred: base 0.50
    - needs_verification: base 0.35
    - modifiers:
      -0.10 if ordering_ambiguous
      -0.15 if any supporting event timestamp_uncertain
      +0.05 if seen from >=2 distinct log sources
    - clamped to [0.05, 1.00]
    """
    breakdown: List[Dict[str, Any]] = []

    if status == STATUS_OBSERVED:
        base = 0.85
        n_corrob = len(evidence_events)
        corrob_bonus = min(0.15, max(0.0, 0.05 * (n_corrob - 1)))
        breakdown.append({"label": "base observed", "delta": base})
        if corrob_bonus > 0:
            breakdown.append({"label": f"corroborating events ({n_corrob})", "delta": round(corrob_bonus, 2)})
        current = base + corrob_bonus
    elif status == STATUS_INFERRED:
        base = 0.50
        breakdown.append({"label": "base inferred", "delta": base})
        current = base
    else:  # STATUS_NEEDS_VERIFICATION
        base = 0.35
        breakdown.append({"label": "base needs_verification", "delta": base})
        current = base

    # Modifiers
    any_ambiguous = any(FLAG_ORDERING_AMBIGUOUS in ev.get("flags", []) or ev.get("ordering_ambiguous") for ev in evidence_events)
    if any_ambiguous:
        breakdown.append({"label": "ordering_ambiguous penalty", "delta": -0.10})
        current -= 0.10

    any_uncertain = any(FLAG_TIMESTAMP_UNCERTAIN in ev.get("flags", []) or ev.get("timestamp_status") in ("malformed", "missing") for ev in evidence_events)
    if any_uncertain:
        breakdown.append({"label": "timestamp_uncertain penalty", "delta": -0.15})
        current -= 0.15

    distinct_sources = {ev.get("source") for ev in evidence_events if ev.get("source")}
    if len(distinct_sources) >= 2:
        breakdown.append({"label": "multi-source corroboration", "delta": 0.05})
        current += 0.05

    confidence = round(max(0.05, min(1.00, current)), 2)
    return confidence, breakdown


def build_edge_explanation(
    edge_type: str,
    status: str,
    source_id: str,
    target_id: str,
    gap_text: Optional[str] = None,
    delta_seconds: Optional[int] = None,
) -> Tuple[str, str]:
    """Generates human-readable explanation and epistemic note."""
    if status == STATUS_OBSERVED:
        why = f"A direct {edge_type} record explicitly connects {source_id} to {target_id}."
        note = "Direct log observation; record explicitly affirms the relationship."
    elif status == STATUS_INFERRED:
        time_str = f" occurred {delta_seconds}s before" if delta_seconds is not None else ""
        why = f"{source_id}{time_str} is associated with {target_id} within the 15-minute correlation window."
        note = "Inferred association based on temporal and topological proximity in network telemetry."
    else:  # needs_verification
        time_str = f"{delta_seconds}s before" if delta_seconds is not None else "prior to"
        why = f"{source_id} was active on the target resource {time_str} the modification event."
        note = f"Temporal proximity only; records do not establish {gap_text or 'causal attribution'}."

    return why, note


def extract_relationships_from_events(
    events: List[Dict[str, Any]],
    investigation_id: str = "",
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Executes rules R1-R7 over chronologically sorted events.
    Returns (entities_list, relationships_list).
    """
    # Filter to events with valid time
    valid_events = [e for e in events if e.get("event_time") is not None]
    sorted_events = sorted(valid_events, key=lambda e: (e["event_time"], e.get("ingested_at") or e["event_time"], e.get("id") or ""))

    entities_map: Dict[str, Dict[str, Any]] = {}
    relationships_map: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}

    def register_entity(eid: str, etype: str, label: str, ev_time: datetime):
        if eid not in entities_map:
            entities_map[eid] = {
                "id": eid,
                "entity_type": etype,
                "label": label,
                "attributes": {},
                "first_seen": ev_time,
                "last_seen": ev_time,
            }
        else:
            if ev_time < entities_map[eid]["first_seen"]:
                entities_map[eid]["first_seen"] = ev_time
            if ev_time > entities_map[eid]["last_seen"]:
                entities_map[eid]["last_seen"] = ev_time

    def add_relationship(
        source_id: str,
        target_id: str,
        edge_type: str,
        status: str,
        ev: Dict[str, Any],
        role: str = "direct",
        gap_text: Optional[str] = None,
        delta_seconds: Optional[int] = None,
    ):
        key = (source_id, target_id, edge_type, status)
        ev_time = ev["event_time"]

        if key in relationships_map:
            rel = relationships_map[key]
            if ev["id"] not in rel["evidence_ids"]:
                rel["evidence_ids"].append(ev["id"])
                rel["evidence_items"].append({"event": ev, "role": role})
            if ev_time < rel["first_event_time"]:
                rel["first_event_time"] = ev_time
            if ev_time > rel["last_event_time"]:
                rel["last_event_time"] = ev_time
        else:
            edge_id = generate_edge_id(source_id, target_id, edge_type, status, investigation_id)
            why, note = build_edge_explanation(edge_type, status, source_id, target_id, gap_text, delta_seconds)
            relationships_map[key] = {
                "id": edge_id,
                "source_entity_id": source_id,
                "target_entity_id": target_id,
                "relationship_type": edge_type,
                "status": status,
                "first_event_time": ev_time,
                "last_event_time": ev_time,
                "explanation": why,
                "epistemic_note": note,
                "evidence_ids": [ev["id"]],
                "evidence_items": [{"event": ev, "role": role}],
                "gap_text": gap_text,
            }

    # Tracking for temporal correlation rules R3b, R5, R6, R7
    recent_accesses: List[Dict[str, Any]] = []
    privilege_changes: List[Dict[str, Any]] = []
    auth_failures: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}

    for ev in sorted_events:
        etype = ev.get("event_type")
        outcome = ev.get("outcome")
        actor = ev.get("actor")
        src_dev = ev.get("source_device")
        target = ev.get("target")
        ev_time = ev["event_time"]

        # R1: Authentication
        if etype == EVENT_TYPE_AUTHENTICATION:
            if outcome == OUTCOME_SUCCESS:
                # If target is device, use target; else source_device
                dev_id = None
                if target:
                    t_id, t_type = classify_target(target)
                    if t_type == NODE_DEVICE:
                        dev_id = t_id
                        register_entity(t_id, NODE_DEVICE, target, ev_time)

                if not dev_id and src_dev:
                    d_id, _ = normalize_entity_id(src_dev, NODE_DEVICE)
                    dev_id = d_id
                    register_entity(d_id, NODE_DEVICE, src_dev, ev_time)

                if actor and dev_id:
                    u_id, _ = normalize_entity_id(actor, NODE_USER)
                    register_entity(u_id, NODE_USER, actor, ev_time)
                    add_relationship(u_id, dev_id, EDGE_AUTHENTICATED_TO, STATUS_OBSERVED, ev, role="direct")

                # Lateral hop: source_device and target both devices and differ
                if src_dev and target:
                    src_id, _ = normalize_entity_id(src_dev, NODE_DEVICE)
                    tgt_id, tgt_type = classify_target(target)
                    if tgt_type == NODE_DEVICE and src_id != tgt_id:
                        register_entity(src_id, NODE_DEVICE, src_dev, ev_time)
                        register_entity(tgt_id, NODE_DEVICE, target, ev_time)
                        add_relationship(src_id, tgt_id, EDGE_CONNECTED_TO, STATUS_OBSERVED, ev, role="direct")

                # Check R6: failed auth before success
                if actor and dev_id:
                    fail_key = (actor.lower(), dev_id)
                    if fail_key in auth_failures:
                        # Corroborating failed attempts within correlation window
                        recent_fails = [f for f in auth_failures[fail_key] if (ev_time - f["event_time"]).total_seconds() <= CORRELATION_WINDOW_SECONDS]
                        if recent_fails:
                            rel_key = (f"user:{actor.lower()}", dev_id, EDGE_AUTHENTICATED_TO, STATUS_OBSERVED)
                            if rel_key in relationships_map:
                                for f_ev in recent_fails:
                                    if f_ev["id"] not in relationships_map[rel_key]["evidence_ids"]:
                                        relationships_map[rel_key]["evidence_ids"].append(f_ev["id"])
                                        relationships_map[rel_key]["evidence_items"].append({"event": f_ev, "role": "corroborating"})

            elif outcome == OUTCOME_FAILURE and actor and (target or src_dev):
                dev_raw = target if target else src_dev
                dev_id, _ = normalize_entity_id(dev_raw, NODE_DEVICE)
                fail_key = (actor.lower(), dev_id)
                auth_failures.setdefault(fail_key, []).append(ev)

        # R2: Service Access
        elif etype == EVENT_TYPE_SERVICE_ACCESS:
            if target:
                tgt_id, tgt_type = classify_target(target)
                register_entity(tgt_id, tgt_type, target, ev_time)

                if src_dev:
                    src_id, _ = normalize_entity_id(src_dev, NODE_DEVICE)
                    register_entity(src_id, NODE_DEVICE, src_dev, ev_time)
                    add_relationship(src_id, tgt_id, EDGE_ACCESSED, STATUS_OBSERVED, ev, role="direct")

                if actor:
                    u_id, _ = normalize_entity_id(actor, NODE_USER)
                    register_entity(u_id, NODE_USER, actor, ev_time)
                    add_relationship(u_id, tgt_id, EDGE_ACCESSED, STATUS_OBSERVED, ev, role="direct")

                recent_accesses.append({
                    "event": ev,
                    "target_id": tgt_id,
                    "source_device_id": f"device:{src_dev.lower()}" if src_dev else None,
                    "actor_id": f"user:{actor.lower()}" if actor else None,
                })

        # R3 & R3b: Privilege Change
        elif etype == EVENT_TYPE_PRIVILEGE_CHANGE:
            event_node_id = f"event:{ev['id']}"
            register_entity(event_node_id, NODE_EVENT, f"Privilege change on {target or 'host'}", ev_time)

            if target:
                tgt_id, tgt_type = classify_target(target)
                register_entity(tgt_id, tgt_type, target, ev_time)
                add_relationship(tgt_id, event_node_id, EDGE_MODIFIED, STATUS_OBSERVED, ev, role="direct")

            if actor:
                u_id, _ = normalize_entity_id(actor, NODE_USER)
                register_entity(u_id, NODE_USER, actor, ev_time)
                add_relationship(u_id, event_node_id, EDGE_MODIFIED, STATUS_OBSERVED, ev, role="direct")
            else:
                # R3b: Privilege change with NO actor -> check preceding service_access on same target within window
                matched_access = None
                for acc in reversed(recent_accesses):
                    dt = (ev_time - acc["event"]["event_time"]).total_seconds()
                    if 0 <= dt <= CORRELATION_WINDOW_SECONDS:
                        # Match target or related host
                        acc_tgt = acc["target_id"].lower()
                        if target and (target.lower() in acc_tgt or acc_tgt in target.lower()):
                            matched_access = acc
                            break

                if matched_access:
                    source_ent = matched_access["source_device_id"] or matched_access["actor_id"]
                    if source_ent:
                        dt = int((ev_time - matched_access["event"]["event_time"]).total_seconds())
                        add_relationship(
                            source_ent,
                            event_node_id,
                            EDGE_ASSOCIATED_WITH,
                            STATUS_NEEDS_VERIFICATION,
                            ev,
                            role="motivating",
                            gap_text="which actor initiated the modification",
                            delta_seconds=dt,
                        )
                        # Add motivating event
                        rel_key = (source_ent, event_node_id, EDGE_ASSOCIATED_WITH, STATUS_NEEDS_VERIFICATION)
                        if matched_access["event"]["id"] not in relationships_map[rel_key]["evidence_ids"]:
                            relationships_map[rel_key]["evidence_ids"].append(matched_access["event"]["id"])
                            relationships_map[rel_key]["evidence_items"].append({
                                "event": matched_access["event"],
                                "role": "motivating",
                            })

            privilege_changes.append({"event": ev, "event_node_id": event_node_id, "target": target})

        # R4 & R5: External Connection
        elif etype == EVENT_TYPE_EXTERNAL_CONNECTION:
            dest_ip = ev.get("attributes", {}).get("dest_ip") or target
            if dest_ip:
                ext_id, _ = normalize_entity_id(dest_ip, NODE_EXTERNAL)
                register_entity(ext_id, NODE_EXTERNAL, dest_ip, ev_time)

                src_id = None
                if src_dev:
                    src_id, _ = normalize_entity_id(src_dev, NODE_DEVICE)
                    register_entity(src_id, NODE_DEVICE, src_dev, ev_time)
                elif target and target != dest_ip:
                    src_id, s_type = classify_target(target)
                    register_entity(src_id, s_type, target, ev_time)

                if src_id:
                    add_relationship(src_id, ext_id, EDGE_CONNECTED_TO, STATUS_OBSERVED, ev, role="direct")

                # R5: Occurring within window AFTER a privilege change on same host/service
                for priv in reversed(privilege_changes):
                    dt = (ev_time - priv["event"]["event_time"]).total_seconds()
                    if 0 <= dt <= CORRELATION_WINDOW_SECONDS:
                        # Associate event node with external endpoint
                        add_relationship(
                            priv["event_node_id"],
                            ext_id,
                            EDGE_ASSOCIATED_WITH,
                            STATUS_INFERRED,
                            ev,
                            role="corroborating",
                            delta_seconds=int(dt),
                        )
                        break

        # R7: Maintenance
        elif etype == EVENT_TYPE_MAINTENANCE:
            maint_event_id = f"event:{ev['id']}"
            register_entity(maint_event_id, NODE_EVENT, f"Approved maintenance on {target or 'host'}", ev_time)
            # Check if covers same target within window of a privilege_change
            for priv in privilege_changes:
                dt = abs((ev_time - priv["event"]["event_time"]).total_seconds())
                if dt <= CORRELATION_WINDOW_SECONDS:
                    priv_target = str(priv.get("target", "")).lower()
                    maint_target = str(target or "").lower()
                    if priv_target and maint_target and (priv_target in maint_target or maint_target in priv_target):
                        add_relationship(
                            maint_event_id,
                            priv["event_node_id"],
                            EDGE_ASSOCIATED_WITH,
                            STATUS_INFERRED,
                            ev,
                            role="direct",
                        )

    # Compute confidence for all relationships
    final_relationships: List[Dict[str, Any]] = []
    for rel in relationships_map.values():
        ev_objs = [item["event"] for item in rel["evidence_items"]]
        conf, breakdown = calculate_edge_confidence(rel["status"], ev_objs)
        rel["confidence"] = conf
        rel["confidence_breakdown"] = breakdown
        final_relationships.append(rel)

    return list(entities_map.values()), final_relationships
