# 🧗 Claude Code Guidelines - Kilter-Up App

## Project Overview
**Kilter-Up** — AI-powered climbing form analysis app.

**Core Value Proposition:**
- Upload a climbing video → Gemini File API analyzes your form → get structured coaching feedback
- NOT a circuit recognition app. Form analysis is the core.

**Primary Tech Stack:**
- Frontend: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Python 3.11 + FastAPI + PostgreSQL + SQLAlchemy + Alembic
- AI: Gemini Vision API (form analysis)
- Circuit recognition: BoardLib API (supplementary only)
- Storage: Local filesystem (dev) → S3 (prod, week 3)

## 🎯 CORE STRATEGY (Non-Negotiable)

**One product, two tiers:**

| Tier | Name | Value prop | Price |
|------|------|------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging | Free |
| **Paid** | Coach | Video upload → Gemini AI technique analysis with climb context (Levels 1–3), move-by-move coaching | €7.99/month |

**Key asset — hold classification database:**
Every hold on the Kilter Board tagged by grip type: Jug / Good Crimp / Crimp / Sloper / Undercling / Pinch. No competitor has this. Enables grip-type filtering, session builder, problem generation, and BLE "illuminate only [type]" feature.

**BLE is in scope** (Phase 3e): Capacitor wraps Next.js → native iOS/Android app. BLE runtime path is `lib/ble/transport.ts` (thin wrapper over `@capacitor-community/bluetooth-le`) + `lib/ble/kilter-board-service.ts` (Kilter-specific orchestration + UUIDs) + `lib/ble/kilter-protocol.ts` (pure packet encoder, API level 3). Web Bluetooth / Grip Connect are NOT on the runtime path — `@hangtime/grip-connect` stays in `package.json` as protocol reference only (never imported). `UnsupportedBoardError` is thrown for API level 2 boards (no `@` or `@2` in device name). Protocol docs: https://github.com/1-max-1/fake_kilter_board

**Discovery competitors:** Climbdex (free, open-source, no AI), Kilter Lookup (limited filters, no AI), kilterboard.io (official new Kilter app, no AI, no grip-type filter).

**Coach — Gemini Vision analyzes:**
- Hold positions and quality
- Body tension and posture
- Efficiency score
- Specific weaknesses (e.g., "weak on sloper finish")
- Grade estimate

---

## 📦 Current State (B014-iter-2 Complete — 23 April 2026)

