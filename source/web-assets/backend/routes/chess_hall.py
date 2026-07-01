"""
Chess Puzzles + Blitz + Tournament — backend support for the Chess Hall
(founder ask 2026-05-10, option 4b+c).

Puzzles: curated catalog of FEN positions with solutions. No external API
dependency — the catalog is checked in here so it works offline.

Blitz: pure client-side timer; backend just records results.

Tournament: simple bracket queue. Players join a queue; when 4 are
waiting, a bracket is created with 2 first-round matches.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()


# ── Curated puzzle catalog ──────────────────────────────────────────
# Each puzzle: FEN starting position + the winning move sequence (UCI
# notation) + a short hint. These are classic mate-in-N positions.
PUZZLES: List[Dict[str, Any]] = [
    {
        "id": "p001",
        "rating": 800,
        "theme": "mate_in_1",
        "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "solution": ["e1e8"],
        "hint": "Back-rank weakness — the rook has nowhere to hide.",
    },
    {
        "id": "p002",
        "rating": 1000,
        "theme": "mate_in_2",
        "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
        "solution": ["h5f7"],
        "hint": "Scholar's mate — knight and bishop guard the king.",
    },
    {
        "id": "p003",
        "rating": 1200,
        "theme": "fork",
        "fen": "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
        "solution": ["e5g6"],
        "hint": "A knight fork wins the queen.",
    },
    {
        "id": "p004",
        "rating": 1400,
        "theme": "pin",
        "fen": "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
        "solution": ["d1a4"],
        "hint": "Pin the bishop — it's defending nothing.",
    },
    {
        "id": "p005",
        "rating": 1600,
        "theme": "sacrifice",
        "fen": "r4rk1/pp3ppp/2p1bn2/q1Pp4/3P4/P1N1PN2/1P3PPP/R2QK2R w KQ - 0 1",
        "solution": ["c3d5"],
        "hint": "Sacrifice the knight — the d-pawn falls and so does Black.",
    },
    {
        "id": "p006",
        "rating": 1800,
        "theme": "mate_in_3",
        "fen": "r1bqr1k1/pp1n1pbp/2pp1np1/4p3/2PPP3/2N1BP2/PP1QN1PP/R3KB1R w KQ - 0 1",
        "solution": ["e3h6"],
        "hint": "Trade the bishop, expose the king, finish with the queen.",
    },
]


class StartPuzzleResponse(BaseModel):
    id: str
    rating: int
    theme: str
    fen: str
    hint: str


class SubmitMovePayload(BaseModel):
    puzzle_id: str
    move_uci: str = Field(min_length=4, max_length=5)


class RecordResultPayload(BaseModel):
    mode: str = Field(min_length=3, max_length=24)  # blitz | puzzle | tournament
    outcome: str  # win | loss | draw
    duration_s: Optional[int] = Field(default=None, ge=0, le=86400)
    rating_delta: Optional[int] = Field(default=None, ge=-500, le=500)


@router.get("/chess/puzzles/daily")
async def daily_puzzle():
    """One puzzle per UTC day — deterministic so all players see the same one."""
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Pick by day-of-year mod len so it rotates daily.
    idx = (sum(ord(c) for c in day)) % len(PUZZLES)
    p = PUZZLES[idx]
    return {
        "day": day,
        "puzzle": {k: p[k] for k in ("id", "rating", "theme", "fen", "hint")},
    }


@router.get("/chess/puzzles/list")
async def list_puzzles():
    """Return puzzle index for the in-app puzzle picker (no solutions leaked)."""
    return {
        "count": len(PUZZLES),
        "puzzles": [
            {k: p[k] for k in ("id", "rating", "theme", "fen", "hint")}
            for p in PUZZLES
        ],
    }


@router.post("/chess/puzzles/submit")
async def submit_move(payload: SubmitMovePayload, http_request: Request):
    """Validate a move against the puzzle's solution. Returns whether the
    move was correct + (if correct AND there are more moves) the
    opponent's reply."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    puzzle = next((p for p in PUZZLES if p["id"] == payload.puzzle_id), None)
    if not puzzle:
        raise HTTPException(404, "Puzzle not found")
    expected = puzzle["solution"][0]
    correct = payload.move_uci == expected
    return {
        "correct": correct,
        "expected": expected if not correct else None,
        "solved": correct and len(puzzle["solution"]) == 1,
        "next_expected": puzzle["solution"][1] if correct and len(puzzle["solution"]) > 1 else None,
    }


