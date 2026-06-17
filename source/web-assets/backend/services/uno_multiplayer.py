"""
Real-Time Multiplayer UNO
Socket.IO-based UNO game with 2-4 players
Features: Real-time card playing, special cards, UNO callouts, color changing
"""
import secrets
from typing import Dict, List, Optional
from datetime import datetime

# UNO game states
class UnoGameState:
    WAITING = "waiting"
    DEALING = "dealing"
    PLAYING = "playing"
    ROUND_COMPLETE = "round_complete"

# Card types
class UnoCardType:
    NUMBER = "number"
    SKIP = "skip"
    REVERSE = "reverse"
    DRAW_TWO = "draw_two"
    WILD = "wild"
    WILD_DRAW_FOUR = "wild_draw_four"

# Player actions
class UnoAction:
    PLAY_CARD = "play_card"
    DRAW_CARD = "draw_card"
    CALL_UNO = "call_uno"

# UNO tables storage
uno_tables: Dict[str, Dict] = {}

def fisher_yates_shuffle(deck: List[Dict]) -> List[Dict]:
    """
    Fisher-Yates Shuffle Algorithm (cryptographically secure)
    Ensures every permutation of the deck is equally likely.
    Time Complexity: O(n)
    Space Complexity: O(1) - in-place shuffling
    """
    n = len(deck)
    for i in range(n - 1, 0, -1):
        # Use secrets.randbelow for cryptographically secure random selection
        j = secrets.randbelow(i + 1)
        # Swap elements at positions i and j
        deck[i], deck[j] = deck[j], deck[i]
    return deck

def create_uno_deck() -> List[Dict]:
    """Create a complete UNO deck"""
    colors = ['red', 'yellow', 'green', 'blue']
    deck = []
    
    # Number cards (0-9, one 0 per color, two of each 1-9)
    for color in colors:
        deck.append({'color': color, 'type': 'number', 'value': 0, 'id': f"{color}_0"})
        for num in range(1, 10):
            for _ in range(2):
                deck.append({'color': color, 'type': 'number', 'value': num, 'id': f"{color}_{num}_{_}"})
    
    # Special cards (2 of each per color)
    for color in colors:
        for _ in range(2):
            deck.append({'color': color, 'type': 'skip', 'value': 'Skip', 'id': f"{color}_skip_{_}"})
            deck.append({'color': color, 'type': 'reverse', 'value': 'Reverse', 'id': f"{color}_reverse_{_}"})
            deck.append({'color': color, 'type': 'draw_two', 'value': '+2', 'id': f"{color}_draw2_{_}"})
    
    # Wild cards (4 of each)
    for i in range(4):
        deck.append({'color': 'wild', 'type': 'wild', 'value': 'Wild', 'id': f"wild_{i}"})
        deck.append({'color': 'wild', 'type': 'wild_draw_four', 'value': '+4', 'id': f"wild_draw4_{i}"})
    
    # Use Fisher-Yates shuffle for cryptographically secure randomization
    return fisher_yates_shuffle(deck)

def can_play_card(card: Dict, top_card: Dict, current_color: str) -> bool:
    """Check if a card can be played on the top card"""
    # Wild cards can always be played
    if card['type'] in ['wild', 'wild_draw_four']:
        return True
    
    # Match color (use current_color which might be set by wild card)
    if card['color'] == current_color:
        return True
    
    # Match value/type (for number cards and special cards)
    if card['type'] == 'number' and top_card['type'] == 'number':
        if card['value'] == top_card['value']:
            return True
    elif card['type'] == top_card['type'] and card['type'] != 'number':
        return True
    
    return False

