"""
Grand Master Bid Whist - Premium Multiplayer
Professional-grade implementation with Imperial Deck and advanced rule variants
Features: Four-color deck, Tight Kitty, The Wheel (6-6-6), Nullo bidding, Card History
"""
import secrets
from typing import Dict, List, Optional
from datetime import datetime

# Game states
class BidWhistGameState:
    WAITING = "waiting"
    BIDDING = "bidding"
    KITTY_SELECTION = "kitty_selection"  # Winner picks up kitty
    PLAYING = "playing"
    HAND_COMPLETE = "hand_complete"
    GAME_OVER = "game_over"

# Bid types
class BidType:
    UPTOWN = "uptown"  # High cards win
    DOWNTOWN = "downtown"  # Low cards win
    NO_TRUMP = "no_trump"  # No trump suit
    NULLO = "nullo"  # Bid to LOSE all tricks

# Trump indicators
class TrumpDirection:
    UPTOWN = "uptown"
    DOWNTOWN = "downtown"

# Bid Whist tables storage
bid_whist_tables: Dict[str, Dict] = {}

def fisher_yates_shuffle(deck: List[Dict]) -> List[Dict]:
    """
    Fisher-Yates Shuffle Algorithm (cryptographically secure)
    Ensures every permutation of the deck is equally likely.
    """
    n = len(deck)
    for i in range(n - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        deck[i], deck[j] = deck[j], deck[i]
    return deck

def create_imperial_deck(tight_kitty: bool = False) -> List[Dict]:
    """
    Create the Imperial Four-Color Bid Whist deck
    
    Standard: 54 cards (52 + Big Joker + Little Joker)
    Tight Kitty: 52 cards (remove 2♦ and 2♣)
    
    Four-Color Coding:
    - Spades: Black (traditional)
    - Hearts: Red (traditional)
    - Diamonds: Blue (prevents misreads)
    - Clubs: Green (clear distinction)
    """
    suits = ['spades', 'hearts', 'diamonds', 'clubs']
    ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    
    deck = []
    
    # Standard cards
    for suit in suits:
        for rank in ranks:
            # Skip 2♦ and 2♣ in Tight Kitty mode
            if tight_kitty and rank == '2' and suit in ['diamonds', 'clubs']:
                continue
            
            deck.append({
                'suit': suit,
                'rank': rank,
                'id': f"{rank}_{suit}",
                'value': get_card_value(rank),
                'color': get_suit_color(suit)
            })
    
    # Jokers (highest cards)
    deck.append({
        'suit': 'joker',
        'rank': 'Big',
        'id': 'big_joker',
        'value': 15,  # Highest
        'color': 'red'
    })
    
    deck.append({
        'suit': 'joker',
        'rank': 'Little',
        'id': 'little_joker',
        'value': 14,  # Second highest
        'color': 'black'
    })
    
    return fisher_yates_shuffle(deck)

def get_card_value(rank: str) -> int:
    """Get numeric value for card rank"""
    value_map = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    }
    return value_map.get(rank, 0)

def get_suit_color(suit: str) -> str:
    """Get four-color designation for suit"""
    color_map = {
        'spades': 'black',
        'hearts': 'red',
        'diamonds': 'blue',  # IMPERIAL: Blue diamonds
        'clubs': 'green'     # IMPERIAL: Green clubs
    }
    return color_map.get(suit, 'black')

