"""
End-to-end investigation integration test.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5, §10.
Tests: create -> upload sample logs -> analyze -> timeline, graph, edge detail, hypotheses, blast radius, report.
"""

import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "samples")


def test_end_to_end_investigation_lifecycle():
    # 1. Create investigation
    create_res = client.post("/api/v1/investigations", json={
        "name": "E2E Integration Scenario",
        "description": "Full end-to-end lifecycle verification test",
        "is_synthetic": True,
    })
    assert create_res.status_code == 201
    inv_id = create_res.json()["id"]

    # 2. Upload sample files (shuffled logs)
    auth_path = os.path.join(SAMPLE_DIR, "auth_log_shuffled.csv")
    service_path = os.path.join(SAMPLE_DIR, "service_log_shuffled.jsonl")
    network_path = os.path.join(SAMPLE_DIR, "network_log_shuffled.json")

    with open(auth_path, "rb") as f1, open(service_path, "rb") as f2, open(network_path, "rb") as f3:
        files = [
            ("files", ("auth_log.csv", f1, "text/csv")),
            ("files", ("service_log.jsonl", f2, "application/jsonl")),
            ("files", ("network_log.json", f3, "application/json")),
        ]
        upload_res = client.post(f"/api/v1/investigations/{inv_id}/upload", files=files)
        assert upload_res.status_code == 200
        upload_data = upload_res.json()
        assert len(upload_data["files"]) == 3

    # 3. Before analysis, graph endpoints should return 409
    graph_early = client.get(f"/api/v1/investigations/{inv_id}/graph")
    assert graph_early.status_code == 409

    # 4. Trigger analysis
    analyze_res = client.post(f"/api/v1/investigations/{inv_id}/analyze")
    assert analyze_res.status_code == 200
    analyze_data = analyze_res.json()
    assert analyze_data["status"] == "analyzed"
    assert analyze_data["counts"]["events"] > 0
    assert analyze_data["counts"]["entities"] > 0
    assert analyze_data["counts"]["relationships"] > 0
    assert analyze_data["counts"]["signals"] > 0

    # 5. Timeline endpoint
    timeline_res = client.get(f"/api/v1/investigations/{inv_id}/timeline")
    assert timeline_res.status_code == 200
    timeline_data = timeline_res.json()
    assert len(timeline_data["events"]) > 0
    # Because we uploaded shuffled logs, inversions should be > 0
    assert timeline_data["inversions"] > 0

    # 6. Graph endpoint
    graph_res = client.get(f"/api/v1/investigations/{inv_id}/graph")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert len(graph_data["nodes"]) > 0
    assert len(graph_data["edges"]) > 0

    # 7. Edge detail endpoint
    first_edge_id = graph_data["edges"][0]["data"]["id"]
    edge_res = client.get(f"/api/v1/investigations/{inv_id}/edges/{first_edge_id}")
    assert edge_res.status_code == 200
    edge_data = edge_res.json()
    assert len(edge_data["evidence"]) >= 1
    assert "conclusion" in edge_data

    # 8. Hypotheses endpoint
    hyp_res = client.get(f"/api/v1/investigations/{inv_id}/hypotheses")
    assert hyp_res.status_code == 200
    hyp_data = hyp_res.json()
    assert len(hyp_data["hypotheses"]) == 3
    assert len(hyp_data["gaps"]) > 0
    assert len(hyp_data["initial_access"]) > 0
    assert hyp_data["initial_access"][0]["rank"] == 1

    # 9. Blast radius endpoint
    user_node = next(n["data"]["id"] for n in graph_data["nodes"] if n["data"]["type"] == "USER")
    blast_res = client.get(f"/api/v1/investigations/{inv_id}/blast-radius/{user_node}")
    assert blast_res.status_code == 200
    blast_data = blast_res.json()
    assert "summary" in blast_data
    assert "items" in blast_data

    # 10. Report endpoint
    report_res = client.get(f"/api/v1/investigations/{inv_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert "overview" in report_data
    assert "reproducibility" in report_data
    assert len(report_data["reproducibility"]["file_hashes"]) == 3
