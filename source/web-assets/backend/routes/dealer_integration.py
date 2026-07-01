"""
MetaHuman Dealer Animation Integration
Connects smart tables to the existing tournament.py MetaHuman dealer system
"""
from fastapi import APIRouter
from typing import Dict, Any
import asyncio

router = APIRouter()

# Import existing tournament system
try:
    from routes.tournament import active_tables, broadcast_to_table
except ImportError:
    active_tables = {}
    async def broadcast_to_table(table_id: str, message: dict):
        print(f"Broadcasting to {table_id}: {message}")

# ============================================================================
# DEALER ANIMATION TRIGGERS
# ============================================================================

DEALER_ANIMATIONS = {
    # Poker Events
    "POKER_BIG_BET": {
        "animation": "MT_High_Stakes_Focus",
        "speech": "Now that's a serious bet. Let's see if it pays off.",
        "facial_expression": "professional_intensity",
        "vibe": "Intense"
    },
    
    # Bid Whist Events
    "BID_WHIST_TEN_FOR_200": {
        "animation": "MT_10_for_200_Excited",
        "speech": "Ten tricks bid! The big two-hundred is on the line. Bold move!",
        "facial_expression": "excited_celebration",
        "vibe": "Intense"
    },
    
    "BID_WHIST_RENEGUE": {
        "animation": "MT_Renegue_Penalty",
        "speech": "Hold on! That's a renege. Three book penalty. Rules are rules.",
        "facial_expression": "professional_stern",
        "vibe": "Strict"
    },
    
    "BID_WHIST_KITTY_CLAIM": {
        "animation": "MT_Kitty_Slide",
        "speech": "Here's your kitty. Choose your six cards to bury wisely.",
        "facial_expression": "professional_focus",
        "vibe": "Neutral"
    },
    
    # UNO Events  
    "UNO_STACK_ATTACK": {
        "animation": "MT_Stack_Point",
        "speech": "Stacking penalties! This is getting intense.",
        "facial_expression": "excited_intensity",
        "vibe": "Social"
    },
    
    "UNO_SWAP_HANDS": {
        "animation": "MT_Magic_Swap",
        "speech": "Hands swapped! A little magic at the table.",
        "facial_expression": "playful_smile",
        "vibe": "Social"
    },
    
    "UNO_BOMB_CARD": {
        "animation": "MT_Boom_Gesture",
        "speech": "BOOM! Your hand just got reset. Tough break.",
        "facial_expression": "aggressive_excitement",
        "vibe": "Intense"
    },
    
    # Baccarat Events
    "BACCARAT_NATURAL_9": {
        "animation": "MT_Natural_Elegance",
        "speech": "Natural nine. Beautiful hand.",
        "facial_expression": "professional_approval",
        "vibe": "Neutral"
    },
    
    # Matrix Tic-Tac-Toe
    "MATRIX_WIN": {
        "animation": "MT_Grid_Victory",
        "speech": "Connected! We have a winner.",
        "facial_expression": "excited_celebration",
        "vibe": "Social"
    },
    
    # Generic Events
    "WELCOME_PLAYER": {
        "animation": "MT_Welcoming_Gesture",
        "speech": "Welcome to the table. Let's have a great game.",
        "facial_expression": "professional_smile",
        "vibe": "Neutral"
    },
    
    "JACKPOT_WIN": {
        "animation": "MT_Jackpot_Celebration",
        "speech": "JACKPOT! Now that's what I'm talking about! Congratulations!",
        "facial_expression": "excited_celebration",
        "vibe": "Social"
    },
    
    "BET_APPROVED": {
        "animation": "MT_Approving_Nod",
        "speech": "Bet secured. Good luck.",
        "facial_expression": "professional_focus",
        "vibe": "Neutral"
    },
    
    "BET_REJECTED": {
        "animation": "MT_Disapproving_Shake",
        "speech": "Insufficient funds. Please add more Global Vibez Coins.",
        "facial_expression": "professional_concern",
        "vibe": "Neutral"
    }
}

