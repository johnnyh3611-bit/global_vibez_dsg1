"""
Global Vibez Chat System - WebSocket Backend
Translates UE5 "Glass Slate" architecture to FastAPI WebSockets

Features:
- Real-time messaging with Socket.io-style rooms
- AI moderation (Claude Sonnet 4)
- Redis for active sessions
- MongoDB for message history
- Cross-platform ready
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional, List, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import json
import asyncio
import os
from dotenv import load_dotenv
from utils.database import get_database
from services.ai_engine import LlmChat, UserMessage

load_dotenv()
EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')

router = APIRouter()

# Connection Manager - handles active WebSocket connections
class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # room_id -> Set of user_ids
        self.rooms: Dict[str, Set[str]] = {}
        # user_id -> Set of room_ids
        self.user_rooms: Dict[str, Set[str]] = {}
        # user_id -> typing status
        self.typing_status: Dict[str, Dict[str, bool]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept WebSocket connection and store it"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_rooms[user_id] = set()
        print(f"✅ User {user_id} connected to chat")
    
    def disconnect(self, user_id: str):
        """Remove user from all rooms and connections"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Remove from all rooms
        if user_id in self.user_rooms:
            for room_id in list(self.user_rooms[user_id]):
                self.leave_room(user_id, room_id)
            del self.user_rooms[user_id]
        
        print(f"❌ User {user_id} disconnected from chat")
    
    def join_room(self, user_id: str, room_id: str):
        """Add user to a room"""
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        
        self.rooms[room_id].add(user_id)
        self.user_rooms[user_id].add(room_id)
        print(f"👤 User {user_id} joined room {room_id}")
    
    def leave_room(self, user_id: str, room_id: str):
        """Remove user from a room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            if not self.rooms[room_id]:  # Empty room
                del self.rooms[room_id]
        
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                print(f"Error sending to {user_id}: {e}")
    
    async def broadcast_to_room(self, message: dict, room_id: str, exclude_user: Optional[str] = None):
        """Broadcast message to all users in a room"""
        if room_id not in self.rooms:
            return
        
        tasks = []
        for user_id in self.rooms[room_id]:
            if user_id != exclude_user and user_id in self.active_connections:
                tasks.append(self.send_personal_message(message, user_id))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_global(self, message: dict):
        """Broadcast to all connected users"""
        tasks = []
        for user_id in self.active_connections:
            tasks.append(self.send_personal_message(message, user_id))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    def get_room_users(self, room_id: str) -> List[str]:
        """Get list of users in a room"""
        return list(self.rooms.get(room_id, set()))
    
    def get_online_users(self) -> List[str]:
        """Get list of all online users"""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()


# AI Moderation Function
async def moderate_message(text: str, user_id: str) -> dict:
    """
    AI-powered content moderation using Claude Sonnet 4
    Returns: {safe: bool, reason: str, filtered_text: str}
    """
    try:
        # Initialize Claude chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"moderation_{user_id}",
            system_message="You are a content moderator for a dating and gaming platform. Analyze messages for inappropriate content, toxicity, spam, and harassment. Keep the vibe positive and safe."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        # Create moderation prompt
        user_message = UserMessage(
            text=f"""Analyze this message for safety: "{text}"

Return ONLY a JSON object with this exact format:
{{
  "safe": true or false,
  "reason": "brief explanation",
  "confidence": 0.0 to 1.0
}}

Criteria for unsafe:
- Explicit sexual content
- Hate speech or discrimination
- Harassment or threats
- Spam or excessive self-promotion
- Inappropriate requests

