# Gemini Prompt Audit
> Last updated: 2026-04-01 (B007 — Kilter Board-specific rework)
> File: `backend/app/services/gemini_service.py`

---

## Current Prompt (B007 — Kilter Board Specialist)

The prompt was reworked in B007 based on testing with 4 real Kilter Board videos that revealed:
- Grade estimation wrong 3/4 times (all underestimated)
- Generic "Silent Feet" drill in all 4 results
- Scores too generous (9/9/9 on a non-pro 7C+ send)
- No Kilter Board-specific knowledge (feet cutting penalized even when intentional)

Key changes from old prompt:
- **Removed** grade estimation (will come from DB in Level 2)
- **Added** board detection (non-Kilter videos return error)
- **Added** Kilter Board context (steep angles, dynamic movement, intentional foot cuts)
- **Added** hip_positioning_score and power_management_score
- **Replaced** weaknesses + drills_recommended with `improvements[]` (issue + fix + drill per item)
- **Added** overall_impression (flash/onsight/projecting/working)
- **Removed** specific_feedback (5 filler sub-sections) — replaced with concise improvements
- **Added** calibration guidance (8+ = strong, 9-10 = near-professional)

---

## Generation Config

| Parameter | Value | Notes |
|-----------|-------|-------|
| Model | `gemini-2.5-flash` (from `settings.gemini_model`) | Configurable via env |
| Temperature | `0.3` | Low variance — good for structured output |
| Max output tokens | `8192` | Raised from 1024 after truncation issues |
| Response MIME type | `application/json` | Forces JSON mode on Gemini side |
| Input | `[file_ref, CLIMBING_ANALYSIS_PROMPT]` | Video file + prompt as content array |

---

## Response Parsing Pipeline

1. `response.text.strip()` — get raw text
2. Strip markdown fences if present
3. `json.loads(raw_text)` — primary parse
4. On `JSONDecodeError` → `_try_repair_json()` fallback (3 strategies)
5. **Validate** against `FormFeedbackResponse` Pydantic schema (log warnings, don't crash)
6. Return parsed dict

---

## Expected Response Shape (B007+)

```json
{
  "is_kilter_board": true,
  "technique_score": 7,
  "body_tension_score": 6,
  "footwork_score": 5,
  "hip_positioning_score": 6,
  "power_management_score": 7,
  "summary": "Key observation. Key suggestion.",
  "strengths": ["strength 1", "strength 2"],
  "improvements": [
    {"issue": "specific observation", "fix": "actionable suggestion", "drill": "Kilter-specific drill"}
  ],
  "overall_impression": "projecting"
}
```

Error response (non-Kilter Board video):
```json
{
  "error": "not_kilter_board",
  "message": "This does not appear to be a Kilter Board climbing video."
}
```

---

## Completed TODOs (from D001-mini)

- [x] ~~No hip positioning score~~ — added `hip_positioning_score`
- [x] ~~No power management score~~ — added `power_management_score`
- [x] ~~Vague drill recommendations~~ — drills now tied to specific issues
- [x] ~~No video quality guard~~ — board detection added
- [x] ~~No output validation~~ — Pydantic validation added (warning-only)
- [x] ~~Single grade format~~ — grade estimation removed entirely (comes from DB in Level 2)
- [x] ~~Filler sections (breathing, route_reading)~~ — removed, replaced with concise improvements

## Remaining TODOs (Level 2 — Phase 3c)

- [ ] Inject climb context (name, grade, holds, angle) when `climb_id` is provided
- [ ] Add move-by-move analysis when climb context is available
- [ ] Dual grading display (Font + V-grade) from DB data, not AI estimation

---

*Updated: B007 (2026-04-01)*
