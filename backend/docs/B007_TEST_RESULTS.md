# B007 Prompt Test Results
> Date: 2026-04-01
> Prompt version: B007 (Kilter Board-specific)
> Tester: Daniele Somensi

---

## Test Videos

| # | Climb | Grade | Angle | Source | Notes |
|---|-------|-------|-------|--------|-------|
| 01 | Straight outta Brione | 7C+ (V10) | 40° | @higuera82kilter (Carlos) | Instagram |
| 02 | Gladiolus | 7C+ (V10) | 40° | @higuera82kilter (Carlos) | Instagram |
| 03 | Pulp Friction | 7A (V6) | 45° | @higuera82kilter (Carlos) | Instagram |
| 04 | Kilter dani1 | 7B (V8) | — | Daniele Somensi | Local recording |

> **Note on @higuera82kilter:** Carlos is a known strong Kilter Board climber and a reliable source of reference videos for testing. His videos are well-framed, gym lighting is decent, and grades are verified.

---

## Pre-B007 Results (old generic prompt)

Problems observed across all 4 videos:
- Grade estimation wrong 3/4 times (all underestimated)
- Scores too generous: 9/9/9 on a non-pro 7C+ send
- Generic "Silent Feet" drill in all 4 results regardless of issue
- No Kilter Board-specific knowledge: feet-cutting penalized even when intentional at 40°+
- Output nearly identical between videos — zero specificity

| # | Gemini Grade Est. | Actual | Error | Scores (T/BT/F) | Key issues |
|---|-------------------|--------|-------|-----------------|------------|
| 01 | V6 | V10 | −4 | 9/9/9 | No weaknesses found, praised generic technique |
| 02 | V7 | V10 | −3 | 7/8/6 | Penalized intentional foot cuts as "technique breakdown" |
| 03 | V6 | V6 | ✅ | 6/5/5 | Generic feedback, "Silent Feet" drill (irrelevant) |
| 04 | V4 | V8 | −4 | 6/5/5 | Nearly identical output to video 03 |

---

## Post-B007 Results (Kilter Board-specific prompt)

Tested on videos 02 and 03 (representing both ends of the quality spectrum).

| # | Impression | Scores (T/BT/F/HP/PM) | Key improvements |
|---|-----------|----------------------|-----------------|
| 02 | PROJECTING | 8/9/7/8/9 | Foot-cutting correctly identified as intentional; 1 specific issue with timestamp reference |
| 03 | PROJECTING | 8/8/7/8/8 | 1 specific issue (final dynamic move); drill: "4x4 sets on similar angle" (Kilter-specific) |

**Improvements observed:**
- Grade estimation removed — no longer produces wrong grades
- Foot-cutting at 40° no longer penalized — correctly read as intentional beta
- Output shorter and more actionable (2 specific improvements vs 5 generic ones)
- Drills tied to specific issues with video timestamps
- `overall_impression` field correctly reflects the climber's familiarity with the problem

---

## Critical Gap Found During Testing

On video 03 (Pulp Friction 7A @ 45°), the climber successfully matched both hands on the finish hold (purple/magenta), then dropped off the wall — a clean send. Gemini's B007 response flagged this as:

> "Slight loss of control on the final dynamic move, leading to a fall"

**Root cause:** The prompt had no knowledge of what constitutes a successful Kilter Board ascent. Gemini treated any drop from the wall as a fall.

**Fix:** B008 — added `KILTER BOARD COMPLETION RULES` section to the prompt (2026-04-06). Defines: match on finish hold = send; post-match drop = controlled dismount, not a fall.

---

*Created: B007 validation session, 2026-04-01*
*Updated: B008 gap note added, 2026-04-06*
