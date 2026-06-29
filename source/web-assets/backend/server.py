import firebase_admin
from unittest.mock import MagicMock
firebase_admin.initialize_app = MagicMock(return_value=MagicMock())
firebase_admin.credentials = MagicMock()
import firebase_admin
from unittest.mock import MagicMock
firebase_admin.initialize_app = MagicMock()
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
import logging

logger = logging.getLogger(__name__)
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from pydantic import BaseModel, Field, ConfigDict
from services.payment_hub import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from services.ai_engine import LlmChat, UserMessage

# Import configuration modules
from config import db, setup_middleware, STRIPE_API_KEY, EMERGENT_LLM_KEY
from websocket_server import sio, socket_app
# Route registry — all 130+ feature routers live in routes/registry.py.
# server.py only keeps the imports it actually CALLS at runtime.
from routes.registry import register_all_routes
from services.multiplayer import socketio_app, get_multiplayer_stats

# Initialize shared database for route modules  
from utils.database import initialize_database
from config.settings import MONGO_URL, DB_NAME
initialize_database(MONGO_URL, DB_NAME)

# Create the main app
app = FastAPI()

# Setup middleware (CORS, etc.)
app = setup_middleware(app)


# ─────────────────────────── Kubernetes liveness/readiness probe
#
# Emergent's Kubernetes ingress hits plain `/health` (NOT `/api/health`)
# from `127.0.0.1` for liveness/readiness checks. After enough 404s the
# pod is killed and the deploy fails. We expose a tiny no-DB endpoint at
# the ROOT of the app so the probe always sees 200 OK as long as uvicorn
# is alive — no MongoDB / Redis / external-service round trips, so a
# blip in any dependency can't fail the probe and tank the rollout.
@app.get("/health", include_in_schema=False)
async def _k8s_health_probe() -> Dict[str, str]:
    """Liveness/readiness probe — process-only health (no I/O)."""
    return {"status": "ok"}


# ─── Security Directive D1 — Sandbox Firewall (2026-05-18) ─────────
# Global unhandled-exception handler. Implementation lives in
# `utils.sandbox_firewall` so the bottom-of-stack policy is one line
# here and the rest of `server.py` stays focused on app + routing.
from utils.sandbox_firewall import install as _install_sandbox_firewall  # noqa: E402
_install_sandbox_firewall(app, db, logger)


# Mirror it under /api/ as well so the same path works through the
# external ingress (which strips /api before forwarding) AND from any
# in-cluster client that hits the api prefix directly.
@app.get("/api/health", include_in_schema=False)
async def _api_health_probe() -> Dict[str, str]:
    return {"status": "ok"}


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== MODELS ====================

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


class UserPreferences(BaseModel):
    min_age: int = 18
    max_age: int = 99
    max_distance: int = 50  # in miles/km
    interested_in: str = "everyone"  # "men", "women", "everyone"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    email: str
    name: str
    password_hash: Optional[str] = None  # For email/password auth
    auth_provider: str = "google"  # "google" or "email"
    picture: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    interests: List[str] = []
    photos: List[str] = []
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    membership_type: str = "free"  # "free" or "premium"
    swipes_today: int = 0
    swipes_limit: int = 20
    last_swipe_reset: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    profile_completed: bool = False
    referral_code: Optional[str] = None  # User's unique referral code
    referred_by: Optional[str] = None  # Who referred this user
    referral_count: int = 0  # How many people they referred
    premium_expires_at: Optional[datetime] = None  # When premium expires (for referral rewards)
    relationship_intent: Optional[str] = None  # What they're looking for
    interest_categories: List[str] = []  # Interest-based categories
    
    # Subscription & Credits
    subscription_tier: Optional[str] = None
    subscription_end_date: Optional[str] = None
    credits_balance: Optional[int] = None
    
    # Age Verification
    age_verified: Optional[bool] = None
    verification_status: Optional[str] = None
    date_of_birth: Optional[str] = None
    
    # Driver License Verification
    is_driver_verified: Optional[bool] = None
    driver_license_status: Optional[str] = None
    driver_license_number: Optional[str] = None
    license_expiry_date: Optional[str] = None
    driver_license_state: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    interests: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    preferences: Optional[UserPreferences] = None
    relationship_intent: Optional[str] = None
    interest_categories: Optional[List[str]] = None

class SessionData(BaseModel):
    session_id: str

class Swipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    swipe_id: str = Field(default_factory=lambda: f"swipe_{uuid.uuid4().hex[:12]}")
    user_id: str
    target_user_id: str
    action: str  # "like" or "dislike"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SwipeAction(BaseModel):
    target_user_id: str
    action: str  # "like" or "dislike"

