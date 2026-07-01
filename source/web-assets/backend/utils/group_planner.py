"""
AI-Powered Group Outing Planner
Automatically pairs compatible friends and suggests activities
"""
import os
from typing import List, Dict
import json
from openai import OpenAI

def get_openai_client():
    """Initialize OpenAI client with Emergent LLM key"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not found in environment")
    return OpenAI(api_key=api_key)

def select_compatible_group(user_id: str, friend_matches: List[Dict], min_size: int = 3, max_size: int = 6) -> Dict:
    """
    Select a group of 3-6 compatible friends
    Returns group members and group compatibility score
    """
    if len(friend_matches) < min_size:
        return None
    
    # Sort by compatibility score
    sorted_friends = sorted(friend_matches, key=lambda x: x.get("compatibility_score", 0), reverse=True)
    
    # Select top N friends
    group_size = min(max_size, len(sorted_friends))
    selected_friends = sorted_friends[:group_size]
    
    # Calculate average compatibility
    avg_compatibility = sum(f.get("compatibility_score", 0) for f in selected_friends) / len(selected_friends)
    
    # Extract common interests
    all_interests = []
    for friend in selected_friends:
        user = friend.get("user", {})
        interests = user.get("interests", [])
        all_interests.extend(interests)
    
    # Find common interests (appear in multiple people)
    from collections import Counter
    interest_counts = Counter(all_interests)
    common_interests = [interest for interest, count in interest_counts.items() if count >= 2]
    
    return {
        "members": selected_friends,
        "group_size": len(selected_friends),
        "avg_compatibility": round(avg_compatibility, 1),
        "common_interests": common_interests
    }


def analyze_group_preferences(group_members: List[Dict], user_quiz_answers: Dict) -> Dict:
    """
    Analyze group's quiz answers to extract preferences
    Returns lifestyle, activities, and personality insights
    """
    lifestyle_prefs = []
    activity_prefs = []
    personality_traits = []
    social_prefs = []
    
    # Analyze user's answers
    for answer_id, answer_data in user_quiz_answers.items():
        category = answer_data.get("category")
        value = answer_data.get("value")
        
        if category == "lifestyle":
            lifestyle_prefs.append(value)
        elif category == "interests":
            activity_prefs.append(value)
        elif category == "personality":
            personality_traits.append(value)
        elif category == "social":
            social_prefs.append(value)
    
    # Analyze group members' answers
    for member in group_members:
        user = member.get("user", {})
        quiz_answers = user.get("quiz_friends_answers", {})
        
        for answer_id, answer_data in quiz_answers.items():
            category = answer_data.get("category")
            value = answer_data.get("value")
            
            if category == "lifestyle":
                lifestyle_prefs.append(value)
            elif category == "interests":
                activity_prefs.append(value)
            elif category == "personality":
                personality_traits.append(value)
            elif category == "social":
                social_prefs.append(value)
    
    # Get most common preferences
    from collections import Counter
    
    return {
        "lifestyle": dict(Counter(lifestyle_prefs).most_common(5)),
        "activities": dict(Counter(activity_prefs).most_common(5)),
        "personality": dict(Counter(personality_traits).most_common(5)),
        "social": dict(Counter(social_prefs).most_common(3))
    }


def generate_activity_suggestions_ai(group_data: Dict, preferences: Dict, location: str = None) -> Dict:
    """
    Use AI to generate personalized activity suggestions for the group
    """
    # Initialize client
    client = get_openai_client()
    
    # Prepare prompt
    group_size = group_data["group_size"]
    avg_compatibility = group_data["avg_compatibility"]
    common_interests = group_data.get("common_interests", [])
    
    prompt = f"""You are a social activity planner. Generate 3 fun group outing ideas for a group of {group_size} friends.

Group Details:
- Group Compatibility: {avg_compatibility}%
- Common Interests: {', '.join(common_interests) if common_interests else 'Varied interests'}
- Location: {location or 'Any city'}

Group Preferences:
- Lifestyle: {', '.join(preferences.get('lifestyle', {}).keys())}
- Activities: {', '.join(preferences.get('activities', {}).keys())}
- Social Style: {', '.join(preferences.get('social', {}).keys())}
- Personality: {', '.join(preferences.get('personality', {}).keys())}

