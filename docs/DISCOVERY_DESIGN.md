# Kilter-Up Discovery — Product Design Document

> Version: 0.2 — April 2, 2026
> Author: Daniele Somensi + Claude (strategy)
> Status: DRAFT v2 — decisions validated, ready for full review

---

## 1. Product Vision

**Kilter Climb Discovery** is the free tier of Kilter-Up. It turns the 160,000+ Kilter Board climb database into an intelligent training companion: search climbs by grip type, get AI-built sessions, generate new problems, and light up the board — all from one app.

**One-liner:** "The AI training partner that knows every hold on your Kilter Board."

**Architecture decision (Council verdict, April 1 2026):** One product, two tiers. Discovery is the free acquisition layer. Coach (video analysis) is the paid tier at €7.99/month. Discovery funnels users to Coach.

---

## 2. Key Decisions (Validated April 2, 2026)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Product architecture | One product, two tiers (Discovery free + Coach paid) | Council unanimous verdict |
| Hold taxonomy | 6 categories: Jug, Crimp, Microcrimp, Sloper, Pinch, Pocket | Matches how climbers actually think. Edge too ambiguous, Volume too rare on Kilter. |
| First board to classify | 12x12 Original Layout (323 handholds + 153 footholds) | Most common gym board. Smaller boards are subsets. |
| BLE | Non-negotiable. In plan from day 1. | Two apps open = friction that kills habitual use |
| Native framework | Capacitor (wraps existing Next.js) | Zero frontend rewrite. BLE plugin available. iOS + Android. |
| Launch sequence | Web first (weeks 1-3), then Capacitor wrap + BLE (week 4) | Web = fast dev environment. Same codebase becomes the native app. |
| Generated problems | Internal to Kilter-Up only (not shared to Kilter Board community) | Keeps the asset proprietary |
| Coach pricing | €7.99/month, 1 free analysis for all signups | Council-validated. Revisit at 50+ paying users. |

---

## 3. The Hold Classification Asset — Prerequisite for Everything

### Why this matters

The BoardLib database knows WHERE each hold is (x/y coordinates) and what ROLE it plays in a problem (start/middle/finish/foot). But it does NOT know what TYPE of grip each hold is.

Without hold classification, Discovery is just Climbdex with a different UI. With it, Discovery can do things no competitor can: filter by grip type, build sessions targeting weaknesses, generate problems on specific hold types, and illuminate only certain grip categories on the board.

**This is a one-time investment that creates a proprietary data asset no competitor has.**

### Hold Taxonomy (6 Categories)

| Category | Description | Typical use on Kilter |
|----------|-------------|----------------------|
| **Jug** | Large, positive, easy to grip. Mini-jugs, incut ears, huecos. | Warmups, rest positions, beginners |
| **Crimp** | Small-medium edge requiring half or full crimp grip. | Technical climbing, finger strength |
| **Microcrimp** | Very small edge, 1-2 pad depth. High finger strength required. | Limit climbing, power, hard grades |
| **Sloper** | Rounded, friction-dependent. Requires open-hand grip + body tension. | Technique, body positioning, steep angles |
| **Pinch** | Requires thumb opposition. Various widths. | Thumb strength, compression |
| **Pocket** | Hole for 1-3 fingers. Mono/duo/trio pockets, huecos. | Finger isolation, grip variety |

### Classification Pipeline (6 Steps)

**Step 1 — Build the canonical board map**
- Target: Original Layout 12x12 (323 bolt-on handholds + 153 screw-on footholds)
- Create annotated image showing every hold position with numbering
- Use `holes` table (x/y) + `placements` table from BoardLib
- Output: reference image + JSON mapping position → hold_id

**Step 2 — Download individual hold photos**
- `boardlib images kilter <db_path> <output_dir>`
- Organize by hold_id, verify completeness
- Flag any missing images for manual photo

**Step 3 — Validate taxonomy with 3-5 climbers**
- Quick test: show 20 random holds, ask people to classify them
- If >80% agreement on categories → taxonomy is good
- If confusion on boundaries (e.g., "is this a crimp or microcrimp?") → refine definitions

**Step 4 — AI batch classification**
- Feed each hold image to Gemini 2.5 Flash with structured prompt
- Prompt: hold image + taxonomy definitions + example images per category
- Output: JSON with hold_id, primary_category, confidence, optional secondary_category
- Batch all ~323 handholds (12x12)
- Cost: ~$0.01-0.02 total

**Step 5 — Manual validation by Daniele**
- Simple web page: hold image + AI classification + override buttons
- Review and correct each hold (~2-3 hours)
- Allow dual-category holds where ambiguous (e.g., "slopey pinch")

**Step 6 — Apply to other board sizes**
- All Original boards (7x10, 8x12, 12x12, 16x12) use the SAME hold set — smaller boards are subsets
- Once 12x12 is classified → 7x10 and 8x12 are automatically covered
- 16x12 may have ~100 additional unique holds → one extra classification pass
- Fullride (Homewall) layout uses a DIFFERENT hold set (~305 holds) → separate pass later

---

## 4. Feature Breakdown — Discovery Free Tier

