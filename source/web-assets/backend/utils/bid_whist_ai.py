"""
Bid Whist AI Logic - Moderate Difficulty
Provides intelligent but not perfect AI for practice mode
"""
import secrets
from typing import List, Dict, Optional, Tuple

# Create a secure random number generator
secure_random = secrets.SystemRandom()


class BidWhistAI:
    """
    Moderate difficulty AI for Bid Whist
    - Makes reasonable bids based on hand strength
    - Plays strategically but with occasional mistakes
    - Follows rules (must-follow-suit)
    """
    
    def __init__(self, difficulty="moderate"):
        self.difficulty = difficulty
        
    def evaluate_hand_strength(self, hand: List[Dict]) -> int:
        """
        Evaluate hand strength (0-100)
        Higher = stronger hand
        """
        if not hand:
            return 0
            
        score = 0
        suit_counts = {'hearts': 0, 'diamonds': 0, 'clubs': 0, 'spades': 0}
        high_cards = 0
        
        rank_values = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11,
            '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        }
        
        for card in hand:
            suit = card.get('suit', '')
            rank = card.get('rank', '')
            
            # Count suits for potential trump
            if suit in suit_counts:
                suit_counts[suit] += 1
            
            # Count high cards
            if rank in ['A', 'K', 'Q', 'J']:
                high_cards += 1
                score += rank_values.get(rank, 0)
            elif rank == '10':
                score += 8
            else:
                score += rank_values.get(rank, 0) // 2
        
        # Bonus for long suits (potential trump)
        max_suit_length = max(suit_counts.values()) if suit_counts else 0
        score += max_suit_length * 5
        
        # Bonus for high cards
        score += high_cards * 3
        
        return min(score, 100)
    
    def decide_bid(self, hand: List[Dict], current_highest_bid: Optional[int] = None) -> Tuple[Optional[int], Optional[str], Optional[str]]:
        """
        Decide whether to bid and what to bid
        
        Returns: (bid_amount, bid_type, trump_suit) or (None, None, None) to pass
        
        Moderate difficulty: Makes reasonable bids but not optimal
        """
        hand_strength = self.evaluate_hand_strength(hand)
        
        # Determine minimum bid to make
        min_bid = (current_highest_bid + 1) if current_highest_bid else 3
        
        # Decision thresholds for moderate AI
        if hand_strength < 40:
            # Weak hand - usually pass, but 20% chance to bid anyway
            if secure_random.random() > 0.2:
                return (None, None, None)  # Pass
        
        if hand_strength < 55:
            # Moderate hand - bid conservatively
            if min_bid <= 4:
                bid_amount = min_bid
            else:
                return (None, None, None)  # Pass if bid is too high
        
        elif hand_strength < 75:
            # Good hand - bid more aggressively
            bid_amount = min(min_bid + 1, 6)
        
        else:
            # Strong hand - bid high
            bid_amount = min(min_bid + 2, 7)
        
        # Choose bid type (moderate AI prefers simpler options)
        bid_type_choices = ["uptown", "downtown", "no_trump"]
        weights = [0.5, 0.3, 0.2]  # Moderate AI favors uptown
        bid_type = secure_random.choices(bid_type_choices, weights=weights)[0]
        
        # Choose trump suit (pick longest suit)
        suit_counts = {}
        for card in hand:
            suit = card.get('suit', '')
            if suit and suit != 'joker':
                suit_counts[suit] = suit_counts.get(suit, 0) + 1
        
        trump_suit = max(suit_counts, key=suit_counts.get) if suit_counts else 'spades'
        
        return (bid_amount, bid_type, trump_suit)
    
    def choose_card_to_play(
        self, 
        hand: List[Dict], 
        current_trick: List[Dict],
        trump_suit: Optional[str],
        led_suit: Optional[str]
    ) -> Optional[Dict]:
        """
        Choose which card to play
        
        Moderate difficulty:
        - Follows suit (required)
        - Tries to win tricks but not optimally
        - Uses trump reasonably
        """
        if not hand:
            return None
        
        # Filter playable cards (must follow suit if able)
        playable_cards = []
        
        if led_suit and any(c.get('suit') == led_suit for c in hand):
            # Must follow suit
            playable_cards = [c for c in hand if c.get('suit') == led_suit]
        else:
            # Can play any card
            playable_cards = hand
        
        if not playable_cards:
            return None
        
        # Evaluate current trick situation
        is_winning = self._is_currently_winning(current_trick, trump_suit, led_suit)
        
        # Strategy: Moderate AI (makes good moves but not perfect)
        if is_winning:
            # We're winning - play a low card to save high cards (70% of time)
            if secure_random.random() < 0.7:
                return min(playable_cards, key=lambda c: self._card_value(c, trump_suit, led_suit))
            else:
                # Sometimes play a higher card anyway (suboptimal)
                return secure_random.choice(playable_cards)
        else:
            # We're losing - try to win with 60% probability
            if secure_random.random() < 0.6:
                # Play highest card
                return max(playable_cards, key=lambda c: self._card_value(c, trump_suit, led_suit))
            else:
                # Sometimes give up and play random card (moderate difficulty)
                return secure_random.choice(playable_cards)
    
    def choose_kitty_discards(self, hand: List[Dict], trump_suit: str) -> List[Dict]:
        """Bid Whist kitty = 6 cards. Discards 6 from hand after getting kitty.
        
        Moderate AI: Keeps high cards and trump, discards low off-suit cards
        """
        if len(hand) < 6:
            return hand[:6]  # Shouldn't happen
        
        # Score each card
        card_scores = []
        for card in hand:
            score = self._card_value(card, trump_suit, None)
            # Bonus for trump cards
            if card.get('suit') == trump_suit:
                score += 20
            card_scores.append((card, score))
        
        # Sort by score (lowest first)
        card_scores.sort(key=lambda x: x[1])
        
        # Take 6 lowest scoring cards, but with 20% chance to make a mistake
        discards = []
        for i in range(6):
            if secure_random.random() < 0.2 and i < len(card_scores) - 1:
                # Make a mistake - discard a better card
                discards.append(card_scores[i + 1][0])
            else:
                discards.append(card_scores[i][0])
        
        return discards[:6]
    
    def _is_currently_winning(self, current_trick: List[Dict], trump_suit: Optional[str], led_suit: Optional[str]) -> bool:
        """Check if our team is currently winning the trick"""
        if not current_trick:
            return False
        
        # Simple check - compare card values
        my_card = current_trick[-1].get('card') if current_trick else None
        if not my_card:
            return False
        
        my_value = self._card_value(my_card, trump_suit, led_suit)
        
        for play in current_trick[:-1]:
            card = play.get('card')
            if card and self._card_value(card, trump_suit, led_suit) > my_value:
                return False
        
        return True
    
    def _card_value(self, card: Dict, trump_suit: Optional[str], led_suit: Optional[str]) -> int:
        """
        Calculate card value for comparison
        Higher = stronger
        """
        suit = card.get('suit', '')
        rank = card.get('rank', '')
        
        rank_values = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11,
            '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        }
        
        base_value = rank_values.get(rank, 0)
        
        # Jokers are highest
        if rank == 'Big Joker':
            return 100
        elif rank == 'Little Joker':
            return 99
        
        # Trump cards beat non-trump
        if trump_suit and suit == trump_suit:
            return 50 + base_value
        
        # Led suit cards beat off-suit
        if led_suit and suit == led_suit:
            return base_value
        
        # Off-suit cards are lowest
        return base_value - 20
