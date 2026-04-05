# Kilter-Up — Active Roadmap
> Updated: 3 April 2026
> Strategy: AI Climbing Companion — Discovery (free) + Coach (paid)

---

## Vision

Kilter-Up is an AI-powered climbing companion for Kilter Board users. Two tiers, one product:

| Tier | Name | What it does | Price |
|------|------|-------------|-------|
| **Free** | Discovery | Search 160k+ climbs by grip type, AI session builder, problem generation, BLE board control, attempt logging | Free |
| **Paid** | Coach | Video upload → AI technique analysis with climb context, move-by-move coaching, training suggestions | €7.99/month |

Three levels of coaching intelligence (Coach tier):

| Level | Name | Input | What AI Knows | Status |
|-------|------|-------|---------------|--------|
| 1 | Solo Analysis | Your video only | General climbing technique | ✅ Working |
| 2 | Contextual Analysis | Your video + climb ID | Grade, holds, angle, grip types, known beta | 🎯 Next |
| 3 | Comparison Analysis | Your video + expert video | Everything from L2 + expert reference | 🔮 Future |

**Key asset:** Proprietary hold classification database — every hold on the Kilter Board tagged by grip type (jug, good crimp, crimp, sloper, undercling, pinch). No competitor has this.

**Market strategy:** Discovery launches first as free acquisition layer. Coach monetizes serious climbers. BLE board connection via native app (Capacitor wrapping Next.js). Kilter Board-specific at launch, Aurora board expansion later.

---

## Market Context (April 2026)

**Ecosystem split:** Aurora Climbing's legacy app (3.3★, laggy, crashes) being replaced by kilterboard.io (Kilter Grips, launched March 2026, early stage). Community frustrated and fragmented. Neither app offers AI features, session building, or grip-type filtering.

**Discovery competitors:**

| Tool | What it does | Our advantage |
|------|-------------|---------------|
| Climbdex (climbdex.com) | Hold filtering, mirrored search, difficulty accuracy. Free, open source, by BoardLib author. | No grip type classification, no session builder, no AI, no generation |
| Kilter Lookup (kilterlookup.com) | Kilter-specific hold search, campus filter | No AI, no session building, limited filters |
| kilterboard.io | Official new Kilter app. Better search, playlists. | No AI, no grip type filter, no session builder |

**Coach competitors:**

| App | Focus | Our advantage |
|-----|-------|---------------|
| Climbah | Generic AI video analysis | Not Kilter-specific, no climb context |
| ClimbAI | Video technique analysis | Waitlist only, not Kilter-specific |
| Climbalyzer | 3D body position | Beta, not Kilter-specific |

**Moat:** No one combines AI + Kilter Board contextual data + proprietary hold classification. Discovery's grip-type filter + AI session builder + "illuminate only crimps" BLE feature are unique.

**Target:** Intermediate Kilter Board climbers (V3–V7), train 2–4x/week.

---

## Monetization Strategy

> Council verdict (April 1, 2026) + revision (April 2, 2026).

**Model:** Discovery free (unlimited) → Coach €7.99/month (1 free analysis per signup).

**Why free Discovery:**
- Climbdex is free — can't charge for search
- Discovery's job: build audience, create habit, funnel to Coach
- AI session builder + grip type filter = differentiator, offered free to maximize adoption
- BLE connection = stickiness (users open Kilter-Up every session)

**Why €7.99/month Coach:**
- Below €10 psychological threshold
- 1 free analysis removes need for trial period
- Revisit pricing at 50+ paying users (Council suggested €9.99 as alternative)

**Not yet decided:** Annual plan, team/gym pricing, refund policy.

---

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
- 136 tests passing
- Backend live on Railway, frontend on Vercel

---

## Daniele's Action Items (Parallel Track)

> These run alongside Claude Code development work.

