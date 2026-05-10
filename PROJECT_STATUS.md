# 📋 KILTER-UP — Project Status & Decisions Log

> **Questo file è la fonte di verità del progetto.**
> Aggiornato da Claude Code ogni volta che si prende una decisione importante.
> Leggi questo PRIMA di fare qualsiasi cosa sul progetto.

---

## 🗓️ Ultimo Aggiornamento: 10 Maggio 2026

---

## 📊 STATO ATTUALE

| Componente | Status | Note |
|------------|--------|------|
| Backend FastAPI | ✅ Done | Clerk auth + video pipeline, SQLite, Python 3.11 |
| Auth (Clerk) | ✅ Done | Clerk hosted sign-in/sign-up. Backend verifies via JWKS. Local users table is a Clerk shadow row (id, clerk_id). Production guard refuses to boot without CLERK_JWKS_URL. |
| VideoUpload model | ✅ Done | Consolidated — form_analysis JSON, processing_status |
| Gemini Video Service | ✅ Done | google.genai SDK, lazy init, gemini-2.5-flash, Kilter Board-specific prompt (B007+B008) |
| Video endpoints | ✅ Done | POST upload (202), GET /{id}, GET list, DELETE |
| Climb endpoints | ✅ Done | GET search, GET detail, GET stats (Phase 3b) |
| BoardLib DB | ✅ Done | 344k+ climbs, climb_service.py, test fixture DB |
| Alembic migrations | ✅ Done | 001 (initial) + 002 (form analysis) — single head |
| Tests | ✅ Done | Backend + frontend passing, CI on GitHub Actions |
| B010 Homepage + APK | ✅ Done | 4-tile hub, privacy policy, signed AAB/APK, Capacitor fixes |
| B011 BLE Permissions | ✅ Done | Bounded location permissions to maxSdkVersion=30, no spurious prompt on Android 12+ |
| B012 BLE LED Transmission | ✅ Done | Pure encoder (kilter-protocol.ts, API level 3), sendLEDPreset/sendAllOff, "Illumina board" button, error banner, 22 encoder tests. Gym-validated. |
| A016 iOS Capacitor Setup | ✅ Done | `@capacitor/ios ^8.3.1`, `ios/` Xcode project (SPM-based), `NSBluetoothAlwaysUsageDescription` in Info.plist, build scripts split (build:mobile + sync:ios/sync:android/open:ios/open:android), first device build running on iPhone 15 (iOS 26.2) via personal Apple Developer account. |
| B014 BLE LED Test UX | ✅ Done | Auto-apply preset on tap with 200ms debounce, BLE writes serialized via hook-level promise chain, Connetti/Disconnetti enlarged to card-sized buttons, creative presets #6-#10 authored on the 17×18 main-hold grid. |
| B014-iter Preset Fixes | ✅ Done | After gym validation: climber redrawn with asymmetric reaching pose (not T-pose), heart uniform red+magenta (no white shine), lightning extended to near-full-board-height zigzag, smile enlarged to 11×11 rounded face. Pending final gym re-validation. |
| B014-iter-2 Art Overhaul | ✅ Done | Replaced diagnostic presets #1-#5 with pixel art: Space Invader (green), Ghost Blinky (red + white/cyan eyes), Zelda Heart (mono-red 8-bit), Star (yellow), Sun (orange + yellow rays). Added preset #11 All LEDs Diagnostic — stress test lighting all 476 positions in y-banded rainbow stripes. |
| A015 Universal Nav + BLE on Discover | ✅ Done | BottomNav added to `/classify` and `/ble-test` (replaces cramped `← Home` links). BLE control bar on `/discover/detail` — `ClimbBleControls` component + `climb-to-leds.ts` helper + static `app/data/leds_12x12.json` (placement_id → LED position, 476 entries generated from BoardLib DB). Single SSoT for role→color in `kilter-protocol.PLACEMENT_ROLES`. |
| A014 Next/Prev on Discover detail | ✅ Done | `filtered-list-storage.ts` persists filter results in sessionStorage (24h TTL). `/discover/detail` renders `← Prev / N of M / Next →` when current uuid is in saved list. `ClimbBleControls` auto-sends new climb (300ms debounce) on key change when board is connected — rapid taps coalesce. Deep links hide the row. Keeps list's original angle across navigation. |
| D015 Circuits Audit | ✅ Done | Read-only audit of `kilter.db` — `frames_count > 1` identifies the 517 multi-frame animated sequences (e.g. Pump 540°, Driftwood); `circuits` / `circuits_climbs` tables are empty in BoardLib; `is_listed = 1` filters out ~92k unvalidated climbs. Output: `backend/docs/D015_CIRCUITS_AUDIT.md`. Feeds Brief A (move-count filter) and B019. |
| B019 Circuits Backlog Logged | ✅ Done | Logged "Circuits & Animated Sequences" as a Phase 8+ subsection in `ROADMAP_ACTIVE.md` — DB integration, dedicated Discovery tab, BLE multi-frame protocol extension, validation plan. Prerequisite: D016 (frames format verification). Docs-only commit. |
| B017 Discovery UX fixes | ✅ Done | (1) Prev/Next buttons enlarged to card-sized tap targets (`min-h-16`, `text-xl font-bold`) for quick flipping during rest intervals; (2) app-wide safe-area sweep — `.pt-safe`/`.pb-safe` utilities in `app/safe-area.css` (separate from globals.css because Tailwind v4 strips plain class rules from the Tailwind entrypoint), `viewport-fit=cover` in layout, applied to all 12 pages + BottomNav; (3) Discovery filter state persists in sessionStorage (`kilter-up:discover:filters`, 24h TTL) so filters restore on return from detail — URL params still win on mount for shareable deep links; (4) prominent Filters button — full-width 56px-tall toggle inside the sticky `/discover` header, brand-orange + count badge when any filter is active (grade range, min ascents, min stars, or non-default sort). Panel `expanded` state lifted from `FilterPanel` to `DiscoverPage`; `countActiveFilters()` exported for reuse. Pending gym re-validation on iPhone + Android. |
| A019 Move count chip filter | ✅ Done | New Moves chip section on `/discover` between MIN STARS and SORT BY (Any / ≤5 / 6–7 / 8–10 / >10, default Any). Backend: optional `moves` query param on `GET /api/climbs/search`, applied as a SQL WHERE on `((LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 + 2)` — no schema change. Animated multi-frame sequences (`frames_count > 1`) excluded from search globally — they're circuits, not boulders. `MovesFilter` type in backend schemas + frontend api.ts; `countActiveFilters()` extended to count any non-Any moves bucket. Test fixtures regenerated by `backend/scripts/seed_a019_test_fixtures.py` (idempotent) — A019-prefixed rows for each bucket plus one `frames_count=3` row that validates the global exclusion. Pending gym re-validation. |
| A020 Clerk auth integration | ✅ Merged + Android verified | Replaces legacy custom-JWT auth. 18 commits + hotfix PR #2, merged via PR #1 (b918e35) on 2026-05-08 + redirect-loop hotfix (5ee9ab3) merged via PR #2. **2026-05-10:** Railway env vars (`CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ENVIRONMENT=production`) confirmed set by Daniele. Android device verification ✅ green on tablet (APK v0.1.1 build 3, sideloaded via Drive): Google OAuth flow signs in (browser exit-and-return is expected anti-phishing behavior, not a bug), homepage + Discover + Demo LED + Classify + Dashboard all render with Clerk JWT being accepted by Railway backend. **A019.16:** ALL pages require login except `/sign-in`, `/sign-up`, `/privacy`, `/debug`. **Mobile API_BASE precedence hotfix:** `app/lib/api.ts:9-15` now forces Railway URL when `NEXT_PUBLIC_MOBILE=true`, ignoring `NEXT_PUBLIC_API_URL` from `.env.local` (previous order let a developer-local localhost URL leak into APK and silently break every backend call). **Pending:** iPhone 15 Capacitor verification (Step 3b — `WKAppBoundDomains` must-pass check), Vercel env vars (`NEXT_PUBLIC_CLERK_*` including `*_FORCE_REDIRECT_URL` overrides). |
| Frontend upload UI | ✅ Done | Drag-drop, progress bar, mobile-first |
| Discovery frontend | ✅ Done | A011 — `/discover` (search + filters) + `/discover/[uuid]` (board viz). B016 — hollow rings for active holds, screw-on footholds smaller, kickboard row visible. Grip-type filter wired but disabled. |
| B001 Cleanup | ✅ Done | Removed v1/v2 duplication, dead code, broken imports |
| BoardLib integration | ✅ Phase 3a+3b | DB setup + search/detail API. Phase 3d (Level 2 analysis) next |
| Training logs | ⏳ Da fare | Phase 6 |
| Deploy (Railway) | ✅ Partial | Backend live on Railway (SQLite + kilter.db via boardlib auto-download, B013). Frontend + PostgreSQL + S3 still TODO |

