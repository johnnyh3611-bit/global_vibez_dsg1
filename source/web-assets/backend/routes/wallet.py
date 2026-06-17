from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
from source.web-assets.backend.services.payment_hub import StripeCheckout, CheckoutSessionRequest
from services.pricing_master_vault import (
    PACKS as MASTER_VAULT_PACKS,
    list_packs as list_master_vault_packs,
    derive_user_tier,
    is_pack_purchasable,
    USD_TO_CREDITS_RATE,
    DSG_BRIDGE_RATIO,
)
import uuid
import os

router = APIRouter(prefix="/wallet", tags=["wallet"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# ==================== MODELS ====================

class CreditPackage(BaseModel):
    package_id: str
    name: str
    usd_amount: float
    credit_amount: float
    bonus_credits: float
    popular: bool = False

class PurchaseCredits(BaseModel):
    package_id: str
    success_url: str
    cancel_url: str

class TransferCredits(BaseModel):
    recipient_user_id: str
    amount: float
    message: Optional[str] = None


# ==================== CREDIT PACKAGES (Pricing Master Vault v1.0) ====================
# Spec source: services/pricing_master_vault.py
# This file routes the "Vibe Credits" product (6-pack ladder, $1 → $100)
# whose internal rate is fixed at $1 USD = 2,500 ₵ credits · 4:1 DSG bridge.
# That is INTENTIONALLY DIFFERENT from the Vibez Coins ₵ top-up product
# (services/coin_wallet.py · COINS_PER_USD = 1,000 as of 2026-05-18).
# Two products, two rates — do not collapse without founder approval.

CREDIT_PACKAGES = {
    pid: {
        "package_id":    pack["pack_id"],
        "name":          pack["name"],
        "usd_amount":    pack["usd_amount"],
        "credit_amount": pack["credits"],
        "bonus_credits": pack["bonus_credits"],
        "dsg_bridge":    pack["dsg_bridge"],
        "perk":          pack["perk"],
        "min_tier":      pack["min_tier"],
        "popular":       pack.get("popular", False),
    }
    for pid, pack in MASTER_VAULT_PACKS.items()
}


# ==================== ENDPOINTS ====================

@router.get("/packages")
async def get_credit_packages() -> Dict[str, Any]:
    """Get all available credit packages"""
    return {"packages": list(CREDIT_PACKAGES.values())}


@router.get("/balance")
async def get_balance(request: Request) -> Dict[str, Any]:
    """Get current credit balance"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "user_id": current_user.user_id,
        "credit_balance": user.get("credit_balance", 0.0)
    }


@router.post("/purchase")
async def purchase_credits(purchase_data: PurchaseCredits, request: Request) -> Dict[str, Any]:
    """Initiate credit purchase via Stripe (Pricing Master Vault v1.0 — tier-gated)."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get package details
    package = CREDIT_PACKAGES.get(purchase_data.package_id)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    # ── Tier gating per Pricing Master Vault v1.0 ──
    db = get_database()
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0}) or {}
    user_tier = derive_user_tier(user_doc)
    lifetime_dsg = int(user_doc.get("lifetime_dsg_acquired", 0) or 0)
    legacy_count = int(user_doc.get("legacy_vault_purchase_count", 0) or 0)
    
    allowed, reason = is_pack_purchasable(
        purchase_data.package_id, user_tier,
        lifetime_dsg_acquired=lifetime_dsg,
        legacy_vault_purchase_count=legacy_count,
    )
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)
    
    # Create Stripe checkout session
    stripe_client = StripeCheckout(api_key=STRIPE_API_KEY)
    
    session_request = CheckoutSessionRequest(
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(package["usd_amount"] * 100),
                "product_data": {
                    "name": f"Global Vibez DSG · {package['name']}",
                    "description": (
                        f"{int(package['credit_amount']):,} ₵ Vibe Credits "
                        f"+ {int(package['dsg_bridge']):,} $DSG bridge allocation. "
                        f"Perk: {package['perk']}"
                    )
                }
            },
            "quantity": 1
        }],
        mode="payment",
        success_url=purchase_data.success_url,
        cancel_url=purchase_data.cancel_url,
        metadata={
            "user_id":      current_user.user_id,
            "package_id":   purchase_data.package_id,
            "credit_amount": str(package["credit_amount"]),
            "dsg_bridge":   str(package["dsg_bridge"]),
            "type":         "credit_purchase",
        }
    )
    
    response = stripe_client.create_session(session_request)
    
    return {
        "session_id":   response.id,
        "checkout_url": response.url,
        "package":      package,
        "user_tier":    user_tier,
    }


