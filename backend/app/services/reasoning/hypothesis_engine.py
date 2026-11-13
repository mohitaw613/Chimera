"""
Competing hypotheses engine with transparent mathematical contribution tables.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §6.1.
"""

from typing import Any, Dict, List, Set, Tuple
from app.core.constants import (
    EVENT_TYPE_MAINTENANCE,
    EVENT_TYPE_PRIVILEGE_CHANGE,
    H1_EVIDENCE_RULES,
    HEURISTIC_SCORE_LABEL,
    HYPOTHESIS_H1_KEY,
    HYPOTHESIS_H1_NAME,
    HYPOTHESIS_H2_KEY,
    HYPOTHESIS_H2_NAME,
    HYPOTHESIS_H3_KEY,
    HYPOTHESIS_H3_NAME,
)


def evaluate_hypotheses(
    events: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
    signals: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Computes scores, supporting/contradicting evidence, and rule contributions
    for H1, H2, and H3.
    """
    signal_names = {s["signal"]: s for s in signals}

    # Evaluate each rule E1 - E9
    rule_evals: Dict[str, Dict[str, Any]] = {}

    # E1: unusual_login_hour
    sig_e1 = [s for s in signals if s["signal"] == "unusual_login_hour"]
    rule_evals["E1"] = {
        "fired": len(sig_e1) > 0,
        "event_ids": [s["event_id"] for s in sig_e1],
    }

    # E2: new_device_association
    sig_e2 = [s for s in signals if s["signal"] == "new_device_association"]
    rule_evals["E2"] = {
        "fired": len(sig_e2) > 0,
        "event_ids": [s["event_id"] for s in sig_e2],
    }

    # E3: service_account_interactive_login
    sig_e3 = [s for s in signals if s["signal"] == "service_account_interactive_login"]
    rule_evals["E3"] = {
        "fired": len(sig_e3) > 0,
        "event_ids": [s["event_id"] for s in sig_e3],
    }

    # E4: privilege change within window after auth/access
    priv_rels = [
        r for r in relationships
        if r.get("relationship_type") in ("MODIFIED", "ASSOCIATED_WITH")
        and "event:evt_" in str(r.get("target_entity_id"))
    ]
    rule_evals["E4"] = {
        "fired": len(priv_rels) > 0,
        "event_ids": [eid for r in priv_rels for eid in r.get("evidence_ids", [])],
    }

    # E5: external connection after privilege change
    ext_rels = [
        r for r in relationships
        if r.get("relationship_type") == "ASSOCIATED_WITH"
        and "external:" in str(r.get("target_entity_id"))
    ]
    rule_evals["E5"] = {
        "fired": len(ext_rels) > 0,
        "event_ids": [eid for r in ext_rels for eid in r.get("evidence_ids", [])],
    }

    # E6: failed_then_success
    sig_e6 = [s for s in signals if s["signal"] == "failed_then_success"]
    rule_evals["E6"] = {
        "fired": len(sig_e6) > 0,
        "event_ids": [s["event_id"] for s in sig_e6],
    }

    # E7: approved maintenance record covering privilege change
    maint_rels = [
        r for r in relationships
        if "maintenance" in str(r.get("source_entity_id")).lower()
        or (r.get("relationship_type") == "ASSOCIATED_WITH" and any(e.get("event_type") == EVENT_TYPE_MAINTENANCE for e in [item.get("event", {}) for item in r.get("evidence_items", [])]))
    ]
    rule_evals["E7"] = {
        "fired": len(maint_rels) > 0,
        "event_ids": [eid for r in maint_rels for eid in r.get("evidence_ids", [])],
    }

    # E8: account used same device historically (familiar device)
    # Fired if there are authentications that were NOT flagged as new_device_association
    auth_events = [e for e in events if e.get("event_type") == "authentication" and e.get("outcome") == "success"]
    new_dev_event_ids = set(rule_evals["E2"]["event_ids"])
    familiar_auths = [e for e in auth_events if e["id"] not in new_dev_event_ids]
    rule_evals["E8"] = {
        "fired": len(familiar_auths) > 0,
        "event_ids": [e["id"] for e in familiar_auths],
    }

    # E9: privilege change record has explicit known admin actor
    admin_privs = [
        e for e in events
        if e.get("event_type") == EVENT_TYPE_PRIVILEGE_CHANGE
        and e.get("actor") and ("admin" in e.get("actor", "").lower())
    ]
    rule_evals["E9"] = {
        "fired": len(admin_privs) > 0,
        "event_ids": [e["id"] for e in admin_privs],
    }

    # Compute H1 contributions and score
    h1_contributions: List[Dict[str, Any]] = []
    h1_supporting_events: Set[str] = set()
    h1_contradicting_events: Set[str] = set()
    s_h1 = 0
    w_total = 0

    for rule in H1_EVIDENCE_RULES:
        rid = rule["id"]
        label = rule["label"]
        nominal_e = rule["e"]  # +1 or -1
        w = rule["w"]
        w_total += w

        ev_info = rule_evals.get(rid, {"fired": False, "event_ids": []})
        fired = ev_info["fired"]
        e_val = nominal_e if fired else 0
        s_h1 += (w * e_val)

        if fired:
            if nominal_e > 0:
                h1_supporting_events.update(ev_info["event_ids"])
            else:
                h1_contradicting_events.update(ev_info["event_ids"])

        h1_contributions.append({
            "rule_id": rid,
            "label": label,
            "e": e_val,
            "w": w,
            "event_ids": ev_info["event_ids"] if fired else [],
        })

    # Score(H1) = round(100 * (S + W) / (2W))
    score_h1 = round(100 * (s_h1 + w_total) / (2 * w_total)) if w_total > 0 else 50

    # Compute H2 contributions and score (mirrored rules)
    h2_contributions: List[Dict[str, Any]] = []
    h2_supporting_events: Set[str] = set()
    h2_contradicting_events: Set[str] = set()
    s_h2 = 0

    for rule in H1_EVIDENCE_RULES:
        rid = rule["id"]
        label = rule["label"]
        nominal_e = -rule["e"]  # Invert for H2
        w = rule["w"]

        ev_info = rule_evals.get(rid, {"fired": False, "event_ids": []})
        fired = ev_info["fired"]
        e_val = nominal_e if fired else 0
        s_h2 += (w * e_val)

        if fired:
            if nominal_e > 0:
                h2_supporting_events.update(ev_info["event_ids"])
            else:
                h2_contradicting_events.update(ev_info["event_ids"])

        h2_contributions.append({
            "rule_id": rid,
            "label": label,
            "e": e_val,
            "w": w,
            "event_ids": ev_info["event_ids"] if fired else [],
        })

    score_h2 = round(100 * (s_h2 + w_total) / (2 * w_total)) if w_total > 0 else 50

    # Compute H3 score = min(100, 25 * open_gap_count)
    open_gap_count = len(gaps)
    score_h3 = min(100, 25 * open_gap_count)

    missing_evidence_strings = [g["title"] for g in gaps]

    # Determine status for all 3
    scores = [
        ("H1", score_h1),
        ("H2", score_h2),
        ("H3", score_h3),
    ]
    sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)
    top_key, top_score = sorted_scores[0]
    second_key, second_score = sorted_scores[1]

    def get_status(key: str, score: int) -> str:
        if key == top_key and (top_score - second_score >= 10):
            return "leading"
        if score < 30:
            return "unlikely"
        return "under_investigation"

    return [
        {
            "id": "hyp_H1",
            "key": HYPOTHESIS_H1_KEY,
            "name": HYPOTHESIS_H1_NAME,
            "score": score_h1,
            "score_type": "heuristic",
            "status": get_status("H1", score_h1),
            "label": HEURISTIC_SCORE_LABEL,
            "explanation": "Evidence indicates multi-stage lateral access followed by an unapproved privilege change and egress connection.",
            "supporting_evidence": sorted(list(h1_supporting_events)),
            "contradicting_evidence": sorted(list(h1_contradicting_events)),
            "missing_evidence": missing_evidence_strings,
            "contributions": h1_contributions,
        },
        {
            "id": "hyp_H2",
            "key": HYPOTHESIS_H2_KEY,
            "name": HYPOTHESIS_H2_NAME,
            "score": score_h2,
            "score_type": "heuristic",
            "status": get_status("H2", score_h2),
            "label": HEURISTIC_SCORE_LABEL,
            "explanation": "Activity could represent legitimate administrative operations if authorized emergency maintenance occurred.",
            "supporting_evidence": sorted(list(h2_supporting_events)),
            "contradicting_evidence": sorted(list(h2_contradicting_events)),
            "missing_evidence": missing_evidence_strings,
            "contributions": h2_contributions,
        },
        {
            "id": "hyp_H3",
            "key": HYPOTHESIS_H3_KEY,
            "name": HYPOTHESIS_H3_NAME,
            "score": score_h3,
            "score_type": "heuristic",
            "status": get_status("H3", score_h3),
            "label": HEURISTIC_SCORE_LABEL,
            "explanation": f"Gaps in available telemetry ({open_gap_count} open gaps) prevent definitive determination of causal agency.",
            "supporting_evidence": [g["id"] for g in gaps],
            "contradicting_evidence": [],
            "missing_evidence": missing_evidence_strings,
            "contributions": [
                {
                    "rule_id": "GAPS",
                    "label": f"Open investigative gaps ({open_gap_count})",
                    "e": 1,
                    "w": 25,
                    "event_ids": [],
                }
            ],
        },
    ]
