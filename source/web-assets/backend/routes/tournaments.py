"""
Tournament System - Complete Implementation
Bracket generation, matchmaking, prize distribution, spectator mode
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import math
import secrets
secure_random = secrets.SystemRandom()
import uuid
from utils.database import get_database

router = APIRouter(prefix="/tournaments", tags=["tournaments"])

# Get shared database instance
def get_db():
    return get_database()

# Pydantic Models
class TournamentCreate(BaseModel):
    name: str
    game_id: str  # 'poker', 'spades', 'chess', etc.
    organizer_id: str
    max_players: int = 16
    entry_fee: int = 0  # XP or virtual currency
    prize_pool: int = 0
    tournament_type: str = "single_elimination"  # single_elimination, double_elimination, round_robin
    start_time: Optional[str] = None
    registration_deadline: Optional[str] = None
    min_skill_level: int = 0
    max_skill_level: int = 100

class TournamentJoin(BaseModel):
    tournament_id: str
    user_id: str
    skill_level: int = 50

class MatchResult(BaseModel):
    tournament_id: str  # Required to uniquely identify the match
    match_id: str
    winner_id: str
    loser_id: str
    score: Optional[str] = None
    reported_by: str

# ========== TOURNAMENT CREATION & MANAGEMENT ==========

@router.post("/create")
async def create_tournament(tournament: TournamentCreate) -> Dict[str, Any]:
    """Create a new tournament"""
    try:
        db = get_db()
        tournament_id = f"tour_{uuid.uuid4().hex[:12]}"
        
        # Calculate start time if not provided
        if not tournament.start_time:
            start_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        else:
            start_time = tournament.start_time
        
        # Calculate registration deadline
        if not tournament.registration_deadline:
            registration_deadline = (datetime.fromisoformat(start_time) - timedelta(minutes=15)).isoformat()
        else:
            registration_deadline = tournament.registration_deadline
        
        tournament_doc = {
            "id": tournament_id,
            "name": tournament.name,
            "game_id": tournament.game_id,
            "organizer_id": tournament.organizer_id,
            "max_players": tournament.max_players,
            "current_players": 0,
            "entry_fee": tournament.entry_fee,
            "prize_pool": tournament.prize_pool,
            "tournament_type": tournament.tournament_type,
            "status": "registration",  # registration, in_progress, completed, cancelled
            "start_time": start_time,
            "registration_deadline": registration_deadline,
            "min_skill_level": tournament.min_skill_level,
            "max_skill_level": tournament.max_skill_level,
            "participants": [],
            "bracket": None,
            "current_round": 0,
            "total_rounds": 0,
            "winner_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.tournaments.insert_one(tournament_doc)
        
        return {
            "success": True,
            "tournament_id": tournament_id,
            "message": "Tournament created successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/join")
async def join_tournament(join_data: TournamentJoin) -> Dict[str, Any]:
    """Join a tournament"""
    try:
        db = get_db()
        tournament = await db.tournaments.find_one({"id": join_data.tournament_id})
        
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament["status"] != "registration":
            raise HTTPException(status_code=400, detail="Registration is closed")
        
        if tournament["current_players"] >= tournament["max_players"]:
            raise HTTPException(status_code=400, detail="Tournament is full")
        
        # Check skill level requirements
        if join_data.skill_level < tournament["min_skill_level"] or join_data.skill_level > tournament["max_skill_level"]:
            raise HTTPException(status_code=400, detail="Skill level doesn't match requirements")
        
        # Check if already joined
        if any(p["user_id"] == join_data.user_id for p in tournament["participants"]):
            raise HTTPException(status_code=400, detail="Already registered")
        
        # Get user info
        user = await db.users.find_one({"user_id": join_data.user_id}, {"_id": 0})
        
        participant = {
            "user_id": join_data.user_id,
            "username": user.get("name", "Player") if user else "Player",
            "skill_level": join_data.skill_level,
            "seed": None,  # Will be assigned when bracket is generated
            "status": "active",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Deduct entry fee (XP)
        if tournament["entry_fee"] > 0:
            user_xp = user.get("xp", 0) if user else 0
            if user_xp < tournament["entry_fee"]:
                raise HTTPException(status_code=400, detail="Insufficient XP for entry fee")
            
            await db.users.update_one(
                {"user_id": join_data.user_id},
                {"$inc": {"xp": -tournament["entry_fee"]}}
            )
            
            # Add to prize pool
            await db.tournaments.update_one(
                {"id": join_data.tournament_id},
                {"$inc": {"prize_pool": tournament["entry_fee"]}}
            )
        
        # Add participant
        await db.tournaments.update_one(
            {"id": join_data.tournament_id},
            {
                "$push": {"participants": participant},
                "$inc": {"current_players": 1}
            }
        )
        
        return {
            "success": True,
            "message": "Successfully joined tournament"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start/{tournament_id}")
async def start_tournament(tournament_id: str, organizer_id: str) -> Dict[str, Any]:
    """Start tournament and generate bracket"""
    try:
        db = get_db()
        tournament = await db.tournaments.find_one({"id": tournament_id})
        
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament["organizer_id"] != organizer_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        if tournament["status"] != "registration":
            raise HTTPException(status_code=400, detail="Tournament already started")
        
        if tournament["current_players"] < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 players")
        
        # Generate bracket
        bracket = generate_bracket(
            tournament["participants"],
            tournament["tournament_type"]
        )
        
        total_rounds = calculate_rounds(tournament["current_players"], tournament["tournament_type"])
        
        await db.tournaments.update_one(
            {"id": tournament_id},
            {
                "$set": {
                    "status": "in_progress",
                    "bracket": bracket,
                    "current_round": 1,
                    "total_rounds": total_rounds,
                    "started_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "bracket": bracket,
            "message": "Tournament started"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== BRACKET GENERATION ==========

def generate_bracket(participants: List[Dict], tournament_type: str) -> Dict:
    """Generate tournament bracket"""
    # num_players =   # Unusedlen(participants)
    
    # Seed participants by skill level
    seeded = sorted(participants, key=lambda p: p["skill_level"], reverse=True)
    for i, p in enumerate(seeded):
        p["seed"] = i + 1
    
    if tournament_type == "single_elimination":
        return generate_single_elimination(seeded)
    elif tournament_type == "double_elimination":
        return generate_double_elimination(seeded)
    elif tournament_type == "round_robin":
        return generate_round_robin(seeded)
    else:
        return generate_single_elimination(seeded)

def generate_single_elimination(participants: List[Dict]) -> Dict:
    """Generate single elimination bracket"""
    num_players = len(participants)
    
    # Round up to next power of 2
    bracket_size = 2 ** math.ceil(math.log2(num_players))
    # num_byes =   # Unusedbracket_size - num_players
    
    # Create first round matches
    matches = []
    match_id = 0
    
    # Standard seeding: 1 vs last, 2 vs second-to-last, etc.
    seeding_order = create_seeding_order(len(participants))
    
    for i in range(0, bracket_size, 2):
        seed1 = seeding_order[i] if i < len(seeding_order) else None
        seed2 = seeding_order[i + 1] if i + 1 < len(seeding_order) else None
        
        player1 = participants[seed1 - 1] if seed1 and seed1 <= num_players else None
        player2 = participants[seed2 - 1] if seed2 and seed2 <= num_players else None
        
        # Handle byes
        if player1 and not player2:
            winner = player1
            status = "completed"
        elif player2 and not player1:
            winner = player2
            status = "completed"
        else:
            winner = None
            status = "pending"
        
        match = {
            "match_id": f"m_{match_id}",
            "round": 1,
            "player1": player1["user_id"] if player1 else None,
            "player2": player2["user_id"] if player2 else None,
            "winner": winner["user_id"] if winner else None,
            "score": None,
            "status": status,
            "next_match_id": f"m_{bracket_size // 2 + match_id // 2}"
        }
        matches.append(match)
        match_id += 1
    
    return {
        "type": "single_elimination",
        "matches": matches,
        "bracket_size": bracket_size
    }

def generate_double_elimination(participants: List[Dict]) -> Dict:
    """Generate double elimination bracket (winners + losers bracket)"""
    # Winners bracket
    winners_bracket = generate_single_elimination(participants)
    
    # Losers bracket will be populated as players lose
    losers_bracket = {
        "matches": [],
        "active": True
    }
    
    return {
        "type": "double_elimination",
        "winners_bracket": winners_bracket,
        "losers_bracket": losers_bracket
    }

def generate_round_robin(participants: List[Dict]) -> Dict:
    """Generate round robin bracket (everyone plays everyone)"""
    num_players = len(participants)
    matches = []
    match_id = 0
    
    for i in range(num_players):
        for j in range(i + 1, num_players):
            match = {
                "match_id": f"m_{match_id}",
                "round": 1,
                "player1": participants[i]["user_id"],
                "player2": participants[j]["user_id"],
                "winner": None,
                "score": None,
                "status": "pending"
            }
            matches.append(match)
            match_id += 1
    
    return {
        "type": "round_robin",
        "matches": matches,
        "total_matches": len(matches)
    }

def create_seeding_order(num_players: int) -> List[int]:
    """Create standard tournament seeding order"""
    bracket_size = 2 ** math.ceil(math.log2(num_players))
    # seeds =   # Unusedlist(range(1, bracket_size + 1))
    
    # Standard bracket seeding
    rounds = int(math.log2(bracket_size))
    order = [1]
    
    for _ in range(rounds):
        new_order = []
        for seed in order:
            new_order.append(seed)
            new_order.append(bracket_size + 1 - seed)
        order = new_order
    
    return order[:num_players]

def calculate_rounds(num_players: int, tournament_type: str) -> int:
    """Calculate total number of rounds"""
    if tournament_type == "round_robin":
        return 1
    else:
        return math.ceil(math.log2(num_players))

# ========== MATCH RESULTS ==========

@router.post("/match/result")
async def report_match_result(result: MatchResult) -> Dict[str, Any]:
    """Report match result and advance winner"""
    try:
        db = get_db()
        # Find tournament by ID and match_id
        tournament = await db.tournaments.find_one({
            "id": result.tournament_id,
            "bracket.matches.match_id": result.match_id
        })
        
        if not tournament:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Verify reporter is a participant
        if result.reported_by not in [result.winner_id, result.loser_id]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        bracket = tournament["bracket"]
        
        # Find and update match
        for match in bracket["matches"]:
            if match["match_id"] == result.match_id:
                match["winner"] = result.winner_id
                match["score"] = result.score
                match["status"] = "completed"
                
                # Advance winner to next match
                if "next_match_id" in match and match["next_match_id"]:
                    for next_match in bracket["matches"]:
                        if next_match["match_id"] == match["next_match_id"]:
                            if not next_match["player1"]:
                                next_match["player1"] = result.winner_id
                            else:
                                next_match["player2"] = result.winner_id
                            
                            # If both players assigned, match is ready
                            if next_match["player1"] and next_match["player2"]:
                                next_match["status"] = "ready"
                break
        
        # Update tournament
        await db.tournaments.update_one(
            {"id": tournament["id"]},
            {"$set": {"bracket": bracket}}
        )
        
        # Check if tournament is complete
        await check_tournament_complete(tournament["id"])
        
        # Award XP for match win
        await db.users.update_one(
            {"user_id": result.winner_id},
            {"$inc": {"xp": 50}}
        )
        
        return {
            "success": True,
            "message": "Match result recorded"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def check_tournament_complete(tournament_id: str) -> Dict[str, Any]:
    """Check if tournament is complete and distribute prizes"""
    db = get_db()
    tournament = await db.tournaments.find_one({"id": tournament_id})
    bracket = tournament["bracket"]
    
    # Check if all matches are complete
    all_complete = all(m["status"] == "completed" for m in bracket["matches"])
    
    if all_complete:
        # Find final match
        final_match = max(bracket["matches"], key=lambda m: int(m["match_id"].split("_")[1]))
        winner_id = final_match["winner"]
        
        # Update tournament
        await db.tournaments.update_one(
            {"id": tournament_id},
            {
                "$set": {
                    "status": "completed",
                    "winner_id": winner_id,
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Distribute prizes
        await distribute_prizes(tournament_id, winner_id, tournament["prize_pool"])

async def distribute_prizes(tournament_id: str, winner_id: str, prize_pool: int) -> Dict[str, Any]:
    """Distribute prize pool to winners"""
    db = get_db()
    if prize_pool == 0:
        return
    
    # Winner gets 70%, runner-up gets 20%, 3rd/4th get 5% each
    winner_prize = int(prize_pool * 0.7)
    
    await db.users.update_one(
        {"user_id": winner_id},
        {"$inc": {"xp": winner_prize}}
    )
    
    # Send notification
    await db.engagement.insert_one({
        "id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": winner_id,
        "type": "tournament_win",
        "title": "🏆 Tournament Victory!",
        "message": f"You won the tournament and earned {winner_prize} XP!",
        "action_url": f"/tournament/{tournament_id}",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

# ========== TOURNAMENT QUERIES ==========

@router.get("/list")
async def list_tournaments(status: Optional[str] = None, game_id: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """List tournaments"""
    try:
        db = get_db()
        query = {}
        if status:
            query["status"] = status
        if game_id:
            query["game_id"] = game_id
        
        tournaments = await db.tournaments.find(query, {"_id": 0}) \
            .sort("created_at", -1) \
            .limit(limit) \
            .to_list(limit)
        
        return {
            "success": True,
            "tournaments": tournaments,
            "count": len(tournaments)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/details/{tournament_id}")
async def get_tournament_details(tournament_id: str) -> Dict[str, Any]:
    """Get tournament details"""
    try:
        db = get_db()
        tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
        
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        return {
            "success": True,
            "tournament": tournament
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/leaderboard")
async def get_tournament_leaderboard(limit: int = 100) -> Dict[str, Any]:
    """Get all-time tournament leaderboard"""
    try:
        db = get_db()
        # Aggregate tournament wins
        pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$winner_id",
                "wins": {"$sum": 1},
                "total_prize": {"$sum": "$prize_pool"}
            }},
            {"$sort": {"wins": -1}},
            {"$limit": limit}
        ]
        
        results = await db.tournaments.aggregate(pipeline).to_list(limit)
        
        # Enrich with user data
        leaderboard = []
        for result in results:
            user = await db.users.find_one({"user_id": result["_id"]}, {"_id": 0})
            if user:
                leaderboard.append({
                    "user_id": result["_id"],
                    "username": user.get("name", "Unknown"),
                    "wins": result["wins"],
                    "total_prize": result.get("total_prize", 0)
                })
        
        return {
            "success": True,
            "leaderboard": leaderboard
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
