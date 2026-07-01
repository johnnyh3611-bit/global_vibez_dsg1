"""
AI Dealer API Routes
Endpoints for dealer personality, reactions, and game commentary
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Optional, List, Any
import json

from services.dealer_personality import dealer_engine
from services.spades_referee import spades_referee

router = APIRouter()

class GameEvent(BaseModel):
    event_type: str
    player_id: Optional[str] = None
    player_name: Optional[str] = "Player"
    context: Dict = {}

class PlayerStats(BaseModel):
    player_id: str
    session_net: int = 0
    win_rate: float = 0.5
    high_stakes: bool = False
    games_played: int = 0

@router.post("/dealer/reaction")
async def get_dealer_reaction(event: GameEvent) -> Dict[str, Any]:
    """
    Get dealer's behavioral response to a game event
    """
    try:
        reaction = dealer_engine.get_reaction_for_game_event(
            event.event_type,
            event.context
        )
        
        return {
            "success": True,
            "reaction": reaction.dict()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "reaction": {
                "animation": "neutral",
                "voice_line": "",
                "delay_ms": 500,
                "facial_expression": "neutral",
                "intensity": 0.3
            }
        }

@router.post("/dealer/greeting")
async def get_personalized_greeting(player_id: str, player_name: str) -> Dict[str, Any]:
    """
    Get personalized greeting based on player history
    """
    greeting = dealer_engine.get_personalized_greeting(player_id, player_name)
    
    return {
        "greeting": greeting,
        "animation": "welcoming_gesture",
        "delay_ms": 800
    }

@router.post("/dealer/update-memory")
async def update_player_memory(player_id: str, event: str, value: Optional[Any] = None) -> Dict[str, Any]:
    """
    Update dealer's memory of player for personalized interactions
    """
    dealer_engine.remember_player(player_id, event, value)
    
    return {"success": True}

@router.post("/dealer/vibe")
async def get_dealer_vibe(stats: PlayerStats) -> Dict[str, Any]:
    """
    Get current dealer mood based on player stats
    """
    vibe = dealer_engine.get_dealer_vibe(stats.dict())
    
    return {
        "vibe": vibe,
        "personality": dealer_engine.personality.dict()
    }

@router.post("/dealer/social-commentary")
async def get_social_commentary(player_a: str, player_b: str, game_event: str) -> Dict[str, Any]:
    """
    Get social/dating commentary for player interactions
    """
    commentary = dealer_engine.get_social_commentary(player_a, player_b, game_event)
    
    return {
        "commentary": commentary,
        "animation": "social_gesture",
        "delay_ms": 1000
    }

class RenegueCheck(BaseModel):
    player_hand: List[str]
    suit_led: str
    card_played: str

# Spades-specific endpoints
@router.post("/dealer/spades/check-renegue")
async def check_spades_renegue(data: RenegueCheck) -> Dict[str, Any]:
    """
    Check if a player reneged in Spades
    """
    result = spades_referee.check_renegue(data.player_hand, data.suit_led, data.card_played)
    
    return result

@router.post("/dealer/spades/validate-bid")
async def validate_spades_bid(player_id: str, bid: int, is_nil: bool = False, is_blind_nil: bool = False) -> Dict[str, Any]:
    """
    Validate a Spades bid and get dealer reaction
    """
    from services.spades_referee import SpadesBid
    
    bid_obj = SpadesBid(
        player_id=player_id,
        bid=bid,
        is_nil=is_nil,
        is_blind_nil=is_blind_nil
    )
    
    result = spades_referee.validate_bid(bid_obj)
    
    return result

@router.post("/dealer/spades/check-10-for-200")
async def check_ten_for_200(team_bids: Dict[str, int]) -> Dict[str, Any]:
    """
    Check if teams bid 10-for-200
    """
    result = spades_referee.check_ten_for_200(team_bids)
    
    return result or {"no_special_event": True}

@router.get("/dealer/spades/fair-deck")
async def get_fair_deck() -> Dict[str, Any]:
    """
    Generate provably fair deck with verification hash
    """
    deck, hash, seed = spades_referee.generate_fair_deck()
    
    return {
        "deck": deck,
        "verification_hash": hash,
        "message": "Hash generated before dealing. Verify fairness after game.",
        "dealer_animation": "deck_shuffle_with_cut"
    }

# WebSocket for real-time dealer interactions
class DealerConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[game_id] = websocket
    
    def disconnect(self, game_id: str):
        if game_id in self.active_connections:
            del self.active_connections[game_id]
    
    async def send_dealer_action(self, game_id: str, action: dict):
        if game_id in self.active_connections:
            await self.active_connections[game_id].send_json(action)

dealer_manager = DealerConnectionManager()

@router.websocket("/dealer-ws/{game_id}")
async def dealer_websocket(websocket: WebSocket, game_id: str) -> Dict[str, Any]:
    """
    WebSocket for real-time dealer interactions during gameplay
    Connected via: /api/dealer-ws/{game_id}
    """
    await dealer_manager.connect(game_id, websocket)
    
    try:
        while True:
            # Receive player action
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Process dealer response based on action type
            if message['type'] == 'game_event':
                reaction = dealer_engine.get_reaction_for_game_event(
                    message['event_type'],
                    message.get('context', {})
                )
                
                await websocket.send_json({
                    "type": "DEALER_REACTION",
                    "payload": reaction.dict()
                })
            
            elif message['type'] == 'idle_warning':
                # Dealer nudges idle player
                await websocket.send_json({
                    "type": "DEALER_NUDGE",
                    "payload": {
                        "animation": "impatient_tap",
                        "voice_line": "The table is waiting on you, friend.",
                        "look_at": message.get('player_id'),
                        "delay_ms": 0
                    }
                })
            
            elif message['type'] == 'request_commentary':
                commentary = spades_referee.get_dealer_commentary(message.get('game_state', {}))
                if commentary:
                    await websocket.send_json({
                        "type": "DEALER_COMMENTARY",
                        "payload": {
                            "voice_line": commentary,
                            "animation": "thoughtful_comment",
                            "delay_ms": 800
                        }
                    })
            
    except WebSocketDisconnect:
        dealer_manager.disconnect(game_id)
    except Exception as e:
        print(f"Dealer WebSocket error: {e}")
        dealer_manager.disconnect(game_id)
