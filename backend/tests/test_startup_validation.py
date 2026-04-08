"""Tests for startup validation helpers (D014)."""

import os
import sqlite3
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.main import _validate_boardlib_db


def _make_valid_boardlib_db(path: str) -> None:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE climbs (uuid TEXT PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO climbs VALUES ('u1', 'test')")
    conn.commit()
    conn.close()


def _make_empty_db(path: str) -> None:
    conn = sqlite3.connect(path)  # creates the file, no tables
    conn.close()


class TestValidateBoardlibDb:
    def test_passes_when_db_has_climbs_table(self, tmp_path):
        db_file = tmp_path / "kilter.db"
        _make_valid_boardlib_db(str(db_file))

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)
        fake_settings.environment = "production"

        with patch("app.main.settings", fake_settings):
            _validate_boardlib_db()  # no raise

    def test_raises_in_production_when_db_missing(self, tmp_path):
        db_file = tmp_path / "nope.db"

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)
        fake_settings.environment = "production"

        with patch("app.main.settings", fake_settings):
            with pytest.raises(RuntimeError, match="BoardLib DB missing"):
                _validate_boardlib_db()

    def test_raises_in_production_when_db_empty(self, tmp_path):
        db_file = tmp_path / "kilter.db"
        _make_empty_db(str(db_file))

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)
        fake_settings.environment = "production"

        with patch("app.main.settings", fake_settings):
            with pytest.raises(RuntimeError, match="missing 'climbs' table"):
                _validate_boardlib_db()

    def test_warns_but_does_not_raise_in_development_when_missing(self, tmp_path, caplog):
        db_file = tmp_path / "nope.db"

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)
        fake_settings.environment = "development"

        with patch("app.main.settings", fake_settings):
            with caplog.at_level("WARNING"):
                _validate_boardlib_db()  # no raise
            assert any("BoardLib DB check skipped" in rec.message for rec in caplog.records)

    def test_warns_but_does_not_raise_in_development_when_empty(self, tmp_path, caplog):
        db_file = tmp_path / "kilter.db"
        _make_empty_db(str(db_file))

        fake_settings = MagicMock()
        fake_settings.boardlib_db_path = str(db_file)
        fake_settings.environment = "development"

        with patch("app.main.settings", fake_settings):
            with caplog.at_level("WARNING"):
                _validate_boardlib_db()  # no raise
            assert any("BoardLib DB check failed" in rec.message for rec in caplog.records)
