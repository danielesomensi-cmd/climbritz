# Climbritz Mini Design-System — DRAFT spec (D018)

> **Status: PROPOSAL ON PAPER. Nothing here is implemented.** This is the B029 (+B028, +B030) deliverable as a spec for Daniele to approve. Implementation becomes a separate A/B brief and — because it touches every page — a **STOP-gate refactor** (§4.3).
>
> Light-first is NOT the right call here: Climbritz is a **dark-themed** app (zinc-950 surfaces) and should stay dark. The token values below are **dark-first**; a light theme is out of scope. (The brief said "light-first values" but the entire product is dark — flagging the deviation deliberately rather than inverting a working aesthetic.)

---

## Design principles (the implicit language, made explicit)

1. **Dark, climbing-gym-legible.** Near-black zinc surfaces, high-contrast text, one hot accent. Must survive bright indoor/outdoor light.
2. **One accent, used sparingly.** Brand orange marks *the* action / *the* active state — not decoration. When everything is orange, nothing is.
3. **Pragmatic iconography.** Emoji over an icon-library bundle (Capacitor weight matters) — accept it, but use it consistently.
4. **Mobile-first, thumb-reachable.** 44pt minimum hit area; primary actions in the lower two-thirds.

---

## 4.1 Tokens

### 4.1.1 Color — Brand

The headline fix (AUDIT D18-1): collapse the two oranges into **one**, and make the existing 58 `orange-*` utility usages resolve to the brand hue so the migration is mostly a Tailwind-config change, not 95 hand-edits.

| Token | Hex | Role | Notes |
|---|---|---|---|
| `brand-500` | **`#ff6b35`** | primary accent (the canonical Kilter orange) | replaces BOTH `#f97316` and `#FF6B35` |
| `brand-600` | `#e85d2a` (approx) | solid-button fill carrying white/near-black text | darker stop to pass contrast (D18-8) |
| `brand-400` | `#ff8a5c` (approx) | hover / lighter accent | |
| `brand-tint` | `rgba(255,107,53,0.15)` | selected-chip fill | the soft active style |

**Implementation note:** redefine Tailwind's `orange` ramp (or introduce a `brand` ramp and codemod `orange-`→`brand-`) so `bg-orange-500` → `#ff6b35`. Then delete the inline `#FF6B35` literals (8 files) in favor of the class. After this, `kilter-orange` is either the live token or deleted — no dead token.

**Contrast (D18-8):** `#ff6b35` on white ≈ 2.7:1 (FAILS AA). → text-bearing **solid** buttons use `brand-600` fill with white text (target ≥3:1 large / 4.5:1 small) *or* near-black (`zinc-950`) text on `brand-500`. Orange-as-text on dark (`brand-500` on `zinc-950` ≈ 5.6:1) PASSES — keep that for the soft-chip label.

### 4.1.2 Color — Surface / Neutral (consolidate to ZINC — AUDIT D18-2)

| Token | Tailwind | Hex | Role |
|---|---|---|---|
| `surface-base` | `zinc-950` | `#09090b` | page background |
| `surface-raised` | `zinc-900` | `#18181b` | cards, panels, inputs |
| `surface-overlay` | `zinc-800` | `#27272a` | inactive chip / secondary button |
| `border-default` | `zinc-800` | `#27272a` | hairlines |
| `border-strong` | `zinc-700` | `#3f3f46` | emphasized borders / inactive chip border |
| `hero-gradient` | `linear-gradient(135deg,#0f172a,#1e293b,#000)` | — | **homepage only**, named so it's deliberate not accidental |

Migrate `/ble-test` + `ClimbBleControls` `gray-*`→`zinc-*`; set `globals.css` body to `surface-base` (kills the dead slate `#0f172a` body bg).

### 4.1.3 Color — Text & Semantic

