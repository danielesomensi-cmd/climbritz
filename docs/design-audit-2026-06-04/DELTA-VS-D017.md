# Delta vs D017 + B028/B029/B030 — verified against `main` @ `300b403`

> What the D017 audit found, what Sprint #1 (B022–B027) actually fixed, and what's still open. Every row was re-checked against current source — not assumed from the brief. This is why D018 does **not** re-list fixed items as new findings.

---

## D017 P0 findings (ship blockers)

| ID | Finding | Status | Evidence in current `main` |
|---|---|---|---|
| P0-1 | Dev API banner visible in prod (`/discover`) | ✅ **FIXED** | No unconditional API banner in `discover/page.tsx`; `API_BASE` now only appears inside the error branch (`:238`). |
| P0-2 | Mixed IT/EN UI (ble-test presets + page, upload) | ⚠️ **PARTIALLY FIXED** | `ble-test/page.tsx` now English ("Visual preview", "Role colors", footer). **BUT `/classify` still Italian** ("Prossima non classificata" ×2) — never in P0-2's scope, surfaced fresh as **D18-7**. |
| P0-3 | Same-orange chip/Filters-CTA collision (`/discover`) | ✅ **FIXED** | Active chips demoted to soft `bg-orange-500/15 text-orange-200` (`discover/page.tsx:58`, `FilterPanel.tsx`). Collision gone. (Side effect: created the active-style split, **D18-3**.) |
| P0-4 | BLE Connect uses blue not brand orange | ✅ **FIXED** | `ClimbBleControls.tsx:179` + `ble-test/page.tsx:155` now `bg-orange-500`. Active preset `bg-orange-500/20 ring-orange-500` (`:227`). Preview accent `text-orange-300` (`:249`). |

## D017 P1 findings

| ID | Finding | Status | Evidence |
|---|---|---|---|
| P1-1 | `/history` spurious back arrow | ✅ **FIXED** | `history/page.tsx:132` comment + h1 only, no back link. |
| P1-2 | Calendar 1-climb days invisible | ✅ **FIXED** | `calendar.tsx:182` floor bumped to `/35`, 4-tier gradient. |
| P1-3 | FilterPanel mixes chip/button/select | ⚠️ **PARTIAL** | Active style unified to soft orange, but **idioms still mixed**: Sort = bare `rounded` rectangles (`FilterPanel.tsx:266`), Grade Range = native `<select>` (`:124`/`:142`), chips = `rounded-full`. → still open, folded into **D18-3/D18-6** + Chip contract. |
| P1-4 | ProjectRemovalModal destructive uses brand orange | ✅ **FIXED** | `LogSection.tsx:364` "Yes, remove" = `bg-red-600`; "No, keep it" = brand orange (`:372`). |
| P1-5 | Zero-value stat cells equal weight | ✅ **FIXED** | `history/page.tsx:242` dims zero cells (`opacity-50` + `text-zinc-500`). |
| P1-6 | Project button dual-role label | ✅ **FIXED** | `LogSection.tsx:274` dynamic label "Active"/"Project". |
| P1-7 | "Coming Soon" fragmented | ❌ **NOT FIXED** | Still 3 treatments (homepage pill, FilterPanel inline text `:283`, detail `title=`). = B028 scope. → **D18-4**. |

## D017 P2 findings

| ID | Finding | Status | Evidence |
|---|---|---|---|
| P2-1 | Generic system font | ❌ **NOT FIXED** | `globals.css:22` unchanged. = B030. → **D18-9**. |
| P2-2 | Homepage orphan bottom-row tile | ❌ **NOT FIXED** | `page.tsx` still 2-col, 5 tiles in prod → orphan. → per-screen (Homepage). |
| P2-3 | Homepage BottomNav rationale undocumented | ❌ **NOT FIXED** | No comment/doc; still no BottomNav. → per-screen. |
| P2-4 | BLE preset cards cramped | ❌ **NOT FIXED** | `ble-test/page.tsx:220` still `p-3`. → per-screen (BLE). |
| P2-5 | CTA radius inconsistency | ❌ **NOT FIXED** | 5 radii measured (`rounded-lg/full/`,bare,`-xl/-2xl`). = B029. → **D18-6**. |
| P2-6 | Page-title hierarchy inconsistent | ❌ **NOT FIXED** | text-2xl / text-xl / clamp still mixed. = B029. → **D18-13**. |
| P2-7 | Status colors untokenized | ❌ **NOT FIXED** | Raw Tailwind status colors, no semantic names. = B029. → **D18-10**. |

---

## The three scheduled-but-unexecuted briefs

### B028 — ComingSoon unification + FilterPanel idiom sweep → **STILL OPEN**
- ComingSoon: 3 treatments (D18-4). FilterPanel: active-style unified (B025 side effect) but Sort/Grade-Range/chip *idioms* still mixed (D18-3/D18-6).
- **Folded into D018:** ComingSoonBadge + Chip component contracts.

### B029 — Design-system pass (tokens + Card/Chip/Button/PageHeader/EmptyState) → **STILL OPEN**
- No tokens beyond the (unused) `kilter-orange`. No shared primitives — every page hand-rolls them.
- **Folded into D018:** the entire `DESIGN-SYSTEM-DRAFT.md`. D018 *expands* B029's scope with the two-orange (D18-1) and three-neutral (D18-2) findings B029 didn't anticipate — these are the highest-value items and reframe Phase A of the rollout.

### B030 — Typography lift → **STILL OPEN**
- System stack unchanged. **Folded into D018:** §4.1.7 + rollout Phase E (last, highest-risk).

---

## Net summary

- **Sprint #1 (B022–B027) fully verified shipped** — 4/4 P0s closed, page-specific P1s (P1-1/2/4/5/6) closed. The "looks unfinished" P0 signals D017 flagged are gone.
- **B028/B029/B030 not started** — all the *systemic* design-language work remains. This is expected (they were scheduled, not done) and is the substance of D018's design-system draft.
- **One regression-class gap:** the English-UI hard rule is *still violated* on `/classify` (D18-7) — B023 fixed the pages it scoped but didn't sweep the whole app. Cheap to close, should ship independent of the design-system brief.
- **Two findings D017 didn't reach** (it audited from screenshots + per-file reads; D018 measured across the codebase): the **two-oranges** (D18-1) and **three-neutrals** (D18-2). These are the reason a design-system pass is worth doing, and they make Phase A (tokens) the single highest-leverage change available.

**No overlap with the `D-FULL-AUDIT` UX-observations agent:** that scope is interaction/friction only. This audit is design/layout/visual/token only. The one adjacency — tap-target sizing — is treated here as a *design-token* concern (Chip `min-h-[44px]`), not a flow-friction one.
