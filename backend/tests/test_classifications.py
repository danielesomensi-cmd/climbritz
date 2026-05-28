"""A023: tests for the per-user hold classification API + service."""

from __future__ import annotations

import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.models.user import User
from app.models.user_hold_classification import UserHoldClassification
from conftest import TestingSessionLocal

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_classifications():
    """Fresh user_hold_classifications slate per test."""
    db = TestingSessionLocal()
    db.query(UserHoldClassification).delete()
    db.commit()
    db.close()
    yield


def _create_user() -> User:
    db = TestingSessionLocal()
    user = User(
        id=str(uuid.uuid4()),
        clerk_id=f"user_test_{uuid.uuid4().hex[:8]}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _auth(user_id: str) -> dict:
    return {"X-User-ID": str(user_id)}


# ---------------------------------------------------------------------------
# GET
# ---------------------------------------------------------------------------


def test_get_empty_returns_empty_list():
    user = _create_user()
    resp = client.get("/api/classifications", headers=_auth(user.id))
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# PUT (upsert)
# ---------------------------------------------------------------------------


def test_put_inserts_and_persists():
    user = _create_user()
    resp = client.put(
        "/api/classifications/42",
        json={"category": "crimp"},
        headers=_auth(user.id),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["placement_id"] == 42
    assert body["category"] == "crimp"
    assert "id" in body

    listed = client.get("/api/classifications", headers=_auth(user.id)).json()
    assert len(listed) == 1
    assert listed[0]["placement_id"] == 42


def test_put_same_placement_updates_category_and_advances_updated_at():
    user = _create_user()
    first = client.put(
        "/api/classifications/7",
        json={"category": "jug"},
        headers=_auth(user.id),
    ).json()
    second = client.put(
        "/api/classifications/7",
        json={"category": "sloper"},
        headers=_auth(user.id),
    ).json()

    assert second["category"] == "sloper"
    assert second["id"] == first["id"]  # same row, not a new one
    assert second["updated_at"] >= first["updated_at"]

    listed = client.get("/api/classifications", headers=_auth(user.id)).json()
    assert len(listed) == 1  # still one row


def test_put_invalid_category_returns_422():
    user = _create_user()
    resp = client.put(
        "/api/classifications/1",
        json={"category": "banana"},
        headers=_auth(user.id),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------


def test_delete_removes_row():
    user = _create_user()
    client.put(
        "/api/classifications/99",
        json={"category": "pinch"},
        headers=_auth(user.id),
    )
    resp = client.delete("/api/classifications/99", headers=_auth(user.id))
    assert resp.status_code == 204

    listed = client.get("/api/classifications", headers=_auth(user.id)).json()
    assert listed == []


def test_delete_nonexistent_is_idempotent_204():
    user = _create_user()
    resp = client.delete("/api/classifications/12345", headers=_auth(user.id))
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# POST /import
# ---------------------------------------------------------------------------


def test_import_inserts_all():
    user = _create_user()
    payload = {
        "classifications": [
            {"placement_id": 1, "category": "jug"},
            {"placement_id": 2, "category": "crimp"},
            {"placement_id": 3, "category": "sloper"},
            {"placement_id": 4, "category": "pinch"},
            {"placement_id": 5, "category": "undercling"},
        ]
    }
    resp = client.post(
        "/api/classifications/import", json=payload, headers=_auth(user.id)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 5


def test_import_merges_without_replacing_unsent():
    user = _create_user()
    client.post(
        "/api/classifications/import",
        json={
            "classifications": [
                {"placement_id": 1, "category": "jug"},
                {"placement_id": 2, "category": "crimp"},
                {"placement_id": 3, "category": "sloper"},
                {"placement_id": 4, "category": "pinch"},
                {"placement_id": 5, "category": "undercling"},
            ]
        },
        headers=_auth(user.id),
    )
    # Re-import: 2 existing (updated) + 3 brand new → 8 total, none dropped.
    resp = client.post(
        "/api/classifications/import",
        json={
            "classifications": [
                {"placement_id": 1, "category": "good_crimp"},
                {"placement_id": 2, "category": "good_crimp"},
                {"placement_id": 6, "category": "jug"},
                {"placement_id": 7, "category": "jug"},
                {"placement_id": 8, "category": "jug"},
            ]
        },
        headers=_auth(user.id),
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 8

    listed = client.get("/api/classifications", headers=_auth(user.id)).json()
    by_id = {c["placement_id"]: c["category"] for c in listed}
    assert by_id[1] == "good_crimp"  # updated
    assert by_id[3] == "sloper"  # preserved (not in 2nd payload)
    assert by_id[6] == "jug"  # new


def test_import_ignores_extra_xy_fields():
    user = _create_user()
    payload = {
        "version": 2,
        "board": "kilter_original_12x12",
        "classifications": [
            {"placement_id": 10, "category": "jug", "x": 100, "y": 50},
        ],
    }
    resp = client.post(
        "/api/classifications/import", json=payload, headers=_auth(user.id)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


# ---------------------------------------------------------------------------
# Isolation + auth
# ---------------------------------------------------------------------------


def test_two_users_are_isolated():
    user_a = _create_user()
    user_b = _create_user()
    client.put(
        "/api/classifications/55",
        json={"category": "jug"},
        headers=_auth(user_a.id),
    )
    listed_b = client.get(
        "/api/classifications", headers=_auth(user_b.id)
    ).json()
    assert listed_b == []


def test_endpoints_reject_missing_jwt():
    # No auth header at all → 401 on every endpoint.
    assert client.get("/api/classifications").status_code == 401
    assert (
        client.put(
            "/api/classifications/1", json={"category": "jug"}
        ).status_code
        == 401
    )
    assert client.delete("/api/classifications/1").status_code == 401
    assert (
        client.post(
            "/api/classifications/import", json={"classifications": []}
        ).status_code
        == 401
    )
