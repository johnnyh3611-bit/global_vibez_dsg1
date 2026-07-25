"""Content packs for Date Night Sessions — soft warm-ups + Build-a-Night."""
from __future__ import annotations

from typing import Any, Dict, List

SOFT_WYR: List[Dict[str, Any]] = [
    {
        "id": "soft_wyr_1",
        "question": "Would you rather cook together or order in and talk?",
        "option_a": "Cook together",
        "option_b": "Order in",
        "category": "vibe",
    },
    {
        "id": "soft_wyr_2",
        "question": "Would you rather a quiet café or a lively rooftop?",
        "option_a": "Quiet café",
        "option_b": "Lively rooftop",
        "category": "place",
    },
    {
        "id": "soft_wyr_3",
        "question": "Would you rather swap playlists or swap travel stories?",
        "option_a": "Swap playlists",
        "option_b": "Travel stories",
        "category": "talk",
    },
    {
        "id": "soft_wyr_4",
        "question": "Would you rather early dinner + walk or late night + dessert?",
        "option_a": "Early dinner + walk",
        "option_b": "Late night + dessert",
        "category": "timing",
    },
    {
        "id": "soft_wyr_5",
        "question": "Would you rather competitive games or co-op vibes?",
        "option_a": "Competitive",
        "option_b": "Co-op",
        "category": "play",
    },
]

BUILD_A_NIGHT_STEPS: List[Dict[str, Any]] = [
    {
        "id": "ban_vibe",
        "key": "vibe",
        "prompt": "What's the vibe for this night?",
        "options": [
            {"id": "cozy", "label": "Cozy & low-key"},
            {"id": "adventurous", "label": "Adventurous"},
            {"id": "glam", "label": "A little glam"},
            {"id": "playful", "label": "Playful / silly"},
        ],
    },
    {
        "id": "ban_food",
        "key": "food",
        "prompt": "Food first — what sounds right?",
        "options": [
            {"id": "casual", "label": "Casual bites"},
            {"id": "nice_dinner", "label": "Nice dinner"},
            {"id": "street", "label": "Street food crawl"},
            {"id": "dessert", "label": "Dessert-only date"},
        ],
    },
    {
        "id": "ban_budget",
        "key": "budget",
        "prompt": "Budget lane?",
        "options": [
            {"id": "$", "label": "$  Keep it light"},
            {"id": "$$", "label": "$$  Comfortable"},
            {"id": "$$$", "label": "$$$  Splurge"},
        ],
    },
    {
        "id": "ban_time",
        "key": "time",
        "prompt": "When are we locking this in?",
        "options": [
            {"id": "weeknight", "label": "Weeknight after work"},
            {"id": "friday", "label": "Friday night"},
            {"id": "saturday", "label": "Saturday afternoon → night"},
            {"id": "sunday", "label": "Sunday soft launch"},
        ],
    },
    {
        "id": "ban_activity",
        "key": "activity",
        "prompt": "What should we do after food?",
        "options": [
            {"id": "walk", "label": "Walk + talk"},
            {"id": "cinema", "label": "Cinema / co-watch"},
            {"id": "games", "label": "Play online together"},
            {"id": "live", "label": "Live music / show"},
        ],
    },
]

ARENA_GAMES: Dict[str, Dict[str, Any]] = {
    "tictactoe": {
        "name": "Tic-Tac-Toe",
        "label": "Marble Arena",
        "duration": "2–4 min",
        "description": "Clean marble grid. First to three — tournament tempo.",
    },
    "connect4": {
        "name": "Connect 4",
        "label": "Navy Felt Arena",
        "duration": "4–8 min",
        "description": "Glass discs. Drop with intent.",
    },
    "chess": {
        "name": "Chess",
        "label": "Walnut Table",
        "duration": "10–20 min",
        "description": "Wood & brass. Slow burn, high stakes.",
    },
}

DATE_NIGHT_PACKS: Dict[str, Dict[str, Any]] = {
    "warm_up": {
        "id": "warm_up",
        "name": "Warm-Up Pack",
        "tagline": "Soft WYR → icebreakers → chemistry reveal",
        "phases": ["soft_wyr", "icebreaker", "chemistry"],
        "headline": False,
    },
    "build_a_night": {
        "id": "build_a_night",
        "name": "Build-a-Night",
        "tagline": "Design the date together — AI planner finishes it",
        "phases": ["build_a_night", "chemistry", "planner"],
        "headline": True,
    },
    "full_arc": {
        "id": "full_arc",
        "name": "Full Date Night Arc",
        "tagline": "Warm-up → Build-a-Night → chemistry → plan",
        "phases": ["soft_wyr", "icebreaker", "build_a_night", "chemistry", "planner"],
        "headline": False,
    },
    "arena_tictactoe": {
        "id": "arena_tictactoe",
        "name": "Arena · Tic-Tac-Toe",
        "tagline": ARENA_GAMES["tictactoe"]["description"],
        "phases": ["board", "chemistry"],
        "board_game": "tictactoe",
        "headline": False,
    },
    "arena_connect4": {
        "id": "arena_connect4",
        "name": "Arena · Connect 4",
        "tagline": ARENA_GAMES["connect4"]["description"],
        "phases": ["board", "chemistry"],
        "board_game": "connect4",
        "headline": False,
    },
    "arena_chess": {
        "id": "arena_chess",
        "name": "Arena · Chess",
        "tagline": ARENA_GAMES["chess"]["description"],
        "phases": ["board", "chemistry"],
        "board_game": "chess",
        "headline": False,
    },
}
