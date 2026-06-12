# Climbritz — Active Roadmap
> Updated: 12 June 2026
> Strategy: AI Climbing Companion — Discovery (free) + Coach (paid)
> Completed-brief detail lives in `PROJECT_STATUS.md`; this file is the forward plan + checklist.

---

## Vision

Climbritz is an AI-powered climbing companion for Kilter Board users. Two tiers, one product:

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

**Key asset:** Proprietary hold classification database — every hold tagged by grip type (jug, good crimp, crimp, sloper, undercling, pinch). No competitor has this.

**Market strategy:** Discovery launches first as free acquisition layer. Coach monetizes serious climbers. BLE via native app (Capacitor). Kilter Board-specific at launch, Aurora expansion later.

---

## Market Context (April 2026)

**Ecosystem split:** Aurora's legacy app (3.3★, laggy) being replaced by kilterboard.io (launched March 2026, early stage). Community fragmented. Neither offers AI, session building, or grip-type filtering.

**Discovery competitors:**

| Tool | What it does | Our advantage |
|------|-------------|---------------|
| Climbdex | Hold filtering, mirrored search. Free, open source. | No grip classification, no session builder, no AI |
| Kilter Lookup | Kilter hold search, campus filter | No AI, no session building, limited filters |
| kilterboard.io | Official new app. Better search, playlists. | No AI, no grip-type filter, no session builder |

**Coach competitors:** Climbah (generic AI), ClimbAI (waitlist), Climbalyzer (3D, beta) — none Kilter-specific with climb context.

**Moat:** No one combines AI + Kilter Board contextual data + proprietary hold classification.

**Target:** Intermediate Kilter Board climbers (V3–V7), train 2–4x/week.

---

## Monetization Strategy

> Council verdict (April 2026).

**Model:** Discovery free (unlimited) → Coach €7.99/month (1 free analysis per signup).

**Why free Discovery:** can't charge for search (Climbdex is free); job is to build habit + funnel to Coach. **Why €7.99:** below the €10 threshold; 1 free analysis removes the need for a trial. Revisit pricing at 50+ paying users.

**Not yet decided:** annual plan, team/gym pricing, refund policy.

---

## Daniele's Action Items (Parallel Track)

> Run alongside Claude Code dev work. Completed deploy items are one-liners; see `PROJECT_STATUS.md` for detail.

**Done:** Apple Developer account ✅ · Clerk dashboard (prod, email+password) ✅ · iOS TestFlight builds 1–5 ✅ · Android AAB builds 4–9 ✅ · B021 Clerk prod auth (Android shipped to Play Console Internal Testing; iOS verified on Xcode debug build) ✅ · **iOS TestFlight build 5** (2026-05-31) — carries the `WKAppBoundDomains` removal (`f435516`) + the Gemini video-analysis `thinking_budget=0` fix; uploaded to App Store Connect (delivery UUID `5034ddc5-…`) ✅

**2026-06-04 BLE pacing fix (`4fae221`):** iOS build 6 ✅ uploaded to App Store Connect (tag `ios-v1.0.0-build6`). Android build 10 AAB signed locally — **still to upload** to Play Console closed testing (`android/app/build/outputs/bundle/release/app-release.aab`).

**2026-06-06 release in volo (B034 v4 + A028 + A027 + admin/alerts):** iOS **build 11** da tagliare (`bash ~/deploy_climbritz.sh 11`; build 10 = A026/A027/B034-v1 già caricato e clippava — B034 v4 è il fix vero, provato sul Simulatore). Android **versionCode 13** AAB ribuildato con v4 (`android/app/build/outputs/bundle/release/app-release.aab`) — **da caricare** su Play Console. ⚠️ Gotcha keychain: il codesign iOS dà `errSecInternalComponent` in automatico → sbloccare il keychain prima del deploy (vedi `docs/ADMIN_RUNBOOK.md`/PROJECT_STATUS).

