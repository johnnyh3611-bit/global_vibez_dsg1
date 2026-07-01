from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any
from datetime import datetime

router = APIRouter(prefix="/ws", tags=["MetaHuman WebSocket"])

# Active WebSocket connections per table
active_connections: Dict[str, List[WebSocket]] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, table_id: str, websocket: WebSocket):
        await websocket.accept()
        if table_id not in self.active_connections:
            self.active_connections[table_id] = []
        self.active_connections[table_id].append(websocket)
        print(f"✅ Client connected to table: {table_id}")

    def disconnect(self, table_id: str, websocket: WebSocket):
        if table_id in self.active_connections:
            self.active_connections[table_id].remove(websocket)
            if not self.active_connections[table_id]:
                del self.active_connections[table_id]
        print(f"❌ Client disconnected from table: {table_id}")

    async def broadcast(self, table_id: str, message: dict):
        """Broadcast message to all clients connected to a table"""
        if table_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[table_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to connection: {e}")
                    dead_connections.append(connection)
            
            # Remove dead connections
            for dead in dead_connections:
                self.disconnect(table_id, dead)

manager = ConnectionManager()

@router.websocket("/table/{table_id}")
async def metahuman_table_websocket(websocket: WebSocket, table_id: str) -> Dict[str, Any]:
    """
    WebSocket endpoint for MetaHuman dealer tables.
    Broadcasts dealer animations, game events, and player actions in real-time.
    """
    await manager.connect(table_id, websocket)
    
    # Send welcome message
    await websocket.send_json({
        "event_type": "connected",
        "table_id": table_id,
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Connected to MetaHuman Dealer table"
    })
    
    try:
        while True:
            # Receive messages from client (UE5 or web browser)
            data = await websocket.receive_json()
            
            # Process different event types
            event_type = data.get("event_type")
            
            if event_type == "player_action":
                # Player bet, fold, raise, etc.
                await manager.broadcast(table_id, {
                    "event_type": "player_action",
                    "table_id": table_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "player_id": data.get("player_id"),
                        "action": data.get("action"),
                        "amount": data.get("amount", 0)
                    }
                })
            
            elif event_type == "dealer_trigger":
                # Manual dealer animation trigger
                animation_name = data.get("animation")
                speech = data.get("speech", "")
                
                await manager.broadcast(table_id, {
                    "event_type": "dealer_animation",
                    "table_id": table_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "animation": animation_name,
                        "speech": speech,
                        "duration": 3.5,
                        "mood": data.get("mood", "neutral")
                    }
                })
            
            elif event_type == "card_dealt":
                # Broadcast card dealt event
                await manager.broadcast(table_id, {
                    "event_type": "card_dealt",
                    "table_id": table_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "player_id": data.get("player_id"),
                        "card": data.get("card"),
                        "position": data.get("position", {}),
                        "face_down": data.get("face_down", False)
                    }
                })
            
            elif event_type == "game_phase_change":
                # Game state change (waiting -> betting -> flop -> turn -> river)
                await manager.broadcast(table_id, {
                    "event_type": "game_state_change",
                    "table_id": table_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "phase": data.get("phase"),
                        "pot": data.get("pot", 0),
                        "community_cards": data.get("community_cards", [])
                    }
                })
            
            elif event_type == "chat_message":
                # Table chat
                await manager.broadcast(table_id, {
                    "event_type": "chat_message",
                    "table_id": table_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "player_name": data.get("player_name"),
                        "message": data.get("message")
                    }
                })
            
            else:
                # Echo back unknown events
                await websocket.send_json({
                    "event_type": "error",
                    "message": f"Unknown event type: {event_type}"
                })
    
    except WebSocketDisconnect:
        manager.disconnect(table_id, websocket)
        # Notify other players
        await manager.broadcast(table_id, {
            "event_type": "player_disconnected",
            "table_id": table_id,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(table_id, websocket)


# Helper function to trigger dealer animations from REST API
async def trigger_dealer_animation(table_id: str, animation: str, speech: str, mood: str = "neutral") -> Dict[str, Any]:
    """
    Trigger a dealer animation via WebSocket broadcast.
    Can be called from other backend routes.
    """
    await manager.broadcast(table_id, {
        "event_type": "dealer_animation",
        "table_id": table_id,
        "timestamp": datetime.utcnow().isoformat(),
        "data": {
            "animation": animation,
            "speech": speech,
            "duration": 3.5,
            "mood": mood
        }
    })


# Helper function to broadcast game events
async def broadcast_game_event(table_id: str, event_type: str, event_data: dict) -> Dict[str, Any]:
    """
    Generic function to broadcast any game event to all connected clients.
    """
    await manager.broadcast(table_id, {
        "event_type": event_type,
        "table_id": table_id,
        "timestamp": datetime.utcnow().isoformat(),
        "data": event_data
    })
