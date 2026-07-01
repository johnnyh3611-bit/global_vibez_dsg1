"""
Real-Time Multiplayer Poker (Texas Hold'em)
Socket.IO-based poker game with 2-6 players
Features: Real-time betting, synchronized card dealing, pot management, showdown
"""
import secrets
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from utils.poker_evaluator import PokerHandEvaluator

# Poker game states
class PokerGameState:
    WAITING = "waiting"  # Waiting for players
    DEALING = "dealing"  # Dealing hole cards
    PRE_FLOP = "pre_flop"  # Before flop betting
    FLOP = "flop"  # Flop revealed, betting
    TURN = "turn"  # Turn revealed, betting
    RIVER = "river"  # River revealed, betting
    SHOWDOWN = "showdown"  # Revealing hands
    HAND_COMPLETE = "hand_complete"  # Hand finished

# Player actions
class PokerAction:
    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    RAISE = "raise"
    ALL_IN = "all_in"

# Poker tables storage (room_code -> table data)
poker_tables: Dict[str, Dict] = {}

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

def create_deck() -> List[Dict]:
    """Create a standard 52-card deck"""
    suits = ['hearts', 'diamonds', 'clubs', 'spades']
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    deck = []
    for suit in suits:
        for rank in ranks:
            deck.append({
                'suit': suit,
                'rank': rank,
                'id': f"{rank}_{suit}"
            })
    # Use Fisher-Yates shuffle for cryptographically secure randomization
    return fisher_yates_shuffle(deck)