Generate 3 diverse activity suggestions (mix of active, social, and relaxed options). For each suggestion, provide:
1. Activity name (creative and fun)
2. Brief description (1-2 sentences)
3. Why it's perfect for this group (based on their preferences)
4. Suggested venue/location type
5. Best time (day/evening)
6. Estimated duration
7. Approximate cost per person (budget-friendly to moderate)

Format your response as a JSON array with these fields:
[
  {{
    "name": "Activity Name",
    "description": "Brief description",
    "why_perfect": "Reasoning based on group compatibility",
    "venue_type": "Type of venue",
    "best_time": "Morning/Afternoon/Evening",
    "duration": "2-3 hours",
    "cost_per_person": "$15-30",
    "vibe": "casual/active/social/creative"
  }}
]

Make it engaging, specific, and personalized to this group's dynamics!"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a creative social activity planner who suggests personalized group outings."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=1500
        )
        
        # Parse AI response
        ai_content = response.choices[0].message.content
        
        # Extract JSON from response
        import re
        json_match = re.search(r'\[.*\]', ai_content, re.DOTALL)
        if json_match:
            suggestions = json.loads(json_match.group())
            return {
                "suggestions": suggestions,
                "generated_by": "ai",
                "model": "gpt-4o-mini"
            }
        else:
            # Fallback if JSON parsing fails
            return generate_fallback_suggestions(group_data, preferences)
            
    except Exception as e:
        print(f"AI generation error: {e}")
        return generate_fallback_suggestions(group_data, preferences)


def generate_fallback_suggestions(group_data: Dict, preferences: Dict) -> Dict:
    """
    Fallback suggestions if AI fails
    """
    lifestyle = list(preferences.get('lifestyle', {}).keys())

    suggestions = []
    
    # Active group
    if any(x in lifestyle for x in ['active', 'adventure', 'outdoor_fitness']):
        suggestions.append({
            "name": "Adventure Day Challenge",
            "description": "Try an escape room followed by a fun group dinner at a local restaurant.",
            "why_perfect": "Your group loves active experiences and problem-solving together!",
            "venue_type": "Escape Room + Restaurant",
            "best_time": "Afternoon",
            "duration": "3-4 hours",
            "cost_per_person": "$30-50",
            "vibe": "active"
        })
    
    # Social group
    if any(x in lifestyle for x in ['social', 'nightlife']):
        suggestions.append({
            "name": "Game Night Extravaganza",
            "description": "Host a board game tournament with themed snacks and prizes.",
            "why_perfect": "Your group thrives in social settings with friendly competition!",
            "venue_type": "Someone's home or Board Game Cafe",
            "best_time": "Evening",
            "duration": "3-4 hours",
            "cost_per_person": "$15-25",
            "vibe": "social"
        })
    
    # Creative group
    if any(x in lifestyle for x in ['creative', 'cultural']):
        suggestions.append({
            "name": "Creative Workshop Day",
            "description": "Take a pottery, painting, or cooking class together.",
            "why_perfect": "Your group appreciates creative pursuits and learning new skills!",
            "venue_type": "Art Studio or Cooking School",
            "best_time": "Afternoon",
            "duration": "2-3 hours",
            "cost_per_person": "$40-60",
            "vibe": "creative"
        })
    
    # Default suggestions if nothing matches
    if not suggestions:
        suggestions = [
            {
                "name": "Brunch & Explore",
                "description": "Start with brunch at a trendy spot, then explore a local market or neighborhood.",
                "why_perfect": "A relaxed way to catch up and discover new places together!",
                "venue_type": "Restaurant + Local Market",
                "best_time": "Morning",
                "duration": "3 hours",
                "cost_per_person": "$25-35",
                "vibe": "casual"
            },
            {
                "name": "Movie Night Out",
                "description": "Catch a movie followed by dessert and discussion.",
                "why_perfect": "Easy, fun, and perfect for any group dynamic!",
                "venue_type": "Cinema + Dessert Cafe",
                "best_time": "Evening",
                "duration": "3-4 hours",
                "cost_per_person": "$20-30",
                "vibe": "casual"
            }
        ]
    
    return {
        "suggestions": suggestions[:3],
        "generated_by": "fallback",
        "model": "rule-based"
    }