class Match(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    match_id: str = Field(default_factory=lambda: f"match_{uuid.uuid4().hex[:12]}")
    user_id_1: str
    user_id_2: str
    both_ids: List[str]  # For easy querying
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MatchResponse(BaseModel):
    is_match: bool
    match_id: Optional[str] = None
    matched_user: Optional[User] = None

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentPackage(BaseModel):
    package_id: str
    origin_url: str

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id: str
    session_id: str
    amount: float
    currency: str
    payment_status: str  # "pending", "paid", "failed", "expired"
    metadata: Dict[str, str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    match_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    receiver_id: str
    content: str

class Conversation(BaseModel):
    match_id: str
    other_user: User
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0

class TranslateRequest(BaseModel):
    text: str
    target_language: Optional[str] = None  # If None, auto-detect and translate to English

class ReferralApply(BaseModel):
    referral_code: str


# ==================== HELPER FUNCTIONS ====================

def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code for a user"""
    return f"GV{user_id[:8].upper()}"

async def get_current_user(request: Request) -> Optional[User]:
    """Extract user from session token (Authorization header or cookie).

    Order of preference: ``Authorization: Bearer …`` first, then the
    ``session_token`` cookie. The Bearer-first ordering is critical —
    otherwise a stale cookie left over from a previous Google sign-in
    (or a logged-out flow that didn't clear cookies) will short-circuit
    the lookup, fail the DB check, and return None even though the
    user's freshly-minted Bearer token is perfectly valid. Symptom:
    user clicks "Demo Login", gets a 200 from /api/auth/demo-login,
    redirects to /dashboard, but /api/auth/me 401s and bounces them
    straight back to /login.

    If the Bearer doesn't resolve to a valid session, we still try the
    cookie below — so users who *only* have a cookie (Emergent Auth
    flow that didn't write to localStorage) still authenticate.
    """
    candidates: list[str] = []

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        bearer = auth_header.removeprefix("Bearer ").strip()
        if bearer:
            candidates.append(bearer)

    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        candidates.append(cookie_token)

    if not candidates:
        return None

    for session_token in candidates:
        # Find session in database
        session_doc = await db.user_sessions.find_one(
            {"session_token": session_token}, {"_id": 0}
        )
        if not session_doc:
            continue

        # Check expiry
        expires_at = session_doc["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            # Session expired — clean it up and try the next candidate.
            await db.user_sessions.delete_one({"session_token": session_token})
            continue

        # Get user data
        user_doc = await db.users.find_one(
            {"user_id": session_doc["user_id"]}, {"_id": 0}
        )
        if not user_doc:
            continue

        return User(**user_doc)

    return None




# ==================== DEMO/TEST AUTH ====================

@api_router.post("/auth/demo-login")
async def demo_login(response: Response, fresh: bool = False):
    """Quick demo login for testing - creates/uses demo user.

    Set `?fresh=1` to mint a brand-new throwaway demo user every call so
    cross-user invite + multi-account scenarios can be exercised end-to-end.
    """

    demo_email = "demo@globalvibez.com"

    if fresh:
        # Always mint a fresh user. Doesn't pollute the canonical demo
        # account; useful for invite cross-user testing + load tests.
        user_id = f"demo_{uuid.uuid4().hex[:8]}"
        demo_user = {
            "user_id": user_id,
            "email": f"demo_{user_id}@globalvibez.com",
            "name": f"Fresh Demo {user_id[-6:]}",
            "picture": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}",
            "bio": "Throwaway demo user (?fresh=1)",
            "age": 25,
            "gender": "other",
            "location": "Global",
            "interests": ["gaming"],
            "photos": [],
            "preferences": UserPreferences().model_dump(),
            "membership_type": "premium",
            "swipes_today": 0,
            "swipes_limit": 999,
            "last_swipe_reset": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "profile_completed": True,
            "referral_code": f"FRESH-{user_id[-4:].upper()}",
            "referred_by": None,
            "referral_count": 0,
            "premium_expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "is_throwaway_demo": True,
            # Starter Vibez Coins so the user can immediately try paid AAA
            # rooms (Baccarat, Blackjack, Roulette) without manual seeding.
            "credits_balance": 5000,
        }
        await db.users.insert_one(demo_user)
    else:
        # Check if canonical demo user exists
        demo_user = await db.users.find_one({"email": demo_email}, {"_id": 0})

        if not demo_user:
            # Create demo user
            user_id = f"demo_{uuid.uuid4().hex[:8]}"
            demo_user = {
                "user_id": user_id,
                "email": demo_email,
                "name": "Demo User",
                "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=demo",
                "bio": "Testing Global Vibez DSG games!",
                "age": 25,
                "gender": "other",
                "location": "Global",
                "interests": ["gaming", "dating", "socializing"],
                "photos": [],
                "preferences": UserPreferences().model_dump(),
                "membership_type": "premium",  # Give demo user premium access
                "swipes_today": 0,
                "swipes_limit": 999,
                "last_swipe_reset": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "profile_completed": True,  # Skip profile setup
                "referral_code": "DEMO2026",
                "referred_by": None,
                "referral_count": 0,
                "premium_expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                # Starter Vibez Coins so paid AAA rooms (Baccarat etc.)
                # work immediately on a fresh DB without manual seeding.
                "credits_balance": 5000,
            }
            await db.users.insert_one(demo_user)
            user_id = demo_user["user_id"]
        else:
            user_id = demo_user["user_id"]
            # Top-up to 5000 if the canonical demo user pre-dated the
            # starter-grant (legacy DBs may have credits_balance = 0).
            if demo_user.get("credits_balance", 0) < 1000:
                await db.users.update_one(
                    {"email": demo_email},
                    {"$set": {"credits_balance": 5000}},
                )
    
    # Create session token
    session_token = f"demo_session_{uuid.uuid4().hex}"
    
    # Store session
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=30*24*60*60
    )
    
    return {
        "user_id": user_id,
        "email": demo_user.get("email") if fresh else demo_email,
        "name": demo_user.get("name") if fresh else "Demo User",
        "profile_completed": True,
        "token": session_token,  # ✅ CORS FIX: Return token in response
        "fresh": fresh,
        "message": "Demo login successful! You can now test all games."
    }


@api_router.post("/auth/test-user")
async def create_test_user(response: Response):
    """Create a unique test user for automated testing (dual-bot system)"""
    
    # Create unique test user
    user_id = f"test_{uuid.uuid4().hex[:12]}"
    test_email = f"test_{uuid.uuid4().hex[:8]}@globalvibez.com"
    
    test_user = {
        "user_id": user_id,
        "email": test_email,
        "name": f"Test Bot {uuid.uuid4().hex[:4]}",
        "picture": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}",
        "bio": "Automated test bot",
        "age": 25,
        "gender": "other",
        "location": "Test Environment",
        "interests": ["testing", "gaming"],
        "photos": [],
        "preferences": UserPreferences().model_dump(),
        "membership_type": "premium",
        "swipes_today": 0,
        "swipes_limit": 999,
        "last_swipe_reset": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile_completed": True,
        "referral_code": f"TEST{uuid.uuid4().hex[:8].upper()}",
        "referred_by": None,
        "referral_count": 0,
        "premium_expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    }
    
    await db.users.insert_one(test_user)
    
    # Create session token
    session_token = f"test_session_{uuid.uuid4().hex}"
    
    # Store session
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=24*60*60
    )
    
    return {
        "user_id": user_id,
        "email": test_email,
        "name": test_user["name"],
        "session_token": session_token,
        "profile_completed": True,
        "message": "Test user created successfully!"
    }

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def create_session(session_data: SessionData, response: Response):
    """Exchange session_id for session_token and user data"""
    
    # Call Emergent Auth API to get session data
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_data.session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        
        auth_data = auth_response.json()

    # Normalize email (match email_auth.py convention — prevents dup accounts
    # if the Google profile's email casing ever differs from an existing row).
    google_email_norm = (auth_data.get("email") or "").strip().lower()

    # Check if user exists (case-insensitive fallback for legacy rows)
    existing_user = await db.users.find_one(
        {"email": google_email_norm},
        {"_id": 0}
    )
    if not existing_user and google_email_norm:
        import re as _re
        escaped = _re.escape(google_email_norm)
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"_id": 0}
        )
        if existing_user and existing_user.get("email") != google_email_norm:
            # Self-heal: lowercase the stored email for future O(1) lookups
            await db.users.update_one(
                {"user_id": existing_user["user_id"]},
                {"$set": {"email": google_email_norm}}
            )
            existing_user["email"] = google_email_norm

    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data["picture"]
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        referral_code = generate_referral_code(user_id)
        new_user = {
            "user_id": user_id,
            "email": google_email_norm,
            "name": auth_data["name"],
            "picture": auth_data["picture"],
            "bio": None,
            "age": None,
            "gender": None,
            "location": None,
            "interests": [],
            "photos": [auth_data["picture"]] if auth_data["picture"] else [],
            "preferences": UserPreferences().model_dump(),
            "membership_type": "free",
            "swipes_today": 0,
            "swipes_limit": 20,
            "last_swipe_reset": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "profile_completed": False,
            "referral_code": referral_code,
            "referred_by": None,
            "referral_count": 0,
            "premium_expires_at": None
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = auth_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Delete old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Insert new session
    await db.user_sessions.insert_one(session)
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    # Get full user data
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user_doc, "session_token": session_token}


@api_router.get("/auth/me")
async def get_current_user_data(request: Request):
    """Get current authenticated user. Accepts either a standard session
    cookie / Bearer token OR the admin_session vault cookie (God-Mode)."""
    user = await get_current_user(request)

    if not user:
        # Fall through to the vault-cookie check so founders logged into the
        # Vibe Vault can use any /api/auth/me-gated endpoint (and therefore
        # every <ProtectedRoute> admin page) without also holding a Bearer
        # token.
        from routes.admin_dashboard import verify_admin_session

        admin_cookie = request.cookies.get("admin_session")
        if admin_cookie and verify_admin_session(admin_cookie):
            return {
                "user_id": "__vault_founder__",
                "id": "__vault_founder__",
                "name": "Vault Founder",
                "email": "founder@globalvibez.local",
                "role_level": 3,
                "role_name": "God-Mode (Founder)",
                "auth_source": "vault_cookie",
            }

        raise HTTPException(status_code=401, detail="Not authenticated")

    # Strip sensitive fields before returning. `password_hash` was leaking
    # through Mongo → Pydantic dict round-trips and landing in the JSON
    # response — a real (fixable) security bug spotted while debugging a
    # login regression. User objects returned by /auth/me must NEVER
    # include the hash: the frontend doesn't need it, and shipping it
    # widens the blast radius of any XSS.
    if hasattr(user, "model_dump"):
        # Pydantic v2 model → dump minus the hash.
        return user.model_dump(exclude={"password_hash"})
    if isinstance(user, dict):
        user.pop("password_hash", None)
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}


# ==================== PROFILE ENDPOINTS ====================


@api_router.get("/profile")
async def get_current_user_profile(request: Request):
    """Get current user's profile"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

@api_router.get("/profile/{user_id}")
async def get_user_profile(user_id: str, request: Request):
    """Get user profile by ID"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc


@api_router.put("/profile")
async def update_profile(user_update: UserUpdate, request: Request):
    """Update current user's profile"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Check if profile is completed
    if update_data:
        user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
        if user_doc:
            # Profile is considered complete if has: bio, age, gender, location, at least 1 photo
            profile_completed = all([
                update_data.get("bio") or user_doc.get("bio"),
                update_data.get("age") or user_doc.get("age"),
                update_data.get("gender") or user_doc.get("gender"),
                update_data.get("location") or user_doc.get("location"),
                len(update_data.get("photos", user_doc.get("photos", []))) > 0
            ])
            update_data["profile_completed"] = profile_completed
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    # Get updated user
    updated_user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return updated_user


# ==================== MATCHING & SWIPE ENDPOINTS ====================

async def reset_swipes_if_needed(user_doc: dict) -> dict:
    """Reset swipe count if it's a new day"""
    last_reset = user_doc.get("last_swipe_reset")
    if isinstance(last_reset, str):
        last_reset = datetime.fromisoformat(last_reset)
    if last_reset and last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    
    # If last reset was on a different day, reset the count
    if not last_reset or last_reset.date() < now.date():
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {
                "swipes_today": 0,
                "last_swipe_reset": now.isoformat()
            }}
        )
        user_doc["swipes_today"] = 0
        user_doc["last_swipe_reset"] = now.isoformat()
    
    return user_doc


@api_router.get("/discover")
async def get_discovery_feed(request: Request, limit: int = 10):
    """Get potential matches for discovery feed"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get user preferences
    prefs = current_user.preferences
    
    # Build query to exclude already swiped users (limited for performance)
    swiped_users = await db.swipes.find(
        {"user_id": current_user.user_id},
        {"target_user_id": 1, "_id": 0}
    ).limit(1000).to_list(1000)
    swiped_ids = [s["target_user_id"] for s in swiped_users]
    
    # Build query filters
    query = {
        "user_id": {"$ne": current_user.user_id, "$nin": swiped_ids},  # Not self and not already swiped
        "profile_completed": True,  # Only complete profiles
    }
    
    # Apply age filter
    if prefs.min_age and prefs.max_age:
        query["age"] = {"$gte": prefs.min_age, "$lte": prefs.max_age}
    
    # Apply gender preference
    if prefs.interested_in != "everyone":
        query["gender"] = prefs.interested_in.rstrip('s')  # "men" -> "male", "women" -> "female"
        if prefs.interested_in == "men":
            query["gender"] = "male"
        elif prefs.interested_in == "women":
            query["gender"] = "female"
    
    # Get potential matches
    # Fetch only necessary fields for discovery
    potential_matches = await db.users.find(
        query, 
        {
            "_id": 0, 
            "user_id": 1, 
            "name": 1, 
            "email": 1,
            "age": 1, 
            "bio": 1, 
            "photos": 1, 
            "location": 1, 
            "interests": 1,
            "gender": 1,
            "looking_for": 1,
            "personality_traits": 1,
            "gaming_style": 1,
            "relationship_goals": 1,
            "favorite_games": 1
        }
    ).to_list(limit)
    
    return potential_matches


@api_router.post("/swipe", response_model=MatchResponse)
async def swipe_user(swipe_data: SwipeAction, request: Request):
    """Like or dislike a user"""
    from utils.swipe_limits import check_and_reset_swipes, increment_swipe_count
    
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get fresh user data
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check and reset swipes if needed (handles daily reset)
    swipe_status = await check_and_reset_swipes(db, user_doc)
    
    # Check swipe limit
    if not swipe_status["can_swipe"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Daily swipe limit reached",
                "message": "You've used all 20 swipes today. Upgrade to Plus for unlimited swipes!",
                "swipes_remaining": 0,
                "swipes_limit": swipe_status["swipes_limit"],
                "upgrade_required": True,
                "tier": swipe_status["tier"]
            }
        )
    
    # Check if already swiped
    existing_swipe = await db.swipes.find_one({
        "user_id": current_user.user_id,
        "target_user_id": swipe_data.target_user_id
    })
    
    if existing_swipe:
        raise HTTPException(status_code=400, detail="Already swiped on this user")
    
    # Create swipe record
    swipe = Swipe(
        user_id=current_user.user_id,
        target_user_id=swipe_data.target_user_id,
        action=swipe_data.action
    )
    
    swipe_dict = swipe.model_dump()
    swipe_dict["created_at"] = swipe_dict["created_at"].isoformat()
    await db.swipes.insert_one(swipe_dict)
    
    # Increment swipe count for free users
    if swipe_status["tier"] == "free":
        await increment_swipe_count(db, current_user.user_id)
    
    # Check for match (if action == "like")
    is_match = False
    match_id = None
    matched_user = None
    
    if swipe_data.action == "like":
        # Check if target user also liked current user
        mutual_like = await db.swipes.find_one({
            "user_id": swipe_data.target_user_id,
            "target_user_id": current_user.user_id,
            "action": "like"
        })
        
        if mutual_like:
            # It's a match!
            is_match = True
            
            # Check if match already exists
            existing_match = await db.matches.find_one({
                "both_ids": {"$all": [current_user.user_id, swipe_data.target_user_id]}
            })
            
            if not existing_match:
                match = Match(
                    user_id_1=current_user.user_id,
                    user_id_2=swipe_data.target_user_id,
                    both_ids=[current_user.user_id, swipe_data.target_user_id]
                )
                
                match_dict = match.model_dump()
                match_dict["created_at"] = match_dict["created_at"].isoformat()
                await db.matches.insert_one(match_dict)
                
                match_id = match.match_id
            else:
                match_id = existing_match["match_id"]
            
            # Get matched user data
            matched_user_doc = await db.users.find_one(
                {"user_id": swipe_data.target_user_id},
                {"_id": 0}
            )
            if matched_user_doc:
                matched_user = User(**matched_user_doc)
    
    # Get updated swipe status to return
    updated_user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    updated_status = await check_and_reset_swipes(db, updated_user)
    
    return MatchResponse(
        is_match=is_match,
        match_id=match_id,
        matched_user=matched_user,
        swipes_remaining=updated_status["swipes_remaining"] if updated_status["tier"] == "free" else -1
    )


@api_router.get("/matches")
async def get_matches(request: Request):
    """Get user's matches"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get all matches
    matches = await db.matches.find(
        {"both_ids": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Extract all other user IDs
    other_user_ids = []
    user_id_to_match = {}
    for match in matches:
        # Handle both old and new match document formats
        if "user_id_1" in match and "user_id_2" in match:
            other_user_id = match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
        elif "both_ids" in match:
            # Fallback to both_ids array
            both_ids = match.get("both_ids", [])
            other_user_id = next((uid for uid in both_ids if uid != current_user.user_id), None)
            if not other_user_id:
                continue
        else:
            continue
        other_user_ids.append(other_user_id)
        user_id_to_match[other_user_id] = match
    
    # Bulk fetch all matched users in one query (optimized with field projection)
    matched_users = await db.users.find(
        {"user_id": {"$in": other_user_ids}},
        {
            "_id": 0,
            "user_id": 1,
            "name": 1,
            "email": 1,
            "age": 1,
            "bio": 1,
            "photos": 1,
            "location": 1,
            "interests": 1,
            "gender": 1,
            "picture": 1
        }
    ).to_list(1000)
    
    # Build result with matched users
    result = []
    for user_doc in matched_users:
        match = user_id_to_match.get(user_doc["user_id"])
        if match:
            result.append({
                "match_id": match.get("match_id", "unknown"),
                "created_at": match.get("created_at", datetime.now(timezone.utc).isoformat()),
                "user": user_doc
            })
    
    return result


@api_router.get("/likes/received")
async def get_received_likes(request: Request):
    """Get users who liked you (Premium feature)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is premium
    if current_user.membership_type != "premium":
        raise HTTPException(
            status_code=403, 
            detail="This is a Premium feature. Upgrade to see who liked you!"
        )
    
    # Get users who liked current user
    likes = await db.swipes.find(
        {
            "target_user_id": current_user.user_id,
            "action": "like"
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Extract user IDs who liked
    liker_ids = [like["user_id"] for like in likes]
    
    # Bulk check for existing matches
    existing_matches = await db.matches.find(
        {"both_ids": {"$all": [current_user.user_id]}},
        {"_id": 0}
    ).to_list(1000)
    
    matched_user_ids = set()
    for match in existing_matches:
        matched_user_ids.add(match["user_id_1"])
        matched_user_ids.add(match["user_id_2"])
    
    # Filter out already matched users
    unmatched_liker_ids = [uid for uid in liker_ids if uid not in matched_user_ids]
    
    # Bulk fetch user details
    liker_users = await db.users.find(
        {"user_id": {"$in": unmatched_liker_ids}},
        {"_id": 0}
    ).to_list(1000)
    
    # Create lookup dictionary for likes
    like_timestamps = {like["user_id"]: like["created_at"] for like in likes}
    
    # Build result
    result = []
    for user_doc in liker_users:
        result.append({
            "liked_at": like_timestamps.get(user_doc["user_id"]),
            "user": user_doc
        })
    
    # Sort by most recent
    result.sort(key=lambda x: x["liked_at"], reverse=True)
    
    return result


# ==================== REFERRAL ENDPOINTS ====================

@api_router.get("/referral/info")
async def get_referral_info(request: Request):
    """Get user's referral code and stats"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get user's referral code (generate if not exists)
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not user_doc.get("referral_code"):
        # Generate and save referral code
        referral_code = generate_referral_code(current_user.user_id)
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"referral_code": referral_code}}
        )
        user_doc["referral_code"] = referral_code
    
    # Get referral stats
    referral_count = user_doc.get("referral_count", 0)
    
    # Get list of referred users
    referred_users = await db.users.find(
        {"referred_by": user_doc["referral_code"]},
        {"_id": 0, "name": 1, "created_at": 1}
    ).to_list(100)
    
    return {
        "referral_code": user_doc["referral_code"],
        "referral_count": referral_count,
        "referred_users": referred_users,
        "reward_message": "Get 1 month Premium free for each friend who joins!"
    }


@api_router.post("/referral/apply")
async def apply_referral_code(referral_data: ReferralApply, request: Request):
    """Apply a referral code (during or after signup)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user already used a referral code
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if user_doc.get("referred_by"):
        raise HTTPException(status_code=400, detail="You've already used a referral code")
    
    # Find referrer by code
    referrer = await db.users.find_one(
        {"referral_code": referral_data.referral_code},
        {"_id": 0}
    )
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    # Can't refer yourself
    if referrer["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="You can't use your own referral code")
    
    # Apply referral code
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"referred_by": referral_data.referral_code}}
    )
    
    # Increment referrer's count
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {"$inc": {"referral_count": 1}}
    )
    
    # Grant 1 month Premium to both users
    premium_expiry = datetime.now(timezone.utc) + timedelta(days=30)
    
    # Update current user (referred)
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "membership_type": "premium",
            "swipes_limit": 999999,
            "premium_expires_at": premium_expiry.isoformat()
        }}
    )
    
    # Update referrer
    # If they already have premium, extend it; otherwise grant it
    referrer_expiry = referrer.get("premium_expires_at")
    if referrer_expiry:
        if isinstance(referrer_expiry, str):
            referrer_expiry = datetime.fromisoformat(referrer_expiry)
        if referrer_expiry.tzinfo is None:
            referrer_expiry = referrer_expiry.replace(tzinfo=timezone.utc)
        
        # Extend by 30 days if already premium
        if referrer_expiry > datetime.now(timezone.utc):
            new_expiry = referrer_expiry + timedelta(days=30)
        else:
            new_expiry = premium_expiry
    else:
        new_expiry = premium_expiry
    
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {"$set": {
            "membership_type": "premium",
            "swipes_limit": 999999,
            "premium_expires_at": new_expiry.isoformat()
        }}
    )
    
    return {
        "message": "Referral code applied successfully!",
        "reward": "You and your friend both got 1 month Premium free! 🎉"
    }


# ==================== PAYMENT ENDPOINTS ====================

# Define Premium membership packages
MEMBERSHIP_PACKAGES = {
    "premium_monthly": {
        "amount": 9.99,
        "currency": "usd",
        "name": "Premium Monthly",
        "interval": "month"
    }
}

@api_router.post("/payment/checkout")
async def create_checkout_session(package_data: PaymentPackage, request: Request):
    """Create Stripe checkout session for Premium membership"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate package
    package_id = package_data.package_id
    if package_id not in MEMBERSHIP_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package selected")
    
    # Get package details from server-side definition (security!)
    package = MEMBERSHIP_PACKAGES[package_id]
    amount = package["amount"]
    currency = package["currency"]
    
    # Build success and cancel URLs from frontend origin
    origin_url = package_data.origin_url
    success_url = f"{origin_url}/payment/success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{origin_url}/payment/cancel"
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create metadata
    metadata = {
        "user_id": current_user.user_id,
        "package_id": package_id,
        "email": current_user.email
    }
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record (MANDATORY before redirect)
    transaction = PaymentTransaction(
        user_id=current_user.user_id,
        session_id=session.session_id,
        amount=amount,
        currency=currency,
        payment_status="pending",
        metadata=metadata
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict["created_at"] = transaction_dict["created_at"].isoformat()
    transaction_dict["updated_at"] = transaction_dict["updated_at"].isoformat()
    
    await db.payment_transactions.insert_one(transaction_dict)
    
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payment/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Get payment status and update user membership if paid"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if transaction exists
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return status
    if transaction["payment_status"] == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "message": "Payment already processed"
        }
    
    # Initialize Stripe and check status
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": checkout_status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment is successful, upgrade user to premium (ONLY ONCE)
        if checkout_status.payment_status == "paid" and transaction["payment_status"] != "paid":
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": {
                    "membership_type": "premium",
                    "swipes_limit": 999999  # Unlimited for premium
                }}
            )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        # Initialize Stripe
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update transaction based on webhook event
        if webhook_response.event_type in ["checkout.session.completed", "payment_intent.succeeded"]:
            user_id = webhook_response.metadata.get("user_id")
            session_id = webhook_response.session_id
            purchase_type = webhook_response.metadata.get("purchase_type")

            # Branch: Founders Pass (Casino House Tiers) — auto-activate the
            # pass instead of running the legacy membership upgrade. Idempotent
            # via founders_passes.payment_ref unique index.
            if purchase_type == "founders_pass" and user_id and session_id:
                from routes.founders_pass import _activate_pass
                tier_id = webhook_response.metadata.get("tier_id")
                pending = await db.founders_pass_pending.find_one(
                    {"session_id": session_id}, {"_id": 0}
                ) or {}
                amount_usd = float(pending.get("amount_usd", 0) or 0)
                if tier_id:
                    try:
                        await _activate_pass(
                            db, user_id, tier_id,
                            payment_ref=session_id,
                            amount_usd=amount_usd,
                        )
                        await db.founders_pass_pending.update_one(
                            {"session_id": session_id},
                            {"$set": {
                                "status": "activated",
                                "activated_at": datetime.now(timezone.utc).isoformat(),
                                "activated_via": "webhook",
                            }},
                        )
                    except Exception as e:
                        logging.getLogger(__name__).warning(
                            f"[stripe-webhook] founders_pass activation failed: {e}"
                        )
                # Treasury allocation for founders_pass purchase.
                try:
                    from routes.treasury import record_revenue  # noqa: PLC0415
                    if amount_usd > 0:
                        await record_revenue(
                            db,
                            gross_usd=amount_usd,
                            source="founders_pass",
                            tx_id=session_id,
                            user_id=user_id,
                            metadata={"tier_id": tier_id},
                        )
                except Exception as _e:
                    logging.getLogger(__name__).warning(
                        f"[stripe-webhook] treasury allocation (founders_pass) failed: {_e}"
                    )
                return {"status": "success", "type": "founders_pass"}

            # Branch: Chair purchase (Founder Chairs / Master Deployment Plan).
            # Idempotent via chair_purchases.payment_ref index.
            if purchase_type == "chair_park" and user_id and session_id:
                from routes.chairs import _grant_chairs
                pending = await db.chair_pending.find_one(
                    {"session_id": session_id}, {"_id": 0}
                ) or {}
                qty = int(pending.get("quantity", 0))
                price = float(pending.get("price_per_chair_usd", 0))
                if qty > 0 and price > 0:
                    try:
                        await _grant_chairs(
                            db, user_id,
                            quantity=qty,
                            price_per_chair_usd=price,
                            payment_ref=session_id,
                            invite_code=pending.get("invite_code"),
                        )
                        await db.chair_pending.update_one(
                            {"session_id": session_id},
                            {"$set": {
                                "status": "activated",
                                "activated_at": datetime.now(timezone.utc).isoformat(),
                                "activated_via": "webhook",
                            }},
                        )
                    except Exception as e:
                        logging.getLogger(__name__).warning(
                            f"[stripe-webhook] chair_park activation failed: {e}"
                        )
                # Treasury allocation for chair purchase.
                try:
                    from routes.treasury import record_revenue  # noqa: PLC0415
                    chair_gross_usd = qty * price
                    if chair_gross_usd > 0:
                        await record_revenue(
                            db,
                            gross_usd=chair_gross_usd,
                            source="chair_park",
                            tx_id=session_id,
                            user_id=user_id,
                            metadata={"quantity": qty,
                                      "price_per_chair_usd": price},
                        )
                except Exception as _e:
                    logging.getLogger(__name__).warning(
                        f"[stripe-webhook] treasury allocation (chair_park) failed: {_e}"
                    )
                return {"status": "success", "type": "chair_park"}

            if user_id and session_id:
                # Update transaction
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )

                # Treasury allocation — 40-30-30 split + founder cap.
                # Idempotent on session_id, so webhook replays are safe.
                try:
                    from routes.treasury import record_revenue  # noqa: PLC0415
                    amount_usd = float(webhook_response.amount_total or 0) / 100.0
                    if amount_usd > 0:
                        await record_revenue(
                            db,
                            gross_usd=amount_usd,
                            source=purchase_type or "stripe_membership",
                            tx_id=session_id,
                            user_id=user_id,
                            metadata={"event_type": webhook_response.event_type},
                        )
                except Exception as _e:
                    logging.getLogger(__name__).warning(
                        f"[stripe-webhook] treasury allocation failed: {_e}"
                    )

                # Upgrade user to premium
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "membership_type": "premium",
                        "swipes_limit": 999999
                    }}
                )
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== MESSAGING ENDPOINTS ====================

