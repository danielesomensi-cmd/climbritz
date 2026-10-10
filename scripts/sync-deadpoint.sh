#!/usr/bin/env bash
# ARCADE-001 — vendor the Deadpoint mini-game into the app as a static file.
#
# Builds the Deadpoint repo (Vite → one self-contained dist/index.html, JS+CSS
# inlined, base './') and copies it to public/arcade/deadpoint.html, which
# /arcade loads in an iframe (?lang=en&embed=1). public/ is copied verbatim by
# `next build` (web) and by the static export (out/arcade/ → Capacitor), so the
# game ships inside the app bundle: no remote code, works offline.
#
# Usage: scripts/sync-deadpoint.sh [path-to-deadpoint-repo]   (default ~/Projects/deadpoint)
set -euo pipefail

SRC="${1:-$HOME/Projects/deadpoint}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/public/arcade"

if [ ! -f "$SRC/package.json" ] || ! git -C "$SRC" rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: $SRC is not the Deadpoint repo" >&2
  exit 1
fi

echo "Building Deadpoint in $SRC ..."
(cd "$SRC" && { [ -d node_modules ] || npm ci; } && npm run build)

mkdir -p "$DEST"
cp "$SRC/dist/index.html" "$DEST/deadpoint.html"

SHA="$(git -C "$SRC" rev-parse HEAD)"
DIRTY=""
if [ -n "$(git -C "$SRC" status --porcelain --untracked-files=no)" ]; then
  DIRTY="-dirty"
  echo "warning: $SRC has uncommitted changes; VERSION is marked -dirty" >&2
fi
{
  echo "deadpoint ${SHA}${DIRTY}"
  echo "commit-date $(git -C "$SRC" show -s --format=%cI HEAD)"
  echo "synced $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$DEST/VERSION"

SIZE="$(wc -c < "$DEST/deadpoint.html" | tr -d ' ')"
echo "Vendored public/arcade/deadpoint.html (${SIZE} bytes) from ${SHA:0:7}${DIRTY}"
