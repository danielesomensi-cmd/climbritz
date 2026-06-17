# 🎬 D020 — Video Analysis Pipeline Deep Dive (Coach Tier)

> **Type:** D (audit / READ-ONLY). No code changed. Companion to `AUDIT_REPORT.md`.
> **Scope:** upload → Gemini File API → `generate_content` → parse/validate → store → frontend render, plus the prompt template and a concrete (proposal-only) output-UX redesign.
> `gemini_service.py` is a STOP-gate surface; all references below are exact line refs and no change is proposed for implementation here.

---

## C1. Pipeline Audit

### Full flow trace (exact line refs)

| Stage | File:Line | What happens |
|---|---|---|
| 1. Upload request | `videos.py:57-65` | `POST /api/videos/upload`, `status_code=202`. Multipart `file` + optional `title`, `grade_attempted`. Auth via `get_current_user_id` (Clerk JWT or dev `X-User-ID`). |
| 2. Save to disk | `videos.py:73` → `storage_service.py:36-105` | MIME validated against allowlist (`55-60`), streamed in 1 MB chunks (`78-91`), size-capped 500 MB mid-stream (`84-90`). Returns `(uuid, abs_path)`. |
| 3. Persist record | `videos.py:82-94` | `VideoUpload` row, `processing_status="pending"`, committed. |
| 4. Schedule task | `videos.py:96` | `background_tasks.add_task(_background_analyze, video_id, file_path)`. |
| 5. Return 202 | `videos.py:98` | `VideoResponse` returned immediately (status `pending`). |
| 6. BG: mark processing | `videos.py:28-29` | New `SessionLocal()` (`21`), status → `processing`, commit. |
| 7. File API upload | `videos.py:31` → `gemini_service.py:93-147` | `client.files.upload(...)` with **hardcoded** `mime_type="video/mp4"` (`117`). |
| 8. Poll for ACTIVE | `gemini_service.py:122-144` | Every 5 s up to 120 s while `state == "PROCESSING"`; raises on timeout (`128-132`) or non-ACTIVE terminal state (`140-144`). |
| 9. Store file id | `videos.py:32-33` | `video.gemini_file_id` saved, commit. |
| 10. generate_content | `videos.py:35` → `gemini_service.py:199-244` | Re-fetches file ref (`220`), calls `client.models.generate_content` (`227-244`). |
| 11. Empty-response guard | `gemini_service.py:252-262` | If `response.text is None`, logs `finish_reason` and raises. |
| 12. Parse / repair JSON | `gemini_service.py:264-288` | Strip fences (`268-272`), `json.loads` (`275`), `_try_repair_json` fallback (`150-196`, `281`). |
| 13. Pydantic validate | `gemini_service.py:291-294` | `FormFeedbackResponse(**analysis)` — **warn-only, never raises** (`extra="allow"`). |
| 14. Store result | `videos.py:36-39` | `form_analysis` JSON, status → `completed`, `completed_at`, commit. |
| 15. Failure path | `videos.py:43-54` | Any exception → status `failed`, commit (reason logged only). |
| 16. Frontend poll | `videos/detail/page.tsx:191-200` | Polls `GET /api/videos/{id}` every **2 s** while `processing`. Stops on terminal status. |

### Model & token config (confirmed)

- **Model is env-driven, NOT hardcoded:** `gemini_service.py:228` reads `settings.gemini_model`; default `"gemini-2.5-flash"` at `config.py:12` (override via `GEMINI_MODEL`). The module docstring still names 2.5-flash — accurate as the default.
- **`max_output_tokens=8192`** — `gemini_service.py:232`.
- **`temperature=0.3`** — `:231`. **`response_mime_type="application/json"`** — `:233`.
- **`thinking_budget=0` IS set** — `:242` (`ThinkingConfig(thinking_budget=0)`), with the explanatory comment at `234-241`. PROBLEMI RISOLTI #5 fix confirmed present.
- **`response.text is None` guard IS present** — `:252-262`, including `finish_reason` extraction and a descriptive raise.

### Failure modes (current behavior)

