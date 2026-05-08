"""
MetaHuman Dealer Control System
Manages UE5 MetaHuman dealers for casino games and interviews
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel
import asyncio

router = APIRouter(prefix="/metahuman", tags=["metahuman"])

# Active MetaHuman connections
metahuman_connections: Dict[str, WebSocket] = {}
dealer_states: Dict[str, dict] = {}

# ==================== DATA MODELS ====================

class DealerAnimation(BaseModel):
    table_id: str
    animation: str  # "deal_cards", "celebrate", "shuffle", "idle", "interview_start", "interview_question", "interview_end"
    duration: Optional[float] = None
    metadata: Optional[dict] = None

class DealerDialogue(BaseModel):
    table_id: str
    text: str
    emotion: str = "neutral"  # "happy", "excited", "neutral", "serious", "celebratory"
    voice_id: Optional[str] = None
    use_tts: bool = True

class WinnerInterview(BaseModel):
    table_id: str
    winner_id: str
    winner_name: str
    winnings: float
    game_type: str
    questions: List[str]

class GameEventTrigger(BaseModel):
    table_id: str
    event: str  # "game_start", "bet_placed", "cards_dealt", "game_end", "winner_announced"
    data: dict

# ==================== WEBSOCKET CONNECTION ====================

@router.websocket("/ws/{table_id}")
async def metahuman_websocket(websocket: WebSocket, table_id: str) -> Dict[str, Any]:
    """
    WebSocket connection for UE5 MetaHuman to receive real-time commands.
    This endpoint is consumed by Unreal Engine Pixel Streaming client.
    """
    await websocket.accept()
    metahuman_connections[table_id] = websocket
    
    # Initialize dealer state
    dealer_states[table_id] = {
        "table_id": table_id,
        "state": "idle",
        "current_animation": "idle",
        "current_game": None,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "interview_mode": False
    }
    
    print(f"✅ MetaHuman dealer connected to table {table_id}")
    
    try:
        # Send initial state
        await websocket.send_json({
            "type": "connection_established",
            "table_id": table_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_json()
            await handle_metahuman_message(table_id, data)
            
    except WebSocketDisconnect:
        print(f"❌ MetaHuman dealer disconnected from table {table_id}")
        if table_id in metahuman_connections:
            del metahuman_connections[table_id]
        if table_id in dealer_states:
            del dealer_states[table_id]

async def handle_metahuman_message(table_id: str, message: dict) -> Dict[str, Any]:
    """Handle messages from UE5 MetaHuman"""
    msg_type = message.get("type")
    
    if msg_type == "animation_complete":
        dealer_states[table_id]["current_animation"] = "idle"
        dealer_states[table_id]["state"] = "ready"
        
    elif msg_type == "dialogue_complete":
        dealer_states[table_id]["speaking"] = False
        
    elif msg_type == "heartbeat":
        # Keep-alive ping from UE5
        if table_id in metahuman_connections:
            await metahuman_connections[table_id].send_json({
                "type": "heartbeat_ack",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

# ==================== ANIMATION CONTROL ====================

@router.post("/trigger-animation")
async def trigger_animation(request: DealerAnimation) -> Dict[str, Any]:
    """
    Trigger a MetaHuman animation from backend game logic.
    Called by game servers when events occur.
    """
    table_id = request.table_id
    
    if table_id not in metahuman_connections:
        raise HTTPException(status_code=404, detail=f"No MetaHuman connected to table {table_id}")
    
    # Send animation command to UE5
    command = {
        "type": "animation",
        "animation": request.animation,
        "duration": request.duration,
        "metadata": request.metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await metahuman_connections[table_id].send_json(command)
    
    # Update dealer state
    dealer_states[table_id]["current_animation"] = request.animation
    dealer_states[table_id]["state"] = "animating"
    
    return {
        "success": True,
        "message": f"Animation '{request.animation}' triggered for table {table_id}"
    }

# ==================== DIALOGUE SYSTEM ====================

@router.post("/speak")
async def dealer_speak(request: DealerDialogue) -> Dict[str, Any]:
    """
    Make the MetaHuman dealer speak dialogue.
    Integrates with TTS (Text-to-Speech) in UE5.
    """
    table_id = request.table_id
    
    if table_id not in metahuman_connections:
        raise HTTPException(status_code=404, detail=f"No MetaHuman connected to table {table_id}")
    
    # Send dialogue command to UE5
    command = {
        "type": "dialogue",
        "text": request.text,
        "emotion": request.emotion,
        "use_tts": request.use_tts,
        "voice_id": request.voice_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await metahuman_connections[table_id].send_json(command)
    
    # Update dealer state
    dealer_states[table_id]["speaking"] = True
    dealer_states[table_id]["current_dialogue"] = request.text
    
    return {
        "success": True,
        "message": f"Dealer speaking: '{request.text[:50]}...'"
    }

# ==================== GAME EVENT TRIGGERS ====================

@router.post("/game-event")
async def handle_game_event(request: GameEventTrigger) -> Dict[str, Any]:
    """
    Handle game events and trigger appropriate MetaHuman responses.
    This is called by game logic to sync dealer with game state.
    """
    table_id = request.table_id
    event = request.event
    
    if table_id not in metahuman_connections:
        return {"success": False, "message": "No MetaHuman connected"}
    
    # Determine dealer response based on event
    response = await get_dealer_response(event, request.data)
    
    # Trigger animation
    if response.get("animation"):
        await trigger_animation(DealerAnimation(
            table_id=table_id,
            animation=response["animation"],
            metadata=request.data
        ))
    
    # Trigger dialogue
    if response.get("dialogue"):
        await dealer_speak(DealerDialogue(
            table_id=table_id,
            text=response["dialogue"],
            emotion=response.get("emotion", "neutral")
        ))
    
    return {
        "success": True,
        "event": event,
        "response": response
    }

async def get_dealer_response(event: str, data: dict) -> dict:
    """Generate appropriate dealer response for game events"""
    responses = {
        "game_start": {
            "animation": "shuffle",
            "dialogue": f"Welcome to {data.get('game_type', 'the table')}! Place your bets!",
            "emotion": "happy"
        },
        "bet_placed": {
            "animation": "acknowledge",
            "dialogue": f"${data.get('amount')} on {data.get('bet_type')}. Good luck!",
            "emotion": "neutral"
        },
        "cards_dealt": {
            "animation": "deal_cards",
            "dialogue": "Cards are dealt. Let's see what fortune brings!",
            "emotion": "neutral"
        },
        "game_end": {
            "animation": "reveal",
            "dialogue": "And the result is...",
            "emotion": "serious"
        },
        "winner_announced": {
            "animation": "celebrate",
            "dialogue": f"Congratulations {data.get('winner_name')}! You've won ${data.get('winnings')}!",
            "emotion": "excited"
        }
    }
    
    return responses.get(event, {"animation": "idle", "dialogue": ""})

# ==================== WINNER'S CIRCLE INTERVIEW ====================

@router.post("/start-interview")
async def start_winner_interview(request: WinnerInterview) -> Dict[str, Any]:
    """
    Start the Winner's Circle interview sequence.
    This is triggered after a big win for live stream content.
    """
    table_id = request.table_id
    
    if table_id not in metahuman_connections:
        raise HTTPException(status_code=404, detail=f"No MetaHuman connected to table {table_id}")
    
    # Enter interview mode
    dealer_states[table_id]["interview_mode"] = True
    dealer_states[table_id]["interview_subject"] = {
        "winner_id": request.winner_id,
        "winner_name": request.winner_name,
        "winnings": request.winnings,
        "game_type": request.game_type
    }
    
    # Trigger interview start animation
    await trigger_animation(DealerAnimation(
        table_id=table_id,
        animation="interview_start",
        metadata={"winner_name": request.winner_name}
    ))
    
    # Wait for animation to complete
    await asyncio.sleep(2)
    
    # Start asking questions
    interview_id = str(uuid4())
    for idx, question in enumerate(request.questions):
        # Trigger interview question animation
        await trigger_animation(DealerAnimation(
            table_id=table_id,
            animation="interview_question",
            metadata={"question_number": idx + 1}
        ))
        
        # Dealer asks question
        await dealer_speak(DealerDialogue(
            table_id=table_id,
            text=question,
            emotion="happy"
        ))
        
        # Wait for user response (simulate for now - in production this would wait for actual response)
        await asyncio.sleep(5)
    
    # End interview
    await trigger_animation(DealerAnimation(
        table_id=table_id,
        animation="interview_end"
    ))
    
    await dealer_speak(DealerDialogue(
        table_id=table_id,
        text=f"Thank you {request.winner_name}! Enjoy your ${request.winnings} winnings!",
        emotion="celebratory"
    ))
    
    # Exit interview mode
    dealer_states[table_id]["interview_mode"] = False
    
    return {
        "success": True,
        "interview_id": interview_id,
        "winner": request.winner_name,
        "questions_asked": len(request.questions)
    }

# ==================== STATE MANAGEMENT ====================

@router.get("/status/{table_id}")
async def get_dealer_status(table_id: str) -> Dict[str, Any]:
    """Get current status of MetaHuman dealer"""
    if table_id not in dealer_states:
        raise HTTPException(status_code=404, detail="Dealer not found")
    
    return {
        "success": True,
        "dealer": dealer_states[table_id],
        "connected": table_id in metahuman_connections
    }

@router.get("/active-dealers")
async def get_active_dealers() -> Dict[str, Any]:
    """Get list of all active MetaHuman dealers"""
    return {
        "success": True,
        "dealers": list(dealer_states.values()),
        "total": len(dealer_states)
    }

@router.post("/reset/{table_id}")
async def reset_dealer(table_id: str) -> Dict[str, Any]:
    """Reset dealer to idle state"""
    if table_id not in metahuman_connections:
        raise HTTPException(status_code=404, detail="Dealer not connected")
    
    # Send reset command
    await metahuman_connections[table_id].send_json({
        "type": "reset",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Reset state
    dealer_states[table_id]["state"] = "idle"
    dealer_states[table_id]["current_animation"] = "idle"
    dealer_states[table_id]["interview_mode"] = False
    
    return {
        "success": True,
        "message": f"Dealer {table_id} reset to idle"
    }

# ==================== HELPER FUNCTIONS ====================

async def broadcast_to_table(table_id: str, message: dict) -> Dict[str, Any]:
    """Broadcast message to MetaHuman and all players at a table"""
    if table_id in metahuman_connections:
        await metahuman_connections[table_id].send_json(message)

def get_default_interview_questions(game_type: str, winnings: float) -> List[str]:
    """Generate default interview questions based on game and winnings"""
    questions = [
        f"Congratulations on winning ${winnings}! How does it feel?",
        f"What's your strategy for playing {game_type}?",
        "Is this your biggest win on Global Vibez DSG?",
        "What will you do with your winnings?",
        "Any advice for other players watching?"
    ]
    return questions
