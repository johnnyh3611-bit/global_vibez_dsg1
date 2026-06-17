"""
Compatibility Quiz Questions
Two separate quizzes: Friends and Dating
"""

FRIENDS_QUIZ = [
    {
        "id": "f1",
        "question": "What's your ideal way to spend a Saturday?",
        "category": "lifestyle",
        "options": [
            {"id": "a", "text": "Outdoor adventure (hiking, sports, exploring)", "value": "active"},
            {"id": "b", "text": "Cozy indoor activities (movies, games, cooking)", "value": "indoor"},
            {"id": "c", "text": "Social events (parties, bars, gatherings)", "value": "social"},
            {"id": "d", "text": "Creative pursuits (art, music, writing)", "value": "creative"}
        ],
        "emoji": "🎯"
    },
    {
        "id": "f2",
        "question": "Are you more of an introvert or extrovert?",
        "category": "personality",
        "options": [
            {"id": "a", "text": "Total introvert - I need alone time to recharge", "value": "introvert"},
            {"id": "b", "text": "Mostly introverted with occasional social bursts", "value": "mild_introvert"},
            {"id": "c", "text": "Balanced - I enjoy both equally", "value": "ambivert"},
            {"id": "d", "text": "Extrovert - I thrive around people", "value": "extrovert"}
        ],
        "emoji": "🧠"
    },
    {
        "id": "f3",
        "question": "What's your preferred group size for hanging out?",
        "category": "social",
        "options": [
            {"id": "a", "text": "One-on-one is perfect", "value": "one_on_one"},
            {"id": "b", "text": "Small group (3-5 people)", "value": "small_group"},
            {"id": "c", "text": "Medium group (6-10 people)", "value": "medium_group"},
            {"id": "d", "text": "The more the merrier!", "value": "large_group"}
        ],
        "emoji": "👥"
    },
    {
        "id": "f4",
        "question": "What type of music gets you moving?",
        "category": "entertainment",
        "options": [
            {"id": "a", "text": "Pop, Top 40, Dance", "value": "pop"},
            {"id": "b", "text": "Rock, Alternative, Indie", "value": "rock"},
            {"id": "c", "text": "Hip-Hop, R&B, Rap", "value": "hiphop"},
            {"id": "d", "text": "Electronic, EDM, House", "value": "electronic"},
            {"id": "e", "text": "Jazz, Classical, Acoustic", "value": "acoustic"}
        ],
        "emoji": "🎵"
    },
    {
        "id": "f5",
        "question": "How do you handle conflicts with friends?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Address it immediately and talk it out", "value": "direct"},
            {"id": "b", "text": "Give space, then discuss when calm", "value": "thoughtful"},
            {"id": "c", "text": "Try to smooth things over and move on", "value": "peacemaker"},
            {"id": "d", "text": "Avoid confrontation if possible", "value": "avoider"}
        ],
        "emoji": "💬"
    },
    {
        "id": "f6",
        "question": "What's your ideal vacation style?",
        "category": "interests",
        "options": [
            {"id": "a", "text": "Beach relaxation and spa days", "value": "relaxation"},
            {"id": "b", "text": "Adventure and extreme activities", "value": "adventure"},
            {"id": "c", "text": "Cultural exploration and museums", "value": "cultural"},
            {"id": "d", "text": "City nightlife and food tours", "value": "urban"}
        ],
        "emoji": "✈️"
    },
    {
        "id": "f7",
        "question": "How spontaneous are you?",
        "category": "lifestyle",
        "options": [
            {"id": "a", "text": "Very planned - I like schedules", "value": "planner"},
            {"id": "b", "text": "Mostly planned with some flexibility", "value": "flexible_planner"},
            {"id": "c", "text": "Go with the flow", "value": "spontaneous"},
            {"id": "d", "text": "Super spontaneous - last-minute everything!", "value": "very_spontaneous"}
        ],
        "emoji": "🎲"
    },
    {
        "id": "f8",
        "question": "What's your favorite way to exercise?",
        "category": "lifestyle",
        "options": [
            {"id": "a", "text": "Team sports (basketball, soccer, etc.)", "value": "team_sports"},
            {"id": "b", "text": "Solo activities (running, gym, yoga)", "value": "solo_fitness"},
            {"id": "c", "text": "Outdoor activities (hiking, biking)", "value": "outdoor_fitness"},
            {"id": "d", "text": "I prefer mental over physical exercise", "value": "non_athletic"}
        ],
        "emoji": "💪"
    },
    {
        "id": "f9",
        "question": "How do you prefer to communicate?",
        "category": "communication",
        "options": [
            {"id": "a", "text": "Text messages - quick and convenient", "value": "text"},
            {"id": "b", "text": "Voice/video calls - more personal", "value": "calls"},
            {"id": "c", "text": "In person - nothing beats face-to-face", "value": "in_person"},
            {"id": "d", "text": "Mix of everything depending on situation", "value": "flexible"}
        ],
        "emoji": "📱"
    },
    {
        "id": "f10",
        "question": "What's your humor style?",
        "category": "personality",
        "options": [
            {"id": "a", "text": "Witty and sarcastic", "value": "sarcastic"},
            {"id": "b", "text": "Silly and goofy", "value": "silly"},
            {"id": "c", "text": "Dark and edgy", "value": "dark"},
            {"id": "d", "text": "Wholesome and punny", "value": "wholesome"}
        ],
        "emoji": "😄"
    },
    {
        "id": "f11",
        "question": "How important is punctuality to you?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Very - I'm always on time", "value": "punctual"},
            {"id": "b", "text": "Important but I'm flexible", "value": "flexible"},
            {"id": "c", "text": "Not a big deal, things happen", "value": "relaxed"},
            {"id": "d", "text": "I'm usually fashionably late", "value": "late"}
        ],
        "emoji": "⏰"
    },
    {
        "id": "f12",
        "question": "What's your go-to movie genre?",
        "category": "entertainment",
        "options": [
            {"id": "a", "text": "Action and thrillers", "value": "action"},
            {"id": "b", "text": "Comedy and rom-coms", "value": "comedy"},
            {"id": "c", "text": "Drama and documentaries", "value": "drama"},
            {"id": "d", "text": "Sci-fi and fantasy", "value": "scifi"}
        ],
        "emoji": "🎬"
    },
    {
        "id": "f13",
        "question": "How do you handle stress?",
        "category": "personality",
        "options": [
            {"id": "a", "text": "Talk it out with friends", "value": "social_support"},
            {"id": "b", "text": "Work out or physical activity", "value": "physical"},
            {"id": "c", "text": "Alone time and self-care", "value": "solitude"},
            {"id": "d", "text": "Dive into hobbies or distractions", "value": "distraction"}
        ],
        "emoji": "😌"
    },
    {
        "id": "f14",
        "question": "What's your ideal Friday night?",
        "category": "lifestyle",
        "options": [
            {"id": "a", "text": "Going out - bars, clubs, events", "value": "nightlife"},
            {"id": "b", "text": "Dinner with close friends", "value": "dinner"},
            {"id": "c", "text": "Game night or movie marathon at home", "value": "home_entertainment"},
            {"id": "d", "text": "Early night in - I'm tired from the week!", "value": "rest"}
        ],
        "emoji": "🌙"
    },
    {
        "id": "f15",
        "question": "How do you show appreciation for friends?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Words of affirmation and compliments", "value": "words"},
            {"id": "b", "text": "Quality time together", "value": "time"},
            {"id": "c", "text": "Acts of service and helping out", "value": "acts"},
            {"id": "d", "text": "Gifts and thoughtful gestures", "value": "gifts"}
        ],
        "emoji": "💝"
    }
]

