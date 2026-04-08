"""Tests for climb_service.py — BoardLib database queries."""

import os
import pytest
from unittest.mock import patch

# Path to the test fixture DB
FIXTURE_DB = os.path.join(
    os.path.dirname(__file__), "fixtures", "test_kilter.db"
)


@pytest.fixture(autouse=True)
def mock_settings():
    """Point climb_service at the test fixture DB."""
    with patch("app.services.climb_service.get_settings") as mock:
        mock.return_value.boardlib_db_path = FIXTURE_DB
        yield mock


class TestSearchClimbs:
    def test_search_by_name(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Benchmark")
        # 3 rows: Alpha@40°, Beta@40°, Alpha@45° (one row per climb+angle)
        assert len(results) == 3
        # Sorted by ascensionist_count desc
        assert results[0]["name"] == "Benchmark Alpha"
        assert results[0]["ascensionist_count"] == 5000

    def test_search_with_angle_filter(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Benchmark", angle=40)
        assert len(results) == 2

        results_45 = search_climbs("Benchmark", angle=45)
        assert len(results_45) == 1
        assert results_45[0]["name"] == "Benchmark Alpha"

    def test_search_no_results(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("xyznonexistent")
        assert results == []

    def test_search_without_query_returns_all(self):
        # B012: query is now optional. With no query, the LIKE clause is
        # skipped and we get every listed Kilter row.
        from app.services.climb_service import search_climbs

        results = search_climbs()
        assert len(results) == 4  # Alpha@40, Alpha@45, Beta@40, Crimp@40

    def test_search_empty_string_query_returns_all(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("")
        assert len(results) == 4

    def test_search_no_query_with_filters(self):
        from app.services.climb_service import search_climbs

        # Pure browse-by-filter: no name, just angle + grade range
        results = search_climbs(angle=40, grade_min=18, grade_max=22)
        # Beta@40 (20) + Crimp@40 (22)
        assert len(results) == 2

    def test_search_excludes_unlisted(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Draft")
        assert results == []

    def test_search_excludes_other_layouts(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Other Board")
        assert results == []

    def test_search_returns_grade(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Benchmark Alpha", angle=40)
        assert len(results) == 1
        assert results[0]["grade"] == "6a/V3"

    def test_search_respects_limit(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Benchmark", limit=1)
        assert len(results) == 1

    # ── New filter tests (A011) ─────────────────────────────────────────────
    # Fixture rows (listed, layout=1):
    #   Alpha@40  diff=16 asc=5000 q=3.5
    #   Alpha@45  diff=18 asc=2000 q=3.2
    #   Beta@40   diff=20 asc=3000 q=4.0
    #   Crimp@40  diff=22 asc=1500 q=3.8

    def test_search_grade_min(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", grade_min=18)
        # Excludes Alpha@40 (diff=16). Keeps Alpha@45, Beta@40, Crimp@40.
        assert len(results) == 3
        names = {(r["name"], r["angle"]) for r in results}
        assert ("Benchmark Alpha", 40) not in names

    def test_search_grade_max(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", grade_max=18)
        assert len(results) == 2  # Alpha@40, Alpha@45
        names = {r["name"] for r in results}
        assert names == {"Benchmark Alpha"}

    def test_search_grade_range(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", grade_min=18, grade_max=20)
        # Alpha@45 (18) + Beta@40 (20)
        assert len(results) == 2

    def test_search_min_ascents(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", min_ascents=2000)
        # Excludes Crimp@40 (1500). Keeps Alpha@40 (5000), Beta@40 (3000), Alpha@45 (2000).
        assert len(results) == 3
        assert all(r["ascensionist_count"] >= 2000 for r in results)

    def test_search_min_quality(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", min_quality=3.8)
        # Beta@40 (4.0), Crimp@40 (3.8)
        assert len(results) == 2
        assert all(r["quality_average"] >= 3.8 for r in results)

    def test_search_sort_popularity_default(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e")
        # Desc by asc count: 5000, 3000, 2000, 1500
        counts = [r["ascensionist_count"] for r in results]
        assert counts == sorted(counts, reverse=True)

    def test_search_sort_quality(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", sort="quality")
        # Top quality: Beta (4.0)
        assert results[0]["name"] == "Benchmark Beta"

    def test_search_sort_grade_asc(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", sort="grade_asc")
        # Easiest first: Alpha@40 (diff 16)
        assert results[0]["name"] == "Benchmark Alpha"
        assert results[0]["angle"] == 40

    def test_search_sort_grade_desc(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", sort="grade_desc")
        # Hardest first: The Crimp Test (diff 22)
        assert results[0]["name"] == "The Crimp Test"

    def test_search_unknown_sort_falls_back_to_popularity(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("e", sort="not-a-real-sort")
        counts = [r["ascensionist_count"] for r in results]
        assert counts == sorted(counts, reverse=True)

    def test_search_combined_filters(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(
            "a", angle=40, grade_min=18, min_ascents=2000, sort="quality"
        )
        # angle=40 → Alpha@40(diff16), Beta@40(diff20), Crimp@40(diff22)
        # grade_min=18 → drops Alpha@40
        # min_ascents=2000 → Beta@40(3000), Crimp@40(1500 DROPPED)
        # → only Beta
        assert len(results) == 1
        assert results[0]["name"] == "Benchmark Beta"

    def test_search_result_structure(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("Benchmark Alpha", angle=40)
        r = results[0]
        assert "uuid" in r
        assert "name" in r
        assert "setter" in r
        assert "grade" in r
        assert "angle" in r
        assert "ascensionist_count" in r
        assert "quality_average" in r


class TestGetClimb:
    def test_get_existing_climb(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-BENCH-001")
        assert result is not None
        assert result["name"] == "Benchmark Alpha"
        assert result["setter"] == "test_setter"

    def test_get_climb_has_holds(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-BENCH-001")
        holds = result["holds"]
        assert len(holds) == 6
        # Check roles are parsed
        roles = [h["role"] for h in holds]
        assert roles.count("start") == 2
        assert roles.count("middle") == 2
        assert roles.count("finish") == 1
        assert roles.count("foot_only") == 1

    def test_get_climb_holds_have_positions(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-BENCH-001")
        for hold in result["holds"]:
            assert hold["x"] is not None
            assert hold["y"] is not None

    def test_get_climb_has_stats(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-BENCH-001")
        assert len(result["stats"]) == 2  # 40° and 45°
        # Most popular angle first
        assert result["stats"][0]["angle"] == 40
        assert result["stats"][0]["ascensionist_count"] == 5000

    def test_get_climb_with_angle_filter(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-BENCH-001", angle=45)
        assert len(result["stats"]) == 1
        assert result["stats"][0]["angle"] == 45
        assert result["stats"][0]["grade"] == "6b/V4"

    def test_get_nonexistent_climb(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-DOES-NOT-EXIST")
        assert result is None

    def test_get_unlisted_climb_returns_none(self):
        from app.services.climb_service import get_climb

        result = get_climb("UUID-UNLISTED")
        assert result is None


class TestGetDbStats:
    def test_returns_stats(self):
        from app.services.climb_service import get_db_stats

        stats = get_db_stats()
        assert stats["total_climbs"] == 5
        assert stats["listed_climbs"] == 4  # 3 listed Kilter + 1 other layout
        assert 40 in stats["available_angles"]
        assert 45 in stats["available_angles"]
        assert stats["grade_range"]["min_difficulty"] is not None
        assert stats["grade_range"]["max_difficulty"] is not None