def create_grand_master_table(
    room_code: str,
    host_session_id: str,
    host_name: str,
    tight_kitty: bool = True,
    enable_nullo: bool = True,
    enable_wheel: bool = True,
    winning_score: int = 7
) -> Dict:
    """
    Create a Grand Master Bid Whist table with premium features
    
    Args:
        tight_kitty: Use 4-card kitty instead of 6 (more strategic)
        enable_nullo: Allow negative bidding (bid to lose)
        enable_wheel: Enable 6-6-6 instant win rule
        winning_score: Points needed to win (default 7)
    """
    table = {
        'room_code': room_code,
        'created_at': datetime.utcnow().isoformat(),
        'game_state': BidWhistGameState.WAITING,
        'players': {},  # session_id -> player data
        'player_order': [],  # [session_id] in seating order
        'teams': {
            'team1': [],  # [session_id, session_id]
            'team2': []
        },
        'dealer_index': 0,
        'current_player_index': 0,
        'tight_kitty': tight_kitty,
        'kitty_size': 4 if tight_kitty else 6,
        'enable_nullo': enable_nullo,
        'enable_wheel': enable_wheel,
        'winning_score': winning_score,
        'deck': [],
        'kitty': [],  # Cards for bid winner
        'current_trick': [],  # Cards played in current trick
        'tricks_won': {'team1': 0, 'team2': 0},
        'books_this_hand': {'team1': 0, 'team2': 0},
        'scores': {'team1': 0, 'team2': 0},
        'current_bid': None,  # {player_id, amount, type, trump_suit}
        'bid_winner': None,
        'trump_suit': None,
        'trump_direction': None,  # UPTOWN or DOWNTOWN
        'lead_suit': None,  # Suit of first card in trick
        'hand_history': [],  # List of all cards played
        'high_cards_played': [],  # Jokers, Aces tracking
        'winners': None,
        'game_number': 1,
        'total_hands_played': 0
    }
    
    # Add host as first player
    table['players'][host_session_id] = {
        'session_id': host_session_id,
        'name': host_name,
        'hand': [],
        'is_ready': True,
        'is_dealer': True,
        'team': 'team1',
        'books_taken': 0,
        'current_bid': None
    }
    table['player_order'].append(host_session_id)
    table['teams']['team1'].append(host_session_id)
    
    return table

def join_grand_master_table(table: Dict, session_id: str, player_name: str) -> bool:
    """Join a Grand Master table (max 4 players in teams of 2)"""
    if len(table['player_order']) >= 4:
        return False
    
    # Assign to team (alternate: 1, 2, 1, 2)
    team = 'team1' if len(table['player_order']) % 2 == 0 else 'team2'
    
    table['players'][session_id] = {
        'session_id': session_id,
        'name': player_name,
        'hand': [],
        'is_ready': False,
        'is_dealer': False,
        'team': team,
        'books_taken': 0,
        'current_bid': None
    }
    
    table['player_order'].append(session_id)
    table['teams'][team].append(session_id)
    
    return True