Keep the vibe check casual but firm."""
        )
        
        # Get response
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            result = json.loads(response.content)
            return {
                'safe': result.get('safe', True),
                'reason': result.get('reason', 'Clean'),
                'filtered_text': text
            }
        except json.JSONDecodeError:
            # Fallback if Claude doesn't return JSON
            if 'unsafe' in response.content.lower() or 'not safe' in response.content.lower():
                return {
                    'safe': False,
                    'reason': "Content flagged by AI moderator",
                    'filtered_text': text
                }
            return {
                'safe': True,
                'reason': 'Clean',
                'filtered_text': text
            }
    
    except Exception as e:
        print(f"AI Moderation error: {e}")
        # Fallback to basic filter on error
        forbidden_words = ['badword1', 'badword2', 'spam']
        text_lower = text.lower()
        
        for word in forbidden_words:
            if word in text_lower:
                return {
                    'safe': False,
                    'reason': "Message didn't fit the vibe.",
                    'filtered_text': text.replace(word, '***')
                }
        
        # Message is safe (fail open to avoid blocking on errors)
        return {
            'safe': True,
            'reason': 'Clean',
            'filtered_text': text
        }


# ============================================================================
# Real-time translation (Pillar 6 — text side)
# Uses Emergent LLM Key via Claude for reliable multilingual translation.
# ============================================================================

# In-memory cache so identical phrases within a chat session don't re-hit the LLM.
_TRANSLATION_CACHE: Dict[str, Dict[str, str]] = {}
_TRANSLATION_CACHE_MAX = 1024


async def translate_message(text: str, target_lang: str, source_hint: Optional[str] = None) -> Dict[str, str]:
    """
    Translate a chat message to target_lang (ISO-639-1 code, e.g. 'EN', 'FR', 'ES').
    Returns {original, translated, target_lang, same_language}.

    Fail-open: on any error, returns original text unchanged.
    """
    if not text or not target_lang:
        return {'original': text, 'translated': text, 'target_lang': target_lang or '', 'same_language': True}

    target_upper = target_lang.upper()
    cache_key = f"{target_upper}::{text}"
    if cache_key in _TRANSLATION_CACHE:
        return _TRANSLATION_CACHE[cache_key]

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"translate_{target_upper}",
            system_message=(
                "You are a precise chat translator for a gaming platform. Translate the user's "
                "message into the target language. Preserve emoji and `:shortcodes:` exactly. "
                "If the message is already in the target language, return it unchanged. "
                "Return ONLY a JSON object: {\"translated\":\"...\",\"same_language\":true|false}."
            )
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        hint = f" (source hint: {source_hint})" if source_hint else ""
        response = await chat.send_message(
            UserMessage(text=f'Target language: {target_upper}{hint}\nMessage: "{text}"')
        )

        # emergentintegrations returns the raw response text directly (string).
        raw = response.content if hasattr(response, 'content') else str(response)
        # Strip common markdown code-fence wrappers like ```json ... ```
        stripped = raw.strip()
        if stripped.startswith("```"):
            # drop first fence line and any trailing fence
            lines = stripped.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            stripped = "\n".join(lines).strip()
        try:
            data = json.loads(stripped)
            translated = data.get('translated', text)
            same = bool(data.get('same_language', False))
        except (json.JSONDecodeError, AttributeError):
            # Model returned plain text (not JSON). Treat as the translation itself.
            translated = stripped.strip().strip('"').strip('`')
            for prefix in ("Translation:", "Translated:", "Result:"):
                if translated.lower().startswith(prefix.lower()):
                    translated = translated[len(prefix):].strip()
            same = translated.strip().lower() == text.strip().lower()

        result = {
            'original': text,
            'translated': translated,
            'target_lang': target_upper,
            'same_language': same,
        }
        # Simple LRU-ish cap
        if len(_TRANSLATION_CACHE) >= _TRANSLATION_CACHE_MAX:
            _TRANSLATION_CACHE.clear()
        _TRANSLATION_CACHE[cache_key] = result
        return result
    except Exception as e:
        print(f"[chat.translate] failed: {e}")
        return {'original': text, 'translated': text, 'target_lang': target_upper, 'same_language': True}


# Message persistence
async def save_message_to_db(db, message_data: dict) -> Dict[str, Any]:
    """Save message to MongoDB for history"""
    try:
        message_doc = {
            'message_id': f"msg_{datetime.now(timezone.utc).timestamp()}",
            'room_id': message_data.get('room'),
            'sender_id': message_data.get('sender_id'),
            'sender_name': message_data.get('sender_name'),
            'message': message_data.get('message'),
            'timestamp': message_data.get('timestamp'),
            'type': message_data.get('type', 'text'),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(message_doc)
    except Exception as e:
        print(f"Error saving message: {e}")


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    token: Optional[str] = None
) -> Dict[str, Any]:
    """
    WebSocket endpoint for Global Vibez Chat
    
    Protocol:
    - Client sends: {action: 'join_room', room: 'game_123'}
    - Client sends: {action: 'send_message', room: 'game_123', message: 'Hello!'}
    - Server sends: {type: 'message', ...data}
    - Server sends: {type: 'user_joined', ...data}
    """
    
    # Get user info from token (simplified for now)
    user_id = token or f"guest_{id(websocket)}"
    user_name = f"User_{user_id[:8]}"
    
    # Connect user
    await manager.connect(websocket, user_id)
    
    # Auto-join global lobby
    manager.join_room(user_id, 'global_lobby')
    
    # Notify room of new user
    await manager.broadcast_to_room({
        'type': 'user_joined',
        'user_id': user_id,
        'user_name': user_name,
        'room': 'global_lobby',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, 'global_lobby', exclude_user=user_id)
    
    # Send welcome message
    await manager.send_personal_message({
        'type': 'system',
        'message': f'Welcome to Global Vibez Chat, {user_name}! ✨',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, user_id)
    
    try:
        # Get database connection
        db = get_database()
        
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            action = data.get('action')
            
            # Handle different actions
            if action == 'join_room':
                room_id = data.get('room')
                if room_id:
                    manager.join_room(user_id, room_id)
                    
                    # Notify room
                    await manager.broadcast_to_room({
                        'type': 'user_joined',
                        'user_id': user_id,
                        'user_name': user_name,
                        'room': room_id,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room_id, exclude_user=user_id)
                    
                    # Send room history (last 50 messages)
                    history = await db.chat_messages.find(
                        {'room_id': room_id},
                        {'_id': 0}
                    ).sort('created_at', -1).limit(50).to_list(50)
                    
                    await manager.send_personal_message({
                        'type': 'room_history',
                        'room': room_id,
                        'messages': list(reversed(history))
                    }, user_id)
            
            elif action == 'leave_room':
                room_id = data.get('room')
                if room_id:
                    manager.leave_room(user_id, room_id)
                    
                    # Notify room
                    await manager.broadcast_to_room({
                        'type': 'user_left',
                        'user_id': user_id,
                        'user_name': user_name,
                        'room': room_id,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room_id)
            
            elif action == 'send_message':
                room_id = data.get('room')
                message_text = data.get('message', '').strip()
                target_langs = data.get('target_langs') or []  # optional per-recipient langs

                if not room_id or not message_text:
                    continue

                # AI Moderation
                moderation_result = await moderate_message(message_text, user_id)

                if not moderation_result['safe']:
                    # Send error to sender
                    await manager.send_personal_message({
                        'type': 'error',
                        'message': moderation_result['reason'],
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, user_id)
                    continue

                # Translations — fire in parallel for every language requested.
                translations: Dict[str, str] = {}
                if target_langs:
                    results = await asyncio.gather(
                        *(translate_message(message_text, lang) for lang in target_langs),
                        return_exceptions=True,
                    )
                    for lang, r in zip(target_langs, results):
                        if isinstance(r, dict):
                            translations[lang.upper()] = r['translated']

                # Create message object
                message_data = {
                    'type': 'message',
                    'room': room_id,
                    'sender_id': user_id,
                    'sender_name': user_name,
                    'message': message_text,
                    'translations': translations,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }

                # Save to database
                await save_message_to_db(db, message_data)

                # Broadcast to room
                await manager.broadcast_to_room(message_data, room_id)

            elif action == 'translate':
                # On-demand translation for a single message the user has selected.
                target_lang = data.get('target_lang', 'EN')
                text = data.get('text', '').strip()
                if not text:
                    continue
                translated = await translate_message(text, target_lang)
                await manager.send_personal_message({
                    'type': 'translation',
                    **translated,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                }, user_id)
            
            elif action == 'typing':
                room_id = data.get('room')
                is_typing = data.get('is_typing', False)
                
                if room_id:
                    # Broadcast typing status
                    await manager.broadcast_to_room({
                        'type': 'typing',
                        'user_id': user_id,
                        'user_name': user_name,
                        'room': room_id,
                        'is_typing': is_typing
                    }, room_id, exclude_user=user_id)
            
            elif action == 'get_online_users':
                # Send list of online users
                online_users = manager.get_online_users()
                await manager.send_personal_message({
                    'type': 'online_users',
                    'users': online_users,
                    'count': len(online_users)
                }, user_id)
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        
        # Notify all rooms user was in
        if user_id in manager.user_rooms:
            for room_id in list(manager.user_rooms[user_id]):
                await manager.broadcast_to_room({
                    'type': 'user_left',
                    'user_id': user_id,
                    'user_name': user_name,
                    'room': room_id,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }, room_id)
    
    except Exception as e:
        print(f"WebSocket error for {user_id}: {e}")
        manager.disconnect(user_id)


# REST API endpoints for chat metadata
@router.get("/chat/rooms")
async def get_chat_rooms() -> Dict[str, Any]:
    """Get list of available chat rooms"""
    return {
        'rooms': [
            {'id': 'global_lobby', 'name': 'Global Lobby', 'type': 'public'},
            {'id': 'dating_lounge', 'name': 'Dating Lounge', 'type': 'public'},
            {'id': 'game_central', 'name': 'Game Central', 'type': 'public'},
        ]
    }


@router.get("/chat/history/{room_id}")
async def get_room_history(room_id: str, limit: int = 50) -> Dict[str, Any]:
    """Get message history for a room"""
    db = get_database()
    
    messages = await db.chat_messages.find(
        {'room_id': room_id},
        {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    
    return {
        'room_id': room_id,
        'messages': list(reversed(messages)),
        'count': len(messages)
    }


@router.get("/chat/online")
async def get_online_users() -> Dict[str, Any]:
    """Get currently online users"""
    return {
        'online_users': manager.get_online_users(),
        'count': len(manager.get_online_users())
    }


# ============================================================================
# Pillar 6 — Real-time Translation (REST fallback for clients that don't use WS)
# ============================================================================
class TranslatePayload(BaseModel):
    text: str
    target_lang: str = "EN"
    source_hint: Optional[str] = None


@router.post("/chat/translate")
async def translate_endpoint(payload: TranslatePayload) -> Dict[str, Any]:
    """
    One-shot translation endpoint (non-WS callers).

    POST /api/chat/translate  {"text": "Salut", "target_lang": "EN"}
    →  {"original": "Salut", "translated": "Hi", "target_lang": "EN", "same_language": false}
    """
    return await translate_message(payload.text, payload.target_lang, payload.source_hint)

