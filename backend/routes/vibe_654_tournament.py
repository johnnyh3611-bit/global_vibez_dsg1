"""
Vibe 6-5-4 Tournament Mode - 20 Player Tables
Based on official Vibe 654 tournament rules

Wave-2 (2026-02-15): now wired to the canonical Sovereign Game Logic.
The TIE branch delegates to `services.sovereign_game_logic.resolve_multi_tie`
(Infinite Bounty Protocol, §II of DSG_Master_Sovereign_Game_Logic.pdf) for
proper bankruptcy handling, and surfaces the running Sovereign-Tax multiplier
projection from `services.war_of_attrition.compute_tie_tax_multiplier` so
the founder dashboard can read live tax-revenue lift per tied round.
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os

from services.sovereign_game_logic import TieContender, resolve_multi_tie
from services.war_of_attrition import (
    compute_tie_tax_multiplier,
    reopen_spectator_side_action,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE

router = APIRouter(prefix="/vibe654/tournament", tags=["Vibe 654 Tournament"])

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL')
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv('DB_NAME', 'global_vibez_dsg')]

# ==================== MODELS ====================

class CreateTableRequest(BaseModel):
    host_user_id: str
    host_name: str
    buy_in: float = 100000.0  # Default ₵100,000 buy-in (Vibez Coins)
    max_players: int = 20
    table_name: Optional[str] = "Vibe 654 Table"

class JoinTableRequest(BaseModel):
    user_id: str
    player_name: str
    table_id: str

# ==================== TOURNAMENT ENGINE ====================

class TournamentEngine:
    """Orchestrates 20-player Vibe 654 tournament"""
    
    HOUSE_RAKE = 0.125  # 12.5% official rake
    
    @staticmethod
    def roll_dice(num_dice=5) -> List[int]:
        """Provably fair dice roll"""
        return [secrets.choice([1, 2, 3, 4, 5, 6]) for _ in range(num_dice)]
    
    @staticmethod
    def play_player_turn(player_id: str) -> Dict:
        """
        Execute one player's turn (3 rolls max to qualify)
        Returns: score and roll history
        """
        has_6 = False
        has_5 = False
        has_4 = False
        rolls_history = []
        
        for roll_num in range(1, 4):
            # Roll remaining dice
            dice_to_roll = 5 - sum([has_6, has_5, has_4])
            current_roll = TournamentEngine.roll_dice(dice_to_roll)
            rolls_history.append(current_roll.copy())
            
            # Sequential 6 -> 5 -> 4 qualification
            if not has_6 and 6 in current_roll:
                has_6 = True
                current_roll.remove(6)
            
            if has_6 and not has_5 and 5 in current_roll:
                has_5 = True
                current_roll.remove(5)
            
            if has_5 and not has_4 and 4 in current_roll:
                has_4 = True
                current_roll.remove(4)
            
            # Check if qualified
            if has_6 and has_5 and has_4:
                # Points = remaining dice
                points = sum(current_roll)
                return {
                    "player_id": player_id,
                    "qualified": True,
                    "points": points,
                    "rolls": rolls_history,
                    "status": "QUALIFIED"
                }
        
        # Failed to qualify
        return {
            "player_id": player_id,
            "qualified": False,
            "points": 0,
            "rolls": rolls_history,
            "status": "BUST"
        }
    
    @staticmethod
    def process_round(players: List[Dict]) -> Dict:
        """
        Process one complete orbit (all players roll)
        Returns: winners, losers, high score
        """
        round_results = {}
        
        for player in players:
            result = TournamentEngine.play_player_turn(player["user_id"])
            round_results[player["user_id"]] = {
                "player_name": player["player_name"],
                "score": result["points"],
                "qualified": result["qualified"],
                "rolls": result["rolls"]
            }
        
        # Find highest score
        high_score = max(r["score"] for r in round_results.values())
        
        # Determine winners and losers
        if high_score == 0:
            # NO ONE QUALIFIED - everyone re-ups
            return {
                "outcome": "NO_QUALIFIERS",
                "high_score": 0,
                "winners": [],
                "losers": [],
                "round_results": round_results,
                "message": "NO ONE QUALIFIED! Everyone must re-up."
            }
        
        winners = [p for p in players if round_results[p["user_id"]]["score"] == high_score]
        losers = [p for p in players if round_results[p["user_id"]]["score"] < high_score]
        
        if len(winners) == 1:
            return {
                "outcome": "WINNER",
                "high_score": high_score,
                "winner": winners[0],
                "round_results": round_results,
                "message": f"{winners[0]['player_name']} WINS with {high_score} points!"
            }
        else:
            return {
                "outcome": "TIE",
                "high_score": high_score,
                "winners": winners,
                "losers": losers,
                "round_results": round_results,
                "message": f"TIE! {len(winners)} players tied at {high_score}. Shootout!"
            }
    
    @staticmethod
    def calculate_payout(total_pot: float) -> Dict:
        """Calculate final payout with house rake"""
        rake = total_pot * TournamentEngine.HOUSE_RAKE
        winner_payout = total_pot - rake
        return {
            "total_pot": round(total_pot, 2),
            "house_rake": round(rake, 2),
            "winner_payout": round(winner_payout, 2)
        }

# ==================== API ENDPOINTS ====================

@router.post("/create-table")
async def create_tournament_table(request: CreateTableRequest) -> Dict[str, Any]:
    """
    Create a new 20-player tournament table
    Host creates the table and waits for players to join
    """
    table_id = str(uuid.uuid4())
    
    table_doc = {
        "table_id": table_id,
        "table_name": request.table_name,
        "host_user_id": request.host_user_id,
        "host_name": request.host_name,
        "buy_in": request.buy_in,
        "max_players": request.max_players,
        "current_players": [],
        "total_pot": 0.0,
        "status": "WAITING",  # WAITING, IN_PROGRESS, COMPLETED
        "round_number": 0,
        "round_history": [],
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "winner": None
    }
    
    await db.vibe654_tables.insert_one(table_doc)
    
    return {
        "success": True,
        "table_id": table_id,
        "message": f"Table created! Buy-in: ₵{int(request.buy_in):,}. Waiting for players..."
    }

@router.post("/join-table")
async def join_tournament_table(request: JoinTableRequest) -> Dict[str, Any]:
    """
    Player joins a tournament table
    Pays buy-in and gets added to player list
    """
    # Get table
    table = await db.vibe654_tables.find_one(
        {"table_id": request.table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table["status"] != "WAITING":
        raise HTTPException(status_code=400, detail="Table already started or completed")
    
    if len(table["current_players"]) >= table["max_players"]:
        raise HTTPException(status_code=400, detail="Table is full")
    
    # Check if player already joined
    if any(p["user_id"] == request.user_id for p in table["current_players"]):
        raise HTTPException(status_code=400, detail="Already joined this table")
    
    # Add player and increase pot
    new_player = {
        "user_id": request.user_id,
        "player_name": request.player_name,
        "status": "active",
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vibe654_tables.update_one(
        {"table_id": request.table_id},
        {
            "$push": {"current_players": new_player},
            "$inc": {"total_pot": table["buy_in"]}
        }
    )
    
    # Get updated table
    updated_table = await db.vibe654_tables.find_one(
        {"table_id": request.table_id},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "message": f"{request.player_name} joined! Pot: ${updated_table['total_pot']}",
        "players_count": len(updated_table["current_players"]),
        "total_pot": updated_table["total_pot"]
    }

@router.post("/start-tournament/{table_id}")
async def start_tournament(table_id: str, host_user_id: str) -> Dict[str, Any]:
    """
    Start the tournament (host only)
    Begins Round 1 with all players
    """
    table = await db.vibe654_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table["host_user_id"] != host_user_id:
        raise HTTPException(status_code=403, detail="Only host can start tournament")
    
    if table["status"] != "WAITING":
        raise HTTPException(status_code=400, detail="Tournament already started")
    
    if len(table["current_players"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start")
    
    # Update status
    await db.vibe654_tables.update_one(
        {"table_id": table_id},
        {
            "$set": {
                "status": "IN_PROGRESS",
                "round_number": 1,
                "started_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "message": "Tournament STARTED! Round 1 begins.",
        "players": table["current_players"],
        "total_pot": table["total_pot"]
    }

@router.post("/play-round/{table_id}")
async def play_tournament_round(table_id: str) -> Dict[str, Any]:
    """
    Execute one complete round (orbit)
    All active players roll, determine winners/losers
    """
    table = await db.vibe654_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table["status"] != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="Tournament not in progress")
    
    # Get active players
    active_players = [p for p in table["current_players"] if p.get("status") == "active"]
    
    if len(active_players) == 0:
        raise HTTPException(status_code=400, detail="No active players")
    
    # Process the round
    round_result = TournamentEngine.process_round(active_players)
    
    # Save round to history
    round_doc = {
        "round_number": table["round_number"],
        "outcome": round_result["outcome"],
        "high_score": round_result["high_score"],
        "results": round_result["round_results"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Handle different outcomes
    # Detect 6-5-4 One & Done hit for spectator side-bet settlement.
    try:
        from routes.vibe_654_social import detect_six_five_four_in_round, settle_side_bets_for_round
        hit_654 = detect_six_five_four_in_round(round_result.get("round_results") or {})
    except Exception:
        detect_six_five_four_in_round = None
        settle_side_bets_for_round = None
        hit_654 = False

    if round_result["outcome"] == "WINNER":
        # TOURNAMENT OVER - We have a winner!
        winner = round_result["winner"]
        payout_info = TournamentEngine.calculate_payout(table["total_pot"])
        
        await db.vibe654_tables.update_one(
            {"table_id": table_id},
            {
                "$set": {
                    "status": "COMPLETED",
                    "winner": winner,
                    "payout_info": payout_info,
                    "completed_at": datetime.now(timezone.utc)
                },
                "$push": {"round_history": round_doc}
            }
        )

        # Settle every open spectator side bet for this table.
        sidebet_summary = {"payouts": [], "losses": [], "settled_count": 0}
        if settle_side_bets_for_round is not None:
            try:
                sidebet_summary = await settle_side_bets_for_round(
                    table_id=table_id,
                    winner_user_id=winner.get("user_id"),
                    round_hit_six_five_four=hit_654,
                )
            except Exception as exc:  # pragma: no cover - best-effort
                import logging
                logging.getLogger(__name__).warning("side-bet settle failed: %s", exc)

        return {
            "success": True,
            "outcome": "WINNER",
            "winner": winner,
            "final_score": round_result["high_score"],
            "payout": payout_info,
            "sidebets": sidebet_summary,
            "hit_654": hit_654,
            "message": f"🏆 {winner['player_name']} WINS ${payout_info['winner_payout']}!"
        }
    
    elif round_result["outcome"] == "NO_QUALIFIERS":
        # Everyone re-ups - pot grows!
        re_up_amount = len(active_players) * table["buy_in"]
        new_pot = table["total_pot"] + re_up_amount
        
        await db.vibe654_tables.update_one(
            {"table_id": table_id},
            {
                "$set": {
                    "total_pot": new_pot,
                    "round_number": table["round_number"] + 1
                },
                "$push": {"round_history": round_doc}
            }
        )
        
        return {
            "success": True,
            "outcome": "NO_QUALIFIERS",
            "message": f"NO QUALIFIERS! Everyone re-ups ${table['buy_in']}. New pot: ${new_pot}",
            "new_pot": new_pot,
            "round_results": round_result["round_results"]
        }
    
    elif round_result["outcome"] == "TIE":
        # Tied players continue, losers eliminated.
        # Wired (2026-02-15): the inline re-up math is now delegated to
        # services.sovereign_game_logic.resolve_multi_tie (Infinite Bounty
        # Protocol §II). That gives us proper bankruptcy handling, an event
        # log, and a single source of truth for tie resolution across every
        # game on the platform.
        winners = round_result["winners"]
        losers = round_result["losers"]

        # Mark losers as eliminated
        for player in table["current_players"]:
            if any(p["user_id"] == player["user_id"] for p in losers):
                player["status"] = "eliminated"

        # Build TieContenders from the tied winners using their declared
        # buy_in capacity (each player committed `buy_in` on join, so
        # they implicitly have at least one re-up). The `balance` field is
        # symbolic for now — a future iteration will read live wallet
        # balance from db.users so genuine bankruptcies eliminate the
        # broke contender automatically.
        contenders: List[TieContender] = [
            TieContender(player_id=p["user_id"], balance=float(table["buy_in"]))
            for p in winners
        ]
        tie_resolution = resolve_multi_tie(
            players_in_tie=contenders,
            initial_bounty=float(table["buy_in"]),
            current_pot=float(table["total_pot"]),
        )

        new_pot = tie_resolution.pot

        # Sovereign-Tax projection — read-only telemetry surfaced to the UI.
        # Counts the number of ties this table has accumulated so far so the
        # founder dashboard can show "Tax revenue lift: 3.0×" in real time.
        prior_tie_rounds = sum(
            1 for h in (table.get("round_history") or [])
            if h.get("outcome") == "TIE"
        )
        tax_projection = compute_tie_tax_multiplier(
            original_pot=float(table["buy_in"]) * len(round_result["round_results"]),
            tie_rounds=prior_tie_rounds + 1,
            bounty=float(table["buy_in"]),
        )

        # Spectator side-action window — broadcast payload the room
        # WebSocket layer can dispatch to re-open the betting window.
        spectator_window = reopen_spectator_side_action(
            room_id=table_id,
            round_number=table["round_number"] + 1,
            contenders=contenders,
            current_pot=new_pot,
        )

        await db.vibe654_tables.update_one(
            {"table_id": table_id},
            {
                "$set": {
                    "current_players": table["current_players"],
                    "total_pot": new_pot,
                    "round_number": table["round_number"] + 1,
                    "last_tie_resolution": {
                        "status": tie_resolution.status,
                        "events": tie_resolution.events,
                        "knocked_out": [c.player_id for c in tie_resolution.knocked_out],
                    },
                    "last_tax_projection": tax_projection,
                },
                "$push": {"round_history": round_doc},
            },
        )

        return {
            "success": True,
            "outcome": "TIE",
            "message": f"TIE! {len(winners)} players advance. ₵{int(table['buy_in']):,} re-up. New pot: ₵{int(new_pot):,}",
            "winners": winners,
            "eliminated": losers,
            "new_pot": new_pot,
            "round_results": round_result["round_results"],
            # Sovereign engine telemetry
            "tie_resolution_status": tie_resolution.status,
            "knocked_out_for_bankruptcy": [c.player_id for c in tie_resolution.knocked_out],
            "tax_projection": tax_projection,
            "spectator_window": spectator_window,
            "sovereign_tax_rate": SOVEREIGN_TAX_RATE,
        }

@router.get("/table/{table_id}")
async def get_table_status(table_id: str) -> Dict[str, Any]:
    """Get current tournament table status"""
    table = await db.vibe654_tables.find_one(
        {"table_id": table_id},
        {"_id": 0}
    )
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Count active players
    active_count = sum(1 for p in table["current_players"] if p.get("status") == "active")
    
    return {
        "success": True,
        "table": {
            "table_id": table["table_id"],
            "table_name": table["table_name"],
            "buy_in": table["buy_in"],
            "total_pot": table["total_pot"],
            "status": table["status"],
            "round_number": table["round_number"],
            "players": table["current_players"],
            "active_players": active_count,
            "host": table["host_name"],
            "host_user_id": table.get("host_user_id"),
            "winner": table.get("winner"),
            "payout_info": table.get("payout_info"),
            "round_history": table.get("round_history", []),
            "tip_events": (table.get("tip_events") or [])[-50:],
            "hype_events": (table.get("hype_events") or [])[-50:],
            "sidebet_events": (table.get("sidebet_events") or [])[-50:],
        }
    }

@router.get("/tables/active")
async def get_active_tables(limit: int = 10) -> Dict[str, Any]:
    """Get list of active tournament tables waiting for players"""
    tables = await db.vibe654_tables.find(
        {"status": "WAITING"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "tables": tables
    }

@router.get("/history/{user_id}")
async def get_player_tournament_history(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get player's tournament history"""
    # Find tables where user participated
    tables = await db.vibe654_tables.find(
        {
            "current_players.user_id": user_id,
            "status": "COMPLETED"
        },
        {"_id": 0}
    ).sort("completed_at", -1).limit(limit).to_list(limit)
    
    history = []
    for table in tables:
        is_winner = table.get("winner", {}).get("user_id") == user_id if table.get("winner") else False
        history.append({
            "table_name": table["table_name"],
            "buy_in": table["buy_in"],
            "total_pot": table["total_pot"],
            "players_count": len(table["current_players"]),
            "winner": table.get("winner", {}).get("player_name"),
            "is_winner": is_winner,
            "payout": table.get("payout_info", {}).get("winner_payout") if is_winner else 0,
            "completed_at": table.get("completed_at")
        })
    
    return {
        "success": True,
        "history": history
    }
