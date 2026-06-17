"""
TGE (Token Generation Event) admin + user routes for $DSG.

Base URL: /api/tge

All admin endpoints require the `admin_session` vault cookie.
User-facing opt-in endpoint requires the session cookie.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any

from utils.database import get_database
from services.tge_service import (
    TGEConfig,
    build_eligible_cohort,
    dry_run_mint_batch,
    execute_mint_batch,
    list_batches,
    get_batch,
    set_user_tge_opt_in,
)

router = APIRouter(prefix="/tge", tags=["tge"])


def _require_admin(request: Request) -> None:
    if not request.cookies.get("admin_session"):
        raise HTTPException(403, "Admin only")


async def _resolve_user_id(request: Request) -> str:
    session_token = request.cookies.get("session_token")
    if session_token:
        doc = await get_database().user_sessions.find_one(
            {"session_token": session_token}, {"user_id": 1, "_id": 0}
        )
        if doc:
            return doc["user_id"]
    uid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if uid:
        return uid
    raise HTTPException(401, "Not authenticated")


# ==================== CONFIG ====================

@router.get("/config")
async def get_config() -> Dict[str, Any]:
    cfg = TGEConfig.snapshot()
    # Include a best-effort RPC readiness probe for live modes.
    if cfg["mode"] in ("devnet", "mainnet-beta"):
        try:
            from services.solana_minter import ping_rpc
            cfg["rpc_health"] = await ping_rpc(cfg["mode"])
        except Exception as e:
            cfg["rpc_health"] = {"ok": False, "error": str(e)}
    return cfg


# ==================== ADMIN ====================

@router.get("/admin/cohort")
async def admin_cohort(request: Request, min_vibez: Optional[float] = None) -> Dict[str, Any]:
    _require_admin(request)
    cohort = await build_eligible_cohort(get_database(), min_vibez)
    return {
        "config": TGEConfig.snapshot(),
        "cohort_size": len(cohort),
        "rows": cohort,
    }


@router.get("/admin/dry-run")
async def admin_dry_run(request: Request, min_vibez: Optional[float] = None) -> Dict[str, Any]:
    _require_admin(request)
    return await dry_run_mint_batch(get_database(), min_vibez)


class ExecuteMintRequest(BaseModel):
    min_vibez: Optional[float] = None
    confirm: bool = False


@router.post("/admin/execute-mint")
async def admin_execute_mint(req: ExecuteMintRequest, request: Request) -> Dict[str, Any]:
    _require_admin(request)
    if not req.confirm:
        raise HTTPException(400, "Set confirm=true to execute a mint batch")
    try:
        return await execute_mint_batch(
            get_database(),
            min_vibez=req.min_vibez,
            initiated_by="founder",
        )
    except NotImplementedError as e:
        raise HTTPException(501, str(e))


@router.get("/admin/batches")
async def admin_list_batches(request: Request, limit: int = 50) -> Dict[str, Any]:
    _require_admin(request)
    rows = await list_batches(get_database(), limit=limit)
    return {"batches": rows, "count": len(rows)}


@router.get("/admin/batch/{batch_id}")
async def admin_get_batch(batch_id: str, request: Request) -> Dict[str, Any]:
    _require_admin(request)
    doc = await get_batch(get_database(), batch_id)
    if not doc:
        raise HTTPException(404, "Batch not found")
    return {"batch": doc}


# ==================== USER ====================

class OptInRequest(BaseModel):
    wallet: str = ""
    opt_in: bool = True


@router.post("/me/opt-in")
async def me_opt_in(req: OptInRequest, request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    try:
        return await set_user_tge_opt_in(get_database(), user_id, req.wallet, req.opt_in)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/me/status")
async def me_status(request: Request) -> Dict[str, Any]:
    user_id = await _resolve_user_id(request)
    db = get_database()
    user = await db.users.find_one(
        {"user_id": user_id},
        {"user_id": 1, "solana_wallet_address": 1, "tge_opt_in": 1, "_id": 0},
    ) or {"user_id": user_id, "solana_wallet_address": "", "tge_opt_in": False}
    bal = await db.vibez_mining_balance.find_one({"user_id": user_id}, {"_id": 0})
    total = 0.0
    if bal:
        total = float(bal.get("pending_balance", 0) or 0) + float(bal.get("balance", 0) or 0)
    return {
        "user": user,
        "total_vibez": round(total, 2),
        "config": TGEConfig.snapshot(),
    }
