# Climbritz — Active Roadmap
> Updated: 29 May 2026
> Strategy: AI Climbing Companion — Discovery (free) + Coach (paid)

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
- BLE connection = stickiness (users open Climbritz every session)

**Why €7.99/month Coach:**
- Below €10 psychological threshold
- 1 free analysis removes need for trial period
- Revisit pricing at 50+ paying users (Council suggested €9.99 as alternative)

**Not yet decided:** Annual plan, team/gym pricing, refund policy.

---

## Daniele's Action Items (Parallel Track)

> These run alongside Claude Code development work.

- [x] **Register Apple Developer Account** — approved + active; first iOS device build running via A016 (17 April 2026)
- [x] **Clerk dashboard configured** — Development environment, Frontend API host = sound-cub-94.clerk.accounts.dev, email + password (verification code only, no magic links). Phone/Username/Passkeys disabled.
- [x] **iOS TestFlight first upload** — Climbritz 1.0.0 (build 1) uploaded to App Store Connect via `deploy_climbritz.sh` (19 May 2026). Bundle `app.climbritz`, team `KSD2RSAZP2`, Delivery UUID `2ea1488e-d81f-4dad-9db0-879456377304`. Internal testing pending Apple processing (~10–45 min). App-specific password used in upload to be revoked from appleid.apple.com.
- [x] **iOS TestFlight build 2 upload** — Climbritz 1.0.0 (build 2) uploaded via `~/deploy_climbritz.sh 2` on 19 May 2026, bundling Sprint #1 (B022-B027) + B021 Coach Coming Soon. Delivery UUID `8cd98dc0-b1bd-45c1-bfa5-c57e7049f706`. Deploy script hardened: positional build-number arg + positive-integer validation + `MARKETING_VERSION` hardcoded to `1.0.0` + `CURRENT_PROJECT_VERSION` only overridden when `$1` is provided. **Export compliance auto-resolved from build 3+**: `ITSAppUsesNonExemptEncryption=false` added to `ios/App/App/Info.plist` (commit `5ede347`) so App Store Connect skips the "Missing Compliance" prompt on every new build. Build 2 itself still required the manual click since the flag landed in the repo after upload.
- [x] **B031 — Android 1.0.0 (4) signed AAB built + GitHub Release published** (22 May 2026) — Bumped `android/app/build.gradle` to `versionCode 4` / `versionName "1.0.0"` (commit `5c24c2a`), `NEXT_PUBLIC_MOBILE=true npm run build` → `npx cap sync android` → `./gradlew bundleRelease` produced a 6.7 MB signed App Bundle. AAB verified to contain `web-production-cea9.up.railway.app` with zero `localhost:8001` leaks; `versionCode 4` + `versionName "1.0.0"` confirmed in compiled `AndroidManifest.xml` proto. Signing keystore is the legacy `~/kilter-up-release.keystore` (predates Kilter Up → Climbritz rename) wired via gitignored `android/keystore.properties` — brief's expected `~/climbritz-release.keystore` was a doc drift, not a real blocker. Git tag `android-v1.0.0-build4` pushed; AAB published as GitHub Release asset (private repo) at `https://github.com/danielesomensi-cmd/climbritz/releases/tag/android-v1.0.0-build4` so Daniele can download from any device for Play Console upload. **Pending (manual):** Play Console Internal Testing track setup (App content declarations, Data safety, Store listing, opt-in URL), upload of `app-release.aab`, on-device verification via Android emulator from home.
- [x] **Android 1.0.0 (5) signed AAB rebuilt (A022 + A023)** (28 May 2026) — Bumped `android/app/build.gradle` to `versionCode 5` / `versionName "1.0.0"` (was `versionCode 4` from B031; Play rejects duplicates). First Android build carrying **A022** (benchmark filter) + **A023** (Hold Classification Cloud Sync), after fast-forwarding `main` to `0.1.2`. `NEXT_PUBLIC_MOBILE=true npm run build:mobile` → `npx cap sync android` → `./gradlew bundleRelease` → 7.0 MB signed AAB, signed with `~/kilter-up-release.keystore` via gitignored `android/keystore.properties`. Distributed via Google Drive (`My Drive/Climbritz-builds/climbritz-v1.0.0-build5-20260528.aab`) instead of a GitHub Release this time, since Daniele was at the office without the Mac. **Pending (manual):** Play Console Internal Testing upload + on-device verification.
- [x] **iOS TestFlight build 3 upload (A022 + A023)** (29 May 2026) — Climbritz 1.0.0 (build 3) uploaded to App Store Connect via `~/deploy_climbritz.sh 3`, **bundling A023 Hold Classification Cloud Sync** — first iOS build carrying the cloud-synced `/classify` + Clerk-gated `/api/classifications` surface (alembic 005). Delivery UUID `ef01e812-fb0c-49cb-ba95-03d1a687bb19` (10:39:31 CEST). Export-compliance prompt auto-resolved as predicted (`ITSAppUsesNonExemptEncryption=false`, no manual click). **Signing snag:** the first run from the agent's non-interactive shell failed at the export phase (`No Accounts` / no `iOS Distribution` cert — keychain held only the `Apple Development` dev cert); Daniele's re-run in an interactive Terminal succeeded, since the login session carries the Xcode account + distribution signing. No upload attempt was burned. **App-specific-password convention changed:** the password in `~/deploy_climbritz.sh` is now kept stable for reuse, no longer revoked after each upload. Tag `ios-v1.0.0-build3`. **Pending:** Apple processing → "Ready to Test" (~10–45 min), then on-device A023 smoke test on iPhone (Import JSON → classify a hold → Send my export → cross-device check).
- [x] **Android 1.0.0 (6) — MainActivity package fix (build4/5 launch-crash root cause)** (29 May 2026) — build4 & build5 crashed at launch on Daniele's Galaxy Tab A11+ (SM_X230, Android 16) with `java.lang.ClassNotFoundException: app.climbritz.MainActivity`. **Root cause:** the MainActivity source was still at the legacy package `com.kilterup.app` (residual from the Kilter Up → Climbritz rename) while `build.gradle` `namespace = app.climbritz`; in AGP 8 the manifest's `.MainActivity` resolves against the namespace, so the launcher activity was declared `app.climbritz.MainActivity` but the compiled class was `com.kilterup.app.MainActivity`. NOT a regression from A022/A023 — latent since A006, never surfaced because no Android build had been device-verified before. Diagnosed via adb wireless debugging + logcat crash buffer + dex inspection. **Fix:** moved source to `app/climbritz/MainActivity.java` + `package app.climbritz;`, removed the empty legacy tree (commit `1909da2`). versionCode 6, signed AAB; verified on-device (app launches, Clerk sign-in renders, /classify reachable). Commit `a389b43`, tag `android-v1.0.0-build6`.
- [x] **Android 1.0.0 (7) — Climbritz launcher icon (B-android-icons)** (29 May 2026) — replaced the default Capacitor robot launcher icon with the Climbritz board icon, generated from the iOS source `AppIcon-1024.png` via `@capacitor/assets` (adaptive background `#0f1e36`, matching the icon's navy edge → no box-in-box on adaptive launchers). mdpi→xxxhdpi `ic_launcher`/`_round`/`_foreground`/`_background` + anydpi-v26 adaptive XML. capacitor-assets' out-of-scope side effects (splash regen, iOS `Info.plist`/pbxproj rewrite that stripped the export-compliance comment, AndroidManifest reformat) were all reverted to keep the commit icon-only. Also generated `assets/play-store-icon-512.png` for the Play Console store listing (manual upload, not bundled in the AAB). versionCode 7, signed AAB (SHA256 `0899a4cf…`); icon verified on-device (SM_X230, padding accepted by Daniele). Commit `9c93502`, tag `android-v1.0.0-build7`. **Pending (manual):** upload build7 AAB + 512×512 store icon to Play Console Internal Testing.
- [x] **B021 — Clerk Development → Production promotion + email/password auth** (29 May 2026) — executes the B-iOS-oauth-prod brief below. Promoted Clerk to the **production** instance on custom domain `clerk.climbritz.app` (`pk_live`/`sk_live`; backend JWKS issuer env-driven via `CLERK_JWKS_URL`, `clerk.py` untouched). **Auth model decided: email + password, with the 6-digit email code only at sign-up** — deviates from the brief's original "email-code-only" because the WebView blockers proved solvable and password decouples daily login from flaky new-sender-domain email delivery. Google OAuth + magic links disabled. **Night-long bug "You are signed out":** Clerk prod sets its session cookie `SameSite=Lax` on `Domain=climbritz.app`; the Capacitor WebView ran on origin `https://localhost` (Android) / `capacitor://localhost` (iOS) → cross-site → cookie never sent → clerk-js reported signed-out right after a correct sign-in (dev `pk_test` used a URL token, so dev had worked). **Fix:** `capacitor.config.ts` `server.hostname=app.climbritz.app` + `androidScheme`/`iosScheme=https` → WebView origin is a `climbritz.app` subdomain → cookie is same-site → session persists (also natively satisfies the `pk_live` domain-lock). Diagnosis chain along the way: `origin_invalid` (fixed via Clerk `allowed_origins` += localhost variants + `app.climbritz.app` so clerk-js loads) → `captcha_missing_token` (**Bot protection / Turnstile disabled** — it blocks WebView sign-up before any OTP send) → the `SameSite=Lax` cookie (the real one). Backend CORS (`backend/app/main.py`) now allows `https://app.climbritz.app`; iOS `Info.plist` `WKAppBoundDomains` → `climbritz.app`+`clerk.climbritz.app`+`accounts.climbritz.app` (was the stale dev domain). **Android build 8** (versionCode 8, commit `6bb2a47`, tag `android-v1.0.0-build8`): release-APK login + cold-start persistence + authenticated Discover (86k climbs) all verified on-device (SM_X230); signed AAB ready for Play Console. Commits `952a34c` (fix) + `6bb2a47` (build 8 + iOS plist). **iOS completion (30 May 2026) — the per-platform-origin gotcha:** iOS/WKWebView **ignores `iosScheme:'https'`** (reserves the https scheme), so the iOS WebView origin is **`capacitor://app.climbritz.app`** — NOT `https://` like Android (hostname honored, scheme not). `WKAppBoundDomains` was first repointed to `climbritz.app` but then **removed entirely** (`f435516`): it doesn't cover subdomains, so the app's own origin was non-app-bound → WKWebView refused clerk-js user-script injection → spinner. The 400s persisted because two **separate** allowlists each need **both** per-platform origins: Clerk `allowed_origins` (else `origin_invalid` 400 → spinner) AND backend CORS (`58151d1`, else authenticated API calls fail — surfaced as "Import failed" on `/classify`). Both now carry `https://app.climbritz.app` + `capacitor://app.climbritz.app` + the three localhost variants. iOS verified end-to-end on iPhone via an Xcode **debug** build + Safari Web Inspector (TestFlight isn't web-inspectable): login + session + Import JSON + Discover all work. **New runbook `docs/CLERK_CAPACITOR_AUTH.md`** documents the 3-gate model (Clerk origin / session / backend CORS), the per-platform origin table, the pre-flight checklist, and the Android-adb-vs-iOS-Xcode debugging playbook; the `project-clerk-prod-capacitor-origin` memory has the same. **Pending (manual):** Play Console upload (Android AAB build 8) + iOS TestFlight (`bash ~/deploy_climbritz.sh 5` from Terminal.app — picks up the committed `WKAppBoundDomains` removal).
- [ ] **Write pro climber list** — names + Instagram/YouTube handles of known strong Kilter Board climbers (Daniele's knowledge)
- [ ] **Validate hold taxonomy** with Christie — show 20 random hold images, check if 6 categories make sense
- [ ] **Validate hold classifications** in gym — use mobile validation tool, physically check ambiguous holds (~2-3 hours)
- [ ] **Record 2-3 test videos** at the Kilter Board for L1 vs L2 validation gate
- [ ] **Curate 10-15 public test videos** from Instagram (known climbs, known grades)

---

## Pre-Phase 3 — Hold Classification (NEW — 1.5 weeks)

> **PREREQUISITE for Discovery.** Without this, Discovery = Climbdex clone. With this, it's unique.

**Taxonomy (6 categories):** Jug, Good Crimp, Crimp, Sloper, Undercling, Pinch

**Target board:** 12x12 Original Layout (336 handholds + 153 footholds). Smaller boards (7x10, 8x12) are subsets — automatically covered.

| # | Task | Owner | Effort | Notes |
|---|------|-------|--------|-------|
| HC-1 | ✅ Install BoardLib, download Kilter DB + hold images | Claude Code | 1 day | `kilter.db` + `backend/data/images/` present |
| HC-2 | ✅ Build canonical 12x12 board map (annotated, numbered, mobile-friendly) | Claude Code | 1 day | Composite background + 336 overlay markers, precise empirical crop (`/board-map`) |
| HC-3 | Validate taxonomy with Christie (show 20 random holds) | Daniele | 0.5 day | If >80% agreement → taxonomy confirmed |
| HC-5 | ✅ Build mobile classification UI (`/classify` — free-click flow, board map, localStorage, JSON export) | Claude Code | 1 day | Used directly for manual classification — replaces AI batch step |
| HC-6 | Daniele + Christie classify all holds via `/classify` UI (in the gym, touching holds physically) | Daniele | 0.5–1 day | No AI batch: manual-first. Authoritative source of truth. |
| HC-7 | Store classifications in DB (`hold_classifications` table) + apply to board sizes | Claude Code | 0.5 day | Alembic migration — STOP gate |

> **Note (April 2026):** HC-4 (AI batch classification script) was removed from the plan. Hold classification is done manually by Daniele + Christie using the `/classify` UI (HC-5). The board has ~336 holds — small enough that manual classification by experts is faster, cheaper, and more accurate than building an AI pipeline to be validated anyway. AI batch classification may be revisited later for expanding to other boards (Tension, Moonboard).

---

## Pre-Phase 3 — Quick Wins (unchanged)

### Video Thumbnails + Replay (B003)
- [ ] Extract frame via ffmpeg, save as JPEG
- [ ] Serve thumbnail via API
- [ ] Frontend: thumbnail + video player
- [ ] Tests

---

## Phase 3 — Discovery + Coach Build (NEXT — ~8 weeks)

### 3b — Climb Search API + Advanced Filters (1-2 weeks) (✅ Complete)
- [x] `GET /api/climbs/search` with core filters:
  - [x] Name (autocomplete)
  - [x] Grade range (numeric difficulty) — A011
  - [x] Angle
  - [x] Min ascents / popularity — A011
  - [x] Min star rating (quality) — A011
  - [x] Sort: popularity / quality / grade asc / grade desc — A011
  - [ ] Difficulty accuracy (deferred)
  - [ ] Board size/layout (12x12 only at launch)
  - [ ] Setter name (deferred)
- [x] **Number of moves** — A019. Chip preset (Any / ≤5 / 6–7 / 8–10 / >10), computed at query time as `(cyan_holds + 2)` via `(LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 + 2`. Animated multi-frame sequences (`frames_count > 1`) excluded globally — they're circuits, not boulders. Doesn't depend on hold classification, so promoted out of the "requires hold classification" subsection.
- [x] **Search cap lifted 30→500 + `total_count` envelope** — B020 (on-device validated 2026-05-11). `GET /api/climbs/search` defaults to `limit=500` with hard cap 500 (422 above). Response shape: `{climbs: [...], total_count: int}`. New `count_matching_climbs` sibling shares a `_build_search_filters()` helper with `search_climbs` (count query drops projection-only `difficulty_grades` JOIN). Frontend `/discover` renders the full result list, shows an orange overflow banner ("Mostro i primi N di M risultati. Restringi i filtri per essere più preciso.") when `total_count > climbs.length`. `ClimbCard` wrapped in `React.memo`; `filtered-list-storage.ts` already cap-free (500 uuids ≈ 18 KB). Closes the long-standing user-visible bug where Next/Prev on `/discover/detail` ran out at 30 climbs no matter how many actually matched the filter. **On-device verification:** broad-filter search scrolls, overflow banner renders, Next/Prev walks the full list end-to-end (Daniele).
- [x] **A023 Hold Classification Cloud Sync + Crowdsource Growth** — `/classify` moved off localStorage onto a per-user backend table `user_hold_classifications` (alembic 005, FK→users ON DELETE CASCADE, unique `(user_id, placement_id)`, no x/y columns) so verdicts sync across web ↔ iOS ↔ Android under one Clerk identity. New Clerk-gated `/api/classifications` surface: `GET` list, `PUT {placement_id}` upsert, `DELETE {placement_id}` (idempotent), `POST /import` merge-upsert (preserves unsent rows, caps 1000, tolerates+ignores export `x`/`y`). `/classify` hydrates from the backend on mount (localStorage demoted to a write-through cache, backend wins when non-empty, no auto-migration), optimistic upsert/delete with rollback toast, two growth banners (verbatim English), "Send my export" (clipboard + `mailto:daniele.somensi@gmail.com`) and "Import JSON" (Daniele's account bootstrap — same path every user uses). Coords still joined frontend-side from `placements_12x12.json` at export. Per-user only — cross-user aggregation into a canonical map stays the future HC-7 brief. **STOP gate honored:** migration printed + validated on a throwaway DB, `alembic upgrade head` left for Daniele. 11 backend + 5 frontend tests. Backend 231 + frontend 307 green; tsc + web + mobile builds clean. **Fully shipped: web ✓ (Vercel) + iOS ✓ (TestFlight build 3, 29 May 2026, Delivery UUID `ef01e812-fb0c-49cb-ba95-03d1a687bb19`) + Android ✓ (signed AAB build 5, 28 May 2026).** **✅ Verified end-to-end on iPhone (TestFlight build 3, 29 May 2026):** Daniele tested Import JSON + reload persistence (backend hydration survives restart) + new-hold upsert on-device — all working.
- [x] **A021 Climb logging + history (Phases 1–5)** — new `climb_logs` + `user_climbs` tables (alembic 004), endpoints under `/api/logs`, `/api/user-climbs`, `/api/stats`. Sessions endpoint resolves climb name + grade server-side (A021.5.0). Search overlay enriches each result with `user_state` when authenticated; `done_filter` / `project_filter` chip params drive the Done / Project chip rows on Discovery. **Phase 3:** LogSection (5-col single row) + RecentLogs on `/discover/detail`, modal closes on Android back via `@capacitor/app`. **Phase 4:** StateIcons (⚡/✓/★) on Discovery cards, tri-state chip filters above the Filters toggle, sessionStorage forward-compat. **Phase 5:** `/history` page — hand-rolled CSS-grid calendar heatmap (no extra dep), sessions list with click-through to `/discover/detail`, Recharts 3.8.1 horizontal-bar grade pyramid + line trend chart with toggleable series. Homepage gets a 5th 📊 History tile. All authenticated requests carry `X-User-Timezone` (IANA). UI strings are English across the board (translation pass after Phase 4 gym validation). Backend 218 tests, frontend 282 tests — all green, web + mobile builds clean.
- [x] **A021 closeout — 6 follow-up doc/UX items** (2026-05-12, commit f09f8ae). (1) CLAUDE.md API surface documents Logs / User-climbs / Stats / Search overlay endpoints. (2) CLAUDE.md project tree indexes every A021 file (api/, models/, schemas/, services/, alembic 004, app/history/*, StateIcons/LogSection/RecentLogs). (3) ARCHITECTURE.md gains Logs/Stats/Log Service rows, climb_logs + user_climbs in the Database table, and two new ASCII flow diagrams (climb logging request flow + /history page composition). (4) Code Standards (CLAUDE.md) pins the English-UI rule — anchors `feedback_ui_english.md` memory to prevent regressions. (5) `app/page.tsx` — Debug tile gated by `IS_PRODUCTION_BUILD` (`NEXT_PUBLIC_MOBILE === 'true'` OR `NODE_ENV === 'production'`); `/debug` URL still routable. (6) `BottomNav` — History inserted as 3rd slot (Home / Discover / History / Coach / Profile), `grid-cols-4 → grid-cols-5`, daily-use flow Discover → log → History reads left-to-right. Tests cover all 5 testids + `/history` active state. Backend 218 + frontend 282 green; tsc clean; pre-push mobile build green.
- [x] **B-A021-fix-2 StateIcons overlap regression** (2026-05-11) — the absolute-positioned StateIcons wrapper from Phase 4.1 (`<div className="absolute top-2 right-3">`) was overlapping the Angle column on every Discovery card with state, clipping "ANGLE" / "40°". Fix moved the strip INSIDE the info column as a new row below stars/ascents (uses `mt-1 empty:hidden` so cards without state stay visually identical). Two regression tests lock the new position in: one with `within(infoColumn).getByTestId('state-icons')`, one asserting the wrapper's className does NOT contain `absolute`.
- [x] **B-A021-fix-1 (Round 1 + Round 2) — LogSection layout + iOS scroll fix + UI shrink + .pb-nav utility** — shipped 2026-05-11, Vercel re-validated. **Round 1 (3 commits):** scroll-behavior smooth removed from globals.css (root cause of iPhone Safari snap-to-top under async layout shifts); min-h-screen → min-h-dvh on `/discover/detail` to neutralise iOS address-bar viewport changes; LogSection collapsed from 2 rows to single grid (5 cols with Remove, 4 without); Next/Prev relocated above Coach in the action area. **Round 2 (4 commits) after re-validation surfaced Favorite-half-cut-by-BottomNav:** LogSection buttons min-h-16 → min-h-12 (icon text-xl, label text-[10px], gap-0); board wrapped in mx-auto max-w-[280px]; climb-name h1 text-2xl → text-xl; new `.pb-nav` utility in `app/safe-area.css` (`calc(6rem + env(safe-area-inset-bottom))`) replacing pb-24 across `/discover/detail`, `/discover`, `/classify`, `/ble-test`. Single source of truth for BottomNav clearance. Both rounds together: 7 atomic commits, 0 test regressions (frontend 242 green throughout).
- [x] **Benchmark filter** — A022. Boolean "Benchmarks only" toggle at the top of `FilterPanel`. Backend: optional `benchmark` query param on `GET /api/climbs/search` → `AND cs.benchmark_difficulty IS NOT NULL` on the shared `_build_search_filters()` (respected by both `search_climbs` and `count_matching_climbs`). **Angle-specific by DB design** — `benchmark_difficulty` lives on `climb_stats` keyed by `(climb_uuid, angle)` and Discovery always sends `angle`, so the filter means "benchmark at the selected angle". A **Phase 0.5 read-only audit** ran before any code to validate the model empirically against the live BoardLib DB: 93.4% of the 412 benchmark climbs are benchmark at ≤3 distinct angles (max 5; none at all 11), and a climb's grade itself varies per angle (*swooped*: 5b/V1 at 5° → 7a+/V7 at 50°, benchmark only at 40° + 50°). Single boolean, not tri-state — "exclude benchmarks" isn't a real user need. `countActiveFilters()` counts it; URL param + sessionStorage forward-compat. Fixtures seeded by `backend/scripts/seed_a022_test_fixtures.py` (idempotent) — Alpha@40 + Crimp@40 benchmarked, Alpha@45 NULL to prove angle-specificity. Backend 229 + frontend 302 green; web + mobile builds clean.
- [ ] Additional filters (requires hold classification — Pre-Phase 3):
  - **Grip type** (jug/good crimp/crimp/sloper/undercling/pinch) — from hold classification
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
- [x] **A006:** Capacitor Android project setup, BLE permissions, `build:mobile` script
- [x] **A006:** `@hangtime/grip-connect` KilterBoard + `/ble-test` page — 10 LED presets (real positions from `leds` table), connect/disconnect
- [x] **B009:** Visual board preview — board image + colored circles at correct hold positions (coords from product_size_id=10)
- [x] **B011:** Fix Android manifest BLE permissions — bounded location permissions to maxSdkVersion=30
- [x] **B012:** BLE LED packet transmission — pure encoder (`kilter-protocol.ts` API level 3), `sendLEDPreset`/`sendAllOff` in service, "Illumina board" button + error banner, 22 encoder unit tests
- [x] **B014:** `/ble-test` UX polish — auto-apply preset on tap with 200ms debounce (BLE writes serialized via hook-level promise chain), enlarged Connetti/Disconnetti buttons, creative presets #6-#10 replacing legacy test patterns (DANI in red, climber, heart, lightning bolt, smiley face) authored on the 17×18 main-hold grid
- [x] **B014-iter:** Preset visual fixes after gym validation — climber redrawn with asymmetric reaching pose, heart uniform red+magenta (no white shine), lightning extended to near-full-board-height zigzag, smile enlarged to 11×11 rounded face with unambiguous eyes + U-shape smile
- [x] **B014-iter-2:** Art presets overhaul — replaced diagnostic presets #1-#5 with pixel art (Space Invader green, Ghost Blinky red + white/cyan eyes, Zelda Heart mono-red 8-bit, yellow 5-point Star, orange-centre + yellow-rays Sun) + added preset #11 All LEDs Diagnostic stress test (476 LEDs cycling through 8-colour rainbow y-bands)
- [x] **A015:** Universal BottomNav on `/classify` and `/ble-test` + BLE illumination on `/discover/detail` — `ClimbBleControls` component (reuses `use-kilter-ble` hook), `climb-to-leds.ts` helper, static `app/data/leds_12x12.json` (476-entry placement_id → LED position map). Connetti → Illumina board → role colors sent via existing `kilter-protocol.ts` encoder.
- [x] **A014:** Next/Prev navigation on `/discover/detail` with auto-illuminate when connected — `filtered-list-storage.ts` (sessionStorage, 24h TTL), `← Prev / N of M / Next →` row, `ClimbBleControls.climbKey`+`autoSendOnKeyChange` props with 300ms debounce so rapid taps coalesce. Deep links hide the row.
- [x] **B017:** Discovery UX fixes after gym validation — (1) Prev/Next buttons on `/discover/detail` enlarged to card-sized tap targets (`min-h-16`, `text-xl font-bold`); (2) app-wide safe-area sweep — `.pt-safe`/`.pb-safe` utilities in `app/safe-area.css` (separate from globals.css because Tailwind v4 strips plain class rules from the Tailwind entrypoint), `viewport-fit=cover` in `app/layout.tsx`, applied to all 12 pages + BottomNav; (3) Discovery filter state persists in sessionStorage (`climbritz:discover:filters`, 24h TTL) so filters restore on return from detail. URL params still win on mount for shareable deep links; (4) prominent Filters button — full-width 56px-tall toggle in the sticky `/discover` header, brand-orange + count badge when any filter is active (grade range, min ascents, min stars, or non-default sort). Panel `expanded` state lifted to `DiscoverPage`; `countActiveFilters()` exported for reuse.
- [x] **BLE scan → light up a problem from search results** — shipped as part of A015: user flow is tap climb in `/discover` → Connetti → Illumina board. Remaining work: auto-connect on page load (future), in-session memory of last-connected device (future).
- [ ] **"Illuminate only [grip type]"** — query hold_classifications → filter hold_ids → map to LED positions → send BLE packet
- [ ] Light up generated problems
- [ ] Connection management (reconnect, error states, disconnect on background)
- [x] **A016:** iOS Capacitor setup — `@capacitor/ios ^8.3.1`, `ios/` Xcode project initialized (SPM-based, no CocoaPods), `NSBluetoothAlwaysUsageDescription` in Info.plist, build scripts split (`build:mobile` + `sync:ios`/`sync:android`/`open:ios`/`open:android`), first device build running on iPhone 15 (iOS 26.2)
- [ ] Tests

### 3f — Problem Generation (1-2 weeks)
- [ ] `POST /api/climbs/generate` — constraints: grip types, move count, grade target, angle
- [ ] Algorithm: select holds from classified DB → validate reachability (x/y distances) → assign roles (start/middle/finish/foot)
- [ ] Generate valid layout string (internal to Climbritz only — not shared to Kilter community)
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

## A020 — Clerk Auth Integration (Identity Foundation)

**Status:** ✅ Closed (2026-05-10) — PR #1 (b918e35) + hotfix PR #2 (a0f799d) + mobile API_BASE precedence PR #3 (985b8ea). Android tablet ✅, iPhone 15 ✅, Railway env vars ✅. Only Vercel env vars remain (Daniele's dashboard work, not required to ship).

> Replaces the legacy custom-JWT auth stack (auth.py, auth_service.py, security.py, schemas/auth.py + bcrypt) with Clerk-hosted sign-in/sign-up. Identity, password storage, MFA, OAuth, password-reset, and email-verification all move out of our codebase. 18 commits via `feat/a019-clerk-auth` (commit prefixes A019.1–A019.18).

- **Backend:** `core/clerk.py` verifies Clerk JWTs via JWKS; `deps.get_current_user_id` accepts `Authorization: Bearer <Clerk JWT>` or (dev/test only) `X-User-ID: <uuid>`. Both `videos.py` and `admin.py` swapped to the new dependency.
- **Backend startup guard:** `core/config.py` raises at construction if `ENVIRONMENT=production` and `CLERK_JWKS_URL` is empty. `extra="ignore"` so legacy `JWT_SECRET` in local `.env` doesn't crash Settings.
- **Schema:** `users` reduced to `(id, clerk_id, created_at, updated_at)` — alembic 003 wipes `video_uploads` (zero real users), drops + recreates `users`, leaves the unnamed FK from `video_uploads.user_id` intact since `users.id` still exists. `downgrade()` raises `NotImplementedError` (bcrypt hashes unrecoverable).
- **Frontend provider:** wrapped in `ClerkSpaProvider` (uses `@clerk/clerk-react`, not `@clerk/nextjs` — the Next variant pulls in server-actions.js incompatible with `output: 'export'`).
- **Frontend pages:** `/sign-in` + `/sign-up` render Clerk widgets with `routing="hash"` to avoid the catch-all `[[...sign-in]]` (incompatible with static export). `/login` → 1-line redirect alias to `/sign-in`. Homepage tile points at `/upload` (since user is signed in by the time they see the homepage).
- **Protected page coverage (A019.16):** ALL pages require login except `/sign-in`, `/sign-up`, `/privacy`, `/debug`. AuthGuard now wraps homepage, `/discover`, `/discover/detail`, `/ble-test`, `/classify`, `/board-map` in addition to the originally-planned `/dashboard`, `/upload`, `/videos/detail`. Discovery is still the free tier (no payment) but no longer anonymous — A021 logging (send/project) requires a guaranteed user_id, and a guest mode would be a confusing dead-end.
- **Route protection mechanism:** client-side via `AuthGuard.tsx` using `useAuth()`. NO `middleware.ts` — `clerkMiddleware` is incompatible with `output: 'export'` (Clerk issue #4647 closed "not planned"). Backend JWT verification is the actual security boundary; AuthGuard is UX glue.
- **API client:** `app/lib/api.ts` no longer reads `localStorage.kilter_token`. Each call calls `window.Clerk.session.getToken()` for a fresh JWT. 401-retry-once-then-redirect-to-/sign-in. Legacy `login`/`register`/`getMe` exports removed.
- **Dashboard sign-out:** uses `<UserButton afterSignOutUrl="/sign-in" />` from `@clerk/clerk-react`.
- **iOS B-medium:** `Info.plist` gains `WKAppBoundDomains = [sound-cub-94.clerk.accounts.dev]` so production WKWebView keeps Clerk handshake URLs in-app instead of punting to Safari. `capacitor.config.ts` `server.allowNavigation` includes `*.clerk.accounts.dev` and `*.clerk.com`.
- **Tests:** 13 new backend tests in `test_clerk_auth.py` (verification, shadow-row upsert with TTL, dep gating). 5 new frontend tests across `AuthGuard.test.tsx` (loading / redirect / render-children) + `discover/__tests__/page.test.tsx` (auth-gating: redirect on signed-out, spinner while loading). 5 existing page tests gained Clerk mocks. Final counts: backend 151 / frontend 203, both green; `npm run build` and `NEXT_PUBLIC_MOBILE=true npm run build` clean; iOS sync clean.
- **Deps:** added `PyJWT[crypto]>=2.10.0`, `@clerk/clerk-react@^5.61.6`, `@clerk/nextjs@^6.39.3`. Removed `python-jose[cryptography]`, `passlib[bcrypt]`, `bcrypt`. Bumped `next` to `^14.2.25` for Clerk peer-dep floor.
- **Env vars:** add `CLERK_JWKS_URL` / `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` (backend), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (frontend). Removed `JWT_SECRET` from `.env.example` (still tolerated in local `.env`).
- **CI fix (A019.18):** `.github/workflows/test.yml` `Next.js build` step gained `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_…` inline. ClerkSpaProvider throws on missing key by design (no silent unprotected build); CI doesn't load `.env.local` so the throw fired during prerender. Inline matches existing JWT_SECRET / GEMINI_API_KEY pattern.
- **Web verification (Vercel preview):** sign-up + sign-in + sign-out flow validated end-to-end. Post-login redirect lands on `/dashboard` by default; for `/` landing, set `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/` and `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/` in Vercel env (Production + Preview + Development). Already in local `.env.local`.
- **Android device verification (2026-05-10) ✅:** APK v0.1.1 build 3 sideloaded on Daniele's tablet via Drive. Sign-in via Google OAuth works (the OAuth flow correctly punts to external Chrome for the Google identity step then returns to the app — this is anti-phishing behavior all OAuth providers enforce, NOT a Capacitor/`allowNavigation` bug). Once signed in: homepage 4-tile renders, Discover loads list of climbs, Demo LED renders, Classify renders, Dashboard shows "Nessun video ancora" (= Railway is accepting the Clerk JWT, no 401).
- **Mobile API_BASE precedence hotfix (2026-05-10):** discovered during build #2 testing that `app/lib/api.ts` was reading `NEXT_PUBLIC_API_URL` (set to `http://localhost:8001` in `.env.local` for web dev) ahead of the `NEXT_PUBLIC_MOBILE` switch — leaking the local URL into the APK and silently breaking every backend call. Fixed by inverting precedence: when `NEXT_PUBLIC_MOBILE=true` the Railway URL is hardcoded and `NEXT_PUBLIC_API_URL` is ignored. Verified by grepping for `web-production-cea9` and absence of `localhost:8001` in the rebuilt APK chunks. Updated `.env.example`, `CLAUDE.md` (Capacitor rule #3), `ARCHITECTURE.md`. APK bumped to versionCode 3.
- **Railway env vars ✅ (2026-05-10):** `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ENVIRONMENT=production` confirmed set by Daniele the night before. Backend Dashboard call from the Android APK returns 200 (= JWKS verification + shadow-row upsert + endpoint dependency injection all working in prod).
- **iOS device verification ✅ (2026-05-10):** iPhone 15 connected via USB-C, Xcode Run (Apple Developer team `daniele.somensi@icloud.com`, automatic signing, bundle id `app.climbritz`). Google OAuth opens an in-app `SFSafariViewController` (the in-app browser with the "Done" button), completes Google identity, returns to the WebView with the Clerk session attached. **`WKAppBoundDomains = [sound-cub-94.clerk.accounts.dev]` (`ios/App/App/Info.plist:60-63`) confirmed working** — without it the OAuth redirect would have punted to standalone Safari and broken the auth context. Post-login: homepage + Discover + Demo LED + Classify + Dashboard all render with Clerk JWT accepted by Railway.
- **Pending (Daniele's dashboard work, not blocking):**
  - **Vercel env vars:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/`, `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/` — all three environments (Production + Preview + Development). Required when promoting from `pk_test_*` to `pk_live_*` Clerk keys; current Vercel Preview already auths fine without these because Daniele's local-built bundles include them via `.env.local`.

---

## Pre-launch Production Prep

> Items that don't block dev/testing but must land before App Store submission or before inviting >5 beta testers. Grouped here so launch prep is one checklist, not scattered across phase backlogs.

### B-iOS-oauth-prod — Promote Clerk to Production environment + fix iOS OAuth UX

**Status:** Deferred until launch prep
**Trigger:** When ready to invite real beta users (>5 testers) or before App Store submission
**Effort:** 4-8 hours (Phase 0 audit complete, see this commit)

**What it solves:**
- iOS Clerk session does not persist across cold app launches (WKWebView ITP purges localStorage on `capacitor://localhost` because it's not in `WKAppBoundDomains` and dev-mode Clerk has no first-party HttpOnly cookie to fall back on)
- OAuth Google flow throws "Invalid URL scheme" mid-flow on iOS (Capacitor origin not registered in the Clerk dev instance's `allowed_origins`), requires manual workaround (close Safari, retap login → Clerk SDK picks up the partially-completed session ~5s)
- Both issues vanish in Production Clerk environment because of first-party HttpOnly cookies on the customer's FAPI domain (no third-party ITP problem) and because production accepts the customer's own redirect URLs by design

**Required steps:**
1. Acquire/configure custom domain (e.g. `clerk.climbritz.app`) with CNAME records per Clerk dashboard instructions
2. Create production OAuth credentials in Google Cloud Console (Clerk's shared dev creds aren't allowed in prod)
3. Configure prod Clerk instance via dashboard, generate `pk_live_*` + `sk_live_*` keys
4. Swap `pk_test_*` → `pk_live_*` across: Vercel env vars, Railway env vars, local `.env.local` (3 places — see A020 closeout for the exact var list)
5. Update `WKAppBoundDomains` in `ios/App/App/Info.plist` + `capacitor.config.ts` `allowNavigation` to point to the new prod Clerk Frontend API host
6. Re-test full OAuth flow on iOS + Android (regression check); confirm cold-start session persistence on iPhone

**Out of scope until trigger:** any band-aid Fix A patches in dev mode (`allowed_origins` PATCH, custom URL scheme registration, `iosScheme: "https"` swap). Production env makes them unnecessary — doing them now would be wasted work.

**Phase 0 audit reference:** see commit `docs: log A019 ship status + B-iOS-oauth-prod backlog entry`. Full source citations + 3-fix-path comparison are in the Claude Code session that produced this entry. Decision was Fix C (defer A, plan B for launch).

### Post-audit UX polish — D017 deferred findings

Three brief candidates surfaced by the D017 audit (`docs/audit-2026-05-19/AUDIT_REPORT.md`) but deferred from Sprint #1 (B022-B027). Sprint #1 covered the 4 P0 fixes + 2 high-impact P1 fixes; these three are larger/more-strategic and benefit from beta feedback before implementation.

**B028 — Coming Soon component + FilterPanel idiom sweep (M)**
- Unify "Coming Soon" treatment across the app (homepage Video Analysis badge from B021, FilterPanel GRIP TYPE inline-orange text, any other surface that needs a "not yet available" signal).
- Sweep the FilterPanel for idiom inconsistency — the panel currently mixes chip rows (DONE / PROJECT / MOVES / MIN ASCENTS / MIN STARS / SORT BY) with dropdowns (GRADE RANGE Min/Max) and disabled-checkbox group (GRIP TYPE). Pick one or two idioms, apply consistently.
- Trigger: after first round of beta feedback identifies which Coming-Soon features get the most "when?" questions.

**B029 — Design system pass (M)**
- Catch-all for D017 P2 findings: status color tokens, CTA shape inconsistency, page-title sizing, BottomNav rationale, homepage orphan tile structure.
- Goal: codify the existing implicit design language into explicit Tailwind tokens + a small component library (Card, Chip, Button, PageHeader, EmptyState) that the rest of the app reuses.
- Trigger: before App Store submission. Without this, every future feature risks adding more drift.

**B030 — Typography lift (M, post-beta)**
- Replace generic system font with a curated typeface (Geist Sans / Inter / similar). Define type scale tokens (display, h1, h2, body, caption).
- Trigger: post-beta, when the rest of the visual language is stable. Doing this earlier risks redoing it once design system pass (B029) lands.

Source: `docs/audit-2026-05-19/AUDIT_REPORT.md` commit af247c6.

---

## Phase 4 — Visual Problem Recognition (Enhancement)

**Goal:** Photo of Kilter Board with LEDs lit → system identifies the climb.

**Status (April 2026):** PoC validated — approach under evaluation. Second PoC required before any code is written.

### PoC Results (April 2026)

Gemini 2.5 Flash validated as capable of detecting LEDs from a non-ideal gym photo. Start/finish holds detected reliably; cyan middle holds are hardest (missed or hallucinated). Single-pass insufficient — multi-pass or disambiguation needed. **Approach B (count holds from board edges)** is the leading coordinate mapping candidate — immune to perspective distortion.

See `RESEARCH.md` → "Visual Problem Recognition — PoC Results" and "Coordinate Mapping" sections for full test results, approach comparison, and coordinate system details.

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

### Circuits & Animated Sequences

> Discovered during D015 circuit audit (April 2026). ~517 climbs in BoardLib (0.15% of layout_id=1) are animated multi-frame sequences, not static boulders. They have `frames_count > 1` and `frames_pace > 0` (typical pace 1–60 seconds between frames). Notable examples: Pump 540°, Driftwood, Hultqvist's no 3, Please don't sandback me! These are popular endurance/training circuits with hundreds of ascents — high-value content currently untreated.

**Why this is a separate phase:** circuits need different UX, different BLE handling, and different metadata than boulders. Stuffing them into the boulder filter UX would confuse both categories.

- [ ] **DB integration:** treat `frames_count > 1` rows as a distinct category. Add a `climb_type` derived field (boulder / circuit) at the API layer. Today they are silently mixed in Discovery results.
- [ ] **Discovery UI — Circuits tab:** separate listing in Discovery with circuit-specific filters (total duration = `frames_count × frames_pace`, frame count, pace, ascents). Default Discovery shows boulders only; circuits accessed via tab or chip.
- [ ] **Circuit detail page:** parse the comma-separated `frames` field into N frames, render each as a board visualization, show pace and total duration. "Play preview" button steps through frames in the browser at the original pace.
- [ ] **BLE protocol extension:** today `kilter-protocol.ts` encodes a single LED state and ships it in one packet sequence. For circuits we need to (a) encode N frames, (b) ship them sequentially with `frames_pace` ms between writes, (c) handle the loop-back at the end of the sequence, (d) cancel on disconnect/back-button. This requires a new `sendLEDSequence(frames, paceMs)` method in `kilter-board-service.ts` plus state machine extension in `use-kilter-ble.ts`.
- [ ] **Frames format research:** before any code, document the exact format of multi-frame `frames` strings (D015 noted commas as separators but this needs full verification — are quoted segments significant? are roles per-frame or global?). Audit-only first.
- [ ] **Move count filter compatibility:** circuits are excluded from the boulder move count filter (handled in Brief A via `frames_count = 1`). For circuits, "moves" semantics is different — it's the number of frames, not hold transitions.
- [ ] **Validation:** test with at least 5 popular circuits (Pump 540°, Driftwood, Hultqvist's no 3, Please don't sandback me!, BFF (20moves)) to confirm the BLE animation matches the official Kilter Board app behavior.

**Out of scope (now):** circuit *generation* (AI-built endurance loops), circuit *editing*, sharing user circuits to Kilter community.

**Prerequisite:** D016 audit (frames format verification + corrected boulder distribution) must complete before any implementation work starts here.

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
- [x] **A020:** Replace custom-JWT auth with Clerk (hosted sign-in/sign-up, JWKS verification, shadow-row users table)
- [ ] **Recreate API_SPECIFICATION.md** — after Phase 3 stabilizes
- [ ] **Recreate DATABASE_SCHEMA.sql** — after Phase 3 stabilizes
- [ ] **Retry with backoff on Gemini 503/429** — fails immediately on transient errors
- [x] **Clean up dead files** — Procfile, railway_start.sh, backend/Procfile (removed in B009)
- [ ] **Evaluate gemini-2.5-pro** — when availability improves
- [ ] **Update Railway source repo** — from OpenClawDani → danielesomensi-cmd
- [ ] **Set up Vercel–GitHub auto-deploy**
- [ ] **B018:** Pre-task/post-task repo-hygiene checks — queued after B017. Session-start gitStatus snapshot was stale (claimed dirty tree + wrong branch), triggered a defensive Phase 0 that turned out moot. Agent should re-verify `git status` + current branch at the start of every non-trivial task.

---

## Non-Negotiable Rules

- Gemini File API for video (NEVER frame-by-frame)
- FastAPI BackgroundTasks (NOT Celery/Redis for MVP)
- pytest required for every new endpoint
- Secrets in .env only
- Conventional commits, push after every feature
- Clerk owns identity (don't reintroduce password storage in our DB)
- BoardLib DB gitignored (~189MB file)
- Hold classification data is a proprietary asset — not open sourced
- BLE via Capacitor (native app) — Web Bluetooth insufficient for iOS
- STOP gates on: gemini_service.py, core/clerk.py, Alembic migrations, video pipeline
