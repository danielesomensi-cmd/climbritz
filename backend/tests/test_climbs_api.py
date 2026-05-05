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

    def test_search_without_query_returns_all(self):
        # B012: q is now optional. With no q, return everything matching
        # the rest of the filters. Fixture (post-A019): 3 listed singles
        # (Alpha@40/Alpha@45/Beta@40/Crimp@40 spread across 4 stat rows
        # for 3 climbs) + 3 A019 listed singles. Animated A019 row is
        # excluded by the global frames_count=1 filter.
        resp = client.get("/api/climbs/search")
        assert resp.status_code == 200
        assert len(resp.json()) == 7

    def test_search_empty_query_string_returns_all(self):
        resp = client.get("/api/climbs/search?q=")
        assert resp.status_code == 200
        assert len(resp.json()) == 7

    def test_search_no_query_with_filters(self):
        # Browse-by-filter: angle=40 + grade_min=18 → Beta(20) + Crimp(22)
        resp = client.get(
            "/api/climbs/search?angle=40&grade_min=18&sort=quality"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # quality sort: Beta (4.0) before Crimp (3.8)
        assert data[0]["name"] == "Benchmark Beta"

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

    # ── New filter endpoint tests (A011) ────────────────────────────────────

    def test_search_grade_range(self):
        resp = client.get("/api/climbs/search?q=e&grade_min=18&grade_max=20")
        assert resp.status_code == 200
        # Alpha@45 (18) + Beta@40 (20)
        assert len(resp.json()) == 2

    def test_search_min_ascents(self):
        resp = client.get("/api/climbs/search?q=e&min_ascents=3000")
        assert resp.status_code == 200
        data = resp.json()
        assert all(r["ascensionist_count"] >= 3000 for r in data)

    def test_search_min_quality(self):
        resp = client.get("/api/climbs/search?q=e&min_quality=3.8")
        assert resp.status_code == 200
        data = resp.json()
        assert all(r["quality_average"] >= 3.8 for r in data)

    def test_search_sort_quality(self):
        resp = client.get("/api/climbs/search?q=e&sort=quality")
        assert resp.status_code == 200
        data = resp.json()
        # First result must be the highest-quality row
        assert data[0]["quality_average"] == max(r["quality_average"] for r in data)

    def test_search_sort_grade_asc(self):
        # q="Benchmark" rather than "e" so the A019 fixture rows
        # (diff=14) don't sort ahead of Alpha@40 (diff=16).
        resp = client.get("/api/climbs/search?q=Benchmark&sort=grade_asc")
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["name"] == "Benchmark Alpha"
        assert data[0]["angle"] == 40

    def test_search_sort_grade_desc(self):
        resp = client.get("/api/climbs/search?q=e&sort=grade_desc")
        data = resp.json()
        assert data[0]["name"] == "The Crimp Test"

    def test_search_invalid_sort_rejected(self):
        resp = client.get("/api/climbs/search?q=e&sort=bogus")
        assert resp.status_code == 422

    def test_search_grade_min_out_of_range_rejected(self):
        resp = client.get("/api/climbs/search?q=e&grade_min=5")
        assert resp.status_code == 422

    def test_search_min_quality_out_of_range_rejected(self):
        resp = client.get("/api/climbs/search?q=e&min_quality=6")
        assert resp.status_code == 422

    def test_search_combined_filters(self):
        resp = client.get(
            "/api/climbs/search?q=e&angle=40&grade_min=18&min_ascents=2000&sort=quality"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Benchmark Beta"

    # ── A019: moves filter ──────────────────────────────────────────────────

    def test_search_excludes_animated_sequences(self):
        """Animated multi-frame sequences (frames_count > 1) are excluded
        from search globally — they're circuits, not boulders."""
        resp = client.get("/api/climbs/search")
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert "A019 Fixture - Animated Sequence" not in names

    def test_search_moves_le5_returns_only_short_boulders(self):
        resp = client.get("/api/climbs/search?moves=le5")
        assert resp.status_code == 200
        names = {r["name"] for r in resp.json()}
        # Pre-A019 fixtures all sit in ≤5: Alpha (4 moves), Beta (3), Crimp (3).
        assert names == {"Benchmark Alpha", "Benchmark Beta", "The Crimp Test"}

    def test_search_moves_6_7(self):
        resp = client.get("/api/climbs/search?moves=6-7")
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert names == ["A019 Fixture - Bucket 6-7"]

    def test_search_moves_8_10(self):
        resp = client.get("/api/climbs/search?moves=8-10")
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert names == ["A019 Fixture - Bucket 8-10"]

    def test_search_moves_gt10(self):
        resp = client.get("/api/climbs/search?moves=gt10")
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert names == ["A019 Fixture - Bucket >10"]

    def test_search_moves_any_does_not_filter(self):
        """`moves=any` is equivalent to omitting the parameter."""
        resp_any = client.get("/api/climbs/search?moves=any")
        resp_no = client.get("/api/climbs/search")
        assert {r["uuid"] for r in resp_any.json()} == {
            r["uuid"] for r in resp_no.json()
        }

    def test_search_moves_invalid_value_returns_422(self):
        resp = client.get("/api/climbs/search?moves=bogus")
        assert resp.status_code == 422


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

    def test_get_climb_holds_carry_set_id(self):
        """B016: holds must include set_id so the frontend can render
        screw-on footholds (set_id=20) at a smaller size than bolt-ons."""
        resp = client.get("/api/climbs/UUID-BENCH-001")
        data = resp.json()
        # Every hold exposes set_id
        assert all("set_id" in hold for hold in data["holds"])
        sets = {hold["set_id"] for hold in data["holds"]}
        # Fixture: 5 bolt-ons (set_id=1) + 1 screw-on foot (set_id=20)
        assert sets == {1, 20}
        screw_ons = [h for h in data["holds"] if h["set_id"] == 20]
        assert len(screw_ons) == 1
        assert screw_ons[0]["role"] == "foot_only"

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
        # Pre-A019 fixture had 5 climbs (4 listed, 1 unlisted draft).
        # A019 added 4 more climbs, all is_listed=1: 9 total, 8 listed.
        # (Stats do not filter by frames_count.)
        assert data["total_climbs"] == 9
        assert data["listed_climbs"] == 8
        assert 40 in data["available_angles"]
        assert "grade_range" in data
