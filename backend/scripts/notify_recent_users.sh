#!/usr/bin/env bash
#
# On-request: push a compact summary of recent sign-ups to Telegram.
# Hits the LIVE prod backend POST /api/admin/notify-recent-users.
#
#   Usage:
#     ./backend/scripts/notify_recent_users.sh          # last 10 users
#     ./backend/scripts/notify_recent_users.sh 25       # last 25 (max 50)
#
# Requires Telegram to be configured on the server (TELEGRAM_BOT_TOKEN +
# TELEGRAM_CHAT_ID Railway variables). ADMIN_SECRET is read from the
# ADMIN_SECRET env var, else backend/.env (gitignored). Never printed.

set -euo pipefail

LIMIT="${1:-10}"
BASE_URL="https://web-production-cea9.up.railway.app"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -z "${ADMIN_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
  ADMIN_SECRET="$(grep -E '^ADMIN_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi
if [ -z "${ADMIN_SECRET:-}" ]; then
  echo "ERROR: ADMIN_SECRET not set (export it, or add it to backend/.env)." >&2
  exit 1
fi

curl -s -X POST -H "X-Admin-Secret: $ADMIN_SECRET" \
  "$BASE_URL/api/admin/notify-recent-users?limit=$LIMIT" \
  | python3 -m json.tool
