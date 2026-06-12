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
        # Post-A019: 4 pre-existing rows (Alpha@40, Alpha@45, Beta@40,
        # Crimp@40) + 3 A019 listed singles. The animated A019 row is
        # excluded by the global frames_count=1 filter.
        from app.services.climb_service import search_climbs

        results = search_climbs()
        assert len(results) == 7

    def test_search_empty_string_query_returns_all(self):
        from app.services.climb_service import search_climbs

        results = search_climbs("")
        assert len(results) == 7

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

        # q="Benchmark" excludes the A019 fixture rows (diff=14, which
        # would otherwise leak into a grade_max=18 query).
        results = search_climbs("Benchmark", grade_max=18)
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

        # q="Benchmark" so the diff=14 A019 fixtures don't sort ahead.
        results = search_climbs("Benchmark", sort="grade_asc")
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

    # ── A019: moves filter ──────────────────────────────────────────────────

    def test_search_excludes_animated_sequences(self):
        """frames_count > 1 climbs are filtered out globally."""
        from app.services.climb_service import search_climbs

        results = search_climbs()
        names = [r["name"] for r in results]
        assert "A019 Fixture - Animated Sequence" not in names

    def test_moves_le5_keeps_only_short_boulders(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(moves="le5")
        names = {r["name"] for r in results}
        # Only the pre-A019 fixtures (Alpha 4 moves, Beta/Crimp 3 moves).
        assert names == {"Benchmark Alpha", "Benchmark Beta", "The Crimp Test"}

    def test_moves_6_7_keeps_only_67_bucket(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(moves="6-7")
        names = [r["name"] for r in results]
        assert names == ["A019 Fixture - Bucket 6-7"]

    def test_moves_8_10_keeps_only_810_bucket(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(moves="8-10")
        names = [r["name"] for r in results]
        assert names == ["A019 Fixture - Bucket 8-10"]

    def test_moves_gt10_keeps_only_long_boulders(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(moves="gt10")
        names = [r["name"] for r in results]
        assert names == ["A019 Fixture - Bucket >10"]

    def test_moves_any_is_equivalent_to_no_filter(self):
        from app.services.climb_service import search_climbs

        any_uuids = {r["uuid"] for r in search_climbs(moves="any")}
        no_uuids = {r["uuid"] for r in search_climbs()}
        assert any_uuids == no_uuids

    def test_moves_none_does_not_filter(self):
        """Passing moves=None is equivalent to omitting the parameter."""
        from app.services.climb_service import search_climbs

        none_uuids = {r["uuid"] for r in search_climbs(moves=None)}
        no_uuids = {r["uuid"] for r in search_climbs()}
        assert none_uuids == no_uuids


class TestBenchmarkFilter:
    """A022: benchmark filter. Fixture benchmark flags (seeded by
    seed_a022_test_fixtures.py):
        Alpha@40 → benchmark   Alpha@45 → NULL
        Crimp@40 → benchmark   Beta@40  → NULL
    The Alpha@40-yes / Alpha@45-no split is the angle-specificity proof."""

    def test_benchmark_at_angle_40(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(angle=40, benchmark=True)
        names = {r["name"] for r in results}
        # Alpha@40 and Crimp@40 are benchmarks; Beta@40 is not.
        assert names == {"Benchmark Alpha", "The Crimp Test"}

    def test_benchmark_is_angle_specific(self):
        """Alpha is a benchmark at 40° but NOT at 45° — the filter must
        respect the selected angle (the core A022 Phase 0.5 finding)."""
        from app.services.climb_service import search_climbs

        results = search_climbs(angle=45, benchmark=True)
        # Alpha@45 has benchmark_difficulty NULL → nothing benchmarked at 45°.
        assert results == []

    def test_benchmark_without_angle_spans_all_angles(self):
        """No angle filter → every (climb, angle) row that is itself a
        benchmark. Both fixture benchmarks live at 40°, so we get 2 rows."""
        from app.services.climb_service import search_climbs

        results = search_climbs(benchmark=True)
        assert len(results) == 2
        assert all(r["angle"] == 40 for r in results)

    def test_benchmark_false_is_no_filter(self):
        from app.services.climb_service import search_climbs

        on = {r["uuid"] for r in search_climbs(benchmark=False)}
        off = {r["uuid"] for r in search_climbs()}
        assert on == off

    def test_benchmark_combined_with_grade(self):
        from app.services.climb_service import search_climbs

        # angle=40 benchmarks are Alpha(16) + Crimp(22); grade_min=20 drops Alpha.
        results = search_climbs(angle=40, benchmark=True, grade_min=20)
        assert len(results) == 1
        assert results[0]["name"] == "The Crimp Test"

    def test_count_respects_benchmark(self):
        from app.services.climb_service import (
            count_matching_climbs,
            search_climbs,
        )

        kwargs = dict(angle=40, benchmark=True)
        assert count_matching_climbs(**kwargs) == len(search_climbs(**kwargs)) == 2
        assert count_matching_climbs(angle=45, benchmark=True) == 0


class TestNomatchFilter:
    """A029: "no matching" filter on climbs.is_nomatch (audit D019).
    Fixture flags (seeded by seed_a029_test_fixtures.py):
        Benchmark Alpha (UUID-BENCH-001)       → is_nomatch = 1
        A019 Bucket 6-7 (UUID-A019-BUCKET-67)  → is_nomatch = 1
        everything else                         → 0
    Climb-level flag, so unlike benchmark it is NOT angle-specific."""

    def test_nomatch_true_returns_only_flagged(self):
        from app.services.climb_service import search_climbs

        results = search_climbs(nomatch=True)
        uuids = {r["uuid"] for r in results}
        assert uuids == {"UUID-BENCH-001", "UUID-A019-BUCKET-67"}
        assert all(r["is_nomatch"] is True for r in results)

    def test_nomatch_false_is_no_filter(self):
        from app.services.climb_service import search_climbs

        off = {r["uuid"] for r in search_climbs(nomatch=False)}
        default = {r["uuid"] for r in search_climbs()}
        assert off == default

    def test_results_carry_is_nomatch_field(self):
        from app.services.climb_service import search_climbs

        by_uuid = {r["uuid"]: r["is_nomatch"] for r in search_climbs()}
        assert by_uuid["UUID-BENCH-001"] is True
        assert by_uuid["UUID-BENCH-002"] is False

    def test_nomatch_combined_with_benchmark(self):
        """Alpha is both a benchmark @40° and nomatch; Crimp is benchmark
        only — the intersection keeps Alpha alone."""
        from app.services.climb_service import search_climbs

        results = search_climbs(angle=40, benchmark=True, nomatch=True)
        assert [r["uuid"] for r in results] == ["UUID-BENCH-001"]

    def test_count_respects_nomatch(self):
        from app.services.climb_service import (
            count_matching_climbs,
            search_climbs,
        )

        kwargs = dict(nomatch=True)
        assert count_matching_climbs(**kwargs) == len(search_climbs(**kwargs))

    def test_detail_carries_is_nomatch(self):
        from app.services.climb_service import get_climb

        assert get_climb("UUID-BENCH-001")["is_nomatch"] is True
        assert get_climb("UUID-BENCH-002")["is_nomatch"] is False


class TestCountMatchingClimbs:
    """B020: count_matching_climbs shares the same WHERE-clause builder as
    search_climbs, so the count must equal len(search_climbs(...)) when the
    search isn't truncated by ``limit``."""

    def test_count_matches_search_length_no_filters(self):
        from app.services.climb_service import (
            count_matching_climbs,
            search_climbs,
        )

        # Default limit is 500, fixture has 7 listed singles → no truncation.
        assert count_matching_climbs() == len(search_climbs())

    def test_count_matches_search_length_with_filters(self):
        from app.services.climb_service import (
            count_matching_climbs,
            search_climbs,
        )

        kwargs = dict(query="Benchmark", angle=40)
        assert count_matching_climbs(**kwargs) == len(search_climbs(**kwargs))

    def test_count_zero_when_no_match(self):
        from app.services.climb_service import count_matching_climbs

        assert count_matching_climbs(query="xyznonexistent") == 0

    def test_count_ignores_limit_kwarg(self):
        """The function doesn't accept ``limit`` — count is always exhaustive.
        Guards against future drift if someone adds limit/sort by accident."""
        from app.services.climb_service import count_matching_climbs

        with pytest.raises(TypeError):
            count_matching_climbs(limit=1)  # type: ignore[call-arg]

    def test_count_excludes_animated_sequences(self):
        """frames_count > 1 rows must be excluded from the count, same as
        from the search list."""
        from app.services.climb_service import count_matching_climbs

        # Fixture has 7 listed singles + 1 animated sequence. Count = 7.
        assert count_matching_climbs() == 7

    def test_count_unaffected_by_dg_join_omission(self):
        """The count query drops the difficulty_grades JOIN that the search
        query keeps for projection. Validate that for the fixture (where
        every display_difficulty maps cleanly to dg.difficulty) the two
        agree across a representative filter sweep."""
        from app.services.climb_service import (
            count_matching_climbs,
            search_climbs,
        )

        for kwargs in [
            dict(),
            dict(angle=40),
            dict(grade_min=18, grade_max=22),
            dict(min_ascents=2000),
            dict(min_quality=3.8),
            dict(moves="le5"),
            dict(query="e", angle=40, grade_min=18),
        ]:
            assert count_matching_climbs(**kwargs) == len(
                search_climbs(**kwargs)
            ), kwargs


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
        # Pre-A019: 5 total / 4 listed (3 Kilter + 1 other layout, +
        # 1 unlisted draft). A019 added 4 more, all is_listed=1.
        # (Stats do not filter by frames_count.)
        assert stats["total_climbs"] == 9
        assert stats["listed_climbs"] == 8
        assert 40 in stats["available_angles"]
        assert 45 in stats["available_angles"]
        assert stats["grade_range"]["min_difficulty"] is not None
        assert stats["grade_range"]["max_difficulty"] is not None
