from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/tables", tags=["tables"])


class PurchaseTableRequest(BaseModel):
    table_id: str


class TableOwnership(BaseModel):
    table_id: str
    name: str
    purchased_at: datetime
    expires_at: datetime
    is_expired: bool


# Available house views configuration
AVAILABLE_HOUSES = {
    # FREE HOUSES (3)
    "classic": {
        "id": "classic",
        "name": "Classic House",
        "description": "Traditional green felt casino table",
        "category": "traditional",
        "cost": 0,
        "is_default": True,
        "is_free": True
    },
    "emerald_elite": {
        "id": "emerald_elite",
        "name": "Emerald Elite House",
        "description": "Classic green with walnut wood and brass accents",
        "category": "traditional",
        "cost": 0,
        "is_default": False,
        "is_free": True
    },
    "cyber_terminal": {
        "id": "cyber_terminal",
        "name": "Cyber Terminal House",
        "description": "Minimalist tech with cyan and white aesthetic",
        "category": "cyberpunk",
        "cost": 0,
        "is_default": False,
        "is_free": True
    },
    
    # PREMIUM TRADITIONAL HOUSES (2)
    "royal_mahogany": {
        "id": "royal_mahogany",
        "name": "Royal Mahogany House",
        "description": "Luxury burgundy felt with gold inlay details",
        "category": "traditional",
        "cost": 4500,
        "is_default": False,
        "is_free": False
    },
    "sapphire_royale": {
        "id": "sapphire_royale",
        "name": "Sapphire Royale House",
        "description": "Royal blue velvet with chrome accents",
        "category": "traditional",
        "cost": 5000,
        "is_default": False,
        "is_free": False
    },
    
    # PREMIUM CYBERPUNK HOUSES (7)
    "neon_grid_matrix": {
        "id": "neon_grid_matrix",
        "name": "Neon Grid Matrix House",
        "description": "Tron-style electric blue and cyan holographic grid",
        "category": "cyberpunk",
        "cost": 6000,
        "is_default": False,
        "is_free": False
    },
    "cyberpunk_metropolis": {
        "id": "cyberpunk_metropolis",
        "name": "Cyberpunk Metropolis House",
        "description": "Blade Runner pink and purple with digital rain",
        "category": "cyberpunk",
        "cost": 7500,
        "is_default": False,
        "is_free": False
    },
    "digital_hacker": {
        "id": "digital_hacker",
        "name": "Digital Hacker House",
        "description": "Matrix green code streams and terminal aesthetic",
        "category": "cyberpunk",
        "cost": 5500,
        "is_default": False,
        "is_free": False
    },
    "neon_arcade": {
        "id": "neon_arcade",
        "name": "Neon Arcade House",
        "description": "80s arcade rainbow multicolor explosion",
        "category": "cyberpunk",
        "cost": 6500,
        "is_default": False,
        "is_free": False
    },
    "holographic_casino": {
        "id": "holographic_casino",
        "name": "Holographic Casino House",
        "description": "Futuristic Vegas with holographic cards",
        "category": "cyberpunk",
        "cost": 8000,
        "is_default": False,
        "is_free": False
    },
    "neon_nightclub": {
        "id": "neon_nightclub",
        "name": "Neon Nightclub House",
        "description": "Underground club with pulsing UV lights",
        "category": "cyberpunk",
        "cost": 7000,
        "is_default": False,
        "is_free": False
    },
    "synthwave_sunset": {
        "id": "synthwave_sunset",
        "name": "Synthwave Sunset House",
        "description": "80s retrowave purple pink gradient paradise",
        "category": "cyberpunk",
        "cost": 7500,
        "is_default": False,
        "is_free": False
    }
}

# Free color customization options
COLOR_OPTIONS = {
    "felt": {
        "green": {"name": "Classic Green", "hex": "#1a4d2e"},
        "red": {"name": "Casino Red", "hex": "#8b1a1a"},
        "blue": {"name": "Royal Blue", "hex": "#1e3a8a"},
        "black": {"name": "Midnight Black", "hex": "#0f1419"},
        "purple": {"name": "Imperial Purple", "hex": "#6b21a8"},
        "yellow": {"name": "Golden Yellow", "hex": "#ca8a04"}
    },
    "border": {
        "walnut": {"name": "Walnut Brown", "hex": "#5d4037"},
        "black": {"name": "Ebony Black", "hex": "#1a1a1a"},
        "gold": {"name": "Gold Trim", "hex": "#d4af37"},
        "silver": {"name": "Silver Chrome", "hex": "#c0c0c0"},
        "oak": {"name": "Oak Tan", "hex": "#8b7355"}
    }
}


@router.get("/available")
async def get_available_houses() -> Dict[str, Any]:
    """Get list of all available house views with pricing"""
    return {
        "houses": list(AVAILABLE_HOUSES.values()),
        "color_options": COLOR_OPTIONS
    }