---

## 🎯 CORE STRATEGY (Updated April 2026)

**One product, two tiers:**

| Tier | Name | What it does | Price |
|------|------|-------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board connection, attempt logging | Free |
| **Paid** | Coach | Video upload → AI technique analysis with climb context, move-by-move coaching, training suggestions | €7.99/month |

**Key asset:** Proprietary hold classification database — every hold on the Kilter Board tagged by grip type (jug, good crimp, crimp, sloper, undercling, pinch). No competitor has this. Prerequisite for Discovery.

**BLE in scope:** Capacitor wraps Next.js for a native iOS/Android app. BLE connection (Phase 3e) enables lighting up the board directly from the app — unique feature.

**Coach intelligence — 3-level system:**
- Level 1: Solo video analysis (Gemini analyzes your technique) — ✅ WORKING
- Level 2: Contextual analysis (your video + climb data from BoardLib DB) — 🎯 Phase 3d
- Level 3: Expert comparison (your video vs expert beta video) — 🔮 Phase 5

See RESEARCH.md for full ecosystem audit.
See ROADMAP_ACTIVE.md for detailed implementation plan.

---

## 🔑 CREDENZIALI & CONFIG

| Variabile | Valore | Note |
|-----------|--------|------|
| `GEMINI_API_KEY` | Già in `.env` ✅ | AIzaSyCB... |
| `DATABASE_URL` | `sqlite:///./kilter.db` | Dev locale |
| `CLERK_JWKS_URL` | Già in `.env` ✅ | Backend — Clerk JWKS endpoint (REQUIRED in production, startup guard). Valore in `backend/.env` locale, non committato. |
| `CLERK_SECRET_KEY` | Già in `.env` ✅ | Backend — Clerk server-side secret. Valore in `backend/.env` locale, non committato. |
| `CLERK_PUBLISHABLE_KEY` | Già in `.env` ✅ | Backend + frontend (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`). Valore in `backend/.env` e `.env.local`, non committato. |
| `UPLOAD_DIR` | `uploads/` | Locale |
| GitHub | `danielesomensi-cmd/kilter-up` | Main repo |
| Play Store keystore | `~/kilter-up-release.keystore` | Credentials in `~/kilter-up-credentials.txt` — back up to 1Password |

---

## 🐛 PROBLEMI RISOLTI (non ripetere gli errori!)

### ❌ PROBLEMA 1: Frame-by-frame analysis = rate limit
**Quando:** Day 3 planning (19-21 Feb 2026)
**Problema:** Il piano originale mandava ogni frame del video come immagine separata a Gemini. 30 secondi di video @ 1 FPS = 30 API calls → rate limit del free tier (15 req/min) → 2 minuti di attesa.
**Soluzione:** ✅ **Gemini File API** — upload il video intero UNA volta, poi UNA sola chiamata a Gemini con `file_data`. Gemini elabora internamente tutti i frame.

**Implementazione corretta (pattern File API — architettura ancora valida):**
> **Nota storica:** Il codice sotto usa il vecchio SDK `google.generativeai` e il modello `gemini-2.0-flash`, entrambi deprecati. Il codebase attuale usa `google.genai` SDK con `gemini-2.5-flash` (migrato in B003). Il *pattern* (File API, un'unica chiamata) è corretto.

```python
import google.generativeai as genai  # ← deprecato, ora: from google import genai

# Step 1: Upload video (una volta)
video_file = genai.upload_file(path="climbing_video.mp4")

# Step 2: Aspetta che il file sia processato
while video_file.state.name == "PROCESSING":
    video_file = genai.get_file(video_file.name)

# Step 3: UNA sola chiamata di analisi
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content([
    video_file,
    "Analizza la tecnica di arrampicata in questo video..."
])
```

**DON'T DO THIS:**
```python
# ❌ SBAGLIATO - frame per frame
for frame in frames:
    response = genai.generate_content([frame, prompt])  # 30 API calls!
```

---

### ❌ PROBLEMA 2: PostgreSQL → SQLite migration
**Quando:** Day 2 sprint (19 Feb 2026)
**Problema:** Setup iniziale con PostgreSQL aveva problemi di compatibilità UUID su macOS dev.
**Soluzione:** ✅ Switchato a SQLite per dev locale (String(36) per UUID), PostgreSQL per production.
**File:** `backend/app/models/user.py`, `backend/app/models/video.py`

---

### ❌ PROBLEMA 3: Capacitor APK "Failed to fetch" — CORS origin mismatch
**Quando:** 10 April 2026 (B010 Play Store build)
**Problema:** Capacitor Android WebView sends `Origin: https://localhost` on all fetch requests. The backend CORS config only allowed `http://localhost` and `capacitor://localhost`, so every API call was rejected with a CORS preflight failure — `TypeError: Failed to fetch` with no further detail. Worked fine in Chrome on the same device (different origin). Diagnosed via a `/debug` page that tested fetch to multiple URLs and reported `window.location.origin`.
**Soluzione:** ✅ Add `https://localhost` to CORS allowed origins in `backend/app/main.py`. All three Capacitor origins must be listed: `capacitor://localhost` (iOS), `http://localhost` (Capacitor dev), `https://localhost` (Android production WebView).
**File:** `backend/app/main.py`

---

## ✅ DECISIONI ARCHITETTURALI PRESE

### 1. Gemini 2.5 Flash (non MediaPipe/YOLO)
**Decisione:** Usare Gemini Vision API per MVP invece di MediaPipe + YOLO.
**Perché:**
- Zero ML training richiesto → MVP più veloce
- Gemini capisce il contesto climbing senza dataset custom
- MediaPipe/YOLO possono essere aggiunti in Phase 2 per accuracy
- Costo irrisorio: ~$0.001 per video analizzato

### 2. FastAPI + SQLite (dev) / PostgreSQL (prod)
**Decisione:** Backend Python perché l'ML ecosystem è Python-first.
**Perché:** MediaPipe, YOLO, e le librerie Google AI sono tutti Python.

### 3. Video = async processing
**Decisione:** Upload video → 202 Accepted → job in background → polling status.
**Perché:** Video processing può durare 10-30 secondi, non bloccare la UI.

### 4. Storage: Locale (dev) → S3 (prod)
**Decisione:** Local filesystem per dev, S3 per production.
**Perché:** Semplicità dev, scalabilità prod.

### 5. NO Celery/Redis per MVP
**Decisione:** Background task con FastAPI `BackgroundTasks` (built-in), non Celery.
**Perché:** Celery aggiunge complessità (Redis dependency). FastAPI BackgroundTasks è sufficiente per MVP.

### 6. BoardLib for Kilter Board Data (not custom scraping)
**Decision:** Use BoardLib Python library to download the official Kilter Board SQLite database locally.
**Why:**
- Gives us 160k+ climbs with full metadata (grade, holds, angle, ascents)
- Open source, pip installable, maintained
- Database is ~189MB, stored locally (gitignored)
- No need to reverse engineer Aurora Climbing API ourselves
- Sync command updates DB incrementally

### 7. Search-first for Climb Identification (not vision-first)
**Decision:** Users search/select climbs by name with autocomplete as primary flow. Visual LED recognition is a Phase 4 enhancement.
**Why:**
- Simpler, more reliable, works offline
- BoardLib DB enables fast local search
- Can add visual recognition in Phase 4 without changing core flow

**PoC Update (April 2026):** Manual PoC validated that Gemini 2.5 Flash can detect LEDs from a non-ideal Instagram gym photo. Start/finish holds (green/magenta) detected reliably. Cyan middle holds harder (can miss or hallucinate). Approach under evaluation: count physical holds from board edges (distortion-resistant) vs percentage-based positioning (vulnerable to camera angle). **Phase 4 is now a validated concept, pending second PoC.** See ROADMAP_ACTIVE.md Phase 4 and D005 Q4 for reverse-lookup matching strategy.

### 8. 3-Level Analysis Architecture
**Decision:** Build intelligence incrementally — solo analysis → contextual → comparison.
**Why:**
- Level 1 already works (Gemini + video)
- Level 2 only requires BoardLib integration (no external video sources)
- Level 3 depends on video availability (YouTube/Instagram) — decouple from MVP
- Each level is independently valuable

### 10. Clerk for identity (A020)
**Decisione:** Outsource sign-in/sign-up/MFA/OAuth/password-reset/email-verification to Clerk. Backend verifies the JWT via JWKS; the local `users` table is just a shadow row (id + clerk_id).
**Perché:**
- Hosted Clerk widget (`/sign-in`, `/sign-up`) — no in-house password storage, no bcrypt to maintain, no email-verification email pipeline to build.
- SPA-mode `@clerk/clerk-react` components, not `@clerk/nextjs` — the Next variant pulls in `server-actions.js` + `keyless-actions.js` which Next refuses inside `output: 'export'` (the format Capacitor needs).
- Route gating via client-side `useAuth()` (not `clerkMiddleware`). Clerk middleware silently dies in static-export bundles per Clerk issue #4647 ("not planned"). The actual security boundary is backend JWT verification (`core/clerk.py`); `AuthGuard.tsx` is just UX glue.
- `X-User-ID` header fallback survives in dev/test only — explicitly gated behind `environment != "production"` in `deps.get_current_user_id`, with an extra startup guard in `core/config.py` that crashes the container if `ENVIRONMENT=production` and `CLERK_JWKS_URL` is empty.
- iOS WKWebView would otherwise punt the Clerk handshake out to Safari and break auth; `WKAppBoundDomains` (Info.plist) + `server.allowNavigation` (capacitor.config.ts) keep the Clerk Frontend API in-app.

### 9. Animated sequences excluded from Discovery search globally (A019)
**Decision:** `GET /api/climbs/search` always filters `frames_count = 1`, so multi-frame animated sequences (Pump 540°, Driftwood, etc.) never appear in search results — regardless of which filters the user selects.
**Why:**
- The A019 moves formula `(cyan_holds + 2)` doesn't apply to a multi-frame circuit — there's no single "move count" for a sequence whose hold set rotates over time.
- The current BLE control bar (`ClimbBleControls`) only knows how to send a single static frame; trying to illuminate an animated sequence would silently send the wrong holds.
- D016 confirmed every known animated sequence has `frames_count > 1`, so the filter is precise.
- Search-by-name still works for these climbs from a Phase 8+ "Circuits" tab; the global exclusion only affects the bucketed Discovery list. Phase 8+ will introduce a dedicated UX (B019 backlog).

---

## 📋 BACKLOG — Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| ~~Migrate `google.generativeai` → `google.genai`~~ | ✅ Done | B003 — migrated to google.genai SDK + gemini-2.5-flash |
| ~~`gemini_service.py` API key → pydantic Settings~~ | ✅ Done | B003 — reads from `get_settings().gemini_api_key` |
| Recreate API_SPECIFICATION.md | After Phase 3 | Archived — was heavily outdated |
| Recreate DATABASE_SCHEMA.sql | After Phase 3 | Archived — was heavily outdated |
| ~~Frontend deploy to Vercel~~ | ✅ Done | kilter-up-coach.vercel.app |
| PostgreSQL on Railway | Phase 7 | Currently using SQLite on Railway |

---

## 🗺️ ROADMAP

### ✅ Phase 1 — Foundation (Done)
### ✅ Phase 2 — Video Analysis (Done)
### 🎯 Pre-Phase 3 — Hold Classification HC-1→HC-7 [IN PROGRESS — HC-1✅ HC-2✅ HC-3⏳ HC-5✅ HC-6⏳ HC-7⏳] (HC-4 removed — manual classification via `/classify` UI)
### 🎯 Phase 3 — Discovery + Coach Build (3a✅ 3b✅ A011 frontend✅ 3e: B011✅ B012✅ A016✅ — 3c→3h pending)
### ⏳ Phase 3.5 — Soft Launch (Discovery free → Coach paid)
### ⏳ Phase 4 — Visual Problem Recognition
### ⏳ Phase 5 — Expert Video Comparison
### ⏳ Phase 6 — Training Logs + Progress
### ⏳ Phase 7 — Deploy & Polish

See ROADMAP_ACTIVE.md for full details.

---

## 📁 STRUTTURA REPOSITORY

See `CLAUDE.md` for the complete, up-to-date project structure tree.

---

## 🧪 COME FARE GIRARE IL PROGETTO (dev)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8001

# Frontend
npm run dev  # porta 3000

# Test backend
cd backend && pytest -v
```

---

## 📌 REGOLE PER CLAUDE CODE

1. **Leggi questo file PRIMA di iniziare qualsiasi task**
2. **Usa Gemini File API** per video (NON frame-by-frame)
3. **NON aggiungere Celery/Redis** — usa FastAPI BackgroundTasks
4. **NON mettere secrets nel codice** — tutto in `.env`
5. **NON rompere auth esistente** — funziona, non toccarla
6. **Scrivi test** — pytest obbligatorio per ogni nuovo endpoint
7. **Commit piccoli e descrittivi** dopo ogni feature funzionante

---

*Creato da Claude Code — 22 Febbraio 2026 | Aggiornato: 7 Maggio 2026*
*Aggiorna questo file ogni volta che prendi una decisione importante!*
