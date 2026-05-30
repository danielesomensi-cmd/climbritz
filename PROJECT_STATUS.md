# 📋 CLIMBRITZ — Project Status & Decisions Log

> **Questo file è la fonte di verità del progetto.**
> Aggiornato da Claude Code ogni volta che si prende una decisione importante.
> Leggi questo PRIMA di fare qualsiasi cosa sul progetto.

---

## 🗓️ Ultimo Aggiornamento: 29 Maggio 2026 (B021 — **Clerk Development → Production promotion + email/password auth**: custom domain `clerk.climbritz.app` (`pk_live`/`sk_live`), email+password with the 6-digit code only at sign-up (Google OAuth + magic links + bot-protection disabled). The hard bug — Clerk prod's `SameSite=Lax` session cookie on `Domain=climbritz.app` was cross-site to the WebView's `https://localhost` origin → "You are signed out"; fixed by serving the WebView on `app.climbritz.app` (`capacitor server.hostname` + `androidScheme`/`iosScheme=https`) so the cookie is same-site. Backend CORS allows `https://app.climbritz.app`; iOS `WKAppBoundDomains` → `climbritz.app`. **Android build 8** (versionCode 8, tag `android-v1.0.0-build8`) — login + cold-start persistence + Discover verified on the signed release on Galaxy Tab A11; AAB ready for Play Console. **iOS rebuild pending** (`bash ~/deploy_climbritz.sh 4` from Terminal). — same day earlier: Android build6+7 — **MainActivity package fix** (root cause of build4/5 launch-crash `ClassNotFoundException`, latent since A006) + **Climbritz launcher icon** replacing the default Capacitor robot; both device-verified on Galaxy Tab A11+, AAB build7 pushed (tag `android-v1.0.0-build7`). Same day, earlier: iOS TestFlight build 3 upload — Climbritz 1.0.0 (build 3) pushed to App Store Connect via `~/deploy_climbritz.sh 3`, **A023 Hold Classification Cloud Sync bundled**. Delivery UUID `ef01e812-fb0c-49cb-ba95-03d1a687bb19`. Export-compliance prompt auto-resolved (`ITSAppUsesNonExemptEncryption=false`, no manual click). App-specific-password convention changed: now kept stable for reuse in `~/deploy_climbritz.sh`, no longer revoked per upload. Tag `ios-v1.0.0-build3`.) — prev: 28 Maggio 2026 (A023 — Hold Classification Cloud Sync + Crowdsource Growth: `/classify` moved off localStorage onto a per-user backend table (`user_hold_classifications`, alembic 005), new Clerk-gated `/api/classifications` surface, backend hydration + write-through cache, growth banners + Send/Import buttons. Backend 231 + frontend 307 green; tsc + web + mobile builds clean)

---

## 📊 STATO ATTUALE

