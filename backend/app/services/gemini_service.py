"""
Gemini client wrapper for climbing video analysis.
Uses google.genai SDK with gemini-2.5-flash to analyze climbing technique.
"""

import json
import os
import random
import re
import time
import logging
from typing import Any

from google import genai
from google.genai import types
from google.genai import errors as genai_errors

from app.core.config import get_settings
from app.schemas.video import FormFeedbackResponse

logger = logging.getLogger(__name__)

# --- Bounded retry/backoff for transient Gemini errors (B038) -----------------
# A transient 429 (rate limited) or 5xx (overloaded) on generate_content should
# not permanently fail a video — retry a couple of times with exponential
# backoff. Kept small on purpose: _background_analyze runs in-process and
# time.sleep blocks a threadpool thread, so long sleeps × concurrent uploads
# under a traffic spike risk pool exhaustion.
GEMINI_MAX_ATTEMPTS = 3  # 1 initial + 2 retries
GEMINI_BACKOFF_BASE_SECONDS = 2.0  # sleeps between attempts: 2s, then 4s
GEMINI_BACKOFF_JITTER_SECONDS = 0.5  # ± jitter to de-correlate concurrent retries
GEMINI_RETRY_AFTER_CAP_SECONDS = 10.0  # never sleep longer than this, even if Retry-After asks
# Discriminate on exc.code (HTTP status), NOT class — 429 is a ClientError while
# 5xx are ServerError, but both subclass APIError.
GEMINI_RETRIABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Lazy-initialize the Gemini client on first use."""
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Add it to backend/.env to enable video analysis."
        )
    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


CLIMBING_ANALYSIS_PROMPT = """You are an expert Kilter Board climbing coach. You specialize in analyzing technique on the Kilter Board — a standardized indoor training board with adjustable angles (0–70°), plastic holds with LED indicators, and a focus on powerful, dynamic movement.

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

