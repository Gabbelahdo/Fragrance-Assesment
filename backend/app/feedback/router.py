"""Feedback API router."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.feedback.models import FeedbackIn
from app.feedback import service as feedback_service

router = APIRouter()


@router.post("", status_code=201)
async def submit_feedback(feedback: FeedbackIn) -> JSONResponse:
    """Store optional post-recommendation feedback from the user."""
    await feedback_service.store_feedback(feedback)
    return JSONResponse(content={"status": "ok"}, status_code=201)
