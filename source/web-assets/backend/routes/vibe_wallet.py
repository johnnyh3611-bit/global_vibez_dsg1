"""
Vibe Wallet System - Digital Wallet for Dice Game Credits
Handles wallet balance, top-ups via Stripe, and transaction history
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

router = APIRouter()

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv('DB_NAME', 'globalvibez')]

# Pydantic Models
class WalletResponse(BaseModel):
    user_id: str
    balance: float
    currency: str = "USD"
    created_at: str
    updated_at: str

class WalletTransaction(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    transaction_type: str  # "credit", "debit", "stripe_topup", "dice_payout"
    description: str
    balance_after: float
    created_at: str
    metadata: Optional[dict] = None

class TopUpPackage(BaseModel):
    package_id: str
    origin_url: str

# Fixed top-up packages (prevent price manipulation)
TOPUP_PACKAGES = {
    "starter": {"amount": 10.0, "bonus": 0, "display": "$10"},
    "bronze": {"amount": 25.0, "bonus": 5, "display": "$25 + $5 Bonus"},
    "silver": {"amount": 50.0, "bonus": 15, "display": "$50 + $15 Bonus"},
    "gold": {"amount": 100.0, "bonus": 50, "display": "$100 + $50 Bonus"},
    "platinum": {"amount": 250.0, "bonus": 150, "display": "$250 + $150 Bonus"},
}

# Helper Functions
async def get_wallet(user_id: str) -> dict:
    """Get or create wallet for user"""
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    
    if not wallet:
        # Create new wallet
        wallet = {
            "user_id": user_id,
            "balance": 0.0,
            "currency": "USD",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallets.insert_one(wallet)
    
    return wallet

async def credit_wallet(user_id: str, amount: float, description: str, metadata: Optional[dict] = None) -> dict:
    """Credit user's wallet and record transaction"""
    wallet = await get_wallet(user_id)
    
    new_balance = wallet["balance"] + amount
    
    # Update wallet balance
    await db.wallets.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "balance": new_balance,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Record transaction
    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "transaction_type": "credit",
        "description": description,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
    
    await db.wallet_transactions.insert_one(transaction)
    
    return {
        "user_id": user_id,
        "balance": new_balance,
        "amount_credited": amount,
        "transaction_id": transaction["transaction_id"]
    }

async def debit_wallet(user_id: str, amount: float, description: str, metadata: Optional[dict] = None) -> dict:
    """Debit user's wallet (for placing bets)"""
    wallet = await get_wallet(user_id)
    
    if wallet["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    new_balance = wallet["balance"] - amount
    
    # Update wallet balance
    await db.wallets.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "balance": new_balance,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Record transaction
    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "transaction_type": "debit",
        "description": description,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
    
    await db.wallet_transactions.insert_one(transaction)
    
    return {
        "user_id": user_id,
        "balance": new_balance,
        "amount_debited": amount,
        "transaction_id": transaction["transaction_id"]
    }

# API Endpoints
@router.get("/balance/{user_id}")
async def get_wallet_balance(user_id: str) -> Dict[str, Any]:
    """Get user's current wallet balance"""
    wallet = await get_wallet(user_id)
    return {
        "success": True,
        "user_id": wallet["user_id"],
        "balance": wallet["balance"],
        "currency": wallet["currency"]
    }

@router.post("/credit/{user_id}")
async def manual_credit_wallet(user_id: str, amount: float = 1000) -> Dict[str, Any]:
    """Manual wallet credit for testing/demo purposes"""
    result = await credit_wallet(
        user_id=user_id,
        amount=amount,
        description=f"Demo credits: ${amount}",
        metadata={"type": "demo_credit"}
    )
    return {
        "success": True,
        "message": f"Added ${amount} to wallet",
        **result
    }

@router.get("/transactions/{user_id}")
async def get_transaction_history(user_id: str, limit: int = 20) -> Dict[str, Any]:
    """Get user's transaction history"""
    transactions = await db.wallet_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "transactions": transactions
    }

