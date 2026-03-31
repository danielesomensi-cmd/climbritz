# Kilter-Up — Lessons Learned

> Append-only. Format: `[YYYY-MM-DD] [BRIEF-ID]: Lesson`
> Never delete entries. Never rewrite. Just append.

---

[2026-03-25] [B003]: Retired Gemini models (e.g. `gemini-2.0-flash`) fail silently at the analysis stage — no error, just empty/broken responses. Pin model versions explicitly and monitor for deprecation notices.
[2026-03-25] [B003]: The `google.generativeai` SDK is deprecated (FutureWarning). Migrated to `google.genai`. Always check SDK status before building new features on it.
[2026-03-26] [HOTFIX]: Gemini model string must match exactly — `gemini-2.5-flash` works, `gemini-2.0-flash` is retired. When switching models, test the full pipeline end-to-end.
[2026-03-26] [HOTFIX]: `max_output_tokens` too low (1024) causes JSON truncation on Gemini responses. Raised to 8192. Always set `response_mime_type="application/json"` for structured output.
[2026-03-20] [B001]: Railway defaults to Node.js detection for repos with both `package.json` and `requirements.txt`. Fix: set `Root Directory: backend/` in Railway dashboard and use explicit `railway.toml`.
[2026-03-20] [B001]: Legacy `vercel.json` env blocks with `@secret-ref` syntax block ALL Vercel deploys — strip them early, even if the values seem harmless.
[2026-03-22] [B002]: Outdated docs (phantom endpoints, abandoned schemas) create more confusion than value for the AI agent. Archive rather than rewrite until the phase stabilizes.
[2026-03-31] [D004]: climb-agent's persistence marker pattern for `/health` is valuable for Railway volumes — proves data survives redeployment without manual checks.
