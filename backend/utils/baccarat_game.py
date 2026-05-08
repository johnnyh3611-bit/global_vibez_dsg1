# Baccarat Game Logic - Casino Rules

import secrets
secure_random = secrets.SystemRandom()
from typing import List, Dict, Optional

class BaccaratGame:
    """
    Baccarat game implementation with standard casino rules
    - 8 decks (416 cards)
    - Natural 8/9 instant win
    - Third-card drawing rules for Player and Banker
    - Betting options: Player, Banker, Tie
    - Payouts: Player 1:1, Banker 1:1 (5% commission), Tie 8:1
    """
    
    CARD_VALUES = {
        'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 0, 'J': 0, 'Q': 0, 'K': 0
    }
    
    SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
    
    def __init__(self):
        self.deck = []
        self.player_hand = []
        self.banker_hand = []
        self.player_score = 0
        self.banker_score = 0
        self.winner = None
        self.game_phase = 'betting'  # betting, dealing, finished
        
    def create_deck(self, num_decks=8):
        """Create shuffled shoe with multiple decks"""
        self.deck = []
        values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        
        for _ in range(num_decks):
            for value in values:
                for suit in self.SUITS:
                    self.deck.append({'value': value, 'suit': suit})
        
        secure_random.shuffle(self.deck)
    
    def calculate_score(self, hand: List[Dict]) -> int:
        """Calculate Baccarat score (last digit of total)"""
        total = sum(self.CARD_VALUES[card['value']] for card in hand)
        return total % 10
    
    def deal_initial_cards(self):
        """Deal 2 cards to Player and 2 to Banker"""
        self.create_deck()
        
        # Deal pattern: Player, Banker, Player, Banker
        self.player_hand = [self.deck[0], self.deck[2]]
        self.banker_hand = [self.deck[1], self.deck[3]]
        
        self.player_score = self.calculate_score(self.player_hand)
        self.banker_score = self.calculate_score(self.banker_hand)
        
        self.game_phase = 'dealing'
        
        return {
            'player_hand': self.player_hand[:],  # Copy
            'banker_hand': self.banker_hand[:],
            'player_score': self.player_score,
            'banker_score': self.banker_score
        }
    
    def apply_third_card_rules(self):
        """
        Apply Baccarat third-card drawing rules
        Returns: dict with drawing actions and final scores
        """
        deck_index = 4  # Cards 0-3 already dealt
        actions = []
        
        # Natural 8 or 9 - no more cards
        if self.player_score >= 8 or self.banker_score >= 8:
            actions.append({
                'type': 'natural',
                'player_score': self.player_score,
                'banker_score': self.banker_score
            })
            self.determine_winner()
            return {
                'actions': actions,
                'player_hand': self.player_hand,
                'banker_hand': self.banker_hand,
                'player_score': self.player_score,
                'banker_score': self.banker_score,
                'winner': self.winner
            }
        
        # Player draws third card if total is 0-5
        player_drew_third = False
        player_third_card_value = None
        
        if self.player_score <= 5:
            third_card = self.deck[deck_index]
            deck_index += 1
            self.player_hand.append(third_card)
            player_drew_third = True
            player_third_card_value = self.CARD_VALUES[third_card['value']]
            self.player_score = self.calculate_score(self.player_hand)
            
            actions.append({
                'type': 'player_draw',
                'card': third_card,
                'new_score': self.player_score
            })
        else:
            actions.append({
                'type': 'player_stand',
                'score': self.player_score
            })
        
        # Banker drawing rules (complex)
        banker_draws = self._should_banker_draw(player_drew_third, player_third_card_value)
        
        if banker_draws:
            third_card = self.deck[deck_index]
            self.banker_hand.append(third_card)
            self.banker_score = self.calculate_score(self.banker_hand)
            
            actions.append({
                'type': 'banker_draw',
                'card': third_card,
                'new_score': self.banker_score
            })
        else:
            actions.append({
                'type': 'banker_stand',
                'score': self.banker_score
            })
        
        self.determine_winner()
        
        return {
            'actions': actions,
            'player_hand': self.player_hand,
            'banker_hand': self.banker_hand,
            'player_score': self.player_score,
            'banker_score': self.banker_score,
            'winner': self.winner
        }
    
    def _should_banker_draw(self, player_drew: bool, player_third_value: Optional[int]) -> bool:
        """
        Banker third-card drawing rules
        https://en.wikipedia.org/wiki/Baccarat#Tableau_of_drawing_rules
        """
        if self.banker_score >= 7:
            return False  # Banker stands on 7
        
        if self.banker_score <= 2:
            return True  # Banker always draws on 0, 1, 2
        
        # If player stood (no third card)
        if not player_drew:
            return self.banker_score <= 5  # Banker draws on 3, 4, 5
        
        # Complex rules based on player's third card
        if self.banker_score == 3:
            return player_third_value != 8
        elif self.banker_score == 4:
            return player_third_value in [2, 3, 4, 5, 6, 7]
        elif self.banker_score == 5:
            return player_third_value in [4, 5, 6, 7]
        elif self.banker_score == 6:
            return player_third_value in [6, 7]
        
        return False
    
    def determine_winner(self):
        """Determine game winner"""
        if self.player_score > self.banker_score:
            self.winner = 'player'
        elif self.banker_score > self.player_score:
            self.winner = 'banker'
        else:
            self.winner = 'tie'
        
        self.game_phase = 'finished'
    
    def calculate_payout(self, bet_type: str, bet_amount: int) -> int:
        """
        Calculate payout based on bet type and winner
        - Player: 1:1
        - Banker: 1:1 (5% commission deducted)
        - Tie: 8:1
        """
        if bet_type == self.winner:
            if bet_type == 'player':
                return bet_amount * 2  # 1:1 (original + winnings)
            elif bet_type == 'banker':
                winnings = bet_amount * 0.95  # 5% commission
                return int(bet_amount + winnings)
            elif bet_type == 'tie':
                return bet_amount * 9  # 8:1 (original + 8x winnings)
        elif bet_type == 'tie' and self.winner != 'tie':
            return 0  # Tie bet loses if not a tie
        elif bet_type in ['player', 'banker'] and self.winner == 'tie':
            return bet_amount  # Push - bet returned on tie
        
        return 0  # Losing bet
    
    def get_game_state(self) -> Dict:
        """Get current game state"""
        return {
            'phase': self.game_phase,
            'player_hand': self.player_hand,
            'banker_hand': self.banker_hand,
            'player_score': self.player_score,
            'banker_score': self.banker_score,
            'winner': self.winner
        }


# AI for Baccarat (simple strategy)
def get_baccarat_ai_bet() -> str:
    """
    Simple AI betting strategy
    In real casinos, Banker has slightly better odds (50.68% vs 49.32%)
    """
    # 50% Banker, 45% Player, 5% Tie
    rand = secure_random.random()
    if rand < 0.50:
        return 'banker'
    elif rand < 0.95:
        return 'player'
    else:
        return 'tie'
