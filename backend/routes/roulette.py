"""
PROVABLY FAIR ROULETTE ENGINE (Python/FastAPI)
Based on cryptographic HMAC-SHA512 for verifiable fairness
"""

import hashlib
import hmac
import secrets
from typing import Dict, List, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()

# Active WebSocket connections
active_connections: List[WebSocket] = []

# Game state
game_state = {
    "isSpinning": False,
    "lastWinningNumber": None,
    "timer": 20,
    "serverSeedHash": None,
    "nonce": 0
}

# Server seed (kept secret until after spin)
current_server_seed = secrets.token_hex(32)
game_state["serverSeedHash"] = hashlib.sha256(current_server_seed.encode()).hexdigest()


class BetData(BaseModel):
    amount: int
    betType: str
    value: str
    userId: str


class SpinRequest(BaseModel):
    clientSeed: str


def generate_provably_fair_result(server_seed: str, client_seed: str, nonce: int) -> Dict:
    """
    Generate provably fair roulette result
    Uses HMAC-SHA512 to ensure cryptographic fairness
    """
    # Create HMAC hash
    combined = f"{client_seed}:{nonce}"
    hash_obj = hmac.new(server_seed.encode(), combined.encode(), hashlib.sha512)
    hash_hex = hash_obj.hexdigest()
    
    # Use first 8 characters to generate number
    result_int = int(hash_hex[:8], 16)
    
    # European roulette has 37 slots (0-36)
    winning_number = result_int % 37
    
    return {
        "winningNumber": winning_number,
        "hash": hash_hex,
        "serverSeed": server_seed,  # Only revealed AFTER spin
        "clientSeed": client_seed,
        "nonce": nonce
    }


@router.post("/roulette/get-server-hash")
async def get_server_hash() -> Dict[str, Any]:
    """
    Return hashed server seed BEFORE player spins
    This proves the server committed to a seed before knowing client seed
    """
    return {
        "serverSeedHash": game_state["serverSeedHash"],
        "nonce": game_state["nonce"]
    }


@router.post("/roulette/spin")
async def spin_roulette(request: SpinRequest) -> Dict[str, Any]:
    """
    Generate provably fair spin result
    """
    global current_server_seed, game_state
    
    result = generate_provably_fair_result(
        current_server_seed,
        request.clientSeed,
        game_state["nonce"]
    )
    
    # Increment nonce for next spin
    game_state["nonce"] += 1
    
    # Generate new server seed for next round
    old_server_seed = current_server_seed
    current_server_seed = secrets.token_hex(32)
    game_state["serverSeedHash"] = hashlib.sha256(current_server_seed.encode()).hexdigest()
    
    # Broadcast to all connected clients
    spin_data = {
        "winningNumber": result["winningNumber"],
        "proof": {
            "serverSeed": old_server_seed,  # Reveal old seed
            "clientSeed": request.clientSeed,
            "nonce": result["nonce"],
            "hash": result["hash"]
        },
        "nextServerHash": game_state["serverSeedHash"]
    }
    
    # Send to all WebSocket clients
    for connection in active_connections:
        try:
            await connection.send_json({"type": "spin", "data": spin_data})
        except Exception:
            pass
    
    return spin_data


@router.websocket("/ws/roulette")
async def websocket_roulette(websocket: WebSocket) -> Dict[str, Any]:
    """
    WebSocket endpoint for real-time multiplayer roulette
    """
    await websocket.accept()
    active_connections.append(websocket)
    
    # Send current game state
    await websocket.send_json({
        "type": "syncState",
        "data": {
            "serverSeedHash": game_state["serverSeedHash"],
            "nonce": game_state["nonce"],
            "lastWinningNumber": game_state["lastWinningNumber"]
        }
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "placeBet":
                # Broadcast bet to all other players
                for connection in active_connections:
                    if connection != websocket:
                        await connection.send_json({
                            "type": "playerBet",
                            "data": data["data"]
                        })
            
            elif data["type"] == "requestSpin":
                # Handle spin request
                result = generate_provably_fair_result(
                    current_server_seed,
                    data.get("clientSeed", "default"),
                    game_state["nonce"]
                )
                
                # Broadcast to all
                for connection in active_connections:
                    await connection.send_json({
                        "type": "spin",
                        "data": {
                            "winningNumber": result["winningNumber"],
                            "proof": result
                        }
                    })
    
    except WebSocketDisconnect:
        active_connections.remove(websocket)


@router.post("/roulette/verify")
async def verify_result(data: Dict) -> Dict[str, Any]:
    """
    Allow players to verify a previous spin was fair
    """
    result = generate_provably_fair_result(
        data["serverSeed"],
        data["clientSeed"],
        data["nonce"]
    )
    
    is_valid = result["winningNumber"] == data["claimedNumber"]
    
    return {
        "isValid": is_valid,
        "calculatedNumber": result["winningNumber"],
        "hash": result["hash"]
    }
