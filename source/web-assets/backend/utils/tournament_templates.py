"""
Tournament templates — auto-scheduled by the tournament_engine scheduler.

Each template describes a recurring tournament. The scheduler instantiates
them at their scheduled times. Templates are seeded on backend startup into
the `tournament_templates` collection; admins can add/edit more later.

Scoring rules per round:
    - spades: bid_made_bonus + trick_bonus - bag_penalty
    - blackjack: net_coin_p_and_l (over 3 rounds, 10K starting)
    - poker: hand_strength * chips_won
    - rummy: 100 - final_deadwood (capped ≥ 0)
    - bid_whist: bid * 10 + hand_made_bonus
    - hearts: 100 - points_taken (shooting-the-moon = 100)
    - uno: 200 - turns_to_empty (capped ≥ 0)
    - gin_rummy: opponent_deadwood (knock differential)
    - go_fish: books_collected * 15
    - crazy_eights: 150 - cards_in_hand_at_end * 5
    - war: rounds_survived_or_won
"""
from typing import List, Dict, Any

# Map of tournament_type → list of rounds
SOLO_GAUNTLET_ROUNDS = [
    {"round": 1, "game": "spades",    "scoring": "spades_score",    "time_limit_sec": 300},
    {"round": 2, "game": "blackjack", "scoring": "blackjack_pnl",   "time_limit_sec": 180},
    {"round": 3, "game": "poker",     "scoring": "poker_stack",     "time_limit_sec": 360},
    {"round": 4, "game": "rummy",     "scoring": "rummy_deadwood",  "time_limit_sec": 300},
    {"round": 5, "game": "bid_whist", "scoring": "bid_whist_score", "time_limit_sec": 420},
]

# NEW — full-roster marathon covering all 9 card games
NINE_CARD_MARATHON_ROUNDS = [
    {"round": 1, "game": "war",          "scoring": "war_rounds",       "time_limit_sec": 180},
    {"round": 2, "game": "go_fish",      "scoring": "gofish_books",     "time_limit_sec": 240},
    {"round": 3, "game": "crazy_eights", "scoring": "crazyeights_empty","time_limit_sec": 240},
    {"round": 4, "game": "hearts",       "scoring": "hearts_avoid",     "time_limit_sec": 300},
    {"round": 5, "game": "uno",          "scoring": "uno_speed",        "time_limit_sec": 240},
    {"round": 6, "game": "spades",       "scoring": "spades_score",     "time_limit_sec": 300},
    {"round": 7, "game": "gin_rummy",    "scoring": "gin_knock",        "time_limit_sec": 360},
    {"round": 8, "game": "rummy",        "scoring": "rummy_deadwood",   "time_limit_sec": 300},
    {"round": 9, "game": "bid_whist",    "scoring": "bid_whist_score",  "time_limit_sec": 420},
]

MINI_TOUR_ROUNDS = [
    {"round": 1, "game": "spades",    "scoring": "spades_score",   "time_limit_sec": 240},
    {"round": 2, "game": "blackjack", "scoring": "blackjack_pnl",  "time_limit_sec": 120},
    {"round": 3, "game": "bid_whist", "scoring": "bid_whist_score","time_limit_sec": 300},
]

