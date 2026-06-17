from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import os

router = APIRouter(prefix="/private-suites", tags=["Private Vibe Suites"])

# In-memory storage for demo (replace with MongoDB in production)
ACTIVE_SUITES: Dict[str, dict] = {}
SUITE_INVITATIONS: Dict[str, dict] = {}
PLAYER_LOCATIONS: Dict[str, dict] = {}

# WebSocket connections per suite
suite_connections: Dict[str, List[WebSocket]] = {}

# Models
class SuiteCreateRequest(BaseModel):
    player1_id: str
    player2_id: str
    suite_type: str = "glass"  # glass, penthouse, beach, skyline
    theme: Optional[str] = "romantic"
    privacy_level: str = "private"  # private, friends, public

class SuiteInvitation(BaseModel):
    invitation_id: str = Field(default_factory=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    from_player_id: str
    to_player_id: str
    suite_id: Optional[str] = None
    message: str = "Join me in a Private Vibe Suite?"
    status: str = "pending"  # pending, accepted, declined, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlayerPosition(BaseModel):
    player_id: str
    x: float
    y: float
    z: float
    rotation: Optional[Dict[str, float]] = None

# Room Creation
@router.post("/create")
async def create_private_suite(request: SuiteCreateRequest) -> Dict[str, Any]:
    """
    Create a new Private Vibe Suite for two players.
    Returns suite_id, teleport coordinates, and room details.
    """
    suite_id = f"suite_{uuid.uuid4().hex[:12]}"
    
    # Generate Z-offset for level streaming (5000 units above main hub)
    z_offset = 5000 + (len(ACTIVE_SUITES) * 1000)  # Stack suites vertically
    
    suite_data = {
        "suite_id": suite_id,
        "player1_id": request.player1_id,
        "player2_id": request.player2_id,
        "suite_type": request.suite_type,
        "theme": request.theme,
        "privacy_level": request.privacy_level,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "z_offset": z_offset,
        "level_name": f"L_PrivateSuite_{request.suite_type.capitalize()}",
        "player_positions": {
            request.player1_id: {"x": 0, "y": 0, "z": z_offset + 100},
            request.player2_id: {"x": 100, "y": 0, "z": z_offset + 100}
        },
        "activities": [],
        "duration_minutes": 0
    }
    
    ACTIVE_SUITES[suite_id] = suite_data
    
    return {
        "success": True,
        "suite_id": suite_id,
        "level_name": suite_data["level_name"],
        "z_offset": z_offset,
        "teleport_positions": suite_data["player_positions"],
        "message": f"Private Vibe Suite '{suite_data['suite_type']}' created successfully!"
    }

# Get Active Suites
@router.get("/list")
async def list_active_suites(player_id: Optional[str] = None) -> Dict[str, Any]:
    """
    List all active Private Vibe Suites.
    Filter by player_id if provided.
    """
    suites = list(ACTIVE_SUITES.values())
    
    if player_id:
        suites = [s for s in suites if player_id in [s['player1_id'], s['player2_id']]]
    
    return {
        "success": True,
        "suites": suites,
        "count": len(suites)
    }

# Get Suite Details
@router.get("/{suite_id}")
async def get_suite_details(suite_id: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific suite.
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    return {
        "success": True,
        "suite": ACTIVE_SUITES[suite_id]
    }

# Send Invitation
@router.post("/invite")
async def send_suite_invitation(from_player_id: str, to_player_id: str, message: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a Private Vibe Suite invitation to another player.
    """
    invitation = SuiteInvitation(
        from_player_id=from_player_id,
        to_player_id=to_player_id,
        message=message or "Join me in a Private Vibe Suite?"
    )
    
    SUITE_INVITATIONS[invitation.invitation_id] = invitation.dict()
    
    # TODO: Send WebSocket notification to to_player_id
    
    return {
        "success": True,
        "invitation_id": invitation.invitation_id,
        "message": "Invitation sent successfully!"
    }

# Accept/Decline Invitation
@router.post("/invite/{invitation_id}/respond")
async def respond_to_invitation(invitation_id: str, accept: bool) -> Dict[str, Any]:
    """
    Accept or decline a suite invitation.
    If accepted, creates the suite and returns teleport info.
    """
    if invitation_id not in SUITE_INVITATIONS:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    invitation = SUITE_INVITATIONS[invitation_id]
    
    if accept:
        # Create the suite
        create_request = SuiteCreateRequest(
            player1_id=invitation["from_player_id"],
            player2_id=invitation["to_player_id"],
            suite_type="glass",
            theme="romantic"
        )
        
        suite_result = await create_private_suite(create_request)
        
        # Update invitation status
        invitation["status"] = "accepted"
        invitation["suite_id"] = suite_result["suite_id"]
        
        return {
            "success": True,
            "accepted": True,
            "suite": suite_result
        }
    else:
        invitation["status"] = "declined"
        return {
            "success": True,
            "accepted": False,
            "message": "Invitation declined"
        }

# Get Pending Invitations
@router.get("/invitations/{player_id}")
async def get_player_invitations(player_id: str) -> Dict[str, Any]:
    """
    Get all pending invitations for a player.
    """
    invitations = [
        inv for inv in SUITE_INVITATIONS.values()
        if inv["to_player_id"] == player_id and inv["status"] == "pending"
    ]
    
    return {
        "success": True,
        "invitations": invitations,
        "count": len(invitations)
    }

# Update Player Position
@router.post("/{suite_id}/position")
async def update_player_position(suite_id: str, position: PlayerPosition) -> Dict[str, Any]:
    """
    Update a player's position within a suite.
    Used for real-time tracking and synchronization.
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    suite = ACTIVE_SUITES[suite_id]
    
    suite["player_positions"][position.player_id] = {
        "x": position.x,
        "y": position.y,
        "z": position.z,
        "rotation": position.rotation,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Broadcast to other players via WebSocket
    await broadcast_to_suite(suite_id, {
        "event": "player_moved",
        "player_id": position.player_id,
        "position": suite["player_positions"][position.player_id]
    })
    
    return {
        "success": True,
        "message": "Position updated"
    }

# Log Activity
@router.post("/{suite_id}/activity")
async def log_suite_activity(suite_id: str, activity_type: str, details: Optional[dict] = None) -> Dict[str, Any]:
    """
    Log an activity that happened in the suite.
    Examples: conversation_started, game_played, gift_sent
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    activity = {
        "activity_type": activity_type,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    ACTIVE_SUITES[suite_id]["activities"].append(activity)
    
    return {
        "success": True,
        "message": "Activity logged"
    }

# Leave Suite
@router.post("/{suite_id}/leave")
async def leave_suite(suite_id: str, player_id: str) -> Dict[str, Any]:
    """
    Player leaves the suite. If both leave, suite is closed.
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    suite = ACTIVE_SUITES[suite_id]
    
    # Broadcast leave event
    await broadcast_to_suite(suite_id, {
        "event": "player_left",
        "player_id": player_id
    })
    
    # Mark suite as inactive and close after both leave
    suite["status"] = "closing"
    
    # Clean up after 5 minutes or when both leave
    return {
        "success": True,
        "message": "Left suite successfully",
        "suite_status": suite["status"]
    }

# Close Suite
@router.delete("/{suite_id}")
async def close_suite(suite_id: str) -> Dict[str, Any]:
    """
    Permanently close a Private Vibe Suite.
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    # Broadcast closure to all players
    await broadcast_to_suite(suite_id, {
        "event": "suite_closed",
        "suite_id": suite_id
    })
    
    # Remove from active suites
    del ACTIVE_SUITES[suite_id]
    
    return {
        "success": True,
        "message": "Suite closed successfully"
    }

# WebSocket for Real-Time Suite Events
@router.websocket("/ws/{suite_id}")
async def suite_websocket(websocket: WebSocket, suite_id: str) -> Dict[str, Any]:
    """
    WebSocket connection for real-time suite events.
    Events: player_moved, message_sent, activity_started, player_left, suite_closed
    """
    await websocket.accept()
    
    if suite_id not in suite_connections:
        suite_connections[suite_id] = []
    suite_connections[suite_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Broadcast to all players in suite
            await broadcast_to_suite(suite_id, data)
    
    except WebSocketDisconnect:
        suite_connections[suite_id].remove(websocket)
        if not suite_connections[suite_id]:
            del suite_connections[suite_id]

# Helper function for WebSocket broadcast
async def broadcast_to_suite(suite_id: str, message: dict) -> Dict[str, Any]:
    """
    Broadcast a message to all WebSocket connections in a suite.
    """
    if suite_id in suite_connections:
        dead_connections = []
        for connection in suite_connections[suite_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                dead_connections.append(connection)
                # Log connection errors in production
                if os.getenv('ENV') != 'development':
                    print(f"Suite connection error for {suite_id}: {e}")
        
        # Clean up dead connections
        for dead in dead_connections:
            suite_connections[suite_id].remove(dead)

# Get Suite Analytics
@router.get("/{suite_id}/analytics")
async def get_suite_analytics(suite_id: str) -> Dict[str, Any]:
    """
    Get analytics for a suite (duration, activities, etc.)
    """
    if suite_id not in ACTIVE_SUITES:
        raise HTTPException(status_code=404, detail="Suite not found")
    
    suite = ACTIVE_SUITES[suite_id]
    
    created_at = datetime.fromisoformat(suite["created_at"])
    duration = (datetime.now(timezone.utc) - created_at).total_seconds() / 60
    
    return {
        "success": True,
        "analytics": {
            "suite_id": suite_id,
            "duration_minutes": round(duration, 2),
            "activities_count": len(suite["activities"]),
            "activities": suite["activities"],
            "players": [suite["player1_id"], suite["player2_id"]],
            "suite_type": suite["suite_type"],
            "theme": suite["theme"]
        }
    }