Return ONLY the JSON object, no markdown fences, no preamble."""


def upload_video_to_gemini(file_path: str) -> str:
    """
    Upload a local video file to the Gemini File API.

    Args:
        file_path: Absolute or relative path to the video file.

    Returns:
        The Gemini File API URI (e.g. "files/abc123") to reference in generation requests.

    Raises:
        FileNotFoundError: If the file does not exist at the given path.
        RuntimeError: If the upload fails or the file never reaches ACTIVE state.
    """
    client = _get_client()

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Video file not found: {file_path}")

    logger.info("Uploading video to Gemini File API: %s", file_path)

    try:
        uploaded_file = client.files.upload(
            file=file_path,
            config=types.UploadFileConfig(mime_type="video/mp4"),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini file upload failed: {exc}") from exc

    # Poll until the file is ACTIVE (processing can take a few seconds)
    max_wait_seconds = 120
    poll_interval = 5
    elapsed = 0

    while uploaded_file.state == "PROCESSING":
        if elapsed >= max_wait_seconds:
            raise RuntimeError(
                f"Gemini file {uploaded_file.name} still PROCESSING after "
                f"{max_wait_seconds}s — aborting."
            )
        logger.debug(
            "File %s is PROCESSING, waiting %ss …", uploaded_file.name, poll_interval
        )
        time.sleep(poll_interval)
        elapsed += poll_interval
        uploaded_file = client.files.get(name=uploaded_file.name)

    if uploaded_file.state != "ACTIVE":
        raise RuntimeError(
            f"Gemini file {uploaded_file.name} ended in unexpected state: "
            f"{uploaded_file.state}"
        )

    logger.info("File uploaded and ACTIVE: %s", uploaded_file.name)
    return uploaded_file.name  # e.g. "files/abc123xyz"


def _try_repair_json(text: str) -> dict[str, Any] | None:
    """Attempt to repair truncated JSON by closing open structures."""
    repaired = text.rstrip()

    # Try as-is first
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # Strategy: try multiple repair approaches, return the first that works
    attempts = [repaired]

    # 1. Close unterminated string, then close brackets/braces
    r = repaired
    if r.count('"') % 2 != 0:
        r += '"'
    for open_ch, close_ch in [('[', ']'), ('{', '}')]:
        diff = r.count(open_ch) - r.count(close_ch)
        if diff > 0:
            r += close_ch * diff
    attempts.append(r)

    # 2. Close brackets/braces only (no unterminated string)
    r = repaired
    for open_ch, close_ch in [('[', ']'), ('{', '}')]:
        diff = r.count(open_ch) - r.count(close_ch)
        if diff > 0:
            r += close_ch * diff
    attempts.append(r)

    # 3. Strip trailing partial value, then close
    r = re.sub(r',\s*"[^"]*$', '', repaired)  # remove trailing `, "partial_key...`
    r = re.sub(r',\s*$', '', r)                # remove trailing comma
    for open_ch, close_ch in [('[', ']'), ('{', '}')]:
        diff = r.count(open_ch) - r.count(close_ch)
        if diff > 0:
            r += close_ch * diff
    attempts.append(r)

    for attempt in attempts:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            continue

    return None


def _compute_backoff_delay(attempt: int) -> float:
    """Exponential backoff for a 1-based attempt (2s, 4s, …) plus ± jitter, floored at 0."""
    base = GEMINI_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
    jitter = random.uniform(-GEMINI_BACKOFF_JITTER_SECONDS, GEMINI_BACKOFF_JITTER_SECONDS)
    return max(0.0, base + jitter)


def _extract_retry_after(exc: Exception) -> float | None:
    """
    Best-effort parse of a Retry-After header (in seconds) off an APIError's
    response. Returns None when the response/header is missing, the value is an
    HTTP-date form, or anything is unparseable — caller falls back to computed
    backoff in that case.
    """
    response = getattr(exc, "response", None)
    if response is None:
        return None
    try:
        value = response.headers.get("Retry-After") or response.headers.get("retry-after")
    except (AttributeError, TypeError):
        return None
    if not value:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None  # HTTP-date form not supported; computed backoff takes over


def _generate_content_with_retry(client: genai.Client, *, model, contents, config):
    """
    Wrap client.models.generate_content with bounded exponential backoff on
    transient Gemini errors (429/500/502/503/504). Non-retriable APIErrors
    (400/403/404/…) and any non-APIError exception re-raise immediately; the
    final exhausted attempt also re-raises — so the caller's existing failure
    path (RuntimeError wrap → background task marks the video `failed`) is
    preserved unchanged. On first-try success generate_content is called exactly
    once.
    """
    for attempt in range(1, GEMINI_MAX_ATTEMPTS + 1):
        try:
            return client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except genai_errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code not in GEMINI_RETRIABLE_STATUS_CODES or attempt >= GEMINI_MAX_ATTEMPTS:
                # Non-retriable, or retries exhausted → let it propagate.
                raise
            retry_after = _extract_retry_after(exc) if code == 429 else None
            base_delay = retry_after if retry_after is not None else _compute_backoff_delay(attempt)
            delay = min(base_delay, GEMINI_RETRY_AFTER_CAP_SECONDS)
            logger.warning(
                "Gemini transient error (code=%s) on attempt %d/%d; retrying in %.1fs",
                code, attempt, GEMINI_MAX_ATTEMPTS, delay,
            )
            time.sleep(delay)
    # Loop always returns or raises above; this is an unreachable safety net.
    raise RuntimeError("Gemini generation retry loop exited unexpectedly")


def analyze_climbing_form(gemini_file_id: str) -> dict[str, Any]:
    """
    Run climbing-form analysis on a previously uploaded Gemini file.

    Args:
        gemini_file_id: The Gemini File API name (e.g. "files/abc123xyz")
                        returned by upload_video_to_gemini().

    Returns:
        A dict with structured coaching feedback including scores, strengths,
        weaknesses, drill recommendations, and specific technique notes.

    Raises:
        RuntimeError: If the Gemini API call fails or returns unparseable output.
    """
    client = _get_client()
    settings = get_settings()

    logger.info("Requesting climbing analysis for file: %s", gemini_file_id)

    try:
        file_ref = client.files.get(name=gemini_file_id)
    except Exception as exc:
        raise RuntimeError(
            f"Could not retrieve Gemini file '{gemini_file_id}': {exc}"
        ) from exc

    try:
        response = _generate_content_with_retry(
            client,
            model=settings.gemini_model,
            contents=[file_ref, CLIMBING_ANALYSIS_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
                response_mime_type="application/json",
                # gemini-2.5-flash does "dynamic thinking" by default, and those
                # thinking tokens are billed against max_output_tokens. On a real
                # climbing video the visual reasoning is heavy enough to consume
                # the whole budget, leaving the JSON answer truncated or empty
                # (finish_reason=MAX_TOKENS) — which is why analysis silently
                # started failing. The prompt was authored/validated (B007/B008)
                # without thinking, so we disable it: the full budget goes to the
                # structured answer and output is deterministic.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini generation failed: {exc}") from exc

    # Guard against an empty/blocked response: response.text is None when the
    # model returns no text part (safety block, or budget exhausted before any
    # answer token). Surface a clear error instead of an opaque AttributeError
    # on .strip(), and log the finish_reason so the failure is diagnosable.
    if response.text is None:
        finish_reason = None
        try:
            finish_reason = response.candidates[0].finish_reason
        except (AttributeError, IndexError):
            pass
        raise RuntimeError(
            f"Gemini returned no text for file {gemini_file_id} "
            f"(finish_reason={finish_reason}). Likely a safety block or token "
            f"budget exhausted before any answer token was produced."
        )

    raw_text = response.text.strip()
    logger.debug("Raw Gemini response: %s", raw_text[:500])

    # Strip accidental markdown fences if the model adds them
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        raw_text = "\n".join(
            line for line in lines if not line.startswith("```")
        ).strip()

    try:
        analysis: dict[str, Any] = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.warning(
            "JSON parse failed for %s, attempting repair. Error: %s\nRaw output:\n%s",
            gemini_file_id, exc, raw_text,
        )
        repaired = _try_repair_json(raw_text)
        if repaired is not None:
            logger.info("Repaired truncated JSON for file: %s", gemini_file_id)
            analysis = repaired
        else:
            raise RuntimeError(
                f"Gemini returned non-JSON response: {exc}\n\nRaw output:\n{raw_text}"
            ) from exc

    # Validate response structure (log warnings but don't crash)
    try:
        FormFeedbackResponse(**analysis)
    except Exception as e:
        logger.warning("Response validation warning for %s: %s", gemini_file_id, e)

    logger.info("Climbing analysis complete for file: %s", gemini_file_id)
    return analysis
