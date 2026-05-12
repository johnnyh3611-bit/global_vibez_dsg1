"""
Real-Time Multiplayer Blackjack
Socket.IO-based blackjack game with 1-5 players vs dealer
Features: Real-time betting, card dealing, hit/stand, dealer automation, payout
"""
import secrets
from typing import Dict, List, Optional
from datetime import datetime
from utils.database import get_database

# Blackjack game states
class BlackjackGameState:
    WAITING = "waiting"
    BETTING = "betting"
    DEALING = "dealing"
    PLAYER_TURNS = "player_turns"
    DEALER_TURN = "dealer_turn"
    PAYOUT = "payout"
    ROUND_COMPLETE = "round_complete"

# Player actions
class BlackjackAction:
    BET = "bet"
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"  # Future enhancement

# Blackjack tables storage (room_code -> table data)
blackjack_tables: Dict[str, Dict] = {}

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
    """Create a standard 52-card deck for blackjack"""
    suits = ['hearts', 'diamonds', 'clubs', 'spades']
    ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
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

def get_card_value(card: Dict, current_total: int = 0) -> int:
    """Get blackjack value of a card"""
    rank = card['rank']
    if rank in ['J', 'Q', 'K']:
        return 10
    elif rank == 'A':
        # Ace == 11 unless it would bust, then it's 1
        return 11 if current_total + 11 <= 21 else 1
    else:
        return int(rank)

def calculate_hand_value(cards: List[Dict]) -> int:
    """Calculate total value of a blackjack hand"""
    total = 0
    aces = 0
    
    # First pass: count non-aces
    for card in cards:
        if card['rank'] == 'A':
            aces += 1
        else:
            total += get_card_value(card)
    
    # Add aces optimally
    for _ in range(aces):
        if total + 11 <= 21:
            total += 11
        else:
            total += 1
    
    return total

def is_blackjack(cards: List[Dict]) -> bool:
    """Check if hand is a natural blackjack (Ace + 10-value card)"""
    if len(cards) != 2:
        return False
    values = [get_card_value(c) for c in cards]
    return sorted(values) == [10, 11] or (11 in values and 10 in values)

def is_bust(cards: List[Dict]) -> bool:
    """Check if hand is bust (over 21)"""
    return calculate_hand_value(cards) > 21