DATING_QUIZ = [
    {
        "id": "d1",
        "question": "What's most important to you in a relationship?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Trust and honesty above all", "value": "trust"},
            {"id": "b", "text": "Emotional connection and intimacy", "value": "emotional"},
            {"id": "c", "text": "Shared values and life goals", "value": "values"},
            {"id": "d", "text": "Fun, laughter, and adventure", "value": "fun"}
        ],
        "emoji": "💕"
    },
    {
        "id": "d2",
        "question": "What's your love language?",
        "category": "love_language",
        "options": [
            {"id": "a", "text": "Words of Affirmation", "value": "words"},
            {"id": "b", "text": "Quality Time", "value": "time"},
            {"id": "c", "text": "Physical Touch", "value": "touch"},
            {"id": "d", "text": "Acts of Service", "value": "acts"},
            {"id": "e", "text": "Receiving Gifts", "value": "gifts"}
        ],
        "emoji": "❤️"
    },
    {
        "id": "d3",
        "question": "How do you handle disagreements in a relationship?",
        "category": "conflict",
        "options": [
            {"id": "a", "text": "Talk it out immediately", "value": "direct"},
            {"id": "b", "text": "Take time to cool off, then discuss", "value": "thoughtful"},
            {"id": "c", "text": "Compromise and find middle ground", "value": "compromise"},
            {"id": "d", "text": "Avoid conflict when possible", "value": "avoid"}
        ],
        "emoji": "🤝"
    },
    {
        "id": "d4",
        "question": "What are your views on family?",
        "category": "life_goals",
        "options": [
            {"id": "a", "text": "Want kids someday", "value": "want_kids"},
            {"id": "b", "text": "Maybe kids, still deciding", "value": "maybe_kids"},
            {"id": "c", "text": "No kids, just us", "value": "no_kids"},
            {"id": "d", "text": "Open to different paths", "value": "flexible"}
        ],
        "emoji": "👨‍👩‍👧"
    },
    {
        "id": "d5",
        "question": "How important is career ambition to you?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Very - career is a top priority", "value": "career_focused"},
            {"id": "b", "text": "Important but balanced with life", "value": "balanced"},
            {"id": "c", "text": "Work to live, not live to work", "value": "life_focused"},
            {"id": "d", "text": "Still figuring it out", "value": "exploring"}
        ],
        "emoji": "💼"
    },
    {
        "id": "d6",
        "question": "What's your ideal date night?",
        "category": "interests",
        "options": [
            {"id": "a", "text": "Fancy dinner and wine", "value": "upscale"},
            {"id": "b", "text": "Outdoor adventure or activity", "value": "active"},
            {"id": "c", "text": "Cozy night in with home-cooked meal", "value": "intimate"},
            {"id": "d", "text": "Concert, show, or entertainment", "value": "entertainment"}
        ],
        "emoji": "🌹"
    },
    {
        "id": "d7",
        "question": "How do you express affection?",
        "category": "affection",
        "options": [
            {"id": "a", "text": "Lots of physical affection (hugs, kisses)", "value": "physical"},
            {"id": "b", "text": "Verbal expressions of love", "value": "verbal"},
            {"id": "c", "text": "Doing things for my partner", "value": "actions"},
            {"id": "d", "text": "All of the above!", "value": "all"}
        ],
        "emoji": "😘"
    },
    {
        "id": "d8",
        "question": "What's your relationship pace preference?",
        "category": "dating_style",
        "options": [
            {"id": "a", "text": "Take it slow and steady", "value": "slow"},
            {"id": "b", "text": "Moderate pace, see how it goes", "value": "moderate"},
            {"id": "c", "text": "When you know, you know!", "value": "fast"},
            {"id": "d", "text": "Go with the flow", "value": "flexible"}
        ],
        "emoji": "⏳"
    },
    {
        "id": "d9",
        "question": "How important is physical attraction?",
        "category": "attraction",
        "options": [
            {"id": "a", "text": "Very important - chemistry is key", "value": "very_important"},
            {"id": "b", "text": "Important but personality matters more", "value": "balanced"},
            {"id": "c", "text": "Attraction grows over time", "value": "grows"},
            {"id": "d", "text": "It's all about the connection", "value": "connection_focused"}
        ],
        "emoji": "✨"
    },
    {
        "id": "d10",
        "question": "What's your view on personal space in a relationship?",
        "category": "boundaries",
        "options": [
            {"id": "a", "text": "I need regular alone time", "value": "independent"},
            {"id": "b", "text": "Balanced - together but maintain individuality", "value": "balanced"},
            {"id": "c", "text": "Love spending most time together", "value": "together"},
            {"id": "d", "text": "Attached at the hip!", "value": "very_close"}
        ],
        "emoji": "🔐"
    },
    {
        "id": "d11",
        "question": "What are your deal-breakers?",
        "category": "deal_breakers",
        "options": [
            {"id": "a", "text": "Dishonesty and lack of trust", "value": "dishonesty"},
            {"id": "b", "text": "Different life goals", "value": "goals"},
            {"id": "c", "text": "Poor communication", "value": "communication"},
            {"id": "d", "text": "Lack of emotional connection", "value": "emotional"}
        ],
        "emoji": "🚫"
    },
    {
        "id": "d12",
        "question": "How do you feel about public displays of affection (PDA)?",
        "category": "affection",
        "options": [
            {"id": "a", "text": "Love it - not afraid to show it", "value": "love_pda"},
            {"id": "b", "text": "Moderate - hand-holding is nice", "value": "moderate_pda"},
            {"id": "c", "text": "Minimal - prefer privacy", "value": "minimal_pda"},
            {"id": "d", "text": "Not comfortable with PDA", "value": "no_pda"}
        ],
        "emoji": "👫"
    },
    {
        "id": "d13",
        "question": "What role does spirituality/religion play in your life?",
        "category": "values",
        "options": [
            {"id": "a", "text": "Very important - central to my life", "value": "very_important"},
            {"id": "b", "text": "Somewhat important", "value": "somewhat"},
            {"id": "c", "text": "Not particularly important", "value": "not_important"},
            {"id": "d", "text": "Prefer not to discuss", "value": "private"}
        ],
        "emoji": "🙏"
    },
    {
        "id": "d14",
        "question": "How do you envision your future together?",
        "category": "life_goals",
        "options": [
            {"id": "a", "text": "Building a life and home together", "value": "homemakers"},
            {"id": "b", "text": "Traveling the world as a couple", "value": "adventurers"},
            {"id": "c", "text": "Supporting each other's individual dreams", "value": "independent_together"},
            {"id": "d", "text": "Still exploring what I want", "value": "open"}
        ],
        "emoji": "🌟"
    },
    {
        "id": "d15",
        "question": "What's your approach to finances in a relationship?",
        "category": "practical",
        "options": [
            {"id": "a", "text": "Completely shared - what's mine is yours", "value": "fully_shared"},
            {"id": "b", "text": "Mostly shared with some separate accounts", "value": "mostly_shared"},
            {"id": "c", "text": "Split everything 50/50", "value": "split"},
            {"id": "d", "text": "Keep finances separate", "value": "separate"}
        ],
        "emoji": "💰"
    }
]
