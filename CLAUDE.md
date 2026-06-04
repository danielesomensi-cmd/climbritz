# 🧗 Claude Code Guidelines — Climbritz

> Stable reference: how to work on this repo + what the system is **now**.
> For the brief-by-brief history and current status, see `PROJECT_STATUS.md`.
> For the forward plan, see `ROADMAP_ACTIVE.md`.

## Project Overview

**Climbritz** — AI climbing companion for Kilter Board. One product, two tiers:

| Tier | Name | Value prop | Price |
|------|------|------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board control, attempt logging + history | Free |
| **Paid** | Coach | Video upload → Gemini technique analysis with climb context (Levels 1–3), move-by-move coaching | €7.99/month |

**Tech stack:**
- Frontend: Next.js 14 + TypeScript + Tailwind CSS v4 + shadcn/ui (static export, wrapped by Capacitor for iOS/Android)
- Backend: Python 3.11 + FastAPI + SQLAlchemy + Alembic (SQLite dev/prod, PostgreSQL planned)
- AI: Gemini 2.5 Flash (File API, `google.genai` SDK)
- Auth: Clerk (hosted sign-in/sign-up, JWKS-verified)
- Climb data: BoardLib (downloads the official Kilter Board SQLite DB, ~189MB, gitignored)

**Key asset — hold classification database:** every hold on the Kilter Board tagged by grip type (Jug / Good Crimp / Crimp / Sloper / Undercling / Pinch). No competitor has this. Enables grip-type filtering, session builder, problem generation, and BLE "illuminate only [type]".

**BLE (Phase 3e):** runtime path is `lib/ble/transport.ts` (wrapper over `@capacitor-community/bluetooth-le`) + `lib/ble/kilter-board-service.ts` (Kilter orchestration + UUIDs) + `lib/ble/kilter-protocol.ts` (pure packet encoder, API level 3). Web Bluetooth / Grip Connect are NOT on the runtime path — `@hangtime/grip-connect` stays in `package.json` as protocol reference only (never imported). `UnsupportedBoardError` for API level 2 boards. Protocol docs: https://github.com/1-max-1/fake_kilter_board

**Competitors:** Climbdex (free, open-source, no AI), Kilter Lookup (limited filters, no AI), kilterboard.io (official, no AI/grip-type filter). None combine AI + Kilter context + proprietary hold classification.

---

## 📦 Current State (high level)

Detailed per-brief history lives in `PROJECT_STATUS.md` (decisions log) and `ROADMAP_ACTIVE.md` (checklist). Summary:

- **Phase 1–2 ✅** — FastAPI backend, Clerk auth, video upload + Gemini File API analysis (Coach Level 1 working).
- **Phase 3a/3b ✅** — BoardLib DB integration; climb search + detail API with grade/ascents/quality/sort/moves/benchmark filters, 500-result cap + `total_count` envelope.
- **Discovery frontend ✅** — `/discover` search + filter panel, `/discover/detail` board visualization, climb logging + `/history` (calendar, pyramid, trend), per-user hold classification (`/classify`, cloud-synced).
- **BLE ✅** — `/ble-test` (LED presets) + climb illumination on `/discover/detail` (connect → illuminate, Next/Prev auto-send).
- **Mobile ✅** — Capacitor iOS + Android; Clerk **production** auth working on both platforms (custom domain `clerk.climbritz.app`, email+password). Android shipped to Play Console Internal Testing; iOS on TestFlight.
- **Coach tier** — gated behind a "Coming Soon" pill pending production readiness; `/upload` stays URL-reachable.

**Next up:** HC-3/HC-6/HC-7 hold-classification validation + DB migration, Phase 3c AI Session Builder, Phase 3d Level 2 analysis, Phase 3e remaining BLE items. See `ROADMAP_ACTIVE.md`.

---

## 🌐 API Surface (canonical reference)

Auth: protected routes accept `Authorization: Bearer <Clerk JWT>` (verified in `core/clerk.py` against the Clerk JWKS) or, in non-production only, `X-User-ID: <uuid>` as a dev/test fallback. There are no `/api/auth/*` endpoints — Clerk owns identity.