# ============================================================================
# TRIGGER DEALER ANIMATION
# ============================================================================

@router.post("/dealer/trigger/{table_id}/{event_type}")
async def trigger_dealer_animation(table_id: str, event_type: str, player_id: str = None) -> Dict[str, Any]:
    """
    Trigger a MetaHuman dealer animation and broadcast to all players at table
    """
    if event_type not in DEALER_ANIMATIONS:
        return {"error": f"Unknown event type: {event_type}"}
    
    dealer_event = DEALER_ANIMATIONS[event_type]
    
    # Create the event payload for UE5 MetaHuman
    event_payload = {
        "type": "DEALER_ANIMATION",
        "table_id": table_id,
        "event_type": event_type,
        "animation": dealer_event["animation"],
        "data": {
            "speech": dealer_event["speech"],
            "facial_expression": dealer_event["facial_expression"],
            "vibe": dealer_event["vibe"],
            "intensity": 0.8,
            "target_player": player_id
        },
        "timestamp": asyncio.get_event_loop().time()
    }
    
    # Broadcast to all connected clients at this table
    if table_id in active_tables:
        await broadcast_to_table(table_id, event_payload)
    
    return {
        "success": True,
        "event": event_type,
        "animation": dealer_event["animation"],
        "speech": dealer_event["speech"]
    }

@router.get("/dealer/animations")
async def list_dealer_animations() -> Dict[str, Any]:
    """Get list of all available dealer animations"""
    return {
        "total_animations": len(DEALER_ANIMATIONS),
        "animations": {
            key: {
                "animation": val["animation"],
                "speech_preview": val["speech"][:50] + "...",
                "vibe": val["vibe"]
            }
            for key, val in DEALER_ANIMATIONS.items()
        }
    }

# ============================================================================
# SPATIAL COORDINATE QUERIES (FOR UE5)
# ============================================================================

@router.get("/dealer/coordinates/{table_id}/{placement_type}")
async def get_dealer_placement(table_id: str, placement_type: str) -> Dict[str, Any]:
    """
    Return spatial coordinates for dealer to place cards/chips
    Used by UE5 to know exact 3D positions
    """
    # This integrates with smart_tables.py spatial data
    from routes.smart_tables import table_manager
    
    table = table_manager.get_table(table_id)
    if not table:
        return {"error": "Table not found"}
    
    coords = table.get_placement_coordinates(placement_type)
    
    return {
        "table_id": table_id,
        "placement_type": placement_type,
        "coordinates": {
            "x": coords[0] if len(coords) > 0 else 0.0,
            "y": coords[1] if len(coords) > 1 else 0.0,
            "z": coords[2] if len(coords) > 2 else 0.0
        },
        "game_type": table.game_type
    }

@router.post("/dealer/card-deal/{table_id}")
async def trigger_card_deal(table_id: str, card_id: str, target_player: int, card_position: str) -> Dict[str, Any]:
    """
    Trigger dealer to physically deal a card in UE5
    """
    from routes.smart_tables import table_manager
    
    table = table_manager.get_table(table_id)
    if not table:
        return {"error": "Table not found"}
    
    # Get target coordinates
    placement_key = f"P{target_player}_Card_Pos_{card_position}"
    coords = table.get_placement_coordinates(placement_key)
    
    # Broadcast card deal event to UE5 clients
    event = {
        "type": "DEALER_CARD_DEAL",
        "table_id": table_id,
        "card_id": card_id,
        "target_player": target_player,
        "target_coordinates": coords,
        "animation": "MT_Deal_Card_Smooth"
    }
    
    if table_id in active_tables:
        await broadcast_to_table(table_id, event)
    
    return {
        "success": True,
        "card_dealt": card_id,
        "target_coords": coords
    }
