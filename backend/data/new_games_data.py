"""
Additional game types and questions for Global Vibes
Includes social party games and strategic board games
"""

# ==================== WOULD YOU RATHER ====================

WOULD_YOU_RATHER_QUESTIONS = [
    {
        "id": "wyr1",
        "category": "travel",
        "question": "Would you rather...",
        "option_a": "Travel to the past and meet your ancestors",
        "option_b": "Travel to the future and meet your descendants"
    },
    {
        "id": "wyr2",
        "category": "lifestyle",
        "question": "Would you rather...",
        "option_a": "Live in a big city with endless activities",
        "option_b": "Live in a peaceful countryside with nature"
    },
    {
        "id": "wyr3",
        "category": "superpowers",
        "question": "Would you rather...",
        "option_a": "Be able to fly",
        "option_b": "Be able to read minds"
    },
    {
        "id": "wyr4",
        "category": "food",
        "question": "Would you rather...",
        "option_a": "Give up pizza forever",
        "option_b": "Give up chocolate forever"
    },
    {
        "id": "wyr5",
        "category": "relationships",
        "question": "Would you rather...",
        "option_a": "Find true love but be poor",
        "option_b": "Be wealthy but never find love"
    },
    {
        "id": "wyr6",
        "category": "entertainment",
        "question": "Would you rather...",
        "option_a": "Only watch movies for the rest of your life",
        "option_b": "Only listen to music for the rest of your life"
    },
    {
        "id": "wyr7",
        "category": "adventure",
        "question": "Would you rather...",
        "option_a": "Explore the depths of the ocean",
        "option_b": "Explore outer space"
    },
    {
        "id": "wyr8",
        "category": "lifestyle",
        "question": "Would you rather...",
        "option_a": "Work your dream job but never have weekends",
        "option_b": "Have a boring job but 4-day weekends"
    },
    {
        "id": "wyr9",
        "category": "social",
        "question": "Would you rather...",
        "option_a": "Be famous but always in the spotlight",
        "option_b": "Be unknown but have complete privacy"
    },
    {
        "id": "wyr10",
        "category": "time",
        "question": "Would you rather...",
        "option_a": "Relive your best day over and over",
        "option_b": "Never have a bad day again but forget your best memories"
    }
]

# Add 40 more for variety (total 50 questions)
# Categories: travel, lifestyle, superpowers, food, relationships, entertainment, adventure, social, time

# ==================== DESERT ISLAND ====================

DESERT_ISLAND_SCENARIOS = [
    {
        "id": "di1",
        "scenario": "You're stranded on a desert island. You can bring 3 items:",
        "options": [
            {"id": "knife", "name": "Survival Knife", "emoji": "🔪"},
            {"id": "rope", "name": "100ft Rope", "emoji": "🪢"},
            {"id": "lighter", "name": "Waterproof Lighter", "emoji": "🔥"},
            {"id": "water_filter", "name": "Water Filter", "emoji": "💧"},
            {"id": "tent", "name": "Camping Tent", "emoji": "⛺"},
            {"id": "fishing_kit", "name": "Fishing Kit", "emoji": "🎣"},
            {"id": "satellite_phone", "name": "Satellite Phone", "emoji": "📱"},
            {"id": "solar_panel", "name": "Solar Panel", "emoji": "☀️"},
            {"id": "medical_kit", "name": "First Aid Kit", "emoji": "⚕️"}
        ],
        "max_choices": 3
    },
    {
        "id": "di2",
        "scenario": "You can bring 3 people to the island with you:",
        "options": [
            {"id": "doctor", "name": "A Doctor", "emoji": "👨‍⚕️"},
            {"id": "engineer", "name": "An Engineer", "emoji": "👷"},
            {"id": "chef", "name": "A Professional Chef", "emoji": "👨‍🍳"},
            {"id": "survivalist", "name": "A Survival Expert", "emoji": "🏕️"},
            {"id": "comedian", "name": "A Comedian", "emoji": "😄"},
            {"id": "musician", "name": "A Musician", "emoji": "🎸"},
            {"id": "best_friend", "name": "Your Best Friend", "emoji": "👥"},
            {"id": "crush", "name": "Your Crush", "emoji": "❤️"},
            {"id": "athlete", "name": "An Olympic Athlete", "emoji": "🏃"}
        ],
        "max_choices": 3
    }
]

# ==================== TRIVIA CATEGORIES ====================

