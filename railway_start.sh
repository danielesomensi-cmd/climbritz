#!/bin/bash
set -e
cd backend

# B013/D014: ensure the BoardLib Kilter DB exists AND has the expected
# schema on the persistent volume. A pre-B013 deploy could have left an
# empty kilter.db at this path (sqlite3.connect auto-creates files on open),
# which would cause /api/climbs/* to return "no such table: climbs". The
# file-presence check alone is not sufficient — we also verify the `climbs`
# table exists, and re-download if not.
DB_PATH="${BOARDLIB_DB_PATH:-data/kilter.db}"

needs_download=0
if [ ! -f "$DB_PATH" ]; then
  needs_download=1
elif ! python -c "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('SELECT 1 FROM climbs LIMIT 1'); c.close()" "$DB_PATH" 2>/dev/null; then
  echo "[startup] BoardLib DB at $DB_PATH is missing 'climbs' table — removing and re-downloading."
  rm -f "$DB_PATH"
  needs_download=1
fi

if [ "$needs_download" = "1" ]; then
  echo "[startup] BoardLib DB missing at $DB_PATH — downloading from Aurora…"
  mkdir -p "$(dirname "$DB_PATH")"
  python -m boardlib database kilter "$DB_PATH"
  echo "[startup] BoardLib DB downloaded: $(du -h "$DB_PATH" | cut -f1)"
else
  echo "[startup] BoardLib DB valid at $DB_PATH — skipping download."
fi

python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
