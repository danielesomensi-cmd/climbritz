"""A030: AI-proposed names for saved generated problems.

Separate module on purpose (A025 precedent): it reuses the lazy Gemini
client from ``gemini_service._get_client()`` but leaves the high-risk
video-analysis module untouched.

Contract: ``propose_problem_name()`` NEVER raises and NEVER blocks beyond
the 2s budget — saving a problem must not fail or stall on naming. On any
Gemini error/timeout/empty answer it falls back to a local
adjective + noun generator.
"""

from __future__ import annotations

import logging
import random
import re

from google.genai import types

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Hard budget for the naming call. Saving is interactive (one tap), so a
# slow model loses to the local fallback.
GEMINI_TIMEOUT_MS = 2000

# Local fallback corpus — short, climbing-flavored, English (UI language).
_ADJECTIVES = [
    "Sneaky", "Crimpy", "Greasy", "Sandbagged", "Dyno-Happy", "Slabby",
    "Spicy", "Pumpy", "Crusty", "Heinous", "Friendly", "Sleepy",
    "Electric", "Rowdy", "Sketchy", "Velvet",
]
_NOUNS = [
    "Gaston", "Bicycle", "Deadpoint", "Flapper", "Kneebar", "Heelhook",
    "Mantle", "Crux", "Lockoff", "Smear", "Toehook", "Campus",
    "Sloper", "Undercling", "Traverse", "Highball",
]


def _fallback_name(rng: random.Random | None = None) -> str:
    rng = rng or random.Random()
    return f"{rng.choice(_ADJECTIVES)} {rng.choice(_NOUNS)}"


def _build_prompt(grade: str | None, angle: int | None) -> str:
    hints = []
    if grade:
        hints.append(f"around grade {grade}")
    if angle is not None:
        hints.append(f"on a {angle}-degree wall")
    hint_text = (" It is " + " ".join(hints) + ".") if hints else ""
    return (
        "Propose ONE short, witty, climbing-flavored name (2-4 words, "
        "English) for a Kilter Board boulder problem."
        f"{hint_text} Reply with the name only — no quotes, no punctuation, "
        "no explanation."
    )


def _sanitize(raw: str) -> str | None:
    """Trim the model output to a plausible name; None when unusable."""
    name = raw.strip().strip('"').strip("'").strip()
    name = re.sub(r"\s+", " ", name)
    # Drop trailing period-style punctuation the prompt forbids anyway.
    name = name.rstrip(".!")
    if not name:
        return None
    words = name.split(" ")
    if len(words) > 6 or len(name) > 60:
        return None
    return name


def propose_problem_name(
    grade: str | None = None,
    angle: int | None = None,
    rng: random.Random | None = None,
) -> str:
    """One short witty problem name. Never raises, never blocks > ~2s."""
    try:
        # Imported here (not module level) so tests can patch either layer
        # and a missing GEMINI_API_KEY only costs the fallback path.
        from app.services.gemini_service import _get_client

        client = _get_client()
        settings = get_settings()
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=_build_prompt(grade, angle),
            config=types.GenerateContentConfig(
                temperature=1.0,
                max_output_tokens=50,
                # Same rationale as the video/coach pipelines: thinking
                # tokens eat max_output_tokens and we want the raw answer.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
            ),
        )
        if response.text:
            name = _sanitize(response.text)
            if name:
                return name
        logger.info("Gemini naming returned unusable text — local fallback")
    except Exception as exc:
        logger.info("Gemini naming failed (%s) — local fallback", exc)
    return _fallback_name(rng)