| Failure | Caught at | Ends in | Surfaced? |
|---|---|---|---|
| Gemini 503/429 | `generate_content` → `gemini_service.py:245-246` wrap → `videos.py:43-52` | `failed` | Generic "Analysis failed" screen. **No retry/backoff.** |
| Malformed/truncated JSON | `_try_repair_json` (`150-196`); unrepairable → raise (`286-288`) | `failed` (unrepairable) / `completed` (repaired, possibly partial) | Failed → error screen; repaired-partial renders surviving fields (warn-only validation) |
| Oversized video (>500 MB) | `storage_service.py:84-90` → `videos.py:74-75` | Never created | `400` with size message |
| Unsupported format | `storage_service.py:55-60` → `videos.py:74-75` | Never created | `400` with allowed types. **But** only request `content_type` is checked; a re-labeled file passes, then force-uploaded as `video/mp4` (`gemini_service.py:117`) and may fail later |
| File API never ACTIVE / poll timeout | `gemini_service.py:128-132` / `140-144` | `failed` | Generic error, no distinction |
| File ref re-fetch fails | `gemini_service.py:220-224` | `failed` | Generic |

**Key observation:** all failures collapse to one opaque `failed`. `models/video.py` has no `error_message` column; the reason is logged (`videos.py:44`) but never persisted or returned. The user can't tell "rate-limited, retry" from "not a climbing video" from "clip too long".

### Cost per analysis (gemini-2.5-flash)

