"""
Smart Table Management API
Handles table registration, seating, spatial data for MetaHuman dealer integration
NOW WITH MONGODB PERSISTENCE - Tables survive server restarts!
"""
from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import uuid
from utils.database import get_database

router = APIRouter()

# ============================================================================
# DATA MODELS
# ============================================================================

class TableConfig(BaseModel):
    """Table configuration matching UE5 JSON spec"""
    table_name: str
    game_type: str  # Poker_Holdem, Bid_Whist, Baccarat
    max_players: int
    assets: Dict[str, str]
    spatial_data: Dict[str, List[float]]  # Coordinate markers

class SeatRequest(BaseModel):
    """Player seating request"""
    player_id: str
    player_name: str
    table_id: str
    seat_index: int

class BetRequest(BaseModel):
    """Bet verification request"""
    transaction_id: Optional[str] = None
    player_id: str
    table_id: str
    game_type: str
    currency_type: str = "GV_COIN"
    amount: float
    timestamp: Optional[str] = None

class KittyRequest(BaseModel):
    """Bid Whist kitty claim/bury"""
    table_id: str
    player_id: str
    discards: Optional[List[str]] = None

# ============================================================================
# SMART TABLE ACTOR
# ============================================================================

class SmartTableActor:
    """
    Python equivalent of UE5's ASmartTableActor
    Manages spatial data and game state for a single table
    """
    def __init__(self, config: TableConfig):
        self.table_id = str(uuid.uuid4())
        self.config = config
        self.game_type = config.game_type
        self.max_players = config.max_players
        self.spatial_data = config.spatial_data
        
        # Seating
        self.seats: List[Optional[Dict]] = [None] * config.max_players
        self.connected_clients: List[WebSocket] = []
        
        # Game state
        self.game_state = {
            "phase": "WAITING",  # WAITING, SEATING, BETTING, PLAYING, SCORING
            "current_player": None,
            "pot": 0.0,
            "hands_played": 0,
            "dealer_position": 0
        }
        
        # Bid Whist specific
        self.kitty_cards: List[str] = []
        self.buried_cards: List[str] = []
        self.winning_bidder: Optional[str] = None
        self.bid_type: Optional[str] = None  # UPTOWN, DOWNTOWN, NO_TRUMP
        
        # Baccarat specific
        self.player_hand: List[str] = []
        self.banker_hand: List[str] = []
        
        # Security: Locked funds
        self.locked_funds: Dict[str, Dict] = {}
    
    def get_placement_coordinates(self, placement_type: str) -> List[float]:
        """Get spatial coordinates for card/chip placement"""
        return self.spatial_data.get(placement_type, [0.0, 0.0, 0.0])
    
    def is_seat_available(self, seat_index: int) -> bool:
        """Check if seat is empty"""
        return 0 <= seat_index < self.max_players and self.seats[seat_index] is None
    
    def sit_player(self, player_id: str, player_name: str, seat_index: int) -> bool:
        """Seat a player at the table"""
        if not self.is_seat_available(seat_index):
            return False
        
        self.seats[seat_index] = {
            "player_id": player_id,
            "player_name": player_name,
            "balance": 0.0,
            "seated_at": datetime.now().isoformat()
        }
        return True
    
    def leave_seat(self, player_id: str) -> bool:
        """Remove player from table"""
        for i, seat in enumerate(self.seats):
            if seat and seat["player_id"] == player_id:
                self.seats[i] = None
                return True
        return False
    
    def get_seated_players(self) -> List[Dict]:
        """Get list of all seated players"""
        return [seat for seat in self.seats if seat is not None]

# ============================================================================
# TABLE MANAGER (LEGACY - Now using MongoDB)
# ============================================================================

class TableManager:
    """
    Legacy TableManager class - kept for backward compatibility
    but no longer used since migration to MongoDB persistence.
    All table operations now go through database queries.
    """
    def __init__(self):
        self.tables: Dict[str, SmartTableActor] = {}
    
    def create_table(self, config: TableConfig) -> str:
        """Legacy method - use MongoDB endpoint instead"""
        table = SmartTableActor(config)
        self.tables[table.table_id] = table
        return table.table_id
    
    def get_table(self, table_id: str) -> Optional[SmartTableActor]:
        """Legacy method - use MongoDB endpoint instead"""
        return self.tables.get(table_id)
    
    def remove_table(self, table_id: str):
        """Legacy method - use MongoDB endpoint instead"""
        if table_id in self.tables:
            del self.tables[table_id]
    
    def get_tables_by_game(self, game_type: str) -> List[SmartTableActor]:
        """Legacy method - use MongoDB endpoint instead"""
        return [t for t in self.tables.values() if t.game_type == game_type]