✅ **Phase 1:** FastAPI backend, JWT auth, User model, Alembic migrations
✅ **Phase 2:** Video upload + Gemini File API analysis (consolidated pipeline)
✅ **B001:** Codebase rationalization — single endpoint set, clean migrations, all tests green
✅ **B007:** Kilter Board-specific prompt rework — board detection, 5 scores, drills per issue
✅ **B008:** Kilter Board completion rules added to prompt — match on finish hold = send, post-match drop = dismount not fall
✅ **D010:** Backend pytest CI fix — env vars added to GitHub Actions workflow
✅ **Phase 3a:** BoardLib DB setup — climb_service.py, test fixture DB
✅ **Phase 3b:** Climb search + detail API (extended in A011 with grade/ascents/quality/sort filters)
✅ **A011:** Discovery frontend — `/discover` (search + filter panel) + `/discover/detail?id=` (board visualization with role colors). BottomNav added.
✅ **HC-2:** 12x12 board map (composite background, annotated, mobile-friendly)
✅ **HC-5:** Hold classification UI (`/classify` — mobile, board map per hold, manual classification flow)
✅ **B013:** Auto-provision BoardLib kilter.db on Railway first boot
✅ **D014:** Railway DB startup validation — probe `SELECT 1 FROM climbs` + `_validate_boardlib_db()`
✅ **B016:** Board visualization fixes — hollow rings for active holds, screw-on footholds sized smaller, kickboard row included (y∈[0,156]), HoldPosition.set_id plumbed through backend → frontend
✅ **A006:** BLE LED test — Capacitor Android project, `/ble-test` page with 10 LED presets sourced from `leds` table (layout_id=1), `use-kilter-ble` hook over Capacitor BLE
✅ **B009:** Visual board preview on `/ble-test` — board image + colored circles at correct hold positions, pre-computed from product_size_id=10 coordinates
✅ **B010:** Homepage redesign (4-tile hub) + Play Store release build (signed AAB/APK) + privacy policy + Capacitor mobile fixes (CORS, dynamic routes → query params, board image, back buttons, network security)
✅ **B011:** Fix Android manifest BLE permissions — bounded ACCESS_FINE/COARSE_LOCATION to maxSdkVersion=30, no spurious location prompt on Android 12+
✅ **B012:** BLE LED packet transmission — pure encoder (`kilter-protocol.ts`), `sendLEDPreset`/`sendAllOff` in service, "Illumina board" button + error banner in `/ble-test`, API level 3 only
✅ **A016:** iOS Capacitor setup — `@capacitor/ios ^8.3.1`, `ios/` Xcode project initialized (SPM-based, no CocoaPods), `NSBluetoothAlwaysUsageDescription` in Info.plist, `build:mobile` split into platform-agnostic build + `sync:ios`/`sync:android`/`open:ios`/`open:android`, first device build running on iPhone 15 (iOS 26.2) via personal Apple Developer account
✅ **B014:** BLE LED test UX polish — auto-apply on preset tap with 200ms debounce, BLE writes serialized via hook-level promise chain (no chunk interleave), Connetti/Disconnetti enlarged to card-sized buttons, creative presets #6-#10 authored on the 17×18 main-hold grid via new `grid(col,row)` helper
✅ **B014-iter:** Preset visual fixes after gym validation — climber redrawn with asymmetric reaching pose (replacing T-pose "crucifix"), heart stripped of white shine (uniform red outline + magenta fill), lightning extended to near-full-board-height zigzag (rows 2-17), smile enlarged to 11×11 rounded circle with unambiguous eyes + U-shape smile
✅ **B014-iter-2:** Art presets overhaul — replaced diagnostic presets #1-#5 with pixel art (Space Invader green, Ghost Blinky red + white/cyan eyes, Zelda Heart mono-red 8-bit, yellow 5-point Star, orange-centre + yellow-rays Sun) and added preset #11 All LEDs Diagnostic (stress test lighting all 476 positions in y-banded rainbow stripes, col-span-2 in the grid with amber accent)

**Video API surface:**
- `POST /api/videos/upload` → 202 (background Gemini analysis)
- `GET /api/videos/{id}` → video + status/results
- `GET /api/videos` → paginated list
- `DELETE /api/videos/{id}` → delete

**Climb API surface (Phase 3b + A011):**
- `GET /api/climbs/search?q=&angle=&grade_min=&grade_max=&min_ascents=&min_quality=&sort=` → search with filters
- `GET /api/climbs/{climb_uuid}?angle={angle}` → full detail with holds
- `GET /api/climbs/stats` → DB health stats

**Holds API surface (HC-5):**
- `GET /api/holds/board-image` → full board composite image
- `GET /api/holds/{placement_id}/image` → individual hold image

**Admin API surface (B013):**
- `POST /api/admin/sync-db` → JWT-protected, runs `boardlib database kilter` to download/sync the BoardLib DB
- `POST /api/admin/upload-db` → upload BoardLib DB to Railway volume (temporary, ADMIN_SECRET-protected)

**Deploy:** Backend live on Railway (SQLite). Frontend on Vercel. Health check at `/health`. B013: kilter.db auto-downloads via boardlib on first boot when `$BOARDLIB_DB_PATH` is missing (persistent volume at `/data/kilter-up`). D014: startup scripts also probe `SELECT 1 FROM climbs` and re-download if an empty file was left behind; `_validate_boardlib_db()` crashes the container in production if the DB is still invalid.