**Videos**
- `POST /api/videos/upload` → 202 (background Gemini analysis)
- `GET /api/videos/{id}` → video + status/results · `GET /api/videos` → paginated list · `DELETE /api/videos/{id}`

**Climbs** (BoardLib, read-only)
- `GET /api/climbs/search?q=&angle=&grade_min=&grade_max=&min_ascents=&min_quality=&moves=&benchmark=&sort=&limit=&done_filter=&project_filter=`
  - `moves` bucket: `any` | `le5` | `6-7` | `8-10` | `gt10`. `benchmark` (bool): climbs flagged at the selected angle (angle-specific by DB design). Animated sequences (`frames_count > 1`) excluded globally. `limit` defaults to 500, hard cap 500 (422 above). Response: `{climbs, total_count}` (total_count ignores the cap → drives the overflow banner).
  - When authenticated: also accepts `done_filter`/`project_filter` (`all`|`only`|`exclude`) and enriches each climb with `user_state` `{is_project, best_result, last_logged_at}`.
- `GET /api/climbs/{climb_uuid}?angle=` → full detail with holds · `GET /api/climbs/stats` → DB health

**Holds**
- `GET /api/holds/board-image` · `GET /api/holds/{placement_id}/image`

**Logs** (per-user climb logging)
- `POST /api/logs` → 201. Body `{climb_uuid, angle, result_type}`. Strength flash > send > attempt; same-day same-result re-tap increments `attempts_count`, stronger result upgrades. Rejects animated sequences (422). Reads `X-User-Timezone` (IANA) to resolve `local_date`, UTC fallback.
- `GET /api/logs?climb_uuid=&from=&to=&limit=` · `GET /api/logs/sessions?from=&to=` (grouped by day, enriched with climb_name + grade) · `PATCH /api/logs/{id}` · `DELETE /api/logs/{id}` → 204 (both recompute `user_climbs`)

**User-climbs**
- `GET /api/user-climbs/{climb_uuid}?angle=&recent_limit=` → `{state, recent_logs}` · `PATCH /api/user-climbs/{climb_uuid}/project` → toggle `is_project` (idempotent)

**Stats**
- `GET /api/stats/pyramid?from=&to=&result_filter=` (`flash`|`send_or_better`|`all`) → `[{grade_band, count}]`
- `GET /api/stats/trend?from=&to=` → `[{week_start, flash_count, send_count, attempt_count}]` (ISO-week)

**Classifications** (per-user hold grip-type, cloud-synced, Clerk-gated)
- `GET /api/classifications` · `PUT /api/classifications/{placement_id}` body `{category}` upsert · `DELETE /api/classifications/{placement_id}` → 204 idempotent
- `POST /api/classifications/import` body `{classifications: [{placement_id, category}, …]}` → `{total}`. Merge upsert (preserves unsent rows), cap 1000, tolerates+ignores `x`/`y`. `category` ∈ `jug | good_crimp | crimp | sloper | undercling | pinch`.

**Admin**
- `POST /api/admin/sync-db` (JWT) → runs `boardlib database kilter` · `POST /api/admin/upload-db` (ADMIN_SECRET) → upload DB to Railway volume

**Deploy:** Backend on Railway (SQLite + kilter.db auto-downloaded on first boot, persistent volume `/data/climbritz`; startup re-downloads if `SELECT 1 FROM climbs` fails, `_validate_boardlib_db()` crashes prod on invalid DB). Frontend on Vercel. Health: `GET /health`.

---

## Core Rules for Claude Development

### 📋 Code Standards
- **Language**: English for code AND rendered UI strings (climbing jargon — flash / send / attempt / project — stays untranslated). Comments + commit bodies can be Italian when natural, but never user-visible text. See `feedback_ui_english.md` in the memory store.
- **Style**: PEP 8 (Python), ESLint (TypeScript). Type hints / TS types always.
- **No secrets in code**: environment variables only.

### ✅ ALWAYS
1. Write tests for every feature — pytest (backend), Jest (frontend).
2. Test locally before push — full suite must pass.
3. Run `npm run build` before every push with frontend changes — pytest/jest do NOT catch Next.js type errors or invalid page exports; only the build does.
4. Conventional commit messages (`feat: add video upload endpoint`).
5. Push after each working feature — small, atomic commits.