- [x] **Register Apple Developer Account** — application submitted 3 April 2026, awaiting approval (1-3 days)
- [ ] **Write pro climber list** — names + Instagram/YouTube handles of known strong Kilter Board climbers (Daniele's knowledge)
- [ ] **Validate hold taxonomy** with Christie — show 20 random hold images, check if 6 categories make sense
- [ ] **Validate hold classifications** in gym — use mobile validation tool, physically check ambiguous holds (~2-3 hours)
- [ ] **Record 2-3 test videos** at the Kilter Board for L1 vs L2 validation gate
- [ ] **Curate 10-15 public test videos** from Instagram (known climbs, known grades)

---

## Pre-Phase 3 — Hold Classification (NEW — 1.5 weeks)

> **PREREQUISITE for Discovery.** Without this, Discovery = Climbdex clone. With this, it's unique.

**Taxonomy (6 categories):** Jug, Good Crimp, Crimp, Sloper, Undercling, Pinch

**Target board:** 12x12 Original Layout (323 handholds + 153 footholds). Smaller boards (7x10, 8x12) are subsets — automatically covered.

| # | Task | Owner | Effort | Notes |
|---|------|-------|--------|-------|
| HC-1 | Install BoardLib, download Kilter DB + hold images | Claude Code | 1 day | `boardlib database kilter` + `boardlib images kilter` |
| HC-2 | Build canonical 12x12 board map (annotated, numbered, mobile-friendly) | Claude Code | 1 day | Must show hold position clearly on board for gym validation |
| HC-3 | Validate taxonomy with Christie (show 20 random holds) | Daniele | 0.5 day | If >80% agreement → taxonomy confirmed |
| HC-4 | AI batch classification script (Gemini Flash, all ~323 handholds) | Claude Code | 1 day | Output: JSON per hold with category + confidence |
| HC-5 | Build mobile validation UI (hold image + board position + AI guess + override) | Claude Code | 1 day | **Must work on phone in gym — board map visible per hold** |
| HC-6 | Daniele validates all holds in gym | Daniele | 0.5 day | Touch holds physically, confirm/override classification |
| HC-7 | Store classifications in DB (`hold_classifications` table) + apply to board sizes | Claude Code | 0.5 day | Alembic migration — STOP gate |

---

## Pre-Phase 3 — Quick Wins (unchanged)

### Prompt & Output Refinement (D001 → B brief)
- [ ] Audit current Gemini prompt in `gemini_service.py`
- [ ] Define compact structured JSON output schema
- [ ] Always include dual grading: Font AND V-grade
- [ ] Test with real climbing videos
- [ ] STOP gate: review prompt changes before merging

### Video Thumbnails + Replay (B003)
- [ ] Extract frame via ffmpeg, save as JPEG
- [ ] Serve thumbnail via API
- [ ] Frontend: thumbnail + video player
- [ ] Tests

---

## Phase 3 — Discovery + Coach Build (NEXT — ~8 weeks)

### 3a — BoardLib Database Setup (1 week) (✅ Complete)
- [x] Add `boardlib` to requirements.txt
- [x] Script to download/sync Kilter Board SQLite DB (`backend/data/kilter.db`)
- [x] Add `backend/data/` to .gitignore
- [x] Explore DB schema: climbs, placements, holes, leds tables
- [x] Document available fields and data quality
- [x] Extract Instagram video links from DB — store as viewable links (not downloaded)
- [x] Management command: `python -m scripts.sync_kilter_db`

### 3b — Climb Search API + Advanced Filters (1-2 weeks) (✅ Complete)
- [x] `GET /api/climbs/search` with core filters:
  - Name (autocomplete)
  - Grade range (V-scale + Font)
  - Angle
  - Min ascents / popularity
  - Star rating
  - Difficulty accuracy
  - Board size/layout
  - Setter name
- [ ] Additional filters (requires hold classification — Pre-Phase 3):
  - **Grip type** (jug/good crimp/crimp/sloper/undercling/pinch) — from hold classification
  - **Number of moves** (derived from layout string `p` count)
  - **Session type filter** (Power: 1-4 moves / Power Endurance: 5-8 / Endurance: 9+)
- [x] `GET /api/climbs/{id}` — full detail with hold classifications + beta video links
- [ ] `GET /api/climbs/{id}/similar` — similar problems (Jaccard on hold sets, same grade/angle different holds)
- [x] Dual grade display everywhere: Font + V-grade
- [x] Tests

### 3c — AI Session Builder (1-2 weeks)
- [ ] `POST /api/sessions/build` — natural language OR structured input (dropdowns)
- [ ] Gemini Flash parses natural language → structured query
- [ ] Session types: warmup, 4x4, power endurance, project rehearsal, cooldown, mixed
- [ ] Session logic: warmup → work sets → cooldown, no duplicate holds, grade progression, rest recs
- [ ] Support constraints: grip type, angle, grade range, move count, exclude dynos (best effort)
- [ ] `GET /api/sessions/{id}` — retrieve built session
- [ ] `GET /api/sessions` — user's saved sessions
- [ ] Frontend: session builder UI (chat input + dropdown fallback)
- [ ] Tests

### 3d — Enhanced Video Analysis / Level 2 (1-2 weeks)
- [ ] Modify video upload: optional `climb_id` + `angle`
- [ ] When climb_id provided: fetch climb data + hold classifications from DB
- [ ] Build enriched Gemini prompt with full context (grade, angle, grip types per hold, hold positions, ascent count)
- [ ] Structured JSON coaching output (technique scores, move-by-move, key improvements, training suggestions)
- [ ] Frontend: climb search before upload, structured feedback display
- [ ] Tests
- [ ] **Validation Gate: L1 vs L2 (MANDATORY before Coach launch)**
  - Run 10-15 test videos through both levels
  - Document: is L2 visibly better?
  - If yes → proceed. If no → fix prompt before launch.

### 3e — Capacitor + BLE Integration (1-2 weeks)
- [ ] Capacitor project setup wrapping Next.js frontend
- [ ] `@capacitor-community/bluetooth-le` plugin
- [ ] BLE scan → discover Kilter Board → connect
- [ ] Light up a problem from search results (layout string → LED mapping via `leds` table)
- [ ] **"Illuminate only [grip type]"** — query hold_classifications → filter hold_ids → map to LED positions → send BLE packet
- [ ] Light up generated problems
- [ ] Connection management (reconnect, error states, disconnect on background)
- [ ] iOS + Android builds
- [ ] Tests

### 3f — Problem Generation (1-2 weeks)
- [ ] `POST /api/climbs/generate` — constraints: grip types, move count, grade target, angle
- [ ] Algorithm: select holds from classified DB → validate reachability (x/y distances) → assign roles (start/middle/finish/foot)
- [ ] Generate valid layout string (internal to Kilter-Up only — not shared to Kilter community)
- [ ] User can save, name generated problems
- [ ] Frontend: generation UI with constraint inputs + result preview
- [ ] Tests

### 3g — Recommendation Engine + Attempt Logging (1 week)
- [ ] `GET /api/climbs/recommend` — training-oriented queries (hold type, angle, grade range, min ascents)
- [ ] Sort by: popularity, difficulty accuracy, grip diversity
- [ ] Attempt logging: climb_id, result (Flash/Send/Attempt/DNF), tries, optional note, auto date+session
- [ ] `POST /api/attempts` + `GET /api/attempts` (paginated, filterable by session/date)
- [ ] Frontend: log button on every climb card + session history view
- [ ] Tests

### 3h — Pro Climber Video Database (1 week)
- [ ] Schema: `pro_climbers` table (name, instagram, youtube, notes)
- [ ] Schema: `curated_videos` table (climb_id, pro_climber_id, source_url, source_platform, grade, angle)
- [ ] Populate with Daniele's list + Claude's research
- [ ] Surface pro videos on climb detail page: "Watch [climber] send this problem"
- [ ] Instagram links shown as external links (no download)
- [ ] YouTube videos: evaluate yt-dlp for local caching (future, not MVP)
- [ ] Alembic migration — STOP gate
- [ ] Tests

---

## Phase 3.5 — Soft Launch & Community Validation

**Goal:** Get real users, validate product-market fit.

**Prerequisites:** Phase 3 complete + Validation Gate passed + Apple Developer Account active.

### Discovery Launch (Free — Week 1)
- [ ] Landing page update: clear value prop, demo screenshots, "Get the app" CTA
- [ ] Submit to iOS App Store (TestFlight first) + Android Play Store
- [ ] Post on r/kilterboard: "Built an AI session builder for Kilter Board — searches by grip type"
- [ ] Post on r/climbharder: demo with real session build (e.g., "V5 crimp 4x4 at 40°")
- [ ] 1 Instagram Reel: open app → build session → light up board → climb. 30 seconds.
- [ ] Share in Kilter Board Facebook groups / Discord servers
- [ ] Target: **100 signups in 2 weeks**

### Coach Launch (€7.99/month — Week 3)
- [ ] Stripe integration: signup → 1 free analysis → paywall
- [ ] Email campaign to Discovery signups: "Coach is live — your first analysis is free"
- [ ] Target: **5+ paying users in first month**

### Metrics
- [ ] Discovery signups (email captures)
- [ ] DAU on Discovery (session builder usage, search queries)
- [ ] BLE connection rate (% of users connecting to board)
- [ ] Free → paid Coach conversion (target >5%)
- [ ] Coach retention: do users upload again in week 2?
- [ ] Qualitative: screenshot reactions, feedback messages

### Success Criteria
- 100+ Discovery signups in 2 weeks → product has pull
- 5+ paying Coach users in first month → monetization works
- Users share sessions/analyses organically → viral loop
- If crickets after 2 weeks → re-evaluate positioning, talk to every signup

---

## Phase 4 — Visual Problem Recognition (Enhancement)

**Goal:** Photo of Kilter Board with LEDs lit → system identifies the climb.

**Status (April 2026):** PoC validated — approach under evaluation. Second PoC required before any code is written.

### PoC Results (April 2026)

**Setup:** Instagram photo (@higuera82kilter — "Straight outta Brione" 7C+ @ 40°, Kilter Board Original 12x12). Tool: Gemini 2.5 Flash via Gemini App (manual test).

**Ground truth:** 1 green (start) + 4 cyan (middle) + 1 magenta (finish) + 1 orange (foot).

| Test | Prompt | Result |
|------|--------|--------|
| Test 1 | Basic | 1 green ✅, 2/4 cyan ❌ (missed 2), 1 magenta ✅, 1 orange ✅. Board type (Original 12x12) correctly identified. |
| Test 2 | Aggressive (look harder for faint LEDs) | 1 green ✅, 5 cyan (4 real + 1 ghost) ✅⚠️, 1 magenta ✅, 1 orange ✅. Better recall, one false positive. |

**Conclusions:**
- Gemini CAN detect LEDs from a non-ideal gym photo — concept validated
- Start (green) and finish (magenta) reliably detected — bright, distinctive colors
- Cyan middle holds are hardest — can be dim, blend with hold color
- Confidence levels are meaningful: high-confidence LEDs reliable, medium needs verification
- Single-pass prompting insufficient — aggressive prompt helps recall but adds false positives

### Coordinate Mapping Challenge (from D005)

**Board coordinate system (Kilter Board Original 12x12 Square — source: D005 Q7):**
- `product_size` bounds: `edge_left=0, edge_right=144, edge_bottom=12, edge_top=156`
- Grid is interlaced (KB1/KB2 sub-grids), minimum spacing between holes = 4 units

**Problem:** Gemini reports LED positions visually ("column 6, row 4"). We need BoardLib DB coordinates (board units, e.g. x=40, y=40) to match against `holes.x/y` for the reverse-lookup strategy described in D005 Q4.

### Coordinate Approach — Under Evaluation

**Approach A — Percentage-based positioning:**
Gemini estimates "this LED is at 40% from left, 25% from bottom" → convert to DB coords.
- **Pro:** Continuous scale, direct conversion formula
- **Con:** Very vulnerable to perspective distortion. A LED at true 50% can appear at 45–55% from a non-frontal camera angle. Error compounds with distance from center.

**Approach B — Count physical holds from edges (leading candidate):**
Gemini counts "this LED has N holds to its left on the same row, M holds below it in the same column" → maps to discrete grid position.
- **Pro:** Immune to perspective distortion — hold count from an edge is invariant to camera angle. Discrete values map naturally to DB grid structure.
- **Con:** Dense board (~47 distinct x positions) — counting many holds risks off-by-one errors. Interlaced KB1/KB2 sub-grids add complexity.

**Status:** Approach B is the leading candidate — pending one more PoC test with a count-holds prompt before any implementation decision.

### Matching Strategy (proposed, not implemented)

Three-level matching against BoardLib DB (reverse-lookup design from D005 Q4):

1. **Filter 1 — Role fingerprint:** Count holds per role from Gemini output (e.g., 1 start + 4 middle + 1 finish + 1 foot). Discard climbs that don't match. Uses `climbs.frames` layout string parsing.
2. **Filter 2 — High-confidence positions:** Map high-confidence LEDs to nearest `holes.x/y` with tolerance (±1–2 grid positions). Further narrow candidates.
3. **Filter 3 — Medium-confidence disambiguation:** Use medium-confidence LEDs to narrow remaining candidates. If still ambiguous → show top 3 to user for manual selection.
4. **Angle:** Always manual input — cannot be inferred from photo.
5. **Fallback:** If recognition fails entirely → redirect to text search/autocomplete (Phase 3b, already working).

### Tasks

- [ ] **Second PoC — test count-holds prompt** ← PREREQUISITE before any code
- [ ] `POST /api/climbs/identify` (accepts image)
- [ ] Gemini: detect LED positions + colors, count holds from board edges for position estimation
- [ ] Filter 1: role fingerprint match against `climbs.frames`
- [ ] Filter 2: high-confidence position match against `holes.x/y` (with tolerance)
- [ ] Filter 3: medium-confidence disambiguation → top-3 candidates UI
- [ ] Fallback to text search if recognition fails
- [ ] Tests

---

## Phase 5 — Expert Video Comparison (Level 3)

**Goal:** Compare user technique against expert reference videos.

### 5a — Curated Benchmark Database
- [ ] Curate 20-50 expert send videos (YouTube via yt-dlp)
- [ ] Store with metadata: climb_id, pro_climber_id, source_url, grade, angle
- [ ] Auto-suggest comparison when user uploads video for a problem with benchmark
- [ ] Alembic migration — STOP gate

### 5b — Dual Video Comparison
- [ ] Upload 2 videos: "my attempt" + "reference"
- [ ] Gemini prompt: 2 videos + climb context → structured comparison
- [ ] Frontend: side-by-side display with annotations
- [ ] Tests

### 5c — Movement Tagging from Video (Enables "no dynos" filter)
- [ ] AI analyzes video → tags movement types (dyno, gaston, heel hook, toe hook, compression, deadpoint)
- [ ] Store tags per climb in DB
- [ ] Enables movement-style filter in Discovery search (Phase 2 of filtering)
- [ ] Requires accumulated video data — revisit after 100+ analyzed videos

---

## Phase 6 — Training Logs + Progress Tracking

- [ ] Schema: training_logs (date, location, duration, session_type)
- [ ] Schema: climb_attempts (training_log_id, climb_id, grade, result, attempts, video_id)
- [ ] Progress charts: grade distribution, send rate trend, grip type breakdown
- [ ] Link to video analysis results
- [ ] Frontend: session logger, progress dashboard
- [ ] Tests

---

## Phase 7 — Deploy & Polish

- [x] Deploy backend to Railway (FastAPI + SQLite)
- [x] Alembic migrations in Railway startCommand
- [x] Health check endpoint (`/health`)
- [x] Deploy frontend to Vercel
- [ ] Switch Railway DB from SQLite to PostgreSQL
- [ ] S3 for video storage
- [ ] Mobile responsive polish
- [ ] Dashboard: aggregate stats, streaks, grade progression

---

## Phase 8+ — Backlog / Visionary

### Outdoor Video → Kilter Movement Matching
- [ ] Film outdoor climb → AI describes movement types
- [ ] Match against annotated Kilter problems
- [ ] Suggest training problems with similar patterns
- [ ] Requires movement tagging (Phase 5c) + large video corpus

### Aurora Board Expansion
- [ ] Extend to Tension Board, Moonboard via BoardLib
- [ ] Hold classification pipeline reusable (different hold sets)
- [ ] Same infrastructure: search, BLE, analysis, benchmarks

### Fullride (Homewall) Board Support
- [ ] Separate hold classification pass (~305 different holds)
- [ ] Same pipeline, different hold set

---

## Backlog — Technical Debt

- [x] **Migrate `google.generativeai` → `google.genai`** — B003
- [x] **`gemini_service.py` API key → pydantic Settings** — B003
- [ ] **Recreate API_SPECIFICATION.md** — after Phase 3 stabilizes
- [ ] **Recreate DATABASE_SCHEMA.sql** — after Phase 3 stabilizes
- [ ] **Retry with backoff on Gemini 503/429** — fails immediately on transient errors
- [ ] **Clean up dead files** — Procfile, railway_start.sh, backend/Procfile
- [ ] **Evaluate gemini-2.5-pro** — when availability improves
- [ ] **Update Railway source repo** — from OpenClawDani → danielesomensi-cmd
- [ ] **Set up Vercel–GitHub auto-deploy**

---

## Non-Negotiable Rules

- Gemini File API for video (NEVER frame-by-frame)
- FastAPI BackgroundTasks (NOT Celery/Redis for MVP)
- pytest required for every new endpoint
- Secrets in .env only
- Conventional commits, push after every feature
- Don't break existing auth
- BoardLib DB gitignored (~189MB file)
- Hold classification data is a proprietary asset — not open sourced
- BLE via Capacitor (native app) — Web Bluetooth insufficient for iOS
- STOP gates on: gemini_service.py, auth, Alembic migrations, video pipeline
