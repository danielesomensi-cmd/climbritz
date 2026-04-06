"""Tests for the holds API (composite board image + individual hold crops)."""

import os

import pytest
from fastapi.testclient import TestClient

from app.api.holds import BOARD_12X12, SOURCE_16X12
from app.main import app

client = TestClient(app)


pytestmark = pytest.mark.skipif(
    not SOURCE_16X12.exists(),
    reason="16x12 composite source not present in this environment",
)


class TestBoardImageEndpoint:
    def test_board_image_returns_png(self, tmp_path, monkeypatch):
        # Redirect cache to tmp so the test is hermetic
        cache_file = tmp_path / "board.png"
        monkeypatch.setattr("app.api.holds.BOARD_12X12", cache_file)
        monkeypatch.setattr("app.api.holds.CACHE_DIR", tmp_path)

        resp = client.get("/api/holds/board-image")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert len(resp.content) > 1000  # non-empty PNG
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_board_image_cached_after_first_call(self, tmp_path, monkeypatch):
        cache_file = tmp_path / "board.png"
        monkeypatch.setattr("app.api.holds.BOARD_12X12", cache_file)
        monkeypatch.setattr("app.api.holds.CACHE_DIR", tmp_path)

        assert not cache_file.exists()
        client.get("/api/holds/board-image")
        assert cache_file.exists()
        first_mtime = cache_file.stat().st_mtime

        # Second call should reuse the cached file (no rewrite)
        client.get("/api/holds/board-image")
        assert cache_file.stat().st_mtime == first_mtime


class TestHoldImageEndpoint:
    def test_returns_404_for_unknown_hold(self):
        resp = client.get("/api/holds/99999999/image")
        assert resp.status_code == 404

    def test_returns_png_for_known_hold(self):
        # Pick any existing file under data/images/holds
        holds_dir = os.path.join("data", "images", "holds")
        if not os.path.isdir(holds_dir):
            pytest.skip("holds image directory not present")
        entries = [f for f in os.listdir(holds_dir) if f.endswith(".png")]
        if not entries:
            pytest.skip("no hold images available")
        placement_id = int(entries[0].removesuffix(".png"))

        resp = client.get(f"/api/holds/{placement_id}/image")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
