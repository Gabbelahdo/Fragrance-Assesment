"""
AI recommendation router.

POST /ai/recommend  — rate-limited, cached, model-tiered recommendation endpoint.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.ai.models import AssessmentPreferences, RecommendationResult
from app.ai import service
from app.core.rate_limit import check_rate_limit

router = APIRouter()


@router.post(
    "/recommend",
    response_model=list[RecommendationResult],
    response_model_by_alias=True,
    summary="Get AI-powered fragrance recommendations",
    dependencies=[Depends(check_rate_limit)],   # 5 requests/IP/hour
)
async def recommend(prefs: AssessmentPreferences):
    """
    Accepts the complete assessment form (Step 1 + Step 2) as JSON.

    Cost controls applied automatically:
    - Rate limited: 5 assessments per IP per hour (429 if exceeded).
    - Recommendation cache: identical preferences return a cached result instantly.
    - Model tiering: simple requests use claude-haiku-4-5; complex niche requests
      use claude-opus-4-7.
    - Fragella cache: each fragrance name is cached for 30 days in MongoDB.
    """
    try:
        results = await service.get_recommendations(prefs)
    except Exception as exc:
        print(f"[ai.router] Error during recommendation: {exc}")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results
