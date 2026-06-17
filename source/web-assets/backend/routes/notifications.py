from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
from motor.motor_asyncio import AsyncIOMotorClient
import firebase_admin
from firebase_admin import credentials, messaging
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# Initialize Firebase Admin SDK
try:
    firebase_credentials_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    if not firebase_admin._apps:
        if firebase_credentials_json:
            # Load credentials from environment variable
            import json
            service_account_info = json.loads(firebase_credentials_json)
            cred = credentials.Certificate(service_account_info)
        else:
            # Fallback to file-based credentials (for local development)
            service_account_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-service-account.json")
            cred = credentials.Certificate(service_account_path)
        
        firebase_admin.initialize_app(cred)
        logger.info("🔥 Firebase Admin SDK initialized successfully")
    
    FIREBASE_ADMIN_INITIALIZED = True
except Exception as e:
    logger.error(f"❌ Failed to initialize Firebase Admin SDK: {e}")
    FIREBASE_ADMIN_INITIALIZED = False

class FCMTokenRequest(BaseModel):
    fcm_token: str

class NotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[dict] = None
    url: Optional[str] = None

@router.post("/notifications/register")
async def register_fcm_token(request: FCMTokenRequest, user_id: str = "anonymous") -> Dict[str, Any]:
    """
    Register a user's FCM token for push notifications
    """
    try:
        fcm_token = request.fcm_token
        
        # Store FCM token in database linked to user
        await db.fcm_tokens.update_one(
            {"token": fcm_token},
            {
                "$set": {
                    "token": fcm_token,
                    "user_id": user_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "active": True
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        logger.info(f"✅ FCM token registered for user: {user_id}")
        
        return {
            "success": True,
            "message": "FCM token registered successfully",
            "user_id": user_id
        }
    
    except Exception as e:
        logger.error(f"❌ Error registering FCM token: {e}")
        raise HTTPException(status_code=500, detail=f"Error registering FCM token: {str(e)}")

@router.post("/notifications/send")
async def send_notification(request: NotificationRequest) -> Dict[str, Any]:
    """
    Send a push notification to a specific user using Firebase Cloud Messaging
    """
    try:
        if not FIREBASE_ADMIN_INITIALIZED:
            raise HTTPException(status_code=503, detail="Firebase Admin SDK not initialized")
        
        # Get user's FCM token from database
        user_tokens = await db.fcm_tokens.find(
            {"user_id": request.user_id, "active": True},
            {"_id": 0}
        ).to_list(100)
        
        if not user_tokens:
            return {
                "success": False,
                "message": f"No active FCM tokens found for user {request.user_id}"
            }
        
        # Prepare notification message
        notification_data = request.data or {}
        if request.url:
            notification_data["url"] = request.url
        
        successful_sends = 0
        failed_sends = 0
        
        for token_doc in user_tokens:
            try:
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=request.title,
                        body=request.body
                    ),
                    data=notification_data,
                    token=token_doc["token"]
                )
                
                response = messaging.send(message)
                logger.info(f"✅ Successfully sent notification: {response}")
                successful_sends += 1
                
            except messaging.UnregisteredError:
                # Token is invalid, mark as inactive
                await db.fcm_tokens.update_one(
                    {"token": token_doc["token"]},
                    {"$set": {"active": False}}
                )
                logger.warning("⚠️ Token unregistered, marked as inactive")
                failed_sends += 1
                
            except Exception as send_error:
                logger.error(f"❌ Error sending to token: {send_error}")
                failed_sends += 1
        
        return {
            "success": True,
            "message": f"Notification sent to {successful_sends} device(s)",
            "successful": successful_sends,
            "failed": failed_sends,
            "total_tokens": len(user_tokens)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending notification: {e}")
        raise HTTPException(status_code=500, detail=f"Error sending notification: {str(e)}")

@router.get("/notifications/status")
async def get_notification_status() -> Dict[str, Any]:
    """
    Check notification system status
    """
    try:
        # Count registered tokens
        token_count = await db.fcm_tokens.count_documents({"active": True})
        
        return {
            "success": True,
            "registered_tokens": token_count,
            "firebase_configured": True,
            "admin_sdk_configured": FIREBASE_ADMIN_INITIALIZED
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking status: {str(e)}")

@router.post("/notifications/broadcast")
async def broadcast_notification(title: str, body: str, data: Optional[dict] = None) -> Dict[str, Any]:
    """
    Send a notification to all registered devices
    """
    try:
        if not FIREBASE_ADMIN_INITIALIZED:
            raise HTTPException(status_code=503, detail="Firebase Admin SDK not initialized")
        
        # Get all active tokens
        all_tokens = await db.fcm_tokens.find(
            {"active": True},
            {"_id": 0, "token": 1}
        ).to_list(1000)
        
        if not all_tokens:
            return {
                "success": False,
                "message": "No active FCM tokens found"
            }
        
        tokens = [doc["token"] for doc in all_tokens]
        
        # Prepare multicast message
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            data=data or {},
            tokens=tokens
        )
        
        # Send to all devices (using send_each_for_multicast - send_multicast was dropped in firebase-admin 7.3.0)
        response = messaging.send_each_for_multicast(message)
        
        logger.info(f"📢 Broadcast sent: {response.success_count}/{len(tokens)} successful")
        
        # Handle failed tokens
        if response.failure_count > 0:
            failed_tokens = []
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    failed_tokens.append(tokens[idx])
            
            # Mark failed tokens as inactive
            if failed_tokens:
                await db.fcm_tokens.update_many(
                    {"token": {"$in": failed_tokens}},
                    {"$set": {"active": False}}
                )
        
        return {
            "success": True,
            "message": f"Broadcast sent to {response.success_count} device(s)",
            "successful": response.success_count,
            "failed": response.failure_count,
            "total_tokens": len(tokens)
        }
    
    except Exception as e:
        logger.error(f"❌ Error broadcasting notification: {e}")
        raise HTTPException(status_code=500, detail=f"Error broadcasting: {str(e)}")



@router.post("/notifications/test")
async def test_notification() -> Dict[str, Any]:
    """
    Send a test notification to all registered devices for testing
    """
    try:
        return await broadcast_notification(
            title="🎮 Global Vibez DSG Test",
            body="Your notifications are working! Welcome to the vibez.",
            data={"type": "test", "url": "/games"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending test: {str(e)}")
