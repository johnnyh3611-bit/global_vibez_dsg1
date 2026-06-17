"""
Game Rewards Queue — 72-hour escrow contract for Unity / WebGL game results.

Mirrors the JFTN escrow pattern: a finished game posts a reward; backend
queues it with status=pending, unlock_at = +72h. Admins can release / freeze
matching the JFTN admin actions.

Endpoints (per the user-supplied spec):
  POST   /api/v1/rewards/queue
  GET    /api/v1/rewards/mine
  GET    /api/v1/admin/god-mode/pending
  POST   /api/v1/admin/god-mode/freeze/{reward_id}
  POST   /api/v1/admin/god-mode/release/{reward_id}

Currency: Vibez Coins (₵). All amounts are integers.

Side-channels:
  - High-value rewards (>= ALERT_THRESHOLD) fire a Discord webhook alert.
  - generate_daily_report() summarizes the last 24h and posts to Discord.
    Scheduled from server.py startup (asyncio cron, runs daily ~08:00 UTC).
"""
import os
import logging
import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin import verify_admin

logger = logging.getLogger(__name__)
router = APIRouter()

# High-value alert threshold (₵). Configurable via env.
ALERT_THRESHOLD = float(os.environ.get("REWARDS_ALERT_THRESHOLD", "500"))
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()


class RewardRequest(BaseModel):
    game_id: str
    points: int = Field(..., ge=0)  # raw points from the game result
    multiplier: float = Field(default=1.0, gt=0, le=10)
    user_id: Optional[str] = None  # falls back to authed user
    user_wallet: Optional[str] = None  # Solana wallet for on-chain payout
    speed: Optional[str] = Field(
        default="standard",
        description="standard (5% fee, 72h hold) | instant (12% fee, 0h hold)",
    )
    metadata: Optional[Dict[str, Any]] = None


# Payout speed contract — referenced by both /v1/rewards/queue and admin
# release flow. Keep in one place so the frontend toggle, backend math,
# and admin dashboard stay in sync.
PAYOUT_SPEEDS = {
    "standard": {"fee_rate": 0.05, "delay_hours": 72},
    "instant":  {"fee_rate": 0.12, "delay_hours": 0},
}


