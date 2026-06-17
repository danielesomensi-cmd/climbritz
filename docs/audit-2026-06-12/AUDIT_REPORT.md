# 🔍 D020 — Full-App Coherence Audit (Pre-Reddit Launch)

> **Type:** D (audit / READ-ONLY). No source code changed; the only writes are this report and `VIDEO_ANALYSIS_DEEPDIVE.md`.
> **Brief ID:** D020 (next free after D019; verified against `PROJECT_STATUS.md` + `git log --all`).
> **Date:** 2026-06-14 · **Branch:** `main` · **Working tree:** clean at start.
> **Method:** 8 parallel READ-ONLY subagents — FE-1…FE-6 (frontend groups), BE (backend coherence), VIDEO (Coach pipeline deep dive). Findings cross-referenced during synthesis. Video pipeline detail lives in the companion `VIDEO_ANALYSIS_DEEPDIVE.md`.

---

## 1. Executive Summary

The app is in good launch shape: the FastAPI contract and the frontend are well-aligned, the Alembic chain is linear and reproducible, Clerk auth has correct defense-in-depth, Capacitor rules are respected (no real dynamic routes beyond the documented `_`-fallback redirects, no `next/image`, static JSON imported), and **no secret literals are committed** — the known exposed admin secret is environment-side (Railway) only and remains an ops rotation task, not a repo problem. **No critical findings.**

Three **high** items should be addressed before the Reddit push, all on the Coach/AI surface: (1) `videos/detail/page.tsx` renders **Italian UI strings** — a direct English-UI rule violation on the paid product; (2) **no rate limiting or per-user cap** on `/api/videos/upload` or `/api/coach/summary` — any free Clerk account can drive unbounded Gemini spend; (3) **no retry/backoff** on Gemini 503/429, so a transient overload permanently marks a video `failed`. The medium tier is dominated by Recharts axis legibility at 360px (confirmed at code level), a History "Peak" grade mis-sort, and several video-pipeline robustness gaps (no duration cap, opaque single `failed` status, orphaned disk files on delete). The long tail is design-token debt — chiefly the **two-mechanism orange coexistence** (B032 `:root` ramp override + B033 `@theme` tokens, with no single `--color-brand` token), which is map-able and consolidatable (see §6).

---

## 2. Findings Table (sorted by severity)