@router.get("/owned")
async def get_owned_tables(request: Request) -> Dict[str, Any]:
    """Get user's owned tables (including expired status)"""
    db = get_database()
    current_user = await get_current_user(request)
    
    # Return 401 if user not authenticated (instead of letting it fail with 500)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = current_user.user_id
    
    # Get user's owned tables
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    owned_tables = user.get("owned_tables", [])
    now = datetime.now(timezone.utc)
    
    result = []
    
    # Always include default table
    result.append({
        "table_id": "simple_clean",
        "name": "Classic Table",
        "purchased_at": None,
        "expires_at": None,
        "is_expired": False,
        "is_default": True
    })
    
    # Add purchased tables with expiry check
    for table in owned_tables:
        table_info = AVAILABLE_HOUSES.get(table["table_id"])
        if not table_info:
            continue
            
        expires_at = table["expires_at"]
        is_expired = expires_at < now
        
        result.append({
            "table_id": table["table_id"],
            "name": table_info["name"],
            "purchased_at": table["purchased_at"].isoformat(),
            "expires_at": expires_at.isoformat(),
            "is_expired": is_expired,
            "is_default": False
        })
    
    return {"owned_tables": result}


@router.post("/colors")
async def update_custom_colors(
    request: Request,
    colors: dict
) -> Dict[str, Any]:
    """Update user's custom color preferences (FREE)"""
    db = get_database()
    current_user = await get_current_user(request)
    user_id = current_user.user_id
    
    # Validate colors
    felt_color = colors.get("felt", "green")
    border_color = colors.get("border", "walnut")
    
    if felt_color not in COLOR_OPTIONS["felt"]:
        raise HTTPException(status_code=400, detail="Invalid felt color")
    if border_color not in COLOR_OPTIONS["border"]:
        raise HTTPException(status_code=400, detail="Invalid border color")
    
    # Update user colors
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "custom_colors.felt": felt_color,
            "custom_colors.border": border_color
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "message": "Colors updated successfully",
        "colors": {
            "felt": felt_color,
            "border": border_color
        }
    }
async def purchase_table(
    request: Request,
    purchase_request: PurchaseTableRequest
) -> Dict[str, Any]:
    """Purchase a table (2-week ownership)"""
    db = get_database()
    current_user = await get_current_user(request)
    user_id = current_user.user_id
    table_id = purchase_request.table_id
    
    # Check if table exists
    table_info = AVAILABLE_HOUSES.get(table_id)
    if not table_info:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Can't purchase default table
    if table_info["is_default"]:
        raise HTTPException(status_code=400, detail="Default table is already owned")
    
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already owns this table (and it's not expired)
    owned_tables = user.get("owned_tables", [])
    now = datetime.now(timezone.utc)
    
    for table in owned_tables:
        if table["table_id"] == table_id and table["expires_at"] > now:
            return {
                "message": "Table already owned",
                "table_id": table_id,
                "expires_at": table["expires_at"].isoformat()
            }
    
    # Check if user has enough coins
    user_coins = user.get("coins", 0)
    cost = table_info["cost"]
    
    if user_coins < cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient coins. Need {cost}, have {user_coins}"
        )
    
    # Purchase table
    purchase_time = now
    expiry_time = now + timedelta(weeks=2)
    
    # Deduct coins
    new_coins = user_coins - cost
    
    # Add to owned tables (or update expiry if re-purchasing)
    table_exists = False
    for i, table in enumerate(owned_tables):
        if table["table_id"] == table_id:
            owned_tables[i] = {
                "table_id": table_id,
                "purchased_at": purchase_time,
                "expires_at": expiry_time
            }
            table_exists = True
            break
    
    if not table_exists:
        owned_tables.append({
            "table_id": table_id,
            "purchased_at": purchase_time,
            "expires_at": expiry_time
        })
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "coins": new_coins,
                "owned_tables": owned_tables
            }
        }
    )
    
    return {
        "message": "Table purchased successfully",
        "table_id": table_id,
        "table_name": table_info["name"],
        "cost": cost,
        "remaining_coins": new_coins,
        "expires_at": expiry_time.isoformat()
    }


@router.get("/selected")
async def get_selected_table(request: Request) -> Dict[str, Any]:
    """Get user's currently selected table"""
    db = get_database()
    current_user = await get_current_user(request)
    user_id = current_user.user_id
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    selected_table = user.get("selected_table", "simple_clean")
    
    # Check if selected table is still owned (if not default)
    if selected_table != "simple_clean":
        owned_tables = user.get("owned_tables", [])
        now = datetime.now(timezone.utc)
        
        is_owned = False
        for table in owned_tables:
            if table["table_id"] == selected_table and table["expires_at"] > now:
                is_owned = True
                break
        
        # If not owned anymore, revert to default
        if not is_owned:
            selected_table = "simple_clean"
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"selected_table": "simple_clean"}}
            )
    
    table_info = AVAILABLE_HOUSES.get(selected_table)
    
    return {
        "selected_table": selected_table,
        "table_name": table_info["name"] if table_info else "Classic Table"
    }


@router.post("/select")
async def select_table(
    request: Request,
    select_request: PurchaseTableRequest
) -> Dict[str, Any]:
    """Select a table as active (must own it or be default)"""
    db = get_database()
    current_user = await get_current_user(request)
    user_id = current_user.user_id
    table_id = select_request.table_id
    
    # Check if table exists
    table_info = AVAILABLE_HOUSES.get(table_id)
    if not table_info:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # If not default, check ownership
    if not table_info["is_default"]:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        owned_tables = user.get("owned_tables", [])
        now = datetime.now(timezone.utc)
        
        is_owned = False
        for table in owned_tables:
            if table["table_id"] == table_id and table["expires_at"] > now:
                is_owned = True
                break
        
        if not is_owned:
            raise HTTPException(status_code=403, detail="You don't own this table")
    
    # Update selected table
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"selected_table": table_id}}
    )
    
    return {
        "message": "Table selected",
        "table_id": table_id,
        "table_name": table_info["name"]
    }
