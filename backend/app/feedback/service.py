"""Feedback persistence service."""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.database import get_db
from app.feedback.models import FeedbackIn


async def store_feedback(feedback: FeedbackIn) -> None:
    """Write a feedback document to the `feedback` collection."""
    try:
        doc = {
            "created_at":      datetime.now(timezone.utc),
            "rating":          feedback.rating,
            "comments":        feedback.comments,
            "name":            feedback.name,
            "gender":          feedback.gender,
            "age":             feedback.age,
            "collection_size": feedback.collection_size,
            "email":           feedback.email,
        }
        await get_db()["feedback"].insert_one(doc)
        print(f"[feedback.service] Feedback stored (rating={feedback.rating}).")
    except Exception as exc:
        print(f"[feedback.service] Store error: {exc}")
