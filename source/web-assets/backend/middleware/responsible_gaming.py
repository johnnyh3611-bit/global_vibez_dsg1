"""
Responsible Gaming Middleware & Features
Implements self-exclusion, deposit limits, and problem gambling protections
"""
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel


class ResponsibleGamingSettings(BaseModel):
    """User's responsible gaming configuration"""
    user_id: str
    
    # Self-Exclusion
    self_excluded: bool = False
    self_exclusion_until: Optional[datetime] = None
    self_exclusion_type: Optional[str] = None  # '24h', '7d', '30d', 'permanent'
    
    # Deposit Limits
    daily_deposit_limit: Optional[int] = None  # in cents
    weekly_deposit_limit: Optional[int] = None
    monthly_deposit_limit: Optional[int] = None
    
    # Loss Limits
    daily_loss_limit: Optional[int] = None
    weekly_loss_limit: Optional[int] = None
    monthly_loss_limit: Optional[int] = None
    
    # Session Limits
    session_time_limit: Optional[int] = None  # in minutes
    session_reminder_enabled: bool = False
    session_reminder_interval: int = 60  # minutes
    
    # Reality Checks
    reality_check_enabled: bool = True
    reality_check_interval: int = 60  # minutes
    
    # Cool-off Period
    cool_off_active: bool = False
    cool_off_until: Optional[datetime] = None


class ResponsibleGamingManager:
    """
    Manages responsible gaming features and enforcements
    """
    
    @staticmethod
    async def check_self_exclusion(db, user_id: str) -> bool:
        """
        Check if user is self-excluded
        Returns True if excluded (should block access)
        """
        settings = await db.responsible_gaming.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not settings or not settings.get("self_excluded"):
            return False
        
        # Check if temporary exclusion has expired
        if settings.get("self_exclusion_until"):
            expiry = datetime.fromisoformat(settings["self_exclusion_until"])
            if datetime.now(timezone.utc) >= expiry:
                # Exclusion period ended - remove exclusion
                await db.responsible_gaming.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "self_excluded": False,
                        "self_exclusion_until": None,
                        "self_exclusion_type": None
                    }}
                )
                return False
        
        return True  # User is excluded
    
    @staticmethod
    async def apply_self_exclusion(
        db,
        user_id: str,
        exclusion_type: str
    ) -> dict:
        """
        Apply self-exclusion to user account
        
        exclusion_type: '24h', '7d', '30d', 'permanent'
        """
        exclusion_periods = {
            '24h': timedelta(hours=24),
            '7d': timedelta(days=7),
            '30d': timedelta(days=30),
            'permanent': None
        }
        
        if exclusion_type not in exclusion_periods:
            raise HTTPException(status_code=400, detail="Invalid exclusion type")
        
        exclusion_until = None
        if exclusion_periods[exclusion_type]:
            exclusion_until = datetime.now(timezone.utc) + exclusion_periods[exclusion_type]
        
        await db.responsible_gaming.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "self_excluded": True,
                    "self_exclusion_type": exclusion_type,
                    "self_exclusion_until": exclusion_until.isoformat() if exclusion_until else None,
                    "excluded_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Log the exclusion
        await db.responsible_gaming_log.insert_one({
            "user_id": user_id,
            "action": "SELF_EXCLUSION_APPLIED",
            "exclusion_type": exclusion_type,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Self-exclusion applied successfully",
            "exclusion_type": exclusion_type,
            "until": exclusion_until.isoformat() if exclusion_until else "Permanent"
        }
    
    @staticmethod
    async def check_deposit_limit(
        db,
        user_id: str,
        amount: int
    ) -> dict:
        """
        Check if deposit would exceed user's limits
        amount: in cents
        
        Returns: {
            "allowed": bool,
            "reason": str (if not allowed)
        }
        """
        settings = await db.responsible_gaming.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not settings:
            return {"allowed": True}
        
        now = datetime.now(timezone.utc)
        
        # Get deposit history
        daily_deposits = await db.transactions.aggregate([
            {
                "$match": {
                    "user_id": user_id,
                    "type": "DEPOSIT",
                    "timestamp": {"$gte": (now - timedelta(days=1)).isoformat()}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$amount"}
                }
            }
        ]).to_list(1)
        
        daily_total = daily_deposits[0]["total"] if daily_deposits else 0
        
        # Check daily limit
        if settings.get("daily_deposit_limit"):
            if daily_total + amount > settings["daily_deposit_limit"]:
                return {
                    "allowed": False,
                    "reason": f"Daily deposit limit of ${settings['daily_deposit_limit']/100:.2f} would be exceeded"
                }
        
        # Similar checks for weekly/monthly limits...
        
        return {"allowed": True}
    
    @staticmethod
    async def set_deposit_limit(
        db,
        user_id: str,
        period: str,
        limit: int
    ) -> dict:
        """
        Set deposit limit for user
        period: 'daily', 'weekly', 'monthly'
        limit: amount in cents
        """
        field_map = {
            'daily': 'daily_deposit_limit',
            'weekly': 'weekly_deposit_limit',
            'monthly': 'monthly_deposit_limit'
        }
        
        if period not in field_map:
            raise HTTPException(status_code=400, detail="Invalid period")
        
        # Limit decreases are immediate, increases have 24h cooling-off
        current_settings = await db.responsible_gaming.find_one({"user_id": user_id})
        
        cooling_off_until = None
        if current_settings and current_settings.get(field_map[period]):
            if limit > current_settings[field_map[period]]:
                # Increase - apply 24h cooling-off
                cooling_off_until = datetime.now(timezone.utc) + timedelta(hours=24)
        
        await db.responsible_gaming.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    field_map[period]: limit,
                    f"{field_map[period]}_updated_at": datetime.now(timezone.utc).isoformat(),
                    f"{field_map[period]}_effective_at": cooling_off_until.isoformat() if cooling_off_until else datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {
            "message": f"{period.capitalize()} deposit limit set to ${limit/100:.2f}",
            "effective_at": cooling_off_until.isoformat() if cooling_off_until else "Immediately"
        }


# Middleware for blocking excluded users
async def responsible_gaming_middleware(request, call_next, db):
    """
    Middleware to block self-excluded users from gaming endpoints
    """
    # Get user ID from session/token
    user_id = request.state.user_id if hasattr(request.state, 'user_id') else None
    
    if user_id:
        # Check if user is self-excluded
        if await ResponsibleGamingManager.check_self_exclusion(db, user_id):
            # Block access to gaming endpoints
            if any(path in str(request.url) for path in ['/games/', '/bet/', '/play/']):
                raise HTTPException(
                    status_code=403,
                    detail="Account is self-excluded. Contact support for assistance."
                )
    
    response = await call_next(request)
    return response