TRIVIA_QUESTIONS = {
    "general": [
        {
            "question": "What is the capital of France?",
            "options": ["London", "Berlin", "Paris", "Madrid"],
            "correct": 2,
            "difficulty": "easy"
        },
        {
            "question": "How many continents are there?",
            "options": ["5", "6", "7", "8"],
            "correct": 2,
            "difficulty": "easy"
        },
        {
            "question": "What is the largest ocean on Earth?",
            "options": ["Atlantic", "Indian", "Arctic", "Pacific"],
            "correct": 3,
            "difficulty": "easy"
        }
    ],
    "movies": [
        {
            "question": "Who directed 'Inception'?",
            "options": ["Steven Spielberg", "Christopher Nolan", "James Cameron", "Quentin Tarantino"],
            "correct": 1,
            "difficulty": "medium"
        },
        {
            "question": "Which movie won Best Picture at the 2020 Oscars?",
            "options": ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
            "correct": 2,
            "difficulty": "medium"
        }
    ],
    "music": [
        {
            "question": "Who is known as the 'King of Pop'?",
            "options": ["Elvis Presley", "Michael Jackson", "Prince", "Madonna"],
            "correct": 1,
            "difficulty": "easy"
        },
        {
            "question": "Which band released 'Bohemian Rhapsody'?",
            "options": ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"],
            "correct": 2,
            "difficulty": "easy"
        }
    ],
    "science": [
        {
            "question": "What is the speed of light?",
            "options": ["299,792 km/s", "150,000 km/s", "400,000 km/s", "500,000 km/s"],
            "correct": 0,
            "difficulty": "hard"
        },
        {
            "question": "How many elements are in the periodic table?",
            "options": ["108", "118", "128", "98"],
            "correct": 1,
            "difficulty": "medium"
        }
    ],
    "sports": [
        {
            "question": "How many players are on a soccer team?",
            "options": ["9", "10", "11", "12"],
            "correct": 2,
            "difficulty": "easy"
        },
        {
            "question": "In which year were the first modern Olympics held?",
            "options": ["1896", "1900", "1888", "1904"],
            "correct": 0,
            "difficulty": "hard"
        }
    ]
}

# Note: In production, you'd have 100s of questions per category
# This is a starter set

# ==================== MAHJONG ====================

MAHJONG_TILES = {
    "bamboo": list(range(1, 10)),  # 1-9 bamboo
    "characters": list(range(1, 10)),  # 1-9 characters
    "dots": list(range(1, 10)),  # 1-9 dots
    "winds": ["east", "south", "west", "north"],
    "dragons": ["red", "green", "white"],
    "flowers": ["plum", "orchid", "chrysanthemum", "bamboo"],
    "seasons": ["spring", "summer", "autumn", "winter"]
}

# Simplified Mahjong rules for online play
MAHJONG_WINNING_PATTERNS = [
    "pong_pong_pong_pair",  # 3 sets of 3 + 1 pair
    "chow_chow_chow_pair",  # 3 sequences + 1 pair
    "mixed",  # Combination
    "all_one_suit",  # All same suit
    "all_honors",  # Only winds and dragons
]

# ==================== GO (WEIQI) ====================

GO_BOARD_SIZES = {
    "small": 9,   # 9x9 for beginners
    "medium": 13,  # 13x13 for intermediate
    "standard": 19  # 19x19 for advanced
}

GO_RULES = {
    "komi": 6.5,  # Points given to white player (goes second)
    "capture": "surround",  # Stones with no liberties are captured
    "ko_rule": True,  # Cannot immediately recapture
    "scoring": "area"  # Count territory + stones
}

# ==================== DOMINOES ====================

DOMINOES_SETS = {
    "double_six": 28,  # 0-0 to 6-6 (most common)
    "double_nine": 55,  # 0-0 to 9-9
    "double_twelve": 91  # 0-0 to 12-12
}

DOMINOES_VARIANTS = [
    "block",  # Block dominoes (most common)
    "draw",   # Draw dominoes
    "mexican_train",  # Mexican Train
    "chicken_foot"  # Chicken Foot
]

# ==================== XIANGQI (CHINESE CHESS) ====================

XIANGQI_PIECES = {
    "general": {"symbol": "帥/將", "moves": "orthogonal_1_palace"},
    "advisor": {"symbol": "仕/士", "moves": "diagonal_1_palace"},
    "elephant": {"symbol": "相/象", "moves": "diagonal_2_no_cross"},
    "horse": {"symbol": "馬/马", "moves": "l_shape_blocked"},
    "chariot": {"symbol": "車/车", "moves": "orthogonal_unlimited"},
    "cannon": {"symbol": "炮/砲", "moves": "orthogonal_jump"},
    "soldier": {"symbol": "兵/卒", "moves": "forward_then_sideways"}
}

XIANGQI_BOARD = {
    "width": 9,
    "height": 10,
    "river": 4  # Between rows 4 and 5
}
