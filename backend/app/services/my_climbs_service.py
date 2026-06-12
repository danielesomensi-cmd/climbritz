"""A030: My Problems — saved AI-generated climbs (service layer).

CRUD + the two integration surfaces:
  - ``get_meta_for_user`` backs the POST /api/logs guard branch (generated
    uuids are valid static problems, frames_count == 1 by construction);
  - ``search_my_climbs`` backs the Discovery merge (A021 Option A pattern:
    BoardLib query untouched, mine filtered Python-side and prepended).

Frames are stored in the exact BoardLib encoding and validated on write:
``p{placement_id}r{role_id}`` with role ids ∈ {12,13,14,15} (Kilter
Original, audit D019) and no duplicate placements.
"""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.climb_log import ClimbLog
from app.models.user_generated_climb import UserGeneratedClimb
from app.services import climb_service, problem_name_service
from app.utils.kilter_parser import ROLE_MAP, get_grade_name, parse_layout

# Full-string validation: one or more p{digits}r{digits} groups, nothing else.
_FRAMES_RE = re.compile(r"^(?:p\d+r\d+)+$")

VALID_ROLE_IDS = set(ROLE_MAP.keys())  # {12, 13, 14, 15}


class InvalidFramesError(ValueError):
    """Frames string is not a valid Kilter Original static problem."""


def validate_frames(frames: str) -> list[dict]:
    """Validate + parse a frames string. Returns the parsed holds or raises
    InvalidFramesError with a user-presentable message.

    A031 — beyond the encoding checks, enforce problem structure (mirrors
    the editor's client-side rules): 1–2 start, 1–2 finish, ≥3 holds.
    """
    if not frames or not _FRAMES_RE.match(frames):
        raise InvalidFramesError(
            "frames must be a non-empty p{placement_id}r{role_id} sequence"
        )
    holds = parse_layout(frames)
    bad_roles = {h["role_code"] for h in holds} - VALID_ROLE_IDS
    if bad_roles:
        raise InvalidFramesError(
            f"unsupported role ids {sorted(bad_roles)} — expected "
            f"{sorted(VALID_ROLE_IDS)} (Kilter Original)"
        )
    pids = [h["placement_id"] for h in holds]
    if len(pids) != len(set(pids)):
        raise InvalidFramesError("duplicate placement_id in frames")
    if len(holds) < 3:
        raise InvalidFramesError("a problem needs at least 3 holds")
    starts = sum(1 for h in holds if h["role_code"] == 12)
    finishes = sum(1 for h in holds if h["role_code"] == 14)
    if not 1 <= starts <= 2:
        raise InvalidFramesError(
            f"a problem needs 1 or 2 start holds (got {starts})"
        )
    if not 1 <= finishes <= 2:
        raise InvalidFramesError(
            f"a problem needs 1 or 2 finish holds (got {finishes})"
        )
    return holds


def moves_count(frames: str) -> int:
    """Discovery's move-count convention (A019): middle holds (r13) + 2."""
    return frames.count("r13") + 2


def _moves_bucket_matches(frames: str, moves: Optional[str]) -> bool:
    if not moves or moves == "any":
        return True
    n = moves_count(frames)
    return {
        "le5": n <= 5,
        "6-7": 6 <= n <= 7,
        "8-10": 8 <= n <= 10,
        "gt10": n > 10,
    }.get(moves, True)


def _seed_grade(seed_climb_uuid: Optional[str], angle: int) -> tuple[Optional[str], Optional[int]]:
    """(grade_label, numeric_difficulty) of the seed at the saved angle.
    Best-effort: (None, None) when the seed is unknown or has no stats."""
    if not seed_climb_uuid:
        return None, None
    climb = climb_service.get_climb(climb_uuid=seed_climb_uuid, angle=angle)
    if not climb or not climb.get("stats"):
        # Angle-specific stats may not exist; retry without angle filter.
        climb = climb_service.get_climb(climb_uuid=seed_climb_uuid)
    if not climb or not climb.get("stats"):
        return None, None
    stats = climb["stats"][0]
    difficulty = round(stats["difficulty"])
    return stats.get("grade") or get_grade_name(difficulty), difficulty


