"""
Poker Hand Evaluator - Texas Hold'em
Comprehensive hand ranking and comparison utilities
"""

from typing import List, Tuple
from collections import Counter


class PokerHandEvaluator:
    """Evaluates poker hands for Texas Hold'em"""
    
    HAND_RANKINGS = {
        "Royal Flush": 10,
        "Straight Flush": 9,
        "Four of a Kind": 8,
        "Full House": 7,
        "Flush": 6,
        "Straight": 5,
        "Three of a Kind": 4,
        "Two Pair": 3,
        "One Pair": 2,
        "High Card": 1
    }
    
    @staticmethod
    def card_rank_value(rank: str) -> int:
        """Convert card rank to numeric value"""
        rank_map = {
            'A': 14, 'K': 13, 'Q': 12, 'J': 11,
            '10': 10, '9': 9, '8': 8, '7': 7,
            '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
        }
        return rank_map.get(rank, 0)
    
    @staticmethod
    def evaluate_hand(cards: List[str]) -> Tuple[str, int, List[int]]:
        """
        Evaluate a poker hand
        Returns: (hand_name, ranking, kickers)
        """
        if len(cards) < 5:
            return ("High Card", 1, [])
        
        # Parse cards
        ranks = [PokerHandEvaluator.card_rank_value(c[:-1]) for c in cards]
        suits = [c[-1] for c in cards]
        
        rank_counts = Counter(ranks)
        suit_counts = Counter(suits)
        
        # Check for flush
        is_flush = max(suit_counts.values()) >= 5
        flush_suit = max(suit_counts, key=suit_counts.get) if is_flush else None
        
        # Get ranks for flush if applicable
        flush_ranks = sorted([r for r, s in zip(ranks, suits) if s == flush_suit], reverse=True) if is_flush else []
        
        # Check for straight
        unique_ranks = sorted(set(ranks), reverse=True)
        straight_high = PokerHandEvaluator._check_straight(unique_ranks)
        is_straight = straight_high is not None
        
        # Check for straight flush
        if is_flush and flush_ranks:
            straight_flush_high = PokerHandEvaluator._check_straight(flush_ranks[:7])
            if straight_flush_high:
                if straight_flush_high == 14:  # Royal Flush
                    return ("Royal Flush", 10, [14])
                return ("Straight Flush", 9, [straight_flush_high])
        
        # Four of a kind
        quads = [r for r, c in rank_counts.items() if c == 4]
        if quads:
            quad_rank = max(quads)
            kicker = max([r for r in ranks if r != quad_rank])
            return ("Four of a Kind", 8, [quad_rank, kicker])
        
        # Full house
        trips = [r for r, c in rank_counts.items() if c == 3]
        pairs = [r for r, c in rank_counts.items() if c == 2]
        if trips and (pairs or len(trips) > 1):
            trip_rank = max(trips)
            pair_rank = max([r for r in pairs + trips if r != trip_rank])
            return ("Full House", 7, [trip_rank, pair_rank])
        
        # Flush
        if is_flush:
            top_five = sorted(flush_ranks, reverse=True)[:5]
            return ("Flush", 6, top_five)
        
        # Straight
        if is_straight:
            return ("Straight", 5, [straight_high])
        
        # Three of a kind
        if trips:
            trip_rank = max(trips)
            kickers = sorted([r for r in ranks if r != trip_rank], reverse=True)[:2]
            return ("Three of a Kind", 4, [trip_rank] + kickers)
        
        # Two pair
        if len(pairs) >= 2:
            top_pairs = sorted(pairs, reverse=True)[:2]
            kicker = max([r for r in ranks if r not in top_pairs])
            return ("Two Pair", 3, top_pairs + [kicker])
        
        # One pair
        if pairs:
            pair_rank = max(pairs)
            kickers = sorted([r for r in ranks if r != pair_rank], reverse=True)[:3]
            return ("One Pair", 2, [pair_rank] + kickers)
        
        # High card
        top_five = sorted(ranks, reverse=True)[:5]
        return ("High Card", 1, top_five)
    
    @staticmethod
    def _check_straight(ranks: List[int]) -> int:
        """Check for straight, return high card value or None"""
        unique = sorted(set(ranks), reverse=True)
        
        # Check for regular straights
        for i in range(len(unique) - 4):
            if unique[i] - unique[i+4] == 4:
                return unique[i]
        
        # Check for wheel (A-2-3-4-5)
        if set([14, 5, 4, 3, 2]).issubset(set(unique)):
            return 5  # In wheel, 5 is high card
        
        return None
    
    @staticmethod
    def compare_hands(hand1: List[str], hand2: List[str]) -> int:
        """
        Compare two hands
        Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
        """
        eval1 = PokerHandEvaluator.evaluate_hand(hand1)
        eval2 = PokerHandEvaluator.evaluate_hand(hand2)
        
        # Compare rankings
        if eval1[1] > eval2[1]:
            return 1
        elif eval1[1] < eval2[1]:
            return -1
        
        # Same ranking, compare kickers
        for k1, k2 in zip(eval1[2], eval2[2]):
            if k1 > k2:
                return 1
            elif k1 < k2:
                return -1
        
        return 0  # Tie
    
    @staticmethod
    def get_best_five_card_hand(cards: List[str]) -> List[str]:
        """Get best 5-card hand from 7 cards"""
        from itertools import combinations
        
        if len(cards) <= 5:
            return cards
        
        best_hand = None
        best_eval = ("High Card", 0, [])
        
        for combo in combinations(cards, 5):
            eval_result = PokerHandEvaluator.evaluate_hand(list(combo))
            if eval_result[1] > best_eval[1] or \
               (eval_result[1] == best_eval[1] and eval_result[2] > best_eval[2]):
                best_hand = list(combo)
                best_eval = eval_result
        
        return best_hand or cards[:5]