**Next:** B014-iter-2 gym validation (art presets + #11 stress test on real board), then HC-3 taxonomy validation (Daniele + Christie), HC-6 manual classification, HC-7 DB migration, Phase 3c AI Session Builder, Phase 3d Level 2 Enhanced Analysis, Phase 3e BLE climb lighting (illuminate by climb_id)

**Gemini:** google.genai SDK, model gemini-2.5-flash, Kilter Board-specific prompt (B007+B008), JSON repair + Pydantic validation

---

## Core Rules for Claude Development

### 📋 Code Standards
- **Language**: English for code, Italian for comments when needed
- **Style**: Follow PEP 8 (Python), ESLint (TypeScript)
- **No secrets in code**: Use environment variables for API keys
- **Type safety**: Always use TypeScript types, Python type hints

### ✅ ALWAYS Do This
1. **Write tests for every feature** — pytest (backend), Jest (frontend)
2. **Test locally before push** — full suite must pass
3. **Run `npm run build` before every push that includes frontend changes** — pytest and jest alone do NOT catch Next.js type errors or invalid page exports; only `npm run build` does
4. **Commit with clear messages**: `feat: add video upload endpoint`
5. **Push after each working feature** — small, atomic commits
6. **Document complex logic** — docstrings for functions

### ❌ NEVER Do This
1. Commit broken code
2. Push credentials, API keys, or .env files
3. Change database schema without creating a new Alembic migration
4. Skip tests
5. Add circuit detection as a primary feature (it's Phase 4 — visual LED recognition)

### 📄 Doc Alignment Rule (Non-Negotiable)
When a change touches facts shared across docs (model version, test count, deploy status, repo URL, DB size, etc.), **update ALL files that reference that fact in the same commit.** Don't leave stale data behind.

Files to cross-check on every factual change:
- `README.md` (root) — tech stack, deploy status, repo URL
- `backend/README.md` — dependencies, model version
- `CLAUDE.md` — project structure, test references
- `PROJECT_STATUS.md` — stato attuale, credenziali, contatori
- `RESEARCH.md` — ecosystem data (DB size, LED colors, etc.)
- `ARCHITECTURE.md` — stack diagram, deployment topology

**Hard-coded numbers (test counts, climb counts, DB size) decay fast.** Prefer descriptions ("tests" not "46 tests") unless the number is the point. When a number must appear, grep all .md files for the old value before committing.

---

## 🏗️ Project Structure

```
kilter-training-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py             ✅ JWT auth (register, login, /me)
│   │   │   ├── videos.py           ✅ Upload, list, get, delete
│   │   │   ├── climbs.py           ✅ Search, detail, stats (Phase 3b)
│   │   │   ├── holds.py            ✅ Board image + hold images (HC-5)
│   │   │   ├── admin.py            ✅ Protected: sync-db + upload-db (B013)
│   │   │   └── circuits.py         ✅ Stub (legacy)
│   │   ├── core/
│   │   │   ├── config.py           ✅
│   │   │   ├── database.py         ✅
│   │   │   ├── security.py         ✅
│   │   │   └── deps.py             ✅
│   │   ├── models/
│   │   │   ├── user.py             ✅
│   │   │   └── video.py            ✅
│   │   ├── schemas/
│   │   │   ├── user.py             ✅
│   │   │   ├── auth.py             ✅
│   │   │   ├── video.py            ✅ VideoResponse, FormFeedbackResponse
│   │   │   └── climb.py            ✅ ClimbSearchResult, ClimbDetail
│   │   ├── services/
│   │   │   ├── auth_service.py     ✅
│   │   │   ├── gemini_service.py   ✅ File API (lazy init, Kilter Board prompt)
│   │   │   ├── climb_service.py    ✅ Read-only BoardLib DB queries
│   │   │   ├── video_service.py    ✅ ffmpeg utils
│   │   │   └── storage_service.py  ✅ Local filesystem
│   │   ├── utils/
│   │   │   └── kilter_parser.py    ✅ Layout parser
│   │   └── main.py                 ✅
│   ├── alembic/versions/
│   │   ├── 001_initial_migration.py ✅
│   │   └── 002_video_form_analysis.py ✅
│   ├── tests/
│   │   ├── test_videos.py          ✅ video + gemini tests
│   │   ├── test_climb_service.py   ✅ climb service tests
│   │   ├── test_climbs_api.py      ✅ climb API tests
│   │   ├── test_holds_api.py       ✅ holds API tests
│   │   ├── test_admin_api.py       ✅ admin sync-db tests (B013)
│   │   ├── test_startup_validation.py ✅ D014 boardlib DB checks
│   │   ├── test_kilter_parser.py   ✅
│   │   └── fixtures/test_kilter.db ✅ test fixture DB
│   ├── scripts/
│   │   └── regenerate_board_assets.py ✅ B016 — dumps placements_12x12.json + composite board PNG
│   ├── conftest.py                 ✅
│   └── requirements.txt
├── app/ (Next.js 14 frontend)
│   ├── page.tsx                    ✅ Homepage
│   ├── upload/page.tsx             ✅ Drag-drop upload (Coach)
│   ├── login/page.tsx              ✅
│   ├── dashboard/page.tsx          ✅
│   ├── videos/detail/page.tsx       ✅ Video detail ?id= (query-param route for Capacitor)
│   ├── videos/[id]/page.tsx        ✅ Legacy redirect → /videos/detail?id=
│   ├── classify/page.tsx           ✅ Hold classification UI (HC-5)
│   ├── classify/state.ts           ✅ Classification state management
│   ├── classify/__tests__/         ✅ Classification tests
│   ├── board-map/page.tsx          ✅ Annotated 12x12 board map (HC-2)
│   ├── discover/page.tsx           ✅ Discovery: search + filters (A011)
│   ├── discover/detail/page.tsx    ✅ Climb detail ?id=&angle= (query-param route for Capacitor)
│   ├── discover/[climb_uuid]/page.tsx ✅ Legacy redirect → /discover/detail?id=
│   ├── discover/__tests__/         ✅ Discovery tests
│   ├── ble-test/page.tsx           ✅ BLE LED test page — 10 presets + board preview (A006/B009/B014 auto-apply)
│   ├── ble-test/presets.ts         ✅ LED preset data — 10 pixel-art presets + #11 all-LEDs stress test (B014-iter-2)
│   ├── ble-test/board-preview.tsx  ✅ Board image + colored circles overlay (B009)
│   ├── ble-test/use-kilter-ble.ts  ✅ KilterBoard hook — connect/send/disconnect + write serialization (B012/B014)
│   ├── ble-test/__tests__/         ✅ Preset structure + auto-apply debounce tests (B014)
│   ├── privacy/page.tsx            ✅ Privacy policy (Play Store requirement, B010)
│   ├── debug/page.tsx              ✅ Network diagnostics (dev tool, B010)
│   ├── data/                       ✅ Frontend data files
│   ├── lib/api.ts                  ✅ Fetch wrapper + climb/video/auth APIs
│   ├── lib/grades.ts               ✅ Difficulty → Font/V grade mapping (A011)
│   ├── lib/ble/kilter-protocol.ts  ✅ Pure packet encoder — API level 3 (B012)
│   ├── lib/ble/kilter-board-service.ts ✅ Kilter-specific BLE orchestration (B012)
│   ├── lib/ble/transport.ts        ✅ Generic Capacitor BLE wrapper (B012: +writeWithoutResponse)
│   └── lib/ble/__tests__/kilter-protocol.test.ts ✅ Encoder unit tests (B012)
├── components/
│   ├── BoardMap.tsx                ✅ 12x12 board canvas (HC-2)
│   ├── ClimbBoardView.tsx          ✅ Climb detail board wrapper (A011)
│   ├── ClimbCard.tsx               ✅ Search result card (A011)
│   ├── FilterPanel.tsx             ✅ Discovery filters (A011)
│   ├── GradeDisplay.tsx            ✅ Font/V grade display (A011)
│   ├── StarRating.tsx              ✅ 5-star widget (A011)
│   ├── BottomNav.tsx               ✅ App bottom navigation (A011)
│   ├── AuthGuard.tsx               ✅
│   └── __tests__/                  ✅ Component tests
├── capacitor.config.ts             ✅ Capacitor config (appId=com.kilterup.app, webDir=out)
├── android/                        ✅ Capacitor Android project (A006)
├── ios/                            ✅ Capacitor iOS Xcode project — SPM-based, Info.plist has NSBluetoothAlwaysUsageDescription (A016)
├── CLAUDE.md                       ✅ This file
├── PROJECT_STATUS.md               ✅ Decisions log
├── ROADMAP_ACTIVE.md               ✅ Phase plan
└── RESEARCH.md                     ✅ Ecosystem audit
```

---

## 🔧 Useful Commands

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
pytest                    # Run all tests
pytest --cov             # Coverage report
alembic upgrade head     # Apply migrations

# Frontend
npm run dev
npm test
npm run build
npm run lint

# Mobile (Capacitor)
npm run build:mobile      # NEXT_PUBLIC_MOBILE=true next build (static export to out/)
npm run sync:android      # npx cap sync android
npm run sync:ios          # npx cap sync ios
npm run open:android      # open Android Studio
npm run open:ios          # open Xcode workspace

# Git
git status && git diff
git add . && git commit -m "feat: description"
git push origin main
```

---

## 📱 Capacitor Compatibility Rules (Non-Negotiable)

The app ships as a Capacitor Android APK + iOS app via `next build` with `output: 'export'`. These rules **MUST** be followed for every frontend change:

1. **NO dynamic routes (`[param]`)** for pages that must work in Capacitor. Use query params instead: `/discover/detail?id=xxx` not `/discover/[id]`. Dynamic route segments produce a single `_.html` fallback that Capacitor's WebView cannot resolve for arbitrary paths.
2. **Use plain `<img>` tags, NOT `next/image` `Image` component.** The Next.js image optimizer doesn't exist in static export — images silently fail to load.
3. **API base URL must use `NEXT_PUBLIC_MOBILE` env var** to switch between `localhost` (dev) and Railway (prod). See `app/lib/api.ts`.
4. **CORS on backend must include `https://localhost`** — Capacitor Android WebView sends `Origin: https://localhost`. Also allow `capacitor://localhost` (iOS) and `http://localhost` (dev).
5. **All navigation must work as SPA** — no server-side redirects, no middleware redirects. Use `router.push()` or `<Link>`.
6. **No Next.js API routes (`app/api/`)** — all API calls go to the FastAPI backend.
7. **Test every new page in Capacitor build**, not just browser. Run `npm run build:mobile && npm run sync:android` (and `sync:ios` when iOS-relevant) and verify in the device build.
8. **Use `localStorage` for auth tokens**, not cookies. Cookies may not work reliably in WebView.
9. **Capacitor builds require `NEXT_PUBLIC_MOBILE=true`** — without it, `next build` produces a server build (`.next/`) instead of a static export (`out/`), and `npx cap sync android` silently fails to copy assets.

---

## 🧪 Testing Requirements
- **Backend:** pytest, >80% coverage on new code
- **Frontend:** Jest + React Testing Library
- **Every commit must leave BOTH suites green** — no exceptions, not even pre-existing failures. If you find red tests, fix them in the same session before moving on.
- **CI:** `.github/workflows/test.yml` runs backend pytest + frontend jest + tsc + next build on every push/PR. A red CI is a blocker.
- **Local pre-commit hook** (optional but recommended): `ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit` — blocks commits with red tests. Bypass only when strictly needed with `SKIP_TESTS=1 git commit ...`.
- **Local pre-push hook** (active): `.git/hooks/pre-push` runs `npm run build` before every push — aborts if the build fails. This is the last line of defence against broken Vercel deploys.

---

## 🎬 Development Flow
1. **Receive task** → Understand scope
2. **Plan** → Files to change + dependencies
3. **Code** → Implement + tests
4. **Verify** → Run the FULL suites, not just touched areas:
   - Backend: `cd backend && source venv/bin/activate && pytest`
   - Frontend: `npx jest` + `npx tsc --noEmit`
   - Any red test — including ones you didn't touch — must be diagnosed and fixed now, not logged as "pre-existing".
5. **Commit** → Clear message (pre-commit hook will re-run the suites)
6. **Push** → Confirm push succeeded; check the GitHub Actions run stays green
7. **Doc Sync (MANDATORY)** → After every push, update ALL affected docs:
   - `ROADMAP_ACTIVE.md` — mark completed tasks with ✅, update [ ] → [x]
   - `PROJECT_STATUS.md` — update date, stato attuale table, test count
   - `ARCHITECTURE.md` — new components, updated pipeline descriptions
   - `CLAUDE.md` — current state section, project structure tree, version
   - `README.md` + `backend/README.md` — new endpoints, dependencies
   - Commit as `docs: sync after {brief_id}` and push

**This step is NOT optional.** Do not wait for the user to ask. Do it immediately after every feature push, in the same conversation turn.

---

## High-Risk Modules — STOP Gate Required

These files require **Phase 0 audit (read all affected files, list call sites) → STOP → explicit OK** before any changes:

| File | Why |
|------|-----|
| `backend/app/services/gemini_service.py` | AI pipeline — broken = no analysis |
| `backend/app/core/security.py` | JWT auth — broken = locked out |
| `backend/app/core/deps.py` | Dependency injection — affects all endpoints |
| `backend/app/api/auth.py` | Auth endpoints — broken = no login |
| `backend/app/api/videos.py` | Video pipeline — broken = core feature down |
| `alembic/versions/*.py` | Schema migrations — wrong = data loss |

For these files: read first, print analysis, wait for OK, then implement.

---

**Version:** 2.20 (B014-iter-2 art presets overhaul + #11 stress test 2026-04-23)
**Owner:** Daniele Somensi + Claude Code