def _serialize_reward(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["reward_id"] = doc.get("reward_id")
    for k in ("created_at", "unlock_at", "released_at", "frozen_at"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


# ───────────────────────────────────────── Discord side-channel ──

async def send_admin_alert(user_id: str, amount: float, game_id: str) -> None:
    """High-priority Discord alert for high-value rewards."""
    if not DISCORD_WEBHOOK_URL:
        logger.info(f"[rewards] HIGH-VALUE alert (no webhook): {user_id} {amount}₵ {game_id}")
        return
    payload = {
        "content": "🚨 **GOD-MODE ALERT**: High-Value Reward Detected!",
        "embeds": [{
            "title": "Suspicious Activity or High Winner",
            "color": 16711680,
            "fields": [
                {"name": "Player", "value": str(user_id), "inline": True},
                {"name": "Amount", "value": f"{int(amount)} ₵ VIBEZ", "inline": True},
                {"name": "Game", "value": str(game_id), "inline": True},
            ],
            "footer": {"text": "Action Required: Check God-Mode Dashboard"},
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(DISCORD_WEBHOOK_URL, json=payload)
    except Exception as e:
        logger.warning(f"[rewards] Discord alert failed: {e}")


async def generate_daily_report() -> Dict[str, Any]:
    """Summarize last 24 hours of game-economy activity and post to Discord."""
    db = get_database()
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)

    pipeline = [
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$group": {"_id": None, "total_vibez": {"$sum": "$reward_amount"}, "count": {"$sum": 1}}},
    ]
    stats = await db.rewards_queue.aggregate(pipeline).to_list(length=1)
    flagged_count = await db.rewards_queue.count_documents({
        "created_at": {"$gte": yesterday},
        "status": "flagged",
    })
    total_amt = stats[0]["total_vibez"] if stats else 0
    total_tx = stats[0]["count"] if stats else 0

    report = {
        "date": yesterday.strftime("%Y-%m-%d"),
        "total_rewards": total_tx,
        "total_vibez": total_amt,
        "frozen_count": flagged_count,
    }

    if DISCORD_WEBHOOK_URL:
        payload = {
            "content": "📊 **DAILY VIBEZ RECON REPORT**",
            "embeds": [{
                "title": f"Activity for {report['date']}",
                "color": 3447003,
                "fields": [
                    {"name": "Total Rewards Queued", "value": f"{total_tx} games", "inline": True},
                    {"name": "Total ₵ VIBEZ Volume", "value": f"{int(total_amt)} ₵", "inline": True},
                    {"name": "Security Flags", "value": f"🚩 {flagged_count} Frozen", "inline": False},
                ],
                "footer": {"text": "Global Vibez DSG Admin Hub"},
            }],
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(DISCORD_WEBHOOK_URL, json=payload)
        except Exception as e:
            logger.warning(f"[rewards] Daily report webhook failed: {e}")
    return report


async def daily_report_scheduler(hour_utc: int = 8):
    """Run generate_daily_report() every day at hour_utc:00 UTC."""
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
        if target <= now:
            target = target + timedelta(days=1)
        await asyncio.sleep(max(1, (target - now).total_seconds()))
        try:
            await generate_daily_report()
            logger.info("[rewards] Daily report posted")
        except Exception as e:
            logger.warning(f"[rewards] Daily report failed: {e}")


# ───────────────────────────────────────── Endpoints ──

@router.post("/v1/rewards/queue")
async def queue_reward(payload: RewardRequest, request: Request, background_tasks: BackgroundTasks):
    """Game posts a result here; we queue ₵ rewards behind a 72-hour timer."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = payload.user_id or user.user_id
    gross_coins = int(payload.points * payload.multiplier)

    # Apply payout speed (Standard = 5% / 72h | Instant = 12% / 0h)
    speed = (payload.speed or "standard").lower()
    cfg = PAYOUT_SPEEDS.get(speed, PAYOUT_SPEEDS["standard"])
    fee_amount = int(round(gross_coins * cfg["fee_rate"]))
    coins = gross_coins - fee_amount  # net amount the user actually receives

    db = get_database()
    now = datetime.now(timezone.utc)
    reward_id = f"reward_{uuid.uuid4().hex[:12]}"
    doc = {
        "reward_id": reward_id,
        "user_id": user_id,
        "user_email": user.email,
        "user_wallet": payload.user_wallet,
        "game_id": payload.game_id,
        "points": payload.points,
        "multiplier": payload.multiplier,
        "gross_amount": gross_coins,
        "fee_rate": cfg["fee_rate"],
        "fee_amount": fee_amount,
        "reward_amount": coins,        # NET coins (after fee)
        "speed": speed,
        "currency": "VBZ",
        "status": "pending",  # pending → released | flagged | completed
        "is_manually_frozen": False,
        "created_at": now,
        "unlock_at": now + timedelta(hours=cfg["delay_hours"]),
        "released_at": None,
        "frozen_at": None,
        "metadata": payload.metadata or {},
    }
    await db.rewards_queue.insert_one(doc)

    # High-value Discord alert (non-blocking)
    if coins >= ALERT_THRESHOLD:
        background_tasks.add_task(send_admin_alert, user_id, float(coins), payload.game_id)

    return {
        "status": "Queued",
        "reward_id": reward_id,
        "speed": speed,
        "gross_coins": gross_coins,
        "fee_coins": fee_amount,
        "fee_rate": cfg["fee_rate"],
        "reward_amount_coins": coins,
        "delay_hours": cfg["delay_hours"],
        "unlocks_at": doc["unlock_at"].isoformat(),
    }


@router.get("/v1/rewards/mine")
async def list_my_rewards(request: Request, limit: int = 25):
    """User's own pending/released rewards (for an in-game wallet panel)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_database()
    cursor = db.rewards_queue.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    items = [_serialize_reward(d) async for d in cursor]
    now = datetime.now(timezone.utc)
    for r in items:
        unlock = r.get("unlock_at")
        if unlock:
            try:
                unlock_dt = datetime.fromisoformat(unlock)
                r["is_ready"] = now >= unlock_dt
            except Exception:
                r["is_ready"] = False
    return {"rewards": items, "count": len(items)}


@router.get("/v1/admin/god-mode/pending")
async def admin_pending_rewards(request: Request, limit: int = 100):
    await verify_admin(request)
    db = get_database()
    cursor = db.rewards_queue.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", 1).limit(limit)
    items = [_serialize_reward(d) async for d in cursor]
    now = datetime.now(timezone.utc)
    for r in items:
        unlock = r.get("unlock_at")
        try:
            unlock_dt = datetime.fromisoformat(unlock) if unlock else None
            r["is_ready"] = unlock_dt is not None and now >= unlock_dt
        except Exception:
            r["is_ready"] = False
    return {"rewards": items, "count": len(items)}


@router.post("/v1/admin/god-mode/release/{reward_id}")
async def admin_release_reward(reward_id: str, request: Request):
    """Marks the reward as released and credits the user's vibez_coins balance."""
    admin = await verify_admin(request)
    db = get_database()
    doc = await db.rewards_queue.find_one({"reward_id": reward_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Reward not found")
    if doc.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Reward is {doc.get('status')}")
    if doc.get("is_manually_frozen"):
        raise HTTPException(status_code=409, detail="Reward is frozen — unfreeze first")

    now = datetime.now(timezone.utc)
    coins = int(doc.get("reward_amount", 0))
    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {"$inc": {"credits_balance": coins}},
    )
    await db.rewards_queue.update_one(
        {"reward_id": reward_id},
        {"$set": {
            "status": "released",
            "released_at": now,
            "released_by": getattr(admin, "user_id", None),
        }},
    )
    return {
        "status": "Released",
        "reward_id": reward_id,
        "credited_coins": coins,
    }


@router.post("/v1/admin/god-mode/freeze/{reward_id}")
async def admin_freeze_reward(reward_id: str, request: Request):
    admin = await verify_admin(request)
    db = get_database()
    doc = await db.rewards_queue.find_one({"reward_id": reward_id}, {"_id": 1, "status": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Reward not found")
    if doc.get("status") == "released":
        raise HTTPException(status_code=409, detail="Already released")
    await db.rewards_queue.update_one(
        {"reward_id": reward_id},
        {"$set": {
            "status": "flagged",
            "is_manually_frozen": True,
            "frozen_at": datetime.now(timezone.utc),
            "frozen_by": getattr(admin, "user_id", None),
        }},
    )
    return {"status": "Frozen", "reward_id": reward_id}


@router.get("/v1/admin/god-mode/daily-report")
async def admin_daily_report_now(request: Request):
    """Manually trigger / preview the daily report (admin only)."""
    await verify_admin(request)
    return await generate_daily_report()


# ───────────────────────────────────────── On-chain $DSG approval ──

VIBEZ_PAYOUT_NETWORK = os.environ.get("VIBEZ_PAYOUT_NETWORK", "devnet").strip()
VIBEZ_PAYOUT_MINT = os.environ.get("VIBEZ_TOKEN_MINT_ADDRESS", "").strip()
VIBEZ_PAYOUT_TREASURY = os.environ.get("VIBEZ_TREASURY_SECRET", "").strip()


@router.post("/v1/admin/approve-reward/{reward_id}")
async def admin_approve_and_send(reward_id: str, request: Request):
    """
    Final on-chain approval. Same pre-flight as /release (72h elapsed,
    not frozen, status=pending) PLUS triggers an on-chain $DSG transfer
    to the user's stored Solana wallet.

    Falls back to internal credit if treasury keys are not configured
    so the dashboard never bricks.
    """
    admin = await verify_admin(request)
    db = get_database()
    doc = await db.rewards_queue.find_one({"reward_id": reward_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Reward not found")

    # Security gates (mirrors user's spec)
    if doc.get("status") not in ("pending",):
        raise HTTPException(status_code=409, detail=f"Reward is {doc.get('status')}")
    if doc.get("is_manually_frozen"):
        raise HTTPException(status_code=403, detail="This reward is frozen for review")

    unlock_at = doc.get("unlock_at")
    if isinstance(unlock_at, datetime):
        # Mongo Motor returns naive datetimes; treat as UTC.
        if unlock_at.tzinfo is None:
            unlock_at = unlock_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < unlock_at:
            raise HTTPException(status_code=400, detail="72-hour window not yet expired")

    user_wallet = doc.get("user_wallet")
    coins = int(doc.get("reward_amount", 0))

    if not (user_wallet and VIBEZ_PAYOUT_MINT and VIBEZ_PAYOUT_TREASURY):
        # Soft-fall to internal credit so the dashboard still works pre-mainnet.
        await db.users.update_one(
            {"user_id": doc["user_id"]},
            {"$inc": {"credits_balance": coins}},
        )
        await db.rewards_queue.update_one(
            {"reward_id": reward_id},
            {"$set": {
                "status": "released",
                "released_at": datetime.now(timezone.utc),
                "released_by": getattr(admin, "user_id", None),
                "payout_method": "internal_credit",
            }},
        )
        return {
            "status": "Released (internal credit — no wallet/treasury configured)",
            "reward_id": reward_id,
            "credited_coins": coins,
            "tx_signature": None,
        }

    # Live on-chain mint to user's wallet via existing solana_minter.
    from services.solana_minter import mint_one
    result = await mint_one(
        recipient_wallet=user_wallet,
        amount_vibez=float(coins),
        network=VIBEZ_PAYOUT_NETWORK,
        token_mint_address=VIBEZ_PAYOUT_MINT,
        treasury_secret_b58=VIBEZ_PAYOUT_TREASURY,
    )

    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=f"On-chain transfer failed: {result.get('error')}")

    await db.rewards_queue.update_one(
        {"reward_id": reward_id},
        {"$set": {
            "status": "completed",
            "released_at": datetime.now(timezone.utc),
            "released_by": getattr(admin, "user_id", None),
            "payout_method": "solana_onchain",
            "tx_signature": result.get("signature"),
            "network": VIBEZ_PAYOUT_NETWORK,
        }},
    )
    return {
        "status": "Success",
        "reward_id": reward_id,
        "tx_signature": result.get("signature"),
        "network": VIBEZ_PAYOUT_NETWORK,
        "credited_coins": coins,
    }


# ───────────────────────────────────────── WebAuthn hardware-key gate ──

WEBAUTHN_RP_ID = os.environ.get("WEBAUTHN_RP_ID", "").strip()
WEBAUTHN_ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "").strip()
WEBAUTHN_ADMIN_PUBLIC_KEY = os.environ.get("WEBAUTHN_ADMIN_PUBLIC_KEY", "").strip()


class WebAuthnApprovePayload(BaseModel):
    auth_response: Dict[str, Any]
    expected_challenge: Optional[str] = None
    last_sign_count: Optional[int] = 0


@router.post("/v1/admin/approve-with-hardware/{reward_id}")
async def admin_approve_with_hardware(
    reward_id: str, payload: WebAuthnApprovePayload, request: Request
):
    """
    Final security gate: requires a physical tap on a registered hardware
    key (Titan, YubiKey, etc.). Verifies the WebAuthn assertion, then
    delegates to admin_approve_and_send() for the on-chain transfer.

    SCAFFOLD: Returns a clear 501 until WEBAUTHN_RP_ID + WEBAUTHN_ORIGIN +
    WEBAUTHN_ADMIN_PUBLIC_KEY are configured AND the `webauthn` Python lib
    is installed (pip install webauthn).
    """
    await verify_admin(request)

    if not (WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN and WEBAUTHN_ADMIN_PUBLIC_KEY):
        raise HTTPException(
            status_code=501,
            detail=(
                "Hardware approval not configured. Set WEBAUTHN_RP_ID, "
                "WEBAUTHN_ORIGIN, and WEBAUTHN_ADMIN_PUBLIC_KEY in backend/.env "
                "and install the `webauthn` package."
            ),
        )

    try:
        from webauthn import verify_authentication_response  # type: ignore
        from webauthn.helpers.structs import AuthenticationCredential  # type: ignore
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="webauthn package not installed. `pip install webauthn` to enable.",
        )

    try:
        verify_authentication_response(
            credential=AuthenticationCredential.parse_obj(payload.auth_response),
            expected_challenge=(payload.expected_challenge or "").encode(),
            expected_origin=WEBAUTHN_ORIGIN,
            expected_rp_id=WEBAUTHN_RP_ID,
            credential_public_key=WEBAUTHN_ADMIN_PUBLIC_KEY.encode(),
            credential_current_sign_count=payload.last_sign_count or 0,
        )
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Hardware verification failed: {e}")

    return await admin_approve_and_send(reward_id, request)