| Token | Value | Role |
|---|---|---|
| `text-primary` | `zinc-50` / white | headings, key values |
| `text-secondary` | `zinc-300` | body |
| `text-tertiary` | `zinc-400` | labels, captions |
| `text-muted` | `zinc-500` | disabled / hints |
| `state-flash` | `#fcd34d` (yellow-300) | Flash |
| `state-send` | `#34d399` (emerald-400) | Send / connected |
| `state-attempt` | `zinc-400` | Attempt |
| `state-project` | `brand-500` | Project |
| `feedback-success` | emerald-500 | confirmations |
| `feedback-warn` | amber-500 | warnings (BLE "app required") |
| `feedback-error` | red-500 | errors |
| `feedback-info` | blue-500 | transient "sending" + `good_crimp` category |

> Resolves D18-10. Category fills in `classify/state.ts` (jug/good_crimp/crimp/sloper/undercling/pinch) stay as-is — they're a **data palette**, not the UI accent palette — but should be referenced as `category-*` tokens so they're clearly a separate axis. Note: `crimp` category currently = `bg-orange-500`; after D18-1 it becomes `brand-500`. Decide whether crimp should keep brand-orange (it visually competes with the accent) or shift to a distinct hue — recommend a distinct hue so the accent stays unique.

### 4.1.4 Spacing

Tailwind's default 4px scale is already in use and fine — **adopt it explicitly** rather than inventing a new one. Base unit **4px**; the rhythm in use is `2 / 3 / 4 / 5 / 6` (`space-y-2`…`space-y-6`). Document `gap-2` as the default control gap, `space-y-3` intra-section, `space-y-5/6` inter-section. No custom spacing tokens needed — the value is the *documented convention*, not new numbers.

### 4.1.5 Radius (resolves D18-6)

| Token | Value | Use |
|---|---|---|
| `radius-pill` | `9999px` (`rounded-full`) | chips, toggles, badges |
| `radius-card` | `12px` (`rounded-xl`) | cards, panels, modals, primary buttons |
| `radius-control` | `8px` (`rounded-lg`) | inputs, list items, secondary buttons |

Retire bare `rounded` (4px) and standalone `rounded-2xl`. Three tokens, applied per the component contracts below.

### 4.1.6 Elevation

Dark UI → elevation by **surface step + border**, not heavy shadow. Two shadow tokens max:

| Token | Value | Use |
|---|---|---|
| `elev-raised` | `shadow-lg` | the Filters CTA, FABs |
| `elev-overlay` | `shadow-xl` + `bg-black/70` scrim | modals, toasts |

### 4.1.7 Typography (the B030 lift — D18-9)

- **Direction:** one **display** face for the wordmark + page titles (condensed, slightly mechanical — fits a board-sport brand; e.g. *Archivo / Archivo Expanded*, *Space Grotesk*, or a *Druk-style* condensed for the wordmark only), paired with a **clean body** sans (e.g. *Inter Tight* or *Geist*). Self-host via `next/font` (local) so static export stays clean and there's **no runtime web-font fetch** (Capacitor offline-friendly, no FOUT). Avoid Arial/system-default (the current stack) — that's the "undesigned" tell.
- **Type scale tokens:**

| Token | Size / weight / line-height | Use |
|---|---|---|
| `type-display` | `clamp(40px,10vw,72px)` / 900 / 1.0 | homepage wordmark only |
| `type-page-title` | 24px / 700 / 1.2 | every `<h1>` (resolves D18-13) |
| `type-section` | 14px / 600 / 1.3 uppercase tracking-wide | section headers ("Activity", "Sort by") |
| `type-body` | 16px / 400 / 1.5 | body |
| `type-label` | 12px / 600 / 1.3 | captions, chip labels |
| `type-micro` | 10px / 600 / 1.2 | stat sublabels, badges |

> Climbing jargon (Flash/Send/Attempt/Project) stays English per the hard rule — typography doesn't change that.

---

## 4.2 Component contracts (the B029 library + B028 unification)

