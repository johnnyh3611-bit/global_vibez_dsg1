# Spades Game Logic - Full Implementation

import secrets
secure_random = secrets.SystemRandom()
from typing import List, Dict


# ────────────────────────────────────────────── Rulesets

# A "ruleset" customises the trump hierarchy and (optionally) adds Jokers.
# The CLASSIC ruleset is plain Spades: 52-card deck, suit hierarchy, A♠ is
# top trump.
#
# The BIG_WHEEL ruleset (a.k.a. Joker-Joker-Deuce-Ace) adds two Jokers to
# the deck and replaces the top of the trump column with:
#     Big Joker > Little Joker > 2♠ > 2♦ > A♠ > K♠ > ...
# A♠/K♠/Q♠/J♠ etc. then continue normally; the 2♠/2♦ are *promoted* trumps,
# meaning they always count as spades regardless of the led suit.
#
# Adding a new ruleset = add an entry to `RULESETS` below and (if it has a
# different deck shape) ensure `_extra_cards` returns the new cards.

RULESETS: Dict[str, Dict] = {
    # ---------- Classic 52-card Spades ----------
    'CLASSIC': {
        'label': 'Classic',
        'deck_size': 52,
        'house_cut_pct': 5.0,           # 5% rake
        'jokers': False,
        # Promoted-trump cards live OUTSIDE the standard rank table.
        # rank_label → score (higher = wins). For CLASSIC there are none.
        'promoted_trumps': {},
        # Standard rank table (suit-agnostic). Spades win over non-spades
        # by virtue of being trump, handled in determine_trick_winner().
        'rank_values': {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
            '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
        },
    },

    # ---------- Big Wheel (Joker-Joker-Deuce-Ace) ----------
    # User-confirmed variant per Apr 2026 spec. Snippet provided:
    #   Big Joker = 100, Little Joker = 99, 2♠ = 98, 2♦ = 97, A♠ = 14, ...
    # We keep A♠ at the top of the standard column and treat the 4 promoted
    # cards (Jokers + 2♠ + 2♦) as "always trump" with a custom score.
    'BIG_WHEEL': {
        'label': 'Big Wheel',
        'deck_size': 54,                # 52 + 2 Jokers
        'house_cut_pct': 7.0,           # 7% rake — higher variance, higher cut
        'jokers': True,
        'promoted_trumps': {
            'BIG_JOKER':    100,
            'LITTLE_JOKER': 99,
            '2_SPADES':     98,
            '2_DIAMONDS':   97,
        },
        'rank_values': {
            # 2♠ + 2♦ are promoted to trumps; they get removed from the
            # standard column when the deck is built (see create_deck).
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
            '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
        },
    },
}

DEFAULT_RULESET = 'CLASSIC'


def _is_promoted_trump(card: Dict) -> bool:
    """True for any card whose `promoted` key is set — these always win
    over standard cards and are scored from `promoted_trumps`."""
    return bool(card.get('promoted'))


