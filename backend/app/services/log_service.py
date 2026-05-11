"""A021: climb logging + training history domain service.

Owns the sync rules between the two A021 tables:
  - climb_logs (append-mostly source of truth)
  - user_climbs (derived state cached for fast Discovery rendering)

Every write to climb_logs recomputes the matching user_climbs row inside
the same SQLAlchemy session (single transaction), so the derived row
cannot drift on a successful write. If the transaction rolls back, both
sides are unchanged together.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Optional

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - Python ≥3.9 always has zoneinfo
    from backports.zoneinfo import ZoneInfo, ZoneInfoNotFoundError  # type: ignore

from app.models.climb_log import ClimbLog
from app.models.user_climb import UserClimb


# Strength ranking — used when deciding whether to upgrade result_type
# within a single day's log row.
_RESULT_STRENGTH: dict[str, int] = {"attempt": 0, "send": 1, "flash": 2}


# ---------------------------------------------------------------------------
# Timezone resolution
# ---------------------------------------------------------------------------


def resolve_local_date(
    received_at: datetime, tz_header: Optional[str]
) -> date:
    """Return the user's local date at the time the request was received.

    When ``tz_header`` is a valid IANA tz name (e.g. ``Europe/Rome``), we
    convert ``received_at`` into that zone and take its date. Missing or
    unparseable header → UTC fallback.

    Frontend (Capacitor) is expected to attach ``X-User-Timezone`` from
    ``Intl.DateTimeFormat().resolvedOptions().timeZone`` on every log
    request. The UTC fallback exists for unusual clients (server-to-server
    integrations, tests, etc.) that don't carry the header.
    """
    if received_at.tzinfo is None:
        # Defensive: a naive datetime should never reach this function in
        # production (the API passes datetime.now(timezone.utc)), but if
        # it does we treat it as UTC rather than crashing.
        received_at = received_at.replace(tzinfo=timezone.utc)

    zone: timezone | ZoneInfo
    if tz_header:
        try:
            zone = ZoneInfo(tz_header)
        except ZoneInfoNotFoundError:
            zone = timezone.utc
    else:
        zone = timezone.utc

    return received_at.astimezone(zone).date()


# ---------------------------------------------------------------------------
# user_climbs recompute (private helper)
# ---------------------------------------------------------------------------


def _recompute_user_climb(
    db: Session, user_id: str, climb_uuid: str, angle: int
) -> UserClimb:
    """Recompute the user_climbs row for (user, climb, angle) by scanning
    climb_logs. Creates the row if it doesn't exist yet. Preserves
    ``is_project`` across recomputes (it's an independent flag toggled by
    a separate endpoint).
    """
    base = db.query(ClimbLog).filter(
        ClimbLog.user_id == user_id,
        ClimbLog.climb_uuid == climb_uuid,
        ClimbLog.angle == angle,
    )

    # Best result via two cheap existence probes — avoids loading every
    # log into Python just to find the max.
    has_flash = (
        base.filter(ClimbLog.result_type == "flash").first() is not None
    )
    has_send = (
        base.filter(ClimbLog.result_type == "send").first() is not None
    )
    best: Optional[str]
    if has_flash:
        best = "flash"
    elif has_send:
        best = "send"
    else:
        best = None

    last_at = base.with_entities(func.max(ClimbLog.created_at)).scalar()

    row = (
        db.query(UserClimb)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.climb_uuid == climb_uuid,
            UserClimb.angle == angle,
        )
        .one_or_none()
    )
    if row is None:
        row = UserClimb(
            id=str(uuid.uuid4()),
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=angle,
            is_project=False,
            best_result=best,
            last_logged_at=last_at,
        )
        db.add(row)
    else:
        row.best_result = best
        row.last_logged_at = last_at
    return row


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------


def create_or_upgrade_log(
    db: Session,
    *,
    user_id: str,
    climb_uuid: str,
    angle: int,
    result_type: str,
    local_date_value: date,
) -> tuple[ClimbLog, UserClimb]:
    """Create a new log for (user, climb, angle, local_date) — or upgrade
    the existing one for that same day.

    Upgrade rules within a single local_date:
      * Same result_type → increment attempts_count.
      * Stronger result_type (flash > send > attempt) → replace
        result_type AND increment attempts_count.
      * Weaker result_type → keep current result_type but still increment
        attempts_count. Tapping Attempt by mistake after a Send shouldn't
        erase the Send — but it should count as another go.
    """
    existing = (
        db.query(ClimbLog)
        .filter(
            ClimbLog.user_id == user_id,
            ClimbLog.climb_uuid == climb_uuid,
            ClimbLog.angle == angle,
            ClimbLog.local_date == local_date_value,
        )
        .one_or_none()
    )

    if existing is None:
        log = ClimbLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=angle,
            local_date=local_date_value,
            result_type=result_type,
            attempts_count=1,
        )
        db.add(log)
    else:
        existing.attempts_count += 1
        current_strength = _RESULT_STRENGTH.get(existing.result_type, 0)
        new_strength = _RESULT_STRENGTH.get(result_type, 0)
        if new_strength > current_strength:
            existing.result_type = result_type
        log = existing

    db.flush()

    state = _recompute_user_climb(db, user_id, climb_uuid, angle)
    db.commit()
    db.refresh(log)
    db.refresh(state)
    return log, state


def patch_log(
    db: Session,
    *,
    user_id: str,
    log_id: str,
    result_type: Optional[str] = None,
    attempts_count: Optional[int] = None,
) -> Optional[tuple[ClimbLog, UserClimb]]:
    """Direct field update on a log row (admin-style, not the usual flow).
    Returns None if the log doesn't exist or doesn't belong to ``user_id``."""
    log = (
        db.query(ClimbLog)
        .filter(ClimbLog.id == log_id, ClimbLog.user_id == user_id)
        .one_or_none()
    )
    if log is None:
        return None
    if result_type is not None:
        log.result_type = result_type
    if attempts_count is not None:
        log.attempts_count = attempts_count
    db.flush()
    state = _recompute_user_climb(db, user_id, log.climb_uuid, log.angle)
    db.commit()
    db.refresh(log)
    db.refresh(state)
    return log, state


def delete_log(
    db: Session, *, user_id: str, log_id: str
) -> Optional[tuple[str, int]]:
    """Delete a log row (user-scoped). Triggers a user_climbs recompute
    so best_result reflects whatever logs remain. Returns
    (climb_uuid, angle) of the deleted log, or None if not found."""
    log = (
        db.query(ClimbLog)
        .filter(ClimbLog.id == log_id, ClimbLog.user_id == user_id)
        .one_or_none()
    )
    if log is None:
        return None
    climb_uuid = log.climb_uuid
    angle = log.angle
    db.delete(log)
    db.flush()
    _recompute_user_climb(db, user_id, climb_uuid, angle)
    db.commit()
    return climb_uuid, angle


def set_project(
    db: Session,
    *,
    user_id: str,
    climb_uuid: str,
    angle: int,
    is_project: bool,
) -> UserClimb:
    """Toggle the project flag. Creates a user_climbs row with
    best_result=None if the user has never logged on this climb yet."""
    row = (
        db.query(UserClimb)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.climb_uuid == climb_uuid,
            UserClimb.angle == angle,
        )
        .one_or_none()
    )
    if row is None:
        row = UserClimb(
            id=str(uuid.uuid4()),
            user_id=user_id,
            climb_uuid=climb_uuid,
            angle=angle,
            is_project=is_project,
            best_result=None,
            last_logged_at=None,
        )
        db.add(row)
    else:
        row.is_project = is_project
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Queries (read-side)
# ---------------------------------------------------------------------------


def get_user_climb_state(
    db: Session, *, user_id: str, climb_uuid: str, angle: int
) -> Optional[UserClimb]:
    return (
        db.query(UserClimb)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.climb_uuid == climb_uuid,
            UserClimb.angle == angle,
        )
        .one_or_none()
    )


def get_recent_logs_for_climb(
    db: Session,
    *,
    user_id: str,
    climb_uuid: str,
    angle: Optional[int] = None,
    limit: int = 20,
) -> list[ClimbLog]:
    q = db.query(ClimbLog).filter(
        ClimbLog.user_id == user_id, ClimbLog.climb_uuid == climb_uuid
    )
    if angle is not None:
        q = q.filter(ClimbLog.angle == angle)
    return (
        q.order_by(desc(ClimbLog.local_date), desc(ClimbLog.created_at))
        .limit(limit)
        .all()
    )


def list_user_climbs_by_uuids(
    db: Session, *, user_id: str, climb_uuids: list[str]
) -> dict[tuple[str, int], UserClimb]:
    """Used by the Discovery search overlay (Option A from Phase 0
    audit). Returns a (climb_uuid, angle) → UserClimb map so the caller
    can attach user_state to each search row in O(1)."""
    if not climb_uuids:
        return {}
    rows = (
        db.query(UserClimb)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.climb_uuid.in_(climb_uuids),
        )
        .all()
    )
    return {(r.climb_uuid, r.angle): r for r in rows}


def list_done_climb_uuids(db: Session, *, user_id: str) -> list[str]:
    """Distinct climb_uuids the user has any flash/send log for. Backs
    the ``done_filter`` chip on Discovery."""
    rows = (
        db.query(UserClimb.climb_uuid)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.best_result.is_not(None),
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def list_project_climb_uuids(db: Session, *, user_id: str) -> list[str]:
    """Distinct climb_uuids flagged as projects. Backs ``project_filter``."""
    rows = (
        db.query(UserClimb.climb_uuid)
        .filter(
            UserClimb.user_id == user_id,
            UserClimb.is_project.is_(True),
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Aggregations powering /history
# ---------------------------------------------------------------------------


def list_sessions(
    db: Session,
    *,
    user_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    climb_meta_resolver: Optional[
        Callable[[str, int], Optional[dict]]
    ] = None,
) -> list[dict]:
    """Group logs by local_date. Newest day first. One entry per day
    even if multiple climbs were logged.

    ``climb_meta_resolver`` (A021.5): optional callable that returns
    ``{"name": str, "grade": str}`` for a given (climb_uuid, angle).
    The API layer builds it from climb_service so the service stays
    decoupled from BoardLib reads. When None, climb_name and grade
    fields stay None — existing callers (tests pre-Phase-5) still work.
    """
    q = db.query(ClimbLog).filter(ClimbLog.user_id == user_id)
    if date_from is not None:
        q = q.filter(ClimbLog.local_date >= date_from)
    if date_to is not None:
        q = q.filter(ClimbLog.local_date <= date_to)
    logs = q.order_by(
        desc(ClimbLog.local_date), ClimbLog.created_at
    ).all()

    by_date: dict[date, list[ClimbLog]] = {}
    for log in logs:
        by_date.setdefault(log.local_date, []).append(log)

    sessions = []
    for d in sorted(by_date.keys(), reverse=True):
        day_logs = by_date[d]
        climbs_out: list[dict] = []
        for l in day_logs:
            entry: dict = {
                "climb_uuid": l.climb_uuid,
                "angle": l.angle,
                "result_type": l.result_type,
                "attempts_count": l.attempts_count,
                "log_id": l.id,
                "climb_name": None,
                "grade": None,
            }
            if climb_meta_resolver is not None:
                meta = climb_meta_resolver(l.climb_uuid, l.angle)
                if meta is not None:
                    entry["climb_name"] = meta.get("name")
                    entry["grade"] = meta.get("grade")
            climbs_out.append(entry)
        sessions.append(
            {
                "date": d,
                "total_climbs": len(day_logs),
                "sends": sum(1 for l in day_logs if l.result_type == "send"),
                "flashes": sum(1 for l in day_logs if l.result_type == "flash"),
                "attempts": sum(
                    1 for l in day_logs if l.result_type == "attempt"
                ),
                "climbs": climbs_out,
            }
        )
    return sessions


def compute_pyramid(
    db: Session,
    *,
    user_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    result_filter: str = "send_or_better",
    grade_resolver: Callable[[str, int], Optional[str]],
) -> list[dict]:
    """Group logs by grade band. ``grade_resolver`` is injected so this
    service stays decoupled from BoardLib reads — the API layer wires in
    the climb_service-backed resolver.

    ``result_filter``:
      * ``flash`` — only flashes
      * ``send_or_better`` — flashes + sends (default)
      * ``all`` — every log row including attempts
    """
    q = db.query(ClimbLog).filter(ClimbLog.user_id == user_id)
    if date_from is not None:
        q = q.filter(ClimbLog.local_date >= date_from)
    if date_to is not None:
        q = q.filter(ClimbLog.local_date <= date_to)
    if result_filter == "flash":
        q = q.filter(ClimbLog.result_type == "flash")
    elif result_filter == "send_or_better":
        q = q.filter(ClimbLog.result_type.in_(("flash", "send")))
    # result_filter == "all" → no filter

    logs = q.all()

    counts: dict[str, int] = {}
    for log in logs:
        grade = grade_resolver(log.climb_uuid, log.angle)
        if grade is None:
            continue
        counts[grade] = counts.get(grade, 0) + 1

    return [
        {"grade_band": grade, "count": count}
        for grade, count in sorted(counts.items())
    ]


def compute_trend(
    db: Session,
    *,
    user_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[dict]:
    """Group logs by ISO week (Monday as week_start). Empty weeks in the
    range are NOT emitted — the chart layer can fill gaps if it wants a
    continuous X axis."""
    q = db.query(ClimbLog).filter(ClimbLog.user_id == user_id)
    if date_from is not None:
        q = q.filter(ClimbLog.local_date >= date_from)
    if date_to is not None:
        q = q.filter(ClimbLog.local_date <= date_to)
    logs = q.all()

    buckets: dict[date, dict] = {}
    for log in logs:
        monday = log.local_date - timedelta(days=log.local_date.weekday())
        bucket = buckets.setdefault(
            monday,
            {
                "week_start": monday,
                "flash_count": 0,
                "send_count": 0,
                "attempt_count": 0,
            },
        )
        if log.result_type == "flash":
            bucket["flash_count"] += 1
        elif log.result_type == "send":
            bucket["send_count"] += 1
        elif log.result_type == "attempt":
            bucket["attempt_count"] += 1

    return [buckets[k] for k in sorted(buckets.keys())]
