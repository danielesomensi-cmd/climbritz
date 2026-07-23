"""A-STORE-PROD-002: guards + pure helpers of the review-account seeder.

The script itself talks to the live Clerk API and the production backend, so
only the parts that must never be wrong are tested here: the environment
guards (a test key or a missing secret must abort loudly), the fixed identity
list (it can never grow to a third account), and the placement picker.

Nothing in this module makes a network call.
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path

import pytest

SCRIPT = (
    Path(__file__).resolve().parents[1] / "scripts" / "seed_review_accounts.py"
)


def _load():
    spec = importlib.util.spec_from_file_location("seed_review_accounts", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


seeder = _load()


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("CLERK_SECRET_KEY", raising=False)
    monkeypatch.delenv("API_BASE", raising=False)


class TestEnvGuards:
    def test_missing_secret_aborts_with_actionable_message(self):
        with pytest.raises(seeder.SeedError) as exc:
            seeder.read_env()
        assert "CLERK_SECRET_KEY is not set" in str(exc.value)
        # Must tell the operator how to pass it without persisting it.
        assert "never write it to backend/.env" in str(exc.value)

    def test_refuses_a_test_key(self, monkeypatch):
        monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_abc123")
        monkeypatch.setenv("API_BASE", "https://example.invalid")
        with pytest.raises(seeder.SeedError) as exc:
            seeder.read_env()
        assert "TEST key" in str(exc.value)

    def test_refuses_a_non_clerk_key(self, monkeypatch):
        monkeypatch.setenv("CLERK_SECRET_KEY", "hunter2")
        monkeypatch.setenv("API_BASE", "https://example.invalid")
        with pytest.raises(seeder.SeedError):
            seeder.read_env()

    def test_missing_api_base_aborts(self, monkeypatch):
        monkeypatch.setenv("CLERK_SECRET_KEY", "sk_live_abc123")
        with pytest.raises(seeder.SeedError) as exc:
            seeder.read_env()
        assert "API_BASE" in str(exc.value)

    def test_accepts_a_live_key_and_strips_trailing_slash(self, monkeypatch):
        monkeypatch.setenv("CLERK_SECRET_KEY", "  sk_live_abc123  ")
        monkeypatch.setenv("API_BASE", "https://example.invalid/")
        secret, api_base = seeder.read_env()
        assert secret == "sk_live_abc123"
        assert api_base == "https://example.invalid"


class TestFixedIdentities:
    def test_exactly_two_accounts(self):
        """A reviewer deleting the only demo account locks themselves out of
        a re-review — and a re-run must never mint a third."""
        assert len(seeder.ACCOUNTS) == 2

    def test_emails_are_distinct_and_constant(self):
        emails = [a["email"] for a in seeder.ACCOUNTS]
        assert len(set(emails)) == 2
        assert all(e.endswith("@climbritz.app") for e in emails)

    def test_account_one_has_more_history_than_account_two(self):
        totals = [sum(s["count"] for s in a["logs"]) for a in seeder.ACCOUNTS]
        assert totals[0] > totals[1]

    def test_every_log_spec_uses_a_valid_result_type(self):
        valid = {"flash", "send", "attempt"}
        for acct in seeder.ACCOUNTS:
            for spec in acct["logs"]:
                assert spec["result"] in valid

    def test_categories_match_the_api_contract(self):
        assert set(seeder.CATEGORIES) == {
            "jug",
            "good_crimp",
            "crimp",
            "sloper",
            "undercling",
            "pinch",
        }


class TestPlacementPicker:
    def test_returns_real_spread_out_placement_ids(self):
        ids = seeder.load_placements()
        assert len(ids) >= 20
        assert all(isinstance(i, int) for i in ids)
        assert len(set(ids)) == len(ids), "duplicate placement ids"

    def test_covers_enough_holds_for_the_richer_account(self):
        needed = max(a["classifications"] for a in seeder.ACCOUNTS)
        assert len(seeder.load_placements()) >= needed


class TestCredentialsBlock:
    def test_prints_both_accounts_and_the_spare_account_warning(self, capsys):
        seeder.print_credentials_block(dry_run=True)
        out = capsys.readouterr().out
        for acct in seeder.ACCOUNTS:
            assert acct["email"] in out
            assert acct["password"] in out
        assert "spare" in out.lower()
        # The BLE caveat must be pre-empted in the notes, not discovered by
        # the reviewer as a broken feature (Guideline 2.1).
        assert "Kilter Board" in out
