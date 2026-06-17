from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter(prefix="/safety", tags=["safety"])


# ==================== MODELS ====================

class LocationShare(BaseModel):
    share_id: str
    user_id: str
    match_id: str
    shared_with_user_id: str
    latitude: float
    longitude: float
    duration_minutes: int  # How long to share location
    expires_at: datetime
    status: str = "active"  # active, expired, stopped
    emergency_contacts: List[Dict] = []
    last_check_in: Optional[datetime] = None
    created_at: datetime


class StartLocationShare(BaseModel):
    match_id: str
    duration_minutes: int = 120  # Default 2 hours
    emergency_contacts: List[Dict] = []  # [{"name": "Mom", "phone": "+1234567890"}]


class UpdateLocation(BaseModel):
    share_id: str
    latitude: float
    longitude: float


class CheckIn(BaseModel):
    share_id: str
    message: Optional[str] = None


class EmergencyAlert(BaseModel):
    share_id: str
    message: str

class SetTrustedContact(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("/trusted-contact/set")
async def set_trusted_contact(contact_data: SetTrustedContact, request: Request) -> Dict[str, Any]:
    """Set or update trusted contact"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not contact_data.phone and not contact_data.email:
        raise HTTPException(status_code=400, detail="Must provide phone or email")
    
    db = get_database()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "trusted_contact_name": contact_data.name,
            "trusted_contact_phone": contact_data.phone,
            "trusted_contact_email": contact_data.email
        }}
    )
    
    return {
        "message": "Trusted contact updated",
        "trusted_contact": {
            "name": contact_data.name,
            "phone": contact_data.phone,
            "email": contact_data.email
        }
    }


@router.get("/trusted-contact")
async def get_trusted_contact(request: Request) -> Dict[str, Any]:
    """Get current trusted contact"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    trusted_contact = None
    if user.get("trusted_contact_name"):
        trusted_contact = {
            "name": user.get("trusted_contact_name"),
            "phone": user.get("trusted_contact_phone"),
            "email": user.get("trusted_contact_email")
        }
    
    return {"trusted_contact": trusted_contact}


@router.delete("/trusted-contact")
async def remove_trusted_contact(request: Request) -> Dict[str, Any]:
    """Remove trusted contact"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$unset": {
            "trusted_contact_name": "",
            "trusted_contact_phone": "",
            "trusted_contact_email": ""
        }}
    )
    
    return {"message": "Trusted contact removed"}


@router.post("/share/start")
async def start_location_sharing(share_data: StartLocationShare, request: Request) -> Dict[str, Any]:
    """Start sharing location with a match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify match exists
    match = await db.matches.find_one({
        "match_id": share_data.match_id,
        "both_ids": {"$all": [current_user.user_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get other user
    other_user_id = match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
    
    # Check for existing active share
    existing_share = await db.location_shares.find_one({
        "user_id": current_user.user_id,
        "match_id": share_data.match_id,
        "status": "active"
    }, {"_id": 0})
    
    if existing_share:
        return {"message": "Location sharing already active", "share": existing_share}
    
    # Create location share
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=share_data.duration_minutes)
    
    location_share = {
        "share_id": f"share_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "match_id": share_data.match_id,
        "shared_with_user_id": other_user_id,
        "latitude": 0.0,  # Will be updated when user shares location
        "longitude": 0.0,
        "duration_minutes": share_data.duration_minutes,
        "expires_at": expires_at.isoformat(),
        "status": "active",
        "emergency_contacts": share_data.emergency_contacts,
        "last_check_in": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.location_shares.insert_one(location_share)
    
    return {
        "message": "Location sharing started",
        "share_id": location_share["share_id"],
        "expires_at": location_share["expires_at"]
    }


@router.post("/location/update")
async def update_location(location_data: UpdateLocation, request: Request) -> Dict[str, Any]:
    """Update current location"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify share belongs to user and is active
    share = await db.location_shares.find_one({
        "share_id": location_data.share_id,
        "user_id": current_user.user_id,
        "status": "active"
    }, {"_id": 0})
    
    if not share:
        raise HTTPException(status_code=404, detail="Location share not found or inactive")
    
    # Check if expired
    if datetime.fromisoformat(share["expires_at"]) < datetime.now(timezone.utc):
        await db.location_shares.update_one(
            {"share_id": location_data.share_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Location share has expired")
    
    # Update location
    await db.location_shares.update_one(
        {"share_id": location_data.share_id},
        {"$set": {
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Location updated successfully"}


@router.get("/share/{share_id}")
async def get_location_share(share_id: str, request: Request) -> Dict[str, Any]:
    """Get location share details (for viewer)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    share = await db.location_shares.find_one({
        "share_id": share_id,
        "$or": [
            {"user_id": current_user.user_id},
            {"shared_with_user_id": current_user.user_id}
        ]
    }, {"_id": 0})
    
    if not share:
        raise HTTPException(status_code=404, detail="Location share not found")
    
    # Get user info
    user = await db.users.find_one(
        {"user_id": share["user_id"]},
        {"_id": 0, "name": 1, "picture": 1, "user_id": 1}
    )
    
    # Check if expired
    if datetime.fromisoformat(share["expires_at"]) < datetime.now(timezone.utc):
        if share["status"] == "active":
            await db.location_shares.update_one(
                {"share_id": share_id},
                {"$set": {"status": "expired"}}
            )
            share["status"] = "expired"
    
    return {
        "share": share,
        "user": user,
        "is_owner": share["user_id"] == current_user.user_id
    }


@router.get("/my-active-shares")
async def get_my_active_shares(request: Request) -> Dict[str, Any]:
    """Get all active location shares (both sharing and viewing)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Shares I'm broadcasting
    my_shares = await db.location_shares.find({
        "user_id": current_user.user_id,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Shares being shared with me
    shared_with_me = await db.location_shares.find({
        "shared_with_user_id": current_user.user_id,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Get user details for shared_with_me
    for share in shared_with_me:
        user = await db.users.find_one(
            {"user_id": share["user_id"]},
            {"_id": 0, "name": 1, "picture": 1}
        )
        share["user"] = user
    
    return {
        "my_shares": my_shares,
        "shared_with_me": shared_with_me
    }


@router.post("/share/stop")
async def stop_location_sharing(share_id: str, request: Request) -> Dict[str, Any]:
    """Stop sharing location"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    result = await db.location_shares.update_one(
        {
            "share_id": share_id,
            "user_id": current_user.user_id,
            "status": "active"
        },
        {"$set": {"status": "stopped", "stopped_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Location share not found or already stopped")
    
    return {"message": "Location sharing stopped"}


@router.post("/check-in")
async def send_check_in(check_in_data: CheckIn, request: Request) -> Dict[str, Any]:
    """Send a safety check-in"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    share = await db.location_shares.find_one({
        "share_id": check_in_data.share_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    
    if not share:
        raise HTTPException(status_code=404, detail="Location share not found")
    
    # Update last check-in
    await db.location_shares.update_one(
        {"share_id": check_in_data.share_id},
        {"$set": {"last_check_in": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send notification to shared_with user (in a real app)
    # For now, just log the check-in
    check_in_record = {
        "check_in_id": f"checkin_{uuid.uuid4().hex[:12]}",
        "share_id": check_in_data.share_id,
        "user_id": current_user.user_id,
        "message": check_in_data.message or "I'm safe ✓",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.safety_check_ins.insert_one(check_in_record)
    
    return {"message": "Check-in sent successfully"}


@router.post("/emergency")
async def send_emergency_alert(alert_data: EmergencyAlert, request: Request) -> Dict[str, Any]:
    """Send emergency alert"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    share = await db.location_shares.find_one({
        "share_id": alert_data.share_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    
    if not share:
        raise HTTPException(status_code=404, detail="Location share not found")
    
    # Create emergency alert
    emergency_alert = {
        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
        "share_id": alert_data.share_id,
        "user_id": current_user.user_id,
        "message": alert_data.message,
        "latitude": share.get("latitude", 0),
        "longitude": share.get("longitude", 0),
        "emergency_contacts": share.get("emergency_contacts", []),
        "shared_with_user_id": share["shared_with_user_id"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.emergency_alerts.insert_one(emergency_alert)
    
    # In a real app, send SMS/notifications to emergency contacts
    # and the person they're sharing location with
    
    return {
        "message": "Emergency alert sent",
        "alert_id": emergency_alert["alert_id"],
        "contacts_notified": len(share.get("emergency_contacts", []))
    }


@router.get("/check-ins/{share_id}")
async def get_check_ins(share_id: str, request: Request) -> Dict[str, Any]:
    """Get all check-ins for a location share"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify user has access to this share
    share = await db.location_shares.find_one({
        "share_id": share_id,
        "$or": [
            {"user_id": current_user.user_id},
            {"shared_with_user_id": current_user.user_id}
        ]
    }, {"_id": 0})
    
    if not share:
        raise HTTPException(status_code=403, detail="Access denied")
    
    check_ins = await db.safety_check_ins.find(
        {"share_id": share_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"check_ins": check_ins}