### 4.1 Advanced Search & Filters (MVP — Core)

Search the 160k+ climb database with filters no other tool offers.

| Filter | Data Source | Complexity | In MVP? |
|--------|-----------|------------|---------|
| Grade range (V0–V17 / Font scale) | BoardLib DB | Easy | ✅ |
| Angle (0°–70°) | BoardLib DB | Easy | ✅ |
| Popularity (min ascents) | BoardLib DB | Easy | ✅ |
| Star rating | BoardLib DB | Easy | ✅ |
| Difficulty accuracy | BoardLib (derived) | Medium | ✅ |
| Board size/layout | BoardLib DB | Easy | ✅ |
| Setter name | BoardLib DB | Easy | ✅ |
| Benchmark filter | BoardLib (ascents + accuracy) | Easy | ✅ |
| **Grip type** (jug/crimp/microcrimp/sloper/pinch/pocket) | **Hold classification asset** | **Medium** | ✅ |
| "Problems similar to X" | Layout string comparison (Jaccard) | Medium | ✅ |
| Movement style (dyno/static/compression) | NOT in DB — requires tagging | Hard | ❌ Phase 2 |

**"Similar problems" logic:** Compare layout strings — find problems with overlapping holds or holds in similar board positions. Filter by "same grade, same angle, different holds" for variety.

### 4.2 AI Session Builder (MVP — Killer Feature)

User describes what they want → AI builds a complete session.

**Example prompts:**
- "Build me a 4x4 on crimps at 40° at my level (V5)"
- "Warmup: big holds, easy, 15 minutes"
- "Power endurance circuit: 6 problems, slopers only, V3-V4"
- "Project-level problems similar to [climb name]"
- "Cooldown: 4 easy juggy problems at 25°"

**How it works:**
1. User input (natural language OR structured dropdowns — both)
2. Gemini Flash parses intent → structured query
3. Query hits classified DB
4. Session builder assembles balanced session (warmup → work → cooldown, no duplicate holds, grade progression, rest recommendations)
5. Output: ordered climb list with metadata

**This is what Climbdex cannot do.** Search ≠ session building.

### 4.3 Problem Generation (Post-MVP)

AI creates NEW boulder problems using classified hold data.

- User specifies: "10 moves, crimps only, V5, 40°"
- Algorithm selects holds matching criteria from classified DB
- Validates reachability (x/y distance between consecutive holds)
- Generates valid layout string (internal to Kilter-Up only)
- Users can save and name generated problems

**Limitations:**
- Generated problems may be climbable but boring — position as "drill generator" not "route setter"
- Grading is approximate (based on hold types + angle + move count)
- No guarantee of movement quality — start simple (ladders, traverses)

### 4.4 BLE Board Connection (Week 4 — Capacitor)

Connect directly to the Kilter Board via Bluetooth from the app.

**Core BLE features:**
- Light up a problem directly from Discovery search results
- **"Illuminate only [grip type]"** — training visualization (e.g., show only crimps, show only jugs)
- Light up generated problems
- Know what's currently on the board → one-tap logging

**Technical approach:**
- Capacitor plugin: `@capacitor-community/bluetooth-le`
- BLE protocol documented (bazun.me reverse engineering + Grip Connect docs)
- Layout string → LED position mapping via `leds` table in BoardLib DB
- Hold classification → color filtering (show only holds of category X)

**"Illuminate only jugs" feature flow:**
1. User taps "Show jugs"
2. App looks up all hold_ids classified as "jug"
3. Maps hold_ids → hole_ids → LED positions via BoardLib tables
4. Sends BLE packet with positions + color
5. Board lights up only jugs

**This feature is unique to Kilter-Up. No other app has hold classification data.**

### 4.5 Attempt Logging (MVP — Lightweight)

**MVP fields:**
- Problem reference (climb_id or generated)
- Result: Flash / Send / Attempt / Did not finish
- Number of tries
- Optional note (free text)
- Auto: date + session grouping

**NOT in MVP:** Progress analytics, video attachment (Coach territory), social features.

---

## 5. Updated Roadmap

### Pre-Phase 3: Hold Classification (NEW — 1.5 weeks)

| # | Task | Effort |
|---|------|--------|
| HC-1 | Install BoardLib, download DB + hold images | 1 day |
| HC-2 | Build canonical 12x12 board map (annotated image) | 1 day |
| HC-3 | Finalize taxonomy (test with 3-5 climbers if possible) | 0.5 day |
| HC-4 | AI batch classification script (Gemini Flash) | 1 day |
| HC-5 | Build validation UI (simple web page) | 1 day |
| HC-6 | Daniele validates all ~323 holds | 0.5 day |
| HC-7 | Store in DB table (`hold_classifications`) + apply to board sizes | 0.5 day |

### Phase 3a — BoardLib Database Setup (1 week)

- Add `boardlib` to requirements
- Script to download/sync Kilter Board SQLite DB
- Explore schema, document fields
- Add `backend/data/` to .gitignore

### Phase 3b — Climb Search API + Filters (1-2 weeks)

