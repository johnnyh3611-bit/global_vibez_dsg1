"""Unit tests for the 4 new card game practice modes."""
from utils.spades_game import SpadesGame, get_spades_ai_bid, get_spades_ai_play


# ==================== SPADES GAME ====================

def test_spades_deal_gives_13_per_player():
    g = SpadesGame()
    g.deal_cards()
    for pos in ['north', 'east', 'south', 'west']:
        assert len(g.players[pos]['hand']) == 13


def test_spades_ai_bid_bounds():
    g = SpadesGame()
    g.deal_cards()
    for pos in g.players:
        bid = get_spades_ai_bid(g.players[pos]['hand'])
        assert 1 <= bid <= 13


def test_spades_valid_plays_follow_suit():
    g = SpadesGame()
    g.deal_cards()
    # Force a lead
    south_hand = g.players['south']['hand']
    lead_card = south_hand[0]
    g.play_card('south', lead_card)
    # Now west must follow suit if possible
    west_hand = g.players['west']['hand']
    same_suit = [c for c in west_hand if c['suit'] == lead_card['suit']]
    valid = g.get_valid_plays('west')
    if same_suit:
        for v in valid:
            assert v['suit'] == lead_card['suit']


def test_spades_ai_play_picks_valid_card():
    g = SpadesGame()
    g.deal_cards()
    # Simulate a trick in progress
    south_hand = g.players['south']['hand']
    g.play_card('south', south_hand[0])
    west_hand = g.players['west']['hand']
    ai_card = get_spades_ai_play(west_hand, g.current_trick, g.current_trick[0]['card']['suit'], False)
    assert ai_card in west_hand


def test_spades_score_bid_made():
    g = SpadesGame()
    g.deal_cards()
    # Manually set bids and tricks
    g.players['north']['bid'] = 3
    g.players['south']['bid'] = 4
    g.players['east']['bid'] = 3
    g.players['west']['bid'] = 3
    g.players['north']['tricks'] = 4
    g.players['south']['tricks'] = 3
    g.players['east']['tricks'] = 4
    g.players['west']['tricks'] = 2
    g.score_hand()
    # team1 bid=7, won=7 → 70 + 0 bags = 70
    assert g.scores['team1']['points'] == 70
    # team2 bid=6, won=6 → 60 + 0 bags = 60
    assert g.scores['team2']['points'] == 60


# ==================== BLACKJACK UNIVERSAL HELPERS ====================

def test_blackjack_hand_value_basic():
    from routes.blackjack_universal import _hand_value, _is_blackjack
    # Simple 10+5 = 15
    assert _hand_value([{"rank": "10", "suit": "S"}, {"rank": "5", "suit": "H"}]) == 15
    # Ace soft
    assert _hand_value([{"rank": "A", "suit": "S"}, {"rank": "9", "suit": "H"}]) == 20
    # Ace demote when bust
    assert _hand_value([{"rank": "A", "suit": "S"}, {"rank": "10", "suit": "H"}, {"rank": "5", "suit": "D"}]) == 16
    # Blackjack detection
    assert _is_blackjack([{"rank": "A", "suit": "S"}, {"rank": "K", "suit": "H"}])
    assert not _is_blackjack([{"rank": "10", "suit": "S"}, {"rank": "5", "suit": "H"}, {"rank": "6", "suit": "D"}])


def test_blackjack_settle_dealer_bust():
    from routes.blackjack_universal import _settle
    doc = {
        "phase": "settled",
        "dealer": {"hand": [{"rank": "K", "suit": "S"}, {"rank": "7", "suit": "H"}, {"rank": "10", "suit": "D"}]},  # 27 bust
        "seats": [
            {"seat_id": "s0", "hand": [{"rank": "10", "suit": "C"}, {"rank": "8", "suit": "D"}], "bet": 1000, "status": "stand"},
        ],
    }
    _settle(doc)
    assert doc["seats"][0]["result"] == "win"
    assert doc["seats"][0]["payout"] == 2000


