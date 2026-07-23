"""A-STORE-PROD-001: user account endpoints.

Currently one route — ``DELETE /api/users/me`` — added to satisfy App Store
Review Guideline 5.1.1(v): an app that supports account creation must let
the user delete that account from inside the app.

Ordering contract: local data and artifacts are erased FIRST, the Clerk
identity LAST. If the Clerk call fails, the user is left with a working
login and an empty account (recoverable, and a retry finishes the job)
rather than an orphaned Clerk user pointing at data we can no longer reach.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.user import User
from app.services import account_service, clerk_admin_service
from app.services.clerk_admin_service import ClerkApiError

logger = logging.getLogger(__name__)

router = APIRouter()


def _evict_clerk_cache(clerk_id: str) -> None:
    """Drop the clerk_id → local_user_id entry from core.clerk's in-process
    cache so a still-valid session can't keep writing rows against a user_id
    whose shadow row we just deleted (the cache has a 5-minute TTL).

    Read-only use of a module attribute — ``core/clerk.py`` is a STOP-gate
    file and is deliberately not modified by this brief.
    """
    try:
        from app.core.clerk import _clerk_id_cache

        _clerk_id_cache.pop(clerk_id, None)
    except Exception:  # pragma: no cover - cache eviction is never fatal
        logger.warning("Could not evict Clerk id cache for %s", clerk_id)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Response:
    """Permanently delete the caller's account and all of their data.

    Idempotent: a second call returns 204. (``get_current_user_id`` re-creates
    the shadow row for a still-valid session, so the second pass simply finds
    nothing to delete and Clerk answers 404, which we treat as success.)
    """
    user = db.query(User).filter(User.id == current_user_id).first()
    # None in the dev-only X-User-ID path, where no shadow row is created.
    clerk_id = user.clerk_id if user else None

    counts = account_service.delete_user_account(db, current_user_id)

    if not clerk_id:
        logger.info(
            "Deleted local data for %s; no Clerk identity to remove (%s)",
            current_user_id,
            counts,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    secret_key = get_settings().clerk_secret_key
    if not secret_key:
        # Local data is already gone; refusing silently would strand the
        # Clerk account with no signal, so surface it as a server misconfig.
        logger.error("CLERK_SECRET_KEY unset — cannot delete Clerk user")
        raise HTTPException(
            status_code=503,
            detail=(
                "Your data has been deleted, but the account could not be "
                "removed from the identity provider. Please contact support."
            ),
        )

    try:
        clerk_admin_service.delete_user(secret_key, clerk_id)
    except ClerkApiError as exc:
        # Log the detail for us; return a clean message to the client. Never
        # let the Clerk response body or a stack trace reach the app.
        logger.error("Clerk user delete failed for %s: %s", clerk_id, exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "Your data has been deleted, but sign-out from the identity "
                "provider failed. Please try again."
            ),
        )

    _evict_clerk_cache(clerk_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
