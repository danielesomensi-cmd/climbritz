from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional
import logging
from datetime import datetime

from app.core.database import get_db, SessionLocal
from app.core.deps import get_current_user_id
from app.models.video import VideoUpload
from app.schemas.video import VideoResponse
from app.services.account_service import purge_video_files
from app.services.storage_service import save_uploaded_file
from app.services.gemini_service import upload_video_to_gemini, analyze_climbing_form

logger = logging.getLogger(__name__)
router = APIRouter()


def _background_analyze(video_id: str, file_path: str) -> None:
    """Background task: upload video to Gemini and run form analysis."""
    db = SessionLocal()
    try:
        video = db.query(VideoUpload).filter(VideoUpload.id == video_id).first()
        if not video:
            logger.warning("Video %s not found during background analysis", video_id)
            return

        video.processing_status = "processing"
        db.commit()

        gemini_file_id = upload_video_to_gemini(file_path)
        video.gemini_file_id = gemini_file_id
        db.commit()

        analysis = analyze_climbing_form(gemini_file_id)
        video.form_analysis = analysis
        video.processing_status = "completed"
        video.completed_at = datetime.utcnow()
        db.commit()

        logger.info("Analysis completed for video %s", video_id)

    except Exception as e:
        logger.error("Analysis failed for video %s: %s", video_id, e)
        db.rollback()
        try:
            video = db.query(VideoUpload).filter(VideoUpload.id == video_id).first()
            if video:
                video.processing_status = "failed"
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


@router.post("/upload", response_model=VideoResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_video(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    grade_attempted: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Upload a climbing video for AI form analysis.

    Returns 202 Accepted immediately with video_id.
    Poll GET /api/videos/{video_id} to check status and retrieve results.
    """
    try:
        video_id, file_path = save_uploaded_file(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IOError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file.",
        )

    video_record = VideoUpload(
        id=video_id,
        user_id=current_user_id,
        filename=file.filename or "upload",
        file_path=file_path,
        file_size=file.size,
        title=title,
        grade_attempted=grade_attempted,
        processing_status="pending",
    )
    db.add(video_record)
    db.commit()
    db.refresh(video_record)

    background_tasks.add_task(_background_analyze, video_id, file_path)

    return VideoResponse.model_validate(video_record)


@router.get("", response_model=list[VideoResponse])
async def list_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get paginated list of current user's videos (latest first)."""
    offset = (page - 1) * per_page
    videos = db.execute(
        select(VideoUpload)
        .where(VideoUpload.user_id == current_user_id)
        .order_by(VideoUpload.created_at.desc())
        .offset(offset)
        .limit(per_page)
    ).scalars().all()

    return [VideoResponse.model_validate(v) for v in videos]


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a single video with status and analysis results."""
    video_record = db.execute(
        select(VideoUpload).where(
            VideoUpload.id == video_id,
            VideoUpload.user_id == current_user_id,
        )
    ).scalars().first()

    if not video_record:
        raise HTTPException(status_code=404, detail="Video not found")

    return VideoResponse.model_validate(video_record)


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a video record and its file on disk.

    The file purge matters: uploads are up to 500 MB and live on the Railway
    persistent volume, so dropping only the DB row leaked storage with no way
    left to find the orphan (A-STORE-PROD-001 C1). Purge is best-effort —
    a missing or unreadable file never blocks the row deletion.
    """
    video_record = db.execute(
        select(VideoUpload).where(
            VideoUpload.id == video_id,
            VideoUpload.user_id == current_user_id,
        )
    ).scalars().first()

    if not video_record:
        raise HTTPException(status_code=404, detail="Video not found")

    purge_video_files(video_record)

    db.delete(video_record)
    db.commit()
