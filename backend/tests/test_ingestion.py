"""
Ingestion pipeline unit tests.
Spec reference: 04_DATASET_TESTING_ROADMAP.md §5.
"""

from datetime import datetime, timezone
import io
import pytest
from fastapi.testclient import TestClient

from app.core.constants import (
    TIMESTAMP_STATUS_MALFORMED,
    TIMESTAMP_STATUS_MISSING,
    TIMESTAMP_STATUS_NAIVE,
    TIMESTAMP_STATUS_OK,
)
from app.database.connection import Base, engine, get_db
from app.database.models import Event, Investigation
from app.services.ingestion.parser import CSVParser, JSONParser, JSONLParser
from app.services.ingestion.normalizer import normalize_record, parse_timestamp
from app.services.ingestion.validator import assign_initial_flags_and_delay
from main import app

client = TestClient(app)


def test_parsers_csv_json_jsonl():
    # CSV parser test
    csv_bytes = b"timestamp,actor,host,action\n2026-11-14T02:00:00Z,jdoe,WS-101,login\n"
    csv_parser = CSVParser()
    csv_records, csv_errors = csv_parser.parse(csv_bytes)
    assert len(csv_errors) == 0
    assert len(csv_records) == 1
    assert csv_records[0][1]["actor"] == "jdoe"

    # JSON parser test (array of dicts)
    json_bytes = b'[{"time":"2026-11-14T02:05:00Z","user":"asmith","action":"read"}]'
    json_parser = JSONParser()
    json_records, json_errors = json_parser.parse(json_bytes)
    assert len(json_errors) == 0
    assert len(json_records) == 1
    assert json_records[0][1]["user"] == "asmith"

    # JSONL parser test
    jsonl_bytes = b'{"ts":"2026-11-14T02:10:00Z","actor":"svc_backup","action":"connect"}\n{"ts":"2026-11-14T02:11:00Z","actor":"rpatel","action":"login"}\n'
    jsonl_parser = JSONLParser()
    jsonl_records, jsonl_errors = jsonl_parser.parse(jsonl_bytes)
    assert len(jsonl_errors) == 0
    assert len(jsonl_records) == 2
    assert jsonl_records[1][1]["actor"] == "rpatel"


def test_timestamp_parsing_and_flags():
    # UTC ISO
    dt, status = parse_timestamp("2026-11-14T10:00:00Z")
    assert status == TIMESTAMP_STATUS_OK
    assert dt is not None
    assert dt.tzinfo is not None

    # Naive timestamp assumed UTC
    dt_naive, status_naive = parse_timestamp("2026-11-14 10:00:00")
    assert status_naive == TIMESTAMP_STATUS_NAIVE
    assert dt_naive.tzinfo == timezone.utc

    # Malformed timestamp
    dt_bad, status_bad = parse_timestamp("not-a-valid-timestamp-at-all")
    assert status_bad == TIMESTAMP_STATUS_MALFORMED
    assert dt_bad is None

    # Missing timestamp
    dt_missing, status_missing = parse_timestamp(None)
    assert status_missing == TIMESTAMP_STATUS_MISSING
    assert dt_missing is None


def test_normalization_and_service_account_tagging():
    raw_record = {
        "timestamp": "2026-11-14T02:26:00Z",
        "actor": "svc_backup",
        "target": "SRV-FILE01",
        "action": "elevate role",
        "custom_metric": 42,
    }
    normalized = normalize_record(raw_record, default_source="test_log")
    assert normalized["event_type"] == "privilege_change"
    assert normalized["actor"] == "svc_backup"
    assert normalized["attributes"]["account_kind"] == "service"
    assert normalized["attributes"]["custom_metric"] == 42
    assert normalized["raw_record"] == raw_record


def test_upload_and_events_api():
    # Create investigation
    create_res = client.post("/api/v1/investigations", json={"name": "Ingestion Test Case"})
    assert create_res.status_code == 201
    inv_id = create_res.json()["id"]

    # Upload multi-source logs
    csv_content = b"timestamp,actor,host,action,outcome\n2026-11-14T02:00:00Z,jdoe,WS-101,login,success\n2026-11-14T02:01:00Z,jdoe,WS-101,login,success\n"
    json_content = b'[{"event_time":"2026-11-14T02:02:00Z","actor":"asmith","target":"SRV-FILE01","category":"service_access","status":"ok"}]'

    files = [
        ("files", ("auth_log.csv", io.BytesIO(csv_content), "text/csv")),
        ("files", ("service_log.json", io.BytesIO(json_content), "application/json")),
    ]

    upload_res = client.post(f"/api/v1/investigations/{inv_id}/upload", files=files)
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert len(upload_data["files"]) == 2
    assert upload_data["files"][0]["rows_ok"] == 2
    assert upload_data["files"][1]["rows_ok"] == 1

    # Query events
    events_res = client.get(f"/api/v1/investigations/{inv_id}/events")
    assert events_res.status_code == 200
    events_data = events_res.json()
    assert events_data["total"] == 3
    assert len(events_data["items"]) == 3

    # Event detail check
    first_evt_id = events_data["items"][0]["id"]
    detail_res = client.get(f"/api/v1/events/{first_evt_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["raw_record"] is not None
    assert detail["file"]["filename"] == "auth_log.csv"