def _ascent_counts(
    db: Session, user_id: str, uuids: list[str]
) -> dict[str, int]:
    """uuid -> count of the user's flash/send logs (the brief's
    ``ascent_count``). Attempts don't count as ascents."""
    if not uuids:
        return {}
    rows = (
        db.query(ClimbLog.climb_uuid, func.count(ClimbLog.id))
        .filter(
            ClimbLog.user_id == user_id,
            ClimbLog.climb_uuid.in_(uuids),
            ClimbLog.result_type.in_(["flash", "send"]),
        )
        .group_by(ClimbLog.climb_uuid)
        .all()
    )
    return {uuid: count for uuid, count in rows}


def create_my_climb(
    db: Session,
    *,
    user_id: str,
    frames: str,
    angle: int,
    seed_climb_uuid: Optional[str] = None,
    name: Optional[str] = None,
    grade: Optional[str] = None,
) -> UserGeneratedClimb:
    """Validate, name, prefill grade from the seed, insert.

    A031 — ``name``/``grade`` are optional client overrides (the generate
    page shows the AI name BEFORE saving; the editor sets both). When
    absent, server-side behavior is unchanged: AI name with local
    fallback (never blocks the save), grade from the seed.
    Raises InvalidFramesError."""
    validate_frames(frames)
    seed_grade, difficulty = _seed_grade(seed_climb_uuid, angle)
    if grade is None:
        grade = seed_grade
    if name is None:
        name = problem_name_service.propose_problem_name(
            grade=grade, angle=angle
        )
    row = UserGeneratedClimb(
        user_id=user_id,
        name=name,
        frames=frames,
        frames_count=1,
        angle=angle,
        grade=grade,
        difficulty=difficulty,
        seed_climb_uuid=seed_climb_uuid,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_my_climbs(db: Session, *, user_id: str) -> list[dict]:
    """All of the user's problems, newest first, each with ascent_count."""
    rows = (
        db.query(UserGeneratedClimb)
        .filter(UserGeneratedClimb.user_id == user_id)
        .order_by(UserGeneratedClimb.created_at.desc())
        .all()
    )
    counts = _ascent_counts(db, user_id, [r.uuid for r in rows])
    return [_to_dict(r, counts.get(r.uuid, 0)) for r in rows]


def get_my_climb(
    db: Session, *, user_id: str, uuid: str
) -> Optional[UserGeneratedClimb]:
    return (
        db.query(UserGeneratedClimb)
        .filter(
            UserGeneratedClimb.uuid == uuid,
            UserGeneratedClimb.user_id == user_id,
        )
        .first()
    )


def get_my_climb_detail(db: Session, *, user_id: str, uuid: str) -> Optional[dict]:
    """Detail incl. parsed holds in the same shape the BoardLib detail
    endpoint returns (placement_id/role/x/y/set_id) so the frontend
    board + BLE path is identical. x/y/set_id are None — the frontend
    resolves positions from static data, exactly like /generate does."""
    row = get_my_climb(db, user_id=user_id, uuid=uuid)
    if row is None:
        return None
    counts = _ascent_counts(db, user_id, [row.uuid])
    payload = _to_dict(row, counts.get(row.uuid, 0))
    payload["holds"] = [
        {
            "placement_id": h["placement_id"],
            "role": h["role"],
            "x": None,
            "y": None,
            "set_id": None,
        }
        for h in parse_layout(row.frames)
    ]
    return payload


def patch_my_climb(
    db: Session,
    *,
    user_id: str,
    uuid: str,
    name: Optional[str] = None,
    grade: Optional[str] = None,
    frames: Optional[str] = None,
) -> Optional[UserGeneratedClimb]:
    """A031 — ``frames`` is editable too (hold editor). Full validation;
    logs/ascents stay attached (they're keyed by uuid, untouched here)."""
    row = get_my_climb(db, user_id=user_id, uuid=uuid)
    if row is None:
        return None
    if frames is not None:
        validate_frames(frames)  # raises InvalidFramesError
        row.frames = frames
    if name is not None:
        row.name = name
    if grade is not None:
        row.grade = grade
    db.commit()
    db.refresh(row)
    return row


def delete_my_climb(db: Session, *, user_id: str, uuid: str) -> bool:
    row = get_my_climb(db, user_id=user_id, uuid=uuid)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def get_meta_for_user(db: Session, *, user_id: str, uuid: str) -> Optional[dict]:
    """Logs-guard lookup: same shape as climb_service.get_climb_meta().
    Scoped to the owner — user B logging user A's problem stays a 404."""
    row = get_my_climb(db, user_id=user_id, uuid=uuid)
    if row is None:
        return None
    return {
        "frames_count": row.frames_count,
        "is_listed": bool(row.is_listed),
        "layout_id": 1,
    }


def get_name_grade_for_user(
    db: Session, *, user_id: str, uuid: str
) -> Optional[dict]:
    """Sessions-list enrichment fallback (name + grade) for generated uuids."""
    row = get_my_climb(db, user_id=user_id, uuid=uuid)
    if row is None:
        return None
    return {"name": row.name, "grade": row.grade}


def search_my_climbs(
    db: Session,
    *,
    user_id: str,
    query: Optional[str] = None,
    angle: Optional[int] = None,
    grade_min: Optional[int] = None,
    grade_max: Optional[int] = None,
    min_ascents: Optional[int] = None,
    min_quality: Optional[float] = None,
    moves: Optional[str] = None,
    benchmark: bool = False,
    nomatch: bool = False,
    include_uuids: Optional[list[str]] = None,
    exclude_uuids: Optional[list[str]] = None,
) -> list[dict]:
    """The user's problems filtered with Discovery-equivalent semantics.

    Filters that can't apply to mine exclude them naturally — that's the
    spec'd behavior, no special-casing: benchmark=True (mine are never
    benchmarks), min_quality (mine have no stars), nomatch=True (v1 saves
    is_nomatch=False), grade range when difficulty is unknown.
    """
    if benchmark or nomatch or (min_quality is not None):
        return []

    rows = (
        db.query(UserGeneratedClimb)
        .filter(UserGeneratedClimb.user_id == user_id)
        .order_by(UserGeneratedClimb.created_at.desc())
        .all()
    )
    counts = _ascent_counts(db, user_id, [r.uuid for r in rows])

    out: list[dict] = []
    for r in rows:
        if query and query.lower() not in r.name.lower():
            continue
        if angle is not None and r.angle != angle:
            continue
        if grade_min is not None and (r.difficulty is None or r.difficulty < grade_min):
            continue
        if grade_max is not None and (r.difficulty is None or r.difficulty > grade_max):
            continue
        ascents = counts.get(r.uuid, 0)
        if min_ascents is not None and ascents < min_ascents:
            continue
        if not _moves_bucket_matches(r.frames, moves):
            continue
        if include_uuids is not None and r.uuid not in include_uuids:
            continue
        if exclude_uuids and r.uuid in exclude_uuids:
            continue
        out.append(_to_dict(r, ascents))
    return out


def _to_dict(row: UserGeneratedClimb, ascent_count: int) -> dict:
    return {
        "uuid": row.uuid,
        "name": row.name,
        "description": row.description,
        "frames": row.frames,
        "angle": row.angle,
        "grade": row.grade,
        "difficulty": row.difficulty,
        "seed_climb_uuid": row.seed_climb_uuid,
        "ascent_count": ascent_count,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
