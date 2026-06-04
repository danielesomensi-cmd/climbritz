# Climbritz Design / Layout / Usability Audit — 2026-06-04

**Brief:** `D-UX-DESIGN-AUDIT` → resolved sequential ID **D018** (highest prior D-brief is D017; see `PROJECT_STATUS.md` line 30 + `git log --all`).
**Type:** D (read-only audit + design proposal). No code changed.
**Auditor:** Claude Code.
**Inputs:** repo source at HEAD `300b403` (clean `main`); the D017 audit (`docs/audit-2026-05-19/AUDIT_REPORT.md`); the B028/B029/B030 scheduled-brief scopes. Evaluated against the **mobile WebView viewport** per the brief's constraint, not Vercel desktop.
**Surface walked:** every page in the `ARCHITECTURE.md` page map (homepage, `/discover`, `/discover/detail`, `/history`, `/classify`, `/ble-test`, `/sign-in`, `/sign-up`, `/dashboard`, `/upload`, `/board-map`, `/videos/detail`, `/privacy`, `/debug`) + shared components (`BottomNav`, `ClimbCard`, `FilterPanel`, `LogSection`, `RecentLogs`, `ClimbBleControls`, `StateIcons`).

> **How this relates to D017.** D017's nine fix-briefs were partly executed: Sprint #1 (B022–B027) shipped, B028/B029/B030 did **not**. This audit *verified each* against current `main` (see `DELTA-VS-D017.md`) and only carries forward what's still open, then adds a layer D017 didn't reach: **token-level inconsistencies measured across the whole codebase** (two oranges, three neutral families) and a **mobile-viewport tap-target/layout-budget pass**. It does not re-list anything already fixed.

---

## Executive summary

Sprint #1 closed all four D017 P0s and the page-specific P1s — the app no longer reads as "half-built" on first open. What remains is **systemic, not cosmetic**: the design language is still implicit, and that implicitness has now produced *measurable drift* the eye reads as "slightly off" without being able to name why. Three findings dominate and they are the spine of the design-system proposal:

1. **There are two brand oranges, and the canonical one is dead.** `tailwind.config.ts` + `globals.css` define `kilter-orange = #ff6b35` — and it is referenced **zero times** in `app/` or `components/`. Every Tailwind-class surface (Discover buttons, filter chips, History picker, LogSection, BLE Connect) renders `bg-orange-500`, which is Tailwind's **`#f97316`** (58 occurrences). Every inline-style surface (homepage wordmark, dashboard, classify banner, privacy, video detail) renders the literal **`#FF6B35`** (37 occurrences across 8 files). These two oranges are perceptibly different. A tester who goes homepage → Discover sees the hero orange shift to a different orange on the buttons. **This is the single highest-leverage fix in the app and the reason the design system must exist.**

2. **There are three neutral families.** `zinc` (30 files — the de-facto standard), `gray` (2 files — `/ble-test` + `ClimbBleControls`), and `slate` (3 — the `globals.css` body `#0f172a`, the homepage gradient, `/privacy`). The body background is literally slate while every app page paints `bg-zinc-950` over it. `/ble-test`, the app's "brand showcase" LED page, is the one screen built entirely in `gray`.

3. **The component primitives D029/D028 were meant to codify still don't exist**, so each page re-invents chips, "Coming Soon", loading text, empty states, and radii ad hoc. Five radius idioms, two active-chip treatments, three "Coming Soon" treatments, three loading strings.

On top of those: **`/classify` still ships Italian** ("Prossima non classificata", ×2) — the English-UI rule (a CLAUDE.md hard rule) is still violated; B023's IT→EN sweep missed this file. And **white-on-orange buttons fail WCAG AA contrast** (~2.8:1).

**Verdict:** the product is shippable for the Reddit beta as-is. None of these block launch. But they are exactly the "death by a thousand cuts" that keeps a competent app from looking *designed* — and they compound as features are added. The right move is the B029 design-system pass, re-scoped around finding #1 (one orange) as its first and highest-value deliverable. Implementation is a multi-module refactor → **STOP gate** (see `DESIGN-SYSTEM-DRAFT.md` §4.3).

---

## Severity / Effort legend

- **Severity:** High = visible "unfinished/off-brand" signal or a hard-rule violation · Med = noticeable inconsistency, learnable-but-friction · Low = polish.
- **Effort:** S = ≤1 file / few edits · M = new shared primitive + a few call-sites · L = cross-app refactor (every page).

---

## Cross-cutting findings (new in D018)

