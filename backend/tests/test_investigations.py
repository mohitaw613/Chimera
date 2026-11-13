"""
Tests for investigations CRUD and dashboard API.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.connection import Base, get_db
from main import app

# In-memory SQLite for testing with StaticPool so all connections share the memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_investigation():
    payload = {
        "name": "Incident Alpha",
        "description": "Suspicious auth investigation",
        "is_synthetic": True,
    }
    response = client.post("/api/v1/investigations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Incident Alpha"
    assert data["is_synthetic"] is True
    assert data["status"] == "created"
    assert data["counts"]["events"] == 0
    assert "id" in data


def test_list_and_get_investigation():
    # List
    response = client.get("/api/v1/investigations")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    inv_id = items[0]["id"]

    # Get single
    get_res = client.get(f"/api/v1/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == inv_id


def test_dashboard_summary():
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "total_investigations" in data
    assert "total_events" in data
    assert data["total_investigations"] >= 1
