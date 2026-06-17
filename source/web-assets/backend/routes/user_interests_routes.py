"""
User self-serve interests endpoint — powers the Affinity Engine.

Lightweight by design: pure read/write on the users collection. No
side effects, no Recirculation impact. The Plex Room calls this
best-effort after the user picks their first tag set.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import db
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/users", tags=["user-interests"])


class InterestsRequest(BaseModel):
    interests: List[str] = Field(default_factory=list, max_length=24)


@router.put("/me/interests")
async def put_my_interests(
    body: InterestsRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    # Normalize: lowercase, dedupe, strip empties, cap at 24.
    normalized = sorted({
        s.strip().lower()
        for s in body.interests
        if isinstance(s, str) and s.strip()
    })[:24]
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "interests": normalized,
            "interests_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=False,
    )
    return {"ok": True, "interests": normalized}


@router.get("/me/interests")
async def get_my_interests(
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    row = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "interests": 1},
    )
    return {"ok": True, "interests": (row or {}).get("interests", [])}
