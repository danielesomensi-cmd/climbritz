
---
### Archived 2026-04-10

## Completed

### Phase 1 — Foundation ✅
- FastAPI backend with JWT auth
- SQLite (dev) / PostgreSQL (prod) ready
- Alembic migrations

### Phase 2 — Video Upload + Basic Analysis ✅
- Video upload endpoint (POST /api/videos/upload)
- Gemini 2.5 Flash via google.genai SDK (NOT frame-by-frame)
- Async processing with BackgroundTasks
- Frontend: drag-drop upload, progress bar, mobile-first

### B001–B005 — Cleanup & Migrations ✅
- Codebase rationalization, docs, SDK migration, settings migration
- 161 backend + 91 frontend tests passing (snapshot at B005 completion)
- Backend live on Railway, frontend on Vercel

### B007 — Kilter Board Prompt Rework ✅
- Board detection (non-Kilter videos return error)
- 5 scores: technique, body_tension, footwork, hip_positioning, power_management
- `improvements[]` with issue + fix + drill per item (max 3)
- Calibration guidance (8+ = strong, 9-10 = near-professional)
- Tested on 4 real Kilter Board videos
- See `backend/docs/PROMPT_AUDIT.md`

### B008 — Kilter Board Completion Rules ✅
- Added `KILTER BOARD COMPLETION RULES` section to prompt
- Defines start, send (match on purple/magenta), controlled dismount, and fall
- Fixes Gemini misinterpreting post-match dismount as a fall

---


### Prompt & Output Refinement (D001 → B007 → B008) ✅
- [x] Audit current Gemini prompt in `gemini_service.py` — D001-mini → PROMPT_AUDIT.md
- [x] Define compact structured JSON output schema — B007
- [x] Dual grading: removed AI estimation entirely (comes from DB in Level 2) — B007
- [x] Test with real climbing videos — 4 videos tested in B007
- [x] STOP gate: B007 reviewed and merged; B008 completion rules added
- [x] Kilter Board completion rules (match = send, dismount ≠ fall) — B008


### 3a — BoardLib Database Setup (1 week) (✅ Complete)
- [x] Add `boardlib` to requirements.txt
- [x] Script to download/sync Kilter Board SQLite DB (`backend/data/kilter.db`)
- [x] Add `backend/data/` to .gitignore
- [x] Explore DB schema: climbs, placements, holes, leds tables
- [x] Document available fields and data quality
- [x] Extract Instagram video links from DB — store as viewable links (not downloaded)
- [x] Management command: `python -m scripts.sync_kilter_db`


### A011 — Discovery Frontend (✅ Complete, 8 April 2026)
- [x] `/discover` page: angle selector, search input (300ms debounce),
      filter panel (grade range, min ascents, min stars, sort)
- [x] Filter state mirrored in URL params (shareable)
- [x] Grip-type chips wired but disabled — enable once HC-6 lands
- [x] `/discover/[climb_uuid]` page: title block, board visualization
      (reuses BoardMap with role colors), role legend, other-angles
      links, action bar (Favorite/Coach/BLE — Coach is live, others stub)
- [x] BottomNav (Home / Discover / Coach / Profile) — added across app
- [x] 42 new frontend tests — total 91 frontend, 161 backend
- [x] Backend filter extension (grade_min/max, min_ascents, min_quality, sort)


### B012 — Browse-by-Filter (✅ Complete, 8 April 2026)
- [x] Backend `q` is now optional — omit for pure browse-by-filter mode
- [x] Frontend fetches on mount; "Start typing…" empty state removed
- [x] 4 new backend tests + 2 updated frontend tests


### B013 — Deploy kilter.db to Railway (✅ Complete, 8 April 2026)
- [x] `backend/railway.toml` startCommand downloads kilter.db via
      `boardlib database kilter` on first boot if `$BOARDLIB_DB_PATH` missing
- [x] `POST /api/admin/sync-db` — JWT-protected manual re-sync endpoint
- [x] 5 new backend tests (auth, success, subprocess failure, timeout)
- [x] Requires Railway env var `BOARDLIB_DB_PATH=/data/kilter-up/kilter.db`


### D014 — Poisoned kilter.db on Railway (✅ Complete, 8 April 2026)
- [x] Root cause: pre-B013 deploy left an empty SQLite file at
      `/data/kilter-up/kilter.db` (sqlite3.connect auto-creates on open).
      B013's `[ ! -f ]` check then skipped the download → `no such table: climbs`.
- [x] Startup scripts now also probe `SELECT 1 FROM climbs LIMIT 1` and
      `rm -f` + re-download if the table is missing
- [x] `app/main.py::_validate_boardlib_db()` fails startup in production
      when the BoardLib DB is missing or invalid; warns-only in dev/test
- [x] 5 new backend tests for the validation helper (total 176 backend)


### B016 — Board Visualization Fixes (✅ Complete, 9 April 2026)
- [x] `HoldPosition.set_id` plumbed from BoardLib DB → schema → climb_service → API → frontend types
- [x] Active holds render as hollow colored rings (transparent fill + thick border + glow) so the physical hold photo stays visible
- [x] Screw-on footholds (`set_id=20`) drawn ~half the size of bolt-on handholds (`set_id=1`), matching the real board
- [x] Board bounds extended from y∈[12,156] to y∈[0,156] to include the kickboard row
- [x] `backend/scripts/regenerate_board_assets.py` — reproducible dump of `placements_12x12.json` (514 placements = 361 bolt + 153 screw) and composite `board_original_12x12.png`
- [x] 1 new backend test + 2 new frontend tests (total 177 backend, 92 frontend)


### B010 — Homepage Redesign + Play Store Release Build (✅ Complete, 10 April 2026)
- [x] Homepage rewritten: 4-tile hub (Demo LED, Discover, Classify, Video Analysis with lock icon)
- [x] Privacy policy page at `/privacy` (required for Play Store)
- [x] Gradle signing config from `keystore.properties` (gitignored), versionName `0.1.0`
- [x] Signed AAB + APK built for Play Store upload
- [x] Keystore credentials saved to `~/kilter-up-credentials.txt`


### Capacitor Mobile Fixes (✅ Complete, 10 April 2026)
- [x] API base URL uses `NEXT_PUBLIC_MOBILE` to switch to Railway in mobile builds
- [x] Board preview image: plain `<img>` instead of `next/image` (broken in static export)
- [x] Back buttons added to `/ble-test` and `/classify`
- [x] CORS: `https://localhost` added to allowed origins (Capacitor Android WebView origin)
- [x] Dynamic routes replaced with query-param routes (`/discover/detail?id=`, `/videos/detail?id=`) — dynamic `[param]` segments don't work in Capacitor static export
- [x] Network security config + `usesCleartextTraffic` for Android
- [x] `/debug` diagnostic page for network troubleshooting
- [x] Capacitor Compatibility Rules documented in CLAUDE.md (8 rules)
- [x] Temporary `POST /api/admin/upload-db` endpoint for volume uploads