class SpadesGame:
    """
    Spades card game implementation
    - 4 players (2 teams of 2)
    - Game to 200 points
    - 5-bag penalty system (-50 points per 5 bags)
    - Spades are always trump
    - Two rulesets: 'CLASSIC' (52-card) or 'BIG_WHEEL' (54-card with Jokers
      + promoted 2♠/2♦). Pass via __init__(ruleset='BIG_WHEEL').
    """

    SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
    RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    # Kept for backwards-compat. The ACTIVE values come from the ruleset
    # at runtime (self.rank_values); this default mirrors CLASSIC.
    RANK_VALUES = RULESETS['CLASSIC']['rank_values']

    def __init__(self, ruleset: str = DEFAULT_RULESET):
        if ruleset not in RULESETS:
            raise ValueError(
                f"Unknown ruleset '{ruleset}'. Choose one of: "
                f"{', '.join(RULESETS)}"
            )
        self.ruleset_name = ruleset
        self.ruleset = RULESETS[ruleset]
        self.rank_values = self.ruleset['rank_values']
        self.promoted_trumps = self.ruleset['promoted_trumps']
        self.house_cut_pct = self.ruleset['house_cut_pct']

        self.deck = []
        self.players = {
            'north': {'hand': [], 'bid': 0, 'tricks': 0, 'team': 'team1'},
            'east': {'hand': [], 'bid': 0, 'tricks': 0, 'team': 'team2'},
            'south': {'hand': [], 'bid': 0, 'tricks': 0, 'team': 'team1'},
            'west': {'hand': [], 'bid': 0, 'tricks': 0, 'team': 'team2'}
        }
        self.scores = {
            'team1': {'points': 0, 'bags': 0},
            'team2': {'points': 0, 'bags': 0}
        }
        self.current_trick = []
        self.tricks_played = 0
        self.spades_broken = False
        self.game_phase = 'bidding'  # bidding, playing, scoring, finished
        self.winning_score = 200

    def create_deck(self):
        """Build the deck for the active ruleset.

        CLASSIC → standard 52 cards.
        BIG_WHEEL → 54 cards: 50 standard cards (52 minus 2♠ and 2♦, which
        are promoted out of the column) + 2 Jokers + the two promoted
        deuces, all flagged with `promoted=True` and a `promoted_id` so
        determine_trick_winner can score them via the lookup table.
        """
        self.deck = []
        promoted_skip = set()
        if self.ruleset_name == 'BIG_WHEEL':
            # 2♠ and 2♦ are pulled out of the standard column and re-inserted
            # below as promoted trumps so they always beat A♠.
            promoted_skip = {('spades', '2'), ('diamonds', '2')}

        for suit in self.SUITS:
            for rank in self.RANKS:
                if (suit, rank) in promoted_skip:
                    continue
                self.deck.append({
                    'suit': suit,
                    'rank': rank,
                    'value': self.rank_values[rank],
                    'promoted': False,
                })

        # Promoted cards (Jokers + special deuces) are pre-flagged trumps.
        for promoted_id, score in self.promoted_trumps.items():
            self.deck.append({
                'suit': 'spades',          # always counts as the trump suit
                'rank': promoted_id,       # 'BIG_JOKER' / '2_SPADES' / etc.
                'value': score,
                'promoted': True,
                'promoted_id': promoted_id,
            })

        secure_random.shuffle(self.deck)
    
    def deal_cards(self):
        """Deal the deck evenly to all 4 players.

        CLASSIC: 13 cards each (52 / 4).
        BIG_WHEEL: 13 + 1 extra to one player. Per house rule, the extra
        Joker goes to the dealer's left (NORTH); they discard one face-down
        card before bidding to return the hand to 13. We handle the deal
        here and leave discard up to the table flow.
        """
        self.create_deck()
        seats = ['north', 'east', 'south', 'west']
        for i, card in enumerate(self.deck):
            player = seats[i % 4]
            self.players[player]['hand'].append(card)

        # Sort hands so promoted trumps land at the top of the trump column.
        for player in self.players.values():
            player['hand'].sort(
                key=lambda c: (
                    0 if c.get('promoted') else 1,
                    self.SUITS.index(c['suit']),
                    -c['value'],
                ),
            )
    
    def set_bid(self, position: str, bid: int) -> bool:
        """Set a player's bid (0-13)"""
        if bid < 0 or bid > 13:
            return False
        self.players[position]['bid'] = bid
        
        # Check if all bids are in
        if all(p['bid'] > 0 or p['bid'] == 0 for p in self.players.values()):
            self.game_phase = 'playing'
        
        return True
    
    def get_team_bid(self, team: str) -> int:
        """Get total bid for a team"""
        return sum(p['bid'] for p in self.players.values() if p['team'] == team)
    
    def play_card(self, position: str, card: Dict) -> Dict:
        """Play a card to the current trick"""
        player = self.players[position]
        
        # Remove card from hand
        player['hand'] = [c for c in player['hand'] if not (c['suit'] == card['suit'] and c['rank'] == card['rank'])]
        
        # Add to current trick
        self.current_trick.append({
            'position': position,
            'card': card
        })
        
        # If first card of trick, set led suit
        if len(self.current_trick) == 1:
            self.led_suit = card['suit']
        
        # Check if spades broken (a promoted trump also breaks spades)
        if (card['suit'] == 'spades' or _is_promoted_trump(card)) and len(self.current_trick) > 1:
            self.spades_broken = True
        
        # If trick is complete (4 cards), determine winner
        if len(self.current_trick) == 4:
            winner = self.determine_trick_winner()
            self.players[winner]['tricks'] += 1
            self.tricks_played += 1
            self.current_trick = []
            
            # If all 13 tricks played, score the hand
            if self.tricks_played == 13:
                self.score_hand()
            
            return {'trick_winner': winner, 'tricks_complete': self.tricks_played}
        
        return {'trick_winner': None, 'tricks_complete': self.tricks_played}
    
    def determine_trick_winner(self) -> str:
        """Determine who won the trick.

        Priority order:
          1. Any promoted trump (Jokers / promoted deuces) wins outright,
             scored by the absolute `value` (Big Joker = 100, etc.).
          2. Any spade played wins (trump beats led suit).
          3. Highest card of the led suit wins.
        """
        # 1. Promoted trumps
        promoted = [p for p in self.current_trick if _is_promoted_trump(p['card'])]
        if promoted:
            winner = max(promoted, key=lambda p: p['card']['value'])
            return winner['position']

        # 2. Standard spades
        spades_played = [p for p in self.current_trick if p['card']['suit'] == 'spades']
        if spades_played:
            winner = max(spades_played, key=lambda p: p['card']['value'])
            return winner['position']

        # 3. Led suit
        led_suit_cards = [p for p in self.current_trick if p['card']['suit'] == self.led_suit]
        winner = max(led_suit_cards, key=lambda p: p['card']['value'])
        return winner['position']
    
    def score_hand(self):
        """Score the completed hand"""
        for team in ['team1', 'team2']:
            team_players = [p for pos, p in self.players.items() if p['team'] == team]
            
            # Calculate total bid and tricks for team
            team_bid = sum(p['bid'] for p in team_players)
            team_tricks = sum(p['tricks'] for p in team_players)
            
            # Did team make their bid?
            if team_tricks >= team_bid:
                # Made bid: 10 points per bid
                points = team_bid * 10
                
                # Bags (overtricks)
                bags = team_tricks - team_bid
                self.scores[team]['bags'] += bags
                points += bags  # 1 point per bag
                
                # Check for 5-bag penalty
                if self.scores[team]['bags'] >= 5:
                    penalty_bags = self.scores[team]['bags'] // 5
                    points -= penalty_bags * 50  # -50 points per 5 bags
                    self.scores[team]['bags'] = self.scores[team]['bags'] % 5
                
                self.scores[team]['points'] += points
            else:
                # Failed bid: -10 points per bid
                self.scores[team]['points'] -= team_bid * 10
        
        # Check for winner
        if self.scores['team1']['points'] >= self.winning_score:
            self.game_phase = 'finished'
            self.winner = 'team1'
        elif self.scores['team2']['points'] >= self.winning_score:
            self.game_phase = 'finished'
            self.winner = 'team2'
        else:
            # Start new hand
            self.reset_hand()
    
    def reset_hand(self):
        """Reset for new hand"""
        for player in self.players.values():
            player['hand'] = []
            player['bid'] = 0
            player['tricks'] = 0
        
        self.current_trick = []
        self.tricks_played = 0
        self.spades_broken = False
        self.game_phase = 'bidding'
        self.deal_cards()
    
    def get_valid_plays(self, position: str) -> List[Dict]:
        """Get valid cards a player can play"""
        player = self.players[position]
        hand = player['hand']
        
        # If leading, can play any card (except spades unless broken or only spades left)
        if len(self.current_trick) == 0:
            if not self.spades_broken:
                non_spades = [c for c in hand if c['suit'] != 'spades']
                if non_spades:
                    return non_spades
            return hand
        
        # Must follow suit if possible
        led_suit = self.current_trick[0]['card']['suit']
        same_suit = [c for c in hand if c['suit'] == led_suit]
        
        if same_suit:
            return same_suit
        
        # Can play any card if can't follow suit
        return hand
    
    def get_game_state(self) -> Dict:
        """Get current game state"""
        return {
            'phase': self.game_phase,
            'scores': self.scores,
            'players': {
                pos: {
                    'hand_count': len(p['hand']),
                    'bid': p['bid'],
                    'tricks': p['tricks'],
                    'team': p['team']
                } for pos, p in self.players.items()
            },
            'current_trick': self.current_trick,
            'tricks_played': self.tricks_played,
            'spades_broken': self.spades_broken,
            'winner': getattr(self, 'winner', None)
        }