# Legacy global instance (unused after MongoDB migration)
table_manager = TableManager()

# ============================================================================
# REST ENDPOINTS
# ============================================================================

@router.post("/tables/create")
async def create_smart_table(config: TableConfig) -> Dict[str, Any]:
    """
    Create a new smart table and persist to MongoDB.
    Tables now survive server restarts!
    """
    db = get_database()
    
    table_id = str(uuid.uuid4())
    
    table_data = {
        "table_id": table_id,
        "game_type": config.game_type,
        "table_name": config.table_name,
        "max_players": config.max_players,
        "assets": config.assets,
        "spatial_data": config.spatial_data,
        "seats": [None] * config.max_players,
        "game_state": {
            "phase": "WAITING",
            "current_player": None,
            "pot": 0.0,
            "hands_played": 0,
            "dealer_position": 0
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.smart_tables.insert_one(table_data)
    
    print(f"✅ Created {config.game_type} table: {table_id}")
    
    return {
        "success": True,
        "table_id": table_id,
        "game_type": config.game_type,
        "max_players": config.max_players
    }

@router.get("/tables/list")
async def list_tables(game_type: Optional[str] = None) -> Dict[str, Any]:
    """List all active tables from MongoDB"""
    db = get_database()
    
    query = {}
    if game_type:
        query["game_type"] = game_type
    
    tables = await db.smart_tables.find(query, {"_id": 0}).to_list(100)
    
    return {
        "total": len(tables),
        "tables": [
            {
                "table_id": t["table_id"],
                "game_type": t["game_type"],
                "seated_players": len([s for s in t["seats"] if s is not None]),
                "max_players": t["max_players"],
                "status": t["game_state"]["phase"]
            }
            for t in tables
        ]
    }

@router.get("/tables/{table_id}/state")
async def get_table_state(table_id: str) -> Dict[str, Any]:
    """Get full table state from MongoDB"""
    db = get_database()
    
    table = await db.smart_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return {
        "table_id": table_id,
        "game_type": table["game_type"],
        "game_state": table["game_state"],
        "seats": table["seats"],
        "seated_count": len([s for s in table["seats"] if s is not None]),
        "spatial_data": table["spatial_data"]
    }

@router.post("/tables/{table_id}/sit")
async def sit_at_table(table_id: str, request: SeatRequest) -> Dict[str, Any]:
    """Sit a player at a table (persisted to MongoDB)"""
    db = get_database()
    
    table = await db.smart_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if seat is available
    if not (0 <= request.seat_index < table["max_players"]):
        raise HTTPException(status_code=400, detail="Invalid seat index")
    
    if table["seats"][request.seat_index] is not None:
        raise HTTPException(status_code=400, detail="Seat is occupied")
    
    # Update seat in database
    seat_data = {
        "player_id": request.player_id,
        "player_name": request.player_name,
        "balance": 0.0,
        "seated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.smart_tables.update_one(
        {"table_id": table_id},
        {
            "$set": {
                f"seats.{request.seat_index}": seat_data,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Get camera position from spatial data
    camera_key = f"P{request.seat_index + 1}_Camera"
    camera_anchor = table["spatial_data"].get(camera_key, [0.0, 0.0, 0.0])
    
    return {
        "success": True,
        "message": f"{request.player_name} seated at position {request.seat_index}",
        "camera_anchor": camera_anchor
    }

@router.post("/tables/{table_id}/leave")
async def leave_table(table_id: str, player_id: str) -> Dict[str, Any]:
    """Leave a table (update in MongoDB)"""
    db = get_database()
    
    table = await db.smart_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Find and remove player
    found = False
    for i, seat in enumerate(table["seats"]):
        if seat and seat["player_id"] == player_id:
            await db.smart_tables.update_one(
                {"table_id": table_id},
                {
                    "$set": {
                        f"seats.{i}": None,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            found = True
            break
    
    return {
        "success": found,
        "message": "Left table" if found else "Player not found at table"
    }

@router.get("/tables/{table_id}/spatial/{placement_type}")
async def get_placement(table_id: str, placement_type: str) -> Dict[str, Any]:
    """Get spatial coordinates for a placement type"""
    db = get_database()
    
    table = await db.smart_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    coords = table["spatial_data"].get(placement_type, [0.0, 0.0, 0.0])
    
    return {
        "placement_type": placement_type,
        "coordinates": coords
    }
