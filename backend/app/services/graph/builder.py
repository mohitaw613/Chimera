"""
Graph builder and Cytoscape format converter for CHIMERA.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §4, 02_ARCHITECTURE_DATA_API.md §5.4.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
import networkx as nx
from sqlalchemy.orm import Session

from app.core.constants import (
    EPISTEMIC_STATUSES,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)
from app.database.models import Entity, EvidenceLink, Relationship, Signal
from app.services.graph.relationships import extract_relationships_from_events


def build_networkx_graph(
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
) -> nx.MultiDiGraph:
    """Builds a NetworkX MultiDiGraph from entities and relationships."""
    graph = nx.MultiDiGraph()
    for ent in entities:
        graph.add_node(ent["id"], **ent)
    for rel in relationships:
        graph.add_edge(
            rel["source_entity_id"],
            rel["target_entity_id"],
            key=rel["id"],
            **rel,
        )
    return graph


def format_cytoscape_elements(
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
    suspicious_entity_ids: Set[str],
    open_gaps_count: int = 0,
) -> Dict[str, Any]:
    """
    Formats entities and relationships into Cytoscape response shape.
    Spec reference: 02_ARCHITECTURE_DATA_API.md §5.4.
    """
    nodes = []
    for ent in entities:
        is_suspicious = ent["id"] in suspicious_entity_ids
        nodes.append({
            "data": {
                "id": ent["id"],
                "label": ent.get("label") or ent["id"].split(":")[-1],
                "type": ent.get("entity_type"),
                "first_seen": ent.get("first_seen").isoformat() if isinstance(ent.get("first_seen"), datetime) else ent.get("first_seen"),
                "signal_ids": ent.get("signal_ids", []),
                "suspicious": is_suspicious,
            }
        })

    edges = []
    n_observed = 0
    n_inferred = 0
    n_needs_verif = 0

    for rel in relationships:
        st = rel["status"]
        if st == STATUS_OBSERVED:
            n_observed += 1
        elif st == STATUS_INFERRED:
            n_inferred += 1
        elif st == STATUS_NEEDS_VERIFICATION:
            n_needs_verif += 1

        first_time = rel.get("first_event_time")
        time_str = first_time.isoformat() if isinstance(first_time, datetime) else first_time

        edges.append({
            "data": {
                "id": rel["id"],
                "source": rel["source_entity_id"],
                "target": rel["target_entity_id"],
                "label": rel["relationship_type"],
                "status": rel["status"],
                "confidence": rel["confidence"],
                "evidence_ids": rel["evidence_ids"],
                "event_time": time_str,
            }
        })

    # Finding text generation according to spec 01 §6.3
    if n_needs_verif > 0 or open_gaps_count > 0:
        finding_text = (
            f"The available evidence supports a connected sequence of suspicious activity "
            f"({n_observed} observed, {n_inferred + n_needs_verif} inferred relationships). "
            f"The complete attack path and initial access mechanism remain unconfirmed. "
            f"Investigation incomplete ({open_gaps_count} open gaps)."
        )
        incomplete = True
    else:
        finding_text = (
            f"Investigation findings are well-supported by available records ({n_observed} observed relationships); "
            f"causation still requires analyst confirmation."
        )
        incomplete = False

    return {
        "nodes": nodes,
        "edges": edges,
        "finding": {
            "text": finding_text,
            "incomplete": incomplete,
            "open_gaps": open_gaps_count,
        },
        "legend": {
            "status": [STATUS_OBSERVED, STATUS_INFERRED, STATUS_NEEDS_VERIFICATION],
        },
    }


def persist_graph_to_database(
    db: Session,
    investigation_id: str,
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
):
    """
    Synchronously persists entities, relationships, and evidence_links to the database.
    Idempotent: deletes old derived records for this investigation.
    """
    # Remove existing graph records for this investigation
    existing_rels = db.query(Relationship).filter(Relationship.investigation_id == investigation_id).all()
    existing_rel_ids = [r.id for r in existing_rels]
    if existing_rel_ids:
        db.query(EvidenceLink).filter(EvidenceLink.relationship_id.in_(existing_rel_ids)).delete(synchronize_session=False)
        db.query(Relationship).filter(Relationship.investigation_id == investigation_id).delete(synchronize_session=False)

    db.query(Entity).filter(Entity.investigation_id == investigation_id).delete(synchronize_session=False)

    # Insert entities
    for ent in entities:
        db_ent = Entity(
            id=ent["id"],
            investigation_id=investigation_id,
            entity_type=ent["entity_type"],
            label=ent.get("label") or ent["id"],
            attributes=ent.get("attributes", {}),
            first_seen=ent.get("first_seen"),
            last_seen=ent.get("last_seen"),
        )
        db.add(db_ent)

    # Insert relationships and evidence links
    for rel in relationships:
        db_rel = Relationship(
            id=rel["id"],
            investigation_id=investigation_id,
            source_entity_id=rel["source_entity_id"],
            target_entity_id=rel["target_entity_id"],
            relationship_type=rel["relationship_type"],
            status=rel["status"],
            confidence=rel["confidence"],
            confidence_breakdown=rel["confidence_breakdown"],
            explanation=rel["explanation"],
            epistemic_note=rel["epistemic_note"],
            first_event_time=rel.get("first_event_time"),
            last_event_time=rel.get("last_event_time"),
        )
        db.add(db_rel)

        # Evidence links
        for item in rel["evidence_items"]:
            ev = item["event"]
            role = item["role"]
            link = EvidenceLink(
                investigation_id=investigation_id,
                relationship_id=rel["id"],
                event_id=ev["id"],
                evidence_role=role,
            )
            db.add(link)

    db.commit()