def create_poker_table(room_code: str, host_session_id: str, host_name: str, buy_in: int = 1000, small_blind: int = 10, rake_percentage: float = 0.05, rake_cap: int = 10) -> Dict:
    """Create a new poker table with casino-grade features"""
    table = {
        'room_code': room_code,
        'created_at': datetime.utcnow().isoformat(),
        'game_state': PokerGameState.WAITING,
        'players': {},  # session_id -> player data
        'player_order': [],  # List of session_ids in seating order
        'dealer_index': 0,
        'current_player_index': 0,
        'small_blind': small_blind,
        'big_blind': small_blind * 2,
        'buy_in': buy_in,
        'pot': 0,
        'side_pots': [],  # List of {amount, eligible_players[]}
        'current_bet': 0,
        'deck': [],
        'community_cards': [],
        'burn_pile': [],  # Burned cards
        'muck_pile': [],  # Mucked/discarded cards
        'round_bets': {},  # session_id -> bet amount this round
        'winners': [],
        'hand_history': [],
        'rake_percentage': rake_percentage,  # House cut (default 5%)
        'rake_cap': rake_cap,  # Maximum rake per hand
        'total_rake_collected': 0,  # Running total of house earnings
        'dealer_controls_enabled': False  # Manual dealer mode
    }
    
    # Add host as first player
    table['players'][host_session_id] = {
        'session_id': host_session_id,
        'name': host_name,
        'chips': buy_in,
        'hole_cards': [],
        'current_bet': 0,
        'total_bet_this_hand': 0,
        'is_folded': False,
        'is_all_in': False,
        'is_dealer': True,
        'is_active': True,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(host_session_id)
    
    poker_tables[room_code] = table
    return table

def join_poker_table(room_code: str, session_id: str, player_name: str) -> Optional[Dict]:
    """Add a player to poker table"""
    if room_code not in poker_tables:
        return None
    
    table = poker_tables[room_code]
    
    # Check if table is full (max 6 players for Texas Hold'em)
    if len(table['players']) >= 6:
        return {'error': 'Table is full'}
    
    # Check if player already at table
    if session_id in table['players']:
        return table
    
    # Check if game already started
    if table['game_state'] != PokerGameState.WAITING:
        return {'error': 'Game already in progress'}
    
    # Add player
    table['players'][session_id] = {
        'session_id': session_id,
        'name': player_name,
        'chips': table['buy_in'],
        'hole_cards': [],
        'current_bet': 0,
        'total_bet_this_hand': 0,
        'is_folded': False,
        'is_all_in': False,
        'is_dealer': False,
        'is_active': True,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(session_id)
    
    return table

def start_poker_hand(room_code: str) -> Optional[Dict]:
    """Start a new poker hand"""
    if room_code not in poker_tables:
        return None
    
    table = poker_tables[room_code]
    
    # Need at least 2 players
    active_players = [p for p in table['players'].values() if p['is_active'] and not p['is_folded']]
    if len(active_players) < 2:
        return {'error': 'Need at least 2 players'}
    
    # Reset hand state
    table['game_state'] = PokerGameState.DEALING
    table['pot'] = 0
    table['current_bet'] = 0
    table['community_cards'] = []
    table['round_bets'] = {}
    table['winners'] = []
    
    # Reset player states
    for player in table['players'].values():
        player['hole_cards'] = []
        player['current_bet'] = 0
        player['total_bet_this_hand'] = 0
        player['is_folded'] = False
        player['is_all_in'] = False
    
    # Create and shuffle deck
    table['deck'] = create_deck()
    
    # Move dealer button
    table['dealer_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
    
    # Update dealer flag
    for i, session_id in enumerate(table['player_order']):
        table['players'][session_id]['is_dealer'] = (i == table['dealer_index'])
    
    # Deal hole cards (2 cards per player)
    for session_id in table['player_order']:
        player = table['players'][session_id]
        if player['is_active']:
            player['hole_cards'] = [table['deck'].pop(), table['deck'].pop()]
    
    # Post blinds
    small_blind_index = (table['dealer_index'] + 1) % len(table['player_order'])
    big_blind_index = (table['dealer_index'] + 2) % len(table['player_order'])
    
    small_blind_session = table['player_order'][small_blind_index]
    big_blind_session = table['player_order'][big_blind_index]
    
    # Post small blind
    sb_amount = min(table['small_blind'], table['players'][small_blind_session]['chips'])
    table['players'][small_blind_session]['chips'] -= sb_amount
    table['players'][small_blind_session]['current_bet'] = sb_amount
    table['players'][small_blind_session]['total_bet_this_hand'] = sb_amount
    table['pot'] += sb_amount
    table['round_bets'][small_blind_session] = sb_amount
    
    # Post big blind
    bb_amount = min(table['big_blind'], table['players'][big_blind_session]['chips'])
    table['players'][big_blind_session]['chips'] -= bb_amount
    table['players'][big_blind_session]['current_bet'] = bb_amount
    table['players'][big_blind_session]['total_bet_this_hand'] = bb_amount
    table['pot'] += bb_amount
    table['round_bets'][big_blind_session] = bb_amount
    table['current_bet'] = bb_amount
    
    # Set current player (after big blind)
    table['current_player_index'] = (big_blind_index + 1) % len(table['player_order'])
    table['game_state'] = PokerGameState.PRE_FLOP
    
    return table

def player_poker_action(room_code: str, session_id: str, action: str, amount: int = 0) -> Optional[Dict]:
    """Process a player's poker action"""
    if room_code not in poker_tables:
        return None
    
    table = poker_tables[room_code]
    
    # Verify it's player's turn
    current_session = table['player_order'][table['current_player_index']]
    if current_session != session_id:
        return {'error': 'Not your turn'}
    
    player = table['players'][session_id]
    
    # Process action
    if action == PokerAction.FOLD:
        player['is_folded'] = True
    
    elif action == PokerAction.CHECK:
        # Can only check if current bet == 0 or player has already matched
        if table['current_bet'] > player['current_bet']:
            return {'error': 'Cannot check, must call or fold'}
    
    elif action == PokerAction.CALL:
        call_amount = min(table['current_bet'] - player['current_bet'], player['chips'])
        player['chips'] -= call_amount
        player['current_bet'] += call_amount
        player['total_bet_this_hand'] += call_amount
        table['pot'] += call_amount
        table['round_bets'][session_id] = player['current_bet']
        
        if player['chips'] == 0:
            player['is_all_in'] = True
    
    elif action == PokerAction.RAISE:
        # Raise must be at least double the current bet
        min_raise = table['current_bet'] * 2
        if amount < min_raise:
            amount = min_raise
        
        raise_amount = min(amount - player['current_bet'], player['chips'])
        player['chips'] -= raise_amount
        player['current_bet'] += raise_amount
        player['total_bet_this_hand'] += raise_amount
        table['pot'] += raise_amount
        table['current_bet'] = player['current_bet']
        table['round_bets'][session_id] = player['current_bet']
        
        if player['chips'] == 0:
            player['is_all_in'] = True
    
    elif action == PokerAction.ALL_IN:
        all_in_amount = player['chips']
        player['chips'] = 0
        player['current_bet'] += all_in_amount
        player['total_bet_this_hand'] += all_in_amount
        table['pot'] += all_in_amount
        player['is_all_in'] = True
        table['round_bets'][session_id] = player['current_bet']
        
        if player['current_bet'] > table['current_bet']:
            table['current_bet'] = player['current_bet']
    
    # Move to next player
    table['current_player_index'] = get_next_active_player(table)
    
    # Check if betting round is complete
    if is_betting_round_complete(table):
        advance_game_state(table)
    
    return table

def get_next_active_player(table: Dict) -> int:
    """Find next active player who can act"""
    start_index = table['current_player_index']
    num_players = len(table['player_order'])
    
    for i in range(1, num_players + 1):
        next_index = (start_index + i) % num_players
        session_id = table['player_order'][next_index]
        player = table['players'][session_id]
        
        if player['is_active'] and not player['is_folded'] and not player['is_all_in']:
            return next_index
    
    # No active players found, return current
    return start_index

def is_betting_round_complete(table: Dict) -> bool:
    """Check if betting round is complete"""
    active_players = [p for p in table['players'].values() 
                     if p['is_active'] and not p['is_folded'] and not p['is_all_in']]
    
    if len(active_players) == 0:
        return True
    
    # Check if all active players have matched the current bet
    for player in active_players:
        if player['current_bet'] < table['current_bet']:
            return False
    
    return True

def advance_game_state(table: Dict) -> None:
    """Move to next stage of the hand"""
    # First check if only one player remains (all others folded)
    active_players = [p for p in table['players'].values() 
                     if p['is_active'] and not p['is_folded']]
    
    if len(active_players) <= 1:
        # Only one player left, they win
        determine_winners(table)
        return
    
    # Reset round bets
    for player in table['players'].values():
        player['current_bet'] = 0
    table['current_bet'] = 0
    table['round_bets'] = {}
    
    if table['game_state'] == PokerGameState.PRE_FLOP:
        # Deal flop (3 cards)
        burned_card = table['deck'].pop()
        table['burn_pile'].append(burned_card)  # Track burned cards
        table['community_cards'] = [table['deck'].pop() for _ in range(3)]
        table['game_state'] = PokerGameState.FLOP
        table['current_player_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
    
    elif table['game_state'] == PokerGameState.FLOP:
        # Deal turn (1 card)
        burned_card = table['deck'].pop()
        table['burn_pile'].append(burned_card)  # Track burned cards
        table['community_cards'].append(table['deck'].pop())
        table['game_state'] = PokerGameState.TURN
        table['current_player_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
    
    elif table['game_state'] == PokerGameState.TURN:
        # Deal river (1 card)
        burned_card = table['deck'].pop()
        table['burn_pile'].append(burned_card)  # Track burned cards
        table['community_cards'].append(table['deck'].pop())
        table['game_state'] = PokerGameState.RIVER
        table['current_player_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
    
    elif table['game_state'] == PokerGameState.RIVER:
        # Go to showdown
        table['game_state'] = PokerGameState.SHOWDOWN
        determine_winners(table)

def calculate_side_pots(table: Dict) -> List[Dict]:
    """
    Calculate main pot and side pots for all-in scenarios
    
    Algorithm:
    1. Sort players by their total bet amount
    2. Create a pot for each betting "level"
    3. Each pot includes only players who contributed at that level
    
    Example:
    - Player A: $100 all-in
    - Player B: $200 all-in  
    - Player C: $300 call
    
    Pots:
    - Main pot: $300 ($100 x 3) - all players eligible
    - Side pot 1: $200 ($100 x 2) - only B and C eligible
    - Side pot 2: $100 ($100 x 1) - only C eligible
    """
    side_pots = []
    
    # Get all players and their total bets this hand
    player_bets = []
    for session_id, player in table['players'].items():
        if player['is_active'] and player['total_bet_this_hand'] > 0:
            player_bets.append({
                'session_id': session_id,
                'total_bet': player['total_bet_this_hand'],
                'is_folded': player['is_folded']
            })
    
    if not player_bets:
        return []
    
    # Sort by bet amount
    player_bets.sort(key=lambda x: x['total_bet'])
    
    previous_level = 0
    
    for i, player_bet in enumerate(player_bets):
        current_level = player_bet['total_bet']
        
        if current_level > previous_level:
            # Calculate pot amount for this level
            contribution_per_player = current_level - previous_level
            num_contributors = len(player_bets) - i + 1  # Players at this level and above
            
            pot_amount = contribution_per_player * num_contributors
            
            # Eligible players are those who didn't fold and bet at least this much
            eligible_players = [
                p['session_id'] for p in player_bets[i:]
                if not p['is_folded']
            ]
            
            if pot_amount > 0 and eligible_players:
                side_pots.append({
                    'amount': pot_amount,
                    'eligible_players': eligible_players,
                    'level': len(side_pots) + 1
                })
            
            previous_level = current_level
    
    return side_pots

def calculate_rake(pot_amount: int, rake_percentage: float = 0.05, rake_cap: int = 10) -> Tuple[int, int]:
    """
    Calculate house rake (casino cut) from the pot
    
    Standard casino rake:
    - 2.5% to 10% of the pot
    - Usually capped at $3-$10 depending on stakes
    
    Args:
        pot_amount: Total pot before rake
        rake_percentage: Percentage to take (0.05 = 5%)
        rake_cap: Maximum rake amount
    
    Returns:
        (pot_after_rake, rake_amount)
    
    Example:
        pot = $200, rake = 5%, cap = $10
        → rake = min($10, $200 * 0.05) = $10
        → player gets $190
    """
    rake = min(int(pot_amount * rake_percentage), rake_cap)
    return pot_amount - rake, rake

def convert_card_to_string(card: Dict) -> str:
    """Convert card dict to string format for evaluator"""
    # Evaluator expects format like "AH", "10C", etc.
    rank = card['rank']
    suit_map = {'hearts': 'H', 'diamonds': 'D', 'clubs': 'C', 'spades': 'S'}
    suit = suit_map.get(card['suit'], 'H')
    return f"{rank}{suit}"

def determine_winners(table: Dict) -> None:
    """
    Determine winner(s) and distribute pot with side pots and rake
    
    Process:
    1. Calculate side pots for all-in scenarios
    2. Evaluate all hands
    3. Award each pot to the best eligible hand
    4. Apply rake to main pot
    """
    active_players = [(sid, p) for sid, p in table['players'].items() 
                     if p['is_active'] and not p['is_folded']]
    
    if len(active_players) == 0:
        return
    
    # If only one player left, they win entire pot (no rake when everyone folds)
    if len(active_players) == 1:
        winner_sid = active_players[0][0]
        table['players'][winner_sid]['chips'] += table['pot']
        table['winners'] = [{
            'session_id': winner_sid,
            'name': table['players'][winner_sid]['name'],
            'hand_name': 'Winner by default (all others folded)',
            'winnings': table['pot'],
            'pot_type': 'main'
        }]
        table['pot'] = 0
        table['side_pots'] = []
        table['game_state'] = PokerGameState.HAND_COMPLETE
        return
    
    # Calculate side pots
    side_pots = calculate_side_pots(table)
    table['side_pots'] = side_pots
    
    # Evaluate all hands
    player_hands = {}
    for session_id, player in active_players:
        if len(player['hole_cards']) > 0:
            # Convert cards to string format
            hole_cards_str = [convert_card_to_string(c) for c in player['hole_cards']]
            community_cards_str = [convert_card_to_string(c) for c in table['community_cards']]
            all_cards_str = hole_cards_str + community_cards_str
            
            # Evaluate hand
            hand_name, hand_rank, kickers = PokerHandEvaluator.evaluate_hand(all_cards_str)
            
            player_hands[session_id] = {
                'session_id': session_id,
                'name': player['name'],
                'hand_rank': hand_rank,
                'hand_name': hand_name,
                'hand_cards': all_cards_str[:5],
                'kickers': kickers,
                'total_winnings': 0
            }
    
    # Award each pot (main pot + side pots)
    total_rake = 0
    all_winners = []
    
    if side_pots:
        # Award each side pot
        for pot in side_pots:
            # Find best hand among eligible players
            eligible_hands = [player_hands[sid] for sid in pot['eligible_players'] if sid in player_hands]
            
            if not eligible_hands:
                continue
            
            # Sort by hand strength
            eligible_hands.sort(key=lambda x: (x['hand_rank'], x['kickers']), reverse=True)
            
            # Find winners for this pot (may be multiple with same hand)
            best_rank = eligible_hands[0]['hand_rank']
            best_kickers = eligible_hands[0]['kickers']
            pot_winners = [p for p in eligible_hands if p['hand_rank'] == best_rank and p['kickers'] == best_kickers]
            
            # Apply rake ONLY to the main pot (first pot)
            pot_amount = pot['amount']
            rake_amount = 0
            
            if pot['level'] == 1:  # Main pot
                pot_after_rake, rake_amount = calculate_rake(
                    pot_amount, 
                    table['rake_percentage'], 
                    table['rake_cap']
                )
                pot_amount = pot_after_rake
                total_rake += rake_amount
            
            # Split pot among winners
            winnings_per_player = pot_amount // len(pot_winners)
            remainder = pot_amount % len(pot_winners)
            
            for i, winner in enumerate(pot_winners):
                # Give remainder to first winner (dealer position advantage)
                winnings = winnings_per_player + (remainder if i == 0 else 0)
                table['players'][winner['session_id']]['chips'] += winnings
                winner['total_winnings'] += winnings
                
                all_winners.append({
                    'session_id': winner['session_id'],
                    'name': winner['name'],
                    'hand_name': winner['hand_name'],
                    'hand_rank': winner['hand_rank'],
                    'winnings': winnings,
                    'pot_type': 'main' if pot['level'] == 1 else f'side_{pot["level"]-1}',
                    'pot_amount': pot['amount']
                })
    
    else:
        # No side pots - simple scenario
        # Find best hand
        hands_list = list(player_hands.values())
        hands_list.sort(key=lambda x: (x['hand_rank'], x['kickers']), reverse=True)
        
        best_rank = hands_list[0]['hand_rank']
        best_kickers = hands_list[0]['kickers']
        winners = [p for p in hands_list if p['hand_rank'] == best_rank and p['kickers'] == best_kickers]
        
        # Apply rake
        pot_after_rake, rake_amount = calculate_rake(
            table['pot'], 
            table['rake_percentage'], 
            table['rake_cap']
        )
        total_rake = rake_amount
        
        # Split pot
        winnings_per_player = pot_after_rake // len(winners)
        remainder = pot_after_rake % len(winners)
        
        for i, winner in enumerate(winners):
            winnings = winnings_per_player + (remainder if i == 0 else 0)
            table['players'][winner['session_id']]['chips'] += winnings
            winner['total_winnings'] = winnings
            
            all_winners.append({
                'session_id': winner['session_id'],
                'name': winner['name'],
                'hand_name': winner['hand_name'],
                'hand_rank': winner['hand_rank'],
                'winnings': winnings,
                'pot_type': 'main',
                'pot_amount': table['pot']
            })
    
    # Update table state
    table['winners'] = all_winners
    table['total_rake_collected'] += total_rake
    table['pot'] = 0
    table['game_state'] = PokerGameState.HAND_COMPLETE
    table['winners'] = []
    
    for winner in winners:
        table['players'][winner['session_id']]['chips'] += winnings_per_player
        table['winners'].append({
            'session_id': winner['session_id'],
            'name': winner['name'],
            'hand_name': winner['hand_name'],
            'winnings': winnings_per_player
        })
    
    table['pot'] = 0
    table['game_state'] = PokerGameState.HAND_COMPLETE

def get_table_state_for_player(table: Dict, session_id: str) -> Dict:
    """Get table state customized for a specific player (hide other players' hole cards)"""
    state = {
        'room_code': table['room_code'],
        'game_state': table['game_state'],
        'pot': table['pot'],
        'current_bet': table['current_bet'],
        'small_blind': table['small_blind'],
        'big_blind': table['big_blind'],
        'community_cards': table['community_cards'],
        'current_player_index': table['current_player_index'],
        'dealer_index': table['dealer_index'],
        'winners': table['winners'],
        'players': []
    }
    
    # Add player data (hide hole cards of other players unless showdown)
    for i, pid in enumerate(table['player_order']):
        player = table['players'][pid]
        player_data = {
            'session_id': pid,
            'name': player['name'],
            'chips': player['chips'],
            'current_bet': player['current_bet'],
            'total_bet_this_hand': player['total_bet_this_hand'],
            'is_folded': player['is_folded'],
            'is_all_in': player['is_all_in'],
            'is_dealer': player['is_dealer'],
            'is_active': player['is_active'],
            'seat_index': i,
            'is_current_turn': (i == table['current_player_index'])
        }
        
        # Show hole cards if: it's the player's own hand OR it's showdown
        if pid == session_id or table['game_state'] == PokerGameState.SHOWDOWN:
            player_data['hole_cards'] = player['hole_cards']
        else:
            player_data['hole_cards'] = [{'hidden': True}, {'hidden': True}] if len(player['hole_cards']) > 0 else []
        
        state['players'].append(player_data)
    
    return state

def remove_player_from_table(room_code: str, session_id: str) -> Optional[Dict]:
    """Remove a player from poker table"""
    if room_code not in poker_tables:
        return None
    
    table = poker_tables[room_code]
    
    if session_id not in table['players']:
        return table
    
    # Mark player as inactive
    table['players'][session_id]['is_active'] = False
    
    # If game not started, remove completely
    if table['game_state'] == PokerGameState.WAITING:
        del table['players'][session_id]
        table['player_order'].remove(session_id)
    
    # If all players left, delete table
    active_count = sum(1 for p in table['players'].values() if p['is_active'])
    if active_count == 0:
        del poker_tables[room_code]
        return None
    
    return table
