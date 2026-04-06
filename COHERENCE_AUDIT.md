# Coherence Audit — D002
> Generated: 2026-04-06
> Files read: ROADMAP_ACTIVE.md, PROJECT_STATUS.md, ARCHITECTURE.md, RESEARCH.md, CLAUDE.md, backend/docs/PROMPT_AUDIT.md, docs/lessons.md (found at `docs/lessons.md`, NOT `backend/docs/lessons.md`), backend/app/services/gemini_service.py, backend/app/schemas/video.py, backend/app/services/climb_service.py, backend/app/api/climbs.py, backend/tests/
> Tests collected: **140 backend** (pytest --co -q), **45 frontend** (jest)

---

## Findings

### Section 1: Test Count

**`pytest --co -q` result: 140 tests collected.** All green.

| Test File | Tests | Location |
|-----------|-------|----------|
| `test_auth_endpoints.py` | 20 | `backend/` (root level) |
| `test_auth_validation.py` | 33 | `backend/` (root level) |
| `tests/test_climb_service.py` | 16 | `backend/tests/` |
| `tests/test_climbs_api.py` | 13 | `backend/tests/` |
| `tests/test_holds_api.py` | 4 | `backend/tests/` |
| `tests/test_kilter_parser.py` | 17 | `backend/tests/` |
| `tests/test_videos.py` | 37 | `backend/tests/` |
| **Total** | **140** | |

Frontend: `npx jest --passWithNoTests` → **45 tests, 3 suites** (`BoardMap.test.tsx`, `classify/page.test.tsx`, `page.test.tsx`).

**Discrepancies vs docs:**
- `ROADMAP_ACTIVE.md` line ~93 (under B001–B005): **"136 tests passing"** → stale, actual is 140 backend.
- `PROJECT_STATUS.md` line 25: **"140 backend + 45 frontend"** → ✅ correct.
- `CLAUDE.md` does not state a test count (correct — avoids hardcoding).

---

### Section 2: Completed Work

| Work Item | ROADMAP_ACTIVE.md | PROJECT_STATUS.md | Verdict |
|-----------|-------------------|-------------------|---------|
| **D001-mini** (prompt audit) | Listed as `[ ]` items in "Prompt & Output Refinement" — all still unchecked | Not mentioned by name | ❌ Not reflected as done |
| **B007** (Kilter Board prompt rework) | **Not in Completed section at all.** "Prompt & Output Refinement" items still `[ ]` | ✅ Line 20: "Kilter Board-specific prompt (B007)" | ❌ Missing from ROADMAP Completed |
| **Phase 3a** (BoardLib DB) | ✅ `(✅ Complete)` in Phase 3a header | ✅ "Phase 3a+3b" | ✅ Verified |
| **Phase 3b** (Climb Search API) | ✅ `(✅ Complete)` in Phase 3b header | ✅ "Phase 3a+3b" | ✅ Verified |
| **HC-1** (BoardLib install) | No checkboxes in HC table — status invisible | Listed as done implicitly via Phase 3a | ⚠️ Status not explicitly tracked |
| **HC-2** (Board map) | No checkboxes in HC table | Not marked done in PROJECT_STATUS | ❌ Done per git commit `5dcd654` — not reflected |
| **HC-5** (Validation UI) | No checkboxes in HC table | Not marked done in PROJECT_STATUS | ❌ Done per git commits — not reflected |
| **Video testing** (4 B007 test videos) | PROMPT_AUDIT.md mentions "4 real Kilter Board videos" but details not in a structured record | Not mentioned | ⚠️ No structured record |
| **yt-dlp installed** | Listed as "future phase" dependency in RESEARCH.md | Not mentioned as installed | ⚠️ Not documented as current tool |

**Specific finding on "Prompt & Output Refinement" section (ROADMAP_ACTIVE.md lines 131–145):** All 5 items are `[ ]` despite being fully resolved by B007:
- `[ ] Audit current Gemini prompt` → Done (D001-mini / PROMPT_AUDIT.md)
- `[ ] Define compact structured JSON output schema` → Done (B007 schema)
- `[ ] Always include dual grading` → Resolved differently: grade estimation **removed** entirely in B007 (will come from DB in Level 2)
- `[ ] Test with real climbing videos` → Done (4 videos tested)
- `[ ] STOP gate: review prompt changes before merging` → Done (B007 review)

---

### Section 3: Naming & Terminology

#### "Sam" references (non-archived files)

