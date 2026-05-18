---
description: Run the Strategic Advisory Council — 5 parallel advisors + peer review + synthesis
---

# Strategic Advisory Council

You are orchestrating a strategic advisory council for Climbritz.

## Flags

- If the user's input contains `--fast`, run **Fast Mode** (skip Stage 2 peer review): 6 total subagent calls — 5 advisors + chairman synthesis.
- Otherwise, run **Full Mode** (default): 11 total subagent calls — 5 advisors + 5 peer reviewers + chairman synthesis.

---

## Instructions

### Step 1 — Read the question

The user's input after `/council` is the strategic question to analyze. Strip any flags (`--fast`) from the question before passing it to advisors. If no question is provided, ask for one.

### Step 2 — Stage 1: Independent Advisor Opinions (parallel)

Spawn 5 advisor subagents **IN PARALLEL** using the contrarian, saas-expert, first-principles, niche-founder, and executor agents simultaneously. Pass each one this prompt:

```
Analyze this strategic decision for a bootstrapped SaaS product:

[paste the user's question here]
```

### Step 3 — Collect and display Stage 1 responses

Present all 5 responses with headers:
- 🔴 The Contrarian
- 💰 SaaS Monetization Expert
- 🔵 First Principles Thinker
- 🟢 Niche SaaS Founder
- ⚫ The Executor

---

### Step 4 — Anonymize responses

Shuffle the 5 advisor-response pairs into a random order. Assign labels A, B, C, D, E to the shuffled order. Record the mapping (e.g., A = Contrarian, B = Executor, …) — **do NOT reveal it yet**.

Build an anonymized block:

```
=== Response A ===
[full text]

=== Response B ===
[full text]

=== Response C ===
[full text]

=== Response D ===
[full text]

=== Response E ===
[full text]
```

---

### Step 5 — Stage 2: Anonymized Peer Review (Full Mode only — skip if --fast)

Spawn 5 reviewer subagents **IN PARALLEL** — one for each advisor (use contrarian, saas-expert, first-principles, niche-founder, executor again). Each reviewer gets this prompt:

```
You are a critical reviewer in a strategic decision council. You will read 5 anonymized responses to a strategic question. You do NOT know who wrote which response — evaluate arguments on their merits, not their style.

ORIGINAL QUESTION:
[paste the user's question here]

ANONYMIZED RESPONSES:
[paste the full anonymized block here]

Read all 5 responses carefully. Then answer these 3 questions:

1. Which response (A-E) is the STRONGEST and why? (2-3 sentences)
2. Which response (A-E) has the BIGGEST BLIND SPOT and what is it? (2-3 sentences)
3. What did ALL FIVE responses miss? What question or angle was not addressed by anyone? (2-3 sentences)

Keep your total review under 150 words. Be specific — cite letters, not vague summaries.
```

Collect all 5 peer reviews. Display them with headers:
- 🔴 Reviewer 1 (Contrarian)
- 💰 Reviewer 2 (SaaS Expert)
- 🔵 Reviewer 3 (First Principles)
- 🟢 Reviewer 4 (Niche Founder)
- ⚫ Reviewer 5 (Executor)

---

### Step 6 — Chairman's Synthesis

Write your own synthesis. In Full Mode, you have: the 5 anonymized opinions (A-E), the 5 peer reviews, and the anonymization key. In Fast Mode, you have only the 5 opinions.

Structure the synthesis **EXACTLY** like this:

**Full Mode:**

```
## WHERE ADVISORS CONVERGE
[What multiple analyses agree on — high-confidence signals. Reference by letter.]

## KEY DISAGREEMENT
[Where advisors fundamentally diverge and who has the stronger argument.]

## BLIND SPOTS IDENTIFIED IN PEER REVIEW
[What peer reviewers flagged as missing from the group's collective analysis — synthesize across all 5 reviewers' Q3 answers.]

## THE DECISION
[One clear recommendation. No hedging.]

## MONDAY MORNING ACTION
[The single first domino to push — specific and actionable, not a plan]
```

**Fast Mode:**

```
## WHERE ADVISORS CONVERGE
[What multiple analyses agree on — high-confidence signals. Reference by letter.]

## STRONGEST SINGLE INSIGHT
[The one insight that changes the conversation. Reference by letter.]

## BIGGEST BLIND SPOT
[What the group collectively missed]

## THE DECISION
[One clear recommendation. No hedging.]

## MONDAY MORNING ACTION
[The single first domino to push — specific and actionable]
```

Be decisive. Respect the solo founder constraint. Under 350 words.

---

### Step 7 — Reveal anonymization key

```
🔓 Anonymization key: A = [Advisor Name], B = [Advisor Name], C = [Advisor Name], D = [Advisor Name], E = [Advisor Name]
```

---

### Step 8 — Save report

Save the full report to `docs/council_reports/council_YYYY-MM-DD_HH-MM.md` (create the directory if it doesn't exist). The report must contain:
- The original question
- The mode used (Full / Fast)
- All 5 advisor analyses (with names)
- All 5 peer reviews (Full Mode only)
- The anonymization key
- The chairman's synthesis

Print when done: `Council complete — report saved to docs/council_reports/council_YYYY-MM-DD_HH-MM.md`
