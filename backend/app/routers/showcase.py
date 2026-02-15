from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.supabase_client import list_showcase_rows

router = APIRouter(prefix="/showcase", tags=["showcase"])


@router.get("")
async def list_showcase(limit: int = Query(default=50, ge=1, le=200)):
    return {"items": list_showcase_rows(limit=limit)}
