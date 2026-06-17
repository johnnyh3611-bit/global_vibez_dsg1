"""
Rewards / Gift Redemption — Pillar 2

Reframes "cashout" language as "Appreciation Gift redemption" with the
72-hour 'Vibe Check' safety window. Express = 12% convenience fee,
Standard = 5%. Does NOT touch real-money rails — payouts go into the
existing Vibez Coins (₵) gift-card/merch rails that the user said were
already set up and to be revisited at launch.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta

from utils.database import get_current_user, get_database

router = APIRouter(prefix="/rewards", tags=["rewards"])


class GiftRedemptionRequest(BaseModel):
    reward_amount: float  # $DSG amount the user wants to redeem
    is_express: bool = False


@router.post("/redeem-gift")
async def redeem_gift(data: GiftRedemptionRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    bal = await db.vibez_mining_balance.find_one({"user_id": user.user_id}, {"_id": 0})
    available = (bal or {}).get("balance", 0.0)

    if data.reward_amount <= 0:
        raise HTTPException(status_code=400, detail="Reward amount must be positive")
    if data.reward_amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient $DSG. Available: {available:.2f}",
        )

    service_fee = 0.12 if data.is_express else 0.05
    net_value = round(data.reward_amount * (1 - service_fee), 2)

    now = datetime.now(timezone.utc)
    ready_date = now if data.is_express else (now + timedelta(hours=72))

    # Decrement from available balance and log a redemption event
    await db.vibez_mining_balance.update_one(
        {"user_id": user.user_id},
        {"$inc": {"balance": -data.reward_amount, "lifetime_redeemed": data.reward_amount}},
    )
    await db.vibez_redemptions.insert_one({
        "user_id": user.user_id,
        "gross_vibez": data.reward_amount,
        "service_fee_pct": service_fee,
        "net_value": net_value,
        "is_express": data.is_express,
        "reward_status": "Processing Appreciation Gift",
        "redeemable_on": ready_date.isoformat(),
        "created_at": now.isoformat(),
    })

    return {
        "reward_status": "Processing Appreciation Gift",
        "net_value": net_value,
        "gross_vibez": data.reward_amount,
        "redeemable_on": ready_date.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "platform_contribution": f"{int(service_fee * 100)}%",
        "note": (
            "Express gifts are available immediately. Standard gifts complete their "
            "72-hour Vibe Check before becoming redeemable."
        ),
    }


@router.get("/my-redemptions")
async def my_redemptions(request: Request, limit: int = 25):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    rows = await db.vibez_redemptions.find(
        {"user_id": user.user_id}, {"_id": 0},
    ).sort("created_at", -1).limit(min(100, max(1, limit))).to_list(length=limit)
    return {"count": len(rows), "redemptions": rows}
