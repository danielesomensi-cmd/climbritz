#!/bin/bash
set -e
cd backend

# B013: ensure the BoardLib Kilter DB exists on the persistent volume.
# boardlib downloads ~189MB on first run; on subsequent deploys the file
# already exists and we skip the download entirely.
DB_PATH="${BOARDLIB_DB_PATH:-data/kilter.db}"
if [ ! -f "$DB_PATH" ]; then
  echo "[startup] BoardLib DB missing at $DB_PATH — downloading from Aurora…"
  mkdir -p "$(dirname "$DB_PATH")"
  python -m boardlib database kilter "$DB_PATH"
  echo "[startup] BoardLib DB downloaded: $(du -h "$DB_PATH" | cut -f1)"
else
  echo "[startup] BoardLib DB already present at $DB_PATH — skipping download."
fi

python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