def create_blackjack_table(room_code: str, host_session_id: str, host_name: str, min_bet: int = 50, max_bet: int = 500, host_user_id: str = None) -> Dict:
    # 50-coin minimum bet enforced platform-wide (2026-02 pre-beta sweep).
    min_bet = max(int(min_bet or 50), 50)
    """Create a new blackjack table"""
    table = {
        'room_code': room_code,
        'created_at': datetime.utcnow().isoformat(),
        'game_state': BlackjackGameState.WAITING,
        'players': {},  # session_id -> player data
        'player_order': [],  # List of session_ids in seating order
        'current_player_index': 0,
        'min_bet': min_bet,
        'max_bet': max_bet,
        'deck': [],
        'dealer_hand': [],
        'dealer_score': 0,
        'round_number': 0
    }
    
    # Add host as first player
    table['players'][host_session_id] = {
        'session_id': host_session_id,
        'user_id': host_user_id,  # Store user_id for DB persistence
        'name': host_name,
        'balance': 1000,  # Starting chips
        'current_bet': 0,
        'hand': [],
        'score': 0,
        'is_standing': False,
        'is_bust': False,
        'is_blackjack': False,
        'is_active': True,
        'winnings': 0,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(host_session_id)
    
    blackjack_tables[room_code] = table
    return table

def join_blackjack_table(room_code: str, session_id: str, player_name: str, user_id: str = None) -> Optional[Dict]:
    """Add a player to blackjack table"""
    if room_code not in blackjack_tables:
        return None
    
    table = blackjack_tables[room_code]
    
    # Check if table is full (max 5 players for blackjack)
    if len(table['players']) >= 5:
        return {'error': 'Table is full'}
    
    # Check if player already at table
    if session_id in table['players']:
        return table
    
    # Check if game already started
    if table['game_state'] not in [BlackjackGameState.WAITING, BlackjackGameState.ROUND_COMPLETE]:
        return {'error': 'Round in progress, wait for next round'}
    
    # Add player
    table['players'][session_id] = {
        'session_id': session_id,
        'user_id': user_id,  # Store user_id for DB persistence
        'name': player_name,
        'balance': 1000,
        'current_bet': 0,
        'hand': [],
        'score': 0,
        'is_standing': False,
        'is_bust': False,
        'is_blackjack': False,
        'is_active': True,
        'winnings': 0,
        'joined_at': datetime.utcnow().isoformat()
    }
    table['player_order'].append(session_id)
    
    return table

def start_betting_round(room_code: str) -> Optional[Dict]:
    """Start betting phase"""
    if room_code not in blackjack_tables:
        return None
    
    table = blackjack_tables[room_code]
    
    # Need at least 1 player
    active_players = [p for p in table['players'].values() if p['is_active']]
    if len(active_players) == 0:
        return {'error': 'No active players'}
    
    # Reset round state
    table['game_state'] = BlackjackGameState.BETTING
    table['round_number'] += 1
    table['dealer_hand'] = []
    table['dealer_score'] = 0
    
    # Reset player states
    for player in table['players'].values():
        player['current_bet'] = 0
        player['hand'] = []
        player['score'] = 0
        player['is_standing'] = False
        player['is_bust'] = False
        player['is_blackjack'] = False
        player['winnings'] = 0
    
    # Create fresh deck (or use multiple decks for realism)
    table['deck'] = create_deck() + create_deck()  # 2 decks
    fisher_yates_shuffle(table['deck'])  # Shuffle the combined deck
    
    return table

def place_bet(room_code: str, session_id: str, amount: int) -> Optional[Dict]:
    """Player places bet"""
    if room_code not in blackjack_tables:
        return None
    
    table = blackjack_tables[room_code]
    
    if table['game_state'] != BlackjackGameState.BETTING:
        return {'error': 'Not in betting phase'}
    
    if session_id not in table['players']:
        return {'error': 'Player not at table'}
    
    player = table['players'][session_id]
    
    # Validate bet amount
    if amount < table['min_bet']:
        return {'error': f"Minimum bet is ₵{table['min_bet']:,} coins"}
    if amount > table['max_bet']:
        return {'error': f"Maximum bet is ${table['max_bet']}"}
    if amount > player['balance']:
        return {'error': 'Insufficient balance'}
    
    # Place bet
    player['current_bet'] = amount
    player['balance'] -= amount
    
    # Check if all active players have bet
    all_bet = all(p['current_bet'] > 0 for p in table['players'].values() if p['is_active'])
    
    if all_bet:
        # Start dealing
        deal_initial_cards(table)
    
    return table

def deal_initial_cards(table: Dict) -> None:
    """Deal 2 cards to each player and dealer"""
    table['game_state'] = BlackjackGameState.DEALING
    
    # Auto-reshuffle if deck is running low (FIX for Bug #3: Game freeze after ~7 rounds)
    if len(table['deck']) < 20:
        print(f"⚠️ Blackjack deck low ({len(table['deck'])} cards), reshuffling...")
        table['deck'] = create_deck() + create_deck()  # 2 decks
        fisher_yates_shuffle(table['deck'])
    
    # Deal to players
    for session_id in table['player_order']:
        player = table['players'][session_id]
        if player['is_active'] and player['current_bet'] > 0:
            player['hand'] = [table['deck'].pop(), table['deck'].pop()]
            player['score'] = calculate_hand_value(player['hand'])
            player['is_blackjack'] = is_blackjack(player['hand'])
    
    # Deal to dealer (1 face up, 1 face down)
    table['dealer_hand'] = [table['deck'].pop(), table['deck'].pop()]
    table['dealer_score'] = calculate_hand_value(table['dealer_hand'])
    
    # Move to player turns
    table['game_state'] = BlackjackGameState.PLAYER_TURNS
    table['current_player_index'] = 0

async def player_blackjack_action(room_code: str, session_id: str, action: str) -> Optional[Dict]:
    """Process a player's blackjack action"""
    if room_code not in blackjack_tables:
        return None
    
    table = blackjack_tables[room_code]
    
    if table['game_state'] != BlackjackGameState.PLAYER_TURNS:
        return {'error': 'Not player turn phase'}
    
    # Verify it's player's turn
    current_session = table['player_order'][table['current_player_index']]
    if current_session != session_id:
        return {'error': 'Not your turn'}
    
    player = table['players'][session_id]
    
    if player['is_standing'] or player['is_bust']:
        return {'error': 'Already standing or bust'}
    
    # Auto-reshuffle if deck is running low (FIX for Bug #3)
    if len(table['deck']) < 10:
        print(f"⚠️ Blackjack deck low ({len(table['deck'])} cards), reshuffling...")
        table['deck'] = create_deck() + create_deck()  # 2 decks
        fisher_yates_shuffle(table['deck'])
    
    # Process action
    if action == BlackjackAction.HIT:
        # Draw a card
        new_card = table['deck'].pop()
        player['hand'].append(new_card)
        player['score'] = calculate_hand_value(player['hand'])
        
        # Check for bust
        if is_bust(player['hand']):
            player['is_bust'] = True
            player['is_standing'] = True  # Auto-stand on bust
    
    elif action == BlackjackAction.STAND:
        player['is_standing'] = True
    
    elif action == BlackjackAction.DOUBLE:
        # Double bet, draw 1 card, auto-stand
        if len(player['hand']) != 2:
            return {'error': 'Can only double on first action'}
        if player['current_bet'] > player['balance']:
            return {'error': 'Insufficient balance to double'}
        
        player['balance'] -= player['current_bet']
        player['current_bet'] *= 2
        
        new_card = table['deck'].pop()
        player['hand'].append(new_card)
        player['score'] = calculate_hand_value(player['hand'])
        player['is_standing'] = True
        
        if is_bust(player['hand']):
            player['is_bust'] = True
    
    # Move to next player or dealer turn
    await advance_to_next_player(table)
    
    return table

async def advance_to_next_player(table: Dict) -> None:
    """Move to next player or dealer turn"""
    # Find next player who hasn't stood and has a bet
    start_index = table['current_player_index']
    num_players = len(table['player_order'])
    
    for i in range(1, num_players + 1):
        next_index = (start_index + i) % num_players
        session_id = table['player_order'][next_index]
        player = table['players'][session_id]
        
        if player['is_active'] and player['current_bet'] > 0 and not player['is_standing']:
            table['current_player_index'] = next_index
            return
    
    # All players done, move to dealer turn
    table['game_state'] = BlackjackGameState.DEALER_TURN
    await play_dealer_hand(table)

async def play_dealer_hand(table: Dict) -> None:
    """Dealer plays according to blackjack rules"""
    # Auto-reshuffle if deck is running low (FIX for Bug #3)
    if len(table['deck']) < 10:
        print(f"⚠️ Blackjack deck low ({len(table['deck'])} cards), reshuffling...")
        table['deck'] = create_deck() + create_deck()  # 2 decks
        fisher_yates_shuffle(table['deck'])
    
    # Dealer hits on 16 or less, stands on 17+
    while calculate_hand_value(table['dealer_hand']) < 17:
        table['dealer_hand'].append(table['deck'].pop())
    
    table['dealer_score'] = calculate_hand_value(table['dealer_hand'])
    
    # Move to payout
    table['game_state'] = BlackjackGameState.PAYOUT
    await determine_winners_and_payout(table)

async def determine_winners_and_payout(table: Dict) -> None:
    """Determine winners and distribute payouts"""
    dealer_score = table['dealer_score']
    dealer_bust = is_bust(table['dealer_hand'])
    dealer_blackjack = is_blackjack(table['dealer_hand'])
    
    db = get_database()
    
    for player in table['players'].values():
        if not player['is_active'] or player['current_bet'] == 0:
            continue
        
        player_score = player['score']
        player_bust = player['is_bust']
        player_blackjack = player['is_blackjack']
        
        # Determine outcome
        if player_bust:
            # Player busts, loses bet (already deducted)
            player['winnings'] = 0
        
        elif player_blackjack and not dealer_blackjack:
            # Player blackjack, pays 3:2
            winnings = int(player['current_bet'] * 2.5)
            player['balance'] += winnings
            player['winnings'] = winnings - player['current_bet']
        
        elif dealer_bust:
            # Dealer busts, player wins (pays 1:1)
            winnings = player['current_bet'] * 2
            player['balance'] += winnings
            player['winnings'] = winnings - player['current_bet']
        
        elif player_score > dealer_score:
            # Player score higher, wins (pays 1:1)
            winnings = player['current_bet'] * 2
            player['balance'] += winnings
            player['winnings'] = winnings - player['current_bet']
        
        elif player_score == dealer_score:
            # Push (tie), return bet
            player['balance'] += player['current_bet']
            player['winnings'] = 0
        
        else:
            # Dealer score higher, player loses (already deducted)
            player['winnings'] = -player['current_bet']
        
        # FIX for Bug #1 & #2: Persist balance to MongoDB
        if player.get('user_id'):
            try:
                # Update user balance in MongoDB
                await db.users.update_one(
                    {'user_id': player['user_id']},
                    {'$set': {'credits_balance': player['balance']}}
                )
                print(f"✅ Blackjack: Updated balance for {player['name']} (user_id: {player['user_id']}): ${player['balance']}")
            except Exception as e:
                print(f"❌ Blackjack: Failed to update balance for {player['name']}: {e}")
    
    table['game_state'] = BlackjackGameState.ROUND_COMPLETE

def get_table_state_for_player(table: Dict, session_id: str) -> Dict:
    """Get table state customized for a specific player"""
    state = {
        'room_code': table['room_code'],
        'game_state': table['game_state'],
        'round_number': table['round_number'],
        'min_bet': table['min_bet'],
        'max_bet': table['max_bet'],
        'current_player_index': table['current_player_index'],
        'dealer_hand': [],
        'dealer_score': table['dealer_score'],
        'players': []
    }
    
    # Show dealer hand based on game state
    if table['game_state'] in [BlackjackGameState.DEALER_TURN, BlackjackGameState.PAYOUT, BlackjackGameState.ROUND_COMPLETE]:
        # Show all dealer cards
        state['dealer_hand'] = table['dealer_hand']
    elif len(table['dealer_hand']) > 0:
        # Show only first card (face up)
        state['dealer_hand'] = [table['dealer_hand'][0], {'hidden': True}]
    
    # Add player data
    for i, pid in enumerate(table['player_order']):
        player = table['players'][pid]
        player_data = {
            'session_id': pid,
            'name': player['name'],
            'balance': player['balance'],
            'current_bet': player['current_bet'],
            'hand': player['hand'],
            'score': player['score'],
            'is_standing': player['is_standing'],
            'is_bust': player['is_bust'],
            'is_blackjack': player['is_blackjack'],
            'is_active': player['is_active'],
            'winnings': player['winnings'],
            'seat_index': i,
            'is_current_turn': (i == table['current_player_index'] and table['game_state'] == BlackjackGameState.PLAYER_TURNS)
        }
        
        state['players'].append(player_data)
    
    return state

def remove_player_from_table(room_code: str, session_id: str) -> Optional[Dict]:
    """Remove a player from blackjack table"""
    if room_code not in blackjack_tables:
        return None
    
    table = blackjack_tables[room_code]
    
    if session_id not in table['players']:
        return table
    
    # Mark player as inactive
    table['players'][session_id]['is_active'] = False
    
    # If game not started, remove completely
    if table['game_state'] == BlackjackGameState.WAITING:
        del table['players'][session_id]
        table['player_order'].remove(session_id)
    
    # If all players left, delete table
    active_count = sum(1 for p in table['players'].values() if p['is_active'])
    if active_count == 0:
        del blackjack_tables[room_code]
        return None
    
    return table