@router.post("/purchase/complete")
async def complete_credit_purchase(session_id: str, request: Request) -> Dict[str, Any]:
    """Complete credit purchase after Stripe payment"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify Stripe session
    stripe_client = StripeCheckout(api_key=STRIPE_API_KEY)
    session = stripe_client.get_session_status(session_id)
    
    if session.status != "complete":
        raise HTTPException(status_code=400, detail="Payment not completed")
    
    metadata = session.metadata
    if metadata.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    credit_amount = float(metadata.get("credit_amount", 0))
    dsg_bridge = int(float(metadata.get("dsg_bridge", 0) or 0))
    package_id = metadata.get("package_id")
    package = CREDIT_PACKAGES.get(package_id)
    
    db = get_database()
    
    # Check if already processed
    existing_transaction = await db.transactions.find_one({
        "reference_id": session_id,
        "type": "purchase"
    }, {"_id": 0})
    
    if existing_transaction:
        return {"message": "Already processed", "transaction": existing_transaction}
    
    # Add credits + record DSG bridge entitlement on the user record
    user_update: Dict[str, Any] = {
        "$inc": {
            "credit_balance":         credit_amount,
            "lifetime_dsg_acquired":  dsg_bridge,
            "pending_dsg_at_tge":     dsg_bridge,
        },
        "$push": {"lifetime_pack_purchases": package_id},
    }
    # Architect ($20) activates the 5% network mining override / ambassador status
    if package_id == "architect":
        user_update.setdefault("$set", {})["is_ambassador"] = True
        user_update["$set"]["mining_override_pct"] = 0.05
    if package_id == "legacy_vault":
        user_update["$inc"]["legacy_vault_purchase_count"] = 1
    
    await db.users.update_one({"user_id": current_user.user_id}, user_update)
    
    # Create transaction record
    transaction = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id":        current_user.user_id,
        "type":           "purchase",
        "amount":         credit_amount,
        "dsg_bridge":     dsg_bridge,
        "currency_amount": package["usd_amount"],
        "package_id":     package_id,
        "perk":           package.get("perk", ""),
        "description":    f"Purchased {package['name']} (+{int(dsg_bridge):,} $DSG at TGE)",
        "reference_id":   session_id,
        "created_at":     datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    # Get updated balance
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "message": "Credits added successfully",
        "credits_added": credit_amount,
        "new_balance": user.get("credit_balance", 0),
        "transaction": transaction
    }


@router.get("/transactions")
async def get_transactions(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get user's transaction history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    transactions = await db.transactions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"transactions": transactions}


@router.post("/transfer")
async def transfer_credits(transfer_data: TransferCredits, request: Request) -> Dict[str, Any]:
    """Transfer credits to another user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check sender balance
    sender = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if sender.get("credit_balance", 0) < transfer_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient credits")
    
    # Check recipient exists
    recipient = await db.users.find_one({"user_id": transfer_data.recipient_user_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Deduct from sender
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"credit_balance": -transfer_data.amount}}
    )
    
    # Add to recipient
    await db.users.update_one(
        {"user_id": transfer_data.recipient_user_id},
        {"$inc": {"credit_balance": transfer_data.amount}}
    )
    
    # Create transactions
    sender_txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "type": "gift_sent",
        "amount": -transfer_data.amount,
        "description": f"Sent {transfer_data.amount} credits to {recipient['name']}",
        "reference_id": transfer_data.recipient_user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    recipient_txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": transfer_data.recipient_user_id,
        "type": "gift_received",
        "amount": transfer_data.amount,
        "description": f"Received {transfer_data.amount} credits from {sender['name']}",
        "reference_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_many([sender_txn, recipient_txn])
    
    # Get updated balance
    updated_sender = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "message": "Credits transferred successfully",
        "amount": transfer_data.amount,
        "recipient": recipient["name"],
        "new_balance": updated_sender.get("credit_balance", 0)
    }
