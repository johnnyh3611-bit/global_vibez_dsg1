"""
Tournament WebSocket Server for UE5 MetaHuman AI Dealer Integration
Handles real-time communication between FastAPI backend and Unreal Engine 5.5
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import json
from datetime import datetime

from services.dealer_personality import dealer_engine

router = APIRouter()

class PlayerAction(BaseModel):
    player_id: str
    player_name: str
    action_type: str  # BID, PLAY_CARD, CHAT, etc.
    value: Optional[int] = None
    card: Optional[str] = None
    metadata: Optional[Dict] = None

class DealerEvent(BaseModel):
    """
    Event structure sent to UE5 MetaHuman
    """
    type: str  # DEALER_EVENT, DEALER_CMD, DEALER_REACTION
    data: Dict
    timestamp: str

class TournamentTable:
    """
    Manages a single tournament table with multiple players and UE5 MetaHuman dealer
    """
    def __init__(self, table_id: str):
        self.table_id = table_id
        self.clients: List[WebSocket] = []  # Connected UE5 clients and web clients
        self.players: Dict[str, dict] = {}
        self.current_bids: Dict[str, int] = {}
        self.is_high_stakes = False
        self.game_state = {
            "phase": "WAITING",  # WAITING, BIDDING, PLAYING, SCORING
            "current_player": None,
            "pot": 0,
            "hands_played": 0
        }
        
    async def connect_client(self, websocket: WebSocket):
        """Connect a new client (UE5 or web)"""
        await websocket.accept()
        self.clients.append(websocket)
        print(f"✅ Client connected to table {self.table_id}. Total clients: {len(self.clients)}")
        
        # Send initial table state
        await websocket.send_json({
            "type": "TABLE_STATE",
            "data": {
                "table_id": self.table_id,
                "game_state": self.game_state,
                "players": self.players,
                "timestamp": datetime.now().isoformat()
            }
        })
    
    def disconnect_client(self, websocket: WebSocket):
        """Disconnect a client"""
        if websocket in self.clients:
            self.clients.remove(websocket)
            print(f"🔌 Client disconnected from table {self.table_id}. Remaining: {len(self.clients)}")
    
    async def broadcast_dealer_event(
        self, 
        event_type: str, 
        animation: str, 
        speech: str, 
        vibe: str = "Neutral",
        facial_expression: str = "neutral",
        intensity: float = 0.5,
        delay_ms: float = 500,
        metadata: Optional[Dict] = None,
    ):
        """
        Broadcast dealer event to all connected clients (UE5 MetaHuman + Web)
        This triggers animations, voice, and facial expressions in Unreal Engine
        """
        if metadata is None:
            metadata = {}
        event = {
            "type": "DEALER_EVENT",
            "data": {
                "action": event_type,
                "animation": animation,  # UE5 Animation Montage Tag (e.g., MT_Renegue_Penalty)
                "speech": speech,  # Text for MetaSound voice synthesis
                "vibe": vibe,
                "facial_expression": facial_expression,
                "intensity": intensity,
                "delay_ms": delay_ms,
                "metadata": metadata,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Broadcast to all clients
        disconnected_clients = []
        for client in self.clients:
            try:
                await client.send_json(event)
            except Exception as e:
                print(f"❌ Failed to send to client: {e}")
                disconnected_clients.append(client)
        
        # Clean up disconnected clients
        for client in disconnected_clients:
            self.disconnect_client(client)
    
    async def handle_player_action(self, action: PlayerAction):
        """
        Process player action and trigger appropriate dealer response
        Integrates with existing dealer_personality.py
        """
        player_name = action.player_name
        
        # Handle different action types
        if action.action_type == "BID":
            self.current_bids[action.player_id] = action.value
            
            # Check for special bids
            if action.value == 10:
                # 10-for-200 bid detected
                await self.broadcast_dealer_event(
                    event_type="TEN_FOR_200",
                    animation="MT_10_for_200_Excited",
                    speech=f"{player_name}, ten tricks? The big two-hundred is on the line. Success doubles your score, failure costs you just as much. Good luck.",
                    vibe="Intense",
                    facial_expression="serious_focus",
                    intensity=1.0,
                    delay_ms=1800
                )
                self.is_high_stakes = True
                
            elif action.metadata.get("is_nil"):
                # Nil bid detected
                await self.broadcast_dealer_event(
                    event_type="NIL_BID",
                    animation="MT_Nil_Respectful",
                    speech=f"{player_name} is going for Nil. Bold move. Let's see if you can avoid taking any tricks.",
                    vibe="Supportive",
                    facial_expression="respectful_focus",
                    intensity=0.7,
                    delay_ms=1200
                )
                
            elif action.metadata.get("is_blind_nil"):
                # Blind Nil bid detected
                await self.broadcast_dealer_event(
                    event_type="BLIND_NIL",
                    animation="MT_BlindNil_Impressed",
                    speech=f"Blind Nil from {player_name}? That takes courage. Fortune favors the bold... or punishes the reckless.",
                    vibe="Challenging",
                    facial_expression="respectful_intensity",
                    intensity=0.9,
                    delay_ms=1500
                )
            else:
                # Regular bid - use dealer personality engine
                reaction = dealer_engine.get_reaction_for_game_event(
                    "poker_big_pot" if action.value >= 7 else "spades_perfect_bid",
                    {"player_name": player_name, "bid": action.value}
                )
                await self.broadcast_dealer_event(
                    event_type="BID_REACTION",
                    animation=reaction.animation,
                    speech=reaction.voice_line,
                    facial_expression=reaction.facial_expression,
                    intensity=reaction.intensity,
                    delay_ms=reaction.delay_ms
                )
        
        elif action.action_type == "PLAY_CARD":
            # Check for renegue (handled by existing spades_referee)
            
            # Note: This would need actual hand data from game state
            # For now, we'll trigger dealer reactions based on card plays
            
            if action.metadata.get("is_winning_card"):
                await self.broadcast_dealer_event(
                    event_type="WINNING_PLAY",
                    animation="MT_Approving_Nod",
                    speech="Nice play. That trick is yours.",
                    vibe="Neutral",
                    facial_expression="professional_smile",
                    intensity=0.6,
                    delay_ms=800
                )
        
        elif action.action_type == "RENEGUE":
            # Renegue detected - stern dealer reaction
            await self.broadcast_dealer_event(
                event_type="RENEGUE_PENALTY",
                animation="MT_Renegue_Penalty",
                speech=f"Hold on, {player_name}. That's a renege. You've still got that suit in your hand. Play fair. Three book penalty.",
                vibe="Strict",
                facial_expression="professional_stern",
                intensity=0.8,
                delay_ms=300,
                metadata={"penalty": -3}
            )
        
        elif action.action_type == "CHAT":
            # Social interaction - use social commentary
            commentary = dealer_engine.get_social_commentary(
                action.player_id,
                action.metadata.get("target_player", ""),
                action.metadata.get("context", "casual_chat")
            )
            
            await self.broadcast_dealer_event(
                event_type="SOCIAL_COMMENT",
                animation="MT_Social_Gesture",
                speech=commentary,
                vibe="Social",
                facial_expression="playful_smile",
                intensity=0.6,
                delay_ms=1000
            )

# Global table manager
class TournamentManager:
    """
    Manages multiple tournament tables
    """
    def __init__(self):
        self.tables: Dict[str, TournamentTable] = {}
    
    def get_or_create_table(self, table_id: str) -> TournamentTable:
        if table_id not in self.tables:
            self.tables[table_id] = TournamentTable(table_id)
            print(f"✅ Created new tournament table: {table_id}")
        return self.tables[table_id]
    
    def remove_table(self, table_id: str):
        if table_id in self.tables:
            del self.tables[table_id]
            print(f"🗑️ Removed tournament table: {table_id}")

# Global manager instance
tournament_manager = TournamentManager()

# WebSocket endpoint for UE5 MetaHuman connection
@router.websocket("/ws/tournament/{table_id}")
async def tournament_websocket(websocket: WebSocket, table_id: str) -> Dict[str, Any]:
    """
    WebSocket endpoint for UE5 MetaHuman AI Dealer
    This is what the C++ DealerAIController connects to
    """
    table = tournament_manager.get_or_create_table(table_id)
    await table.connect_client(websocket)
    
    try:
        while True:
            # Receive messages from UE5 or web clients
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message['type'] == 'PLAYER_ACTION':
                action = PlayerAction(**message['data'])
                await table.handle_player_action(action)
            
            elif message['type'] == 'GAME_STATE_UPDATE':
                # Update table game state
                table.game_state.update(message['data'])
                
                # Broadcast to all clients
                await websocket.send_json({
                    "type": "STATE_SYNCED",
                    "data": table.game_state
                })
            
            elif message['type'] == 'REQUEST_DEALER_GREETING':
                # Request personalized greeting
                player_id = message['data'].get('player_id', 'unknown')
                player_name = message['data'].get('player_name', 'Player')
                
                greeting = dealer_engine.get_personalized_greeting(player_id, player_name)
                
                await table.broadcast_dealer_event(
                    event_type="GREETING",
                    animation="MT_Welcoming_Gesture",
                    speech=greeting,
                    vibe="Neutral",
                    facial_expression="professional_smile",
                    intensity=0.5,
                    delay_ms=800
                )
            
            elif message['type'] == 'TRIGGER_PROVABLY_FAIR':
                # Request provably fair deck
                from services.spades_referee import spades_referee
                
                deck, hash_value, seed = spades_referee.generate_fair_deck()
                
                await table.broadcast_dealer_event(
                    event_type="FAIR_DECK_SHUFFLE",
                    animation="MT_Deck_Shuffle_Cut",
                    speech="Hash generated before dealing. Your hand is provably fair. Good luck.",
                    vibe="Neutral",
                    facial_expression="professional_focus",
                    intensity=0.6,
                    delay_ms=1000,
                    metadata={
                        "verification_hash": hash_value,
                        "deck_seed": seed
                    }
                )
            
            elif message['type'] == 'PING':
                # Heartbeat for connection monitoring
                await websocket.send_json({
                    "type": "PONG",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        table.disconnect_client(websocket)
        
        # Remove table if no clients remain
        if len(table.clients) == 0:
            tournament_manager.remove_table(table_id)
    
    except Exception as e:
        print(f"❌ Tournament WebSocket error: {e}")
        table.disconnect_client(websocket)

# REST endpoints for tournament management
@router.get("/tournament/tables")
async def list_active_tables() -> Dict[str, Any]:
    """Get list of active tournament tables"""
    return {
        "active_tables": list(tournament_manager.tables.keys()),
        "total_tables": len(tournament_manager.tables)
    }

@router.get("/tournament/{table_id}/state")
async def get_table_state(table_id: str) -> Dict[str, Any]:
    """Get current state of a tournament table"""
    table = tournament_manager.get_or_create_table(table_id)
    
    return {
        "table_id": table_id,
        "game_state": table.game_state,
        "connected_clients": len(table.clients),
        "players": table.players,
        "current_bids": table.current_bids,
        "is_high_stakes": table.is_high_stakes
    }

@router.post("/tournament/{table_id}/trigger-event")
async def trigger_dealer_event(table_id: str, event_type: str, player_name: str = "Player") -> Dict[str, Any]:
    """
    Manually trigger a dealer event (for testing or admin purposes)
    """
    table = tournament_manager.get_or_create_table(table_id)
    
    # Map event types to dealer reactions
    event_map = {
        "RENEGUE": {
            "animation": "MT_Renegue_Penalty",
            "speech": f"Hold on, {player_name}. That's a renege. Rules are rules.",
            "vibe": "Strict",
            "facial_expression": "professional_stern",
            "intensity": 0.8
        },
        "TEN_FOR_200": {
            "animation": "MT_10_for_200_Excited",
            "speech": "Ten tricks bid? The big two-hundred is on the line. Good luck.",
            "vibe": "Intense",
            "facial_expression": "serious_focus",
            "intensity": 1.0
        },
        "JACKPOT": {
            "animation": "MT_Jackpot_Celebration",
            "speech": "JACKPOT! That's what I'm talking about!",
            "vibe": "Social",
            "facial_expression": "excited_celebration",
            "intensity": 1.0
        }
    }
    
    event_data = event_map.get(event_type)
    if not event_data:
        return {"error": "Unknown event type"}
    
    await table.broadcast_dealer_event(
        event_type=event_type,
        **event_data,
        delay_ms=500
    )
    
    return {"success": True, "event_triggered": event_type}
