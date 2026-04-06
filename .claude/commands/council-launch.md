---
description: Run Council with the pre-loaded Kilter-Up product strategy question
---

Run /council with this question:

Kilter-Up: single product vs two-product split strategy

WHAT IS KILTER-UP:
- AI-powered climbing coach for Kilter Board users
- Core: upload climbing video → Gemini 2.5 Flash analyzes technique → structured coaching feedback
- 3-level system: L1 solo analysis (working), L2 contextual with BoardLib data (Phase 3b complete), L3 expert comparison (future)
- Stack: Next.js 14 + FastAPI + SQLite/PostgreSQL + Gemini 2.5 Flash
- Status: Phase 1-2 complete, Phase 3a+3b complete (BoardLib DB + climb search API), B007 prompt rework done
- Monetization plan: 1 free analysis (signup required) → €7.99/month unlimited
- Deploy: Backend on Railway, Frontend on Vercel (kilter-up-coach.vercel.app)
- Team: solo founder, bootstrapped, no funding, no marketing budget
- Target: intermediate Kilter Board climbers (V3-V7), train 2-4x/week

THE TWO PRODUCT IDEAS:

Idea A — Kilter AI Coach (current product):
- Video upload → AI analysis with climb context (grade, holds, angle from BoardLib)
- Moat: no competitor combines AI video analysis + Kilter Board contextual data
- High friction: user must film + upload video
- Monetization validated by Council at €7.99/month
- Phase 3d (Level 2 contextual analysis) is next — the moat depends on this

Idea B — Kilter Climb Discovery:
- Search 344k+ Kilter Board climbs with advanced filters
- AI-powered session builder: auto-generate warmups, 4x4 circuits, training sets by hold type/style/grade
- No video needed — low friction, broader audience (ANY Kilter Board user, not just those who film)
- Uses same BoardLib data already integrated (climb_service.py ready)
- Could be standalone value even without the AI Coach

EXISTING COMPETITORS FOR DISCOVERY:
- Climbdex (climbdex.com) — free, open source PWA by the BoardLib author. Hold filtering, difficulty accuracy, mirrored search. Supports all Aurora boards.
- Kilter Lookup (kilterlookup.com) — Kilter-specific hold search, campus filter, move size filter.
- kilterboard.io — new official Kilter Grips app (March 2026). Redesigned UI, better search, playlists. Early stage.
- None of these do AI-powered recommendations or training session generation.

EXISTING COMPETITORS FOR AI COACH:
- No direct competitor combines AI video analysis + Kilter Board climb context.
- Climbah, ClimbAI, Climbalyzer exist but are generic (not Kilter-specific) and very early stage.

THE STRATEGIC QUESTION:
1. TWO SEPARATE PRODUCTS IN PARALLEL: Coach (kilter-up-coach) + Discovery (kilter-discover). Separate landing pages, separate value props, potential future merge. Risk: solo founder focus dilution, double the marketing.
2. ONE PRODUCT, TWO TRACKS: Discovery as a feature inside Kilter-Up that funnels users to the AI Coach. Lower overhead, clearer brand, but Discovery feels bolted-on rather than first-class.

CONSTRAINTS:
- Solo founder, bootstrapped, no funding, no marketing budget
- Both products use the same BoardLib data source and backend (climb_service.py)
- Same tech stack (Next.js + FastAPI), shared backend possible
- Currently in Phase 3 planning for the AI Coach — Phase 3d (Level 2 analysis) is the moat
- 140+ backend tests passing, clean codebase, ready for feature development
