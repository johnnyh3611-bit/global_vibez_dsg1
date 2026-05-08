"""
Progression/XP System - Backend
Tracks player experience, levels, achievements across all games
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from utils.database import get_database

router = APIRouter()

# XP Configuration
XP_CONFIG = {
    'game_completion': 100,
    'game_win': 200,
    'first_win_of_day': 500,
    'checkers_tower_capture': 25,
    'spades_nil_success': 150,
    'uno_uno_call': 50,
    'streak_bonus_multiplier': 1.5,
    'level_up_base': 1000,
    'level_up_scaling': 1.15,
}

# Level calculation
def calculate_level(total_xp: int) -> int:
    """Calculate level from total XP"""
    level = 1
    xp_needed = XP_CONFIG['level_up_base']
    
    while total_xp >= xp_needed:
        total_xp -= xp_needed
        level += 1
        xp_needed = int(xp_needed * XP_CONFIG['level_up_scaling'])
    
    return level

def xp_for_next_level(current_level: int, current_xp: int) -> Dict:
    """Calculate XP needed for next level"""
    xp_needed = XP_CONFIG['level_up_base']
    total_for_level = 0
    
    for lvl in range(1, current_level):
        total_for_level += xp_needed
        xp_needed = int(xp_needed * XP_CONFIG['level_up_scaling'])
    
    xp_for_current = current_xp - total_for_level
    
    return {
        'current_level_xp': xp_for_current,
        'xp_needed': xp_needed,
        'progress_percentage': (xp_for_current / xp_needed) * 100
    }


class XPEvent(BaseModel):
    user_id: str
    event_type: str
    game_type: str
    xp_amount: int
    metadata: Optional[Dict] = None


@router.post("/progression/xp/award")
async def award_xp(event: XPEvent) -> Dict[str, Any]:
    """Award XP to a user for an event"""
    db = get_database()
    
    # Get user progression
    user_prog = await db.user_progression.find_one({'user_id': event.user_id}, {'_id': 0})
    
    if not user_prog:
        # Create new progression record
        user_prog = {
            'user_id': event.user_id,
            'total_xp': 0,
            'level': 1,
            'achievements': [],
            'daily_wins': {},
            'streak': 0,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    # Check for first win of day bonus
    today = datetime.now(timezone.utc).date().isoformat()
    if event.event_type == 'game_win' and today not in user_prog.get('daily_wins', {}):
        event.xp_amount += XP_CONFIG['first_win_of_day']
        user_prog.setdefault('daily_wins', {})[today] = True
    
    # Apply streak bonus
    if event.event_type == 'game_win' and user_prog.get('streak', 0) >= 3:
        event.xp_amount = int(event.xp_amount * XP_CONFIG['streak_bonus_multiplier'])
    
    # Update totals
    user_prog['total_xp'] += event.xp_amount
    
    # Calculate level
    old_level = user_prog['level']
    new_level = calculate_level(user_prog['total_xp'])
    user_prog['level'] = new_level
    
    # Save to database
    await db.user_progression.update_one(
        {'user_id': event.user_id},
        {'$set': user_prog},
        upsert=True
    )
    
    # Log XP event
    await db.xp_events.insert_one({
        'user_id': event.user_id,
        'event_type': event.event_type,
        'game_type': event.game_type,
        'xp_amount': event.xp_amount,
        'metadata': event.metadata,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })
    
    # Check for level up
    level_up = new_level > old_level
    
    return {
        'success': True,
        'xp_awarded': event.xp_amount,
        'total_xp': user_prog['total_xp'],
        'level': new_level,
        'level_up': level_up,
        'levels_gained': new_level - old_level if level_up else 0
    }


@router.get("/progression/leaderboard")
async def get_leaderboard(limit: int = 10) -> Dict[str, Any]:
    """Get top players by XP"""
    db = get_database()
    
    top_players = await db.user_progression.find(
        {},
        {'_id': 0}
    ).sort('total_xp', -1).limit(limit).to_list(limit)
    
    return {
        'leaderboard': top_players,
        'count': len(top_players)
    }


@router.get("/progression/{user_id}")
async def get_user_progression(user_id: str) -> Dict[str, Any]:
    """Get user's progression stats"""
    db = get_database()
    
    user_prog = await db.user_progression.find_one({'user_id': user_id}, {'_id': 0})
    
    if not user_prog:
        return {
            'user_id': user_id,
            'total_xp': 0,
            'level': 1,
            'achievements': [],
            'streak': 0
        }
    
    # Calculate next level progress
    level_info = xp_for_next_level(user_prog['level'], user_prog['total_xp'])
    
    return {
        **user_prog,
        'next_level': level_info
    }


@router.post("/progression/achievement/unlock")
async def unlock_achievement(user_id: str, achievement_id: str) -> Dict[str, Any]:
    """Unlock an achievement for a user"""
    db = get_database()
    
    # Achievement definitions
    ACHIEVEMENTS = {
        'first_win': {'name': 'First Victory', 'xp': 100},
        'checkers_master': {'name': 'Checkers Master', 'xp': 500},
        'spades_expert': {'name': 'Spades Expert', 'xp': 500},
        'uno_champion': {'name': 'UNO Champion', 'xp': 500},
        'win_streak_5': {'name': '5 Win Streak', 'xp': 750},
        'level_10': {'name': 'Reached Level 10', 'xp': 1000},
    }
    
    if achievement_id not in ACHIEVEMENTS:
        raise HTTPException(status_code=400, detail="Invalid achievement")
    
    # Check if already unlocked
    user_prog = await db.user_progression.find_one({'user_id': user_id}, {'_id': 0})
    
    if not user_prog:
        raise HTTPException(status_code=404, detail="User progression not found")
    
    if achievement_id in user_prog.get('achievements', []):
        return {'success': False, 'message': 'Achievement already unlocked'}
    
    # Unlock achievement
    achievement = ACHIEVEMENTS[achievement_id]
    await db.user_progression.update_one(
        {'user_id': user_id},
        {
            '$push': {'achievements': achievement_id},
            '$inc': {'total_xp': achievement['xp']}
        }
    )
    
    return {
        'success': True,
        'achievement': achievement_id,
        'name': achievement['name'],
        'xp_awarded': achievement['xp']
    }
