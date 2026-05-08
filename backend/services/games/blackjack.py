"""
Blackjack Game Logic
Delegates to existing blackjack_multiplayer.py
"""
from typing import Any, Dict

from ..blackjack_multiplayer import (
    blackjack_tables,
    create_blackjack_table,
    join_blackjack_table,
    start_betting_round,
    place_bet,
    player_blackjack_action,
    get_table_state_for_player as get_blackjack_state,
    remove_player_from_table as remove_blackjack_player
)

__all__ = [
    'blackjack_tables',
    'create_blackjack_table',
    'join_blackjack_table',
    'start_betting_round',
    'place_bet',
    'player_blackjack_action',
    'get_blackjack_state',
    'remove_blackjack_player'
]


class BlackjackGame:
    """Blackjack game handler — thin static wrapper over the multiplayer module."""

    @staticmethod
    def create_table(room_code: str, session_id: str, player_name: str, min_bet: int = 10) -> Dict[str, Any]:
        return create_blackjack_table(room_code, session_id, player_name, min_bet)

    @staticmethod
    def join_table(room_code: str, session_id: str, player_name: str) -> Dict[str, Any]:
        return join_blackjack_table(room_code, session_id, player_name)

    @staticmethod
    def start_round(room_code: str) -> Dict[str, Any]:
        return start_betting_round(room_code)

    @staticmethod
    def get_state(table: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        return get_blackjack_state(table, session_id)
