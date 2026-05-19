# Climbritz Frontend Design Audit — 2026-05-19

**Auditor:** Claude Code (via D017 brief)
**Scope:** 5 primary pages (homepage, `/discover`, `/discover/detail`, `/history`, `/ble-test`) + 8 secondary pages (source-only review)
**Inputs:** 10 iPhone screenshots in `docs/audit-2026-05-19/` (committed as `preview*.webp`, NOT `IMG_7814..7823.png` as the brief expected — see "Input notes" below) + repo source at HEAD `afd6170` + the `frontend-design` skill rubric at `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/frontend-design/SKILL.md`
**Date:** 2026-05-19

---

## Input notes — discrepancies vs. brief

1. **SKILL.md path differed.** The brief specified `/mnt/skills/public/frontend-design/SKILL.md`. That path is from a different sandbox environment. The skill was located at `~/.claude/plugins/marketplaces/anthropic-agent-skills/skills/frontend-design/SKILL.md` and read end-to-end before the audit started. No content gap.
2. **Screenshot filenames differed.** The brief expected `IMG_7814.png` through `IMG_7823.png`. The committed files are `preview.webp` + `preview-2.webp` … `preview-10.webp`. After viewing all 10, the mapping is **reverse-numerical**: `preview.webp` = brief's `IMG_7823` (last), `preview-2.webp` = `IMG_7822`, … `preview-10.webp` = `IMG_7814` (first). All 10 are valid Climbritz screenshots; the report references them by content (not filename) below.
3. **Screenshots are pre-B021.** The committed screenshots show the BottomNav with **5 slots including "Coach"**, the homepage Video Analysis tile with a 🔒 (lock) emoji, and `/discover/detail` rendering the "🎬 Analyze with Coach" CTA. All three have been removed by B021 (commits `260f4b2 / d90bd3e / adb28e7` on the same day as this audit). Where the audit references state that B021 changes, the report explicitly notes whether the finding still applies after B021 or is now stale.

---

## Executive summary

Climbritz's frontend is **functionally complete and visually competent**, but the design system is thin and a small set of high-visibility issues will damage first impressions on TestFlight / Play Store beta. The product idea reads through clearly — the Discovery → log a climb → check History loop is coherent on mobile — but the visual language is utilitarian (default Tailwind palette, system font stack, one custom brand token) where the SKILL rubric and the climbing-domain context both ask for more distinctiveness.

Three themes recur across pages:

1. **Brand color discipline is leaking.** The Kilter brand orange (`#ff6b35` / `bg-orange-500`) is the canonical primary action everywhere except the most-visible CTA on the most-visited screen: the BLE "Connect to board" button is `bg-blue-600`, both on `/ble-test` and on every `/discover/detail` page via `ClimbBleControls`. That single inconsistency reads as "this app is unfinished" before any other UX issue.
2. **Localization is incomplete.** The English-UI rule (CLAUDE.md Code Standards, A021 closeout, `[[feedback_ui_english]]` memory) is violated in three files: the 11 BLE preset descriptions in `app/ble-test/presets.ts`, three Italian copy strings in `app/ble-test/page.tsx`, and two Italian error strings in `app/upload/page.tsx`. Each one is a single string edit; together they're a single brief.
3. **Filter UI carries the most visual debt.** `/discover` mixes 5 different chip styles (chip-pill, rounded button, native `<select>`, full-width primary button, disabled chip-pill) inside one sticky header. Active states use the same orange across all of them, which on the screenshots produces the "Filters button overlapping DONE / PROJECT chip rows" effect Daniele flagged — the actual layout is correct (no negative margins, no z-index conflict), the perceptual overlap comes from same-color adjacency without enough visual separation.

Beyond these, a smaller cluster of P1s sits around the calendar heatmap (one-climb days are barely visible), the back-arrow pattern (History has one despite being a top-level BottomNav route), and the ProjectRemovalModal "Yes, remove" button using the brand orange for what is contextually a destructive action.

**Verdict: fix-P0-first.** Four P0s are blockers for "looks shippable"; all four are XS–S effort. The product is otherwise close enough to invite testers, provided no more P0-equivalent issues are introduced in the next 1–2 weeks of work.

---

## Design system snapshot

**Palette.**
- Brand: `kilter-orange = #ff6b35` (defined in `tailwind.config.ts:12` and re-exported as a CSS variable in `globals.css:4`). Used as `bg-orange-500`, `text-orange-400`, `border-orange-500/50`, `#FF6B35` literal in inline-style pages.
- Background: `bg-zinc-950` (page bg), `bg-zinc-900` (card bg), `bg-zinc-800` (chip inactive bg), borders `border-zinc-800` / `border-zinc-700`.
- Text: `text-white` (primary), `text-zinc-300` (secondary), `text-zinc-400` (tertiary), `text-zinc-500` (muted), `text-zinc-600` (disabled).
- Status colors: yellow (Flash, pending), green (Send, connected), blue (sending, Connect — see P0-4), red (error), amber (warning).

