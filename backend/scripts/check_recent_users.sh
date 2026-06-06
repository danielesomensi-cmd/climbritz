#!/usr/bin/env bash
#
# Check who recently signed up (iOS / Android) and what they've done in-app.
# Hits the LIVE prod backend GET /api/admin/recent-users (Clerk identity +
# device + our DB activity).
#
#   Usage:
#     ./backend/scripts/check_recent_users.sh            # last 10 users
#     ./backend/scripts/check_recent_users.sh 25         # last 25 (max 50)
#
# The ADMIN_SECRET is read from (in order): the ADMIN_SECRET env var, then
# backend/.env (gitignored). It is NEVER printed. Mirror of the Railway
# service variable ADMIN_SECRET. See docs/ADMIN_RUNBOOK.md for field meanings.

set -euo pipefail

LIMIT="${1:-10}"
BASE_URL="https://web-production-cea9.up.railway.app"

# Resolve ADMIN_SECRET: env var wins, else read from backend/.env.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -z "${ADMIN_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
  ADMIN_SECRET="$(grep -E '^ADMIN_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi
if [ -z "${ADMIN_SECRET:-}" ]; then
  echo "ERROR: ADMIN_SECRET not set (export it, or add it to backend/.env)." >&2
  exit 1
fi

curl -s -H "X-Admin-Secret: $ADMIN_SECRET" \
  "$BASE_URL/api/admin/recent-users?limit=$LIMIT" \
  | python3 -m json.tool