**Assumptions (explicit):** input **$0.30 / 1M tok**, output **$2.50 / 1M tok** (standard paid tier); video tokenization ~**263 tok/s** at default resolution (rounded to ~300 tok/s incl. negligible audio); prompt ~900 tok; output ~400–600 tok; `thinking_budget=0` ⇒ **no thinking tokens billed** (the point of the #5 fix).

| Clip | Input tok | Input $ | Output $ | **Total** |
|---|---|---|---|---|
| 30 s | ~9,900 | ~$0.0030 | ~$0.0015 | **~$0.0045** |
| 60 s | ~18,900 | ~$0.0057 | ~$0.0015 | **~$0.007** |
| 4 min 4K | ~72,000 | ~$0.022 | ~$0.0015 | **~$0.024** (and risks the 120 s File-API timeout) |

Cost driver is **video duration** (linear), not output. There is **no duration cap** in code — only the 500 MB size cap, which at phone bitrates can be several minutes.

### Free-tier abuse surface

**No rate limiting or per-user cap anywhere** (verified):
- `POST /api/videos/upload` (`videos.py:57-98`): only auth + MIME + 500 MB. Unlimited submissions, each spawns a BackgroundTask + a billed `generate_content`.
- `POST /api/coach/summary` (`coach.py:27-46`): no cap, no caching/persistence. Each tap is a fresh Gemini text call.
- Both gated only by `get_current_user_id` — any free Clerk sign-up unlocks them. The video pipeline is **not gated behind the paid tier in code** (`/upload` is URL-reachable, hidden only by a UI "Coming Soon" pill).
- Amplifiers: BackgroundTasks run in-process (each holds a `SessionLocal` + a blocking 120 s poll → memory/CPU pressure under concurrency); uploaded files are **never deleted** (`delete_video` at `videos.py:141-159` removes only the DB row, not the disk file or the Gemini File object → disk fills over time).

---

## C2. Prompt Template Audit

### Full prompt verbatim (`gemini_service.py:39-90`)

```
You are an expert Kilter Board climbing coach. You specialize in analyzing technique on the Kilter Board — a standardized indoor training board with adjustable angles (0–70°), plastic holds with LED indicators, and a focus on powerful, dynamic movement.

KILTER BOARD CONTEXT:
- The Kilter Board is steep by design. At 40°+ most problems require dynamic movement and cutting feet is often the INTENDED beta, not a flaw.
- The key distinction is: was the feet-cutting controlled and intentional (good) or a loss of body tension (needs work)?
- Hold types: crimps, slopers, pinches, edges, jugs — all ergonomic plastic.
- Core skills: body tension, hip positioning, contact strength, power generation, controlled dynamics.
- Board angles change everything: the same problem at 40° vs 50° requires fundamentally different execution.

KILTER BOARD COMPLETION RULES:
- A problem STARTS when the climber places both hands on the green start hold(s) and lifts both feet off the ground.
- A problem is COMPLETE (sent) when the climber MATCHES (both hands) on the finish hold (purple/magenta LED), even briefly.
- After a successful match on the finish hold, the climber drops off the wall. This is a CONTROLLED DISMOUNT, not a fall. Do NOT flag the dismount as a technique issue or loss of control.
- A FALL is when the climber comes off the wall BEFORE matching the finish hold, or fails to hold the finish.
- When evaluating the final move: distinguish between "caught the finish but dropped off" (= success, dismount) vs "missed the finish entirely" (= fall, technique issue).

BOARD DETECTION:
First, determine if this video shows climbing on a Kilter Board (flat board with uniform grid of plastic holds, often with colored LED lights visible).
- If this is NOT a Kilter Board or NOT a climbing video, return: {"error": "not_kilter_board", "message": "This does not appear to be a Kilter Board climbing video. Climbritz currently only supports Kilter Board analysis."}
- If it IS a Kilter Board, proceed with the analysis below.

ANALYSIS INSTRUCTIONS:
Analyze the climber's technique and return a JSON object. Be specific — reference actual moments in the video (e.g., "at the second move..." or "on the big reach left..."). Be honest and constructive. A score of 8+ means strong, confident execution. A 9 or 10 means near-professional level — reserve these for truly exceptional technique.

Do NOT estimate the grade of the problem — you cannot reliably determine the grade from video alone.

Return ONLY this JSON structure:

{
  "is_kilter_board": true,
  "technique_score": <integer 1-10>,
  "body_tension_score": <integer 1-10>,
  "footwork_score": <integer 1-10>,
  "hip_positioning_score": <integer 1-10>,
  "power_management_score": <integer 1-10>,
  "summary": "<2 sentences max — the ONE most important observation and ONE key suggestion>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3 max>"],
  "improvements": [
    {"issue": "<specific observation>", "fix": "<actionable suggestion>", "drill": "<one Kilter Board-specific drill tied to this issue>"}
  ],
  "overall_impression": "<flash/onsight/projecting/working — how dialed-in does the climber look on this problem?>"
}

IMPORTANT RULES:
- Maximum 3 strengths.
- Maximum 3 improvements. Each improvement MUST include a specific drill tied to that issue.
- Drills must be Kilter Board-specific when possible: angle progression, 4x4 sets on similar hold types, campus moves on the board, repeat-sends at lower angles, specific hold-type circuits. Avoid generic drills like "do planks" or "silent feet" unless truly relevant.
- "overall_impression" should assess how familiar/comfortable the climber looks with this specific problem: "flash" (first try, reading on the fly), "onsight" (first try but pre-planned), "projecting" (working moves, some hesitation), "working" (early attempts, falling or struggling).
- Do NOT pad the response. If the climber is excellent, say so and give fewer improvements. If there are clear issues, be direct.
- Keep the total response concise. No filler sections.

Return ONLY the JSON object, no markdown fences, no preamble.
```

### Section-by-section annotation

| Section | Lines | Asks for |
|---|---|---|
| Role/context | 39-46 | Persona + Kilter domain priming (steepness, feet-cutting nuance, hold types) |
| Completion rules | 48-53 | Disambiguates send vs fall vs dismount — guards against flagging a controlled dismount |
| Board detection | 55-58 | Conditional escape hatch `{"error":"not_kilter_board",...}` |
| Analysis instructions | 60-63 | "Be specific", scoring rubric (8+ strong, 9/10 reserved), explicit no-grade-estimate |
| JSON schema | 65-80 | The output contract |
| Important rules | 82-89 | Caps + drill requirement + impression taxonomy + anti-padding |
| Closing | 90 | "ONLY the JSON, no fences" |

- **The 5 scores:** `technique_score`, `body_tension_score`, `footwork_score`, `hip_positioning_score`, `power_management_score` — integers 1–10 (`67-72`).
- **"Max 3 improvements" enforcement:** **prose-only** (`84`). The schema list (`schemas/video.py:52`) is an unbounded `list[ImprovementItem]`; no `maxItems`, no Pydantic constraint. Same for "Max 3 strengths" (`83`, schema `51`). The model usually complies but nothing guarantees it.

### Evaluation

**Ambiguities / likely-ignored:**
- "2 sentences max" / "3 max" are soft caps the model overshoots; no programmatic trimming.
- The `overall_impression` taxonomy includes "onsight", which is meaningless on a board where you always see the holds — and the rule even redefines it as "pre-planned" (`86`), contradicting the climbing meaning. The value will be unstable.
- "reference actual moments" (`61`) yields unverifiable, occasionally hallucinated references (no timestamps requested).

**Requested in prompt but never rendered by frontend:** `is_kilter_board` (`68`) — the boolean is never read; the frontend only branches on `error === 'not_kilter_board'`. Harmless dead field. (The error/message path itself IS handled.)

**Rendered by frontend but not guaranteed by the prompt (legacy branch):** `overall_grade_estimate`, `weaknesses`, `drills_recommended`, `next_steps` (`page.tsx:70-77,128-161`) — none are in the current prompt (which explicitly forbids grade estimation, `63`). They survive only via `extra="allow"` for pre-B007 records and are gated behind `!isNewFormat`, so they correctly never show for new output — ~40 lines of dead UI carried forward.

**Net:** the new-format contract (5 scores + summary + strengths + improvements + impression) is fully and correctly rendered. The only true mismatches are cosmetic dead code on both ends.

### `form_analysis` field-rendering table

Schema: `schemas/video.py` `FormFeedbackResponse` (`extra="allow"`). Prompt: `gemini_service.py:65-90`. Renderer: `videos/detail/page.tsx` `AnalysisResults`. FE type: `api.ts:120-144` `FormAnalysis`.

| Field | In schema | In prompt | Rendered (detail) | Rendered (dashboard) | Notes |
|---|---|---|---|---|---|
| `is_kilter_board` | yes | yes | **no** | no | Flag ignored; only `error` is checked |
| `error` | yes | legacy path | yes (`:49`) | no | Only `'not_kilter_board'` handled |
| `message` | yes | legacy | yes (`:54`) | no | Inside error branch |
| `technique_score` | yes | yes | yes (`:90`) | no | |
| `body_tension_score` | yes | yes | yes (`:91`) | no | |
| `footwork_score` | yes | yes | yes (`:92`) | no | |
| `hip_positioning_score` | yes | yes | yes (`:93`) | no | |
| `power_management_score` | yes | yes | yes (`:94`) | no | |
| `summary` | yes | yes | yes (`:79-84`) | no | |
| `strengths` | yes | yes | yes (`:99-111`) | no | |
| `improvements[].issue/fix/drill` | yes | yes | yes (`:113-126`) | no | |
| `overall_impression` | yes | yes | yes (`:63-68`) | yes (`dashboard:108-111`) | |
| `overall_grade_estimate` | **no** (extra) | **no** (forbidden, `:63`) | yes (`:70-77`) | yes | Dead for new records |
| `weaknesses` | **no** (extra) | **no** | yes (`:128-140`) | no | Legacy-only |
| `drills_recommended` | **no** (extra) | **no** | yes (`:142-154`) | no | Legacy-only |
| `next_steps` | **no** (extra) | **no** | yes (`:156-161`) | no | Legacy-only |

---

## C3. Output UX Redesign Proposal (PROPOSAL ONLY — not implemented)

Goal (stated by Daniele): the output must be **easy to read by default** — KPIs + verdicts, minimal narrative — with an optional detailed view.

### 1. Two-layer output model

**Quick view (default):**
- 5 scores as KPI tiles (big `/10` + colored bar) — data + a `ScoreBar` primitive already exist.
- One-line **overall verdict** (NEW field — a single punchy sentence, distinct from the 2-sentence `summary`).
- Top 3 improvements as one-liners: a short **label** + the drill name only (no `issue`/`fix` paragraphs).
- The impression badge. No strengths, no paragraphs by default.

**Detailed view (expand/accordion):**
- Full `summary`; strengths list; per-improvement full `issue → fix → drill` (current rendering); optional future move-by-move + extended narrative.

### 2. Gap analysis vs current schema

| Need | Status |
|---|---|
| 5 scores as KPIs | Present (`technique/body_tension/footwork/hip_positioning/power_management`) |
| One-line verdict | **Missing** — `summary` is "2 sentences", too long for a headline. Need `verdict`/`headline` |
| Per-improvement short label | **Missing** — `ImprovementItem` is all long-form. Need a short `label` (≤5 words) |
| Drill name vs description split | **Partial** — `drill` is one freeform string; optional split into `drill_name`+`drill_detail` |
| Strengths | Present — just relocate to detailed view |
| Move-by-move | Absent; net-new (and net-new cost / possible thinking re-enable) — **defer** |

### 3. Draft v2 JSON schema (appendix — backward-compatible, additive only)

```jsonc
{
  "is_kilter_board": true,
  "schema_version": 2,                          // NEW — lets the frontend pick layout
  "technique_score": 7,
  "body_tension_score": 6,
  "footwork_score": 8,
  "hip_positioning_score": 7,
  "power_management_score": 6,

  "verdict": "Solid, controlled climbing — tighten core tension on the crux reach.", // NEW one-liner

  "summary": "…2 sentences…",                   // kept for detailed view
  "overall_impression": "projecting",
  "strengths": ["…", "…"],                      // detailed view

  "improvements": [
    {
      "label": "Drifting hips on reach",         // NEW short label (quick view)
      "issue": "…full observation…",             // detailed view
      "fix": "…actionable…",                     // detailed view
      "drill": "4x4 on overhang crimps at 40°"   // shown in both (one-liner)
    }
  ]
}
```

`verdict`, `label`, `schema_version` are new optional fields. `FormFeedbackResponse` already has `extra="allow"`, so **no migration** is required; add them as `Optional` in `schemas/video.py` for typing. Old records and the legacy branch keep working.

### 4. Draft prompt delta (appendix — NOT applied)

Minimal additions to `CLIMBING_ANALYSIS_PROMPT`:
- In the JSON block: add `"verdict": "<ONE punchy sentence — single most important takeaway, ≤15 words>",` and `"schema_version": 2,`.
- In `improvements`: add `"label": "<≤5-word headline of the issue>",` before `issue`.
- Add a rule: *"`verdict` is one sentence, no more. `label` is a noun phrase ≤5 words. Quick-glance fields must read cleanly on their own."*

Adds ~30–50 output tokens (negligible cost); `thinking_budget=0` stays.

### 5. Frontend impact estimate (`videos/detail/page.tsx`)

| Change | Effort |
|---|---|
| `verdict` headline block above scores | **S** |
| Scores → KPI grid (reuse/extend `ScoreBar`) | **S/M** |
| Quick (default) vs Detailed (accordion) split | **M** (collapse state + reorganize existing JSX) |
| Render `improvements[].label` in quick, full triple in detail | **S** |
| Add `verdict`/`label`/`schema_version` to `FormAnalysis` (`api.ts:126-144`) | **S** |
| Remove/keep legacy `!isNewFormat` branches | **S** (optional) |
| Translate all strings to English + `en-GB` (current page mixes IT labels with EN status) | **S** |

Overall **M** for the quick/detailed split; everything else **S**. No backend storage change.

### 6. Model upgrade note (verification GATE — do NOT test live)

Current pin `gemini-2.5-flash` (`config.py:12`, env-overridable). Backlog candidates: `gemini-3.5-flash` / `gemini-3-flash-preview`. Before flipping `GEMINI_MODEL`, gate on:
1. **Thinking-disable behavior on 3.x** — confirm `ThinkingConfig(thinking_budget=0)` is still honored (param name may change, a minimum budget may be enforced, or 0 ignored). This is the load-bearing PROBLEMI RISOLTI #5 fix; if 3.x silently re-enables thinking, output truncates against `max_output_tokens=8192` again. Verify from SDK/release notes, not by trial.
2. **Output token accounting** — re-confirm thinking tokens bill against `max_output_tokens` the same way; re-validate 8192 suffices for the v2 schema on a real clip.
3. **Cost delta** — recompute with 3.x video tokenization rate + new prices before assuming ~$0.0045 holds.
4. **Video tokenization parity** — a higher tok/s multiplies per-second cost directly.
5. **JSON-mode parity** — re-test `response_mime_type="application/json"` adherence + the board-detection escape hatch.

Keep `GEMINI_MODEL` env-driven (it already is) so the upgrade is a config flip + the above verification, not a code change.

---

## Severity-ranked findings (also rolled into `AUDIT_REPORT.md`)

- **[HIGH] [VIDEO] [videos.py:57-98 / coach.py:27-46]** No rate limit / per-user cap → any free account can drive unbounded Gemini spend. Fix: M.
- **[HIGH] [VIDEO] [gemini_service.py:227-246]** Gemini 503/429 → immediate hard `failed`, no retry/backoff. Fix: M.
- **[MED] [VIDEO] [models/video.py:20-21]** All failures collapse to one opaque `failed`; reason logged but never persisted/surfaced. Fix: M (add `error_message` column + render).
- **[MED] [VIDEO] [storage_service.py:27 / gemini_service.py:123]** No duration cap; cost linear in duration + 120s File-API timeout risk. Fix: S/M (ffprobe gate).
- **[MED] [VIDEO] [videos.py:141-159]** `delete_video` leaks the disk file + the Gemini File object. Fix: S.
- **[LOW] [VIDEO] [storage_service.py:55-60 → gemini_service.py:117]** MIME checked from client `content_type` only, then force-uploaded as `video/mp4`. Fix: S.
- **[LOW] [VIDEO] [gemini_service.py:68 + page.tsx:59-77,128-161]** Dead schema/UI: `is_kilter_board` unused; legacy fields unreachable for new records. Fix: S (cleanup).
- **[INFO] [VIDEO] [page.tsx:53,65,81,247 vs 257,265]** Mixed IT/EN UI — English-UI rule violation. Fix: S.
- **[INFO] [VIDEO] [schemas/video.py:51-52]** "Max 3 strengths/improvements" is prompt-prose only; schema lists unbounded. Fix: S (slice on store, or document as intentional).

---

*Generated by D020 audit (VIDEO deep-dive agent). Companion: `AUDIT_REPORT.md`.*