# AI for Spades
def get_spades_ai_bid(hand: List[Dict]) -> int:
    """Calculate AI bid based on hand strength"""
    bid = 0
    
    # Count sure tricks (A, K of each suit, high spades)
    spades = [c for c in hand if c['suit'] == 'spades']
    
    # High spades (A, K, Q) are usually tricks
    high_spades = [c for c in spades if c['rank'] in ['A', 'K', 'Q']]
    bid += len(high_spades)
    
    # Aces in other suits
    for suit in ['hearts', 'diamonds', 'clubs']:
        suit_cards = [c for c in hand if c['suit'] == suit]
        if suit_cards:
            highest = max(suit_cards, key=lambda c: c['value'])
            if highest['rank'] == 'A':
                bid += 1
            elif highest['rank'] == 'K' and len(suit_cards) >= 3:
                bid += 0.5  # Maybe a trick
    
    # Long spade suit adds tricks
    if len(spades) >= 5:
        bid += 1
    
    return max(1, min(int(bid), 13))


def get_spades_ai_play(hand: List[Dict], current_trick: List, led_suit: str, spades_broken: bool) -> Dict:
    """AI card selection for Spades"""
    if not current_trick:
        # Leading - play lowest non-spade if possible
        non_spades = [c for c in hand if c['suit'] != 'spades']
        if non_spades and not spades_broken:
            return min(non_spades, key=lambda c: c['value'])
        return min(hand, key=lambda c: c['value'])
    
    # Following - try to win or dump
    my_suit_cards = [c for c in hand if c['suit'] == led_suit]
    
    if my_suit_cards:
        # Play high to win or low to dump
        highest_so_far = max(current_trick, key=lambda p: p['card']['value'])['card']['value']
        my_higher = [c for c in my_suit_cards if c['value'] > highest_so_far]
        
        if my_higher:
            return min(my_higher, key=lambda c: c['value'])  # Lowest winning card
        return min(my_suit_cards, key=lambda c: c['value'])  # Dump lowest
    
    # Can't follow suit - dump lowest or play spade
    return min(hand, key=lambda c: c['value'])