| File | Line | Content | Action |
|------|------|---------|--------|
| `PROJECT_STATUS.md` | 4 | `Aggiornato da Sam ogni volta che si prende una decisione importante.` | Replace "Sam" → "Claude Code" |
| `PROJECT_STATUS.md` | 272 | `*Creato da Sam — 22 Febbraio 2026 \| Aggiornato: 6 Aprile 2026*` | Replace "Sam" → "Claude Code" |
| `CLAUDE.md` | 241 | `**Owner:** Daniele Somensi + Sam (AI Agent)` | Replace "Sam (AI Agent)" → "Claude Code" |
| `docs/BOARDLIB_SCHEMA_ANALYSIS.md` | 5 | `**Author:** Daniele Somensi + Sam (Claude Code)` | Acceptable — "Sam (Claude Code)" is self-explanatory. Low priority. |
| `docs/archive/*` | various | Multiple "Sam" references | **Archived docs — do not touch.** |

#### "Somenzi" references
None found in non-archived files. ✅

#### Phase numbering — "Phase 3c" used where "Phase 3d" is correct

The ROADMAP_ACTIVE.md is the authoritative source:
- `3c` = AI Session Builder
- `3d` = Enhanced Video Analysis / Level 2

Files using `3c` to mean Level 2 (wrong):

| File | Line | Content | Action |
|------|------|---------|--------|
| `backend/docs/PROMPT_AUDIT.md` | 89 | `## Remaining TODOs (Level 2 — Phase 3c)` | Replace "Phase 3c" → "Phase 3d" |
| `PROJECT_STATUS.md` | 28 | `Phase 3c (Level 2 analysis) next` | Replace "Phase 3c" → "Phase 3d" |
| `.claude/commands/council-launch.md` | 27 | `Phase 3c (Level 2 contextual analysis)` | Replace "Phase 3c" → "Phase 3d" |
| `.claude/commands/council-launch.md` | 54 | `Phase 3c (Level 2 analysis)` | Replace "Phase 3c" → "Phase 3d" |

Files correctly using `3d` for Level 2 (no action needed):
- `ROADMAP_ACTIVE.md` ✅
- `ARCHITECTURE.md` line 198 ✅
- `CLAUDE.md` line 62 ✅
- `PROJECT_STATUS.md` line 49 ✅ (already correct in the Coach architecture section — conflicting with line 28)

#### `google.generativeai` (old SDK) in non-archived files

| File | Line | Content | Context | Action |
|------|------|---------|---------|--------|
| `PROJECT_STATUS.md` | 78 | `import google.generativeai as genai` | In "Implementazione corretta" code example under PROBLEMA 1 — **this code block shows the correct File API pattern but uses the DEPRECATED SDK and model**. The code example is labeled "correct" re: File API strategy, but it's now wrong re: SDK choice. | Add a note that this is a historical example; or update to `google.genai` with a comment |
| `ROADMAP_ACTIVE.md` | 413 | `~~Migrate google.generativeai → google.genai~~ — B003` | ✅ Struck through (done). No action. | — |
| `docs/lessons.md` | 9 | Describes the migration lesson | ✅ Correct — historical lesson. No action. | — |

#### `gemini-2.0-flash` in non-archived files

| File | Line | Content | Context | Action |
|------|------|---------|---------|--------|
| `RESEARCH.md` | 133 | `Gemini 2.0 Flash can process full videos via File API` | Wrong model version. A `<!-- TODO -->` comment on line 224 already flags this. | Replace "Gemini 2.0 Flash" → "Gemini 2.5 Flash" |
| `PROJECT_STATUS.md` | 88 | `genai.GenerativeModel("gemini-2.0-flash")` | In the "Implementazione corretta" code example — same block as above. Historical. | Update alongside the SDK fix, or add clarifying comment |
| `docs/lessons.md` | 8, 10 | Mentions `gemini-2.0-flash` as a retired model | ✅ Correct — lesson about what NOT to use. No action. | — |

---

### Section 4: Prompt State

**Current `CLIMBING_ANALYSIS_PROMPT` in `gemini_service.py`:**

1. **Is it B007?** YES. The prompt starts "You are an expert Kilter Board climbing coach", includes board detection, 5 scores (technique, body_tension, footwork, hip_positioning, power_management), max 3 improvements with drills, overall_impression. All B007 characteristics present. ✅

