from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request
from utils.database import get_database, get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/tournament-winnings", tags=["tournament_winnings"])


async def distribute_tournament_winnings(tournament_id: str, winner_team_id: str) -> Dict[str, Any]:
    """
    Distribute prize pot to tournament winners (Winner Takes All)
    Called automatically when tournament completes
    """
    db = get_database()
    
    # Get tournament
    tournament = await db.tournaments.find_one(
        {"tournament_id": tournament_id},
        {"_id": 0}
    )
    
    if not tournament:
        return {"error": "Tournament not found"}
    
    if tournament.get("credits_distributed"):
        return {"message": "Credits already distributed"}
    
    total_pot = tournament.get("total_pot", 0)
    
    if total_pot == 0:
        return {"message": "No credits to distribute (free tournament)"}
    
    # Get winner team
    winner_team = next((t for t in tournament["teams"] if t["team_id"] == winner_team_id), None)
    
    if not winner_team:
        return {"error": "Winner team not found"}
    
    # Winner takes all pot
    if tournament.get("winner_takes_all", True):
        # Distribute equally to both team members
        credits_per_player = total_pot // 2
        
        player1_id = winner_team["player1_id"]
        player2_id = winner_team["player2_id"]
        
        # Award credits to player 1
        await db.users.update_one(
            {"user_id": player1_id},
            {"$inc": {"credits_balance": credits_per_player}}
        )
        
        # Award credits to player 2
        await db.users.update_one(
            {"user_id": player2_id},
            {"$inc": {"credits_balance": credits_per_player}}
        )
        
        # Record transactions
        for player_id in [player1_id, player2_id]:
            await db.credit_transactions.insert_one({
                "user_id": player_id,
                "amount": credits_per_player,
                "type": "tournament_winnings",
                "tournament_id": tournament_id,
                "description": f"🏆 Won {tournament['name']} - Prize: {credits_per_player} credits!",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Mark as distributed
        await db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {"$set": {"credits_distributed": True}}
        )
        
        return {
            "success": True,
            "total_pot": total_pot,
            "credits_per_player": credits_per_player,
            "winners": [player1_id, player2_id],
            "message": f"🎉 Prize pot of {total_pot} credits distributed!"
        }
    
    return {"message": "Distribution complete"}


@router.post("/complete")
async def complete_tournament_and_distribute(tournament_id: str, winner_team_id: str, request: Request) -> Dict[str, Any]:
    """Complete tournament and distribute winnings"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Mark tournament as completed
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {
            "$set": {
                "status": "completed",
                "winner_team_id": winner_team_id,
                "end_time": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Distribute winnings
    result = await distribute_tournament_winnings(tournament_id, winner_team_id)
    
    return result


@router.get("/pot/{tournament_id}")
async def get_tournament_pot(tournament_id: str) -> Dict[str, Any]:
    """Get current prize pot for a tournament"""
    db = get_database()
    
    tournament = await db.tournaments.find_one(
        {"tournament_id": tournament_id},
        {"_id": 0, "total_pot": 1, "entry_wager": 1, "teams": 1, "max_teams": 1}
    )
    
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    current_pot = tournament.get("total_pot", 0)
    max_pot = tournament.get("entry_wager", 0) * tournament.get("max_teams", 0)
    teams_joined = len(tournament.get("teams", []))
    
    return {
        "current_pot": current_pot,
        "max_pot": max_pot,
        "entry_wager": tournament.get("entry_wager", 0),
        "teams_joined": teams_joined,
        "max_teams": tournament.get("max_teams", 0),
        "pot_message": f"Winner takes {current_pot} credits!" if current_pot > 0 else "Free tournament"
    }