**Recently shipped — June 2026 (ops/polish, fuori dalle fasi):**
- [x] **A027 Contact tile** — homepage "Send feedback" → mailto nativo (zero backend).
- [x] **A028 BLE preset "All White (max)"** — preset #12, tutti i 476 LED a bianco pieno (max luminosità) accanto al rainbow #11.
- [x] **B034 v4 — homepage iOS safe-area** — causa vera: reset `* { padding: 0 }` non-layerizzato azzerava il `pt-[...]` Tailwind del hero; fix = paddingTop inline + `IosSafeArea` floor 62px. Guard di regressione nel test home.
- [x] **B036 — header Android sotto la status bar** (2026-06-12) — edge-to-edge enforced (targetSdk 36) + `env()` inaffidabile nella WebView; fix = safe-area CSS dual-source (`max(env(), var(--safe-area-inset-*))` iniettate dal plugin built-in SystemBars di Capacitor 8) + `SystemBars: {style:'DARK'}`. Verificato su emulatore API 37 via CDP. iOS invariato. Nel prossimo build mobile batched.
- [x] **A029 — filtro "No matching" in Discovery + badge** (2026-06-12) — toggle "No matching only" nel FilterPanel (`climbs.is_nomatch`, audit D019), pill "NO MATCHING" prominente su `/discover/detail`, chip "No match" sulle card. Vedi 3b sotto.
- [x] **A030 — Save AI-generated problems / My Problems v1** (2026-06-12) — salva i problemi generati (nome AI, grade dal seed), lista/detail `/my-problems` con BLE + logging, merge in Discovery col badge MY. Vedi 3f sotto.
- [x] **A031 — Hold editor + name-on-generate + "AI Create"** (2026-06-13) — nome AI a ogni generazione, editor palette+paint `/create` (anche from blank, BLE live), "Edit holds" sui salvati, rename label-only. Vedi 3f sotto.
- [x] **Admin `GET /api/admin/recent-users`** — chi si iscrive + iOS/Android + attività in-app (Clerk API ⨝ DB). Runbook: `docs/ADMIN_RUNBOOK.md`.
- [x] **Alert nuovi iscritti** — `POST /api/webhooks/clerk` (Svix) → Telegram su `user.created` + welcome email (Gmail SMTP). Serve config one-time (bot/webhook/env Railway).

**Open:**
- [ ] **Play Console** — finish Internal Testing setup (App content / Data safety / Content rating, Store listing assets: 512×512 icon + feature graphic + screenshots).
- [ ] **Write pro climber list** — names + Instagram/YouTube handles of strong Kilter climbers.
- [ ] **Validate hold taxonomy** with Christie — show 20 random hold images, check the 6 categories make sense.
- [ ] **Validate hold classifications** in gym — mobile tool, physically check ambiguous holds (~2-3h).
- [ ] **Record 2-3 test videos** at the board for L1 vs L2 validation gate.
- [ ] **Curate 10-15 public test videos** from Instagram (known climbs, known grades).

---

## Pre-Phase 3 — Hold Classification

> **PREREQUISITE for Discovery.** Without it, Discovery = Climbdex clone.

**Taxonomy (6):** Jug, Good Crimp, Crimp, Sloper, Undercling, Pinch.
**Target board:** 12x12 Original Layout (336 handholds + 153 footholds). Smaller boards are subsets.

| # | Task | Owner | Status |
|---|------|-------|--------|
| HC-1 | Install BoardLib, download Kilter DB + hold images | Claude Code | ✅ |
| HC-2 | Canonical 12x12 board map (annotated, `/board-map`) | Claude Code | ✅ |
| HC-3 | Validate taxonomy with Christie (20 random holds) | Daniele | ⏳ (>80% agreement → confirmed) |
| HC-5 | Mobile classification UI (`/classify`) | Claude Code | ✅ |
| HC-6 | Daniele + Christie classify all holds via `/classify` (in gym) | Daniele | ⏳ |
| HC-7 | Store classifications in canonical DB + apply to board sizes | Claude Code | ⏳ STOP gate |

> HC-4 (AI batch classification) removed — manual classification by experts is faster/cheaper/more accurate for ~336 holds. May revisit AI batch when expanding to other boards. A023 shipped per-user cloud-synced classification (the crowdsource collection layer); HC-7 is the future cross-user canonical aggregation.