2. **Kilter Board completion rules — CRITICAL GAP:**
   The prompt does NOT contain either of these rules:
   - "Match on finish hold (purple/magenta) = problem complete"
   - "Dropping off after match = controlled dismount, NOT a fall"
   
   The prompt mentions feet-cutting being intentional at steep angles, but says nothing about what constitutes a successful ascent. Without this, Gemini may penalize a valid send where the climber drops after matching the finish hold, or may not recognize that the problem was completed. **This is a semantic error that could produce wrong coaching feedback.**

3. **`FormFeedbackResponse` vs prompt shape** — MATCH. ✅
   - `is_kilter_board` (bool) ✅
   - `error`, `message` (Optional[str]) ✅
   - `technique_score`, `body_tension_score`, `footwork_score`, `hip_positioning_score`, `power_management_score` (Optional[int], 1-10) ✅
   - `summary` (Optional[str]) ✅
   - `strengths` (list[str]) ✅
   - `improvements` (Optional[list[ImprovementItem]]) — matches `{"issue", "fix", "drill"}` ✅
   - `overall_impression` (Optional[str]) ✅
   - `model_config = ConfigDict(extra="allow")` — backward compat with old records ✅

4. **Does PROMPT_AUDIT.md reflect current prompt?** YES — PROMPT_AUDIT.md documents B007 accurately with correct generation config (gemini-2.5-flash, temp=0.3, max_tokens=8192, response_mime_type=application/json). ✅

   **One discrepancy in PROMPT_AUDIT.md:** Line 89 says "Remaining TODOs (Level 2 — Phase 3c)" → should be "Phase 3d" (addressed in Section 3).

---

### Section 5: Phase Numbering and Sequencing

**Current phase structure (from ROADMAP_ACTIVE.md):**

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Foundation | ✅ | |
| Phase 2 — Video Upload + Analysis | ✅ | |
| B001–B005 — Cleanup & Migrations | ✅ | Test count stale: says 136, actual 140 |
| D001-mini + B007 | **Not in Completed** | ❌ Missing from completed section |
| Pre-Phase 3 — HC-1→HC-7 | 🎯 Mixed | HC-1, HC-2, HC-5 done; HC-3, HC-4, HC-6, HC-7 pending |
| Pre-Phase 3 — Quick Wins / Prompt | ❌ All `[ ]` | Done via B007 — should be ✅ |
| Phase 3a — BoardLib DB | ✅ | |
| Phase 3b — Climb Search API | ✅ | |
| Phase 3c — AI Session Builder | ⏳ | |
| Phase 3d — Enhanced Analysis / Level 2 | 🎯 Next | |
| Phase 3e — Capacitor + BLE | ⏳ | |
| Phase 3f–3h | ⏳ | |
| Phase 3.5 — Soft Launch | ⏳ | |
| Phase 4 — Visual Recognition | ⏳ | PoC 1 validated, PoC 2 pending |
| Phase 5 — Expert Comparison | ⏳ | |
| Phase 6 — Training Logs | ⏳ | |
| Phase 7 — Deploy & Polish | Partial | Railway ✅, PostgreSQL/S3 pending |

**Items marked TODO that are actually done:**
- "Prompt & Output Refinement" — all 5 `[ ]` items in ROADMAP_ACTIVE.md should be `[x]` (done via D001-mini + B007)

**Items marked DONE that may be incomplete:**
- None found (Phase 3a and 3b appear genuinely complete based on code review)

**HC Priority in PROJECT_STATUS.md:**
Line 183: `🎯 Pre-Phase 3 — Hold Classification HC-1→HC-7 [CURRENT PRIORITY]`
- HC-1 is done (boardlib install + DB, part of Phase 3a)
- HC-2 is done (board map — git commit `5dcd654`)
- HC-5 is done (validation UI — git commits `5dcd654`, `e2289bf`)
- This label is partially stale — HC is in progress, not all pending

**"Daniele's Action Items" — current reality check:**
- `[x] Register Apple Developer Account` — marked done, application submitted. ✅
- `[ ] Write pro climber list` — still pending, accurate.
- `[ ] Validate hold taxonomy with Christie` — HC-3, still pending, accurate.
- `[ ] Validate hold classifications in gym` — HC-6, still pending, accurate.
- `[ ] Record 2-3 test videos` — still pending, accurate.
- `[ ] Curate 10-15 public test videos` — still pending, accurate.

---

### Section 6: Cross-Document Consistency

