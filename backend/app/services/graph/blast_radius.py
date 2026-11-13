"""
Blast radius / potential exposure calculation service.
Spec reference: 01_PRODUCT_AND_REASONING_SPEC.md §8.
"""

from collections import deque
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from app.core.constants import (
    BLAST_DIRECTLY_ASSOCIATED,
    BLAST_INDIRECTLY_ASSOCIATED,
    BLAST_RADIUS_LABEL,
    BLAST_UNVERIFIED,
    NODE_EVENT,
    STATUS_INFERRED,
    STATUS_NEEDS_VERIFICATION,
    STATUS_OBSERVED,
)

# Epistemic rank for finding the path with the strongest weakest-link
STATUS_RANK = {
    STATUS_OBSERVED: 3,
    STATUS_INFERRED: 2,
    STATUS_NEEDS_VERIFICATION: 1,
}

RANK_TO_STATUS = {
    3: STATUS_OBSERVED,
    2: STATUS_INFERRED,
    1: STATUS_NEEDS_VERIFICATION,
}


def calculate_blast_radius(
    graph: nx.MultiDiGraph,
    start_entity_id: str,
    max_hops: int = 3,
    include_unverified: bool = True,
) -> Dict[str, Any]:
    """
    Computes potential exposure paths from start_entity_id using BFS.
    Edges are traversable bidirectionally.
    Picks the path with the strongest weakest-link (tie-break by fewer hops).
    """
    if start_entity_id not in graph:
        return {
            "start": start_entity_id,
            "max_hops": max_hops,
            "label": BLAST_RADIUS_LABEL,
            "summary": {
                BLAST_DIRECTLY_ASSOCIATED: 0,
                BLAST_INDIRECTLY_ASSOCIATED: 0,
                BLAST_UNVERIFIED: 0,
            },
            "items": [],
        }

    # Best path found for each reached entity:
    # entity_id -> (min_status_rank, -hops, path_steps)
    best_paths: Dict[str, Tuple[int, int, List[Dict[str, Any]]]] = {}

    # Queue stores: (current_node, current_hops, path_steps, min_rank_so_far, visited_in_path)
    queue = deque([(start_entity_id, 0, [], 3, {start_entity_id})])

    while queue:
        current, hops, path, min_rank, visited = queue.popleft()

        if hops >= max_hops:
            continue

        # Explore outgoing edges (forward)
        for _, neighbor, key, data in graph.out_edges(current, keys=True, data=True):
            if neighbor in visited:
                continue
            edge_status = data.get("status", STATUS_OBSERVED)
            edge_rank = STATUS_RANK.get(edge_status, 1)
            new_min_rank = min(min_rank, edge_rank)

            if not include_unverified and edge_status == STATUS_NEEDS_VERIFICATION:
                continue

            step = {
                "edge_id": data.get("id") or key,
                "type": data.get("relationship_type", "CONNECTED_TO"),
                "status": edge_status,
                "direction": "forward",
            }
            new_path = path + [step]
            new_hops = hops + 1
            new_visited = visited | {neighbor}

            # Update best path for neighbor if neighbor is not an EVENT
            neighbor_type = graph.nodes[neighbor].get("entity_type")
            if neighbor_type != NODE_EVENT:
                candidate_score = (new_min_rank, -new_hops)
                existing = best_paths.get(neighbor)
                if existing is None or candidate_score > (existing[0], existing[1]):
                    best_paths[neighbor] = (new_min_rank, -new_hops, new_path)

            queue.append((neighbor, new_hops, new_path, new_min_rank, new_visited))

        # Explore incoming edges (reverse)
        for neighbor, _, key, data in graph.in_edges(current, keys=True, data=True):
            if neighbor in visited:
                continue
            edge_status = data.get("status", STATUS_OBSERVED)
            edge_rank = STATUS_RANK.get(edge_status, 1)
            new_min_rank = min(min_rank, edge_rank)

            if not include_unverified and edge_status == STATUS_NEEDS_VERIFICATION:
                continue

            step = {
                "edge_id": data.get("id") or key,
                "type": data.get("relationship_type", "CONNECTED_TO"),
                "status": edge_status,
                "direction": "reverse",
            }
            new_path = path + [step]
            new_hops = hops + 1
            new_visited = visited | {neighbor}

            neighbor_type = graph.nodes[neighbor].get("entity_type")
            if neighbor_type != NODE_EVENT:
                candidate_score = (new_min_rank, -new_hops)
                existing = best_paths.get(neighbor)
                if existing is None or candidate_score > (existing[0], existing[1]):
                    best_paths[neighbor] = (new_min_rank, -new_hops, new_path)

            queue.append((neighbor, new_hops, new_path, new_min_rank, new_visited))

    # Format result items
    items: List[Dict[str, Any]] = []
    summary = {
        BLAST_DIRECTLY_ASSOCIATED: 0,
        BLAST_INDIRECTLY_ASSOCIATED: 0,
        BLAST_UNVERIFIED: 0,
    }

    # Sort items by hops ascending, then entity_id
    sorted_entities = sorted(best_paths.keys(), key=lambda e: (-best_paths[e][1], e))

    for ent_id in sorted_entities:
        min_rank, neg_hops, path = best_paths[ent_id]
        hops = -neg_hops
        weakest_st = RANK_TO_STATUS.get(min_rank, STATUS_NEEDS_VERIFICATION)
        ent_node = graph.nodes[ent_id]
        ent_type = ent_node.get("entity_type", "DEVICE")

        # Classification rules:
        # directly_associated: 1 hop via an observed edge
        # indirectly_associated: >=2 hops and every edge on path is observed
        # unverified: any edge on path is inferred or needs_verification
        if hops == 1 and weakest_st == STATUS_OBSERVED:
            classification = BLAST_DIRECTLY_ASSOCIATED
        elif hops >= 2 and weakest_st == STATUS_OBSERVED:
            classification = BLAST_INDIRECTLY_ASSOCIATED
        else:
            classification = BLAST_UNVERIFIED

        summary[classification] += 1

        explanation = (
            f"Reachable in {hops} hop(s) from {start_entity_id}. "
            f"Strongest traversal path carries weakest epistemic link '{weakest_st}'."
        )

        items.append({
            "entity_id": ent_id,
            "entity_type": ent_type,
            "classification": classification,
            "hops": hops,
            "path": path,
            "weakest_status": weakest_st,
            "explanation": explanation,
        })

    return {
        "start": start_entity_id,
        "max_hops": max_hops,
        "label": BLAST_RADIUS_LABEL,
        "summary": summary,
        "items": items,
    }