### Quick Wins — Video Thumbnails + Replay (B003)
- [ ] Extract frame via ffmpeg → JPEG · serve via API · frontend thumbnail + player · tests

---

## Phase 3 — Discovery + Coach Build (~8 weeks)

### 3b — Climb Search API + Advanced Filters ✅ (core done)
**Done:** name autocomplete · grade range · angle · min ascents · min stars · sort · **moves** chip (A019) · **benchmark** toggle (A022) · **no-matching** toggle + badge (A029, `climbs.is_nomatch` per l'audit D019 — 25.5% del pool; pill "NO MATCHING" sul detail + chip "No match" sulle card) · 500-cap + `total_count` envelope (B020) · climb detail with holds · dual Font/V grade · A021 logging overlay (`user_state`, done/project chips) · A023 hold-classification cloud sync · A024 History redesign (drop calendar, richer stats header) · A025 free-tier AI progress comment in History (on-tap, text-only Gemini) · tests.

**Pending:**
- [ ] Difficulty accuracy filter (deferred) · board size/layout (12x12 only at launch) · setter name (deferred)
- [ ] Additional filters (require hold classification — Pre-Phase 3):
  - **Grip type** (jug/good crimp/crimp/sloper/undercling/pinch)
  - **Session type** (Power 1-4 moves / Power Endurance 5-8 / Endurance 9+)
- [ ] `GET /api/climbs/{id}/similar` — Jaccard on hold sets, same grade/angle different holds

### 3c — AI Session Builder (1-2 weeks)
- [ ] `POST /api/sessions/build` — natural language OR structured input
- [ ] Gemini Flash parses NL → structured query
- [ ] Session types: warmup, 4x4, power endurance, project rehearsal, cooldown, mixed
- [ ] Session logic: warmup → work sets → cooldown, no duplicate holds, grade progression, rest recs
- [ ] Constraints: grip type, angle, grade range, move count, exclude dynos (best effort)
- [ ] `GET /api/sessions/{id}` · `GET /api/sessions` · frontend (chat + dropdown fallback) · tests

### 3d — Enhanced Video Analysis / Level 2 (1-2 weeks)
- [ ] Video upload: optional `climb_id` + `angle`
- [ ] When provided: fetch climb data + hold classifications from DB
- [ ] Build enriched Gemini prompt with full context (grade, angle, grip types per hold, positions, ascents)
- [ ] Structured JSON coaching output (scores, move-by-move, key improvements, training suggestions)
- [ ] Frontend: climb search before upload, structured feedback display · tests
- [ ] **Validation Gate: L1 vs L2 (MANDATORY before Coach launch)** — run 10-15 test videos through both, document whether L2 is visibly better. If not → fix prompt before launch.

### 3e — Capacitor + BLE Integration
**Done:** A006 (Android project + `/ble-test` + presets) · B009 (board preview) · B011 (manifest permissions) · B012 (packet transmission, `kilter-protocol.ts` API level 3) · B014/iter/iter-2 (UX polish + pixel-art presets) · A015 (universal nav + BLE on `/discover/detail`) · A014 (Next/Prev auto-illuminate) · B017 (UX fixes) · A016 (iOS Capacitor setup).

**Pending:**
- [ ] **"Illuminate only [grip type]"** — query hold_classifications → filter hold_ids → LED positions → BLE packet
- [x] Light up generated problems — A026: `/generate` lights the remixed problem via the existing `ClimbBleControls` + `climb-to-leds` stack
- [x] Connection management — **B035**: connessione persistente globale (`BleProvider` nel root layout, `useBle()`), onDisconnect→UI ovunque, resume check read-only. Contratto: MAI disconnect su navigazione/background (solo tap utente), MAI auto-reconnect (galateo palestra)
- [x] ~~Auto-connect on page load + in-session memory of last device~~ — **droppato** per contratto B035 (nessun auto-(re)connect, mai)
- [x] Tests — suite BLE: kilter-protocol · presets · status · ClimbBleControls · ble-test page · BleProvider (B035)

### 3f — Problem Generation (1-2 weeks)
- [x] **v1 Remix (A026)** — `POST /api/climbs/generate` + `/generate` page. Pick a real climb from the filtered pool (same `_build_search_filters` path as Discovery, `min_ascents=5`), swap ≥2 hand holds with same-role candidates within a corpus-derived ε (Phase 0: grid pitch 8 → ε=24) inside role y-bands (start ≤88 / finish ≥144). Same-role 1:1 swaps preserve move count; feet inherited. Pure logic in `services/problem_generator.py`; ephemeral (no persistence); 422 on pool-too-small / can't-reach-2-swaps. Frontend reuses `ClimbBoardView` + `ClimbBleControls`. Filters: angle / grade / moves (stars + benchmark omitted; grip-type disabled "Coming soon"). pytest + jest green.
- [x] **Save/name + persistenza (A030, 2026-06-12)** — "My Problems": migration 006 `user_generated_climbs` (formato BoardLib-compatibile: frames `p{id}r{role}`, `difficulty` numerica + label, `is_listed` per il publishing futuro, `is_nomatch` parità A029), `POST/GET/PATCH/DELETE /api/my-climbs`, nome AI (`problem_name_service`, Gemini text-only 2s + fallback locale — il save non blocca mai), Save one-tap su `/generate` + toast, pagine `/my-problems` + detail (board + BLE + LogSection + edit inline + delete), loggabile come ogni climb (branch nel guard di `POST /api/logs`, sessions History col nome AI), merge in Discovery (`my_problems=include|only`, badge MY, prepend senza toccare il sort BoardLib). **Note:** consolidamento BoardLib→app-DB da rivalutare alla migrazione PostgreSQL (Phase 7); il publishing community (phase 3 del brief) = flip di `is_listed`, nessuna data migration.
- [x] **v2 editor (A031, 2026-06-13)** — name-on-generate (nome AI grande sopra la board a ogni roll, stale guard, "Save as is" persiste il nome visto), hold editor `/create` (palette+paint, BLE live, validazione 1–2 start / 1–2 finish / ≥3 hold client+server), "Start from blank", "Edit holds" sui salvati (PATCH `frames`, log intatti), rename label-only → **"AI Create"**.
- [ ] **v3 (futuro)** — grade-coherence scoring (needs HC-7 grip difficulty), grip-type filtering, foot remix; community publishing (`is_listed` flip), multi-step undo nell'editor, mirrored problems
- [x] ~~Algorithm: select classified holds → validate reachability (x/y) → assign roles~~ → from-scratch ora coperto dall'editor manuale "Start from blank" (A031); la generazione AI from-scratch resta superseded dal remix

### 3g — Recommendation Engine + Attempt Logging (1 week)
- [ ] `GET /api/climbs/recommend` — training queries (hold type, angle, grade, min ascents)
- [ ] Sort by popularity / difficulty accuracy / grip diversity
- [ ] Attempt logging extension: tries, optional note, auto date+session
- [ ] `POST /api/attempts` + `GET /api/attempts` · frontend log button + session history · tests

### 3h — Pro Climber Video Database (1 week)
- [ ] Schema: `pro_climbers` + `curated_videos` (Alembic — STOP gate)
- [ ] Populate with Daniele's list + research
- [ ] Surface pro videos on climb detail ("Watch [climber] send this")
- [ ] Instagram as external links; YouTube via yt-dlp (future) · tests

---

## Phase 3.5 — Soft Launch & Community Validation

**Prerequisites:** Phase 3 complete + Validation Gate passed + Apple Developer account active.

### Discovery Launch (Free — Week 1)
- [ ] Landing page update (value prop, screenshots, CTA)
- [ ] Submit to iOS App Store (TestFlight first) + Android Play Store
- [ ] Post r/kilterboard + r/climbharder · 1 Instagram Reel (build session → light board → climb)
- [ ] Share in Kilter Facebook groups / Discord · **Target: 100 signups in 2 weeks**

### Coach Launch (€7.99/month — Week 3)
- [ ] Stripe: signup → 1 free analysis → paywall
- [ ] Email campaign to Discovery signups · **Target: 5+ paying users in first month**

### Metrics & Success Criteria
- Discovery signups · DAU · BLE connection rate · free→paid conversion (target >5%) · Coach retention
- 100+ signups in 2 weeks → product has pull · 5+ paying in month 1 → monetization works · organic sharing → viral loop · crickets after 2 weeks → re-evaluate positioning

---

## A020 — Clerk Auth Integration

✅ Closed (2026-05-10). Replaced custom-JWT with Clerk-hosted sign-in/sign-up + JWKS verification + shadow-row users table. Promoted to production in B021 (see `PROJECT_STATUS.md`). Architecture detail in `ARCHITECTURE.md` (Authentication Flow); Capacitor origin/cookie playbook in `docs/CLERK_CAPACITOR_AUTH.md`.

---

## Pre-launch Production Prep

> Items that don't block dev but must land before App Store submission / inviting >5 testers.

### B-iOS-oauth-prod — Promote Clerk to Production ✅ DONE (B021, 30 May 2026)
Executed: custom domain `clerk.climbritz.app`, `pk_live`/`sk_live`, email+password auth, per-platform origin fixes. See `PROJECT_STATUS.md` B021 + `docs/CLERK_CAPACITOR_AUTH.md`. Remaining: iOS TestFlight build 5 (see Action Items).

### Post-audit UX polish — D017 deferred (B028–B030) → folded into D018 + shipped in B033 ✅
Source: `docs/audit-2026-05-19/AUDIT_REPORT.md` → re-scoped by the D018 audit (`docs/design-audit-2026-06-04/`). The design-system spec (`DESIGN-SYSTEM-DRAFT.md`) was implemented in **B033 (2026-06-04, 5 phases, → `main`)**. See `PROJECT_STATUS.md` B033.

- [x] **B028 — Coming Soon component + FilterPanel idiom sweep** — FilterPanel idiom unified (all options → the `Chip` primitive, B033 Phase 3). **`ComingSoonBadge` dropped** (per Daniele — 3 occurrences, not worth a component; the 3 existing treatments stand). So D18-4 is closed-by-decision, not by a shared badge.
- [x] **B029 — Design system pass** — token layer (`globals.css @theme static`) + `components/ui/` primitives (Button/Chip/Card/PageHeader/EmptyState/LoadingState/StatusDot) + `lib/ble/status.ts`, adopted page-by-page. B033 Phases 1–4.
- [x] **B030 — Typography lift** — Space Grotesk (display) + Inter Tight (body) self-hosted via `next/font` + `text-*` scale tokens. B033 Phase 5.

**Residual (deferred, non-blocking):** D18-10 residual raw state-colour literals in the LogSection result grid / RecentLogs / session-row icons (semantic tokens defined, those icons not migrated); Recharts axis legibility on a 360px viewport (on-device check, no mobile round this brief); BLE preset LED-art thumbnails (D017-P2-4, optional delight).

---

## Phase 4 — Visual Problem Recognition (Enhancement)

**Goal:** Photo of board with LEDs lit → identify the climb.
**Status (April 2026):** PoC validated — Gemini 2.5 Flash detects LEDs from non-ideal gym photos (start/finish reliable; cyan middle holds hardest). **Approach B (count holds from board edges)** is the leading distortion-immune candidate. Second PoC required before any code. See `RESEARCH.md` → Visual Problem Recognition.

- [ ] **Second PoC — test count-holds prompt** ← PREREQUISITE before any code
- [ ] `POST /api/climbs/identify` (image) · Gemini detects LED positions + colors
- [ ] Filter 1: role fingerprint vs `climbs.frames` · Filter 2: position vs `holes.x/y` · Filter 3: top-3 disambiguation UI
- [ ] Fallback to text search · tests

---

## Phase 5 — Expert Video Comparison (Level 3)

### 5a — Curated Benchmark Database
- [ ] Curate 20-50 expert send videos (YouTube via yt-dlp) · store with metadata · auto-suggest comparison · Alembic STOP gate

### 5b — Dual Video Comparison
- [ ] Upload 2 videos (attempt + reference) · Gemini 2-video + context prompt · side-by-side display · tests

### 5c — Movement Tagging from Video (enables "no dynos" filter)
- [ ] AI tags movement types (dyno, gaston, heel/toe hook, compression, deadpoint) · store per climb · enables movement-style filter
- [ ] Requires accumulated video data — revisit after 100+ analyzed videos

---

## Phase 6 — Training Logs + Progress Tracking
- [ ] Schema: training_logs + climb_attempts · progress charts (grade distribution, send rate, grip breakdown) · link to video analysis · session logger + dashboard · tests

## Phase 7 — Deploy & Polish
- [x] Backend on Railway · Alembic in startCommand · `/health` · frontend on Vercel
- [ ] Railway DB SQLite → PostgreSQL · S3 for video storage · mobile responsive polish · dashboard aggregate stats/streaks

---

## Phase 8+ — Backlog / Visionary

### Circuits & Animated Sequences
> ~517 climbs in BoardLib (0.15%) are animated multi-frame sequences (`frames_count > 1`, `frames_pace > 0`), not static boulders. Popular endurance/training circuits (Pump 540°, Driftwood, etc.) currently excluded from Discovery search. Need different UX, BLE handling, and metadata than boulders.

- [ ] DB integration: `climb_type` derived field (boulder/circuit)
- [ ] Discovery Circuits tab: total duration (`frames_count × frames_pace`), frame count, pace, ascents
- [ ] Circuit detail page: parse `frames`, render each frame, "Play preview" stepping at original pace
- [ ] BLE protocol extension: `sendLEDSequence(frames, paceMs)` + state machine + loop-back + cancel-on-disconnect
- [ ] Frames format research (audit-only first — verify separators, per-frame vs global roles)
- [ ] Move count filter: circuits use frame count, not hold transitions
- [ ] Validation: ≥5 popular circuits match official app behavior

**Prerequisite:** D016 audit (frames format verification) before any implementation.

### Other visionary
- **Outdoor Video → Kilter Movement Matching** — film outdoor → AI describes movement → match annotated Kilter problems (requires Phase 5c + large corpus).
- **Aurora Board Expansion** — Tension Board, Moonboard via BoardLib (hold classification pipeline reusable).
- **Fullride (Homewall) Board Support** — separate hold classification pass (~305 holds).

---

## Backlog — Technical Debt
- [ ] Recreate API_SPECIFICATION.md / DATABASE_SCHEMA.sql (after Phase 3 stabilizes; old versions in `docs/archive/`)
- [ ] Retry with backoff on Gemini 503/429
- [ ] Evaluate a newer model for video analysis. May-2026 scan: **gemini-3.5-flash** (fastest + best video reasoning of the flash tier in an on-video test) and **gemini-3-flash-preview** are the upgrade candidates; **gemini-3.1-pro** leads multimodal overall. All are thinking models — re-verify `thinking_budget=0` behavior on the 3.x family before shipping (current pipeline pins `gemini-2.5-flash`).
- [ ] Update Railway source repo (OpenClawDani → danielesomensi-cmd)
- [ ] Set up Vercel–GitHub auto-deploy
- [ ] B018 — pre/post-task repo-hygiene checks (re-verify `git status` + branch at task start)
- [x] Migrate `google.generativeai` → `google.genai` (B003) · API key → pydantic Settings (B003) · A020 Clerk · clean dead files (B009)

---

## Non-Negotiable Rules
- Gemini File API for video (NEVER frame-by-frame)
- FastAPI BackgroundTasks (NOT Celery/Redis for MVP)
- pytest required for every new endpoint
- Secrets in `.env` only · conventional commits, push after every feature
- Clerk owns identity (don't reintroduce password storage in our DB)
- BoardLib DB gitignored (~189MB) · hold classification data is proprietary, not open-sourced
- BLE via Capacitor (Web Bluetooth insufficient for iOS)
- STOP gates on: `gemini_service.py`, `core/clerk.py`, Alembic migrations, video pipeline