def start_grand_master_hand(table: Dict) -> None:
    """Start a new hand of Grand Master Bid Whist"""
    # Create and shuffle deck
    table['deck'] = create_imperial_deck(tight_kitty=table['tight_kitty'])
    
    # Reset hand state
    table['kitty'] = []
    table['current_trick'] = []
    table['tricks_won'] = {'team1': 0, 'team2': 0}
    table['books_this_hand'] = {'team1': 0, 'team2': 0}
    table['current_bid'] = None
    table['bid_winner'] = None
    table['trump_suit'] = None
    table['trump_direction'] = None
    table['lead_suit'] = None
    table['hand_history'] = []
    table['high_cards_played'] = []
    
    # Clear player hands
    for player in table['players'].values():
        player['hand'] = []
        player['books_taken'] = 0
        player['current_bid'] = None
    
    # Deal cards
    kitty_size = table['kitty_size']
    cards_per_player = (len(table['deck']) - kitty_size) // 4  # 12 or 13 cards
    
    # First, set aside kitty
    table['kitty'] = [table['deck'].pop() for _ in range(kitty_size)]
    
    # Deal to players
    for _ in range(cards_per_player):
        for session_id in table['player_order']:
            if table['deck']:
                table['players'][session_id]['hand'].append(table['deck'].pop())
    
    # Start bidding phase
    table['game_state'] = BidWhistGameState.BIDDING
    table['current_player_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
    table['total_hands_played'] += 1

def place_bid(table: Dict, session_id: str, bid_amount: int, bid_type: str, trump_suit: Optional[str] = None) -> bool:
    """
    Place a bid in Grand Master Bid Whist
    
    Bid amounts: 3, 4, 5, 6 (minimum 4 books to win bid)
    Bid types: uptown, downtown, no_trump, nullo
    
    Returns: True if bid is valid and placed
    """
    if table['game_state'] != BidWhistGameState.BIDDING:
        return False
    
    current_player = table['player_order'][table['current_player_index']]
    if current_player != session_id:
        return False
    
    # Nullo validation
    if bid_type == BidType.NULLO:
        if not table['enable_nullo']:
            return False
        # Nullo is a special bid (counts as 4)
        bid_amount = 0  # Must take ZERO books
    
    # Validate bid is higher than current
    if table['current_bid']:
        if bid_type != BidType.NULLO and bid_amount <= table['current_bid']['amount']:
            return False
    else:
        # First bid must be at least 4 (or Nullo)
        if bid_type != BidType.NULLO and bid_amount < 4:
            return False
    
    # Set trump direction based on bid type
    if bid_type == BidType.UPTOWN:
        trump_direction = TrumpDirection.UPTOWN
    elif bid_type == BidType.DOWNTOWN:
        trump_direction = TrumpDirection.DOWNTOWN
    else:
        trump_direction = None  # No trump or Nullo
    
    # Update bid
    table['current_bid'] = {
        'player_id': session_id,
        'amount': bid_amount,
        'type': bid_type,
        'trump_suit': trump_suit,
        'trump_direction': trump_direction
    }
    
    table['players'][session_id]['current_bid'] = bid_amount
    
    # Move to next player
    table['current_player_index'] = (table['current_player_index'] + 1) % len(table['player_order'])
    
    return True

def finalize_bidding(table: Dict) -> None:
    """
    Finalize bidding and move to kitty selection
    Bid winner picks up kitty and discards cards
    """
    if not table['current_bid']:
        # No bids - redeal
        start_grand_master_hand(table)
        return
    
    table['bid_winner'] = table['current_bid']['player_id']
    table['trump_suit'] = table['current_bid']['trump_suit']
    table['trump_direction'] = table['current_bid']['trump_direction']
    
    # Give kitty to bid winner
    winner = table['players'][table['bid_winner']]
    winner['hand'].extend(table['kitty'])
    
    table['game_state'] = BidWhistGameState.KITTY_SELECTION

def discard_from_kitty(table: Dict, session_id: str, cards_to_discard: List[str]) -> bool:
    """
    Bid winner discards cards back to kitty after picking it up
    Must discard same number of cards as kitty size
    """
    if table['game_state'] != BidWhistGameState.KITTY_SELECTION:
        return False
    
    if session_id != table['bid_winner']:
        return False
    
    if len(cards_to_discard) != table['kitty_size']:
        return False
    
    player = table['players'][session_id]
    
    # Remove discarded cards from hand
    player['hand'] = [c for c in player['hand'] if c['id'] not in cards_to_discard]
    
    # Start playing phase
    table['game_state'] = BidWhistGameState.PLAYING
    table['current_player_index'] = table['player_order'].index(table['bid_winner'])
    
    return True

def play_card(table: Dict, session_id: str, card_id: str) -> bool:
    """
    Play a card in Grand Master Bid Whist
    Enforces must-follow-suit rules
    """
    if table['game_state'] != BidWhistGameState.PLAYING:
        return False
    
    current_player = table['player_order'][table['current_player_index']]
    if current_player != session_id:
        return False
    
    player = table['players'][session_id]
    
    # Find card in hand
    card = next((c for c in player['hand'] if c['id'] == card_id), None)
    if not card:
        return False
    
    # Validate follow-suit rule
    if table['current_trick']:
        # Must follow lead suit if possible
        lead_card = table['current_trick'][0]['card']
        lead_suit = lead_card['suit']
        
        has_lead_suit = any(c['suit'] == lead_suit for c in player['hand'])
        
        if has_lead_suit and card['suit'] != lead_suit:
            # Player has lead suit but didn't play it
            return False
    else:
        # First card of trick - set lead suit
        table['lead_suit'] = card['suit']
    
    # Play the card
    player['hand'].remove(card)
    table['current_trick'].append({
        'player_id': session_id,
        'card': card
    })
    
    # Track high cards
    if card['rank'] in ['Big', 'Little', 'A']:
        table['high_cards_played'].append(card)
    
    # Add to hand history
    table['hand_history'].append({
        'player_id': session_id,
        'card': card,
        'trick_number': len(table['hand_history']) // 4 + 1
    })
    
    # Check if trick is complete
    if len(table['current_trick']) == 4:
        determine_trick_winner(table)
    else:
        # Next player
        table['current_player_index'] = (table['current_player_index'] + 1) % len(table['player_order'])
    
    return True

def determine_trick_winner(table: Dict) -> None:
    """Determine winner of current trick and award it.
    Uses the Sovereign Validator (Joker Power Indexing) per
    `Global_Vibez_Sovereign_Game_Logic_Fix.pdf` so Big/Little Joker
    rankings never regress with Downtown inversion math."""
    from services.sovereign_validator import calculate_winner  # noqa: PLC0415
    trump_suit = table['trump_suit']
    lead_suit = table['lead_suit']
    direction = table['trump_direction']
    bid_type = table['current_bid']['type']
    is_nt = (bid_type == BidType.NO_TRUMP)

    # Adapt plays to the validator's accepted shape (top-level card).
    plays = [
        {"card": p['card'], "player_id": p['player_id'], **({"suit": p['card'].get('suit')} if isinstance(p.get('card'), dict) else {})}
        for p in table['current_trick']
    ]
    winning_play = calculate_winner(
        plays,
        trump_suit=None if is_nt else trump_suit,
        led_suit=lead_suit,
        bid_direction=str(direction).lower() if hasattr(direction, 'value') or isinstance(direction, str) else "uptown",
        is_no_trump=is_nt,
    )
    if not winning_play:
        return

    # Award trick to winner's team
    winner_id = winning_play['player_id']
    winner_team = table['players'][winner_id]['team']
    
    table['tricks_won'][winner_team] += 1
    table['books_this_hand'][winner_team] += 1
    
    # Clear trick
    table['current_trick'] = []
    table['lead_suit'] = None
    
    # Winner leads next trick
    table['current_player_index'] = table['player_order'].index(winner_id)
    
    # Check if hand is over
    if table['books_this_hand']['team1'] + table['books_this_hand']['team2'] == 13:
        score_hand(table)

def score_hand(table: Dict) -> None:
    """
    Score the hand based on bid and books taken
    Implements The Wheel (6-6-6) instant win rule
    """
    bid = table['current_bid']
    bid_amount = bid['amount']
    bid_type = bid['type']
    bid_winner_id = table['bid_winner']
    bidding_team = table['players'][bid_winner_id]['team']
    
    books_taken = table['books_this_hand'][bidding_team]
    
    # Check for The Wheel (6-6-6)
    if table['enable_wheel'] and bid_amount == 6 and books_taken == 13:
        # INSTANT WIN - "Rise" victory
        table['winners'] = bidding_team
        table['scores'][bidding_team] = table['winning_score']
        table['game_state'] = BidWhistGameState.GAME_OVER
        return
    
    # Nullo scoring
    if bid_type == BidType.NULLO:
        if books_taken == 0:
            # Success - won the nullo
            table['scores'][bidding_team] += 4
        else:
            # Failed - took at least one book
            table['scores'][bidding_team] -= 4
    else:
        # Normal scoring
        if books_taken >= bid_amount:
            # Made the bid
            table['scores'][bidding_team] += bid_amount
            
            # Bonus for overtricks
            overtricks = books_taken - 7  # Books over half
            if overtricks > 0:
                table['scores'][bidding_team] += overtricks
        else:
            # Set - failed to make bid
            table['scores'][bidding_team] -= bid_amount
    
    # Check for game over
    if table['scores']['team1'] >= table['winning_score']:
        table['winners'] = 'team1'
        table['game_state'] = BidWhistGameState.GAME_OVER
    elif table['scores']['team2'] >= table['winning_score']:
        table['winners'] = 'team2'
        table['game_state'] = BidWhistGameState.GAME_OVER
    else:
        # Next hand
        table['game_state'] = BidWhistGameState.HAND_COMPLETE
        table['dealer_index'] = (table['dealer_index'] + 1) % len(table['player_order'])
        table['game_number'] += 1

def get_card_history_summary(table: Dict) -> Dict:
    """
    Get summary of cards played for "card counting" feature
    Shows which high cards are still in play
    """
    played_cards = set(card['id'] for card in table['high_cards_played'])
    
    all_high_cards = {
        'big_joker': 'big_joker' not in played_cards,
        'little_joker': 'little_joker' not in played_cards,
        'A_spades': 'A_spades' not in played_cards,
        'A_hearts': 'A_hearts' not in played_cards,
        'A_diamonds': 'A_diamonds' not in played_cards,
        'A_clubs': 'A_clubs' not in played_cards
    }
    
    return {
        'high_cards_remaining': all_high_cards,
        'total_cards_played': len(table['hand_history']),
        'tricks_completed': len(table['hand_history']) // 4
    }
