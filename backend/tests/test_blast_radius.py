"""
Blast radius / potential exposure calculation unit tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, 01_PRODUCT_AND_REASONING_SPEC.md §8.
"""

import pytest
import networkx as nx
from app.core.constants import (
    BLAST_DIRECTLY_ASSOCIATED,
    BLAST_INDIRECTLY_ASSOCIATED,
    BLAST_UNVERIFIED,
    NODE_DEVICE,
    NODE_EXTERNAL,
    NODE_SERVICE,
    NODE_USER,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)
from app.services.graph.blast_radius import calculate_blast_radius
from app.services.graph.builder import build_networkx_graph


def test_blast_radius_classification_tiers():
    # Construct a test graph:
    # user:jdoe —[observed]→ device:ws-207
    # device:ws-207 —[observed]→ service:fileshare
    # service:fileshare —[needs_verification]→ external:bad_ip
    entities = [
        {"id": "user:jdoe", "entity_type": NODE_USER, "label": "jdoe"},
        {"id": "device:ws-207", "entity_type": NODE_DEVICE, "label": "WS-207"},
        {"id": "service:fileshare", "entity_type": NODE_SERVICE, "label": "FileShare"},
        {"id": "external:bad_ip", "entity_type": NODE_EXTERNAL, "label": "203.0.113.45"},
    ]
    relationships = [
        {
            "id": "e1",
            "source_entity_id": "user:jdoe",
            "target_entity_id": "device:ws-207",
            "relationship_type": "AUTHENTICATED_TO",
            "status": STATUS_OBSERVED,
            "confidence": 0.95,
        },
        {
            "id": "e2",
            "source_entity_id": "device:ws-207",
            "target_entity_id": "service:fileshare",
            "relationship_type": "ACCESSED",
            "status": STATUS_OBSERVED,
            "confidence": 0.90,
        },
        {
            "id": "e3",
            "source_entity_id": "service:fileshare",
            "target_entity_id": "external:bad_ip",
            "relationship_type": "ASSOCIATED_WITH",
            "status": STATUS_NEEDS_VERIFICATION,
            "confidence": 0.35,
        },
    ]

    graph = build_networkx_graph(entities, relationships)
    res = calculate_blast_radius(graph, "user:jdoe", max_hops=3)

    items_map = {item["entity_id"]: item for item in res["items"]}

    # device:ws-207 is 1 hop away via observed edge -> directly_associated
    assert items_map["device:ws-207"]["classification"] == BLAST_DIRECTLY_ASSOCIATED
    assert items_map["device:ws-207"]["hops"] == 1
    assert items_map["device:ws-207"]["weakest_status"] == STATUS_OBSERVED

    # service:fileshare is 2 hops away via all observed edges -> indirectly_associated
    assert items_map["service:fileshare"]["classification"] == BLAST_INDIRECTLY_ASSOCIATED
    assert items_map["service:fileshare"]["hops"] == 2
    assert items_map["service:fileshare"]["weakest_status"] == STATUS_OBSERVED

    # external:bad_ip has a needs_verification edge on path -> unverified
    assert items_map["external:bad_ip"]["classification"] == BLAST_UNVERIFIED
    assert items_map["external:bad_ip"]["hops"] == 3
    assert items_map["external:bad_ip"]["weakest_status"] == STATUS_NEEDS_VERIFICATION

    # Verify summary counts
    assert res["summary"][BLAST_DIRECTLY_ASSOCIATED] == 1
    assert res["summary"][BLAST_INDIRECTLY_ASSOCIATED] == 1
    assert res["summary"][BLAST_UNVERIFIED] == 1