@router.post("/chess/results")
async def record_result(payload: RecordResultPayload, http_request: Request):
    """Append a chess result row. Powers the Chess Hall stats card."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if payload.mode not in {"blitz", "puzzle", "tournament", "classic", "multiplayer"}:
        raise HTTPException(400, "Unknown chess mode")
    if payload.outcome not in {"win", "loss", "draw"}:
        raise HTTPException(400, "Unknown outcome")
    db = get_database()
    row = {
        "result_id": f"cr_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "mode": payload.mode,
        "outcome": payload.outcome,
        "duration_s": payload.duration_s,
        "rating_delta": payload.rating_delta,
        "played_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chess_results.insert_one(row)
    row.pop("_id", None)
    return row


@router.get("/chess/stats")
async def chess_stats(http_request: Request, limit: int = 20):
    """Caller's recent results + a small per-mode tally for the lobby."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.chess_results.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("played_at", -1).limit(max(1, min(int(limit), 100)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=100)
    # Tally wins/losses/draws per mode.
    tally: Dict[str, Dict[str, int]] = {}
    for r in rows:
        mode = r["mode"]
        tally.setdefault(mode, {"win": 0, "loss": 0, "draw": 0})
        tally[mode][r["outcome"]] = tally[mode].get(r["outcome"], 0) + 1
    return {"count": len(rows), "rows": rows, "tally_by_mode": tally}


@router.post("/chess/tournament/join")
async def join_tournament(http_request: Request):
    """Add the caller to the active tournament queue. When the queue
    reaches 4, instantly create a bracket and return it.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    # Check if user already queued.
    existing = await db.chess_tournament_queue.find_one(
        {"user_id": user.user_id, "status": "waiting"}, {"_id": 0}
    )
    if not existing:
        await db.chess_tournament_queue.insert_one({
            "queue_id": f"q_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id,
            "status": "waiting",
            "joined_at": datetime.now(timezone.utc).isoformat(),
        })

    # Check if we now have 4 waiting players → fire a bracket.
    waiting = await db.chess_tournament_queue.find(
        {"status": "waiting"}, {"_id": 0}
    ).sort("joined_at", 1).limit(4).to_list(length=4)

    if len(waiting) >= 4:
        bracket_id = f"br_{uuid.uuid4().hex[:10]}"
        players = [w["user_id"] for w in waiting]
        bracket = {
            "bracket_id": bracket_id,
            "players": players,
            "round_1": [
                {"player_a": players[0], "player_b": players[1], "winner": None},
                {"player_a": players[2], "player_b": players[3], "winner": None},
            ],
            "final": None,
            "champion": None,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.chess_tournament_brackets.insert_one(bracket)
        # Move all 4 from queue to playing.
        await db.chess_tournament_queue.update_many(
            {"user_id": {"$in": players}, "status": "waiting"},
            {"$set": {"status": "playing", "bracket_id": bracket_id}},
        )
        bracket.pop("_id", None)
        return {"status": "bracket_created", "bracket": bracket}

    return {"status": "waiting", "in_queue": len(waiting), "needed": 4 - len(waiting)}


@router.get("/chess/tournament/status")
async def tournament_status(http_request: Request):
    """Caller's current tournament status (queued / playing / idle)."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    row = await db.chess_tournament_queue.find_one(
        {"user_id": user.user_id, "status": {"$in": ["waiting", "playing"]}},
        {"_id": 0},
        sort=[("joined_at", -1)],
    )
    if not row:
        return {"status": "idle"}
    if row["status"] == "playing":
        bracket = await db.chess_tournament_brackets.find_one(
            {"bracket_id": row.get("bracket_id")}, {"_id": 0}
        )
        return {"status": "playing", "bracket": bracket}
    queue_size = await db.chess_tournament_queue.count_documents({"status": "waiting"})
    return {"status": "waiting", "in_queue": queue_size, "needed": max(0, 4 - queue_size)}