### D18-1 — The brand orange is two different colors; the canonical token is unused — **Severity: High · Effort: L**
- **Evidence:** `kilter-orange` (`#ff6b35`) defined in `tailwind.config.ts:11` + `app/globals.css:4` (`@theme`), **0 references** in `app/`/`components/`. `bg-/text-/border-/ring-orange-{400,500,600}` → **58** occurrences (Tailwind `orange-500` = `#f97316`). Literal `#FF6B35`/`#ff6b35` → **37** occurrences in 8 files (`page.tsx`, `dashboard`, `classify`, `privacy`, `videos/detail`, `upload`, `AuthGuard`, `globals.css`).
- **Why it matters:** `#f97316` (Tailwind) is a yellower, less-saturated orange than the brand `#FF6B35`. Side-by-side — homepage hero vs Discover filter button, or the classify growth banner (`#FF6B35`) vs the classify category "Crimp" button (`bg-orange-500` = `#f97316`, *on the same screen*) — they don't match. The brand is quietly bisected.
- **Proposal:** Make `#ff6b35` real. Redefine Tailwind's `orange` ramp (or a `brand` ramp) so the utility classes already in the code resolve to the brand hue, then delete the inline `#FF6B35` literals in favor of the class. One value, one token, one orange. Detailed in `DESIGN-SYSTEM-DRAFT.md` §4.1.

