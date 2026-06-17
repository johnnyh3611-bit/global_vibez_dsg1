"""
Tournament Chat Socket.IO namespace.

Clients connect to `/tournament-chat` and emit `join` with {tournament_id}.
Server emits `chat:new` and `chat:react` via routes.tournament_chat._broadcast.
"""
import socketio

from services.multiplayer import sio


class TournamentChatNamespace(socketio.AsyncNamespace):
    """Per-tournament rooms. Extremely thin — just join/leave."""

    async def on_connect(self, sid, environ, auth):
        print(f"[tournament-chat] connected: {sid}")

    async def on_disconnect(self, sid):
        print(f"[tournament-chat] disconnected: {sid}")

    async def on_join(self, sid, data):
        tid = (data or {}).get("tournament_id")
        if not tid:
            await self.emit("chat:error", {"error": "tournament_id required"}, to=sid)
            return
        await self.enter_room(sid, f"tournament:{tid}")
        await self.emit("chat:joined", {"tournament_id": tid}, to=sid)

    async def on_leave(self, sid, data):
        tid = (data or {}).get("tournament_id")
        if tid:
            await self.leave_room(sid, f"tournament:{tid}")
            await self.emit("chat:left", {"tournament_id": tid}, to=sid)


sio.register_namespace(TournamentChatNamespace("/tournament-chat"))