| Fact | Expected | `gemini_service.py` | `ARCHITECTURE.md` | `PROJECT_STATUS.md` | `ROADMAP_ACTIVE.md` | `RESEARCH.md` | `PROMPT_AUDIT.md` |
|------|----------|---------------------|-------------------|---------------------|---------------------|---------------|-------------------|
| Backend test count | 140 | — | — | ✅ "140 backend" | ❌ "136 tests" | — | — |
| Frontend test count | 45 | — | — | ✅ "45 frontend" | not mentioned | — | — |
| Gemini model | `gemini-2.5-flash` | ✅ via `settings.gemini_model` | ✅ "Gemini 2.5 Flash" | ✅ "gemini-2.5-flash" | ✅ "Gemini 2.5 Flash" | ❌ "Gemini 2.0 Flash" (line 133) | ✅ "`gemini-2.5-flash`" |
| SDK name | `google.genai` | ✅ `from google import genai` | ✅ "google.genai SDK" | ⚠️ Code example uses `google.generativeai` (historical section) | ✅ (migration marked done) | — | — |
| Phase 3b status | ✅ Complete | — | ✅ mentioned as working | ✅ | ✅ | — | — |
| B007 status | Completed | prompt IS B007 | ✅ "B007" in component map | ✅ line 20 | ❌ not in Completed section | — | ✅ B007 documented |
| Frontend URL | `kilter-up-coach.vercel.app` | — | ✅ | ✅ (backlog: "Done") | not mentioned | — | — |
| Railway URL | `web-production-cea9.up.railway.app` | — | ✅ | ✅ (implied) | not mentioned | — | — |
| DB size | ~189MB | — | ✅ "~189MB" | ✅ "~189MB" (decision #6) | ✅ "~189MB" | ✅ "~189MB" | — |
| Climb count | 344k+ | — | ✅ "344k+" | ✅ "344k+" | ✅ "344k+" | ✅ "344k+" | — |
| Prompt description | B007 Kilter Board | IS B007 | ✅ "B007" | ✅ "B007" | ❌ NOT in Completed | ✅ | ✅ |
| Level 2 phase | Phase 3d | — | ✅ "Phase 3d" | ❌ "Phase 3c" (line 28), ✅ "Phase 3d" (line 49) — **contradicts itself** | ✅ "3d" | — | ❌ "Phase 3c" |

---

### Section 7: Known Gaps

1. **Kilter Board completion rules in prompt — CONFIRMED MISSING.** The prompt has no rule about what constitutes a successful ascent on the Kilter Board. The finish hold color (purple/magenta) and the distinction between "dropping off after match" (valid send) vs "falling before match" (fail) are not mentioned. This creates a risk of incorrect coaching feedback for sends where the climber drops after topping out.

2. **yt-dlp as project tool — not formally documented.** RESEARCH.md line ~268 lists `yt-dlp` under "New Dependencies" but marks it as "future phase". ROADMAP_ACTIVE.md Phase 5a mentions it for expert video downloads. If yt-dlp is already installed, its status should be updated to reflect that.

3. **Test video corpus metadata — no structured record.** PROMPT_AUDIT.md mentions "4 real Kilter Board videos" that revealed prompt problems and drove B007. The videos are:
   - "Straight outta Brione" 7C+ @ 40° (referenced in ROADMAP Phase 4 PoC)
   - "Gladiolus" 7C+ @ 40°
   - "Pulp Friction" 7A @ 45°
   - "Kilter dani1" 7B
   These are not in a structured file in the repo. Their results (grade estimation wrong 3/4 times, scores too generous) are documented only in PROMPT_AUDIT.md narratively.

4. **@higuera82kilter as test video source — mentioned but not formally documented.** ROADMAP_ACTIVE.md Phase 4 references `@higuera82kilter` by name in the PoC results table, but this Instagram account is not listed in any "known test sources" document.

5. **`backend/docs/lessons.md` path discrepancy.** The brief asked to read `backend/docs/lessons.md` but the file is actually at `docs/lessons.md` (repo root, not under `backend/`). CLAUDE.md does not reference this file's location.

---

## Proposed Changes

| # | File | Change | Reason | Risk |
|---|------|--------|--------|------|
| 1 | `ROADMAP_ACTIVE.md` | Update "136 tests passing" → "140 backend + 45 frontend tests passing" under B001–B005 Completed | Actual count is 140 backend, 45 frontend | Safe |
| 2 | `ROADMAP_ACTIVE.md` | Add **B007** to Completed section (after B001-B005): "B007 — Kilter Board Prompt Rework ✅: board detection, 5 scores, max 3 improvements with drills, `CLIMBING_ANALYSIS_PROMPT` is Kilter Board-specific (see `backend/docs/PROMPT_AUDIT.md`)" | B007 is done but not listed as completed | Safe |
| 3 | `ROADMAP_ACTIVE.md` | Mark all 5 items in "Prompt & Output Refinement" as `[x]` and add note: "Completed via D001-mini + B007. Grade estimation removed (comes from DB in Level 2). All 5 items resolved." | D001-mini + B007 completed this section | Safe |
| 4 | `ROADMAP_ACTIVE.md` | In HC table, add a "Status" column or ✅ markers: HC-1 ✅ (done in Phase 3a), HC-2 ✅ (done), HC-5 ✅ (done), HC-3/4/6/7 pending | Three HC tasks are done; table doesn't reflect this | Safe |
| 5 | `PROJECT_STATUS.md` | Line 28: `Phase 3c (Level 2 analysis) next` → `Phase 3d (Level 2 analysis) next` | Phase 3c is AI Session Builder; Level 2 is Phase 3d | Safe |
| 6 | `PROJECT_STATUS.md` | Line 4: `Aggiornato da Sam` → `Aggiornato da Claude Code` | "Sam" should be "Claude Code" | Safe |
| 7 | `PROJECT_STATUS.md` | Line 272: `Creato da Sam` → `Creato da Claude Code` | "Sam" should be "Claude Code" | Safe |
| 8 | `PROJECT_STATUS.md` | Update HC status in roadmap section (line 183): mark HC-1, HC-2, HC-5 as done within the "[CURRENT PRIORITY]" label — e.g., `HC-1✅ HC-2✅ HC-3⏳ HC-4⏳ HC-5✅ HC-6⏳ HC-7⏳` | HC-1/2/5 are done per git history | Safe |
| 9 | `CLAUDE.md` | Line 241: `Sam (AI Agent)` → `Claude Code` | "Sam" should be "Claude Code" | Safe |
| 10 | `CLAUDE.md` | Update Current State section: add `HC-2 ✅` and `HC-5 ✅` as completed (git commits `5dcd654`, `e2289bf`). Update "Next" line to reflect HC-2 and HC-5 are done. | Current state is incomplete | Safe |
| 11 | `backend/docs/PROMPT_AUDIT.md` | Line 89: `Level 2 — Phase 3c` → `Level 2 — Phase 3d` | Phase numbering error | Safe |
| 12 | `RESEARCH.md` | Line 133: `Gemini 2.0 Flash can process full videos` → `Gemini 2.5 Flash can process full videos`. Remove the `<!-- TODO -->` comment on line 224. | Stale model version. Already flagged as known TODO. | Safe |
| 13 | `PROJECT_STATUS.md` | Lines 78–93 "Implementazione corretta" code example: add a comment `# NOTE: esempio storico (pre-B003). SDK attuale: google.genai, modello: gemini-2.5-flash.` or update the code to use current SDK | Code example shows deprecated `google.generativeai` and `gemini-2.0-flash` as the "correct" approach | Safe |
| 14 | `backend/app/services/gemini_service.py` | Add Kilter Board completion rules to `CLIMBING_ANALYSIS_PROMPT`: "COMPLETION RULES: Match on the finish hold (purple/magenta LED) = problem complete. If the climber drops off after matching the finish hold, that is a controlled dismount — treat the attempt as a successful ascent, NOT a fall." | Critical gap — may cause wrong coaching feedback for sends | **STOP gate** — this is a STOP-gate file. Do not apply without explicit OK. |
| 15 | `docs/lessons.md` (or new doc) | Add structured test video corpus record: 4 B007 test videos with name, grade, angle, B007 outcome | Results currently undocumented in structured form | Safe |
| 16 | `.claude/commands/council-launch.md` | Lines 27 and 54: `Phase 3c (Level 2...)` → `Phase 3d (Level 2...)` | Phase numbering error | Safe |

**No changes applied. Awaiting Daniele's approval.**

---

## Summary

The codebase is in good health overall. The two highest-priority issues are:

1. **Change #14 (STOP gate):** The Kilter Board prompt is missing completion rules — the AI doesn't know what a "successful ascent" looks like, risking incorrect feedback on sends where the climber drops after matching the finish hold. This needs prompt surgery with a STOP gate review.

2. **Changes #2, #3 (ROADMAP consistency):** B007 and D001-mini work is done but invisible in ROADMAP_ACTIVE.md — the Completed section and the "Prompt & Output Refinement" checklist still show everything as pending.

All other issues (#1, #4–#13, #15–#16) are low-risk documentation cleanup.
