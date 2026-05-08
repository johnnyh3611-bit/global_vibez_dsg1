"""
Dominoes Multiplayer WebSocket — head-to-head Block Dominoes rooms.

Reuses `utils.dominoes_game.DominoesGame` so MP rules stay locked to
the AI-practice rules (highest-double opener, draw-from-boneyard,
blocked-game detection, pip-count scoring).

WS contract:

  → Client connects: ws://…/api/dominoes-mp/ws/{room_id}?user_id=…&username=…
  ← Server sends   : {type, room, your_pos, …}

  Client → Server messages:
    {type:"play",        tile_id, side}
    {type:"draw"}
    {type:"pass"}
    {type:"chat",        text}
    {type:"next_round"}

  Server → Client broadcasts:
    {type:"state",       game}
    {type:"player_joined"|"player_left", username}
    {type:"chat",        username, text}
    {type:"error",       detail}

Room lifecycle:
  • First user connects → seat=south.
  • Second user → seat=north → game starts.
  • Either disconnect → room aborts; surviving player gets a
    {type:"opponent_left"} so the UI can offer a rematch flow.

Rooms are in-memory per-pod (acceptable for MVP per the user's note;
move to Redis pub/sub when we scale beyond one pod).
"""
from __future__ import annotations
import json
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from utils.dominoes_game import DominoesGame

router = APIRouter(prefix="/dominoes-mp", tags=["dominoes-mp"])


class _Room:
    """Two-seat live Dominoes room."""
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: Dict[str, Dict[str, Any]] = {}  # user_id → {ws, position, username}
        self.game: Optional[DominoesGame] = None
        # We keep the DominoesGame's south=user1, north=user2 mapping.

    def free_position(self) -> Optional[str]:
        taken = {p["position"] for p in self.players.values()}
        for pos in ("south", "north"):
            if pos not in taken:
                return pos
        return None

    async def add(self, user_id: str, username: str, ws: WebSocket) -> Optional[str]:
        seat = self.free_position()
        if not seat:
            return None
        self.players[user_id] = {"ws": ws, "position": seat, "username": username}
        return seat

    def remove(self, user_id: str) -> None:
        self.players.pop(user_id, None)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        dead: List[str] = []
        for uid, p in self.players.items():
            try:
                await p["ws"].send_text(json.dumps(payload))
            except Exception:
                dead.append(uid)
        for d in dead:
            self.players.pop(d, None)

    async def send_state_to(self, user_id: str) -> None:
        if not self.game:
            return
        p = self.players.get(user_id)
        if not p:
            return
        view = self.game.to_view(requester=p["position"])
        view["room_id"] = self.room_id
        view["your_pos"] = p["position"]
        view["seats"] = {
            v["position"]: v["username"] for v in self.players.values()
        }
        try:
            await p["ws"].send_text(json.dumps({"type": "state", "game": view}))
        except Exception:
            pass

    async def broadcast_state(self) -> None:
        if not self.game:
            return
        for uid in list(self.players.keys()):
            await self.send_state_to(uid)

    def can_start(self) -> bool:
        return len(self.players) == 2 and self.game is None


_ROOMS: Dict[str, _Room] = {}


def _get_room(room_id: str) -> _Room:
    room = _ROOMS.get(room_id)
    if not room:
        room = _Room(room_id)
        _ROOMS[room_id] = room
    return room


@router.get("/rooms")
async def list_rooms() -> Dict[str, Any]:
    """Lobby helper — open rooms (≤1 player) to join."""
    open_rooms = []
    for r in _ROOMS.values():
        if len(r.players) < 2 and r.game is None:
            open_rooms.append({
                "room_id": r.room_id,
                "players": len(r.players),
                "host": next(iter(r.players.values()))["username"] if r.players else None,
            })
    return {"success": True, "rooms": open_rooms}


@router.post("/rooms/create")
async def create_room() -> Dict[str, Any]:
    rid = uuid4().hex[:8]
    _get_room(rid)  # eager-create
    return {"success": True, "room_id": rid}


@router.websocket("/ws/{room_id}")
async def ws(websocket: WebSocket, room_id: str, user_id: str = Query(...), username: str = Query("Player")) -> None:
    await websocket.accept()
    room = _get_room(room_id)
    seat = await room.add(user_id, username, websocket)
    if not seat:
        await websocket.send_text(json.dumps({"type": "error", "detail": "room full"}))
        await websocket.close()
        return

    await room.broadcast({"type": "player_joined", "username": username, "seat": seat})

    # Start the game once both seats are filled.
    if room.can_start():
        # Multiplayer engine — bots are disabled, both players are
        # real WebSocket peers.
        room.game = DominoesGame(user_position="south", target_score=150, multiplayer=True)
        await room.broadcast({"type": "round_start"})
        await room.broadcast_state()
    else:
        if room.game:
            await room.send_state_to(user_id)
        else:
            await websocket.send_text(json.dumps({"type": "waiting", "detail": "Waiting for opponent…"}))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "bad json"}))
                continue
            mtype = msg.get("type")
            player = room.players.get(user_id)
            if not player:
                break

            if mtype == "chat":
                await room.broadcast({"type": "chat", "username": username, "text": str(msg.get("text", ""))[:240]})
                continue

            if not room.game:
                await websocket.send_text(json.dumps({"type": "error", "detail": "game not started"}))
                continue

            try:
                # Engine validates `current_turn == user_position`. We
                # set user_position to the acting player just for this
                # call so the validation passes. The engine's bot loop
                # is disabled (multiplayer=True), so we never accidentally
                # advance the opponent's turn.
                acting_pos = player["position"]
                room.game.user_position = acting_pos
                room.game.bot_position = "north" if acting_pos == "south" else "south"

                if mtype == "play":
                    tile_id = msg.get("tile_id")
                    side = msg.get("side", "right")
                    room.game.play(tile_id, side)
                elif mtype == "draw":
                    room.game.draw()
                elif mtype == "pass":
                    room.game.pass_turn()
                elif mtype == "next_round":
                    room.game.next_round()
                else:
                    await websocket.send_text(json.dumps({"type": "error", "detail": f"unknown type: {mtype}"}))
                    continue
            except Exception as exc:  # noqa: BLE001
                await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)[:160]}))
                continue

            await room.broadcast_state()

            if room.game.phase == "finished":
                await room.broadcast({"type": "match_over", "match_winner": room.game.match_winner, "scores": dict(room.game.scores)})

    except WebSocketDisconnect:
        pass
    finally:
        room.remove(user_id)
        await room.broadcast({"type": "opponent_left", "username": username})
        # Reset game when someone leaves so the survivor can rematch.
        if len(room.players) < 2:
            room.game = None
        if not room.players:
            _ROOMS.pop(room_id, None)