| # | Sev | Area | Location | Finding | Fix |
|---|-----|------|----------|---------|-----|
| 1 | HIGH | FE-5/VIDEO | `app/videos/detail/page.tsx` (53,65,72,81,88,90-94,101,115,144,158,214-215,234,246) | Italian UI strings on the paid Coach surface ("Punteggi", "Tecnica", "Da migliorare", `it-IT` locale…), mixed with English status text in the same file | M |
| 2 | HIGH | VIDEO/BE | `backend/app/api/videos.py:57-98`, `coach.py:27-46` | No rate limit / per-user cap on video upload or coach summary → unbounded Gemini spend per free account | M |
| 3 | HIGH | VIDEO | `backend/app/services/gemini_service.py:227-246` | Gemini 503/429 → immediate hard `failed`, no retry/backoff (transient overload is permanent) | M |
| 4 | MED | BE | `coach_summary_service.py:130`, `log_service.py:436`, `app/history/page.tsx:111` | "CLIMBS"/"Total climbs logged" is a **climb-day volume** count (shared formula), mislabeled as distinct climbs | S (backend) |
| 5 | MED | FE-4 | `app/history/page.tsx:121` + `log_service.py:487` | "Peak" assumes pyramid sorted hardest-last, but bands sort **lexicographically** → "…/V10" < "…/V2" gives wrong peak | M |
| 6 | MED | FE-4 | `app/history/grade-pyramid.tsx:69-83`, `trend-chart.tsx:93-99` | Recharts axis legibility at 360px (KNOWN OPEN ITEM, confirmed in code): no `interval`/`minTickGap`/`angle`, 11px ticks, 52-week X axis → overlapping labels; YAxis `width=56` truncates "7C+/V10" | M |
| 7 | MED | FE-2 | `app/discover/detail/page.tsx:113` vs `:209` | `user_climb` GET aborts when angle unresolved, but LogSection independently resolves an angle → a log can post against an angle the fetched state wasn't keyed to | S |
| 8 | MED | FE-2 | `app/my-problems/detail/page.tsx:131-142` | Inline grade edit posts arbitrary free-text (`<input>`); backend only length-checks → non-grade strings persist and render through `GradeDisplay` | S |
| 9 | MED | FE-5 | `app/videos/detail/page.tsx:191-200` | Polling only runs on `processing`; a video stuck in `pending` is never auto-refreshed | S |
| 10 | MED | FE-5 | `app/videos/detail/page.tsx:191-200` | No polling timeout / max-attempts / backoff; a hung `processing` polls every 2s forever | S/M |
| 11 | MED | FE-5 | `app/upload/page.tsx:55-64` | Upload progress is faked (random %), no real progress, no cancel/AbortController on large mobile uploads | M |
| 12 | MED | FE-4 | `app/history/page.tsx:75-100` | `Promise.all` for sessions+pyramid+trend is all-or-nothing — one 502 blanks the whole loaded view | M |
| 13 | MED | VIDEO | `storage_service.py:27`, `gemini_service.py:123` | No video-duration cap (only 500MB); cost is linear in duration and long clips risk the 120s File-API poll timeout | S/M |
| 14 | MED | VIDEO | `backend/app/api/videos.py:141-159` | `delete_video` removes the DB row but not the disk file nor the Gemini File API object → files accumulate forever | S |
| 15 | MED | VIDEO | `backend/app/models/video.py:20-21` | All failures collapse to one opaque `failed` status; reason logged but never persisted/surfaced (can't tell "retry" from "wrong video") | M |
| 16 | MED | FE-6 | `app/board-map/page.tsx` | `/board-map` is an orphan page — no link anywhere; URL-reachable, AuthGuard-gated, overlaps `/classify` | S |
| 17 | LOW | BE | `backend/app/api/admin.py:29` | `POST /api/admin/sync-db` gated only by `get_current_user_id` — any signed-in user can trigger a BoardLib re-download | S |
| 18 | LOW | BE | `backend/app/main.py:117-134` | CORS scoped (not wildcard) but `allow_credentials=True` + plain `http/https://localhost` are broad; fine for launch, prune once old mobile builds retire | S |
| 19 | LOW | BE | `backend/app/api/climbs.py` (search/stats/detail), `holds.py` | Public unauthenticated read endpoints incl. `/api/climbs/stats` (DB health) + uncapped search → scraping/abuse surface, no throttle | M (post-launch) |
| 20 | LOW | FE-3 | `components/BleProvider.tsx:99-116` | 8-state machine advertises `requesting`/`connecting` phases that are never observable (set synchronously around one await) | S |
| 21 | LOW | FE-3 | `lib/ble/kilter-protocol.ts:88-90` | `wrapBytes` silently returns `[]` (drops all LEDs) if a body >255 — currently unreachable but a silent failure if the invariant breaks | S |
| 22 | LOW | FE-2 | `app/discover/page.tsx:244` | Search error banner leaks `API_BASE` (Railway URL) + raw error to end users | S |
| 23 | LOW | FE-2/FE-2 | `FilterPanel.tsx:288-308` ⟷ `app/generate/page.tsx:331-351` | Disabled "Coming soon" grip-type chips duplicated on two surfaces — the D018 "reads as broken" pattern that was removed elsewhere | S |
| 24 | LOW | FE-2 | `components/ClimbBoardView.tsx:9-14` | Role→color hex literals duplicate the BLE `PLACEMENT_ROLES` table the editor derives from → two sources of truth | M |
| 25 | LOW | FE-5 | `app/lib/api.ts:181-187` vs `videos.py:104` | `getVideos` default `perPage=20` vs backend `per_page=10`; list returns a bare array (no envelope) → no pagination possible | S |
| 26 | LOW | FE-5 | `app/lib/api.ts:185-187` | `deleteVideo` exported but never called; no delete affordance despite backend support | M (wire) / S (drop) |
| 27 | LOW | FE-5 | `app/upload/page.tsx:9` vs `api.ts:161-169` | `uploadVideo` accepts `gradeAttempted` but the page never collects it → `grade_attempted` always empty | S |
| 28 | LOW | FE-3 | `kilter-board-service.ts:118-126`, `transport.ts:47-55` | Dead exports: `sendAllOffBlackout`/`encodeAllOffBlackout` and `isAvailable()` have no runtime callers | S |
| 29 | LOW | FE-4 | `app/history/sessions-list.tsx:14-17,55-67` | Dead `registerSessionRef`/`forwardRef` plumbing left over from the removed A024 calendar | S |
| 30 | LOW | VIDEO | `storage_service.py:55-60` → `gemini_service.py:117` | MIME checked only from client `content_type`, then force-uploaded as `video/mp4` → mislabeled file fails later inside Gemini | S |
| 31 | LOW | FE-2 | `app/create/page.tsx:128-138` + `climb-to-leds.ts:37` | Editor can paint a hold with no LED mapping; it silently won't illuminate (console.warn only, no UI signal) | M |
| 32 | LOW | various | docs | `POST /api/admin/notify-recent-users` undocumented in CLAUDE.md; `user_generated_climbs` + `user_hold_classifications` missing from ARCHITECTURE.md schema table | S |
| 33 | INFO | BE | repo-wide | **No secret literals committed** — known Railway admin-secret exposure is env-side only, not in any tracked file | — |
| 34 | INFO | FE-1/2/4/6 | many | Design-token debt: result-type/status/chart colors palette-literal; `ui/` primitives not adopted on dashboard/video/board-map (pre-B033 markup) | M |

(Per-area detail with full evidence in §4–§5; orange-mechanism consolidation map in §6.)

---

## 3. Area Coverage Map

| Agent | Surface | Result |
|---|---|---|
| FE-1 | Home, BottomNav, AuthGuard, layout, safe-area, AuthShell, IosSafeArea, ClerkSpaProvider | Clean except orange-token spread; home makes no backend call; Capacitor-safe |
| FE-2 | Discovery, detail, FilterPanel, Log/RecentLogs, generate, create editor, my-problems | 2 medium (angle divergence, free-text grade); token debt; API contract coherent |
| FE-3 | BLE provider/protocol/transport, ble-test, ClimbBleControls, climb-to-leds | B035 contract verified in code; deleted hook confirmed gone; encoder internally consistent |
| FE-4 | History redesign, coach-comment, sessions, pyramid, trend | Peak mis-sort (med); Recharts 360px legibility (med); SENDS fix confirmed correct |
| FE-5 | Upload, videos/detail, polling, form_analysis rendering, dashboard | Italian strings (high); polling gaps; field-rendering table → deep dive |
| FE-6 | Auth pages, dashboard, classify, board-map, privacy, debug, legacy redirects, api.ts | apiFetch (Bearer/tz/401-retry) correct; board-map orphan; login alias SPA-safe |
| BE | All routers, models, migrations, auth, CORS, secrets, test coverage | Linear migrations; auth sound; coach metric root-caused; only `circuits.py` stub untested |
| VIDEO | Full Coach pipeline + prompt + output UX | See `VIDEO_ANALYSIS_DEEPDIVE.md` |

---

## 4. Per-Area Frontend Sections

### FE-1 — Core Nav & Home
Home is a static launcher (no fetch, no contract surface), Capacitor-safe (Contact tile is a plain `<a href="mailto:">`, internal tiles `<Link>`), safe-area handled via inline `--safe-top` per the B034 cascade note. No defects beyond orange-mechanism spread (page mixes `orange-*` utilities, `--brand-orange` inline var, and `rgba(255,107,53,*)` literals; AuthShell adds a literal `#ff6b35` in `clerkAppearance.colorPrimary`). No "Kilter Up" leftovers. Provider tree (ClerkSpaProvider → clerk-react SPA mode, AuthGuard `router.replace`) is correct for static export.

### FE-2 — Discovery & Generator
API contract is coherent end-to-end; static board JSON is imported (not fetched), legacy `[climb_uuid]` redirect uses the `_` dummy + `router.replace`. Two medium items: detail-page angle resolution can diverge from the angle LogSection actually logs against (#7), and the my-problems inline grade `<input>` accepts arbitrary text the backend only length-checks (#8). Lower items: `API_BASE` leaked in the search error banner (#22), duplicated disabled grip chips (#23), two sources of truth for role→color (#24), editor can paint non-illuminable holds silently (#31).

### FE-3 — BLE
The B035 global-state contract holds in code: single state machine in `BleProvider` mounted at root layout, `disconnect()` is the only teardown and is user-tap-only, no auto-reconnect anywhere, resume uses read-only `getConnectedDevices`. The deleted `use-kilter-ble.ts` is confirmed gone with no importers. The protocol encoder (API level 3) is internally consistent and `climb-to-leds` role/LED mapping agrees with `PLACEMENT_ROLES`. No backend calls on this surface. Findings are low: unobservable state transitions (#20), a silent empty-return guard (#21), and dead exports (#28). Note: BLE libs live at `lib/ble/*`, not `app/lib/ble/*` as the brief stated.

### FE-4 — History & Stats
The B033 SENDS=send-or-better fix is correct (`sends = s.sends + s.flashes`). Two medium items: the "Peak" stat mis-orders double-digit V grades because the backend sorts bands lexicographically (#5), and Recharts axes have a confirmed code-level legibility risk at 360px — no `interval`/`minTickGap`/`angle` on a 52-week trend X axis and a 56px-wide pyramid Y axis that truncates long bands (#6). The three stats fetches are all-or-nothing under `Promise.all` (#12). Dead calendar plumbing remains (#29). Coach comment states (no fetch on mount, reset on range change) are correct. API shapes and `X-User-Timezone` all verified.

### FE-5 — Video / Coach
The English-UI violation (#1) is the headline. Polling has two gaps: it ignores `pending` (#9) and has no timeout/backoff (#10). Upload progress is faked with no cancel (#11). The `form_analysis` field-rendering table (in the deep dive) shows the current-format contract is fully rendered; four legacy fields (`overall_grade_estimate`, `weaknesses`, `drills_recommended`, `next_steps`) are rendered but unreachable for new records (dead UI). Pagination/delete gaps (#25–#27). Legacy `/videos/[id]` redirect is compliant.

### FE-6 — Auth & Misc
`apiFetch` is correct on all three dimensions (per-call Bearer via fresh `getToken()`, `X-User-Timezone`, 401-retry-once with a guarded sign-out). `/login` is a pure SPA redirect (deletion candidate, kept as external-link safety net). Legacy redirect pages only redirect. Auth gating correct by presence (dashboard/classify/board-map) and absence (sign-in/up/privacy/debug). `/board-map` is an orphan (#16). Classify contract + optimistic rollback are sound. No "Kilter Up" leftovers; grades.ts is a clean static table.

---

## 5. Backend Section (Part B)

- **Endpoint inventory:** every documented endpoint exists and (except ops/webhook/stub endpoints) has a frontend caller. `notify-recent-users` is implemented but undocumented (#32). `circuits.py` is a known unauthenticated stub. `DELETE /api/videos/{id}` has no caller (acceptable while Coach is gated).
- **Schema coherence:** migration chain 001→006 is strictly linear with a single head; `alembic upgrade head` is reproducible from scratch. Models ↔ migrations align 1:1 (the 002 file_path rename nets to model state). ARCHITECTURE.md schema table is missing two tables (#32).
- **Coach/CLIMBS discrepancy (root cause):** the coach narrative and the History CLIMBS card use the **identical** aggregation — both sum `session.total_climbs` where `total_climbs = len(day_logs)`. This is a **climb-day volume** count, not distinct climbs and not raw attempts: a climb logged on N days counts N times in both. The formula is shared, so any perceived divergence comes only from different range/result-filter inputs; the real defect is **semantic mislabeling** of a volume metric as "CLIMBS"/"Total climbs logged" (#4). Backend-only S fix: add a `distinct_climbs` aggregation and feed it to the narrative, leaving per-day `total_climbs` for the sessions list.
- **Auth surface:** Clerk JWKS verify (RS256, trusts `iss`), shadow-row upsert with 5-min cache, dev `X-User-ID` fallback gated behind BOTH `is_clerk_configured()` AND `environment != production`, and a hard prod-boot crash if `CLERK_JWKS_URL` is unset. Defense-in-depth correct. Unauthenticated `/api/climbs/search` remains acceptable for launch (#19). `sync-db` reachable by any signed-in user (#17).
- **Security:** no secret literals in tracked files (#33) — the Railway admin-secret exposure is env-side only. CORS scoped, not wildcard (#18). Admin endpoints check `X-Admin-Secret` with an empty-string-bypass guard; webhook uses Svix.
- **Test coverage:** all non-stub routers covered; only `circuits.py` (stub) has none. `user_climbs` lacks a dedicated test file but both endpoints are exercised indirectly.

---

## 6. Cross-Cutting: Orange-Token Mechanism Map (consolidation scope)

Brand orange `#ff6b35` is encoded in **at least five forms** across the codebase, because no single `--color-brand` / `text-brand` B033 token exists — components reach for whichever mechanism is convenient.

| Mechanism | Defined / used in |
|---|---|
| **(a) B032 `:root` ramp override** — `--color-orange-100..600` retinted in `globals.css`, consumed as `orange-*` utility classes | `app/page.tsx` (tiles, pill), `BottomNav.tsx`, `AuthGuard.tsx`, `ClimbCard.tsx`, `my-problems/*`, `FilterPanel.tsx`, `ble-test/page.tsx`, `dashboard/page.tsx`, `classify/page.tsx`, `videos/*` |
| **(b) `--brand-orange` plain `:root` var (inline style)** | `app/page.tsx` (wordmark), `AuthShell.tsx`, `history/page.tsx`, `privacy/page.tsx` |
| **(c) Literal `#ff6b35`** | `AuthShell.tsx` (`clerkAppearance.colorPrimary`) |
| **(d) Literal `rgba(255,107,53,*)`** (two different alphas) | `app/page.tsx` (shadow 0.6), `AuthShell.tsx` (shadow 0.5) |
| **(e) Literal chart hex** (`#fb923c`, `#fdba74`) | `grade-pyramid.tsx`, `trend-chart.tsx` |
| **(B033 `@theme static`)** — `globals.css` defines the new token namespaces; the **only** brand-valued `@theme` token is `--color-state-project: #ff6b35`. No `--color-brand`/`text-brand`. | `globals.css` (definition) |

**Separate (not brand):** `ClimbBoardView.ROLE_COLORS` role hexes duplicate the BLE `PLACEMENT_ROLES` table (#24).

**Consolidation path (future B-brief):** introduce a single `--color-brand` token in the B033 `@theme` block, point `orange-*` ramp + `--brand-orange` + `--color-state-project` at it, replace literals (`#ff6b35`, the two `rgba` shadows, chart hexes via `getComputedStyle`/shared constant), then delete the redundant mechanisms. Effort **M**, web-only, no backend impact.

---

## 7. Proposed Follow-Up Briefs

**Pre-Reddit (do first):**
- **B-fix #1 (S/M):** Translate `videos/detail/page.tsx` to English + `en-GB` locale (#1). English-UI rule, paid surface.
- **B-fix #2 (M):** Per-user daily cap + simple throttle on `/api/videos/upload` and `/api/coach/summary` (#2). Protects Gemini spend.
- **B-fix #3 (M):** Bounded exponential-backoff retry on Gemini 429/503 in the background task (#3).

**Soon after launch (grouped):**
- **B-fix #4 — Stats correctness (M):** History "Peak" numeric sort (#5) + coach/CLIMBS distinct-climb metric + relabel (#4).
- **B-fix #5 — Recharts mobile legibility (M):** axis `interval`/`minTickGap`/`angle`, wider/shorter Y labels (#6).
- **B-fix #6 — Video robustness (M):** duration cap (#13), persisted `error_message` + distinct failure UI (#15), file cleanup on delete (#14), real MIME probe (#30), polling `pending`+timeout (#9,#10).
- **B-fix #7 — Discovery polish (S):** angle-divergence guard (#7), constrained grade edit (#8), hide `API_BASE` in error banner (#22), remove duplicated disabled grip chips (#23).

**Housekeeping (S, batchable):**
- Doc sync (#32), remove `/board-map` orphan (#16), gate `sync-db` (#17), dead-code sweep (#28,#29,#26,#27), wire/drop `deleteVideo`.

**A-candidate (already specced in the deep dive):**
- **A-brief — Coach output UX redesign:** two-layer quick/detailed view, v2 JSON schema (`verdict` + per-improvement `label`), minimal prompt delta, frontend split. See `VIDEO_ANALYSIS_DEEPDIVE.md` §C3. Effort M.

---

*Generated by D020 audit — 8 parallel READ-ONLY subagents. Companion report: `VIDEO_ANALYSIS_DEEPDIVE.md`.*
