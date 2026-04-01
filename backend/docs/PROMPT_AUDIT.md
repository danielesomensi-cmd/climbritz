# D001-mini — Gemini Prompt Audit
> Date: 2026-04-01
> Status: READ-ONLY audit — no changes to gemini_service.py
> File audited: `backend/app/services/gemini_service.py`

---

## Current Prompt (verbatim)

```
You are an expert climbing coach with deep knowledge of sport climbing, bouldering, and movement technique.

Analyze this climbing video and provide a detailed, structured assessment.

Return your analysis as a JSON object with the following keys:

{
  "overall_grade_estimate": "<e.g. V4, 6b+, 5.11a — estimated difficulty of the problem/route>",
  "technique_score": <integer 1–10, overall technique quality>,
  "body_tension_score": <integer 1–10, core and full-body tension>,
  "footwork_score": <integer 1–10, foot placement precision and trust>,
  "summary": "<2–3 sentence overall impression>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...],
  "specific_feedback": {
    "footwork": "<detailed footwork observations>",
    "body_positioning": "<hip positioning, center of gravity, body rotation>",
    "arm_usage": "<straight-arm vs bent-arm, lock-off quality, reach efficiency>",
    "breathing_pacing": "<observations on rhythm and rest usage>",
    "route_reading": "<evidence of pre-planning, hesitation, or improvisation>"
  },
  "drills_recommended": ["<drill 1>", "<drill 2>", ...],
  "next_steps": "<1–2 sentence actionable coaching cue>"
}

Be specific, honest, and constructive. Base observations strictly on what is visible in the video.
Return ONLY the JSON object, no markdown fences, no preamble.
```

---

## Generation Config

| Parameter | Value | Notes |
|-----------|-------|-------|
| Model | `gemini-2.5-flash` (from `settings.gemini_model`) | Configurable via env |
| Temperature | `0.3` | Low variance — good for structured output |
| Max output tokens | `8192` | Raised from 1024 after truncation issues (see lessons.md) |
| Response MIME type | `application/json` | Forces JSON mode on Gemini side |
| Input | `[file_ref, CLIMBING_ANALYSIS_PROMPT]` | Video file + prompt as content array |

---

## Response Parsing Pipeline

1. `response.text.strip()` — get raw text
2. Strip markdown fences (```` ``` ````) if present — defensive against model adding them despite JSON mode
3. `json.loads(raw_text)` — primary parse
4. On `JSONDecodeError` → `_try_repair_json()` fallback:
   - Attempt 1: Close unterminated strings + close unbalanced brackets/braces
   - Attempt 2: Close unbalanced brackets/braces only
   - Attempt 3: Strip trailing partial value + close brackets
   - If all fail → raise `RuntimeError`
5. Return parsed dict — no schema validation at this stage

---

## Expected Response Shape

From the prompt, the expected JSON structure is:

```json
{
  "overall_grade_estimate": "V4",
  "technique_score": 7,
  "body_tension_score": 6,
  "footwork_score": 5,
  "summary": "Overall impression...",
  "strengths": ["Good hip positioning", "Strong lock-offs"],
  "weaknesses": ["Feet cutting on overhangs", "Over-gripping"],
  "specific_feedback": {
    "footwork": "Detailed observations...",
    "body_positioning": "...",
    "arm_usage": "...",
    "breathing_pacing": "...",
    "route_reading": "..."
  },
  "drills_recommended": ["Silent feet drill", "4x4 endurance sets"],
  "next_steps": "Focus on trusting your feet on slopers next session."
}
```

Pydantic schema (`FormFeedbackResponse` in `schemas/video.py`) mirrors this structure with all fields optional and `extra="allow"` for forward compatibility.

---

## Observations & Weaknesses

### What works well
- JSON mode (`response_mime_type="application/json"`) reduces formatting issues
- Low temperature (0.3) keeps output consistent
- JSON repair fallback handles truncation gracefully
- Prompt structure is clear and the output schema is well-defined

### Issues to address (future D001-full)

1. **Single grade format — no dual grading**
   - Prompt says `"e.g. V4, 6b+, 5.11a"` but doesn't require BOTH Font + V-grade
   - Model picks one format unpredictably
   - **Fix:** Require `"grade_font": "6b+", "grade_v": "V4"` as separate fields

2. **No Kilter Board context (Level 1 limitation)**
   - Prompt has zero awareness of the specific climb being attempted
   - Can't comment on whether the climber is doing the "right" beta
   - Can't compare to expected difficulty
   - **Fix (Level 2):** Inject climb data: `"You are analyzing an attempt on '{climb_name}', a {grade} problem at {angle}° on the Kilter Board. The problem has {n_holds} holds: {hold_description}..."`

3. **No move-by-move analysis**
   - `specific_feedback` is per-category, not per-move
   - Level 2 schema should add `"move_by_move": [{"move": 1, "observation": "...", "suggestion": "..."}]`

4. **Vague drill recommendations**
   - "Silent feet drill" is generic — no connection to observed weaknesses
   - **Fix:** Instruct model to tie each drill to a specific weakness observed

5. **No hip positioning score**
   - We have technique, body tension, footwork — but hip positioning (arguably the #1 climbing technique differentiator) is buried in `specific_feedback.body_positioning`
   - **Fix:** Add `"hip_positioning_score": <1-10>` as top-level field

6. **No power management score**
   - Overgripping, pumping out, resting efficiency not scored
   - **Fix:** Add `"power_management_score": <1-10>`

7. **No video quality guard**
   - If user uploads a non-climbing video, the model will still try to analyze it
   - **Fix:** Add preamble: `"If this is not a climbing video, return {"error": "not_climbing_video"}"`

8. **No output validation**
   - Parsed JSON dict is returned as-is — no check that required fields exist or scores are in range
   - `FormFeedbackResponse` exists in schemas but isn't used to validate the response in `gemini_service.py`
   - **Fix:** Validate against `FormFeedbackResponse` before returning

---

## Level 2 Prompt Injection Points

When `climb_id` is provided in Phase 3c, the prompt should be enriched with:

```
# CONTEXT BLOCK (inject before analysis instructions)
You are analyzing an attempt on a specific Kilter Board problem:
- **Climb:** {climb_name} (set by {setter})
- **Grade:** {grade_font} / {grade_v} at {angle}°
- **Ascents:** {ascensionist_count} climbers have sent this
- **Holds:** {n_start} start, {n_middle} middle, {n_finish} finish, {n_foot} foot-only
- **Hold positions:** [list of x/y coordinates with roles]

Use this context to:
1. Assess whether the climber's beta matches common sequences for this problem
2. Comment on their execution relative to the expected difficulty
3. Identify specific holds where technique breaks down
```

This block would be prepended to `CLIMBING_ANALYSIS_PROMPT` when climb context is available. The existing prompt works as-is for Level 1 (no context).

---

*Audit by: Claude Code — D001-mini (2026-04-01)*
