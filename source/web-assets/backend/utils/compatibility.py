"""
Compatibility scoring algorithms for friend and dating matches
"""

def calculate_friends_compatibility(user1_answers: dict, user2_answers: dict) -> dict:
    """
    Calculate friend compatibility score based on quiz answers
    Returns score (0-100) and breakdown by category
    """
    if not user1_answers or not user2_answers:
        return {"score": 0, "breakdown": {}, "matches": []}
    
    category_weights = {
        "lifestyle": 0.25,      # 25% - How they spend time
        "personality": 0.20,    # 20% - Personality traits
        "social": 0.15,         # 15% - Social preferences
        "entertainment": 0.15,  # 15% - Shared interests
        "values": 0.15,         # 15% - Core values
        "communication": 0.10   # 10% - Communication style
    }
    
    category_scores = {}
    category_matches = {}
    total_score = 0
    
    for category, weight in category_weights.items():
        # Get questions in this category
        category_questions = [
            (q_id, answer) for q_id, answer in user1_answers.items()
            if answer.get("category") == category
        ]
        
        if not category_questions:
            continue
        
        matches = 0
        total_questions = len(category_questions)
        matched_items = []
        
        for q_id, user1_answer in category_questions:
            if q_id in user2_answers:
                user2_answer = user2_answers[q_id]
                
                # Check if values match
                if user1_answer.get("value") == user2_answer.get("value"):
                    matches += 1
                    matched_items.append({
                        "question": user1_answer.get("question"),
                        "value": user1_answer.get("text")
                    })
                # Partial match for similar values
                elif are_values_compatible(user1_answer.get("value"), user2_answer.get("value"), category):
                    matches += 0.5
        
        # Calculate category score (0-100)
        category_score = (matches / total_questions * 100) if total_questions > 0 else 0
        category_scores[category] = round(category_score, 1)
        category_matches[category] = matched_items
        
        # Add weighted score to total
        total_score += category_score * weight
    
    return {
        "score": round(total_score, 1),
        "breakdown": category_scores,
        "matches": category_matches
    }


def calculate_dating_compatibility(user1_answers: dict, user2_answers: dict) -> dict:
    """
    Calculate dating compatibility score based on quiz answers
    Returns score (0-100) and breakdown by category
    """
    if not user1_answers or not user2_answers:
        return {"score": 0, "breakdown": {}, "matches": []}
    
    category_weights = {
        "values": 0.30,          # 30% - Core values (most important)
        "love_language": 0.15,   # 15% - How they express love
        "life_goals": 0.20,      # 20% - Future plans
        "conflict": 0.10,        # 10% - Conflict resolution
        "affection": 0.10,       # 10% - Physical affection style
        "dating_style": 0.05,    # 5% - Dating pace
        "attraction": 0.05,      # 5% - Attraction views
        "boundaries": 0.05       # 5% - Personal space needs
    }
    
    category_scores = {}
    category_matches = {}
    total_score = 0
    
    for category, weight in category_weights.items():
        # Get questions in this category
        category_questions = [
            (q_id, answer) for q_id, answer in user1_answers.items()
            if answer.get("category") == category
        ]
        
        if not category_questions:
            continue
        
        matches = 0
        total_questions = len(category_questions)
        matched_items = []
        
        for q_id, user1_answer in category_questions:
            if q_id in user2_answers:
                user2_answer = user2_answers[q_id]
                
                # Check if values match
                if user1_answer.get("value") == user2_answer.get("value"):
                    matches += 1
                    matched_items.append({
                        "question": user1_answer.get("question"),
                        "value": user1_answer.get("text")
                    })
                # Partial match for compatible values
                elif are_values_compatible(user1_answer.get("value"), user2_answer.get("value"), category):
                    matches += 0.5
        
        # Calculate category score (0-100)
        category_score = (matches / total_questions * 100) if total_questions > 0 else 0
        category_scores[category] = round(category_score, 1)
        category_matches[category] = matched_items
        
        # Add weighted score to total
        total_score += category_score * weight
    
    return {
        "score": round(total_score, 1),
        "breakdown": category_scores,
        "matches": category_matches
    }


def are_values_compatible(value1: str, value2: str, category: str) -> bool:
    """
    Check if two values are partially compatible
    Returns True if values are similar/compatible, False otherwise
    """
    
    # Define compatible value pairs by category
    compatibility_map = {
        "lifestyle": {
            # Active types are compatible
            ("active", "adventure"): True,
            ("active", "outdoor_fitness"): True,
            # Indoor types are compatible
            ("indoor", "home_entertainment"): True,
            ("indoor", "rest"): True,
            # Social types
            ("social", "nightlife"): True,
            ("social", "dinner"): True,
            # Planners vs spontaneous
            ("planner", "flexible_planner"): True,
            ("spontaneous", "very_spontaneous"): True,
        },
        "personality": {
            # Similar introversion levels
            ("introvert", "mild_introvert"): True,
            ("extrovert", "ambivert"): True,
            # Humor compatibility
            ("sarcastic", "dark"): True,
            ("silly", "wholesome"): True,
        },
        "social": {
            # Group size preferences
            ("one_on_one", "small_group"): True,
            ("small_group", "medium_group"): True,
            ("medium_group", "large_group"): True,
        },
        "values": {
            # Punctuality
            ("punctual", "flexible"): True,
            ("flexible", "relaxed"): True,
            # Career ambition
            ("career_focused", "balanced"): True,
            ("balanced", "life_focused"): True,
        },
        "life_goals": {
            # Kids preferences
            ("want_kids", "maybe_kids"): True,
            ("maybe_kids", "flexible"): True,
            ("no_kids", "flexible"): True,
        },
        "dating_style": {
            # Pace compatibility
            ("slow", "moderate"): True,
            ("moderate", "flexible"): True,
        },
        "affection": {
            # PDA comfort
            ("love_pda", "moderate_pda"): True,
            ("moderate_pda", "minimal_pda"): True,
        },
        "boundaries": {
            # Space needs
            ("independent", "balanced"): True,
            ("balanced", "together"): True,
        }
    }
    
    # Check if category has compatibility rules
    if category not in compatibility_map:
        return False
    
    # Check both orderings
    return (
        compatibility_map[category].get((value1, value2), False) or
        compatibility_map[category].get((value2, value1), False)
    )
