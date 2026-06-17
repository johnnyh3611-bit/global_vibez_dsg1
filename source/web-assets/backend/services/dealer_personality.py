"""
AI Dealer Personality Engine
Dynamic dealer behavior based on game state, player stats, and social context
"""
from typing import Dict, Optional
from pydantic import BaseModel
from datetime import datetime

class DealerPersonality(BaseModel):
    name: str = "The Professional"
    strictness: float = 0.7  # 0.0 (Relaxed) to 1.0 (Strict)
    social_index: float = 0.6  # 0.0 (Quiet) to 1.0 (Chatty)
    mood: str = "Neutral"  # Neutral, Supportive, Challenging, Intense
    animation_set: str = "professional"  # professional, social, tournament

class DealerBehavior(BaseModel):
    animation: str
    voice_line: str
    delay_ms: float
    eye_target: Optional[str] = None
    facial_expression: str = "neutral"
    intensity: float = 0.5

class DealerEngine:
    """The brain of the AI Dealer - calculates human-like responses"""
    
    def __init__(self):
        self.personality = DealerPersonality()
        self.player_memories: Dict[str, dict] = {}
    
    def get_dealer_vibe(self, player_stats: dict) -> str:
        """
        Adjusts dealer mood based on player performance
        """
        session_net = player_stats.get('session_net', 0)
        win_rate = player_stats.get('win_rate', 0.5)
        
        if session_net < -500:
            return "Supportive"  # Empathetic dialogue
        elif win_rate > 0.7:
            return "Challenging"  # Competitive banter
        elif player_stats.get('high_stakes', False):
            return "Intense"  # Professional focus
        
        return "Neutral"
    
    def get_reaction_for_game_event(self, event_type: str, context: dict) -> DealerBehavior:
        """
        Generates human-like dealer behavior for game events
        """
        reactions = {
            # Blackjack Events
            "blackjack_player_win": DealerBehavior(
                animation="approving_nod",
                voice_line="Well played. The cards were with you.",
                delay_ms=800,
                facial_expression="professional_smile",
                intensity=0.6
            ),
            "blackjack_player_bust": DealerBehavior(
                animation="sympathetic_nod",
                voice_line="Tough break. The house takes this one.",
                delay_ms=500,
                facial_expression="subtle_sympathy",
                intensity=0.4
            ),
            "blackjack_dealer_bust": DealerBehavior(
                animation="slight_frustration",
                voice_line="Looks like luck is on your side tonight.",
                delay_ms=700,
                facial_expression="professional_acceptance",
                intensity=0.5
            ),
            
            # Poker Events
            "poker_all_in": DealerBehavior(
                animation="intense_stare",
                voice_line=f"All in? {context.get('player_name', 'Player')}, that's a bold move. Let's see those cards.",
                delay_ms=2200,  # Dramatic pause
                eye_target="player_active",
                facial_expression="focused_intensity",
                intensity=0.9
            ),
            "poker_big_pot": DealerBehavior(
                animation="lean_forward",
                voice_line="The stakes are getting high. Good luck everyone.",
                delay_ms=1500,
                facial_expression="concentrated",
                intensity=0.8
            ),
            
            # Roulette Events
            "roulette_big_win": DealerBehavior(
                animation="impressed_reaction",
                voice_line=f"${context.get('amount', 0)} on {context.get('number', 'that number')}! Congratulations!",
                delay_ms=600,
                facial_expression="genuine_smile",
                intensity=0.7
            ),
            "roulette_close_miss": DealerBehavior(
                animation="sympathetic_gesture",
                voice_line="So close! The wheel almost had it.",
                delay_ms=500,
                facial_expression="encouraging",
                intensity=0.4
            ),
            
            # Slots Events
            "slots_jackpot": DealerBehavior(
                animation="celebration",
                voice_line="JACKPOT! That's what I'm talking about!",
                delay_ms=400,
                facial_expression="excited_celebration",
                intensity=1.0
            ),
            "slots_dating_bonus": DealerBehavior(
                animation="knowing_smile",
                voice_line="Looks like love is in the air... and in your payout!",
                delay_ms=900,
                facial_expression="playful_wink",
                intensity=0.7
            ),
            
            # Spades Events
            "spades_perfect_bid": DealerBehavior(
                animation="approving_gesture",
                voice_line="Perfect bid! You two are reading each other's minds.",
                delay_ms=700,
                facial_expression="impressed",
                intensity=0.7
            ),
            "spades_10_for_200": DealerBehavior(
                animation="lean_forward_intense",
                voice_line="Ten tricks bid? The pressure is on. Success gets you 200, failure costs you just as much.",
                delay_ms=1800,
                facial_expression="serious_focus",
                intensity=1.0
            ),
            "spades_blind_nil": DealerBehavior(
                animation="respectful_nod",
                voice_line="Blind Nil? That takes courage. Let's see if fortune favors the bold.",
                delay_ms=1500,
                facial_expression="respectful_focus",
                intensity=0.9
            ),
            "spades_renegue": DealerBehavior(
                animation="stern_correction",
                voice_line="Hold on. You've still got that suit in your hand. Play fair.",
                delay_ms=300,
                eye_target="offending_player",
                facial_expression="professional_stern",
                intensity=0.8
            ),
            
            # Social/Dating Events
            "dating_match_nearby": DealerBehavior(
                animation="social_gesture",
                voice_line="I see you've got some admirers at the table. Focus on the game... or not.",
                delay_ms=1000,
                facial_expression="playful_smirk",
                intensity=0.6
            ),
            "vibe_received": DealerBehavior(
                animation="knowing_nod",
                voice_line="Someone sent you a vibe. Looks like you're making an impression.",
                delay_ms=800,
                facial_expression="encouraging_smile",
                intensity=0.5
            ),
            
            # Idle States
            "idle_short": DealerBehavior(
                animation="deck_adjustment",
                voice_line="",
                delay_ms=0,
                facial_expression="neutral_professional",
                intensity=0.3
            ),
            "idle_long": DealerBehavior(
                animation="check_watch",
                voice_line="Take your time. The table isn't going anywhere.",
                delay_ms=0,
                facial_expression="patient",
                intensity=0.4
            )
        }
        
        # Default reaction
        default = DealerBehavior(
            animation="neutral",
            voice_line="",
            delay_ms=500,
            facial_expression="neutral",
            intensity=0.3
        )
        
        return reactions.get(event_type, default)
    
    def get_social_commentary(self, player_a: str, player_b: str, game_event: str) -> str:
        """
        Generates social/dating commentary for player interactions
        """
        if game_event == "spades_perfect_bid":
            return f"{player_a} and {player_b}, you two are in sync tonight. Great teamwork."
        
        if game_event == "poker_bluff_win":
            return "I didn't think you had it in you. Nice bluff."
        
        if game_event == "dating_compatibility_high":
            return "You two play well together. Maybe take it beyond the table?"
        
        return "Next hand coming up."
    
    def remember_player(self, player_id: str, event: str, value: any):
        """
        Track player history for personalized responses
        """
        if player_id not in self.player_memories:
            self.player_memories[player_id] = {
                'wins': 0,
                'losses': 0,
                'biggest_win': 0,
                'favorite_game': None,
                'last_seen': None
            }
        
        if event == 'win':
            self.player_memories[player_id]['wins'] += 1
        elif event == 'loss':
            self.player_memories[player_id]['losses'] += 1
        elif event == 'big_win':
            # Convert value to int/float for comparison (may come as string from query params)
            win_value = float(value) if value is not None else 0
            if win_value > self.player_memories[player_id]['biggest_win']:
                self.player_memories[player_id]['biggest_win'] = win_value
        
        self.player_memories[player_id]['last_seen'] = datetime.now().isoformat()
    
    def get_personalized_greeting(self, player_id: str, player_name: str) -> str:
        """
        Generate personalized greeting based on player history
        """
        memory = self.player_memories.get(player_id)
        
        if not memory:
            return f"Welcome to the lounge, {player_name}."
        
        wins = memory.get('wins', 0)
        if wins > 5:
            return f"Welcome back, {player_name}. You're on quite the winning streak. Ready to keep it going?"
        elif wins > 0:
            return f"Good to see you again, {player_name}. The tables have missed you."
        
        return f"Welcome back, {player_name}. Let's see if luck is on your side tonight."
    
    def calculate_reaction_delay(self, complexity: str, stakes_level: str) -> float:
        """
        Human dealers pause longer for complex/high-stakes decisions
        """
        delays = {
            "routine": {"low": 0.5, "medium": 0.7, "high": 1.0},
            "strategic": {"low": 1.0, "medium": 1.5, "high": 2.0},
            "dramatic": {"low": 1.5, "medium": 2.0, "high": 2.5}
        }
        
        return delays.get(complexity, {}).get(stakes_level, 1.0) * 1000  # Convert to ms

# Global dealer instance
dealer_engine = DealerEngine()