- `GET /api/climbs/search` — all filters including **grip_type**
- `GET /api/climbs/{id}` — full detail with hold classifications
- `GET /api/climbs/{id}/similar` — similar problems
- Autocomplete-friendly, top 10 matches
- Dual grade display: Font + V-grade
- Tests

### Phase 3c — AI Session Builder (1-2 weeks)

- `POST /api/sessions/build` — natural language or structured input
- Gemini Flash parses intent → structured query → DB → session assembly
- Session types: warmup, 4x4, power endurance, project rehearsal, cooldown, mixed
- `GET /api/sessions/{id}` — retrieve built session
- Frontend: session builder UI
- Tests

### Phase 3d — Enhanced Video Analysis / Level 2 (1-2 weeks)

- Video upload with optional climb_id + angle
- Enriched Gemini prompt with climb context + hold type data
- Structured JSON coaching output
- **Validation Gate: L1 vs L2 comparison (mandatory before Coach launch)**
- Tests

### Phase 3e — Capacitor + BLE Integration (1-2 weeks)

- Capacitor project setup wrapping Next.js frontend
- `@capacitor-community/bluetooth-le` plugin
- BLE scan → connect to Kilter Board
- Light up problem from search results
- **"Illuminate only [grip type]"** feature
- Light up generated problems
- iOS + Android builds
- Tests

### Phase 3f — Problem Generation (1-2 weeks)

- `POST /api/climbs/generate` — constraints (grip types, move count, grade, angle)
- Hold selection + reachability validation
- Internal layout string
- Save/name generated problems
- Frontend: generation UI
- Tests

### Phase 3g — Recommendation Engine + Logging (1 week)

- `GET /api/climbs/recommend` — training-oriented queries
- Basic attempt logging
- Session grouping
- Tests

### Phase 3.5 — Soft Launch (2 weeks)

**Discovery (free) — first:**
- Landing page update
- App Store submission (iOS TestFlight + Android)
- Post on r/kilterboard, r/climbharder, Instagram
- Target: 100 signups in 2 weeks

**Coach (€7.99/month) — 2 weeks after Discovery:**
- Stripe integration
- 1 free video analysis per signup
- Email campaign to Discovery users
- Target: 5+ paying in first month

---

## 6. Contraindications & Risks

### Hold Classification

| Risk | Severity | Mitigation |
|------|----------|------------|
| Classification is subjective | Medium | Daniele as single source of truth. Allow dual-category. |
| ~323 holds to validate manually | Low | 2-3 hours one-time. AI does 80%, human reviews. |
| Fullride holds need separate pass | Medium | Delays Homewall support. Doesn't block Original board launch. |

### Session Builder

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI recommends bad sessions | High | V1 imperfect. Ship, get feedback, iterate. |
| "No dynos" filter impossible without movement tags | Medium | Infer from hold distances (big gaps = dynamic). Full movement tagging is Phase 2. |

### Problem Generation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Generated problems unclimbable/boring | High | Position as "drill generator." Start simple. User flagging. |
| Grading is approximate | Medium | Improve with user feedback data over time. |

### BLE / Native App

| Risk | Severity | Mitigation |
|------|----------|------------|
| Capacitor + BLE complexity | High | BLE is finicky. Budget 1-2 weeks. Protocol is documented. |
| App Store approval delays | Medium | iOS review 1-7 days. Submit early. |
| Competing with official Kilter Board app | Medium | Position as companion. Don't replicate social/setting features. |

### Strategic

| Risk | Severity | Mitigation |
|------|----------|------------|
| Climbdex is free | High | Differentiation: grip type + session builder + generation + BLE "illuminate by type." |
| Solo founder, many features | **Critical** | Ruthless sequencing. Search + session builder first. |
| Market ceiling | High | Growing market. Aurora expansion later. €7.99 × 200 = meaningful. |

---

## 7. Pricing Summary

### Discovery (Free — No Limits)

- Full search + all filters + grip type
- AI session builder (unlimited)
- Problem generation (unlimited)
- Attempt logging
- BLE board connection + "illuminate by type"

### Coach (€7.99/month)

- Video upload + AI technique analysis
- Contextual analysis with climb data (Level 2)
- Technique scores, move-by-move feedback
- Training suggestions
- 1 free analysis per signup
- Progress tracking (when built)

### Revenue Projections

| Scenario | Discovery users | Coach conversion (5%) | MRR |
|----------|----------------|----------------------|-----|
| Quiet | 100 | 5 | €40 |
| Moderate | 500 | 25 | €200 |
| Good | 1,000 | 50 | €400 |
| Strong PMF | 2,000 | 100 | €800 |

Break-even (infra ~€50/month): 7 paying users.

---

## 8. Remaining Open Questions

1. **Council verdict needed?** — After reading this doc, decide if anything needs stress-testing.
2. **Apple Developer account** — €99/year needed for iOS. Do you have one?
3. **BLE testing access** — Do you have a Kilter Board accessible for development/testing?
4. **Beta testers** — Christie is interested. Who else?
5. **Timeline** — ~8-10 weeks total. Compatible with your availability?

---

*Document created: April 2, 2026 — v0.2 with validated decisions*
