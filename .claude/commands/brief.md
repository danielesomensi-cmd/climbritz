Read the following project files carefully:

1. `PROJECT_STATUS.md`
2. `ROADMAP_ACTIVE.md`
3. `RESEARCH.md` (if it exists)
4. `CLAUDE.md`

Then produce a concise project brief in this exact format:

# CLIMBRITZ — Brief
> Generated: [today's date]

## Status
[2-3 sentences: what's done, what's the current state]

## Architecture
- Backend: [stack]
- Frontend: [stack]
- AI: [model + method]
- Data: [data sources]

## Completed Phases
[bullet list of completed phases with one-line summary each]

## Current Phase
**[Phase name]**
[3-5 bullet points of specific tasks in this phase, mark done/todo]

## Next Steps (actionable)
1. [most immediate concrete task]
2. [second task]
3. [third task]

## Blockers / Open Questions
[any blockers or decisions needed, or "None" if clear path forward]

## Key Files
[list the 3-5 most important files to read before working on this project]

Rules:
- Be concise. No fluff. This output will be copy-pasted into Claude.ai to start an implementation session.
- Use the ACTUAL current state from the files, not assumptions.
- Next steps must be specific enough to act on immediately (not "improve X" but "create endpoint GET /api/climbs/search with autocomplete from BoardLib SQLite DB").
- If RESEARCH.md exists, mention key ecosystem tools (BoardLib, etc.) in the Architecture section.
- Output ONLY the brief block above. No preamble, no explanations.
