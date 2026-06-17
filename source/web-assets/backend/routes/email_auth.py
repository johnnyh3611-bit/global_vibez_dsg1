from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import re
from uuid import uuid4

from utils.database import get_database

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ==================== MODELS ====================

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    date_of_birth: str  # Format: YYYY-MM-DD

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# ==================== HELPER FUNCTIONS ====================

def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password meets security standards:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    
    return True, "Password is valid"

def calculate_age(date_of_birth: str) -> int:
    """Calculate age from date of birth string (YYYY-MM-DD)"""
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.now()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

def create_session(db, user_id: str) -> tuple[str, datetime]:
    """Create a new session for user"""
    session_token = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    return session_token, expires_at

# ==================== ENDPOINTS ====================

@router.post("/signup")
async def signup(signup_data: SignupRequest, response: Response) -> Dict[str, Any]:
    """Register a new user with email and password"""
    db = get_database()

    # Normalize email (RFC 5321: local part technically case-sensitive, but
    # practically all providers treat it case-insensitively — matching
    # industry standard prevents dup accounts from phone auto-capitalization).
    email_norm = signup_data.email.strip().lower()

    # Check if email already exists
    existing_user = await db.users.find_one({"email": email_norm})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password
    is_valid, message = validate_password(signup_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Calculate age and verify 18+
    age = calculate_age(signup_data.date_of_birth)
    if age < 18:
        raise HTTPException(
            status_code=403, 
            detail="You must be at least 18 years old to use Global Vibes"
        )
    
    # Hash password
    password_hash = pwd_context.hash(signup_data.password)
    
    # Create user
    user_id = str(uuid4())
    user_data = {
        "user_id": user_id,
        "email": email_norm,
        "name": signup_data.name,
        "password_hash": password_hash,
        "auth_provider": "email",
        "date_of_birth": signup_data.date_of_birth,
        "age": age,
        "profile_completed": False,
        "membership_type": "free",
        "subscription_tier": "free",
        "credits_balance": 50,
        "interests": [],
        "photos": [],
        "preferences": {
            "min_age": 18,
            "max_age": 99,
            "max_distance": 50,
            "interested_in": "everyone"
        },
        "age_verified": True,  # DOB provided during signup
        "verification_status": "approved",  # Basic verification done
        "swipes_today": 0,
        "swipes_limit": 20,
        "referral_count": 0,
        "coins": 2500,  # Starting coins for new users
        "owned_houses": ["classic", "emerald_elite", "cyber_terminal"],  # 3 FREE house views
        "selected_house": "classic",  # Currently active house
        "custom_colors": {  # FREE color customization
            "felt": "green",
            "border": "walnut"
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_data)
    
    # Create session
    session_token, expires_at = create_session(db, user_id)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=30 * 24 * 60 * 60  # 30 days
    )
    
    return {
        "message": "Signup successful",
        "token": session_token,  # ✅ CORS FIX: Return token in response for localStorage
        "user": {
            "user_id": user_id,
            "email": email_norm,
            "name": signup_data.name,
            "profile_completed": False
        }
    }

@router.post("/login")
async def login(login_data: LoginRequest, response: Response) -> Dict[str, Any]:
    """Login with email and password"""
    db = get_database()

    # Normalize email (case-insensitive lookup — handles phone auto-capitalization).
    email_norm = login_data.email.strip().lower()

    # Find user by normalized email. Fall back to case-insensitive regex so
    # legacy users whose emails were stored with mixed case before this fix
    # can still log in — the next successful login also lowercases their row.
    user = await db.users.find_one({"email": email_norm})
    if not user:
        escaped = re.escape(email_norm)
        user = await db.users.find_one({"email": {"$regex": f"^{escaped}$", "$options": "i"}})
        if user and user.get("email") != email_norm:
            # Heal the stored email on the fly so future lookups are O(1).
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"email": email_norm}})
            user["email"] = email_norm
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if user registered with Google
    if user.get("auth_provider") == "google" and not user.get("password_hash"):
        raise HTTPException(
            status_code=400, 
            detail="This account uses Google Sign-In. Please use 'Sign in with Google' button"
        )
    
    # Verify password
    if not user.get("password_hash") or not pwd_context.verify(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check age verification for existing users
    if not user.get("age") or not user.get("date_of_birth"):
        # User needs to provide age
        return {
            "requires_age_verification": True,
            "user_id": user["user_id"],
            "message": "Please provide your date of birth to continue"
        }
    
    # Create session
    session_token, expires_at = create_session(db, user["user_id"])
    
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=30 * 24 * 60 * 60  # 30 days
    )
    
    return {
        "message": "Login successful",
        "token": session_token,  # ✅ CORS FIX: Return token in response for localStorage
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "profile_completed": user.get("profile_completed", False)
        }
    }

@router.post("/update-age")
async def update_age(request: dict, response: Response) -> Dict[str, Any]:
    """Update age for existing users who don't have it set"""
    db = get_database()
    
    user_id = request.get("user_id")
    date_of_birth = request.get("date_of_birth")
    
    if not user_id or not date_of_birth:
        raise HTTPException(status_code=400, detail="user_id and date_of_birth are required")
    
    # Calculate age
    age = calculate_age(date_of_birth)
    if age < 18:
        raise HTTPException(
            status_code=403, 
            detail="You must be at least 18 years old to use Global Vibes"
        )
    
    # Update user
    result = await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "date_of_birth": date_of_birth,
                "age": age,
                "age_verified": True,
                "verification_status": "approved",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create session
    session_token, expires_at = create_session(db, user_id)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=30 * 24 * 60 * 60
    )
    
    return {
        "message": "Age verified successfully",
        "token": session_token,  # ✅ CORS FIX: Return token in response
        "user": {
            "user_id": user_id,
            "age": age
        }
    }


# ==================== PASSWORD RESET ====================

from services import password_reset_service as _prs  # noqa: E402


@router.post("/forgot-password")
async def forgot_password(payload: PasswordResetRequest) -> Dict[str, Any]:
    """Request a reset link. Always returns a neutral 200 so attackers can't
    enumerate registered emails."""
    db = get_database()
    email_norm = (payload.email or "").strip().lower()
    return await _prs.request_reset(db, email_norm)


@router.get("/reset-password/verify")
async def reset_password_verify(token: str) -> Dict[str, Any]:
    """Frontend calls this on load to decide whether to render the form
    or an expired/invalid error. Returns {valid: bool, reason?: str}."""
    db = get_database()
    return await _prs.verify_token(db, token)


@router.post("/reset-password")
async def reset_password(payload: PasswordResetConfirm) -> Dict[str, Any]:
    """Consume a valid reset token and set the new password."""
    db = get_database()
    is_valid, message = validate_password(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    try:
        await _prs.confirm_reset(db, payload.token, pwd_context.hash(payload.new_password))
    except ValueError as err:
        reason = str(err)
        # Map internal reason codes to HTTP-friendly messages. Never echo
        # whether the email exists — only whether *this token* is usable.
        mapping = {
            "missing": (400, "Reset token missing."),
            "invalid": (400, "This reset link is invalid."),
            "expired": (400, "This reset link has expired — request a new one."),
            "used":    (400, "This reset link was already used."),
        }
        status, detail = mapping.get(reason, (400, "Unable to reset password."))
        raise HTTPException(status_code=status, detail=detail)

    return {"ok": True, "message": "Password updated. You can now sign in with your new password."}