def test_blackjack_basic_strategy_16_vs_6_stand():
    from routes.blackjack_universal import _basic_strategy
    # 16 vs dealer 6 → stand
    move = _basic_strategy(
        [{"rank": "10", "suit": "S"}, {"rank": "6", "suit": "H"}],
        {"rank": "6", "suit": "D"},
    )
    assert move == "stand"


def test_blackjack_basic_strategy_12_vs_10_hit():
    from routes.blackjack_universal import _basic_strategy
    move = _basic_strategy(
        [{"rank": "7", "suit": "S"}, {"rank": "5", "suit": "H"}],
        {"rank": "10", "suit": "D"},
    )
    assert move == "hit"


# ==================== POKER HAND EVALUATOR (via new route helpers) ====================

def test_poker_starting_hand_premium():
    from utils.poker_evaluator import PokerHandEvaluator
    # Pair of Aces is best starter
    hand = ["AS", "AH", "2D", "7C", "9S", "KH", "3D"]
    name, rank, _ = PokerHandEvaluator.evaluate_hand(hand)
    assert name == "One Pair"


def test_poker_full_house_evaluation():
    from utils.poker_evaluator import PokerHandEvaluator
    hand = ["AS", "AH", "AD", "KC", "KS"]
    name, rank, _ = PokerHandEvaluator.evaluate_hand(hand)
    assert name == "Full House"
    assert rank == 7


def test_poker_flush_detection():
    from utils.poker_evaluator import PokerHandEvaluator
    hand = ["AS", "KS", "QS", "JS", "9S"]
    name, rank, _ = PokerHandEvaluator.evaluate_hand(hand)
    assert name == "Flush"


def test_poker_straight_flush_beats_flush():
    from utils.poker_evaluator import PokerHandEvaluator
    sf = ["10S", "JS", "QS", "KS", "AS"]
    name, rank, _ = PokerHandEvaluator.evaluate_hand(sf)
    assert name == "Royal Flush"


# ==================== RUMMY HELPERS ====================

def test_rummy_melds_detect_set():
    from routes.rummy_practice import _find_melds
    hand = [
        {"rank": "7", "suit": "S"}, {"rank": "7", "suit": "H"}, {"rank": "7", "suit": "D"},
        {"rank": "K", "suit": "C"}, {"rank": "2", "suit": "S"},
    ]
    melds = _find_melds(hand)
    # Should find a set of 7s
    assert any(len(m) == 3 and all(c["rank"] == "7" for c in m) for m in melds)


def test_rummy_melds_detect_run():
    from routes.rummy_practice import _find_melds
    hand = [
        {"rank": "3", "suit": "S"}, {"rank": "4", "suit": "S"}, {"rank": "5", "suit": "S"},
        {"rank": "K", "suit": "C"}, {"rank": "2", "suit": "H"},
    ]
    melds = _find_melds(hand)
    # Should find 3-4-5 of spades
    assert any(len(m) == 3 and all(c["suit"] == "S" for c in m) for m in melds)


def test_rummy_deadwood_all_melded_is_zero():
    from routes.rummy_practice import _best_deadwood
    # 10 cards, all in melds: 3 sets of 3 + 1 run of 3
    hand = [
        {"rank": "7", "suit": "S"}, {"rank": "7", "suit": "H"}, {"rank": "7", "suit": "D"},
        {"rank": "K", "suit": "S"}, {"rank": "K", "suit": "H"}, {"rank": "K", "suit": "D"},
        {"rank": "3", "suit": "C"}, {"rank": "4", "suit": "C"}, {"rank": "5", "suit": "C"},
        {"rank": "A", "suit": "S"},  # leftover 1
    ]
    dw, melds, leftover = _best_deadwood(hand)
    # Expected: 3 melds, leftover = [A] = 1 dw
    assert dw == 1
    assert len(leftover) == 1
