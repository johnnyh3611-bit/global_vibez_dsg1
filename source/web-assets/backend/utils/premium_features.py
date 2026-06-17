# Premium Feature Restrictions

def can_send_messages(user) -> bool:
    """Check if user has permission to send messages (Premium feature)"""
    # TEMPORARY: Disabled for testing - all users can message
    return True
    # return user.subscription_tier in ["plus", "premium"]

def can_use_chat(user) -> bool:
    """Check if user can use chat features (Premium feature)"""
    # TEMPORARY: Disabled for testing - all users can chat
    return True
    # return user.subscription_tier in ["plus", "premium"]

def can_join_tournaments(user) -> bool:
    """Check if user can join paid tournaments (Free users can only join free tournaments)"""
    return True  # All users can join tournaments, but free users have limitations

def get_upgrade_message(feature: str) -> dict:
    """Get upgrade message for a specific feature"""
    messages = {
        "chat": {
            "message": "Unlock messaging to chat with your matches!",
            "description": "Upgrade to Plus or Premium to send unlimited messages and connect with your matches.",
            "feature": "Unlimited Messaging",
            "min_tier": "plus"
        },
        "tournament_chat": {
            "message": "Unlock tournament chat!",
            "description": "Upgrade to Plus or Premium to chat with other players during games.",
            "feature": "Tournament Chat",
            "min_tier": "plus"
        },
        "video_call": {
            "message": "Unlock video calls!",
            "description": "Upgrade to Premium for video calls with your matches.",
            "feature": "Video Calls",
            "min_tier": "premium"
        }
    }
    return messages.get(feature, {
        "message": "Upgrade to unlock this feature!",
        "description": "Upgrade to Plus or Premium to access all features.",
        "feature": "Premium Features",
        "min_tier": "plus"
    })

# Feature access levels
FEATURE_ACCESS = {
    "messaging": ["plus", "premium"],
    "chat": ["plus", "premium"],
    "tournament_chat": ["plus", "premium"],
    "unlimited_swipes": ["premium"],
    "video_calls": ["premium"],
    "advanced_filters": ["plus", "premium"],
    "see_who_liked": ["premium"],
    "boost_profile": ["plus", "premium"]
}

def has_feature_access(user, feature: str) -> bool:
    """Check if user has access to a specific feature"""
    required_tiers = FEATURE_ACCESS.get(feature, [])
    if not required_tiers:
        return True  # Feature available to all
    return user.subscription_tier in required_tiers
