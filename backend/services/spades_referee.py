import secrets
"""
Spades Game Logic with Edge Case Handling
Includes: Reneging detection, 10-for-200, Blind Nil, Nil, Bags
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
import hashlib
secure_random = secrets.SystemRandom()

class SpadesBid(BaseModel):
    player_id: str
    bid: int
    is_nil: bool = False
    is_blind_nil: bool = False

class SpadesHandResult(BaseModel):
    player_id: str
    tricks_won: int
    bid: int
    points: int
    is_set: bool
    bags: int

class SpadesReferee:
    """Enforces Spades rules with human dealer logic"""
    
    def __init__(self):
        self.current_bids: Dict[str, SpadesBid] = {}
        self.tricks_won: Dict[str, int] = {}
        self.bags: Dict[str, int] = {}
        self.hands_played: List[dict] = []
    
    def validate_bid(self, bid: SpadesBid) -> dict:
        """
        Validates a bid and returns dealer reaction
        """
        # Blind Nil (0 bid without seeing cards)
        if bid.is_blind_nil:
            return {
                "is_valid": True,
                "dealer_reaction": {
                    "animation": "eyebrow_raise_respect",
                    "voice_line": f"Blind Nil? That takes courage, {bid.player_id}. Let's see if fortune favors the bold.",
                    "delay_ms": 1500,
                    "intensity": 0.9
                }
            }
        
        # Regular Nil
        if bid.is_nil or bid.bid == 0:
            return {
                "is_valid": True,
                "dealer_reaction": {
                    "animation": "thoughtful_nod",
                    "voice_line": "Going for Nil. Bold strategy.",
                    "delay_ms": 800,
                    "intensity": 0.7
                }
            }
        
        # Regular bid
        if 1 <= bid.bid <= 13:
            return {
                "is_valid": True,
                "dealer_reaction": None
            }
        
        return {
            "is_valid": False,
            "error": "Invalid bid. Must be 0-13.",
            "dealer_reaction": {
                "animation": "head_shake",
                "voice_line": "That bid isn't legal. Choose between 0 and 13.",
                "delay_ms": 500,
                "intensity": 0.5
            }
        }
    
    def check_ten_for_200(self, team_bids: Dict[str, int]) -> Optional[dict]:
        """
        Detects 10-for-200 edge case (team bids exactly 10 books)
        """
        # Team A (players 0 and 2), Team B (players 1 and 3)
        team_a_total = sum(team_bids.get(f"player_{i}", 0) for i in [0, 2])
        team_b_total = sum(team_bids.get(f"player_{i}", 0) for i in [1, 3])
        
        if team_a_total == 10:
            return {
                "team": "A",
                "event_type": "TEN_FOR_TWO_HUNDRED",
                "points_at_stake": 200,
                "dealer_reaction": {
                    "animation": "lean_forward_intense",
                    "voice_line": "Team A bid 10 books. The pressure is on. Success gets you 200, failure costs you just as much.",
                    "delay_ms": 1800,
                    "facial_expression": "serious_focus",
                    "intensity": 1.0
                }
            }
        
        if team_b_total == 10:
            return {
                "team": "B",
                "event_type": "TEN_FOR_TWO_HUNDRED",
                "points_at_stake": 200,
                "dealer_reaction": {
                    "animation": "lean_forward_intense",
                    "voice_line": "Team B bid 10 books. High stakes. 200 points on the line.",
                    "delay_ms": 1800,
                    "facial_expression": "serious_focus",
                    "intensity": 1.0
                }
            }
        
        return None
    
    def check_renegue(self, player_hand: List[str], suit_led: str, card_played: str) -> dict:
        """
        Checks if a player illegally played wrong suit (reneging)
        Returns dealer enforcement action
        """
        # Extract suit from card (e.g., "Kh" -> "h")
        played_suit = card_played[-1] if len(card_played) == 2 else card_played[-2]
        
        # Check if player has the suit that was led
        has_suit = any(card.endswith(suit_led) for card in player_hand)
        
        # If they have the suit but played something else (and it's not a Spade)
        if has_suit and played_suit != suit_led and played_suit != 's':
            return {
                "is_illegal": True,
                "violation_type": "RENEGUE",
                "penalty": -3,  # -3 books penalty
                "dealer_reaction": {
                    "animation": "stern_stop_gesture",
                    "voice_line": "Hold on. You've still got that suit in your hand. Play fair.",
                    "delay_ms": 300,  # Immediate reaction
                    "facial_expression": "professional_stern",
                    "intensity": 0.8,
                    "action": "FORCE_CARD_RETURN"
                }
            }
        
        return {"is_illegal": False}
    
    def calculate_hand_score(self, result: SpadesHandResult) -> dict:
        """
        Calculates points for a completed hand with all edge cases
        """
        points = 0
        dealer_reaction = None
        
        # Blind Nil scoring
        if result.bid == 0 and hasattr(result, 'was_blind'):
            if result.tricks_won == 0:
                points = 200  # Blind Nil success
                dealer_reaction = {
                    "animation": "big_applause",
                    "voice_line": "Blind Nil success! That's exceptional play. 200 points!",
                    "delay_ms": 1000,
                    "intensity": 1.0
                }
            else:
                points = -200  # Blind Nil failure
                dealer_reaction = {
                    "animation": "sympathetic_shake",
                    "voice_line": "Blind Nil failed. That's a tough 200-point penalty.",
                    "delay_ms": 800,
                    "intensity": 0.7
                }
        
        # Regular Nil scoring
        elif result.bid == 0:
            if result.tricks_won == 0:
                points = 100  # Nil success
                dealer_reaction = {
                    "animation": "approving_nod",
                    "voice_line": "Nil achieved. 100 points.",
                    "delay_ms": 600,
                    "intensity": 0.7
                }
            else:
                points = -100  # Nil failure
                dealer_reaction = {
                    "animation": "head_shake",
                    "voice_line": "Nil broken. -100 points.",
                    "delay_ms": 500,
                    "intensity": 0.5
                }
        
        # Regular bid scoring
        else:
            if result.tricks_won >= result.bid:
                # Made bid
                points = (result.bid * 10) + (result.tricks_won - result.bid)  # Overtricks are bags
                
                if result.tricks_won == result.bid:
                    # Perfect bid
                    dealer_reaction = {
                        "animation": "professional_approval",
                        "voice_line": f"Perfect. Exactly {result.bid} books.",
                        "delay_ms": 600,
                        "intensity": 0.6
                    }
            else:
                # Set (failed to make bid)
                points = -(result.bid * 10)
                dealer_reaction = {
                    "animation": "disappointed_nod",
                    "voice_line": f"Set. -{result.bid * 10} points.",
                    "delay_ms": 700,
                    "intensity": 0.6
                }
        
        # Bag penalty (every 10 bags = -100 points)
        bags_penalty = 0
        total_bags = result.bags
        if total_bags >= 10:
            bags_penalty = -100 * (total_bags // 10)
            dealer_reaction = {
                "animation": "cautionary_gesture",
                "voice_line": f"Bag penalty: {bags_penalty} points. Watch those overtricks.",
                "delay_ms": 800,
                "intensity": 0.7
            }
        
        return {
            "points": points + bags_penalty,
            "bags_added": result.tricks_won - result.bid if result.tricks_won > result.bid else 0,
            "dealer_reaction": dealer_reaction
        }
    
    def generate_fair_deck(self) -> tuple:
        """
        Creates provably fair deck with SHA-256 verification
        """
        deck = [f"{rank}{suit}" for rank in "23456789TJQKA" for suit in "shdc"]
        secure_random.shuffle(deck)
        
        # Server seed for verification (using secrets for cryptographic security)
        server_seed = f"GlobalVibez_Spades_{secrets.randbelow(9000) + 1000}"
        deck_string = "".join(deck) + server_seed
        
        # Hash shown to players BEFORE dealing
        verification_hash = hashlib.sha256(deck_string.encode()).hexdigest()
        
        return deck, verification_hash, server_seed
    
    def get_dealer_commentary(self, game_state: dict) -> str:
        """
        Generates contextual dealer commentary
        """
        # High-stakes commentary
        if game_state.get('is_10_for_200'):
            return "Every trick counts. The pressure is real."
        
        # Close game
        score_diff = abs(game_state.get('team_a_score', 0) - game_state.get('team_b_score', 0))
        if score_diff < 50:
            return "It's anyone's game. This is close."
        
        # Bags warning
        if any(game_state.get(f'team_{t}_bags', 0) >= 8 for t in ['a', 'b']):
            return "Watch those bags. You're getting close to a penalty."
        
        return ""

# Global referee instance
spades_referee = SpadesReferee()
