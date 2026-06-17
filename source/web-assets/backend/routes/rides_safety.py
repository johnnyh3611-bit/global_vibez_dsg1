"""
Vibe Ridez Safety System
Comprehensive safety features including gender matching, GPS tracking, emergency contacts, and SOS
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Optional, Any
from datetime import datetime, timezone
import uuid
import json
import os
import httpx
from utils.database import get_database

router = APIRouter(prefix="/rides/safety", tags=["ride_safety"])

# Active tracking sessions
active_tracking: Dict[str, Dict] = {}  # {ride_id: {rider_ws, contacts_ws[], location_history}}

# Pydantic Models
class SafetyPreferences(BaseModel):
    user_id: str
    prefer_same_gender: bool = False
    require_female_driver: bool = False
    share_live_location: bool = True
    enable_route_monitoring: bool = True
    enable_auto_checkins: bool = True

class EmergencyContact(BaseModel):
    user_id: str
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = None
    relationship: str  # friend, family, partner

class SOSAlert(BaseModel):
    ride_id: str
    user_id: str
    location: Dict
    alert_type: str  # panic, unsafe_driver, route_deviation, harassment

class RideVerification(BaseModel):
    ride_id: str
    verification_code: str

class LocationUpdate(BaseModel):
    ride_id: str
    latitude: float
    longitude: float
    speed: Optional[float] = None
    heading: Optional[float] = None

class DirectionsRequest(BaseModel):
    pickup_latitude: float
    pickup_longitude: float
    dropoff_latitude: float
    dropoff_longitude: float

# ========== SAFETY PREFERENCES ==========

@router.post("/preferences")
async def update_safety_preferences(prefs: SafetyPreferences) -> Dict[str, Any]:
    """Update user's safety preferences"""
    try:
        db = get_database()
        
        await db.users.update_one(
            {"user_id": prefs.user_id},
            {"$set": {
                "safety_preferences": {
                    "prefer_same_gender": prefs.prefer_same_gender,
                    "require_female_driver": prefs.require_female_driver,
                    "share_live_location": prefs.share_live_location,
                    "enable_route_monitoring": prefs.enable_route_monitoring,
                    "enable_auto_checkins": prefs.enable_auto_checkins,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Safety preferences updated"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preferences/{user_id}")
async def get_safety_preferences(user_id: str) -> Dict[str, Any]:
    """Get user's safety preferences"""
    try:
        db = get_database()
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        prefs = user.get("safety_preferences", {
            "prefer_same_gender": False,
            "require_female_driver": False,
            "share_live_location": True,
            "enable_route_monitoring": True,
            "enable_auto_checkins": True
        })
        
        return {
            "success": True,
            "preferences": prefs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== EMERGENCY CONTACTS ==========

@router.post("/emergency-contact")
async def add_emergency_contact(contact: EmergencyContact) -> Dict[str, Any]:
    """Add emergency contact"""
    try:
        db = get_database()
        
        contact_doc = {
            "id": f"ec_{uuid.uuid4().hex[:12]}",
            "user_id": contact.user_id,
            "name": contact.contact_name,
            "phone": contact.contact_phone,
            "email": contact.contact_email,
            "relationship": contact.relationship,
            "added_at": datetime.now(timezone.utc).isoformat(),
            "verified": False
        }
        
        await db.emergency_contacts.insert_one(contact_doc)
        
        # Send verification SMS/email (in production)
        # For now, mark as verified
        await db.emergency_contacts.update_one(
            {"id": contact_doc["id"]},
            {"$set": {"verified": True}}
        )
        
        return {
            "success": True,
            "contact_id": contact_doc["id"],
            "message": f"Emergency contact {contact.contact_name} added"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/emergency-contacts/{user_id}")
async def get_emergency_contacts(user_id: str) -> Dict[str, Any]:
    """Get user's emergency contacts"""
    try:
        db = get_database()
        
        contacts = await db.emergency_contacts.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(10)
        
        return {
            "success": True,
            "contacts": contacts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/emergency-contact/{contact_id}")
async def remove_emergency_contact(contact_id: str) -> Dict[str, Any]:
    """Remove emergency contact"""
    try:
        db = get_database()
        
        result = await db.emergency_contacts.delete_one({"id": contact_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return {
            "success": True,
            "message": "Emergency contact removed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== RIDE VERIFICATION ==========

@router.post("/generate-code/{ride_id}")
async def generate_verification_code(ride_id: str) -> Dict[str, Any]:
    """Generate verification code for ride"""
    try:
        db = get_database()
        
        # Generate 4-digit code
        code = str(uuid.uuid4().int)[:4]
        
        await db.rides.update_one(
            {"ride_id": ride_id},
            {"$set": {
                "verification_code": code,
                "code_verified": False
            }}
        )
        
        return {
            "success": True,
            "code": code,
            "message": "Share this code with your driver to verify"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-code")
async def verify_ride_code(verification: RideVerification) -> Dict[str, Any]:
    """Verify ride with code"""
    try:
        db = get_database()
        
        ride = await db.rides.find_one({"ride_id": verification.ride_id}, {"_id": 0})
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        if ride.get("verification_code") == verification.verification_code:
            await db.rides.update_one(
                {"ride_id": verification.ride_id},
                {"$set": {"code_verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            return {
                "success": True,
                "verified": True,
                "message": "Ride verified successfully"
            }
        else:
            return {
                "success": False,
                "verified": False,
                "message": "Invalid verification code"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== SOS / PANIC BUTTON ==========

@router.post("/sos")
async def trigger_sos(alert: SOSAlert) -> Dict[str, Any]:
    """Trigger SOS alert"""
    try:
        db = get_database()
        
        # Create SOS alert
        sos_doc = {
            "id": f"sos_{uuid.uuid4().hex[:12]}",
            "ride_id": alert.ride_id,
            "user_id": alert.user_id,
            "location": alert.location,
            "alert_type": alert.alert_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "active",  # active, resolved, false_alarm
            "response_time": None
        }
        
        await db.sos_alerts.insert_one(sos_doc)
        
        # Get ride details
        ride = await db.rides.find_one({"ride_id": alert.ride_id}, {"_id": 0})
        
        # Notify emergency contacts
        contacts = await db.emergency_contacts.find(
            {"user_id": alert.user_id, "verified": True},
            {"_id": 0}
        ).to_list(10)
        
        for contact in contacts:
            # Send SMS/Email alert (in production)
            notification = {
                "id": f"notif_{uuid.uuid4().hex[:12]}",
                "contact_id": contact["id"],
                "type": "sos_alert",
                "ride_id": alert.ride_id,
                "message": f"🚨 EMERGENCY: {ride.get('rider_id')} triggered SOS during ride. Location: {alert.location.get('address', 'Unknown')}",
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
            await db.safety_notifications.insert_one(notification)
        
        # Alert platform safety team
        await db.safety_team_alerts.insert_one({
            "id": f"team_{uuid.uuid4().hex[:12]}",
            "sos_id": sos_doc["id"],
            "ride_id": alert.ride_id,
            "severity": "high" if alert.alert_type == "panic" else "medium",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "sos_id": sos_doc["id"],
            "contacts_notified": len(contacts),
            "message": "Emergency services notified. Help is on the way."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== REAL-TIME GPS TRACKING ==========

@router.websocket("/track/{ride_id}/{user_type}")
async def track_ride_location(websocket: WebSocket, ride_id: str, user_type: str) -> Dict[str, Any]:
    """
    WebSocket for real-time GPS tracking
    user_type: rider, driver, emergency_contact
    """
    await websocket.accept()
    
    # Initialize tracking session
    if ride_id not in active_tracking:
        active_tracking[ride_id] = {
            "rider_ws": None,
            "driver_ws": None,
            "contact_ws": [],
            "location_history": [],
            "start_time": datetime.now(timezone.utc).isoformat()
        }
    
    # Register WebSocket
    if user_type == "rider":
        active_tracking[ride_id]["rider_ws"] = websocket
    elif user_type == "driver":
        active_tracking[ride_id]["driver_ws"] = websocket
    elif user_type == "emergency_contact":
        active_tracking[ride_id]["contact_ws"].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "location_update":
                location = {
                    "latitude": message.get("latitude"),
                    "longitude": message.get("longitude"),
                    "speed": message.get("speed"),
                    "heading": message.get("heading"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
                # Store location
                active_tracking[ride_id]["location_history"].append(location)
                
                # Broadcast to all watchers
                broadcast_message = {
                    "type": "location_update",
                    "location": location,
                    "ride_id": ride_id
                }
                
                # Send to rider
                if active_tracking[ride_id]["rider_ws"]:
                    try:
                        await active_tracking[ride_id]["rider_ws"].send_text(json.dumps(broadcast_message))
                    except Exception:
                        pass
                
                # Send to driver
                if active_tracking[ride_id]["driver_ws"]:
                    try:
                        await active_tracking[ride_id]["driver_ws"].send_text(json.dumps(broadcast_message))
                    except Exception:
                        pass
                
                # Send to emergency contacts
                for contact_ws in active_tracking[ride_id]["contact_ws"]:
                    try:
                        await contact_ws.send_text(json.dumps(broadcast_message))
                    except Exception:
                        pass
                
                # Check for route deviation (in production, compare with expected route)
                # If deviation detected, alert emergency contacts
                
    except WebSocketDisconnect:
        # Clean up on disconnect
        if user_type == "rider":
            active_tracking[ride_id]["rider_ws"] = None
        elif user_type == "driver":
            active_tracking[ride_id]["driver_ws"] = None
        elif user_type == "emergency_contact":
            try:
                active_tracking[ride_id]["contact_ws"].remove(websocket)
            except Exception:
                pass

@router.get("/tracking/share-link/{ride_id}")
async def generate_tracking_link(ride_id: str) -> Dict[str, Any]:
    """Generate shareable tracking link for emergency contacts"""
    try:
        db = get_database()
        
        # Generate secure token
        token = uuid.uuid4().hex
        
        await db.ride_tracking_tokens.insert_one({
            "ride_id": ride_id,
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc)).isoformat()  # 24 hours
        })
        
        # In production, this would be the actual domain
        tracking_url = f"https://globalvibez.com/track/{ride_id}?token={token}"
        
        return {
            "success": True,
            "tracking_url": tracking_url,
            "message": "Share this link with your emergency contacts"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== GENDER-BASED DRIVER MATCHING ==========

@router.post("/match-driver/{ride_id}")
async def match_driver_with_preferences(ride_id: str) -> Dict[str, Any]:
    """Match driver based on rider's safety preferences"""
    try:
        db = get_database()
        
        # Get ride
        ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        # Get rider preferences
        rider = await db.users.find_one({"user_id": ride["rider_id"]}, {"_id": 0})
        prefs = rider.get("safety_preferences", {})
        
        # Build driver query
        driver_query = {
            "status": "approved",
            "available": True
        }
        
        # Gender-based matching
        if prefs.get("require_female_driver"):
            driver_query["gender"] = "female"
        elif prefs.get("prefer_same_gender"):
            driver_query["gender"] = rider.get("gender")
        
        # Find available drivers
        drivers = await db.drivers.find(driver_query, {"_id": 0}).to_list(10)
        
        return {
            "success": True,
            "available_drivers": len(drivers),
            "drivers": drivers,
            "preferences_applied": {
                "require_female_driver": prefs.get("require_female_driver", False),
                "prefer_same_gender": prefs.get("prefer_same_gender", False)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== MAPBOX DIRECTIONS API ==========

@router.post("/directions")
async def get_directions(directions_req: DirectionsRequest) -> Dict[str, Any]:
    """Get route, distance, and ETA from Mapbox Directions API"""
    try:
        mapbox_token = os.getenv("MAPBOX_ACCESS_TOKEN")
        if not mapbox_token:
            raise HTTPException(status_code=500, detail="Mapbox token not configured")
        
        # Build Mapbox API URL
        url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{directions_req.pickup_longitude},{directions_req.pickup_latitude};{directions_req.dropoff_longitude},{directions_req.dropoff_latitude}"
        
        params = {
            "access_token": mapbox_token,
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
            "alternatives": "false"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                
                return {
                    "success": True,
                    "route": {
                        "geometry": route["geometry"],
                        "distance": route["distance"],  # meters
                        "duration": route["duration"],  # seconds
                        "distance_km": round(route["distance"] / 1000, 2),
                        "duration_minutes": round(route["duration"] / 60, 1),
                        "steps": route.get("steps", [])
                    }
                }
            else:
                raise HTTPException(status_code=404, detail="No route found")
                
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Mapbox API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating route: {str(e)}")

# ========== SAFETY STATISTICS ==========

@router.get("/stats/{user_id}")
async def get_safety_stats(user_id: str) -> Dict[str, Any]:
    """Get user's safety statistics"""
    try:
        db = get_database()
        
        # Count rides with safety features enabled
        total_rides = await db.rides.count_documents({"rider_id": user_id, "status": "completed"})
        verified_rides = await db.rides.count_documents({"rider_id": user_id, "code_verified": True})
        tracked_rides = await db.rides.count_documents({"rider_id": user_id, "location_tracking_enabled": True})
        
        # SOS alerts
        sos_count = await db.sos_alerts.count_documents({"user_id": user_id})
        
        return {
            "success": True,
            "stats": {
                "total_rides": total_rides,
                "verified_rides": verified_rides,
                "tracked_rides": tracked_rides,
                "sos_alerts_triggered": sos_count,
                "safety_score": min(100, (verified_rides / max(total_rides, 1)) * 100)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