### ❌ NEVER
1. Commit broken code.
2. Push credentials, API keys, or .env files.
3. Change DB schema without a new Alembic migration.
4. Skip tests.
5. Add circuit detection as a primary feature (it's Phase 4 — visual LED recognition).

### 📄 Doc Alignment Rule (Non-Negotiable)
When a change touches a fact shared across docs (model version, deploy status, repo URL, endpoint shape, etc.), **update ALL files that reference it in the same commit.** Cross-check: `README.md`, `backend/README.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `RESEARCH.md`, `ARCHITECTURE.md`.

**Hard-coded numbers (test counts, climb counts, DB size) decay fast.** Prefer descriptions ("tests" not "229 tests") unless the number is the point. If a number must appear, grep all `.md` for the old value before committing.

**Keep this changelog-free.** CLAUDE.md describes how the system works and how to work on it — not what each brief did. Narrate briefs in `PROJECT_STATUS.md`, not here.

---

## 🏗️ Project Structure

```
climbritz/
├── backend/app/
│   ├── api/            videos · climbs · holds · admin · logs · user_climbs · stats · classifications · circuits(stub)
│   ├── core/           config (prod guard on CLERK_JWKS_URL) · database · clerk (JWKS verify + shadow-row + cache) · deps (get_current_user_id / get_optional_user_id)
│   ├── models/         user (Clerk shadow row) · video · climb_log · user_climb · user_hold_classification
│   ├── schemas/        user · video · climb · logs · classifications
│   ├── services/       gemini_service · climb_service (read-only BoardLib) · log_service · classification_service · video_service · storage_service
│   ├── utils/          kilter_parser
│   └── main.py
├── backend/alembic/versions/   001 initial · 002 video_form_analysis · 003 clerk_auth · 004 a021_climb_logging · 005 user_hold_classifications
├── backend/tests/              one test_*.py per api/service + fixtures/test_kilter.db
├── backend/scripts/            regenerate_board_assets · seed_a019_test_fixtures · seed_a022_test_fixtures
├── app/ (Next.js frontend)
│   ├── page.tsx · sign-in · sign-up · login(redirect) · dashboard · upload
│   ├── discover/       page (search+filters) · detail/page (board + BLE + Next/Prev) · detail/climb-to-leds · filtered-list-storage · discover-filters-storage
│   ├── history/        page · calendar · sessions-list · grade-pyramid · trend-chart
│   ├── classify/       page (cloud-synced) · state · ble-test/ (presets · board-preview · use-kilter-ble)
│   ├── board-map · videos/detail · privacy · debug
│   ├── lib/            api.ts (Clerk JWT per call, 401-retry-once) · clerk.d.ts · grades.ts · ble/(kilter-protocol · kilter-board-service · transport · status)
│   ├── data/           placements_12x12.json + leds_12x12.json (generated by backend/scripts/regenerate_board_assets.py)
│   └── layout.tsx (next/font: Space Grotesk + Inter Tight, self-hosted) · globals.css (Tailwind v4 + B033 `@theme static` design tokens) · safe-area.css (.pt-safe/.pb-safe/.pb-nav)
├── components/         BoardMap · ClimbBoardView · ClimbCard · StateIcons · LogSection · RecentLogs · FilterPanel · GradeDisplay · StarRating · BottomNav · ClimbBleControls · ClerkSpaProvider · AuthGuard · AuthShell
│   └── ui/             B033 design-system primitives: Button · Chip · Card · PageHeader · EmptyState · LoadingState · StatusDot (no ComingSoonBadge — dropped)
├── capacitor.config.ts · android/ · ios/
├── CLAUDE.md (this) · PROJECT_STATUS.md (decisions log) · ROADMAP_ACTIVE.md (plan) · ARCHITECTURE.md · RESEARCH.md · README.md
└── docs/               CLERK_CAPACITOR_AUTH.md · IOS_DEPLOY_RUNBOOK.md · DISCOVERY_DESIGN.md · lessons.md · archive/
```

Legacy redirect pages (`discover/[climb_uuid]/`, `videos/[id]/`) exist for Capacitor compat → query-param routes.

---

## 🔧 Useful Commands

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8001
pytest                 # all tests   ·   pytest --cov   ·   alembic upgrade head

# Frontend
npm run dev   ·   npm test   ·   npm run build   ·   npm run lint

# Mobile (Capacitor) — NEXT_PUBLIC_MOBILE=true is mandatory
npm run build:mobile   # static export to out/
npm run sync:ios | sync:android | open:ios | open:android
```

---

## 📱 Capacitor Compatibility Rules (Non-Negotiable)

The app ships via `next build` with `output: 'export'`. Every frontend change MUST follow these:

1. **NO dynamic routes (`[param]`)** for Capacitor pages — use query params (`/discover/detail?id=xxx`). Dynamic segments produce a `_.html` fallback the WebView can't resolve.
2. **Plain `<img>`, never `next/image`** — the optimizer doesn't exist in static export; images silently fail.
3. **API base URL hardcoded to Railway in mobile builds.** When `NEXT_PUBLIC_MOBILE=true`, `app/lib/api.ts` ignores `NEXT_PUBLIC_API_URL` (else a dev `localhost:8001` leaks into the APK). To target a non-prod backend, edit `app/lib/api.ts`.
4. **CORS must include `https://localhost`** (Android WebView origin), `capacitor://localhost` (iOS), `http://localhost` (dev). Production WebView origin is `https://app.climbritz.app` (Android) / `capacitor://app.climbritz.app` (iOS) — see `docs/CLERK_CAPACITOR_AUTH.md`.
5. **All navigation must be SPA** — no server-side / middleware redirects. Use `router.push()` or `<Link>`.
6. **No Next.js API routes (`app/api/`)** — all calls go to the FastAPI backend.
7. **Test every new page in the Capacitor build**, not just the browser (`npm run build:mobile && npm run sync:android` / `sync:ios`).
8. **Capacitor builds require `NEXT_PUBLIC_MOBILE=true`** — without it `next build` produces `.next/` not `out/`, and `cap sync` silently copies nothing.

---

## 🧪 Testing Requirements
- **Backend:** pytest, >80% coverage on new code. **Frontend:** Jest + React Testing Library.
- **Every commit must leave BOTH suites green** — no exceptions, not even pre-existing failures. Find red tests → fix them this session.
- **CI** (`.github/workflows/test.yml`): backend pytest + frontend jest + tsc + next build on every push/PR. Red CI is a blocker.
- **Pre-commit hook** (optional): `ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit` — bypass with `SKIP_TESTS=1` only when strictly needed.
- **Pre-push hook** (active): runs `npm run build` — aborts on build failure (last line of defence against broken Vercel deploys).

---

## 🎬 Development Flow
1. Receive task → understand scope.
2. Plan → files to change + dependencies.
3. Code → implement + tests.
4. Verify → run the FULL suites (`pytest` + `npx jest` + `npx tsc --noEmit`). Any red test, including untouched ones, gets fixed now.
5. Commit → clear message (hooks re-run suites).
6. Push → confirm success; keep GitHub Actions green.
7. **Doc Sync (MANDATORY)** → update affected docs in the same turn: `ROADMAP_ACTIVE.md` (✅/[x]), `PROJECT_STATUS.md` (date + status), `ARCHITECTURE.md`, `README.md`/`backend/README.md`. Commit as `docs: sync after {brief_id}`. **Not optional — do it without being asked.**

---

## High-Risk Modules — STOP Gate Required

These require **Phase 0 audit (read affected files, list call sites) → STOP → explicit OK** before any change:

| File | Why |
|------|-----|
| `backend/app/services/gemini_service.py` | AI pipeline — broken = no analysis |
| `backend/app/core/clerk.py` | Clerk JWT verification — broken = no auth |
| `backend/app/core/deps.py` | Dependency injection — affects all endpoints |
| `backend/app/api/videos.py` | Video pipeline — broken = core feature down |
| `alembic/versions/*.py` | Schema migrations — wrong = data loss |

Read first, print analysis, wait for OK, then implement.

---

**Owner:** Daniele Somensi + Claude Code
