"""
Progressive A/B/C profile questions for dating + gaming matchmaking.

Designed for tap-only answers (no free typing). Batched so each return
visit can surface a few unanswered questions without dumping a long form.
"""

from typing import Any, Dict, List

# Batches of 3 — one visit = one batch until bank is exhausted.
ABC_PROFILE_QUESTIONS: List[Dict[str, Any]] = [
    # ——— Batch 0: vibe & energy ———
    {
        "id": "abc_energy",
        "batch": 0,
        "category": "personality",
        "domain": "dating",
        "question": "On a free Friday night, you usually want…",
        "emoji": "🌙",
        "options": [
            {"id": "a", "text": "A low-key hang — games, food, good talk", "traits": ["chill", "intimate"]},
            {"id": "b", "text": "Something social — friends, music, a crowd", "traits": ["outgoing", "social"]},
            {"id": "c", "text": "An adventure — new place, spontaneous plan", "traits": ["adventurous", "spontaneous"]},
        ],
    },
    {
        "id": "abc_conflict",
        "batch": 0,
        "category": "values",
        "domain": "dating",
        "question": "When something feels off with a date, you…",
        "emoji": "💬",
        "options": [
            {"id": "a", "text": "Say it gently and clear the air", "traits": ["direct", "honest"]},
            {"id": "b", "text": "Take a beat, then talk when calm", "traits": ["thoughtful", "patient"]},
            {"id": "c", "text": "Keep it light and change the subject", "traits": ["easygoing", "peacemaker"]},
        ],
    },
    {
        "id": "abc_first_date",
        "batch": 0,
        "category": "dating_style",
        "domain": "dating",
        "question": "Ideal first date vibe?",
        "emoji": "✨",
        "options": [
            {"id": "a", "text": "Coffee or a walk — easy and real", "traits": ["casual", "authentic"]},
            {"id": "b", "text": "Play a game together — see the chemistry", "traits": ["playful", "gamer"]},
            {"id": "c", "text": "Dinner or an activity with a plan", "traits": ["intentional", "classic"]},
        ],
    },
    # ——— Batch 1: gaming ———
    {
        "id": "abc_game_style",
        "batch": 1,
        "category": "gaming",
        "domain": "gaming",
        "question": "When you play with someone new, you are mostly…",
        "emoji": "🎮",
        "options": [
            {"id": "a", "text": "Competitive — I like to win", "traits": ["competitive"], "gaming_style": "competitive"},
            {"id": "b", "text": "Casual — vibes over scoreboard", "traits": ["casual", "chill"], "gaming_style": "casual"},
            {"id": "c", "text": "Strategic — I love the puzzle", "traits": ["strategic", "intelligent"], "gaming_style": "strategic"},
        ],
    },
    {
        "id": "abc_lose",
        "batch": 1,
        "category": "gaming",
        "domain": "gaming",
        "question": "You just lost a close game. Your move?",
        "emoji": "🃏",
        "options": [
            {"id": "a", "text": "Rematch — right now", "traits": ["competitive", "resilient"]},
            {"id": "b", "text": "Laugh it off and switch games", "traits": ["easygoing", "social"]},
            {"id": "c", "text": "Talk through what happened, then play again", "traits": ["strategic", "thoughtful"]},
        ],
    },
    {
        "id": "abc_table",
        "batch": 1,
        "category": "gaming",
        "domain": "gaming",
        "question": "Best table energy for you?",
        "emoji": "🪑",
        "options": [
            {"id": "a", "text": "Trash talk and big plays", "traits": ["bold", "competitive"]},
            {"id": "b", "text": "Chill playlist and easy conversation", "traits": ["chill", "social"]},
            {"id": "c", "text": "Focused — quiet until the clutch moment", "traits": ["focused", "strategic"]},
        ],
    },
    # ——— Batch 2: relationship goals (ABC, no typing) ———
    {
        "id": "abc_intent",
        "batch": 2,
        "category": "relationship",
        "domain": "dating",
        "question": "Right now you are looking for…",
        "emoji": "💕",
        "options": [
            {"id": "a", "text": "Something casual and fun", "traits": ["casual"], "relationship_goals": "casual"},
            {"id": "b", "text": "A serious relationship", "traits": ["loyal", "serious"], "relationship_goals": "serious"},
            {"id": "c", "text": "Friends first — see where it goes", "traits": ["patient", "friendly"], "relationship_goals": "friends"},
        ],
    },
    {
        "id": "abc_pace",
        "batch": 2,
        "category": "relationship",
        "domain": "dating",
        "question": "How fast do you like things to move?",
        "emoji": "⏱️",
        "options": [
            {"id": "a", "text": "Slow burn — build trust first", "traits": ["patient", "thoughtful"]},
            {"id": "b", "text": "Natural pace — no rush, no stalling", "traits": ["balanced"]},
            {"id": "c", "text": "If the spark is there, lean in", "traits": ["spontaneous", "bold"]},
        ],
    },
    {
        "id": "abc_love_lang",
        "batch": 2,
        "category": "values",
        "domain": "dating",
        "question": "You feel most cared for when someone…",
        "emoji": "🫶",
        "options": [
            {"id": "a", "text": "Shows up with time and attention", "traits": ["caring", "loyal"]},
            {"id": "b", "text": "Says what they mean, clearly", "traits": ["honest", "direct"]},
            {"id": "c", "text": "Plans fun stuff and little surprises", "traits": ["playful", "romantic"]},
        ],
    },
    # ——— Batch 3: lifestyle & humor ———
    {
        "id": "abc_humor",
        "batch": 3,
        "category": "personality",
        "domain": "dating",
        "question": "Your humor style is closest to…",
        "emoji": "😂",
        "options": [
            {"id": "a", "text": "Dry / witty one-liners", "traits": ["witty", "intelligent"]},
            {"id": "b", "text": "Playful chaos and memes", "traits": ["funny", "outgoing"]},
            {"id": "c", "text": "Warm, silly, never mean", "traits": ["kind", "caring"]},
        ],
    },
    {
        "id": "abc_morning",
        "batch": 3,
        "category": "lifestyle",
        "domain": "dating",
        "question": "Mornings for you are…",
        "emoji": "☀️",
        "options": [
            {"id": "a", "text": "Early bird — coffee and a plan", "traits": ["ambitious", "organized"]},
            {"id": "b", "text": "Flexible — depends on the day", "traits": ["balanced", "chill"]},
            {"id": "c", "text": "Night owl recovering — soft start", "traits": ["chill", "creative"]},
        ],
    },
    {
        "id": "abc_deal",
        "batch": 3,
        "category": "values",
        "domain": "dating",
        "question": "Biggest green flag on a profile?",
        "emoji": "🟢",
        "options": [
            {"id": "a", "text": "Kindness and emotional maturity", "traits": ["kind", "loyal"]},
            {"id": "b", "text": "Ambition and drive", "traits": ["ambitious", "confident"]},
            {"id": "c", "text": "Playfulness and game chemistry", "traits": ["playful", "gamer"]},
        ],
    },
    # ——— Batch 4: social + culture ———
    {
        "id": "abc_group",
        "batch": 4,
        "category": "social",
        "domain": "dating",
        "question": "Best hang size?",
        "emoji": "👥",
        "options": [
            {"id": "a", "text": "Just the two of us", "traits": ["intimate", "focused"]},
            {"id": "b", "text": "Small crew (3–5)", "traits": ["social", "balanced"]},
            {"id": "c", "text": "Bigger group energy", "traits": ["outgoing", "social"]},
        ],
    },
    {
        "id": "abc_culture",
        "batch": 4,
        "category": "culture",
        "domain": "dating",
        "question": "Sharing culture / food / traditions on a date feels…",
        "emoji": "🌍",
        "options": [
            {"id": "a", "text": "Essential — I want that exchange", "traits": ["cultural", "open"]},
            {"id": "b", "text": "Nice when it happens naturally", "traits": ["open", "balanced"]},
            {"id": "c", "text": "Secondary — chemistry first", "traits": ["chemistry_first"]},
        ],
    },
    {
        "id": "abc_text",
        "batch": 4,
        "category": "communication",
        "domain": "dating",
        "question": "Between dates, you prefer…",
        "emoji": "📱",
        "options": [
            {"id": "a", "text": "Daily check-ins and banter", "traits": ["expressive", "loyal"]},
            {"id": "b", "text": "A few solid messages, no spam", "traits": ["balanced", "thoughtful"]},
            {"id": "c", "text": "Light touch until we hang again", "traits": ["independent", "chill"]},
        ],
    },
]


def questions_by_id() -> Dict[str, Dict[str, Any]]:
    return {q["id"]: q for q in ABC_PROFILE_QUESTIONS}


def get_batch(batch: int) -> List[Dict[str, Any]]:
    return [q for q in ABC_PROFILE_QUESTIONS if q["batch"] == batch]


def max_batch() -> int:
    return max(q["batch"] for q in ABC_PROFILE_QUESTIONS)