**Typography.**
- Body font stack (`globals.css:22`): `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Generic system-first. SKILL.md flags Inter / Roboto / Arial / system fonts as anti-patterns. See P2-1.
- Hierarchy: `text-2xl font-bold` page titles on `/discover`, `text-xl font-bold` on `/history`, responsive `clamp(40px, 10vw, 72px)` on homepage. No unified display-type system.
- Climbing jargon (Flash / Send / Attempt / Project / Send-or-better) stays in English even when surrounding copy is Italian — per the English-UI rule.

**Spacing & layout.**
- Default Tailwind spacing scale. No customization in `tailwind.config.ts`.
- Three custom utilities in `app/safe-area.css`: `.pt-safe`, `.pb-safe`, `.pb-nav` (introduced in B017 + B-A021-fix-1.6.1).
- Max content width: `max-w-2xl mx-auto` on most pages.
- Touch targets: 44px+ on critical actions (LogSection buttons `min-h-12`, BottomNav slots ~64px, Prev/Next `min-h-16`). Project / Filters meet HIG.

**Iconography.**
- Emoji-heavy: 🏠 🔍 📊 👤 🎬 ⚡ ✓ • ★ ☆ 💡 🏷️ 🔧 ❤️ 🗑 🔒. Pragmatic for a Capacitor app (no icon library bundle cost), but inconsistent line-weight across platforms.
- Two inline SVGs in `/discover/page.tsx` (filter icon, chevron).

**Motion.**
- One custom keyframe (`fadeIn` in tailwind.config) — not used anywhere I could find via grep.
- Tailwind `transition-colors` on hover/focus states across most interactive elements.
- No staggered reveals, no page-load orchestration, no scroll-triggers. SKILL flags this as a missed opportunity.

**Verdict on coherence.** The system is **internally consistent within a low-ambition baseline**. The two custom tokens (`kilter-orange`, `.pb-nav`) plus default Tailwind take the team a long way. But the system can't yet produce a *distinctive* climbing-app aesthetic — it produces a competent dark dashboard that could be any vertical. The SKILL's "BOLD aesthetic direction" criterion is not met today; lifting this is post-launch work, not a P0.

---

## Findings — P0 (ship blockers)

### P0-1 — Dev API banner visible in production builds

- **Location:** `app/discover/page.tsx:271-274`. Screenshot: preview-7.webp (= brief's `IMG_7817`), top of frame, brown banner.
- **What's wrong:** Unconditional render of a yellow-on-brown debug banner showing `API: <Railway URL>`:
  ```tsx
  {/* DEBUG banner — remove after fixing Capacitor fetch issue */}
  <div className="bg-yellow-900/80 text-yellow-200 text-xs px-3 py-1.5 font-mono break-all">
    API: {API_BASE}
  </div>
  ```
  The comment literally says "remove after fixing Capacitor fetch issue" — the fix is overdue. No production gate, no env check.
- **Why it matters:** First impression on a beta tester opening `/discover` is "this is a developer build". The exposed Railway URL is also a low-grade information leak (it's not a secret, but it doesn't belong in retail UX).
- **Suggested fix:** Wrap behind the same `IS_PRODUCTION_BUILD` flag already used in `app/page.tsx:18-20` for the Debug tile, OR delete outright. Recommended: delete (the Capacitor fetch issue it was diagnosing is presumably resolved; `/debug` page exists for emergency network checks).
  ```diff
  -      {/* DEBUG banner — remove after fixing Capacitor fetch issue */}
  -      <div className="bg-yellow-900/80 text-yellow-200 text-xs px-3 py-1.5 font-mono break-all">
  -        API: {API_BASE}
  -      </div>
  ```
- **Effort:** XS (1 line delete + 1 test update).

### P0-2 — Mixed Italian/English UI violates the English-UI rule

- **Location:**
  - `app/ble-test/presets.ts:216, 237, 259, 274, 290, 326, 353, 378, 401, 429, 457` — all 11 preset descriptions in Italian.
  - `app/ble-test/page.tsx:247` ("Anteprima visiva"), `:259` ("Colori ruolo"), `:276` ("Richiede l'app Climbritz (BLE via Capacitor)").
  - `app/upload/page.tsx:33` ("File troppo grande. Max 500MB."), `:35` ("Formato non supportato. Usa MP4, MOV o WebM.").
  - Screenshots: preview-8.webp (= brief's `IMG_7816`, BLE LED Test page).
- **What's wrong:** Page titles + button labels are English, but inline copy (descriptions, headers, error messages) is Italian. Violates the rule pinned in CLAUDE.md Code Standards and `[[feedback_ui_english]]`: "English for code AND rendered UI strings; climbing jargon — flash/send/attempt/project — stays untranslated."
- **Why it matters:** International testers immediately read this as "half-translated app". The errors in `/upload` are user-facing (file-too-large is a common case) — first beta tester on Android with a big MOV file hits this within 30 seconds.
- **Suggested fix:** Translate all flagged strings, preserve the playful tone in BLE preset descriptions. Sample translations:

  | Preset | Italian (current) | English (proposed) |
  |---|---|---|
  | Space Invader | Alieno pixel art — Taito 1978 | Pixel-art alien — Taito 1978 |
  | Ghost Blinky | Fantasma rosso Pac-Man con occhi | Pac-Man-style red ghost with eyes |
  | Zelda Heart | Heart container 8-bit in rosso puro | Pure-red 8-bit heart container |
  | Star | Stella gialla a 5 punte | 5-point yellow star |
  | Sun | Sole arancione con raggi gialli | Orange sun with yellow rays |
  | DANI | Scritta "DANI" in LED rossi | "DANI" written in red LEDs |
  | Climber | Omino che arrampica — posa dinamica | Climber figure — dynamic pose |
  | Heart | Cuore rosso e magenta | Red-and-magenta heart |
  | Lightning | Fulmine giallo a tutta altezza | Full-height yellow lightning bolt |
  | Smile | Faccione sorridente | Big smiley face |
  | All LEDs Diagnostic | Stress test — tutte le LED, strisce arcobaleno dal basso | Stress test — all LEDs, rainbow stripes from the bottom |

  Other strings:
  - "Anteprima visiva" → "Visual preview"
  - "Colori ruolo" → "Role colors"
  - "Richiede l'app Climbritz (BLE via Capacitor)" → "Requires the installed Climbritz app (BLE via Capacitor)"
  - "File troppo grande. Max 500MB." → "File too large. Max 500MB."
  - "Formato non supportato. Usa MP4, MOV o WebM." → "Unsupported format. Use MP4, MOV, or WebM."

  Update the matching jest tests in `app/ble-test/__tests__/presets.test.ts` if they assert on the description strings.
- **Effort:** S (~20 string replacements + 1–2 test fixture tweaks).

### P0-3 — Same-orange visual collision between chip filters and the Filters button

- **Location:** `app/discover/page.tsx:310-386` (ChipRows + filter-toggle). Screenshot: preview-7.webp.
- **What's wrong:** The brief diagnosed this as "Filters button overlaps DONE/PROJECT chip rows" and asked whether it's a z-index or margin bug. **It isn't.** The layout is correct: chip-filters is a `space-y-2` flow inside a `space-y-3` parent, no negative margins, no absolute positioning. The "overlap" is purely a visual-language problem:
  - Active "All" chips in the DONE / PROJECT rows render `bg-orange-500 border-orange-500 text-white font-semibold` (line 57-58 of the local ChipRow).
  - The Filters toggle button below renders `bg-orange-500 text-white` when `activeFilterCount > 0` (line 339).
  - Two consecutive UI elements painted the same brand orange, with only a 12px `space-y-3` gap between them and no visual divider, read as one orange blob on a 6.1" iPhone screen.
- **Why it matters:** The Filters button is the page's primary affordance (it gates the entire filter panel). When it visually merges into the chip rows above, it loses its hierarchical weight and looks like "another chip" instead of "open the filter panel". The screenshot fairly reads as a bug to a layperson.
- **Suggested fix:** Two complementary moves. (1) Demote the active chip's visual weight so it doesn't compete with the brand-orange Filters CTA — change `bg-orange-500` on the active chip to `bg-orange-500/15 border-orange-500 text-orange-200` (filled outline, not solid fill). (2) Add a 1px border-top divider OR `mt-1` to the Filters button to break the orange-on-orange adjacency. Pseudocode:
  ```diff
  -                  ? 'bg-orange-500 border-orange-500 text-white font-semibold'
  +                  ? 'bg-orange-500/15 border-orange-500 text-orange-200 font-semibold'
  ```
  And on the Filters toggle:
  ```diff
  -            className={`w-full min-h-[56px] px-4 py-4 rounded-xl flex items-center justify-between ...`}
  +            className={`w-full mt-2 min-h-[56px] px-4 py-4 rounded-xl flex items-center justify-between ...`}
  ```
  Verify on iPhone with the broadest filter set (Moves=8-10 active) — the visual should now read as "two distinct rows of chips → big orange action button below".
- **Effort:** XS (2 className tweaks + visual on-device check).

### P0-4 — BLE "Connect to board" button uses generic blue instead of brand orange

- **Location:**
  - `components/ClimbBleControls.tsx:179` (visible on every `/discover/detail`).
  - `app/ble-test/page.tsx:155` (Connect), `:227` (active preset card uses `bg-blue-700 ring-2 ring-blue-400`), `:249` (`text-blue-400` on the preview header).
  - Screenshots: preview-4.webp / preview-5.webp / preview-6.webp (Connect button at the top of the climb detail viewport, every climb); preview-8.webp (BLE LED test page).
- **What's wrong:** Default Tailwind `bg-blue-600` used as the primary CTA color for the BLE connect flow. Climbritz's brand color is `kilter-orange`. Every other primary CTA across the app uses orange (Filters, "Yes, remove" modal, sort active, range pickers, "Send or better" pyramid filter, calendar heatmap intensity). The Connect button is the **single most prominent non-orange element on the most-visited screen**: it's the second visual element after the climb title on `/discover/detail`, and it appears regardless of whether the user even owns a Kilter Board.
- **Why it matters:** A beta tester scrolling through climbs sees the same bright-blue button on every screen, in a dark zinc + brand-orange UI. It reads as "vendor widget pasted in" — a strong "unfinished" signal. The active-preset blue ring on `/ble-test` compounds this: the page that's supposed to demo brand polish (LED art) has its strongest accent in a non-brand color.
- **Suggested fix:** Replace blue with orange for primary BLE actions; keep blue for the *transient* `sending` status pulse (where blue is a status convention, not a brand statement). Specifically:
  ```diff
  // components/ClimbBleControls.tsx:179
  -          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-500 transition-colors"
  +          className="w-full py-2.5 rounded-lg font-semibold text-sm bg-orange-500 hover:bg-orange-400 transition-colors"
  ```
  ```diff
  // app/ble-test/page.tsx:155 (same change)
  ```
  ```diff
  // app/ble-test/page.tsx:227 — active preset card
  -                    ? 'bg-blue-700 ring-2 ring-blue-400'
  +                    ? 'bg-orange-500/20 ring-2 ring-orange-500'
  ```
  ```diff
  // app/ble-test/page.tsx:249 — preview header accent
  -              <span className="ml-2 text-blue-400 normal-case font-normal">
  +              <span className="ml-2 text-orange-300 normal-case font-normal">
  ```
  Keep the `sending: 'bg-blue-400 animate-pulse'` status indicator (line 23 in both files) — blue here is a transient busy state, not a brand element.
- **Effort:** XS (4 className edits + visual check on /ble-test + /discover/detail).

---

## Findings — P1 (important quality)

### P1-1 — `/history` has a back-arrow despite being a top-level BottomNav route

- **Location:** `app/history/page.tsx:134-141`. Screenshots: preview.webp + preview-2.webp + preview-3.webp (top-left, every History viewport).
- **What's wrong:** History is the 3rd slot in the BottomNav (Home / Discover / **History** / Coach / Profile pre-B021; Home / Discover / **History** / Profile post-B021). Top-level destinations don't conventionally have back arrows; the back arrow implies "return to the page you came from", but the link target is hard-coded to `/`. Compare `/discover` (also top-level): no back arrow, just an `h1`. Compare `/discover/detail` (nested): has back arrow that returns to `/discover`. The inconsistency makes the nav model harder to learn.
- **Why it matters:** Either (a) a tester who taps the History back-arrow expecting to return to a previous Discover detail page gets dropped on the homepage, which is jarring; or (b) the back-arrow implies History is a "sub-page of home", undermining its first-class status in the nav.
- **Suggested fix:** Drop the back arrow on `/history`; keep the `h1`. Pattern: top-level routes (anything reachable from BottomNav) have no back arrow, only a header h1. Nested routes (anything reachable only via a parent) have a back arrow + parent label.
  ```diff
  -          <div className="flex items-center gap-3">
  -            <Link
  -              href="/"
  -              data-testid="back-link"
  -              className="text-zinc-400 hover:text-orange-400 text-2xl leading-none"
  -              aria-label="Back to home"
  -            >
  -              ←
  -            </Link>
  -            <h1 className="text-xl font-bold">History</h1>
  -          </div>
  +          <h1 className="text-xl font-bold">History</h1>
  ```
  Apply the same pattern audit elsewhere: `/discover` correctly has no back arrow; `/ble-test` has no back arrow (right — top-level); `/classify` and `/dashboard` should follow the same rule.
- **Effort:** XS (3 lines, 1 test update for `data-testid="back-link"` not present).

### P1-2 — Calendar heatmap: 1-climb days nearly invisible

- **Location:** `app/history/calendar.tsx:179-185`. Screenshots: preview-2.webp (May 18 + May 19, single-climb days; May 11 with 3 climbs is much more visible).
- **What's wrong:**
  ```ts
  function intensityClass(count: number): string {
    if (count === 0) return 'bg-zinc-900 text-zinc-600';
    if (count === 1) return 'bg-orange-500/20 text-orange-200';  // ← 20% opacity on zinc-950
    if (count <= 3) return 'bg-orange-500/40 text-orange-100';
    if (count <= 6) return 'bg-orange-500/70 text-white';
    return 'bg-orange-500 text-white';
  }
  ```
  At 20% opacity on a near-black background, the 1-climb day is barely distinguishable from an inactive day on a phone in bright indoor / outdoor light (the typical gym setting). Daniele flagged this; confirmed against the screenshots.
- **Why it matters:** The calendar's primary job is "show me when I trained recently at a glance". If single-climb days vanish, the heatmap fails its core promise. Users with sparse logs (most beta testers in their first 2 weeks) get the worst experience.
- **Suggested fix:** Bump the intensity floor and widen the gradient. Recommended:
  ```diff
  -  if (count === 1) return 'bg-orange-500/20 text-orange-200';
  -  if (count <= 3) return 'bg-orange-500/40 text-orange-100';
  -  if (count <= 6) return 'bg-orange-500/70 text-white';
  +  if (count === 1) return 'bg-orange-500/35 text-orange-100';
  +  if (count <= 3) return 'bg-orange-500/55 text-white';
  +  if (count <= 6) return 'bg-orange-500/80 text-white';
  ```
  Verify on-device in a bright environment; the 35% floor balances "visible single days" with "doesn't shout louder than 7+ days".
- **Effort:** XS.

### P1-3 — FilterPanel mixes 3 control idioms (chip / button / native select)

- **Location:** `components/FilterPanel.tsx`. Screenshot: preview-7.webp (filter panel expanded).
- **What's wrong:** Within one panel:
  - **Min Ascents, Min Stars, Moves** use rounded-full chip pills (`px-3 py-1.5 rounded-full ...`).
  - **Sort by** uses rounded rectangular buttons (`px-3 py-2 rounded ...`) — same active orange treatment but different shape.
  - **Grade Range** uses native HTML `<select>` boxes (`bg-zinc-800 border border-zinc-700 rounded px-2 py-2`). On iOS Safari these render the system picker, which looks nothing like the chip-pill aesthetic and breaks the dark-theme palette (the native picker uses iOS light-mode by default unless ColorScheme is set).
  - **Grip Type** (disabled) uses rounded-full chips but with extra "Coming soon" inline text, in a different orange shade (`text-orange-400/80`).
- **Why it matters:** The panel feels like 3 different designers contributed to it. Power users will adapt; first-time testers won't. The visual fragmentation also makes "what's a filter, what's an action, what's a setting" harder to learn.
- **Suggested fix:** Unify on chip-pills. Specifically:
  - Sort buttons → `rounded-full px-3 py-1.5` to match Min Ascents.
  - Grade Range → replace `<select>` with a compact "From [grade] To [grade]" trigger that opens a bottom-sheet picker, or use chip rows for the most common grade bands (V0-V2 / V3-V5 / V6-V8 / V9+) with a "More…" link for fine-grained selection. Lower-cost interim: keep `<select>` but force dark-theme appearance via `color-scheme: dark` on the wrapper and reduce visual prominence with a smaller font.
  - Grip Type "Coming soon" → match the homepage's COMING SOON badge styling (filled orange pill, white text) for consistency. See P1-7.
- **Effort:** M (Grade Range alone is non-trivial if we go bottom-sheet; otherwise S).

### P1-4 — ProjectRemovalModal: "Yes, remove" uses brand orange for a destructive action

- **Location:** `components/LogSection.tsx:350-357`. Not in screenshots; modal opens only when the user logs Flash/Send on a flagged project.
- **What's wrong:**
  ```tsx
  <button
    type="button"
    data-testid="modal-confirm-remove"
    onClick={onConfirmRemove}
    className="min-h-14 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold border-2 border-orange-600"
  >
    Yes, remove
  </button>
  ```
  The destructive action (removing the climb from your projects after sending it) is painted in the same brand orange used elsewhere for "primary affirmative action". The "No, keep it" alternative uses neutral zinc. This inverts the conventional confirm-modal pattern, where destructive actions are red and safe actions are primary brand.
- **Why it matters:** Users hitting this modal in the wild (sent a long-standing project) might tap the orange button on muscle memory ("orange = continue") and lose their project flag without intending to. Once the flag is gone, the StateIcons strip drops the ★, and the project no longer surfaces in `project_filter=only`. Reversible (re-tap Project) but annoying.
- **Suggested fix:** Make the destructive option clearly destructive (red), and elevate the "Keep it" option to primary brand (since "I just sent it and it's still a project I might revisit" is the more conservative, generally-correct default).
  ```diff
  -        className="min-h-14 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold border-2 border-orange-600"
  +        className="min-h-14 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold border-2 border-red-700"
  ```
  ```diff
  // "No, keep it" — promote to primary
  -        className="min-h-14 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold border-2 border-zinc-700"
  +        className="min-h-14 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold border-2 border-orange-600"
  ```
  Update LogSection tests if they assert on classNames.
- **Effort:** XS (2 className swaps + 1 test update).

### P1-5 — Stats strip on `/history` shows zero-value cells with equal visual weight

- **Location:** `app/history/page.tsx:172-180` (rendering) + `:249-261` (`StatCard`). Screenshot: preview-3.webp (stats strip: `3 SESSIONS / ⚡5 FLASHES / ✓0 SENDS / 6c+/V5 PEAK`).
- **What's wrong:** All 4 StatCards render with identical visual weight regardless of value. When the user has zero sends (common for early testers), `✓0 SENDS` reads as prominently as `5 FLASHES`. The card has a strong border, dark bg, and the value is `text-xl font-bold tabular-nums`.
- **Why it matters:** Two issues compound:
  1. Zero values draw attention to gaps in the data ("you've done 0 sends" → "the app thinks I'm failing") rather than highlighting wins.
  2. The stats strip is the first thing the user sees on `/history`. The framing should be celebratory, not deficit-tracking.
- **Suggested fix:** Mute zero-value cells visually. Either (a) skip rendering zero-value cells, (b) render them in `text-zinc-500` instead of `text-white`, or (c) replace the value with a placeholder "—" similar to how Peak renders when null.
  ```diff
  function StatCard({ label, value, icon }: StatCardProps) {
  +   const isZero = typeof value === 'number' && value === 0;
      return (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-3 text-center">
  -       <div className="text-xl font-bold text-white tabular-nums">
  +       <div className={`text-xl font-bold tabular-nums ${isZero ? 'text-zinc-500' : 'text-white'}`}>
            {icon && <span className="mr-1">{icon}</span>}
            {value}
          </div>
          ...
        </div>
      );
    }
  ```
- **Effort:** XS.

### P1-6 — Project button on `/discover/detail` is both a toggle and a status indicator without visual distinction

- **Location:** `components/LogSection.tsx:256-274`. Screenshots: preview-4.webp + preview-5.webp + preview-6.webp.
- **What's wrong:** The Project button serves two roles simultaneously: (a) toggle action ("tap to mark this climb as a project") and (b) status indicator ("this climb IS a project"). The visual encoding (`★` filled orange = is_project, `☆` outline gray = not is_project) is correct — Daniele's puzzle in the brief about "fresh climbs filled, history climbs outline" turns out to be the user's actual state: `swooped` and `Drawing the Priest` happen to be marked as projects in the test data, while `You Don't Know Me` is not — but the dual role is still ambiguous in copy. The button always says "Project"; the user has to read the star fill to know what they're toggling.
- **Why it matters:** First-time testers won't immediately understand that the orange star means "this climb is currently a project, tap to remove" vs. "tap to add this to your projects". Especially when adjacent buttons (Flash / Send / Attempt) all have unambiguous action semantics (tap to log).
- **Suggested fix:** Dynamic label tied to state. Pseudocode:
  ```tsx
  <span className="text-[10px] leading-tight">
    {pending === 'project' ? '…' : isProject ? 'Unproject' : 'Project'}
  </span>
  ```
  Or use action verbs: `Save` / `Saved` (matches more apps' "save to a list" idiom). Or keep "Project" as the noun but add a small inline indicator (`Project ✓` when active).
- **Effort:** XS (label change + 1–2 LogSection test assertions).

### P1-7 — "Coming soon" treatment is fragmented across the app

- **Location:**
  - `components/FilterPanel.tsx:255-257` — inline orange text "Coming soon" next to the GRIP TYPE header (`text-[0.65rem] font-normal text-orange-400/80 normal-case`).
  - `app/page.tsx:159-176` (post-B021) — filled pill `#FF6B35` background, white uppercase text on the Video Analysis tile.
  - Screenshots: preview-7.webp (Filter panel), preview-9.webp (Homepage with 🔒 — pre-B021; post-B021 the pill replaces the lock).
- **What's wrong:** Two visually different "Coming soon" patterns in the same app: a soft 65%-opacity orange text in the filter panel, and a bold orange pill on the homepage tile.
- **Why it matters:** Users learn UI patterns. Two treatments for the same "this feature exists but isn't ready" signal slows that learning.
- **Suggested fix:** Unify on the homepage pill style (B021). Extract into a small component `<ComingSoonBadge />` so future "not ready" surfaces inherit the same treatment.
  ```tsx
  // components/ComingSoonBadge.tsx
  export function ComingSoonBadge() {
    return (
      <span
        className="inline-block rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      >
        Coming Soon
      </span>
    );
  }
  ```
  Replace the inline orange text in FilterPanel with `<ComingSoonBadge />`. Replace the inline-style block on the homepage tile (currently in `app/page.tsx`) with the same component (note: homepage is inline-styled, so the unification requires either porting the homepage tile to Tailwind classes or porting the badge to inline styles — recommended: port the homepage to Tailwind during this work).
- **Effort:** S.

---

## Findings — P2 (polish)

### P2-1 — System font stack is generic; no distinctive type voice

- **Location:** `app/globals.css:22`, `app/privacy/page.tsx:12`.
- **What's wrong:** Body font stack uses `-apple-system, …, Roboto, …, Arial, sans-serif` — exactly the anti-pattern called out in SKILL.md ("Avoid generic fonts like Arial and Inter; opt instead for distinctive choices").
- **Suggested fix:** Pick one display font for headings (climbing brand spaces tend toward condensed, slightly mechanical fonts — Space Grotesk would be the SKILL anti-pattern, but Archivo Narrow, Druk-style, or even a hand-set wordmark would fit). Pair with a refined body font (Inter Tight, or a tighter sans). Load via `next/font` to keep the static-export build clean.
- **Effort:** M (font selection + integration + visual sweep across all pages).

### P2-2 — Homepage 5-tile grid leaves an unbalanced bottom row

- **Location:** `app/page.tsx:120-175`. Screenshots: preview-9.webp + preview-10.webp.
- **What's wrong:** 5 product tiles in a 2-column grid → bottom row has 1 tile (History) with a visible empty cell to its right. Asymmetry without intent reads as "missing a tile".
- **Suggested fix:** Three options ranked by effort:
  1. Center the orphan tile in the last row (`grid-template-columns: repeat(2, 1fr)` with `grid-column: 1 / -1` on the last tile + `justify-self: center` + `max-width: calc(50% - 8px)`).
  2. Add a 6th product tile (a "What's new" or "Climb of the day" card — but this requires a content strategy decision).
  3. Re-layout as a vertical stack on phones, accepting a slightly less hub-like feel. Trade-off: more scroll, but no asymmetry.
- **Effort:** XS for option 1; M for option 2 (needs content).

### P2-3 — Homepage has no BottomNav; rationale not documented

- **Location:** `app/page.tsx`. Screenshots: preview-9.webp + preview-10.webp.
- **What's wrong:** Every other AuthGuard-wrapped page mounts `<BottomNav />`; the homepage doesn't. This is likely intentional ("home = launcher, not a destination among destinations"), but the rationale isn't in code comments or in `ARCHITECTURE.md`.
- **Suggested fix:** Decide and document. If the launcher model is intentional, add a one-line comment to `app/page.tsx` and an entry to ARCHITECTURE.md's Frontend pages section. If it's accidental, add `<BottomNav />` for consistency (the Home tab would self-highlight on `/`, which is fine UX).
- **Effort:** XS (decision + docs).

### P2-4 — BLE preset cards feel cramped

- **Location:** `app/ble-test/page.tsx:215-242`. Screenshot: preview-8.webp.
- **What's wrong:** 11 preset cards in a 2-column grid + a full-width #11 stress test card. At `p-3 gap-3` with `text-sm` titles + `text-xs` descriptions in 2 lines, cards on a 6.1" iPhone are dense and hard to scan. Especially compared to the visual richness of the LED art they encode.
- **Suggested fix:** Either (a) add a tiny LED-art thumbnail per card (12x12 grid of dots showing the preset shape), turning the cards into a visual gallery, or (b) increase padding to `p-4 gap-4` and use larger card titles. (a) is delightful but bigger work; (b) is a 1-minute change.
- **Effort:** XS for (b); M for (a).

### P2-5 — CTA shape inconsistency

- **Location:** Across the app.
- **What's wrong:** No unified shape system for primary actions. Examples:
  - LogSection result buttons: `rounded-lg` (8px radius)
  - Filters toggle: `rounded-xl` (12px)
  - Chip filters: `rounded-full`
  - Sort buttons inside FilterPanel: `rounded` (4px)
  - Modal CTA buttons: `rounded-lg`
  - BottomNav links: no radius (full bleed)
- **Suggested fix:** Define a 3-tier radius system in tailwind.config and document it:
  - `rounded-pill` (full) — chips, toggles, filters
  - `rounded-card` (12px / xl) — primary actions, modals, cards
  - `rounded-lite` (8px / lg) — secondary, list items
  Apply consistently. Worth doing alongside P2-7 (status color unification).
- **Effort:** M.

### P2-6 — Page title hierarchy is inconsistent across routes

- **Location:** Across the app.
- **What's wrong:**
  - Homepage: responsive `clamp(40px, 10vw, 72px)` — display wordmark, with orange glow
  - `/discover`: `text-2xl font-bold` (~24px)
  - `/history`: `text-xl font-bold` (~20px)
  - `/discover/detail`: `text-xl font-bold` climb name + grey "Discover" parent label
  - `/ble-test`: `text-2xl font-bold mb-1` + gray subtitle
  No display-type system to express "this is a page-level title" consistently.
- **Suggested fix:** Define page-title sizing in tailwind.config as a semantic token (e.g. `text-page-title`). Or just pick one (`text-2xl font-bold`) and apply uniformly.
- **Effort:** XS.

### P2-7 — Status colors mix brand-specific and default Tailwind tones without a tokenized system

- **Location:** Across the app.
- **What's wrong:** Status uses default Tailwind colors (`bg-yellow-500`, `bg-green-600`, `bg-blue-500`, `bg-red-500`, `bg-amber-...`) — fine baseline, but the variant intensities are inconsistent (yellow-500 vs yellow-300 for text, etc.) and there's no semantic naming (`color-success`, `color-warning`, etc.).
- **Suggested fix:** Add semantic color tokens to `tailwind.config.ts`:
  ```ts
  colors: {
    'kilter-orange': '#ff6b35',
    'state-flash': '#fcd34d',  // yellow-300
    'state-send': '#34d399',   // emerald-400
    'state-attempt': '#a1a1aa', // zinc-400
    'state-project': '#ff6b35', // brand
    'state-error': '#f87171',  // red-400
  }
  ```
  Refactor LogSection, StateIcons, RecentLogs to use the tokens.
- **Effort:** S.

---

## Per-page recap

### Homepage (`app/page.tsx`)
**What works:** Bold brand wordmark with orange glow is a memorable hero moment — the strongest single design statement in the app. Tile cards have a refined subtle-orange border. Inline styles keep the homepage independent of Tailwind class quirks. Debug tile production guard (A021 closeout) is clean.
**What needs work:** P2-2 (orphan tile bottom-row), P2-3 (BottomNav rationale). Post-B021 the COMING SOON badge replaces the 🔒, which is an improvement. The screenshot still shows the 🔒 — the fix is already live in `main`.
**Findings on this page:** P2-2, P2-3, references to P1-7 (badge unification).

### `/discover` (`app/discover/page.tsx`)
**What works:** Sticky header makes the search-and-filter affordance reachable at all scroll depths. Angle row works well as a horizontal-scroll chip strip. ClimbCard layout (grade pill, name, author, stars, ascents, angle, StateIcons) is information-dense without feeling crowded. B020 overflow banner is honest UX ("we capped your results, narrow the filters").
**What needs work:** P0-1 (dev banner — top of page, first thing seen), P0-3 (filter-chip same-orange collision). Once those land, this page is the strongest in the app.
**Findings:** P0-1, P0-3, P1-3 (FilterPanel control idiom mix), references to P1-7.

### `/discover/detail` (`app/discover/detail/page.tsx`)
**What works:** Climb name + grade + stars + ascents header is well-composed. Board visualization capped at `max-w-[280px]` (post-B-A021-fix-1.6) lets the LogSection breathe above. RecentLogs mini-list is clean.
**What needs work:** P0-4 (blue Connect button is the dominant visual element on the page). P1-6 (Project button dual role). Post-B021 the "Analyze with Coach" CTA is gone; screenshots still show it.
**Findings:** P0-4, P1-6, references to P0-2 (no Italian here, but consistency check needed when Coach lands).

### `/history` (`app/history/page.tsx`)
**What works:** Single-scroll page successfully chains stats / activity / sessions / pyramid / trend into one continuous flow. Range picker (7d/30d/90d/1y/All) is unobtrusive. Hand-rolled CSS-grid calendar avoids a heavy library. Sessions list with per-day cards + tap-through to detail is a solid pattern.
**What needs work:** P1-1 (spurious back arrow), P1-2 (heatmap contrast), P1-5 (zero-value stats). The page is the second-most-visited after Discover; these tweaks compound into a noticeably better experience.
**Findings:** P1-1, P1-2, P1-5.

### `/ble-test` (`app/ble-test/page.tsx`)
**What works:** Preset selection + LED preview flow demos the brand promise — there's a "wow" moment the first time you tap Smile and see the LEDs light up the board image. The status bar with colored dot + connection state is well-engineered. Connect/Disconnect lifecycle is robust (validated on-device per B012).
**What needs work:** P0-2 (mixed Italian/English — 11 preset descriptions, "Anteprima visiva", "Colori ruolo", footer copy), P0-4 (blue Connect + active-preset blue). This is also the most visual page in the app — once both P0s land it becomes the brand showcase it's meant to be.
**Findings:** P0-2, P0-4, P2-4 (preset density).

---

## Cross-page consistency observations

- **Back-arrow rule:** Should be *only* on nested routes. Currently violated by `/history` (P1-1). `/discover/detail` correctly has one. `/discover`, `/ble-test`, `/classify`, `/dashboard` correctly don't.
- **Primary CTA color:** Should be brand orange. Currently violated by BLE Connect (P0-4). All other primary CTAs (Filters toggle, sort active, range picker active, calendar cells, modal "Yes, remove" — though P1-4 argues this should change) use orange.
- **Chip vs button vs select:** Filter UI mixes all three. Pick one (chip), apply uniformly. Sort and Grade Range are the violators (P1-3).
- **Page title:** No semantic class. `text-2xl font-bold` is the most common; standardize (P2-6).
- **Empty states:** Inconsistent. RecentLogs uses italic gray text ("No attempts yet. Log your first one above."). SessionsList uses italic gray text but no CTA ("No sessions in this range yet."). FilterPanel "No climbs match" uses non-italic gray. Same pattern, three implementations.
- **Loading states:** Inconsistent. Discovery uses "Searching…", Detail uses "Loading climb…", History uses "Loading…". A reusable `<LoadingState>` would unify.
- **"Coming soon" affordance:** Two visual treatments (P1-7).
- **Status dot:** ClimbBleControls and `/ble-test` define identical `STATUS_COLORS` and `STATUS_LABELS` (`components/ClimbBleControls.tsx:12-32` and `app/ble-test/page.tsx:16-36`) — verbatim duplicates. Should live in `lib/ble/`. (This is a code-org observation, not a UX finding — flagging for completeness.)

---

## Secondary pages — quick source review

(No screenshots available; source-only consistency check.)

- **`/sign-in` + `/sign-up`** (`app/sign-in/page.tsx`, `app/sign-up/page.tsx`): Both render the Clerk hosted widget centered in a dark zinc background with `pt-safe`. Pre-auth pages so no BottomNav (correct). Consistent.
- **`/upload`** (`app/upload/page.tsx`): **Italian error strings** at lines 33 + 35 — flagged in P0-2. Otherwise consistent with the rest of the app (uses `react-dropzone`, AuthGuard, BottomNav not mounted here — should it be? `/upload` is reachable from the Video Analysis homepage tile, so post-B021 BottomNav consistency depends on whether `/upload` is treated as a "Coach sub-page" or a top-level destination. Currently no BottomNav → reads as a one-shot flow, which is fine.).
- **`/classify`** (`app/classify/page.tsx`): Uses blue extensively (`bg-blue-600`, `border-blue-700`) — **intentional**, this is the taxonomy color (Good Crimp = blue per `state.ts:41`). The page is the most creative color-wise; the blue is a category color, not a brand statement. No conflict with P0-4.
- **`/dashboard`** (`app/dashboard/page.tsx`): Uses brand orange (`bg-[#FF6B35]`) for the primary CTAs. Status badges use blue for "Analyzing…", green for "Completed", red for "Error" — standard status palette, OK. Has a back arrow / Clerk UserButton header pattern that differs from `/discover` and `/history` — worth a sweep when P1-1 is addressed.
- **`/board-map`** (`app/board-map/page.tsx`): Uses blue for the active hold filter (line 34: `border-blue-500 bg-blue-500/20 text-blue-300`) — intentional category color. Consistent.
- **`/videos/detail`** (`app/videos/detail/page.tsx`): Score bar uses brand orange (`bg-[#FF6B35]`) — good. Impression badge uses category colors (`onsight` = blue) — fine.
- **`/privacy`** (`app/privacy/page.tsx`): Inline styles with `#FF6B35` heading, `system-ui` font, gradient bg. Consistent with the homepage's inline-style approach. Standalone page (no AuthGuard, no BottomNav) — appropriate, this is a Play Store / legal requirement page.

---

## Recommended priority order for fixes

Numbered as candidate follow-up briefs. Each is small enough to be a Type B (`B0xx`). If multiple findings cluster, they're bundled into a single brief.

1. **B022 — Hide dev API banner in production builds (or delete)**
   - Closes: P0-1
   - Effort: XS (single file: `app/discover/page.tsx`)
   - Why first: highest-visibility / lowest-effort. Single line delete.

2. **B023 — Translate all Italian UI strings to English**
   - Closes: P0-2
   - Effort: S (3 files: `app/ble-test/presets.ts`, `app/ble-test/page.tsx`, `app/upload/page.tsx` + corresponding test fixtures)
   - Why second: enforces the English-UI rule that's pinned in CLAUDE.md, removes the "half-translated app" signal.

3. **B024 — BLE Connect + active-preset use brand orange (replace blue)**
   - Closes: P0-4
   - Effort: XS (2 files: `components/ClimbBleControls.tsx`, `app/ble-test/page.tsx`)
   - Why third: single most-visible non-brand element across the app.

4. **B025 — Differentiate chip filter actives from the Filters CTA button (Discover header)**
   - Closes: P0-3
   - Effort: XS (1 file: `app/discover/page.tsx`)
   - Why fourth: the "overlap" appearance is a same-color collision; the fix is a tone shift on active chips + minor spacing tweak.

5. **B026 — `/history` page: drop spurious back arrow + heatmap contrast + zero-value stat dimming**
   - Closes: P1-1, P1-2, P1-5
   - Effort: XS (1 file: `app/history/page.tsx` for arrow + stats; 1 file: `app/history/calendar.tsx` for heatmap)
   - Why fifth: bundled because all three live on the same page and ship together cleanly.

6. **B027 — LogSection Project button label dynamic + ProjectRemovalModal destructive-color swap**
   - Closes: P1-4, P1-6
   - Effort: S (1 file: `components/LogSection.tsx` + test updates)
   - Why sixth: improves the most-frequently-tapped flow on `/discover/detail`.

7. **B028 — Unify "Coming Soon" badge component + FilterPanel control idiom sweep**
   - Closes: P1-3, P1-7
   - Effort: M (new shared component + FilterPanel refactor + 2 callers)
   - Why seventh: cosmetic polish across 2 pages; less urgent than the page-specific fixes but still pre-launch worthwhile.

8. **B029 — Design system pass: shape system, page-title sizing, status color tokens**
   - Closes: P2-5, P2-6, P2-7
   - Effort: M (tailwind.config tokens + visual sweep across all pages)
   - Why eighth: structural cleanup. Post-launch acceptable; pre-launch worth doing if there's slack.

9. **B030 — Typography lift: distinctive display + body font pairing**
   - Closes: P2-1
   - Effort: M (font selection + next/font integration + visual review across all pages)
   - Why last: largest design statement, biggest payoff for "looks designed" perception, but also highest risk of derailing other work. Schedule post-beta.

Not in priority order:

- **B-future-X — Homepage tile balance / launcher rationale / BLE preset gallery**
  - Closes: P2-2, P2-3, P2-4
  - Effort: XS–M depending on direction
  - Why deferred: each requires a design decision (centered orphan vs 6th tile, intentional launcher vs missing BottomNav, denser cards vs visual gallery) that's worth slowing down for.

---

## Out-of-scope observations

These came up during the audit but aren't UX findings per se — flagging for Daniele's awareness, not as briefs.

- **The B020 "Showing first 500 of N results" banner is well-designed and works as intended.** Honest signal, brand-orange, readable. No fix needed.
- **The `/discover` page has no clear primary CTA above the fold beyond search + filters.** This is a strategic question, not a design fix: is the "happy path" on Discovery (a) "tap a climb to see detail" (passive browse), (b) "build a session" (not yet implemented), or (c) "filter by grip type" (Coming Soon)? The current layout supports (a) by default; once the AI session builder ships, the page should probably surface a sticky "Build a session from these results" CTA. Schedule with the session-builder brief, not as a design audit follow-up.
- **The Climb name discrepancy in the brief's candidate findings ("Priest Drawn" vs. "Drawing the Priest") is not a bug.** They are two distinct climbs in the BoardLib DB — "Priest Drawn" (6c+/V5) and "Drawing the Priest" (7a/V6). No truncation, no fix.
- **`STATUS_COLORS` and `STATUS_LABELS` are duplicated verbatim between `app/ble-test/page.tsx:16-36` and `components/ClimbBleControls.tsx:12-32`.** Code-org concern, not UX. Extract to `lib/ble/status.ts` for single source of truth — but defer, low priority.
- **Project button is internally consistent: `is_project=true → ★ filled orange`, `is_project=false → ☆ outline gray`.** The brief's puzzle about screenshots showing fresh climbs as filled is resolved: those specific test climbs (`swooped`, `Drawing the Priest`) are flagged as projects in Daniele's user_climbs DB. No bug. P1-6 still applies (dual-role label is ambiguous), but the visual encoding itself is correct.
- **The homepage gradient + glow on the CLIMBRITZ wordmark is the strongest brand moment in the app.** Worth preserving and possibly extending — e.g., a subtle particle / climbing-hold visual layer behind the tiles could elevate this further (SKILL.md mentions "atmosphere and depth rather than defaulting to solid colors"). Not a finding; an opportunity.

---

*End of audit. Generated by Claude Code via D017 brief on 2026-05-19 against HEAD `afd6170`.*
