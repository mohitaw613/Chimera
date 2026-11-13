"""
Shuffle robustness test.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §4, §5.
Headline test: The same graph (edges, statuses), same hypotheses scores,
and same blast radius must result from ordered and shuffled input.
"""

import json
import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "samples")


def test_shuffle_invariance_and_robustness():
    # 1. Run pipeline on ordered logs
    res1 = client.post("/api/v1/investigations", json={"name": "Ordered Baseline"})
    assert res1.status_code == 201
    id_ordered = res1.json()["id"]

    with open(os.path.join(SAMPLE_DIR, "auth_log.csv"), "rb") as f1, \
         open(os.path.join(SAMPLE_DIR, "service_log.jsonl"), "rb") as f2, \
         open(os.path.join(SAMPLE_DIR, "network_log.json"), "rb") as f3:
        client.post(f"/api/v1/investigations/{id_ordered}/upload", files=[
            ("files", ("auth_log.csv", f1, "text/csv")),
            ("files", ("service_log.jsonl", f2, "application/jsonl")),
            ("files", ("network_log.json", f3, "application/json")),
        ])

    client.post(f"/api/v1/investigations/{id_ordered}/analyze")
    graph_ordered = client.get(f"/api/v1/investigations/{id_ordered}/graph").json()
    hyp_ordered = client.get(f"/api/v1/investigations/{id_ordered}/hypotheses").json()
    blast_ordered = client.get(f"/api/v1/investigations/{id_ordered}/blast-radius/user:jdoe").json()

    # 2. Run pipeline on shuffled & delayed logs
    res2 = client.post("/api/v1/investigations", json={"name": "Shuffled Experiment"})
    assert res2.status_code == 201
    id_shuffled = res2.json()["id"]

    with open(os.path.join(SAMPLE_DIR, "auth_log_shuffled.csv"), "rb") as f1, \
         open(os.path.join(SAMPLE_DIR, "service_log_shuffled.jsonl"), "rb") as f2, \
         open(os.path.join(SAMPLE_DIR, "network_log_shuffled.json"), "rb") as f3:
        client.post(f"/api/v1/investigations/{id_shuffled}/upload", files=[
            ("files", ("auth_log.csv", f1, "text/csv")),
            ("files", ("service_log.jsonl", f2, "application/jsonl")),
            ("files", ("network_log.json", f3, "application/json")),
        ])

    client.post(f"/api/v1/investigations/{id_shuffled}/analyze")
    graph_shuffled = client.get(f"/api/v1/investigations/{id_shuffled}/graph").json()
    hyp_shuffled = client.get(f"/api/v1/investigations/{id_shuffled}/hypotheses").json()
    blast_shuffled = client.get(f"/api/v1/investigations/{id_shuffled}/blast-radius/user:jdoe").json()

    # Compare non-event relationships (source, target, label, status)
    edges_ordered = {
        (e["data"]["source"], e["data"]["target"], e["data"]["label"], e["data"]["status"])
        for e in graph_ordered["edges"]
        if not e["data"]["target"].startswith("event:") and not e["data"]["source"].startswith("event:")
    }
    edges_shuffled = {
        (e["data"]["source"], e["data"]["target"], e["data"]["label"], e["data"]["status"])
        for e in graph_shuffled["edges"]
        if not e["data"]["target"].startswith("event:") and not e["data"]["source"].startswith("event:")
    }

    assert edges_ordered == edges_shuffled, "Topology diverged between ordered and shuffled logs!"

    # Compare hypotheses scores
    scores_ordered = {h["key"]: h["score"] for h in hyp_ordered["hypotheses"]}
    scores_shuffled = {h["key"]: h["score"] for h in hyp_shuffled["hypotheses"]}
    assert scores_ordered == scores_shuffled, f"Hypothesis scores diverged: {scores_ordered} vs {scores_shuffled}"

    # Compare blast radius reachable entities from user:jdoe
    blast_ents_ordered = {item["entity_id"]: item["classification"] for item in blast_ordered["items"]}
    blast_ents_shuffled = {item["entity_id"]: item["classification"] for item in blast_shuffled["items"]}
    assert blast_ents_ordered == blast_ents_shuffled, "Blast radius diverged under shuffled ingestion!"
