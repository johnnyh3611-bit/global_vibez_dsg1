from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import hashlib
import secrets
from services.game_economy_constants import PLATFORM_MIN_BET, format_coins
from services.blackjack_engine import Card, BlackjackEngine

router = APIRouter()

class DealRequest(BaseModel):
    player_id: str
    bet_amount: float
    side_bets: Optional[Dict[str, float]] = {}
    client_seed: Optional[str] = None
    lightning_active: Optional[bool] = False

class ActionRequest(BaseModel):
    session_id: str
    action: str  # 'hit', 'stand', 'double', 'split', 'insurance'
    hand_index: Optional[int] = 0  # For split hands

class SideBetCalculator:
    """Calculate side bet payouts for Perfect Pairs and 21+3"""
    
    @staticmethod
    def check_perfect_pairs(card1: Card, card2: Card) -> Dict:
        """
        Perfect Pair (same rank + same suit): 25:1
        Colored Pair (same rank + same color): 12:1
        Mixed Pair (same rank + different color): 5:1
        """
        if card1.rank != card2.rank:
            return {"win": False, "payout_multiplier": 0, "type": None}
        
        # Check if same suit (Perfect Pair)
        if card1.suit == card2.suit:
            return {"win": True, "payout_multiplier": 25, "type": "Perfect Pair"}
        
        # Check if same color (Colored Pair)
        red_suits = ['hearts', 'diamonds']
        black_suits = ['clubs', 'spades']
        
        if (card1.suit in red_suits and card2.suit in red_suits) or \
           (card1.suit in black_suits and card2.suit in black_suits):
            return {"win": True, "payout_multiplier": 12, "type": "Colored Pair"}
        
        # Mixed Pair
        return {"win": True, "payout_multiplier": 5, "type": "Mixed Pair"}
    
    @staticmethod
    def check_21_plus_3(player_card1: Card, player_card2: Card, dealer_up: Card) -> Dict:
        """
        21+3 Poker-style side bet (player 2 cards + dealer up card)
        Suited Trips: 100:1
        Straight Flush: 40:1
        Three of a Kind: 30:1
        Straight: 10:1
        Flush: 5:1
        """
        cards = [player_card1, player_card2, dealer_up]
        ranks = [c.rank for c in cards]
        suits = [c.suit for c in cards]
        
        # Helper to convert rank to numeric value for straight checking
        def rank_value(rank):
            if rank == 'A':
                return 14
            if rank == 'K':
                return 13
            if rank == 'Q':
                return 12
            if rank == 'J':
                return 11
            return int(rank)
        
        # Check for Suited Trips (all same rank and suit)
        if len(set(ranks)) == 1 and len(set(suits)) == 1:
            return {"win": True, "payout_multiplier": 100, "type": "Suited Trips"}
        
        # Check for flush (all same suit)
        is_flush = len(set(suits)) == 1
        
        # Check for straight
        values = sorted([rank_value(r) for r in ranks])
        is_straight = (
            (values[2] - values[1] == 1 and values[1] - values[0] == 1) or
            (values == [2, 3, 14])  # Special case: A-2-3
        )
        
        # Straight Flush
        if is_straight and is_flush:
            return {"win": True, "payout_multiplier": 40, "type": "Straight Flush"}
        
        # Three of a Kind
        if len(set(ranks)) == 1:
            return {"win": True, "payout_multiplier": 30, "type": "Three of a Kind"}
        
        # Straight
        if is_straight:
            return {"win": True, "payout_multiplier": 10, "type": "Straight"}
        
        # Flush
        if is_flush:
            return {"win": True, "payout_multiplier": 5, "type": "Flush"}
        
        return {"win": False, "payout_multiplier": 0, "type": None}

