"""
Poker Game Logic
Delegates to existing poker_multiplayer.py
"""
from typing import Any, Dict

from ..poker_multiplayer import (
    poker_tables,
    create_poker_table,
    join_poker_table,
    get_table_state_for_player,
    remove_player_from_table
)

# Re-export for cleaner imports
__all__ = [
    'poker_tables',
    'create_poker_table',
    'join_poker_table',
    'get_table_state_for_player',
    'remove_player_from_table'
]


class PokerGame:
    """Poker game handler — thin static wrapper over the multiplayer module."""

    @staticmethod
    def create_table(room_code: str, session_id: str, player_name: str, buy_in: int, small_blind: int) -> Dict[str, Any]:
        return create_poker_table(room_code, session_id, player_name, buy_in, small_blind)

    @staticmethod
    def join_table(room_code: str, session_id: str, player_name: str, buy_in: int) -> Dict[str, Any]:
        return join_poker_table(room_code, session_id, player_name, buy_in)

    @staticmethod
    def get_state(table: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        return get_table_state_for_player(table, session_id)