@api_router.post("/messages/send")
async def send_message(message_data: MessageCreate, request: Request):
    """Send a message to a matched user (Premium Feature)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user has premium access for messaging
    from utils.premium_features import can_send_messages, get_upgrade_message
    if not can_send_messages(current_user):
        upgrade_info = get_upgrade_message("chat")
        raise HTTPException(
            status_code=403, 
            detail={
                "error": "premium_required",
                "message": upgrade_info["message"],
                "description": upgrade_info["description"],
                "feature": upgrade_info["feature"],
                "min_tier": upgrade_info["min_tier"],
                "current_tier": current_user.subscription_tier
            }
        )
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, message_data.receiver_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only message matched users")
    
    # Create message
    message = Message(
        match_id=match["match_id"],
        sender_id=current_user.user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    
    message_dict = message.model_dump()
    message_dict["created_at"] = message_dict["created_at"].isoformat()
    
    await db.messages.insert_one(message_dict)
    
    return message


@api_router.get("/messages/conversation/{other_user_id}")
async def get_conversation(other_user_id: str, request: Request, limit: int = 100):
    """Get conversation history with another user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if users are matched
    match = await db.matches.find_one({
        "both_ids": {"$all": [current_user.user_id, other_user_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=403, detail="You can only view messages from matched users")
    
    # Get messages
    messages = await db.messages.find(
        {
            "match_id": match["match_id"]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(limit)
    
    # Mark messages as read (messages sent to current user)
    await db.messages.update_many(
        {
            "match_id": match["match_id"],
            "receiver_id": current_user.user_id,
            "read": False
        },
        {"$set": {"read": True}}
    )
    
    # Convert timestamps
    for msg in messages:
        if isinstance(msg["created_at"], str):
            msg["created_at"] = datetime.fromisoformat(msg["created_at"])
    
    return messages


# Removed duplicate /messages/conversations endpoint - now handled by messaging_router


# ==================== TRANSLATION ENDPOINT ====================

@api_router.post("/translate")
async def translate_text(translate_req: TranslateRequest, request: Request):
    """Translate text to target language (Premium feature)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is premium
    if current_user.membership_type != "premium":
        raise HTTPException(
            status_code=403,
            detail="Translation is a Premium feature. Upgrade to unlock!"
        )
    
    try:
        # Initialize LLM chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"translate_{current_user.user_id}",
            system_message="You are a professional translator. Translate the given text accurately while preserving tone and context. Only return the translated text, nothing else."
        ).with_model("openai", "gpt-5.2")
        
        # Create translation prompt
        if translate_req.target_language:
            prompt = f"Translate the following text to {translate_req.target_language}:\n\n{translate_req.text}"
        else:
            prompt = f"Detect the language of this text and translate it to English:\n\n{translate_req.text}"
        
        user_message = UserMessage(text=prompt)
        
        # Get translation
        translated_text = await chat.send_message(user_message)
        
        return {
            "original_text": translate_req.text,
            "translated_text": translated_text,
            "target_language": translate_req.target_language or "en"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


# ==================== OLD ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Global Vibes API - by H&S Solutions Group LLC"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# Include the router in the main app — registry mounts every feature router
# (core + optional) plus health on the FastAPI app. Order preserved 1:1 from
# the legacy inline blocks. See routes/registry.py to add a new route.
register_all_routes(api_router, app, logger)

# ==================== SOCKET.IO MULTIPLAYER ====================
# Socket.IO is imported and mounted at line 51 and 75
# Multiplayer stats endpoint
@api_router.get("/multiplayer/stats")
async def multiplayer_stats():
    """Get current multiplayer statistics"""
    return get_multiplayer_stats()


# IMPORTANT: register the api_router *after* every router has been attached
# above. FastAPI snapshots api_router's route table at this point, so anything
# included afterwards would silently 404.
app.include_router(api_router)



# Mount Socket.IO at /socket.io path
# Note: This requires Kubernetes ingress to route /socket.io to backend service
# OR use HTTP long polling which works over /api/* prefix
app.mount('/api/socket.io', socketio_app)

# Mount static files for uploads
from pathlib import Path
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup + shutdown hooks live in lifespan.py — see that module to add
# a new background scheduler or DB index. server.py keeps only the route
# wiring + Socket.IO mount + middleware setup.
from lifespan import register_startup_tasks, register_shutdown
register_startup_tasks(app, logger)
register_shutdown(app, logger)

# ==================== WEBSOCKET INTEGRATION ====================
# Import Protocol: Omega events
from services.omega_socket_events import register_omega_events
# Import Grand Master Bid Whist events
from services.bid_whist_socket_events import register_bid_whist_events
# Import Underground Spades events
from services.underground_spades_socket_events import register_underground_spades_events
# Import Universal Room Management events (for ALL multiplayer card games)
from services.room_socket_events import register_room_events
# Import Matchmaking System events
from services.matchmaking_socket_events import register_matchmaking_events

# Register all Socket.IO events
register_omega_events(sio)
register_bid_whist_events(sio)
register_underground_spades_events(sio)
register_room_events(sio)  # Universal room system
register_matchmaking_events(sio)  # Matchmaking queue system

# Treasury live solvency broadcaster (manifesto §4)
import services.treasury_socketio  # noqa: F401  — registers join/leave handlers

# Mount Socket.IO for real-time multiplayer
app.mount("/socket.io", socket_app)
# Cloud config fix