For each: **purpose · variants · states · tokens consumed · replaces (real files)**. *Spec only — do not build here.*

### Card
- **Purpose:** content container (climb card, session card, stat card, classify panel, BLE preset card).
- **Variants:** `default` (static), `interactive` (Link/button — hover `border-brand-500/50`).
- **States:** rest / hover / pressed.
- **Tokens:** `surface-raised`, `border-default`, `radius-control`, hover→`border-brand-500/50`.
- **Replaces:** `ClimbCard.tsx:27`, History `StatCard`/`SessionCard`, classify `aside` panel (`classify/page.tsx:362`), BLE preset cards (`ble-test/page.tsx:220`), RecentLogs container.

### Chip
- **Purpose:** filter / toggle / segmented option (the most-duplicated pattern).
- **Variants:** `single` (angle, sort, ascents, quality, moves, benchmark), `segmented` (tri-state Done/Project), `disabled` (grip-type coming-soon).
- **States:** `rest` (`surface-overlay` + `border-strong`), `selected` (**soft**: `brand-tint` + `border-brand-500` + `text` brand label) — the ONE active style (resolves D18-3), `disabled`.
- **Tap target:** `min-h-[44px]` (resolves the Discover/History sub-44 finding).
- **Tokens:** `radius-pill`, `brand-tint`, `brand-500`, `surface-overlay`, `border-strong`.
- **Replaces:** Discover angle row + `ChipRow` (`discover/page.tsx:40`), all FilterPanel chips (`FilterPanel.tsx` — incl. Sort, currently bare-`rounded` rectangles → become pills), History range picker (`history/page.tsx:140` — currently solid → adopt soft), BLE active-preset highlight.

### Button
- **Purpose:** commit actions (open Filters, Connect, log result, modal confirm, classify category, send export).
- **Variants:** `primary` (`brand-600` fill / white — passes contrast), `secondary` (`surface-overlay` + `border-strong`), `destructive` (`feedback-error` fill), `ghost` (text-only).
- **States:** rest / hover / pressed / disabled / loading (`…`).
- **Tap target:** `min-h-[44px]` (primary `min-h-[56px]` for the Filters CTA).
- **Tokens:** `brand-600`, `surface-overlay`, `feedback-error`, `radius-card`/`radius-control`, `text-primary`.
- **Replaces:** Discover Filters toggle, `ClimbBleControls` Connect/Disconnect/Reset, BLE-test Connect, `LogSection` result+project+remove buttons, `ProjectRemovalModal` buttons, classify action buttons, reset modal.

### PageHeader
- **Purpose:** consistent top-of-page header for top-level vs nested routes.
- **Variants:** `top-level` (h1 only, no back arrow — Discover/History/Classify/BLE), `nested` (back arrow + parent label + optional title — `/discover/detail`).
- **Tokens:** `type-page-title`, `surface-base/95` + `backdrop-blur` + `border-default` (sticky), `pt-safe`.
- **Replaces:** the bespoke `<header>` blocks in `discover`, `history`, `discover/detail`, `classify`, `ble-test` (resolves the back-arrow-rule + page-title-size inconsistencies, D18-13).

### EmptyState (resolves D18-5)
- **Purpose:** "nothing here yet" with optional CTA.
- **Variants:** `with-cta` / `text-only`.
- **Anatomy:** icon (emoji) + title + optional hint + optional action.
- **Tokens:** `text-muted`, `type-body`, `radius-control`.
- **Replaces:** Discover "No climbs match…", `sessions-list:52`, `RecentLogs:51` empty branch, classify empty panel.

### LoadingState (resolves D18-5)
- **Purpose:** unified async-pending indicator.
- **Variants:** `inline` (a result list), `block` (full section), `skeleton` (optional, cards).
- **Copy convention:** one verb form — e.g. "Loading…" everywhere, or context-noun ("Loading climbs…") with a single shared format. Pick one (recommend plain "Loading…").
- **Replaces:** "Searching…" (`discover:399`), "Loading climb…" (`detail:159`), "Loading…" (`history:187`).

