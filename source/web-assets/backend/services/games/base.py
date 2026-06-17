"""
Base classes for multiplayer games
Common functionality shared across all game types
"""
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class GamePlayer:
    """Represents a player in a multiplayer game"""
    session_id: str
    user_id: str
    name: str
    ready: bool = False
    connected: bool = True
    joined_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self) -> Dict:
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'name': self.name,
            'ready': self.ready,
            'connected': self.connected,
            'joined_at': self.joined_at
        }


@dataclass
class GameRoom:
    """Base class for game rooms"""
    room_code: str
    game_type: str
    host: GamePlayer
    status: str = 'waiting'  # waiting, playing, completed
    is_private: bool = True
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    guest: Optional[GamePlayer] = None
    game_state: Optional[Dict] = None
    current_turn: Optional[str] = None
    chat_messages: List[Dict] = field(default_factory=list)
    spectators: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        """Convert room to dictionary"""
        return {
            'room_code': self.room_code,
            'game_type': self.game_type,
            'status': self.status,
            'is_private': self.is_private,
            'created_at': self.created_at,
            'host': self.host.to_dict(),
            'guest': self.guest.to_dict() if self.guest else None,
            'game_state': self.game_state,
            'current_turn': self.current_turn,
            'chat_messages': self.chat_messages,
            'spectators': self.spectators
        }
    
    def add_player(self, player: GamePlayer) -> bool:
        """Add a player to the room"""
        if self.guest is None:
            self.guest = player
            return True
        return False
    
    def remove_player(self, session_id: str) -> bool:
        """Remove a player from the room"""
        if self.host.session_id == session_id:
            self.host.connected = False
            return True
        elif self.guest and self.guest.session_id == session_id:
            self.guest = None
            return True
        return False
    
    def is_full(self) -> bool:
        """Check if room is full"""
        return self.guest is not None
    
    def get_player_count(self) -> int:
        """Get number of players"""
        count = 1  # Host
        if self.guest:
            count += 1
        return count
    
    def add_chat_message(self, sender_id: str, sender_name: str, message: str) -> None:
        """Add a chat message"""
        self.chat_messages.append({
            'sender_id': sender_id,
            'sender_name': sender_name,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        })


class BaseGameLogic:
    """Base class for game-specific logic"""
    
    def __init__(self, room: GameRoom) -> None:
        self.room = room
    
    def initialize_game(self) -> Dict:
        """Initialize game state - to be overridden by specific games"""
        raise NotImplementedError
    
    def make_move(self, player_id: str, move_data: Dict) -> Dict:
        """Process a player move - to be overridden"""
        raise NotImplementedError
    
    def get_state_for_player(self, player_id: str) -> Dict:
        """Get game state for specific player - to be overridden"""
        raise NotImplementedError
    
    def is_game_over(self) -> bool:
        """Check if game is over - to be overridden"""
        raise NotImplementedError
    
    def get_winner(self) -> Optional[str]:
        """Get winner if game is over - to be overridden"""
        raise NotImplementedError
