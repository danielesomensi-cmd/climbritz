"""A025: AI progress-comment service (FREE tier, History).

A text-only Gemini surface — distinct from the video Coach pipeline in
``gemini_service.py``. It assembles the user's *real* training numbers over a
date range (reusing the A021 ``log_service`` aggregations) and asks
gemini-2.5-flash for a short, encouraging, factual narrative.

Design notes:
  * Text input only — NO File API, NO video, NO JSON response schema.
  * We reuse ``gemini_service._get_client()`` (a generic lazy client
    singleton — not video-specific) so there's one client + one key guard.
  * ``thinking_budget=0`` mirrors the video pipeline fix: thinking tokens are
    billed against ``max_output_tokens`` and would otherwise truncate the
    answer.
  * Ephemeral by design — no persistence, no new table, no migration.
  * 0 sessions short-circuits to a fixed string (no Gemini call) so an empty
    range is deterministic + free.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services import climb_service, gemini_service, log_service

logger = logging.getLogger(__name__)


# Fixed copy — kept out of Gemini so they're deterministic + free.
EMPTY_RANGE_SUMMARY = (
    "You haven't logged any climbs in this range yet. Log a few sessions and "
    "your progress, trends and peak grade will show up here — get on the board!"
)
FALLBACK_SUMMARY = (
    "Nice work logging your sessions! Keep tracking your climbs and your "
    "progress summary will sharpen up here."
)


# ---------------------------------------------------------------------------
# Stats assembly (reuses A021 log_service — no new endpoint, no new query)
# ---------------------------------------------------------------------------


def _grade_resolver_factory():
    """Memoised (climb_uuid, angle) -> grade band resolver.

    Mirrors ``stats._grade_resolver_factory`` so this service stays decoupled
    from the API layer (and ``stats.py`` stays untouched). Lifetime is bounded
    to a single summary request.
    """
    cache: dict[tuple[str, int], Optional[str]] = {}

    def resolve(climb_uuid: str, angle: int) -> Optional[str]:
        key = (climb_uuid, angle)
        if key in cache:
            return cache[key]
        climb = climb_service.get_climb(climb_uuid=climb_uuid, angle=angle)
        grade: Optional[str] = None
        if climb and climb.get("stats"):
            grade = climb["stats"][0].get("grade")
        cache[key] = grade
        return grade

    return resolve


def _trend_direction(trend: list[dict]) -> str:
    """Coarse improving/steady/quieter read over the range.

    Compares successes (flash + send) in the earlier half of the logged weeks
    vs the later half. Needs ≥2 weeks of data to say anything.
    """
    if len(trend) < 2:
        return "not enough data yet"
    successes = [w["flash_count"] + w["send_count"] for w in trend]
    mid = len(successes) // 2
    early = successes[:mid]
    late = successes[mid:]
    early_avg = sum(early) / len(early) if early else 0
    late_avg = sum(late) / len(late) if late else 0
    if late_avg > early_avg + 0.5:
        return "improving (more sends recently)"
    if late_avg < early_avg - 0.5:
        return "quieter recently (fewer sends than earlier)"
    return "steady"


def assemble_stats(
    db: Session,
    *,
    user_id: str,
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    """Build the compact stats dict fed to the prompt, all from log_service."""
    sessions = log_service.list_sessions(
        db, user_id=user_id, date_from=date_from, date_to=date_to
    )
    pyramid = log_service.compute_pyramid(
        db,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        result_filter="send_or_better",
        grade_resolver=_grade_resolver_factory(),
    )
    trend = log_service.compute_trend(
        db, user_id=user_id, date_from=date_from, date_to=date_to
    )

    if date_from is not None and date_to is not None:
        range_label = f"the last {(date_to - date_from).days + 1} days"
    else:
        range_label = "all time"

    # Pyramid is sorted by grade band; the last entry is the hardest band the
    # user has a send-or-better on (same convention the History UI uses).
    peak_grade = pyramid[-1]["grade_band"] if pyramid else None

    return {
        "range_label": range_label,
        "sessions_count": len(sessions),
        "total_climbs": sum(s["total_climbs"] for s in sessions),
        "flashes": sum(s["flashes"] for s in sessions),
        # B033: "sends" is send-or-better (a flash IS a send) — sum plain sends
        # AND flashes. ``flashes`` above is the flash-only subset. This matches
        # the History SENDS card so the narrative can't contradict the UI.
        "sends": sum(s["sends"] + s["flashes"] for s in sessions),
        "attempts": sum(s["attempts"] for s in sessions),
        "peak_grade": peak_grade,
        "grade_distribution": {
            e["grade_band"]: e["count"] for e in pyramid
        },
        "trend_direction": _trend_direction(trend),
    }


# ---------------------------------------------------------------------------
# Prompt + Gemini call
# ---------------------------------------------------------------------------


def _build_prompt(stats: dict) -> str:
    dist = stats["grade_distribution"]
    dist_str = (
        ", ".join(f"{band}: {count}" for band, count in dist.items())
        if dist
        else "none recorded"
    )
    peak = stats["peak_grade"] or "none yet"
    return (
        "You are an encouraging but honest climbing coach writing a short "
        "progress note for a Kilter Board climber. Use ONLY the numbers "
        "provided below — never invent climbs, grades, sessions or facts not "
        "present here.\n\n"
        f"Training data for {stats['range_label']}:\n"
        f"- Sessions: {stats['sessions_count']}\n"
        f"- Total climbs logged: {stats['total_climbs']}\n"
        f"- Sends (send-or-better total — flashes ARE sends and are included "
        f"in this number): {stats['sends']}\n"
        f"- Flashes (a subset of the sends above — sent first try): "
        f"{stats['flashes']}\n"
        f"- Attempts (tried but not yet sent): {stats['attempts']}\n"
        f"- Peak grade (hardest send in this range): {peak}\n"
        f"- Grade distribution of sends (send-or-better): {dist_str}\n"
        f"- Recent trend: {stats['trend_direction']}\n\n"
        "IMPORTANT: a flash counts as a send, so flashes are already part of "
        "the sends total. NEVER say the climber has 0 sends if they have any "
        "flashes. Refer to the hardest grade as the 'peak grade' or 'hardest "
        "send'.\n\n"
        "Write 2-3 sentences, plain text only (no markdown, no bullet points, "
        "no headings). Be warm and motivating, reference concrete numbers from "
        "the data (e.g. the flash count or the peak grade), and if the trend is "
        "improving, celebrate it; if it's quiet, gently encourage. Do not give "
        "a numbered training plan — just a friendly progress comment."
    )


def _call_gemini(prompt: str) -> Optional[str]:
    """Text-only gemini-2.5-flash call. Returns the text, or None if the model
    produced no text part. Isolated so tests can patch it cleanly."""
    client = gemini_service._get_client()
    settings = get_settings()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[prompt],
        config=types.GenerateContentConfig(
            temperature=0.5,
            max_output_tokens=300,
            # Same rationale as the video pipeline: thinking tokens eat the
            # output budget and can truncate / empty the answer.
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    if response.text is None:
        finish_reason = None
        try:
            finish_reason = response.candidates[0].finish_reason
        except (AttributeError, IndexError):
            pass
        logger.warning(
            "Coach summary: Gemini returned no text (finish_reason=%s)",
            finish_reason,
        )
        return None
    return response.text.strip()


def build_summary(
    db: Session,
    *,
    user_id: str,
    date_from: Optional[date],
    date_to: Optional[date],
) -> str:
    """Assemble stats + generate the progress comment.

    Returns a friendly fallback string for an empty range (no Gemini call) or
    when the model produces no text. Propagates exceptions from the Gemini call
    so the API layer can surface a retryable error to the client.
    """
    stats = assemble_stats(
        db, user_id=user_id, date_from=date_from, date_to=date_to
    )
    if stats["sessions_count"] == 0:
        return EMPTY_RANGE_SUMMARY

    prompt = _build_prompt(stats)
    text = _call_gemini(prompt)
    return text or FALLBACK_SUMMARY
