"""Tests for climb search and detail API endpoints."""

import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter.db"
)


@pytest.fixture(autouse=True)
def mock_boardlib_db():
    """Point climb_service at the test fixture DB."""
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield


class TestSearchEndpoint:
    def test_search_returns_results(self):
        resp = client.get("/api/climbs/search?q=Benchmark")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        assert data[0]["name"] == "Benchmark Alpha"

    def test_search_with_angle(self):
        resp = client.get("/api/climbs/search?q=Benchmark&angle=40")
        assert resp.status_code == 200
        data = resp.json()
        assert all(r["angle"] == 40 for r in data)

    def test_search_empty_results(self):
        resp = client.get("/api/climbs/search?q=xyznonexistent")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_requires_query(self):
        resp = client.get("/api/climbs/search")
        assert resp.status_code == 422

    def test_search_with_limit(self):
        resp = client.get("/api/climbs/search?q=Benchmark&limit=1")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_search_result_structure(self):
        resp = client.get("/api/climbs/search?q=Benchmark&angle=40")
        data = resp.json()
        r = data[0]
        assert "uuid" in r
        assert "name" in r
        assert "setter" in r
        assert "grade" in r
        assert "angle" in r
        assert "ascensionist_count" in r
        assert "quality_average" in r


class TestDetailEndpoint:
    def test_get_climb_detail(self):
        resp = client.get("/api/climbs/UUID-BENCH-001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Benchmark Alpha"
        assert data["setter"] == "test_setter"
        assert len(data["holds"]) == 6
        assert len(data["stats"]) == 2

    def test_get_climb_with_angle(self):
        resp = client.get("/api/climbs/UUID-BENCH-001?angle=45")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["stats"]) == 1
        assert data["stats"][0]["angle"] == 45

    def test_get_climb_holds_have_roles(self):
        resp = client.get("/api/climbs/UUID-BENCH-001")
        data = resp.json()
        roles = [h["role"] for h in data["holds"]]
        assert "start" in roles
        assert "middle" in roles
        assert "finish" in roles
        assert "foot_only" in roles

    def test_get_climb_holds_have_positions(self):
        resp = client.get("/api/climbs/UUID-BENCH-001")
        data = resp.json()
        for hold in data["holds"]:
            assert hold["x"] is not None
            assert hold["y"] is not None

    def test_get_nonexistent_climb(self):
        resp = client.get("/api/climbs/UUID-DOES-NOT-EXIST")
        assert resp.status_code == 404

    def test_get_unlisted_climb_returns_404(self):
        resp = client.get("/api/climbs/UUID-UNLISTED")
        assert resp.status_code == 404


class TestStatsEndpoint:
    def test_get_stats(self):
        resp = client.get("/api/climbs/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_climbs"] == 5
        assert data["listed_climbs"] == 4
        assert 40 in data["available_angles"]
        assert "grade_range" in data