def create_uno_table(room_code: str, host_session_id: str, host_name: str) -> Dict:
    """Create a new UNO table"""
    table = {
        'room_code': room_code,
        'created_at': datetime.utcnow().isoformat(),
        'game_state': UnoGameState.WAITING,
        'players': {},
        'player_order': [],
        'current_player_index': 0,
        'play_direction': 1,  # 1 for clockwise, -1 for counter-clockwise
        'deck': [],
        'discard_pile': [],
        'current_color': None,
        'round_number': 0,
        'winner': None,
        'uno_called': {}  # session_id -> bool (tracks who called UNO)
    }
    
    # Add host
    table['players'][host_session_id] = {
        'session_id': host_session_id,
        'name': host_name,
        'hand': [],
        'is_active': True,
        'score': 0,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(host_session_id)
    
    uno_tables[room_code] = table
    return table

def join_uno_table(room_code: str, session_id: str, player_name: str) -> Optional[Dict]:
    """Add a player to UNO table"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    # Max 4 players for UNO
    if len(table['players']) >= 4:
        return {'error': 'Table is full (max 4 players)'}
    
    if session_id in table['players']:
        return table
    
    if table['game_state'] not in [UnoGameState.WAITING, UnoGameState.ROUND_COMPLETE]:
        return {'error': 'Game in progress, wait for next round'}
    
    table['players'][session_id] = {
        'session_id': session_id,
        'name': player_name,
        'hand': [],
        'is_active': True,
        'score': 0,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(session_id)
    
    return table

def start_uno_round(room_code: str) -> Optional[Dict]:
    """Start a new UNO round"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    active_players = [p for p in table['players'].values() if p['is_active']]
    if len(active_players) < 2:
        return {'error': 'Need at least 2 players'}
    
    # Reset round state
    table['game_state'] = UnoGameState.DEALING
    table['round_number'] += 1
    table['deck'] = create_uno_deck()
    table['discard_pile'] = []
    table['current_player_index'] = 0
    table['play_direction'] = 1
    table['winner'] = None
    table['uno_called'] = {}
    
    # Deal 7 cards to each player
    for session_id in table['player_order']:
        player = table['players'][session_id]
        if player['is_active']:
            player['hand'] = [table['deck'].pop() for _ in range(7)]
    
    # Put first card on discard pile (skip wild cards for first card)
    first_card = table['deck'].pop()
    while first_card['type'] in ['wild', 'wild_draw_four']:
        table['deck'].insert(0, first_card)
        first_card = table['deck'].pop()
    
    table['discard_pile'].append(first_card)
    table['current_color'] = first_card['color']
    
    # Handle first card effects
    if first_card['type'] == 'skip':
        table['current_player_index'] = 1 % len(table['player_order'])
    elif first_card['type'] == 'reverse':
        table['play_direction'] = -1
        table['current_player_index'] = len(table['player_order']) - 1
    elif first_card['type'] == 'draw_two':
        # First player draws 2
        for _ in range(2):
            if table['deck']:
                table['players'][table['player_order'][0]]['hand'].append(table['deck'].pop())
        table['current_player_index'] = 1 % len(table['player_order'])
    
    table['game_state'] = UnoGameState.PLAYING
    
    return table

def play_uno_card(room_code: str, session_id: str, card_index: int, chosen_color: Optional[str] = None) -> Optional[Dict]:
    """Play a card from player's hand"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    if table['game_state'] != UnoGameState.PLAYING:
        return {'error': 'Game not in playing state'}
    
    current_session = table['player_order'][table['current_player_index']]
    if current_session != session_id:
        return {'error': 'Not your turn'}
    
    player = table['players'][session_id]
    
    if card_index < 0 or card_index >= len(player['hand']):
        return {'error': 'Invalid card index'}
    
    card = player['hand'][card_index]
    top_card = table['discard_pile'][-1]
    
    # Validate card can be played
    if not can_play_card(card, top_card, table['current_color']):
        return {'error': 'Cannot play this card'}
    
    # Wild cards need color choice
    if card['type'] in ['wild', 'wild_draw_four'] and not chosen_color:
        return {'error': 'Must choose a color for wild card'}
    
    # Remove card from hand and add to discard pile
    player['hand'].pop(card_index)
    table['discard_pile'].append(card)
    
    # Set current color
    if card['type'] in ['wild', 'wild_draw_four']:
        table['current_color'] = chosen_color
    else:
        table['current_color'] = card['color']
    
    # Check for winner
    if len(player['hand']) == 0:
        table['winner'] = {
            'session_id': session_id,
            'name': player['name']
        }
        table['game_state'] = UnoGameState.ROUND_COMPLETE
        return table
    
    # Clear UNO call if player plays down to NOT 1 card
    if len(player['hand']) != 1 and session_id in table['uno_called']:
        del table['uno_called'][session_id]
    
    # Apply card effect
    next_player_index = advance_turn(table, card)
    table['current_player_index'] = next_player_index
    
    return table

def advance_turn(table: Dict, played_card: Dict) -> int:
    """Advance to next player based on card effect"""
    current_index = table['current_player_index']
    num_players = len(table['player_order'])
    direction = table['play_direction']
    
    # Skip card
    if played_card['type'] == 'skip':
        # Skip next player
        return (current_index + direction * 2) % num_players
    
    # Reverse card
    elif played_card['type'] == 'reverse':
        # Change direction
        table['play_direction'] *= -1
        direction = table['play_direction']
        return (current_index + direction) % num_players
    
    # Draw 2 card
    elif played_card['type'] == 'draw_two':
        next_index = (current_index + direction) % num_players
        next_session = table['player_order'][next_index]
        # Next player draws 2 cards
        for _ in range(2):
            if table['deck']:
                table['players'][next_session]['hand'].append(table['deck'].pop())
        # Skip the player who drew
        return (next_index + direction) % num_players
    
    # Wild Draw 4 card
    elif played_card['type'] == 'wild_draw_four':
        next_index = (current_index + direction) % num_players
        next_session = table['player_order'][next_index]
        # Next player draws 4 cards
        for _ in range(4):
            if table['deck']:
                table['players'][next_session]['hand'].append(table['deck'].pop())
        # Skip the player who drew
        return (next_index + direction) % num_players
    
    # Regular card
    else:
        return (current_index + direction) % num_players

def draw_uno_card(room_code: str, session_id: str) -> Optional[Dict]:
    """Draw a card from the deck"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    if table['game_state'] != UnoGameState.PLAYING:
        return {'error': 'Game not in playing state'}
    
    current_session = table['player_order'][table['current_player_index']]
    if current_session != session_id:
        return {'error': 'Not your turn'}
    
    player = table['players'][session_id]
    
    # Draw card
    if table['deck']:
        drawn_card = table['deck'].pop()
        player['hand'].append(drawn_card)
    else:
        return {'error': 'Deck is empty'}
    
    # Check if drawn card can be played
    top_card = table['discard_pile'][-1]
    if can_play_card(drawn_card, top_card, table['current_color']):
        # Player can optionally play the drawn card
        return {
            'drawn_card': drawn_card,
            'can_play': True,
            'card_index': len(player['hand']) - 1
        }
    else:
        # Player must skip turn
        table['current_player_index'] = (table['current_player_index'] + table['play_direction']) % len(table['player_order'])
    
    return table

def call_uno(room_code: str, session_id: str) -> Optional[Dict]:
    """Player calls UNO when they have 1 card left"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    player = table['players'].get(session_id)
    
    if not player:
        return {'error': 'Player not found'}
    
    if len(player['hand']) == 1:
        table['uno_called'][session_id] = True
        return table
    else:
        return {'error': 'Must have exactly 1 card to call UNO'}

def get_table_state_for_player(table: Dict, session_id: str) -> Dict:
    """Get table state customized for a specific player"""
    state = {
        'room_code': table['room_code'],
        'game_state': table['game_state'],
        'round_number': table['round_number'],
        'current_player_index': table['current_player_index'],
        'play_direction': table['play_direction'],
        'current_color': table['current_color'],
        'top_card': table['discard_pile'][-1] if table['discard_pile'] else None,
        'deck_count': len(table['deck']),
        'winner': table['winner'],
        'players': []
    }
    
    # Add player data
    for i, pid in enumerate(table['player_order']):
        player = table['players'][pid]
        player_data = {
            'session_id': pid,
            'name': player['name'],
            'hand_count': len(player['hand']),
            'is_active': player['is_active'],
            'score': player['score'],
            'seat_index': i,
            'is_current_turn': (i == table['current_player_index']),
            'has_uno': pid in table['uno_called']
        }
        
        # Show own hand
        if pid == session_id:
            player_data['hand'] = player['hand']
        
        state['players'].append(player_data)
    
    return state

def fill_with_bots(room_code: str) -> Optional[Dict]:
    """Fill empty seats with AI bot players (up to 4 total).
    
    Bots get session_ids prefixed with 'BOT_' so the play loop can distinguish
    them. Used when a single user wants to start a UNO game without waiting
    for human opponents.
    """
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    # Only allowed in waiting / round_complete state.
    if table['game_state'] not in [UnoGameState.WAITING, UnoGameState.ROUND_COMPLETE]:
        return {'error': 'Cannot add bots while a round is in progress'}
    
    # Add bots until we hit 4 players (or 3 if the user wants a 1v3 game).
    bot_names = ['Nova-Bot', 'Echo-Bot', 'Rune-Bot']
    while len(table['players']) < 4:
        idx = len(table['players'])
        bot_id = f"BOT_{room_code}_{idx}"
        bot_name = bot_names[idx - 1] if idx - 1 < len(bot_names) else f'Bot-{idx}'
        table['players'][bot_id] = {
            'session_id': bot_id,
            'name': bot_name,
            'hand': [],
            'is_active': True,
            'is_bot': True,
            'score': 0,
            'joined_at': datetime.utcnow().isoformat()
        }
        table['player_order'].append(bot_id)
    
    return table

def remove_player_from_table(room_code: str, session_id: str) -> Optional[Dict]:
    """Remove a player from UNO table"""
    if room_code not in uno_tables:
        return None
    
    table = uno_tables[room_code]
    
    if session_id not in table['players']:
        return table
    
    table['players'][session_id]['is_active'] = False
    
    if table['game_state'] == UnoGameState.WAITING:
        del table['players'][session_id]
        table['player_order'].remove(session_id)
    
    active_count = sum(1 for p in table['players'].values() if p['is_active'])
    if active_count == 0:
        del uno_tables[room_code]
        return None
    
    return table
