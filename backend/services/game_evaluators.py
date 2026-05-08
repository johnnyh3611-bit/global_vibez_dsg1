"""
Card Game Evaluators
Implements game-specific logic for Bid Whist, Poker, and Baccarat
"""
from typing import List, Optional, Tuple
from enum import Enum

# ============================================================================
# CARD DEFINITIONS
# ============================================================================

class Suit(Enum):
    SPADES = "S"
    HEARTS = "H"
    DIAMONDS = "D"
    CLUBS = "C"
    JOKER = "J"

class Card:
    def __init__(self, rank: int, suit: str):
        self.rank = rank  # 1-13 (Ace-King), 14-15 for Jokers
        self.suit = suit
    
    def __repr__(self):
        rank_map = {1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'JR', 15: 'JB'}
        rank_str = rank_map.get(self.rank, str(self.rank))
        return f"{rank_str}{self.suit}"
    
    @staticmethod
    def from_string(card_str: str) -> 'Card':
        """Parse card from string like '5H', 'AS', 'JR'"""
        if card_str in ['JR', 'JB']:  # Jokers
            return Card(14 if card_str == 'JR' else 15, 'J')
        
        rank_map = {'A': 1, 'J': 11, 'Q': 12, 'K': 13}
        rank_str = card_str[:-1]
        suit = card_str[-1]
        rank = rank_map.get(rank_str, int(rank_str))
        return Card(rank, suit)

# ============================================================================
# BID WHIST EVALUATOR
# ============================================================================

class BidWhistEvaluator:
    """
    Evaluates Bid Whist tricks with Uptown/Downtown logic
    """
    
    @staticmethod
    def evaluate_trick(
        cards_played: List[Tuple[Card, str]], 
        trump_suit: Optional[str], 
        bid_type: str,
        lead_suit: str
    ) -> str:
        """
        Determine winner of a Bid Whist trick
        
        Args:
            cards_played: List of (Card, player_id) tuples
            trump_suit: Trump suit (or None for No Trump)
            bid_type: "UPTOWN", "DOWNTOWN", or "NO_TRUMP"
            lead_suit: The suit that was led
        
        Returns:
            player_id of the winner
        """
        if not cards_played:
            return None
        
        # Separate trump cards from non-trump
        trump_cards = [(c, p) for c, p in cards_played if c.suit == trump_suit or c.suit == 'J']
        follow_suit = [(c, p) for c, p in cards_played if c.suit == lead_suit and c.suit != trump_suit]
        
        # Trump beats everything
        if trump_cards:
            winning_card, winner = BidWhistEvaluator._find_best_card(trump_cards, bid_type, trump_suit)
        elif follow_suit:
            winning_card, winner = BidWhistEvaluator._find_best_card(follow_suit, bid_type, lead_suit)
        else:
            # No one followed suit and no trump - first card wins
            winning_card, winner = cards_played[0]
        
        return winner
    
    @staticmethod
    def _find_best_card(
        cards: List[Tuple[Card, str]], 
        bid_type: str, 
        relevant_suit: str
    ) -> Tuple[Card, str]:
        """Find the best card based on bid type"""
        
        if bid_type == "DOWNTOWN":
            # Downtown: Lower is better (2 is highest, Ace is lowest)
            # Jokers are always highest
            def card_value(card: Card) -> int:
                if card.suit == 'J':  # Joker
                    return 100 + card.rank  # JR=114, JB=115
                return 15 - card.rank  # Invert: 2=13, A=1 becomes 2=13, A=14
            
            best_card, best_player = max(cards, key=lambda x: card_value(x[0]))
        
        else:  # UPTOWN or NO_TRUMP
            # Uptown: Higher is better (Ace is highest, 2 is lowest)
            def card_value(card: Card) -> int:
                if card.suit == 'J':  # Joker
                    return 100 + card.rank
                return card.rank if card.rank > 1 else 14  # Ace high
            
            best_card, best_player = max(cards, key=lambda x: card_value(x[0]))
        
        return best_card, best_player
    
    @staticmethod
    def check_renege(
        player_hand: List[Card],
        card_played: Card,
        lead_suit: str,
        trump_suit: Optional[str]
    ) -> bool:
        """
        Check if player reneged (didn't follow suit when they could)
        Returns True if renege detected
        """
        # If player followed suit or led, no renege
        if card_played.suit == lead_suit:
            return False
        
        # Check if player has cards of the lead suit
        has_lead_suit = any(c.suit == lead_suit for c in player_hand)
        
        # If they have the suit but didn't play it, that's a renege
        return has_lead_suit

# ============================================================================
# POKER EVALUATOR
# ============================================================================

class PokerHand(Enum):
    HIGH_CARD = 1
    PAIR = 2
    TWO_PAIR = 3
    THREE_OF_KIND = 4
    STRAIGHT = 5
    FLUSH = 6
    FULL_HOUSE = 7
    FOUR_OF_KIND = 8
    STRAIGHT_FLUSH = 9
    ROYAL_FLUSH = 10