@router.get("/packages")
async def get_topup_packages() -> Dict[str, Any]:
    """Get available top-up packages"""
    packages = []
    for package_id, details in TOPUP_PACKAGES.items():
        packages.append({
            "package_id": package_id,
            "amount": details["amount"],
            "bonus": details["bonus"],
            "total": details["amount"] + details["bonus"],
            "display": details["display"],
            "popular": package_id == "gold"
        })
    
    return {
        "success": True,
        "packages": packages
    }

@router.post("/topup/create-session")
async def create_topup_session(package: TopUpPackage, request: Request) -> Dict[str, Any]:
    """Create Stripe checkout session for wallet top-up"""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
    )
    from config import STRIPE_API_KEY
    
    # Validate package
    if package.package_id not in TOPUP_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    # Get package details from server (prevent price manipulation)
    package_details = TOPUP_PACKAGES[package.package_id]
    amount = package_details["amount"]
    bonus = package_details["bonus"]
    total_credits = amount + bonus
    
    # Get current user (you can add auth here)
    # For now, we'll use demo user or extract from session
    user_id = "demo_user_wallet"  # Replace with actual auth
    
    # Build success and cancel URLs
    success_url = f"{package.origin_url}/wallet/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{package.origin_url}/wallet"
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/wallet/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create metadata
    metadata = {
        "user_id": user_id,
        "package_id": package.package_id,
        "base_amount": str(amount),
        "bonus_amount": str(bonus),
        "total_credits": str(total_credits),
        "type": "wallet_topup"
    }
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create pending payment transaction
    payment_transaction = {
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_id": session.session_id,
        "package_id": package.package_id,
        "amount": amount,
        "bonus": bonus,
        "total_credits": total_credits,
        "currency": "usd",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata
    }
    
    await db.payment_transactions.insert_one(payment_transaction)
    
    return {
        "success": True,
        "checkout_url": session.url,
        "session_id": session.session_id
    }

@router.get("/topup/status/{session_id}")
async def check_topup_status(session_id: str, request: Request) -> Dict[str, Any]:
    """Check Stripe payment status and credit wallet if successful"""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutStatusResponse
    )
    from config import STRIPE_API_KEY
    
    # Find transaction
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return status
    if transaction["payment_status"] == "paid":
        return {
            "success": True,
            "status": "complete",
            "payment_status": "paid",
            "message": "Credits already added to wallet"
        }
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/wallet/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Check payment status
    try:
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "payment_status": checkout_status.payment_status,
                    "status": checkout_status.status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # If payment successful and not already credited
        if checkout_status.payment_status == "paid" and transaction["payment_status"] != "paid":
            # Credit wallet with base amount + bonus
            total_credits = transaction["total_credits"]
            user_id = transaction["user_id"]
            
            await credit_wallet(
                user_id=user_id,
                amount=total_credits,
                description=f"Wallet top-up: {transaction['package_id']} package",
                metadata={
                    "session_id": session_id,
                    "package_id": transaction["package_id"],
                    "base_amount": transaction["amount"],
                    "bonus_amount": transaction["bonus"]
                }
            )
        
        return {
            "success": True,
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "credits_added": transaction["total_credits"] if checkout_status.payment_status == "paid" else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")

@router.post("/webhook")
async def stripe_webhook_handler(request: Request) -> Dict[str, Any]:
    """Handle Stripe webhook events for wallet top-ups"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    from config import STRIPE_API_KEY
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        # Initialize Stripe
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/wallet/webhook"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process successful payments
        if webhook_response.event_type in ["checkout.session.completed", "payment_intent.succeeded"]:
            session_id = webhook_response.session_id
            metadata = webhook_response.metadata
            
            # Find transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            
            if transaction and transaction["payment_status"] != "paid":
                # Credit wallet
                user_id = metadata.get("user_id")
                total_credits = float(metadata.get("total_credits", 0))
                
                if user_id and total_credits > 0:
                    await credit_wallet(
                        user_id=user_id,
                        amount=total_credits,
                        description=f"Stripe top-up: {metadata.get('package_id')}",
                        metadata={
                            "session_id": session_id,
                            "stripe_event": webhook_response.event_type
                        }
                    )
                    
                    # Update transaction
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {
                                "payment_status": "paid",
                                "processed_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
