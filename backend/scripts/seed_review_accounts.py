#!/usr/bin/env python3
"""A-STORE-PROD-002: provision + populate the two App Store review accounts.

Apple reviewers need working, pre-populated accounts on **production**. Two,
not one: a reviewer testing in-app account deletion (Guideline 5.1.1(v)) will
delete the only demo account and lock themselves out of a re-review
(docs/STORE_RELEASE_RUNBOOK.md, Part D).

Usage
-----
    CLERK_SECRET_KEY=sk_live_… \\
    API_BASE=https://web-production-cea9.up.railway.app \\
        python backend/scripts/seed_review_accounts.py [--dry-run]

The secret is passed inline for one shot. It is never written to
``backend/.env``, never committed, and never echoed — only its ``sk_live_``
prefix is ever printed.

How it works
------------
The production database is a SQLite file on a Railway volume and is not
reachable from a laptop, so this script does **not** write rows directly.
It creates the Clerk users via the Backend API, mints a short-lived session
token for each, and then drives the **real public API** (``POST /api/logs``,
``PUT /api/classifications/{id}``, ``PATCH /api/user-climbs/{uuid}/project``)
exactly as the app would. Two benefits: the local ``users`` shadow row is
created by the normal ``lookup_or_create_user`` path, and the seeded data is
guaranteed to be shaped the way the app actually produces it.

Climb uuids are pulled live from ``GET /api/climbs/search`` rather than
hard-coded, so the script cannot seed a uuid that does not exist in the
deployed BoardLib snapshot.

Idempotent: re-running reuses the existing Clerk users (looked up by email),
re-asserts the password, and skips any account that already has logs. It can
never create a third account — the two emails are constants.

Deliberately does NOT create video analyses: that needs a real video file and
a live Gemini round-trip, so it stays manual.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.clerk_admin_service import (  # noqa: E402
    CLERK_API_BASE,
    ClerkApiError,
    _headers,
)

TIMEOUT = 20.0

# Fixed identities — the reason a re-run can never create a third account.
ACCOUNTS = [
    {
        "slot": 1,
        "email": "appreview1@climbritz.app",
        "password": "ClimbritzReview!2026a",
        "first_name": "App",
        "last_name": "Review One",
        # The richer account: enough history that History/pyramid/trend all
        # render with real shape rather than an empty state.
        "logs": [
            {"angle": 40, "grade_min": 10, "grade_max": 14, "result": "flash", "count": 4},
            {"angle": 40, "grade_min": 15, "grade_max": 18, "result": "send", "count": 4},
            {"angle": 40, "grade_min": 19, "grade_max": 21, "result": "attempt", "count": 3},
            {"angle": 30, "grade_min": 12, "grade_max": 16, "result": "send", "count": 3},
            {"angle": 50, "grade_min": 12, "grade_max": 16, "result": "attempt", "count": 2},
        ],
        "projects": 3,
        "classifications": 24,
    },
    {
        "slot": 2,
        "email": "appreview2@climbritz.app",
        "password": "ClimbritzReview!2026b",
        "first_name": "App",
        "last_name": "Review Two",
        # Lighter: a plausible newer user, and the spare account if slot 1
        # gets deleted during a deletion test.
        "logs": [
            {"angle": 40, "grade_min": 10, "grade_max": 14, "result": "flash", "count": 2},
            {"angle": 40, "grade_min": 15, "grade_max": 18, "result": "send", "count": 2},
            {"angle": 30, "grade_min": 12, "grade_max": 16, "result": "attempt", "count": 1},
        ],
        "projects": 1,
        "classifications": 8,
    },
]

CATEGORIES = [
    "jug",
    "good_crimp",
    "crimp",
    "sloper",
    "undercling",
    "pinch",
]


class SeedError(RuntimeError):
    """Fatal, user-actionable problem — printed without a traceback."""


# --------------------------------------------------------------------------
# Environment
# --------------------------------------------------------------------------


def read_env() -> tuple[str, str]:
    secret = os.getenv("CLERK_SECRET_KEY", "").strip()
    api_base = os.getenv("API_BASE", "").strip().rstrip("/")

    if not secret:
        raise SeedError(
            "CLERK_SECRET_KEY is not set.\n"
            "Pass it inline for one shot — never write it to backend/.env:\n"
            "  CLERK_SECRET_KEY=sk_live_… API_BASE=https://… "
            "python backend/scripts/seed_review_accounts.py"
        )
    if secret.startswith("sk_test_"):
        raise SeedError(
            "Refusing to run: CLERK_SECRET_KEY is a TEST key (sk_test_…).\n"
            "These accounts must exist on the production Clerk instance, "
            "otherwise the reviewer cannot sign in to the shipped app."
        )
    if not secret.startswith("sk_"):
        raise SeedError("CLERK_SECRET_KEY does not look like a Clerk secret key.")
    if not api_base:
        raise SeedError(
            "API_BASE is not set (e.g. https://web-production-cea9.up.railway.app)."
        )
    return secret, api_base


# --------------------------------------------------------------------------
# Clerk Backend API
# --------------------------------------------------------------------------


def find_clerk_user(secret: str, email: str) -> dict | None:
    resp = httpx.get(
        f"{CLERK_API_BASE}/users",
        headers=_headers(secret),
        params={"email_address": email},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise ClerkApiError(f"GET /users -> {resp.status_code}: {resp.text[:200]}")
    users = resp.json()
    return users[0] if users else None


def create_clerk_user(secret: str, acct: dict) -> dict:
    """Email-verified, password set, password checks skipped.

    `skip_password_checks` matters: the review passwords are shared in App
    Store Connect, so Clerk's breach/complexity heuristics would otherwise
    reject them.
    """
    body = {
        "email_address": [acct["email"]],
        "password": acct["password"],
        "first_name": acct["first_name"],
        "last_name": acct["last_name"],
        "skip_password_checks": True,
        "skip_password_requirement": False,
    }
    resp = httpx.post(
        f"{CLERK_API_BASE}/users",
        headers=_headers(secret),
        json=body,
        timeout=TIMEOUT,
    )
    if resp.status_code // 100 != 2:
        raise ClerkApiError(f"POST /users -> {resp.status_code}: {resp.text[:300]}")
    user = resp.json()

    # Clerk marks an admin-created email unverified unless told otherwise;
    # an unverified reviewer account hits a verification wall at sign-in.
    for ea in user.get("email_addresses", []):
        if not (ea.get("verification") or {}).get("status") == "verified":
            httpx.patch(
                f"{CLERK_API_BASE}/email_addresses/{ea['id']}",
                headers=_headers(secret),
                json={"verified": True, "primary": True},
                timeout=TIMEOUT,
            )
    return user


def reset_clerk_password(secret: str, clerk_id: str, password: str) -> None:
    """Re-assert the documented password on a re-run — otherwise a password
    changed by hand would silently invalidate the App Store Connect block."""
    resp = httpx.patch(
        f"{CLERK_API_BASE}/users/{clerk_id}",
        headers=_headers(secret),
        json={"password": password, "skip_password_checks": True},
        timeout=TIMEOUT,
    )
    if resp.status_code // 100 != 2:
        raise ClerkApiError(
            f"PATCH /users/{clerk_id} -> {resp.status_code}: {resp.text[:200]}"
        )


def mint_session_token(secret: str, clerk_id: str) -> str:
    """Create a session for the user and mint a JWT the backend will accept.

    This is what lets the script drive the real API instead of writing to a
    database it cannot reach.
    """
    resp = httpx.post(
        f"{CLERK_API_BASE}/sessions",
        headers=_headers(secret),
        json={"user_id": clerk_id},
        timeout=TIMEOUT,
    )
    if resp.status_code // 100 != 2:
        raise ClerkApiError(
            f"POST /sessions -> {resp.status_code}: {resp.text[:200]}"
        )
    session_id = resp.json()["id"]

    resp = httpx.post(
        f"{CLERK_API_BASE}/sessions/{session_id}/tokens",
        headers=_headers(secret),
        json={},
        timeout=TIMEOUT,
    )
    if resp.status_code // 100 != 2:
        raise ClerkApiError(
            f"POST /sessions/{session_id}/tokens -> "
            f"{resp.status_code}: {resp.text[:200]}"
        )
    return resp.json()["jwt"]


# --------------------------------------------------------------------------
# Climbritz API
# --------------------------------------------------------------------------


def pick_climbs(api_base: str, angle: int, gmin: int, gmax: int, n: int) -> list[str]:
    """Real uuids from the deployed BoardLib snapshot — never hard-coded."""
    resp = httpx.get(
        f"{api_base}/api/climbs/search",
        params={
            "angle": angle,
            "grade_min": gmin,
            "grade_max": gmax,
            "min_ascents": 20,
            "sort": "popularity",
            "limit": max(n * 3, 20),
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    climbs = resp.json().get("climbs", [])
    return [c["uuid"] for c in climbs[:n]]


def api_post(api_base: str, path: str, token: str, body: dict) -> httpx.Response:
    return httpx.post(
        f"{api_base}{path}",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
        timeout=TIMEOUT,
    )


def already_seeded(api_base: str, token: str) -> bool:
    resp = httpx.get(
        f"{api_base}/api/logs",
        headers={"Authorization": f"Bearer {token}"},
        params={"limit": 1},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        return False
    data = resp.json()
    rows = data.get("logs", data) if isinstance(data, dict) else data
    return bool(rows)


def seed_account_data(api_base: str, token: str, acct: dict) -> dict[str, int]:
    counts = {"logs": 0, "projects": 0, "classifications": 0}
    project_pool: list[tuple[str, int]] = []

    for spec in acct["logs"]:
        uuids = pick_climbs(
            api_base, spec["angle"], spec["grade_min"], spec["grade_max"], spec["count"]
        )
        if not uuids:
            print(
                f"    ! no climbs found for angle {spec['angle']} "
                f"grades {spec['grade_min']}-{spec['grade_max']} — skipped"
            )
            continue
        for uuid in uuids:
            resp = api_post(
                api_base,
                "/api/logs",
                token,
                {
                    "climb_uuid": uuid,
                    "angle": spec["angle"],
                    "result_type": spec["result"],
                },
            )
            if resp.status_code // 100 == 2:
                counts["logs"] += 1
                project_pool.append((uuid, spec["angle"]))
            else:
                print(f"    ! log {uuid[:8]} -> {resp.status_code}")

    for uuid, angle in project_pool[: acct["projects"]]:
        resp = httpx.patch(
            f"{api_base}/api/user-climbs/{uuid}/project",
            headers={"Authorization": f"Bearer {token}"},
            json={"angle": angle, "is_project": True},
            timeout=TIMEOUT,
        )
        if resp.status_code // 100 == 2:
            counts["projects"] += 1

    placements = load_placements()
    for i, placement_id in enumerate(placements[: acct["classifications"]]):
        resp = httpx.put(
            f"{api_base}/api/classifications/{placement_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"category": CATEGORIES[i % len(CATEGORIES)]},
            timeout=TIMEOUT,
        )
        if resp.status_code // 100 == 2:
            counts["classifications"] += 1

    return counts


def load_placements() -> list[int]:
    path = (
        Path(__file__).resolve().parents[2] / "app" / "data" / "placements_12x12.json"
    )
    data = json.loads(path.read_text())
    # Deterministic spread across the board rather than the first N rows,
    # so the /classify screen looks used rather than partially painted.
    ids = [row["placement_id"] for row in data]
    return ids[:: max(len(ids) // 40, 1)]


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------


def run(dry_run: bool) -> int:
    secret, api_base = read_env()
    print(f"Clerk key : {secret[:13]}…  (production)")
    print(f"API base  : {api_base}")
    print(f"Mode      : {'DRY RUN — nothing will be created' if dry_run else 'LIVE'}")
    print()

    results = []
    for acct in ACCOUNTS:
        print(f"[slot {acct['slot']}] {acct['email']}")

        if dry_run:
            total_logs = sum(s["count"] for s in acct["logs"])
            angles = sorted({s["angle"] for s in acct["logs"]})
            projects = acct["projects"]
            print("    would ensure Clerk user (verified email, password set)")
            print(f"    would seed ~{total_logs} climb logs across angles {angles}")
            print(
                f"    would flag {projects} "
                f"{'project' if projects == 1 else 'projects'}"
            )
            print(f"    would add {acct['classifications']} hold classifications")
            print("    would NOT create video analyses (manual)")
            results.append((acct, None))
            print()
            continue

        existing = find_clerk_user(secret, acct["email"])
        if existing:
            clerk_id = existing["id"]
            print(f"    Clerk user exists ({clerk_id}) — reusing, resetting password")
            reset_clerk_password(secret, clerk_id, acct["password"])
        else:
            created = create_clerk_user(secret, acct)
            clerk_id = created["id"]
            print(f"    Clerk user created ({clerk_id})")

        token = mint_session_token(secret, clerk_id)

        if already_seeded(api_base, token):
            print("    already has logs — skipping data seed (idempotent)")
            results.append((acct, None))
            print()
            continue

        counts = seed_account_data(api_base, token, acct)
        print(
            f"    seeded: {counts['logs']} logs, {counts['projects']} projects, "
            f"{counts['classifications']} classifications"
        )
        results.append((acct, counts))
        print()

    print_credentials_block(dry_run)
    return 0


def print_credentials_block(dry_run: bool) -> None:
    print("=" * 66)
    print("PASTE INTO App Store Connect → App Review Information")
    print("=" * 66)
    if dry_run:
        print("(dry run — accounts not created yet)")
    print()
    print("Sign-in required: Yes")
    print()
    for acct in ACCOUNTS:
        print(f"  Username: {acct['email']}")
        print(f"  Password: {acct['password']}")
        print()
    print("Notes for the reviewer:")
    print(
        "  Two accounts are provided. Account 2 is a spare: testing in-app\n"
        "  account deletion (Settings > Delete account) permanently removes\n"
        "  account 1, so please use account 2 to continue reviewing afterwards."
    )
    print(
        "  Bluetooth board control requires a physical Kilter Board and cannot\n"
        "  be exercised in review — see the attached screen recording."
    )
    print("=" * 66)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print what would be created without calling Clerk or the API",
    )
    args = parser.parse_args()
    try:
        return run(args.dry_run)
    except SeedError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 2
    except ClerkApiError as exc:
        print(f"\nERROR: Clerk API: {exc}", file=sys.stderr)
        return 3
    except httpx.HTTPError as exc:
        print(f"\nERROR: request failed: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