class LightningMultiplier:
    """Manage Lightning Multiplier system"""
    
    @staticmethod
    def generate_multiplier(is_blackjack: bool = False) -> int:
        """Generate random multiplier based on win type"""
        roll = 0 + secrets.randbelow(100)
        
        if is_blackjack:
            if roll >= 95:
                return 25  # Super rare 25x
            elif roll >= 80:
                return 15  # Rare 15x
            else:
                return 6   # Common 6x for blackjack
        else:
            # Standard win: 2x-5x
            return 2 + secrets.randbelow(4)
    
    @staticmethod
    def calculate_payout(base_payout: float, multiplier: int) -> float:
        """Apply multiplier to payout"""
        return base_payout * multiplier

# In-memory game sessions (in production, use Redis or database)
game_sessions = {}

@router.post("/deal")
async def deal_initial_hand(request: DealRequest) -> Dict[str, Any]:
    """Deal initial hand for new Blackjack round with side bets and lightning"""
    
    # Clean up old sessions (keep only last 100 to prevent memory buildup)
    global game_sessions
    if len(game_sessions) > 100:
        session_ids = list(game_sessions.keys())
        for old_id in session_ids[:50]:
            del game_sessions[old_id]
    
    if request.bet_amount < PLATFORM_MIN_BET:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum bet is {format_coins(PLATFORM_MIN_BET)}",
        )
    
    # Initialize engine and calculators
    engine = BlackjackEngine()
    side_bet_calc = SideBetCalculator()
    
    # Generate server seed for provably fair
    server_seed = hashlib.sha256(str(secure_random.random()).encode()).hexdigest()
    client_seed = request.client_seed or "default_seed"
    # combined_seed = f"{server_seed}:{client_seed}"  # Unused for now
    
    # Note: Using secure randomness instead of seeded random for better security
    # Provably fair hash is still generated for transparency
    
    # Deal cards: Player, Dealer, Player, Dealer
    player_cards = [engine.deal_card(), engine.deal_card()]
    dealer_cards = [engine.deal_card(), engine.deal_card()]
    
    player_value = engine.calculate_hand(player_cards)
    dealer_value = engine.calculate_hand([dealer_cards[0]])  # Only show first card
    
    is_player_blackjack = engine.is_blackjack(player_cards)
    is_dealer_blackjack = engine.is_blackjack(dealer_cards)
    
    # Calculate side bets
    side_bet_results = {}
    total_side_bet_payout = 0
    
    if request.side_bets:
        # Perfect Pairs
        if 'perfect_pairs' in request.side_bets and request.side_bets['perfect_pairs'] > 0:
            pp_result = side_bet_calc.check_perfect_pairs(player_cards[0], player_cards[1])
            pp_bet = request.side_bets['perfect_pairs']
            pp_payout = (pp_bet * (pp_result['payout_multiplier'] + 1)) if pp_result['win'] else 0
            side_bet_results['perfect_pairs'] = {
                'bet': pp_bet,
                'win': pp_result['win'],
                'type': pp_result['type'],
                'multiplier': pp_result['payout_multiplier'],
                'payout': pp_payout
            }
            total_side_bet_payout += pp_payout
        
        # 21+3
        if '21_plus_3' in request.side_bets and request.side_bets['21_plus_3'] > 0:
            tp_result = side_bet_calc.check_21_plus_3(player_cards[0], player_cards[1], dealer_cards[0])
            tp_bet = request.side_bets['21_plus_3']
            tp_payout = (tp_bet * (tp_result['payout_multiplier'] + 1)) if tp_result['win'] else 0
            side_bet_results['21_plus_3'] = {
                'bet': tp_bet,
                'win': tp_result['win'],
                'type': tp_result['type'],
                'multiplier': tp_result['payout_multiplier'],
                'payout': tp_payout
            }
            total_side_bet_payout += tp_payout
    
    # Generate Lightning multiplier if active
    current_multiplier = 1
    if request.lightning_active and is_player_blackjack:
        current_multiplier = LightningMultiplier.generate_multiplier(is_blackjack=True)
    elif request.lightning_active:
        current_multiplier = LightningMultiplier.generate_multiplier(is_blackjack=False)
    
    # Generate secure session ID using secrets
    session_id = secrets.token_urlsafe(32)
    
    # Determine immediate result if both have blackjack
    game_over = is_player_blackjack or is_dealer_blackjack
    winner = None
    payout = 0
    
    if is_player_blackjack and is_dealer_blackjack:
        game_over = True
        winner = "push"
        payout = request.bet_amount  # Return bet
    elif is_player_blackjack:
        game_over = True
        winner = "player"
        base_payout = request.bet_amount * 2.5  # 3:2 payout
        payout = LightningMultiplier.calculate_payout(base_payout, current_multiplier) if request.lightning_active else base_payout
    elif is_dealer_blackjack:
        game_over = True
        winner = "dealer"
        payout = 0
    
    # Check for insurance offer (dealer showing Ace)
    offer_insurance = dealer_cards[0].rank == 'A' and not game_over
    
    # Store session
    game_sessions[session_id] = {
        'engine': engine,
        'player_hands': [[card for card in player_cards]],  # Support multiple hands for split
        'dealer_cards': dealer_cards,
        'bet_amounts': [request.bet_amount],  # Support multiple bets for split
        'game_over': game_over,
        'player_id': request.player_id,
        'server_seed': server_seed,
        'lightning_active': request.lightning_active,
        'current_multiplier': current_multiplier,
        'insurance_taken': False,
        'can_split': engine.can_split(player_cards) and not game_over,
        'active_hand_index': 0,
    }
    
    # Note: Using secure randomness (no reset needed)
    
    return {
        "session_id": session_id,
        "player_cards": [card.to_string() for card in player_cards],
        "dealer_up_card": dealer_cards[0].to_string(),
        "dealer_hole_card_hidden": True,
        "player_value": player_value,
        "dealer_showing": dealer_value,
        "is_blackjack": is_player_blackjack,
        "game_over": game_over,
        "winner": winner,
        "payout": payout + total_side_bet_payout,
        "side_bet_results": side_bet_results,
        "offer_insurance": offer_insurance,
        "can_split": engine.can_split(player_cards) and not game_over,
        "lightning_multiplier": current_multiplier if request.lightning_active else None,
        "proof": {
            "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest(),
            "client_seed": client_seed
        }
    }

