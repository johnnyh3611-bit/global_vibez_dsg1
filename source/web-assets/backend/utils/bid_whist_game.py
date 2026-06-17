"""
AAA-Standard Bid Whist Engine
Supports: Uptown/Downtown logic, 6-card Kitty, AI Dealer Personas, and Real-Time Sync
"""

import secrets
from typing import List, Dict
from datetime import datetime, timezone

secure_random = secrets.SystemRandom()

class BidWhistGame:
    """
    AAA-Standard Bid Whist Engine
    Supports: Uptown/Downtown logic, 6-card Kitty, and AI Dealer Personas.
    """
    SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
    RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    
    # Value maps for different bid types
    MAPS = {
        'uptown': {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14},
        'downtown': {'A': 2, 'K': 3, 'Q': 4, 'J': 5, '10': 6, '9': 7, '8': 8, '7': 9, '6': 10, '5': 11, '4': 12, '3': 13, '2': 14}
    }

    def __init__(self, game_id: str = None, winning_score: int = 7):
        self.game_id = game_id or f"bidwhist_{secrets.token_hex(6)}"
        self.winning_score = winning_score
        self.deck = []
        self.players = {
            'north': {'hand': [], 'team': 'team2'},  # Partner to South
            'east': {'hand': [], 'team': 'team1'},   # Partner to West
            'south': {'hand': [], 'team': 'team2'},
            'west': {'hand': [], 'team': 'team1'}
        }
        self.player_mapping = {}  # position -> user_id
        self.scores = {'team1': 0, 'team2': 0}
        self.tricks_won = {'team1': 0, 'team2': 0}
        self.player_tricks = {'north': 0, 'south': 0, 'east': 0, 'west': 0}  # Individual player tricks
        self.game_phase = 'bidding'
        self.current_trick = []
        self.bids = []
        self.kitty = []
        self.dealer = 'south'
        self.turn = 'south'  # Starting position
        self.trump_suit = None
        self.bid_type = 'uptown'
        self.bid_winner = None
        self.winning_bid = None
        self.tricks_played = 0
        self.led_suit = None
        self.winner = None

    def create_deck(self):
        """Create 54-card deck (52 + 2 jokers)"""
        self.deck = []
        
        # Add standard 52 cards
        for suit in self.SUITS:
            for rank in self.RANKS:
                value = self.MAPS['uptown'][rank]  # Default to uptown
                self.deck.append({
                    'suit': suit,
                    'rank': rank,
                    'value': value,
                    'type': 'standard'
                })
        
        # Add 2 jokers (Big and Little)
        self.deck.append({'suit': 'joker', 'rank': 'Big', 'value': 16, 'type': 'big_joker'})
        self.deck.append({'suit': 'joker', 'rank': 'Little', 'value': 15, 'type': 'little_joker'})
        
        secure_random.shuffle(self.deck)

    def deal_cards(self):
        """Deal 12 cards to each player + 6 to kitty"""
        self.create_deck()
        
        # Deal 12 cards to each player
        for i in range(48):
            player = ['north', 'east', 'south', 'west'][i % 4]
            self.players[player]['hand'].append(self.deck[i])
        
        # Last 6 cards go to kitty
        self.kitty = self.deck[48:54]
        
        # Sort hands
        for player in self.players.values():
            player['hand'].sort(key=lambda c: (
                0 if c['type'] in ['big_joker', 'little_joker'] else self.SUITS.index(c['suit']) + 1,
                c['value']
            ))

    def update_card_values(self):
        """Dynamic value adjustment based on bid type"""
        val_map = self.MAPS.get(self.bid_type, self.MAPS['uptown'])
        for pos in self.players:
            for card in self.players[pos]['hand']:
                if card['type'] == 'standard':
                    card['value'] = val_map[card['rank']]

    def place_bid(self, position: str, amount: int, bid_type: str) -> bool:
        """
        Place a bid
        amount: 3-7 (books over 6 you'll take)
        bid_type: 'uptown', 'downtown', 'no_trump'
        """
        if amount < 3 or amount > 7:
            return False
        
        if bid_type not in ['uptown', 'downtown', 'no_trump']:
            return False
        
        # Calculate bid value (uptown > downtown for same number)
        bid_value = amount * 10
        if bid_type == 'uptown':
            bid_value += 2
        elif bid_type == 'no_trump':
            bid_value += 3
        # downtown has no bonus
        
        self.bids.append({
            'player': position,
            'amount': amount,
            'type': bid_type,
            'value': bid_value
        })
        
        # Check if bidding is complete (all 4 players bid or 3 passes)
        if len(self.bids) >= 4:
            # Find winning bid
            winning = max(self.bids, key=lambda b: b['value'])
            self.winning_bid = winning
            self.bid_winner = winning['player']
            self.bid_type = winning['type']
            
            # Set trump suit (will be chosen by bid winner in kitty_exchange phase)
            self.game_phase = 'kitty_exchange'
        
        return True

    def exchange_kitty(self, position: str, trump_suit: str, discards: List[Dict]) -> bool:
        """
        Bid winner takes kitty, declares trump, and discards 6 cards
        """
        if position != self.bid_winner:
            return False
        
        if len(discards) != 6:
            return False
        
        if trump_suit not in self.SUITS and trump_suit != 'no_trump':
            return False
        
        # Add kitty to winner's hand
        self.players[position]['hand'].extend(self.kitty)
        
        # Remove discards from hand
        for discard in discards:
            self.players[position]['hand'] = [
                c for c in self.players[position]['hand']
                if not (c['suit'] == discard['suit'] and c['rank'] == discard['rank'])
            ]
        
        # Set trump
        self.trump_suit = trump_suit
        
        # Update card values based on bid type
        self.update_card_values()
        
        self.game_phase = 'playing'
        return True

    def can_play_card(self, position: str, card: Dict) -> bool:
        """
        Validate if a card can be legally played (ANTI-CHEAT)
        Rule: Must follow suit if you have it
        """
        hand = self.players[position]['hand']
        
        # First card of trick - any card allowed
        if len(self.current_trick) == 0:
            return True
        
        led_suit = self.led_suit
        
        # Jokers can always be played (they're trump-like)
        if card['type'] in ['big_joker', 'little_joker']:
            return True
        
        # Check if player has cards of led suit
        has_led_suit = any(
            c['suit'] == led_suit and c['type'] == 'standard' 
            for c in hand
        )
        
        if has_led_suit:
            # MUST follow suit! (unless playing a joker)
            return card['suit'] == led_suit or card['type'] in ['big_joker', 'little_joker']
        else:
            # No led suit cards - can play anything
            return True
    
    def get_playable_cards(self, position: str) -> List[Dict]:
        """Get list of cards that can be legally played"""
        hand = self.players[position]['hand']
        return [card for card in hand if self.can_play_card(position, card)]

    def play_card(self, position: str, card: Dict) -> Dict:
        """Play a card to current trick"""
        player = self.players[position]
        
        # ANTI-CHEAT: Validate card can be played
        if not self.can_play_card(position, card):
            return {
                'error': 'Invalid play - must follow suit',
                'trick_winner': None,
                'tricks_played': self.tricks_played,
                'trick_complete': False
            }
        
        # Remove card from hand
        player['hand'] = [c for c in player['hand'] 
                         if not (c['suit'] == card['suit'] and c['rank'] == card['rank'])]
        
        # Add to trick
        self.current_trick.append({'player': position, 'card': card})
        
        # Set led suit if first card
        if len(self.current_trick) == 1:
            self.led_suit = card['suit']
        
        # If trick complete, determine winner
        if len(self.current_trick) == 4:
            winner = self.determine_winner(self.current_trick)
            winner_team = self.players[winner]['team']
            self.tricks_won[winner_team] += 1
            self.player_tricks[winner] += 1  # Track individual player tricks
            self.tricks_played += 1
            self.current_trick = []
            self.led_suit = None  # Reset for next trick
            
            # If all 12 tricks played, score the hand
            if self.tricks_played == 12:
                self.score_hand()
            
            return {'trick_winner': winner, 'tricks_played': self.tricks_played, 'trick_complete': True}
        
        return {'trick_winner': None, 'tricks_played': self.tricks_played, 'trick_complete': False}

    def determine_winner(self, trick: List[Dict]) -> str:
        """
        AAA Logic: Handles Jokers > Trump > Led Suit
        """
        # 1. Check for Jokers (Big then Little)
        jokers = [p for p in trick if p['card']['type'] in ['big_joker', 'little_joker']]
        if jokers:
            return max(jokers, key=lambda p: p['card']['value'])['player']

        # 2. Check for Trump
        if self.trump_suit and self.trump_suit != 'no_trump':
            trumps = [p for p in trick if p['card']['suit'] == self.trump_suit]
            if trumps:
                return max(trumps, key=lambda p: p['card']['value'])['player']

        # 3. Led Suit (Highest card of first played suit)
        led_suit = trick[0]['card']['suit']
        led_cards = [p for p in trick if p['card']['suit'] == led_suit]
        return max(led_cards, key=lambda p: p['card']['value'])['player']

    def score_hand(self):
        """Score the completed hand"""
        bid_amount = self.winning_bid['amount']
        bid_team = self.players[self.bid_winner]['team']
        
        books_needed = 6 + bid_amount  # Bid of 4 = need 10 books
        books_won = self.tricks_won[bid_team]
        
        # Did bidding team make their bid?
        if books_won >= books_needed:
            # Made bid
            self.scores[bid_team] += bid_amount
        else:
            # Set (failed bid)
            self.scores[bid_team] -= bid_amount
        
        # Check for winner
        if self.scores['team1'] >= self.winning_score:
            self.game_phase = 'finished'
            self.winner = 'team1'
        elif self.scores['team2'] >= self.winning_score:
            self.game_phase = 'finished'
            self.winner = 'team2'
        else:
            # Start new hand
            self.reset_hand()

    def reset_hand(self):
        """Reset for new hand"""
        for player in self.players.values():
            player['hand'] = []
        
        self.kitty = []
        self.current_trick = []
        self.tricks_won = {'team1': 0, 'team2': 0}
        self.player_tricks = {'north': 0, 'south': 0, 'east': 0, 'west': 0}
        self.tricks_played = 0
        self.bids = []
        self.winning_bid = None
        self.bid_winner = None
        self.trump_suit = None
        self.bid_type = 'uptown'
        self.led_suit = None
        self.game_phase = 'bidding'
        self.deal_cards()

    # ==================== STATE MANAGEMENT ====================

    def load_state(self, game_doc: Dict):
        """
        Populates the instance with data retrieved from MongoDB.
        """
        self.game_id = game_doc.get("game_id", self.game_id)
        self.deck = game_doc.get("deck", [])
        self.players = game_doc.get("players_data", self.players)
        self.player_mapping = game_doc.get("player_mapping", {})
        self.kitty = game_doc.get("kitty", [])
        self.scores = game_doc.get("scores", {'team1': 0, 'team2': 0})
        self.tricks_won = game_doc.get("tricks_won", {'team1': 0, 'team2': 0})
        self.player_tricks = game_doc.get("player_tricks", {'north': 0, 'south': 0, 'east': 0, 'west': 0})
        self.current_trick = game_doc.get("current_trick", [])
        self.bids = game_doc.get("bids", [])
        self.game_phase = game_doc.get("phase", "bidding")
        self.dealer = game_doc.get("dealer", "south")
        self.trump_suit = game_doc.get("trump_suit")
        self.bid_type = game_doc.get("bid_type", "uptown")
        self.bid_winner = game_doc.get("bid_winner")
        self.winning_bid = game_doc.get("winning_bid")
        self.tricks_played = game_doc.get("tricks_played", 0)
        self.winning_score = game_doc.get("winning_score", 7)
        self.winner = game_doc.get("winner")

    def save_state(self) -> Dict:
        """
        Converts the current Python object state into a dictionary 
        ready for a MongoDB update_one or replace_one call.
        """
        return {
            "game_id": self.game_id,
            "deck": self.deck,
            "players_data": {
                pos: {'hand': p['hand'], 'team': p['team']}
                for pos, p in self.players.items()
            },
            "player_mapping": self.player_mapping,
            "kitty": self.kitty,
            "scores": self.scores,
            "tricks_won": self.tricks_won,
            "player_tricks": self.player_tricks,
            "current_trick": self.current_trick,
            "bids": self.bids,
            "phase": self.game_phase,
            "dealer": self.dealer,
            "trump_suit": self.trump_suit,
            "bid_type": self.bid_type,
            "bid_winner": self.bid_winner,
            "winning_bid": self.winning_bid,
            "tricks_played": self.tricks_played,
            "winning_score": self.winning_score,
            "status": "completed" if self.game_phase == "finished" else "active",
            "winner": self.winner,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

    def get_client_state(self, viewer_id: str) -> Dict:
        """
        Filters the game state so players can't see each other's cards.
        Essential for preventing cheating via network inspection.
        """
        # Find viewer's position
        viewer_position = None
        for pos, uid in self.player_mapping.items():
            if uid == viewer_id:
                viewer_position = pos
                break
        
        # Masked hands (show only card counts for opponents)
        players_data = {}
        for pos, data in self.players.items():
            if pos == viewer_position:
                players_data[pos] = {
                    "team": data["team"],
                    "hand": data["hand"],
                    "card_count": len(data["hand"]),
                    "books_won": self.player_tricks.get(pos, 0)  # Individual tricks
                }
            else:
                players_data[pos] = {
                    "team": data["team"],
                    "card_count": len(data["hand"]),
                    "books_won": self.player_tricks.get(pos, 0)  # Individual tricks
                }
        
        # Calculate whose turn it is to bid
        bid_order = ['north', 'east', 'south', 'west']
        num_bids = len(self.bids)
        current_bidder = bid_order[num_bids] if num_bids < 4 else None

        # Universal "whose_turn" — covers BOTH bidding and playing phases
        # so the frontend Shot Clock and TurnIndicator have a single
        # source of truth (Universal Design Agent v2 §2).
        whose_turn = None
        if self.game_phase == "bidding":
            whose_turn = current_bidder
        elif self.game_phase == "kitty_exchange":
            whose_turn = self.bid_winner
        elif self.game_phase == "playing":
            if not self.current_trick:
                whose_turn = getattr(self, 'trick_leader', None) or self.bid_winner
            elif len(self.current_trick) < 4:
                last_pos = self.current_trick[-1].get('player')
                if last_pos in bid_order:
                    whose_turn = bid_order[(bid_order.index(last_pos) + 1) % 4]
        
        # Get playable cards for current player (anti-cheat helper)
        playable_cards = []
        if viewer_position and self.game_phase == 'playing':
            playable_cards = self.get_playable_cards(viewer_position)

        return {
            "game_id": self.game_id,
            "your_position": viewer_position,
            "your_hand": self.players[viewer_position]['hand'] if viewer_position else [],
            "playable_cards": playable_cards,  # NEW: Cards you can legally play
            "led_suit": self.led_suit,  # NEW: What suit was led this trick
            "kitty": self.kitty if self.game_phase == "kitty_exchange" and viewer_position == self.bid_winner else None,
            "kitty_count": len(self.kitty),
            "dealer": self.dealer,
            "phase": self.game_phase,
            "scores": self.scores,
            "tricks_won": self.tricks_won,
            "player_tricks": self.player_tricks,  # Individual player tricks
            "current_trick": self.current_trick,
            "winning_bid": self.winning_bid,
            "bid_winner": self.bid_winner,
            "trump_suit": self.trump_suit,
            "bid_type": self.bid_type,
            "status": "completed" if self.game_phase == "finished" else "active",
            "players_data": players_data,
            "bids": self.bids,
            "current_bidder": current_bidder,
            "whose_turn": whose_turn,
            "is_your_turn": whose_turn == viewer_position,
            "winner": self.winner
        }

    def get_game_state(self) -> Dict:
        """Get current game state (for internal use)"""
        return {
            'phase': self.game_phase,
            'scores': self.scores,
            'tricks_won': self.tricks_won,
            'current_trick': self.current_trick,
            'tricks_played': self.tricks_played,
            'winning_bid': self.winning_bid,
            'bid_winner': self.bid_winner,
            'trump_suit': self.trump_suit,
            'bid_type': self.bid_type,
            'winner': self.winner
        }


# ==================== AI HELPERS ====================

def get_bid_whist_ai_bid(hand: List[Dict]) -> Dict:
    """Calculate AI bid based on hand strength"""
    # Count strong cards
    jokers = len([c for c in hand if c['type'] in ['big_joker', 'little_joker']])
    aces = len([c for c in hand if c['rank'] == 'A'])
    kings = len([c for c in hand if c['rank'] == 'K'])
    
    # Calculate strength
    strength = jokers * 2 + aces * 1.5 + kings * 1
    
    # Check for long suits (good for trump)
    suit_lengths = {}
    for suit in ['spades', 'hearts', 'diamonds', 'clubs']:
        suit_lengths[suit] = len([c for c in hand if c['suit'] == suit])
    
    longest_suit = max(suit_lengths.values())
    
    if longest_suit >= 5:
        strength += 1
    
    # Determine bid amount (conservative)
    if strength >= 6:
        return {'amount': 5, 'type': 'uptown'}
    elif strength >= 4:
        return {'amount': 4, 'type': 'uptown'}
    elif strength >= 3:
        return {'amount': 3, 'type': 'uptown'}
    else:
        return {'amount': 0, 'type': 'pass'}  # Pass


def get_bid_whist_ai_play(hand: List[Dict], current_trick: List, led_suit: str, trump_suit: str) -> Dict:
    """AI card selection for Bid Whist"""
    if not current_trick:
        # Leading - play from longest suit or lowest card
        return min(hand, key=lambda c: c['value'])
    
    # Following - try to follow suit
    same_suit = [c for c in hand if c['suit'] == led_suit]
    if same_suit:
        # Play high to win or low to dump
        highest_so_far = max(current_trick, key=lambda p: p['card']['value'])['card']['value']
        my_higher = [c for c in same_suit if c['value'] > highest_so_far]
        
        if my_higher:
            return min(my_higher, key=lambda c: c['value'])
        return min(same_suit, key=lambda c: c['value'])
    
    # Can't follow suit - dump lowest or play trump
    trumps = [c for c in hand if c['suit'] == trump_suit]
    if trumps:
        return min(trumps, key=lambda c: c['value'])
    
    return min(hand, key=lambda c: c['value'])