| Componente | Status | Note |
|------------|--------|------|
| B021 Clerk production + email/password auth | ✅ Done — Android + iOS — 2026-05-29/30 | Clerk promoted Dev→Production on custom domain `clerk.climbritz.app` (`pk_live`/`sk_live`; backend JWKS env-driven, `clerk.py` untouched). **Auth model: email + password, 6-digit email code only at sign-up** — Google OAuth, magic links and bot-protection (Turnstile) all disabled. **Root cause of the night-long "You are signed out":** Clerk prod's session cookie is `SameSite=Lax` on `Domain=climbritz.app`; the Capacitor WebView ran on `https://localhost` / `capacitor://localhost` → cross-site → cookie dropped (dev `pk_test` used a URL token, hence dev worked). **Fix:** `capacitor.config.ts` `server.hostname=app.climbritz.app` + `androidScheme`/`iosScheme=https` → WebView origin is a `climbritz.app` subdomain → cookie same-site → session persists (also satisfies the `pk_live` domain-lock). Clerk `allowed_origins` += `app.climbritz.app`; backend CORS (`main.py`) allows `https://app.climbritz.app`; **Android build 8** (versionCode 8, commit `6bb2a47`, tag `android-v1.0.0-build8`): release login + cold-start persistence + authenticated Discover (86k climbs) verified on SM_X230; signed AAB ready for Play Console. **iOS resolution (2026-05-30) — the per-platform-origin gotcha:** iOS/WKWebView **ignores `iosScheme:'https'`** (reserves the https scheme) → iOS WebView origin is **`capacitor://app.climbritz.app`** (NOT `https://` like Android; the `hostname` is honored, the scheme isn't). `WKAppBoundDomains` was first repointed to `climbritz.app` but then **removed entirely** (`f435516`) — it doesn't cover subdomains, so the app's own origin was non-app-bound → WKWebView blocked clerk-js user-script injection → spinner. Two separate allowlists each need **both** origins: Clerk `allowed_origins` (else `origin_invalid` 400 → spinner) AND backend CORS (`58151d1`, else authenticated API calls fail — that was the "Import failed" on `/classify`). Both now list `https://app.climbritz.app` + `capacitor://app.climbritz.app` + the three localhost variants. iOS verified end-to-end on iPhone (Xcode debug build): login + session + Import JSON + Discover. **Lessons + 3-gate model + debugging playbook captured in `docs/CLERK_CAPACITOR_AUTH.md`.** **Android ✅ shipped + verified on Play Console Internal Testing** (build 8 downloaded on-device, prod email/password sign-in working, no dev badge / no Google). **iOS verified on an Xcode debug build; open item:** cut a fresh TestFlight build — build 4 was archived before the `WKAppBoundDomains` removal (`f435516`), so run `bash ~/deploy_climbritz.sh 5` from Terminal.app for a TestFlight build that carries it (the `allowed_origins` + CORS fixes are server-side, already live). Backend/frontend suites green. |
| Android build 7 — Climbritz launcher icon | ✅ Done — 2026-05-29 | Replaced the default Capacitor robot launcher icon with the Climbritz board icon, generated from iOS `AppIcon-1024.png` via `@capacitor/assets` (adaptive bg `#0f1e36` to match the icon's navy edge — no box-in-box). mdpi→xxxhdpi + adaptive XML. capacitor-assets' out-of-scope changes (splash regen, iOS `Info.plist`/pbxproj rewrite, manifest reformat) reverted to keep the commit icon-only. `assets/play-store-icon-512.png` generated for the Play Console store listing (manual upload, not in the AAB). versionCode 7, signed AAB (SHA256 `0899a4cf…`), on-device verified on SM_X230 (padding accepted). Commit `9c93502`, tag `android-v1.0.0-build7`. **Pending:** Play Console upload (AAB + 512 icon). |
| Android build 6 — MainActivity package fix (launch crash) | ✅ Done — 2026-05-29 | build4/5 crashed at launch with `ClassNotFoundException: app.climbritz.MainActivity`. Root cause: MainActivity source was at legacy package `com.kilterup.app` (Kilter Up → Climbritz rename residue) while `build.gradle` `namespace = app.climbritz`; AGP 8 resolves the manifest's `.MainActivity` against the namespace → declared class ≠ compiled class. NOT an A022/A023 regression — latent since A006, never device-tested before. Diagnosed via adb wireless + logcat + dex inspection; fixed by moving source to `app.climbritz` (commit `1909da2`). versionCode 6, signed AAB, on-device verified (app launches, Clerk sign-in renders). Commit `a389b43`, tag `android-v1.0.0-build6`. |
| A023 Hold classification cloud sync | ✅ Done — 2026-05-28 | `/classify` data moved from localStorage to a per-user backend table (`user_hold_classifications`, alembic 005, FK→users ON DELETE CASCADE, unique `(user_id, placement_id)`) so it syncs across web ↔ iOS ↔ Android under one Clerk identity. New `/api/classifications` surface — `GET` list, `PUT {placement_id}` upsert, `DELETE {placement_id}` (idempotent 204), `POST /import` merge-upsert (preserves unsent rows, caps at 1000, tolerates+ignores export `x`/`y`); all require a Clerk JWT. **No x/y stored** — coords joined frontend-side from `placements_12x12.json` at export, same as pre-A023. `/classify` now hydrates from the backend on mount (localStorage demoted to a write-through cache; backend wins when non-empty, no auto-migration so local-only work is neither destroyed nor auto-pushed), with optimistic upsert/delete + rollback toast. Two growth banners (verbatim English), "Send my export" (copies JSON to clipboard + opens `mailto:daniele.somensi@gmail.com` with the Clerk email in the subject) and "Import JSON" (Daniele's account bootstrap — same path every user uses). RESET wired to delete all backend rows so it survives reload. **STOP gate honored** — migration printed + applied only to a throwaway DB; `alembic upgrade head` on the dev DB left to Daniele. Per-user only; cross-user aggregation into a canonical map stays the future HC-7 brief. 11 backend + 5 frontend tests. Backend 231, frontend 307 — all green; tsc + web + mobile builds clean. **✅ Verified end-to-end on iPhone (TestFlight build 3, 2026-05-29):** Daniele confirmed Import JSON, reload persistence (backend hydration survives app restart), and new-hold upsert all work on-device under his Clerk identity. |
| A022 Benchmark filter | ✅ Done — 2026-05-26 | Boolean "Benchmarks only" toggle at the top of `FilterPanel` on `/discover`. Backend: optional `benchmark` query param on `GET /api/climbs/search` → `AND cs.benchmark_difficulty IS NOT NULL` on the shared `_build_search_filters()` (so `search_climbs` + `count_matching_climbs` both respect it). **Angle-specific by DB design** — `benchmark_difficulty` is on `climb_stats` keyed by `(climb_uuid, angle)`, and Discovery always sends `angle`, so the filter = "benchmark at the selected angle". A **Phase 0.5 read-only audit** ran first (STOP gate) to validate the model against the live DB: 93.4% of 412 benchmark climbs are benchmark at ≤3 angles (max 5; none at all 11), and grades vary per angle (*swooped*: 5b/V1 at 5° → 7a+/V7 at 50°). Single boolean, not tri-state — "exclude benchmarks" isn't a real need. `countActiveFilters()` counts it; URL param + sessionStorage forward-compat. Fixtures seeded by `backend/scripts/seed_a022_test_fixtures.py` (idempotent). 11 new tests (6 service + 5 endpoint + frontend FilterPanel/page coverage). Backend 229, frontend 302 — all green; web + mobile builds clean. |
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
| Sprint #1 post-audit (B022-B027) | ✅ Done — 2026-05-19 | Six atomic fixes from the D017 audit: **B022** dev API banner deleted from `/discover` (P0); **B023** 16 Italian UI strings translated across `ble-test/presets.ts` + `ble-test/page.tsx` + `upload/page.tsx` (P0); **B024** BLE "Connect to board" and active-preset shifted from `bg-blue-*` to brand orange in `ClimbBleControls.tsx` + `ble-test/page.tsx` (P0); **B025** active chips on `/discover` + `FilterPanel` demoted to outline style (`bg-orange-500/15 border-orange-500 text-orange-200`) so the Filters CTA stays hierarchically higher (P0); **B026** `/history` page bundle — removed spurious back arrow (top-level route shouldn't have one), bumped calendar heatmap intensity floor from 20% → 35% so single-climb days are visible in bright gym light, dimmed zero-value StatCards (opacity-50 + text-zinc-500) so `✓0 SENDS` no longer competes with `⚡5 FLASHES` (3× P1); **B027** Project button label flips between "Project" (☆, tap to add) and "Active" (★, tap to remove) for clarity, ProjectRemovalModal now uses `bg-red-600` for "Yes, remove" + brand orange for "No, keep it" so muscle memory on orange doesn't accidentally drop a project (2× P1). Frontend tests: 286 → 290 (+4 new). All commits atomic. **B028-B030 deferred** to `ROADMAP_ACTIVE.md → Pre-launch Production Prep → Post-audit UX polish` (Coming Soon component + FilterPanel idiom sweep / design system pass / typography lift). |
| B021 Coach Coming Soon UX patch | ✅ Done — 2026-05-19 | Frontend-only, no backend / auth / BLE changes. **BottomNav:** 5 slots → 4 (Home / Discover / History / Profile); Coach slot at `/upload` removed; `grid-cols-5 → grid-cols-4`. **Homepage:** Video Analysis tile shows a brand-orange (`#FF6B35`) COMING SOON pill in the top-right corner instead of the previous 🔒 lock (inline-style to match the rest of `app/page.tsx`). Tile remains clickable → `/upload` stays URL-reachable for power users. **`/discover/detail`:** "🎬 Analyze with Coach" Link removed from the action area. **Out of scope:** `/upload`, `/videos/detail`, `gemini_service.py`, Clerk auth, Capacitor BLE all untouched. **Tests:** BottomNav.test.tsx (renamed 5-items → 4-items, added "exactly 4 slots" + "no nav-coach" negatives), app/__tests__/page.test.tsx (replaced "lock icon" test with COMING SOON badge presence + clickable-still asserts), new `app/discover/detail/__tests__/page.test.tsx` mocks the page with a minimal climb fixture and asserts the Coach CTA isn't rendered. Frontend 286/286 green. **Future revert:** restore the Coach NavItem (BottomNav), the 🔒 emoji on the tile (homepage), and the Analyze Link (detail page). If launch slips and we want finer control, introduce `NEXT_PUBLIC_COACH_ENABLED` at that point — not preemptively. |
| iOS TestFlight first upload | ✅ Done — 2026-05-19 | Climbritz 1.0.0 (build 1) uploaded via `~/deploy_climbritz.sh` (patched to point at `~/Projects/climbritz`, use `-project ios/App/App.xcodeproj` instead of `-workspace`, set `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` inline on `xcodebuild archive` so the Info.plist `$()` refs stay intact, and use modern altool flags `--username`/`--app-password`). AppIcon swapped (kilter-up → climbritz icons committed in repo, kilter-up backup gitignored). Bundle `app.climbritz`, team `KSD2RSAZP2`, Delivery UUID `2ea1488e-d81f-4dad-9db0-879456377304`. Pre-built `npm run build:mobile` exits clean, `cap sync ios` adds `@capacitor/app` to `ios/App/CapApp-SPM/Package.swift`. **Pending:** Apple processing → "Ready to Test" (~10–45 min), Internal Testing group setup, install via TestFlight on iPhone. **Security note:** app-specific password hardcoded in `deploy_climbritz.sh` to be revoked from appleid.apple.com. |
| iOS TestFlight build 2 upload | ✅ Done — 2026-05-19 | Climbritz 1.0.0 (build 2) uploaded via `~/deploy_climbritz.sh 2` (Sprint #1 B022-B027 + B021 Coach Coming Soon included in this build). Delivery UUID `8cd98dc0-b1bd-45c1-bfa5-c57e7049f706`. Script hardened in same session: now accepts the build number as a positional arg with positive-integer validation, `MARKETING_VERSION` hardcoded to `1.0.0` inside the script, `CURRENT_PROJECT_VERSION` passed to `xcodebuild` only when `$1` is provided (omit → project default, no auto-increment surprises). First app-specific password (build 1) was revoked between uploads → fresh password generated and dropped into the script for this run. **Pending:** Apple processing → "Ready to Test", on-device verification of Sprint #1 fixes on iPhone. **Note:** build 2 required the manual "Missing Compliance → No encryption" click in App Store Connect. Build 3+ won't ask: `ITSAppUsesNonExemptEncryption=false` added to `ios/App/App/Info.plist` in a follow-up commit so the export-compliance prompt auto-resolves. |
| iOS TestFlight build 3 upload | ✅ Done — 2026-05-29 | Climbritz 1.0.0 (build 3) uploaded to App Store Connect via `~/deploy_climbritz.sh 3`. **A023 Hold Classification Cloud Sync bundled** — first iOS build carrying the cloud-synced `/classify` + Clerk-gated `/api/classifications` surface (alembic 005). Delivery UUID `ef01e812-fb0c-49cb-ba95-03d1a687bb19` (uploaded 10:39:31 CEST). Export-compliance prompt auto-resolved as predicted (`ITSAppUsesNonExemptEncryption=false`, no manual "Missing Compliance" click). **Signing snag:** the first run (from the agent's non-interactive shell) failed at the export phase — `No Accounts` / no `iOS Distribution` cert visible (keychain held only the `Apple Development` dev cert); re-run by Daniele in an interactive Terminal succeeded, because the login session carries the Xcode account + distribution signing. No upload attempt was burned. **Password convention changed (2026-05-29):** the app-specific password hardcoded in `~/deploy_climbritz.sh` is now kept **stable for reuse** (`kalm-yifp-xdnp-uofo`), no longer revoked after each upload. Tag `ios-v1.0.0-build3`. **Pending (Daniele):** Apple processing → "Ready to Test" (~10–45 min), then on-device A023 smoke test on iPhone (Import JSON → classify a hold → Send my export → cross-device check). |
| B031 Android 1.0.0(4) AAB built | ✅ Done — 2026-05-22 | Bumped `android/app/build.gradle` to `versionCode 4` / `versionName "1.0.0"` for parity with iOS TestFlight (commit `5c24c2a` on `main`, tag `android-v1.0.0-build4`). `NEXT_PUBLIC_MOBILE=true npm run build` → `npx cap sync android` → `./gradlew bundleRelease` produced a 6.7 MB signed App Bundle at `android/app/build/outputs/bundle/release/app-release.aab`. **Verification:** AAB contains `web-production-cea9.up.railway.app` and zero `localhost:8001` strings; `versionCode 4` + `versionName "1.0.0"` confirmed in compiled `AndroidManifest.xml` proto. **Signing keystore drift surfaced:** the actual release keystore is at `~/kilter-up-release.keystore` (legacy filename predating the Kilter Up → Climbritz rename in April 2026), NOT `~/climbritz-release.keystore` as the brief assumed. Gradle reads it via gitignored `android/keystore.properties` so the build was unaffected; documented for future briefs. **Capacitor side effect:** `cap sync` consolidated the `@capacitor/app` plugin into `android/app/capacitor.build.gradle` + `android/capacitor.settings.gradle` (necessary for CI reproducibility, committed together with the docs sync — already baked into the AAB built locally). **Distribution:** AAB published as a GitHub Release asset on the tag (private repo, only Daniele can see it) at `https://github.com/danielesomensi-cmd/climbritz/releases/tag/android-v1.0.0-build4` so Daniele can download the binary from any device — necessary because the Mac was not available when this task wrapped. SHA-256 `4eff4a982276239f4dedd417e5c0e36113f9692e06b09d03360ee318999ed2b4` for integrity check on download. **Pending (manual):** Play Console Internal Testing track setup (App content / Data safety / Content rating declarations, Store listing assets — 512×512 icon + 1024×500 feature graphic + screenshots), upload `app-release.aab`, enable opt-in URL, on-device smoke test via Android emulator from home. |
| Android 1.0.0(5) AAB rebuilt (A022 + A023) | ✅ Done — 2026-05-28 | Bumped `android/app/build.gradle` to `versionCode 5` (was 4 from B031) / `versionName "1.0.0"` — Play rejects duplicate versionCodes. First Android build carrying **A022** (benchmark filter on `/discover`) + **A023** (Hold Classification Cloud Sync), after fast-forwarding `main` to `0.1.2`. `NEXT_PUBLIC_MOBILE=true npm run build:mobile` → `npx cap sync android` → `./gradlew bundleRelease` produced a 7.0 MB signed App Bundle at `android/app/build/outputs/bundle/release/app-release.aab`, signed with the legacy `~/kilter-up-release.keystore` via gitignored `android/keystore.properties`. **Distribution:** copied to Google Drive at `My Drive/Climbritz-builds/climbritz-v1.0.0-build5-20260528.aab` (https://drive.google.com/file/d/104cqFd5MhmRPpHDXsrHY1RaMuU0AZiH1/view) so Daniele can download from the office (Mac unavailable) and upload to Play Console — GitHub Release route from B031 skipped this time. **Pending (manual):** Play Console Internal Testing → Create new release → upload AAB → rollout; on-device verification. |
| B014 BLE LED Test UX | ✅ Done | Auto-apply preset on tap with 200ms debounce, BLE writes serialized via hook-level promise chain, Connetti/Disconnetti enlarged to card-sized buttons, creative presets #6-#10 authored on the 17×18 main-hold grid. |
| B014-iter Preset Fixes | ✅ Done | After gym validation: climber redrawn with asymmetric reaching pose (not T-pose), heart uniform red+magenta (no white shine), lightning extended to near-full-board-height zigzag, smile enlarged to 11×11 rounded face. Pending final gym re-validation. |
| B014-iter-2 Art Overhaul | ✅ Done | Replaced diagnostic presets #1-#5 with pixel art: Space Invader (green), Ghost Blinky (red + white/cyan eyes), Zelda Heart (mono-red 8-bit), Star (yellow), Sun (orange + yellow rays). Added preset #11 All LEDs Diagnostic — stress test lighting all 476 positions in y-banded rainbow stripes. |
| A015 Universal Nav + BLE on Discover | ✅ Done | BottomNav added to `/classify` and `/ble-test` (replaces cramped `← Home` links). BLE control bar on `/discover/detail` — `ClimbBleControls` component + `climb-to-leds.ts` helper + static `app/data/leds_12x12.json` (placement_id → LED position, 476 entries generated from BoardLib DB). Single SSoT for role→color in `kilter-protocol.PLACEMENT_ROLES`. |
| A014 Next/Prev on Discover detail | ✅ Done | `filtered-list-storage.ts` persists filter results in sessionStorage (24h TTL). `/discover/detail` renders `← Prev / N of M / Next →` when current uuid is in saved list. `ClimbBleControls` auto-sends new climb (300ms debounce) on key change when board is connected — rapid taps coalesce. Deep links hide the row. Keeps list's original angle across navigation. |
| D015 Circuits Audit | ✅ Done | Read-only audit of `kilter.db` — `frames_count > 1` identifies the 517 multi-frame animated sequences (e.g. Pump 540°, Driftwood); `circuits` / `circuits_climbs` tables are empty in BoardLib; `is_listed = 1` filters out ~92k unvalidated climbs. Output: `backend/docs/D015_CIRCUITS_AUDIT.md`. Feeds Brief A (move-count filter) and B019. |
| B019 Circuits Backlog Logged | ✅ Done | Logged "Circuits & Animated Sequences" as a Phase 8+ subsection in `ROADMAP_ACTIVE.md` — DB integration, dedicated Discovery tab, BLE multi-frame protocol extension, validation plan. Prerequisite: D016 (frames format verification). Docs-only commit. |
| B017 Discovery UX fixes | ✅ Done | (1) Prev/Next buttons enlarged to card-sized tap targets (`min-h-16`, `text-xl font-bold`) for quick flipping during rest intervals; (2) app-wide safe-area sweep — `.pt-safe`/`.pb-safe` utilities in `app/safe-area.css` (separate from globals.css because Tailwind v4 strips plain class rules from the Tailwind entrypoint), `viewport-fit=cover` in layout, applied to all 12 pages + BottomNav; (3) Discovery filter state persists in sessionStorage (`climbritz:discover:filters`, 24h TTL) so filters restore on return from detail — URL params still win on mount for shareable deep links; (4) prominent Filters button — full-width 56px-tall toggle inside the sticky `/discover` header, brand-orange + count badge when any filter is active (grade range, min ascents, min stars, or non-default sort). Panel `expanded` state lifted from `FilterPanel` to `DiscoverPage`; `countActiveFilters()` exported for reuse. Pending gym re-validation on iPhone + Android. |
| A019 Move count chip filter | ✅ Done | New Moves chip section on `/discover` between MIN STARS and SORT BY (Any / ≤5 / 6–7 / 8–10 / >10, default Any). Backend: optional `moves` query param on `GET /api/climbs/search`, applied as a SQL WHERE on `((LENGTH(c.frames) - LENGTH(REPLACE(c.frames, 'r13', ''))) / 3 + 2)` — no schema change. Animated multi-frame sequences (`frames_count > 1`) excluded from search globally — they're circuits, not boulders. `MovesFilter` type in backend schemas + frontend api.ts; `countActiveFilters()` extended to count any non-Any moves bucket. Test fixtures regenerated by `backend/scripts/seed_a019_test_fixtures.py` (idempotent) — A019-prefixed rows for each bucket plus one `frames_count=3` row that validates the global exclusion. Pending gym re-validation. |
| B020 Discover search cap → 500 + total_count | ✅ Done — on-device validated 2026-05-11 | Backend `/api/climbs/search` now defaults to `limit=500` with hard cap 500 (422 above). Response is the envelope `{climbs, total_count}`. New `count_matching_climbs` sibling shares a `_build_search_filters()` helper with `search_climbs` and skips the projection-only `difficulty_grades` JOIN. Frontend `/discover` drops the hardcoded `limit:30`, renders all returned climbs, shows an orange overflow banner ("Mostro i primi N di M risultati. Restringi i filtri per essere più preciso.") when `total_count > climbs.length`. `ClimbCard` wrapped in `React.memo`. `filtered-list-storage.ts` already cap-free — 500 uuids ≈ 18 KB. 13 new tests (7 endpoint + 6 service + 5 frontend). Backend 165, frontend 212 — both green. **Verified on device** by Daniele: broad-filter search scrolls, overflow banner appears as designed, Next/Prev on `/discover/detail` walks the full list end-to-end. |
| A021 Climb logging + history (Phases 1–5) | ✅ Backend + full frontend shipped — Vercel-live | New tables: `climb_logs` + `user_climbs` (alembic 004). Backend endpoints: `POST /api/logs`, `GET /api/logs` + `/api/logs/sessions`, `PATCH/DELETE /api/logs/{id}`, `GET/PATCH /api/user-climbs/{uuid}`, `GET /api/stats/{pyramid,trend}`. Sessions endpoint enriches each climb with name + grade via a memoised BoardLib resolver (A021.5.0) so /history avoids N+1 fetches. Search overlay: `GET /api/climbs/search` enriches each row with `user_state` when authenticated; `done_filter`/`project_filter` chip params (`all`/`only`/`exclude`). All authenticated requests carry `X-User-Timezone` (IANA). **Phase 3** (2026-05-11): LogSection (5-col single row Flash / Send / Attempt / Project / Remove) + RecentLogs on `/discover/detail`, project-removal modal w/ Android back-button via `@capacitor/app`. **Phase 4** (2026-05-11): StateIcons (⚡/✓/★) on Discovery climb cards, tri-state chip filters Done + Project above the Filters toggle, set-intersection when both active, sessionStorage forward-compat with pre-Phase-4 entries. **Phase 5** (2026-05-11): new `/history` page with hand-rolled CSS-grid calendar heatmap, sessions list with click-through to climb detail, Recharts horizontal-bar grade pyramid (flash / send-or-better / all filter), Recharts line trend chart (Flash / Send / Attempt toggleable series, attempt off by default). Date range picker (7d/30d/90d/1y/All, default 90d) drives all three queries atomically. Recharts 3.8.1 pulled in (~114 kB First Load JS on /history alone — acceptable for a non-critical screen). **Tests:** backend 218, frontend 282 — all green. |
| A021 closeout (6 follow-up items) | ✅ Done — 2026-05-12 (commit f09f8ae) | (1) CLAUDE.md API surface — Logs / User-climbs / Stats / Search overlay sections documented alongside existing Video/Climb/Holds/Admin. (2) CLAUDE.md project tree — A021 files indexed (api/logs.py, api/user_climbs.py, api/stats.py, models/climb_log.py, models/user_climb.py, schemas/logs.py, services/log_service.py, alembic 004, test_logs.py, test_stats.py, test_climbs_search_overlay.py, app/history/*, components/StateIcons/LogSection/RecentLogs). (3) ARCHITECTURE.md — Logs/Stats/Log Service rows, climb_logs + user_climbs DB entries, request-flow + /history composition ASCII diagrams. (4) Code Standards — English-UI rule pinned in CLAUDE.md ("English for code AND rendered UI strings; climbing jargon — flash/send/attempt/project — stays untranslated"), anchors `feedback_ui_english.md` memory. (5) `app/page.tsx` — `IS_PRODUCTION_BUILD` guard hides the Debug tile when `NEXT_PUBLIC_MOBILE === 'true'` or `NODE_ENV === 'production'`; `/debug` URL remains routable for emergency network checks. (6) `BottomNav` — History added as 3rd slot (Home / Discover / History / Coach / Profile), `grid-cols-4 → grid-cols-5`, order reflects daily-use flow (Discover → log → check History). Tests cover all 5 testids + `/history` active state. Backend 218 + frontend 282 green; tsc clean; pre-push mobile build green. |
| B-A021-fix-2 StateIcons overlap regression | ✅ Done — Vercel re-validated 2026-05-11 | Phase 4.1 wrapped StateIcons in `<div className="absolute top-2 right-3">`, which on iPhone overlapped the Angle column's "ANGLE" label + 40° value — the icon strip was visibly clipping the label on every card with state. Fix: removed the absolute wrapper, moved StateIcons INSIDE the info column as its own row below the stars/ascents line. Wrapper uses `mt-1 empty:hidden` so cards without state collapse the row to zero height (no visual change for fresh users). `card-info-column` testid added. Two regression tests lock the position in: `within(infoColumn).getByTestId('state-icons')` confirms the strip lives inside the info column, and a className assertion guards against any future return to `absolute` positioning. 2 commits, +2 tests (frontend 278 → 280). |
| B-A021-fix-1 LogSection layout + iOS scroll fix + UI shrink + .pb-nav utility | ✅ Done — Vercel re-validated 2026-05-11 (Round 1 + Round 2) | **Round 1 (commits 2b6d835, 34de98b, 26af9b1):** Three findings from first gym validation. (1) iPhone Safari auto-scrolled `/discover/detail` back to top under async layout shifts — root cause was `html { scroll-behavior: smooth }` in `globals.css:14` animating every browser-initiated scroll adjustment (LogSection + RecentLogs fetches resolving). Removed wholesale (no in-page anchors use it). (2) `min-h-screen` shifted document height every time iOS Safari collapsed/expanded the address bar — replaced with `min-h-dvh` (Tailwind v4 native) on both Suspense fallback and resolved view. (3) LogSection collapsed from a 2-row layout (3 result + 2 secondary) into a single CSS grid — `grid-cols-5` when today's-log exists, `grid-cols-4` otherwise, icon-over-label stack. (4) Next/Prev row moved from its trailing position into the action area between Favorite and Coach so LogSection no longer pushes it out of reach. **Round 2 (commits fe6e91b, 9723dc1, 71f45ab, 17bece4) after Vercel re-validation FAIL (Favorite half-cut by BottomNav):** Second audit identified two more bugs. (5) LogSection buttons shrunk from min-h-16 → min-h-12 (still above Apple HIG 44px), icon text-2xl → text-xl, label text-[11px] → text-[10px], gap-0.5 → gap-0. (6) Board visualization wrapped in `mx-auto max-w-[280px]` so it stops dominating the viewport (~600px → ~320–360px tall). (7) Climb name h1 text-2xl → text-xl. (8) **`.pb-nav` utility added to `app/safe-area.css`:** `padding-bottom: calc(6rem + env(safe-area-inset-bottom))`. Replaces `pb-24` (which left only ~9px clearance over the 87px-tall BottomNav on iPhone with home indicator) across all four BottomNav pages — `/discover/detail`, `/discover`, `/classify`, `/ble-test`. Single source of truth: if BottomNav resizes, change one CSS rule instead of grepping. **Frontend 242 tests, both web + mobile builds green. Vercel re-validation 2026-05-11: all checklist items passed** (snap-to-top no longer occurs, Coach reachable, BottomNav clearance visible on iPhone-notch, board still has tappable cyan middle-holds at 280px). |
| A020 Clerk auth integration | ✅ Fully shipped (web + Android + iOS) | Replaces legacy custom-JWT auth. PR #1 (b918e35, 2026-05-08) + redirect-loop hotfix PR #2 (5ee9ab3) + mobile API_BASE precedence PR #3 (985b8ea, 2026-05-10) + closeout PR #4 (0246d19). **Minor iOS UX bumpiness** (Clerk dev-mode session loss across cold starts + OAuth "Invalid URL scheme" requiring close-Safari-and-retap workaround, both rooted in WKWebView ITP + Clerk dev-instance origin restrictions) **scheduled as B-iOS-oauth-prod in launch prep** — see `ROADMAP_ACTIVE.md → Pre-launch Production Prep`. Workaround acceptable pre-launch (~5s extra per iOS sign-in, 2 testers). **Verified end-to-end on 2026-05-10:** Railway env vars (`CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `ENVIRONMENT=production`) set ✅; Android tablet (APK v0.1.1 build 3 sideloaded via Drive) ✅ green; iPhone 15 (Xcode Run, debug build) ✅ green — Google OAuth completes via in-app SafariViewController and returns to the WebView (the `WKAppBoundDomains = [sound-cub-94.clerk.accounts.dev]` fix in `ios/App/App/Info.plist:60-63` is doing its job). On both devices: homepage 4-tile, Discover, Demo LED, Classify, Dashboard ("Nessun video ancora" empty state, no 401) all render with Clerk JWT accepted by Railway backend. **A019.16:** ALL pages require login except `/sign-in`, `/sign-up`, `/privacy`, `/debug`. **Mobile API_BASE precedence:** `app/lib/api.ts:9-15` forces Railway URL when `NEXT_PUBLIC_MOBILE=true`, ignoring `NEXT_PUBLIC_API_URL` from `.env.local` (foot-gun closed permanently). **Last item left to Daniele's dashboard work:** Vercel env vars (`NEXT_PUBLIC_CLERK_*` including `*_FORCE_REDIRECT_URL` overrides) across Production + Preview + Development — required only when promoting Clerk to production keys; current Vercel deploy already auths fine in Preview using local-built bundle. |
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
| GitHub | `danielesomensi-cmd/climbritz` | Main repo |
| Play Store keystore | `~/climbritz-release.keystore` | Credentials in `~/climbritz-credentials.txt` — back up to 1Password |

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

## ✅ B-A021-fix-1 gym/web validation (Vercel preview) — PASSED 2026-05-11

Round 1 + Round 2 fixes validated on iPhone Safari (Vercel preview).
Both bug bundles independent: scroll-behavior caused the snap-to-top,
pb-24-vs-BottomNav caused the bottom-content cutoff. Two separate
root causes, each fixed in its own commit set.

- [x] `/discover/detail` scrolled to bottom — Coach button + BottomNav visibili con clearance corretto
- [x] Tap Attempt (or Send) — scroll position does NOT reset to top
- [x] Tap Next/Prev — scroll lands at top (Next.js default, the intended behaviour)
- [x] Idle 5s mid-scroll — page does NOT drift back to top
- [x] iOS Safari address-bar collapse/expand during scroll — no visible jump
- [x] LogSection: 5 buttons in a single row (Rimuovi visible because there's a log today), tappable at min-h-12
- [x] Board centered at 280px, hold positions correct, cyan middle-holds reachable
- [x] Climb name "You Don't Know Me" at text-xl, header less dominant
- [x] Next/Prev row above Analyze with Coach, above Favorite
- [x] `/discover`, `/classify`, `/ble-test`: last list row no longer cut by BottomNav (.pb-nav applied)
- [x] Snap-to-top fix (Round 1) still valid

**Status:** Phase 4 (chips + StateIcons on `/discover`) unblocked.

---

## 📋 BACKLOG — Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| ~~Migrate `google.generativeai` → `google.genai`~~ | ✅ Done | B003 — migrated to google.genai SDK + gemini-2.5-flash |
| ~~`gemini_service.py` API key → pydantic Settings~~ | ✅ Done | B003 — reads from `get_settings().gemini_api_key` |
| Recreate API_SPECIFICATION.md | After Phase 3 | Archived — was heavily outdated |
| Recreate DATABASE_SCHEMA.sql | After Phase 3 | Archived — was heavily outdated |
| ~~Frontend deploy to Vercel~~ | ✅ Done | climbritz.app |
| PostgreSQL on Railway | Phase 7 | Currently using SQLite on Railway |
| Add auth to `/api/climbs/search` | Low | Currently unauthenticated (B020 audit). Discovery pages are all AuthGuard-gated (A019.16) but the API itself accepts bare GETs. Move `searchClimbs`/`getClimbDetail` to `apiFetch` (Bearer header) once a leak/abuse concern materialises; not user-visible today. |

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

*Creato da Claude Code — 22 Febbraio 2026 | Aggiornato: 12 Maggio 2026*
*Aggiorna questo file ogni volta che prendi una decisione importante!*