@router.post("/action")
async def player_action(request: ActionRequest) -> Dict[str, Any]:
    """Handle player actions: hit, stand, double, split"""
    
    if request.session_id not in game_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = game_sessions[request.session_id]
    
    if session['game_over']:
        raise HTTPException(status_code=400, detail="Game already over")
    
    engine = session['engine']
    # Prefer explicit hand_index; fall back to session active hand after split.
    hand_index = (
        request.hand_index
        if request.hand_index is not None
        else session.get('active_hand_index', 0)
    )
    if hand_index < 0 or hand_index >= len(session['player_hands']):
        raise HTTPException(status_code=400, detail="Invalid hand_index")
    player_cards = session['player_hands'][hand_index]
    dealer_cards = session['dealer_cards']
    bet_amount = session['bet_amounts'][hand_index]
    
    action = request.action.lower()

    def _resolve_all_hands() -> Dict[str, Any]:
        """Dealer plays once; settle every player hand (post-split aware)."""
        dealer_value = engine.calculate_hand(dealer_cards)
        while dealer_value < 17:
            dealer_cards.append(engine.deal_card())
            dealer_value = engine.calculate_hand(dealer_cards)

        hand_results = []
        total_payout = 0
        for idx, hand in enumerate(session['player_hands']):
            pv = engine.calculate_hand(hand)
            bet = session['bet_amounts'][idx]
            if pv > 21:
                winner, payout = "dealer", 0
            elif dealer_value > 21 or pv > dealer_value:
                winner, payout = "player", bet * 2
            elif pv < dealer_value:
                winner, payout = "dealer", 0
            else:
                winner, payout = "push", bet
            total_payout += payout
            hand_results.append({
                "hand_index": idx,
                "player_cards": [c.to_string() for c in hand],
                "player_value": pv,
                "winner": winner,
                "payout": payout,
            })

        session['game_over'] = True
        overall = "player" if total_payout > sum(session['bet_amounts']) else (
            "push" if total_payout == sum(session['bet_amounts']) else "dealer"
        )
        return {
            "dealer_cards": [c.to_string() for c in dealer_cards],
            "dealer_value": dealer_value,
            "hand_results": hand_results,
            "player_hands": [[c.to_string() for c in h] for h in session['player_hands']],
            "game_over": True,
            "winner": overall,
            "payout": total_payout,
        }

    def _advance_or_resolve(trigger_action: str, extra: Dict[str, Any]) -> Dict[str, Any]:
        """After finishing a hand, move to next split hand or settle vs dealer."""
        next_idx = hand_index + 1
        if next_idx < len(session['player_hands']):
            session['active_hand_index'] = next_idx
            return {
                "action": trigger_action,
                "active_hand_index": next_idx,
                "player_hands": [
                    [c.to_string() for c in h] for h in session['player_hands']
                ],
                "player_cards": [
                    c.to_string() for c in session['player_hands'][next_idx]
                ],
                "player_value": engine.calculate_hand(session['player_hands'][next_idx]),
                "game_over": False,
                **extra,
            }
        settled = _resolve_all_hands()
        settled["action"] = trigger_action
        settled.update(extra)
        return settled
    
    if action == 'hit':
        # Deal another card to player
        new_card = engine.deal_card()
        player_cards.append(new_card)
        player_value = engine.calculate_hand(player_cards)
        
        # Check if busted
        if player_value > 21:
            return _advance_or_resolve("hit", {
                "player_cards": [card.to_string() for card in player_cards],
                "player_value": player_value,
                "result": "bust",
                "hand_index": hand_index,
            })
        
        return {
            "action": "hit",
            "player_cards": [card.to_string() for card in player_cards],
            "player_value": player_value,
            "hand_index": hand_index,
            "active_hand_index": hand_index,
            "game_over": False
        }
    
    elif action == 'stand':
        return _advance_or_resolve("stand", {"hand_index": hand_index})
    
    elif action == 'double':
        # Double the bet and take exactly one more card, then settle this hand.
        if len(player_cards) != 2:
            raise HTTPException(status_code=400, detail="Can only double on first action")
        session['bet_amounts'][hand_index] = bet_amount * 2
        new_card = engine.deal_card()
        player_cards.append(new_card)
        player_value = engine.calculate_hand(player_cards)
        return _advance_or_resolve("double", {
            "player_cards": [card.to_string() for card in player_cards],
            "player_value": player_value,
            "bet_doubled": True,
            "hand_index": hand_index,
            "result": "bust" if player_value > 21 else None,
        })

    elif action == 'split':
        if hand_index != 0 or len(session['player_hands']) != 1:
            raise HTTPException(status_code=400, detail="Already split or invalid hand")
        if not engine.can_split(player_cards):
            raise HTTPException(status_code=400, detail="Hand cannot be split")
        try:
            hand_a, hand_b, bet_a, bet_b = engine.perform_split(player_cards, bet_amount)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        session['player_hands'] = [hand_a, hand_b]
        session['bet_amounts'] = [bet_a, bet_b]
        session['active_hand_index'] = 0
        session['can_split'] = False

        return {
            "action": "split",
            "player_hands": [
                [c.to_string() for c in hand_a],
                [c.to_string() for c in hand_b],
            ],
            "player_cards": [c.to_string() for c in hand_a],
            "player_values": [
                engine.calculate_hand(hand_a),
                engine.calculate_hand(hand_b),
            ],
            "player_value": engine.calculate_hand(hand_a),
            "bet_amounts": [bet_a, bet_b],
            "active_hand_index": 0,
            "can_split": False,
            "game_over": False,
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