# Scheduled tournament templates
TEMPLATES: List[Dict[str, Any]] = [
    {
        "template_id": "daily_royale",
        "name": "Daily Card Royale",
        "format": "solo_gauntlet",
        "rounds": SOLO_GAUNTLET_ROUNDS,
        "schedule_cron": "daily@20:00",
        "duration_hours": 4,          # window to enter + complete
        "free_daily_entry": True,     # 1 free entry per user per day
        "retry_buy_in_coins": 500,
        "prize_pool_seed_vibez": 500.0,
        "prize_pool_seed_coins": 2500,
        "prize_split": [0.70, 0.20, 0.10],
        "max_participants": 5000,
        "description": "Free daily 5-round gauntlet across every card game. Top the ladder in 24h.",
    },
    {
        "template_id": "spades_hour",
        "name": "Spades Hour",
        "format": "solo_sprint",
        "rounds": [{"round": 1, "game": "spades", "scoring": "spades_score", "time_limit_sec": 300}],
        "schedule_cron": "daily@19:00",
        "duration_hours": 1,
        "free_daily_entry": True,
        "retry_buy_in_coins": 250,
        "prize_pool_seed_vibez": 150.0,
        "prize_pool_seed_coins": 1000,
        "prize_split": [0.60, 0.25, 0.15],
        "max_participants": 2000,
        "description": "One-hour Spades sprint. Best hand-score wins.",
    },
    {
        "template_id": "weekend_bracket",
        "name": "Weekend 16-Player Bracket",
        "format": "bracket_16",
        "rounds": [
            {"round": 1, "game": "spades",    "scoring": "spades_score",   "pod": "pod_A"},
            {"round": 1, "game": "blackjack", "scoring": "blackjack_pnl",  "pod": "pod_B"},
            {"round": 1, "game": "poker",     "scoring": "poker_stack",    "pod": "pod_C"},
            {"round": 1, "game": "rummy",     "scoring": "rummy_deadwood", "pod": "pod_D"},
            {"round": 2, "game": "bid_whist", "scoring": "bid_whist_score"},
        ],
        "schedule_cron": "weekly@sat@21:00",
        "duration_hours": 3,
        "free_daily_entry": False,
        "retry_buy_in_coins": 2000,
        "prize_pool_seed_vibez": 5000.0,
        "prize_pool_seed_coins": 25000,
        "prize_split": [0.50, 0.25, 0.15, 0.10],
        "max_participants": 16,
        "description": "16 players across 4 pods. Bot-filled if not full. Grand Final at Bid Whist Platinum.",
    },
    {
        "template_id": "mini_tour_rapid",
        "name": "Rapid Mini Tour",
        "format": "mini_tour",
        "rounds": MINI_TOUR_ROUNDS,
        "schedule_cron": "every_2h",
        "duration_hours": 2,
        "free_daily_entry": True,
        "retry_buy_in_coins": 100,
        "prize_pool_seed_vibez": 75.0,
        "prize_pool_seed_coins": 500,
        "prize_split": [0.65, 0.25, 0.10],
        "max_participants": 1000,
        "description": "3-round flash tour every 2 hours. Keep the game flow moving.",
    },
    {
        "template_id": "nine_card_marathon",
        "name": "9-Card Marathon",
        "format": "marathon",
        "rounds": NINE_CARD_MARATHON_ROUNDS,
        "schedule_cron": "weekly@sun@18:00",
        "duration_hours": 6,
        "free_daily_entry": False,
        "retry_buy_in_coins": 1500,
        "prize_pool_seed_vibez": 10000.0,
        "prize_pool_seed_coins": 50000,
        "prize_split": [0.50, 0.25, 0.15, 0.07, 0.03],
        "max_participants": 2500,
        "description": "Every card game we've got, back-to-back. Sunday night, 6-hour window. Top 5 prize pool.",
    },
    {
        "template_id": "card_royale_variety",
        "name": "Card Royale: Variety Edition",
        "format": "solo_gauntlet",
        # Swaps in hearts + uno + gin_rummy alongside the classics so the
        # daily grind doesn't get stale for long-time players.
        "rounds": [
            {"round": 1, "game": "hearts",    "scoring": "hearts_avoid",     "time_limit_sec": 300},
            {"round": 2, "game": "uno",       "scoring": "uno_speed",        "time_limit_sec": 240},
            {"round": 3, "game": "gin_rummy", "scoring": "gin_knock",        "time_limit_sec": 360},
            {"round": 4, "game": "spades",    "scoring": "spades_score",     "time_limit_sec": 300},
            {"round": 5, "game": "blackjack", "scoring": "blackjack_pnl",    "time_limit_sec": 180},
        ],
        "schedule_cron": "daily@23:00",
        "duration_hours": 4,
        "free_daily_entry": True,
        "retry_buy_in_coins": 500,
        "prize_pool_seed_vibez": 500.0,
        "prize_pool_seed_coins": 2500,
        "prize_split": [0.70, 0.20, 0.10],
        "max_participants": 5000,
        "description": "Late-night variant of the daily gauntlet. Runs 11pm. Features Hearts + UNO + Gin Rummy.",
    },
]


def seed_templates(db) -> int:
    """Idempotently insert/update templates on boot."""
    import asyncio
    async def _seed():
        count = 0
        for tpl in TEMPLATES:
            await db.tournament_templates.update_one(
                {"template_id": tpl["template_id"]},
                {"$set": tpl},
                upsert=True,
            )
            count += 1
        return count
    if asyncio.get_event_loop().is_running():
        return asyncio.create_task(_seed())  # fire-and-forget during startup
    return asyncio.run(_seed())
