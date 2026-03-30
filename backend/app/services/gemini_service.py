"""
Gemini client wrapper for climbing video analysis.
Uses google.genai SDK with gemini-2.5-pro to analyze climbing technique.
"""

import os
import time
import logging
from typing import Any

from google import genai
from google.genai import types

from app.core.config import get_settings

logger = logging.getLogger(__name__)

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


CLIMBING_ANALYSIS_PROMPT = """
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
"""


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
    import json

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
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[file_ref, CLIMBING_ANALYSIS_PROMPT],
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini generation failed: {exc}") from exc

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
        raise RuntimeError(
            f"Gemini returned non-JSON response: {exc}\n\nRaw output:\n{raw_text}"
        ) from exc

    logger.info("Climbing analysis complete for file: %s", gemini_file_id)
    return analysis