### D18-2 — Three neutral families (zinc / gray / slate) — **Severity: Med · Effort: M**
- **Evidence:** `zinc` in 30 files (standard); `gray` in `app/ble-test/page.tsx` + `components/ClimbBleControls.tsx`; `slate`/hexes (`#0f172a`, `#1e293b`, `#94a3b8`, `#e2e8f0`) in `globals.css` body, `app/page.tsx` gradient, `app/privacy`. `globals.css:23` sets `body { background:#0f172a }` (slate-900) — overpainted by `bg-zinc-950` on every real page.
- **Why it matters:** `gray` and `zinc` are subtly different (gray is neutral, zinc is cool). `/ble-test` is the page the LED demo is supposed to *show off* — and it's the one page in a different gray. The slate body bg is dead paint but it's the documented base.
- **Proposal:** Consolidate to **zinc** as the canonical surface family; migrate `/ble-test` + `ClimbBleControls` gray→zinc; set `globals.css` body to the zinc base so the cascade matches the pages. Homepage gradient can keep its slate→black hero (it's an intentional atmosphere moment) but should be named as a deliberate "hero" token, not an accident.

### D18-3 — Two "selected/active" treatments for the same concept — **Severity: Med · Effort: M**
- **Evidence:** Soft outline `bg-orange-500/15 border-orange-500 text-orange-200` on Discover angle chips, tri-state Done/Project chips, and all FilterPanel chips. **But** solid fill `bg-orange-500 ... text-white` on the History range picker (`history/page.tsx:147`), the LogSection Project-active button (`LogSection.tsx:266`), and the Discover Filters CTA when count>0 (`discover/page.tsx:339`).
- **Why it matters:** Two visual vocabularies for "this is selected". A user learns "active = soft orange tint" on Discover, then History's picker says "active = solid orange". Sprint #1 (B025) deliberately demoted Discover chips to the soft style to fix the P0-3 collision — but didn't carry the new convention to History or LogSection.
- **Proposal:** One **Chip** primitive with a single `selected` style (soft outline) for *filters/toggles*, and a separate **Button** primitive (solid fill) reserved for *commit actions*. The Filters CTA is correctly a Button; the History picker is a filter and should adopt the soft chip style.

### D18-4 — "Coming Soon" rendered three ways — **Severity: Med · Effort: M** (B028, still open)
- **Evidence:** (a) homepage: inline-style filled pill `#FF6B35`/white uppercase (`page.tsx:162`); (b) FilterPanel Grip-type: inline orange text `text-orange-400/80` (`FilterPanel.tsx:283`); (c) `/discover/detail` Favorite: a disabled zinc button with `title="Coming soon"` only (`detail/page.tsx:276`).
- **Proposal:** Single `<ComingSoonBadge>` component (spec in design-system draft); replace all three. Note the homepage one is inline-styled, so unifying it depends on porting the homepage off inline styles (see D18-12).

### D18-5 — Loading & empty states are ad hoc — **Severity: Med · Effort: M** (B029, still open)
- **Evidence:** Loading copy: "Searching…" (`discover`), "Loading climb…" (`detail`), "Loading…" (`history`). Empty copy: "No climbs match these filters. Try widening them." (non-italic), "No sessions in this range yet." (`sessions-list:52`), "No attempts yet. Log your first one above." (italic, `RecentLogs:53`). Three styles, no shared component.
- **Proposal:** `<LoadingState>` + `<EmptyState>` primitives (icon + title + optional hint/CTA). Migration map in the draft.

### D18-6 — Radius scale is unbounded — **Severity: Low · Effort: M** (B029, still open)
- **Evidence:** `rounded-lg` ×54, `rounded-full` ×32, bare `rounded` (4px) ×16, `rounded-2xl` ×15, `rounded-xl` ×14. Five radii in play, e.g. FilterPanel Sort buttons use bare `rounded` (4px) while its sibling chips use `rounded-full`.
- **Proposal:** 3-tier radius token system (pill / card / control) — see draft §4.1.

### D18-7 — `/classify` still ships Italian UI — **Severity: High · Effort: S**
- **Evidence:** `app/classify/page.tsx:259` button label `Prossima non classificata →` and `:374` body text `<strong>Prossima non classificata</strong>`. The matching test asserts the Italian string (`page.test.tsx:228`).
- **Why it matters:** Direct violation of the CLAUDE.md English-UI hard rule + `[[feedback_ui_english]]`. B023 translated `/ble-test` + `/upload` but **missed `/classify`** entirely. The classify page is in the active beta surface (homepage tile, growth banner inviting contributors). A non-Italian tester hits an Italian button on a contributor-facing page.
- **Proposal:** "Next unclassified →" (button) / "Next unclassified" (body); update the test fixture. This is a one-file string fix — could ride into any near-term commit, not just the design-system brief.

### D18-8 — White-on-orange fails WCAG AA contrast — **Severity: Med · Effort: S**
- **Evidence:** White (`#fff`) on `bg-orange-500` (`#f97316`) ≈ **2.8:1**; on brand `#FF6B35` ≈ **2.7:1**. WCAG AA needs 4.5:1 (normal) / 3.0:1 (large bold ≥18.66px). Affects the Filters CTA (`text-base font-semibold`), History range picker (`text-xs`), LogSection result/Project buttons (`text-[10px]`–`text-xl`), classify "Send my export". The small-text ones (`text-xs`/`text-[10px]`) clearly fail; the large bold ones are borderline.
- **Why it matters:** Legibility in bright gym/outdoor light (the actual use environment) + accessibility. Orange-on-dark *text* is fine (~5.6:1); the problem is specifically *white text on an orange fill*.
- **Proposal:** Define the brand button fill one stop darker for text-bearing solid buttons (a `brand-600`-equivalent), or use near-black text on orange for small labels. Validate the chosen pair to ≥3:1 (large) / 4.5:1 (the `text-xs`/`text-[10px]` cases). Tokenize so it's decided once.

### D18-9 — System font stack; no type voice — **Severity: Low · Effort: M** (B030, still open)
- **Evidence:** `globals.css:22` `-apple-system, …, Roboto, …, Arial`; homepage wordmark is inline `fontWeight:900` clamp. No display/body distinction.
- **Proposal:** Self-hosted display + body pairing loadable in the WebView (no FOUT/perf cost in static export). Direction in draft §4.1.4.

### D18-10 — Status colors untokenized — **Severity: Low · Effort: S** (B029/P2-7, still open)
- **Evidence:** Flash = `bg-yellow-500` button / `text-yellow-300` text; Send = `bg-green-600` / `text-green-400`; Attempt = zinc; BLE status = gray/yellow/green/blue/red literals duplicated in two files; error = red-700/900 inconsistently. No semantic names.
- **Proposal:** Semantic `state-*` tokens (flash/send/attempt/project) + `feedback-*` (success/warn/error/info). Draft §4.1.

### D18-11 — `STATUS_COLORS`/`STATUS_LABELS` duplicated verbatim — **Severity: Low · Effort: S**
- **Evidence:** Identical maps in `app/ble-test/page.tsx:16-36` and `components/ClimbBleControls.tsx:12-32` (one uses `bg-gray-500` idle, see D18-2). Code-org, but it's why the two BLE surfaces can drift.
- **Proposal:** Extract to `lib/ble/status.ts` when the gray→zinc migration touches these files.

### D18-12 — Homepage is 100% inline-styled — **Severity: Med · Effort: M**
- **Evidence:** `app/page.tsx` uses zero Tailwind classes; all styling is inline `style={{}}` (gradient, tiles, wordmark, Coming Soon pill). `privacy` + parts of `dashboard`/`upload` similar.
- **Why it matters:** The homepage is the highest-traffic screen and the strongest brand moment — and it's the *one screen that cannot consume any design token* defined in Tailwind. Every token rollout has to special-case it. It's also why the Coming Soon pill (D18-4) can't be unified without porting it.
- **Proposal:** Port the homepage to Tailwind classes during the design-system brief so it inherits brand/neutral/radius tokens like everything else. Keep the hero gradient + glow (it's good) but express it through tokens.

### D18-13 — Page-title sizing inconsistent — **Severity: Low · Effort: S** (B029/P2-6, still open)
- **Evidence:** `text-2xl font-bold` (Discover, Classify, BLE), `text-xl font-bold` (History, detail climb name), `clamp(40px,10vw,72px)` (homepage). No semantic page-title size.
- **Proposal:** One `text-page-title` semantic size applied to all top-level `<h1>`s.

---

## Per-screen observations (mobile WebView viewport)

### Homepage (`app/page.tsx`) — tile hub
- **Layout:** 2-col grid. In production/mobile builds `IS_PRODUCTION_BUILD` drops the Debug tile → **5 tiles → orphaned last row** (History alone, empty cell to its right). D017-P2-2, still open.
- **Hierarchy/spacing:** Strong — wordmark hero + glow is the best brand moment; tiles `min-height:140px` (good tap target).
- **Usability friction:** No `<BottomNav>` here (intentional launcher model, but undocumented — D017-P2-3). Coming Soon pill is the inline-style variant (D18-4).
- **Proposal:** Center the orphan tile in its row *or* add a 6th tile (needs content). Document the no-BottomNav launcher decision in code + ARCHITECTURE.md. (Severity: Low · Effort: S)

### `/discover` — search + FilterPanel
- **Layout:** Sticky header stacks h1 + angle row + search + 2 tri-state chip rows + 56px Filters button. On a short phone viewport (e.g. iPhone SE / mid-height Android) this header consumes a large share of the screen **before any result card is visible**.
- **Hierarchy/spacing:** Good post-B025 (chip collision fixed). The 56px Filters CTA reads as the clear primary affordance.
- **Usability friction:** **Tap targets — angle chips and tri-state chips are `px-3 py-1.5 text-sm`/`text-xs` ≈ 30px tall, below the 44×44pt minimum.** Discover is the most-touched filter surface; the angle strip is a horizontal-scroll row of sub-44px targets. (Severity: Med · Effort: M — bump chip vertical padding / min-height in the Chip primitive.)
- **Proposal:** Define the Chip primitive at `min-h-[44px]` (or `min-h-9` + larger hit area via padding). Consider collapsing the header's vertical budget (e.g. angle row + chips behind the Filters panel on short viewports).

### `/discover/detail` — board + BLE + LogSection + RecentLogs
- **Layout:** Dense but well-ordered: title → description → BLE bar → LogSection → board (`max-w-[280px]`, good) → role legend → other angles → RecentLogs → Favorite → Next/Prev. The 280px board cap (B-A021-fix-1) holds on mid-height phones.
- **Hierarchy/spacing:** LogSection grid buttons `min-h-12` (48px ✓); Next/Prev `min-h-16` (64px ✓) — tap targets here are correct.
- **Usability friction:** The **Favorite action row is a single disabled button** (`detail/page.tsx:272`) — showing a lone greyed-out control with no enabled sibling reads as broken rather than "coming soon". The BLE "Light up board" uses `bg-green-600` (status-green) as a *primary action* color, which collides semantically with green = "Send/connected" elsewhere.
- **Proposal:** Either hide the Favorite row until it works, or give it the unified ComingSoon affordance. Reconsider green for the illuminate CTA vs the brand button style. (Severity: Low–Med · Effort: S)

### `/history` — stats / calendar / sessions / pyramid / trend
- **Layout:** Single-scroll, coherent. Stats strip `grid-cols-4`; zero-value cells dimmed (B026 ✓). Calendar cells `aspect-square` in 7-col → ~44px on `max-w-2xl`/phone (OK). Heatmap floor bumped to 35% (B026 ✓).
- **Usability friction:** Range picker buttons `flex-1 py-2` ≈ 32px tall (sub-44, though full-width eases it) **and** use the solid-orange active style (D18-3). Recharts pyramid/trend on a narrow viewport — legibility of axis labels/legends is a known risk on mobile (source-only; verify on-device).
- **Proposal:** Adopt the soft-chip active style on the range picker (D18-3); bump to `min-h-[44px]`. Verify Recharts label sizing on a 360px-wide viewport. (Severity: Med · Effort: S–M)

### `/classify` — hold classification
- **Layout:** `md:grid-cols-[1fr_360px]` → board stacks above the detail panel on phones (correct). Category buttons `py-3` (good tap targets). Progress bar + legend clear.
- **Hierarchy/spacing:** Good, but accent color is **blue** (`bg-blue-500` progress bar, blue "Next"/"Prossima" buttons) — `good_crimp` is legitimately blue as a *category* color (`state.ts:41`), but the *navigation/progress* blue is not a category and conflicts with the brand-orange convention everywhere else. The growth banner uses `#FF6B35` (the *other* orange — D18-1) while the "Crimp" category button uses `bg-orange-500` (`#f97316`) **on the same screen** — the clearest single visible instance of the two-orange split.
- **Usability friction:** **Italian strings** (D18-7).
- **Proposal:** Translate (D18-7); move navigation/progress accents to brand orange and reserve blue strictly for the `good_crimp` category swatch; unify the two oranges. (Severity: High for IT, Med for color · Effort: S)

### `/sign-in` + `/sign-up` — Clerk widget (first impression)
- **Layout:** `<SignIn routing="hash"/>` centered on `bg-zinc-950`, `pt-safe`. No `appearance` prop passed to Clerk.
- **Usability friction:** The Clerk widget renders with **default Clerk styling**, not Climbritz's brand — so the very first screen a new tester sees (pre-auth, no anonymous mode) is an unbranded form on a dark page. The brand orange / wordmark / type voice are absent at the highest-stakes first impression.
- **Proposal:** Pass a Clerk `appearance={{ variables: { colorPrimary: <brand-orange>, colorBackground: <zinc-950> }, … }}` so the widget adopts brand orange + dark surface, and add the wordmark above it. (Severity: Med · Effort: S — Clerk theming is config, not a fork.)

### `/ble-test` — LED preset showcase
- **Layout:** Connect button `p-3 text-base` (~48px ✓, brand-orange post-B024 ✓). Preset grid `grid-cols-2 gap-3`, cards `p-3` — dense (D017-P2-4, still open). Stress-test card spans 2 cols.
- **Hierarchy/spacing:** The whole page is in the **`gray` family** (D18-2) — the one screen not in zinc, and it's the brand-demo page. Active preset uses `bg-orange-500/20 ring-2 ring-orange-500` (soft) — a *third* active-selection variant alongside D18-3's two.
- **Proposal:** Migrate gray→zinc (D18-2); optional LED-art thumbnails per preset card (D017-P2-4, delight, Effort: M). (Severity: Med · Effort: M)

### Secondary (`/dashboard`, `/videos/detail`, `/upload`, `/board-map`, `/privacy`, `/debug`)
- `/dashboard` + `/videos/detail` + `/upload` use the literal `#FF6B35` (D18-1) and a back-arrow/header pattern that differs from the BottomNav-route convention (D017 noted; sweep with D18-3/13). `/board-map` blue = intentional hold-filter category color (OK). `/privacy` inline-styled standalone (OK — legal page). `/debug` dev-only (OK).

---

## Cross-page consistency matrix (current state)

| Concern | Canonical | Violators | Finding |
|---|---|---|---|
| Brand orange | `#ff6b35` token | nobody uses it; `#f97316` (58×) + `#FF6B35` literal (37×) | D18-1 |
| Neutral family | `zinc` | `gray` (ble-test, ClimbBleControls), `slate` (home, body, privacy) | D18-2 |
| Active/selected | soft `orange-500/15` | solid on History picker, LogSection, Filters CTA; `/20 ring` on BLE | D18-3 |
| Coming Soon | — | 3 treatments | D18-4 |
| Loading / empty | — | 3 loading strings, 3 empty styles | D18-5 |
| Radius | — | 5 idioms | D18-6 |
| Button text contrast | — | white-on-orange ~2.8:1 | D18-8 |
| Language | English | `/classify` Italian | D18-7 |
| Page title | — | text-2xl / text-xl / clamp | D18-13 |
| Tap target | 44pt | angle/tri-state/range chips ~30–32px | Discover/History rows |

---

## Proposal count by severity (this audit's new findings)

- **High:** 2 (D18-1 two-orange, D18-7 Italian) — plus the contrast finding sits at the High/Med boundary.
- **Med:** 7 (D18-2, D18-3, D18-4, D18-5, D18-8, D18-12, + Discover/History tap-target & sign-in branding folded into per-screen).
- **Low:** 4 (D18-6, D18-9, D18-10, D18-11, D18-13 — radius/type/status-token/dup/title polish).

Per-screen layout proposals add ~7 small items (orphan tile, launcher doc, header budget, Favorite row, illuminate-green, Recharts mobile check, BLE density).

→ See `DESIGN-SYSTEM-DRAFT.md` for the token + component spec that resolves the cross-cutting set, and `DELTA-VS-D017.md` for what's already fixed vs still open.