### ComingSoonBadge (resolves D18-4 — the B028 unification)
- **Purpose:** single "feature exists, not ready" marker.
- **Spec:** `radius-pill` + `brand-500` fill + white uppercase `type-micro`, `tracking-wide`. (Matches the current homepage pill — promote it to the canonical treatment.)
- **Replaces:** homepage inline pill (`page.tsx:162`), FilterPanel grip-type inline text (`FilterPanel.tsx:283`), `/discover/detail` Favorite `title=` (`detail/page.tsx:276`).
- **Dependency:** homepage must move off inline styles (D18-12) to consume it.

### StatusDot (folds in D18-11)
- **Purpose:** BLE connection status indicator (+ label).
- **Spec:** single source for `STATUS_COLORS`/`STATUS_LABELS` in `lib/ble/status.ts`, consuming `feedback-*`/`state-*` tokens (not raw `bg-gray/green/blue`).
- **Replaces:** duplicated maps in `ble-test/page.tsx:16` + `ClimbBleControls.tsx:12`.

---

## 4.3 Rollout (STOP-gate, phased, launch-safe)

**This is a multi-module refactor touching every page → STOP-gate required on the implementing A/B brief** (Phase 0 audit → print call-site list → wait for OK), per CLAUDE.md High-Risk policy spirit. It is NOT on the Reddit launch critical path and should not block it.

Phased so the lowest-risk, highest-value work lands first and each phase is independently shippable + test-green:

1. **Phase A — Tokens only (no visual change intended).** Redefine the orange ramp to `#ff6b35`, add neutral/radius/type tokens to `tailwind.config.ts` + `globals.css`. Swap the 8 inline `#FF6B35` literals → class. **Net effect: the two oranges become one.** Highest value (D18-1), lowest structural risk. Visual diff = subtle hue shift on the `f97316` surfaces — verify on-device.
2. **Phase B — Quick wins, no new components.** `/classify` IT→EN (D18-7, can ship even earlier, standalone). gray→zinc migration on BLE (D18-2). Contrast fix via `brand-600` on solid buttons (D18-8). History picker → soft active style (D18-3). Sign-in Clerk `appearance` branding.
3. **Phase C — Extract primitives, lowest-traffic page first.** Build Chip / Button / Card / EmptyState / LoadingState / ComingSoonBadge / PageHeader. Adopt on `/ble-test` first (lowest traffic, already needs the gray→zinc touch), then `/classify`, then `/history`, then `/discover`, then `/discover/detail` (densest, most-tested — last). One page per commit, both test suites green each time.
4. **Phase D — Homepage port off inline styles** (D18-12) so it consumes tokens + ComingSoonBadge. Preserve the hero gradient/glow as a `hero-gradient` token.
5. **Phase E — Typography** (B030/D18-9). Self-hosted display+body via `next/font`, apply `type-*` scale. Do last — biggest perceptual change, highest risk of derailing, best done when everything else is stable. Verify FOUT-free in the Capacitor build.

Each phase: run `pytest` + `jest` + `tsc` + `npm run build` + on-device Capacitor check (per CLAUDE.md §Capacitor rules); update affected tests (several assert on current classNames/strings — e.g. `classify/page.test.tsx:228` on the Italian label, LogSection class assertions).

---

## Token & component count (for the summary)

- **Tokens proposed:** Color — 4 brand + 6 surface/border + 4 text + 4 state + 4 feedback + 1 hero = **23**; Radius **3**; Elevation **2**; Typography **6**; Spacing — adopt-existing (0 new). → **34 tokens** (+ documented existing spacing scale).
- **Components specified:** **8** — Card, Chip, Button, PageHeader, EmptyState, LoadingState, ComingSoonBadge, StatusDot.