class PokerEvaluator:
    """Evaluates Texas Hold'em poker hands"""
    
    @staticmethod
    def evaluate_hand(cards: List[Card]) -> Tuple[PokerHand, List[int]]:
        """
        Evaluate 5-7 cards and return best hand
        Returns (hand_type, kickers) for comparison
        """
        if len(cards) < 5:
            return (PokerHand.HIGH_CARD, [])
        
        # Get all 5-card combinations if more than 5 cards
        if len(cards) == 5:
            return PokerEvaluator._evaluate_5_cards(cards)
        
        # For 6-7 cards, find best 5-card hand
        from itertools import combinations
        best_hand = (PokerHand.HIGH_CARD, [])
        
        for combo in combinations(cards, 5):
            hand = PokerEvaluator._evaluate_5_cards(list(combo))
            if hand[0].value > best_hand[0].value:
                best_hand = hand
        
        return best_hand
    
    @staticmethod
    def _evaluate_5_cards(cards: List[Card]) -> Tuple[PokerHand, List[int]]:
        """Evaluate exactly 5 cards"""
        ranks = sorted([c.rank if c.rank > 1 else 14 for c in cards], reverse=True)
        suits = [c.suit for c in cards]
        
        is_flush = len(set(suits)) == 1
        is_straight = PokerEvaluator._is_straight(ranks)
        
        rank_counts = {}
        for r in ranks:
            rank_counts[r] = rank_counts.get(r, 0) + 1
        
        counts = sorted(rank_counts.values(), reverse=True)
        unique_ranks = sorted(rank_counts.keys(), key=lambda x: (rank_counts[x], x), reverse=True)
        
        # Royal Flush
        if is_flush and is_straight and ranks[0] == 14:
            return (PokerHand.ROYAL_FLUSH, ranks)
        
        # Straight Flush
        if is_flush and is_straight:
            return (PokerHand.STRAIGHT_FLUSH, ranks)
        
        # Four of a Kind
        if counts == [4, 1]:
            return (PokerHand.FOUR_OF_KIND, unique_ranks)
        
        # Full House
        if counts == [3, 2]:
            return (PokerHand.FULL_HOUSE, unique_ranks)
        
        # Flush
        if is_flush:
            return (PokerHand.FLUSH, ranks)
        
        # Straight
        if is_straight:
            return (PokerHand.STRAIGHT, ranks)
        
        # Three of a Kind
        if counts == [3, 1, 1]:
            return (PokerHand.THREE_OF_KIND, unique_ranks)
        
        # Two Pair
        if counts == [2, 2, 1]:
            return (PokerHand.TWO_PAIR, unique_ranks)
        
        # Pair
        if counts == [2, 1, 1, 1]:
            return (PokerHand.PAIR, unique_ranks)
        
        # High Card
        return (PokerHand.HIGH_CARD, ranks)
    
    @staticmethod
    def _is_straight(ranks: List[int]) -> bool:
        """Check if ranks form a straight"""
        # Check standard straight
        if ranks == list(range(ranks[0], ranks[0] - 5, -1)):
            return True
        
        # Check wheel (A-2-3-4-5)
        if sorted(ranks) == [2, 3, 4, 5, 14]:
            return True
        
        return False
    
    @staticmethod
    def compare_hands(hand1: Tuple[PokerHand, List[int]], hand2: Tuple[PokerHand, List[int]]) -> int:
        """
        Compare two hands
        Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
        """
        if hand1[0].value > hand2[0].value:
            return 1
        elif hand1[0].value < hand2[0].value:
            return -1
        
        # Same hand type, compare kickers
        for k1, k2 in zip(hand1[1], hand2[1]):
            if k1 > k2:
                return 1
            elif k1 < k2:
                return -1
        
        return 0  # Perfect tie

# ============================================================================
# BACCARAT EVALUATOR
# ============================================================================

class BaccaratEvaluator:
    """Evaluates Baccarat hands according to Punto Banco rules"""
    
    @staticmethod
    def calculate_score(hand: List[Card]) -> int:
        """
        Calculate Baccarat score (modulo 10)
        Face cards and 10s = 0, Aces = 1, others = face value
        """
        total = 0
        for card in hand:
            if card.rank >= 10:  # 10, J, Q, K
                value = 0
            elif card.rank == 1:  # Ace
                value = 1
            else:
                value = card.rank
            total += value
        
        return total % 10
    
    @staticmethod
    def should_draw_third_card(player_hand: List[Card], banker_hand: List[Card]) -> Tuple[bool, bool]:
        """
        Determine if Player and/or Banker should draw a third card
        Returns (player_draws, banker_draws)
        """
        player_score = BaccaratEvaluator.calculate_score(player_hand)
        banker_score = BaccaratEvaluator.calculate_score(banker_hand)
        
        player_draws = False
        banker_draws = False
        # Natural 8 or 9 - no one draws
        if player_score >= 8 or banker_score >= 8:
            return (False, False)
        
        # Player draws if 0-5
        if player_score <= 5:
            player_draws = True
            # In real game, we'd draw the card here
            # For simulation, assume player drew (we'll need the actual card value)
        
        # Banker drawing rules (complex)
        if not player_draws:
            # If player stands, banker draws on 0-5
            banker_draws = banker_score <= 5
        else:
            # If player drew, banker uses the tableau
            # This requires knowing the player's third card value
            # For now, we'll return True and let the game logic handle it
            banker_draws = True
        
        return (player_draws, banker_draws)
    
    @staticmethod
    def determine_winner(player_hand: List[Card], banker_hand: List[Card]) -> str:
        """
        Determine winner of Baccarat hand
        Returns: "PLAYER", "BANKER", or "TIE"
        """
        player_score = BaccaratEvaluator.calculate_score(player_hand)
        banker_score = BaccaratEvaluator.calculate_score(banker_hand)
        
        if player_score > banker_score:
            return "PLAYER"
        elif banker_score > player_score:
            return "BANKER"
        else:
            return "TIE"
