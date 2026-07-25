"""
Date Night Session — match-scoped shared rooms for Global Vibez dating.

POST /api/dating-games/session/start creates a dating_game_sessions row and
bootstraps the progressive arc (warm-up → Build-a-Night → chemistry → planner).
Board arena games keep turn state on the session (not practice routes).
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from data.date_night_content import (
    ARENA_GAMES,
    BUILD_A_NIGHT_STEPS,
    DATE_NIGHT_PACKS,
    SOFT_WYR,
)
from data.dating_show_questions import ICEBREAKER_QUESTIONS
from utils.database import get_current_user, get_database

secure_random = secrets.SystemRandom()
router = APIRouter(prefix="/dating-games", tags=["dating_games", "date_night"])


# ─── Models ───────────────────────────────────────────────────────────

class StartSessionBody(BaseModel):
    match_id: str
    partner_id: str
    pack_id: str = "warm_up"


class SessionAnswerBody(BaseModel):
    question_id: str
    answer: str


class BuildChoiceBody(BaseModel):
    step_id: str
    option_id: str


class BoardMoveBody(BaseModel):
    move: Dict[str, Any]


class ReportBody(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    details: Optional[str] = Field(default=None, max_length=2000)


# ─── Board helpers ────────────────────────────────────────────────────

def _empty_board(game_type: str) -> Dict[str, Any]:
    if game_type == "tictactoe":
        return {"cells": [""] * 9, "winner": None, "draw": False}
    if game_type == "connect4":
        return {"cells": [""] * 42, "winner": None, "draw": False}  # 6x7
    if game_type == "chess":
        # Minimal date-night chess: each player places/captures on an 8x8
        # using simplified kings+pawns starter — enough for interactive play.
        return {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "moves": [],
            "winner": None,
            "draw": False,
            "simplified": True,
        }
    return {}


def _ttt_winner(cells: List[str]) -> Optional[str]:
    lines = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6),
    ]
    for a, b, c in lines:
        if cells[a] and cells[a] == cells[b] == cells[c]:
            return cells[a]
    return None


def _c4_winner(cells: List[str]) -> Optional[str]:
    def at(r: int, c: int) -> str:
        return cells[r * 7 + c]

    for r in range(6):
        for c in range(7):
            v = at(r, c)
            if not v:
                continue
            for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
                ok = True
                for i in range(1, 4):
                    rr, cc = r + dr * i, c + dc * i
                    if not (0 <= rr < 6 and 0 <= cc < 7) or at(rr, cc) != v:
                        ok = False
                        break
                if ok:
                    return v
    return None


def _apply_board_move(session: Dict[str, Any], user_id: str, move: Dict[str, Any]):
    board = dict(session.get("board") or {})
    game_type = session.get("board_game")
    p1, p2 = session["player_1_id"], session["player_2_id"]
    turn = session.get("board_turn") or p1
    if user_id != turn:
        raise HTTPException(400, "Not your turn")
    mark = "X" if user_id == p1 else "O"
    color = "crimson" if user_id == p1 else "ivory"

    if game_type == "tictactoe":
        cells = list(board.get("cells") or [""] * 9)
        idx = int(move.get("index", -1))
        if idx < 0 or idx > 8 or cells[idx]:
            raise HTTPException(400, "Invalid square")
        cells[idx] = mark
        board["cells"] = cells
        w = _ttt_winner(cells)
        if w:
            board["winner"] = p1 if w == "X" else p2
        elif all(cells):
            board["draw"] = True
    elif game_type == "connect4":
        cells = list(board.get("cells") or [""] * 42)
        col = int(move.get("column", -1))
        if col < 0 or col > 6:
            raise HTTPException(400, "Invalid column")
        placed = False
        for row in range(5, -1, -1):
            i = row * 7 + col
            if not cells[i]:
                cells[i] = color
                placed = True
                break
        if not placed:
            raise HTTPException(400, "Column full")
        board["cells"] = cells
        w = _c4_winner(cells)
        if w:
            board["winner"] = p1 if w == "crimson" else p2
        elif all(cells):
            board["draw"] = True
    elif game_type == "chess":
        # Simplified: append SAN-like move string; clients render from moves list.
        san = str(move.get("san") or move.get("uci") or "").strip()
        if not san or len(san) > 16:
            raise HTTPException(400, "Invalid chess move")
        moves = list(board.get("moves") or [])
        moves.append({"by": user_id, "san": san, "at": datetime.now(timezone.utc).isoformat()})
        board["moves"] = moves
        if move.get("resign"):
            board["winner"] = p2 if user_id == p1 else p1
        if len(moves) >= 80:
            board["draw"] = True
    else:
        raise HTTPException(400, "Unknown board game")

    next_turn = p2 if turn == p1 else p1
    if board.get("winner") or board.get("draw"):
        next_turn = None
    return board, next_turn


# ─── Session builders ─────────────────────────────────────────────────

async def _resolve_match(db, match_id: str, user_id: str, partner_id: str) -> Dict[str, Any]:
    match = await db.matches.find_one(
        {"match_id": match_id, "both_ids": {"$all": [user_id, partner_id]}},
        {"_id": 0},
    )
    if not match:
        # Some flows store dating_matches without both_ids — fall back.
        match = await db.dating_matches.find_one(
            {
                "$or": [
                    {"match_id": match_id, "user1_id": user_id, "user2_id": partner_id},
                    {"match_id": match_id, "user1_id": partner_id, "user2_id": user_id},
                ]
            },
            {"_id": 0},
        )
    if not match:
        raise HTTPException(400, "You must be matched with this person")
    return match


def _pack_payload(pack_id: str, player_1: str, player_2: str) -> Dict[str, Any]:
    pack = DATE_NIGHT_PACKS.get(pack_id)
    if not pack:
        raise HTTPException(400, f"Unknown pack '{pack_id}'")
    phases = list(pack["phases"])
    soft = secure_random.sample(SOFT_WYR, min(3, len(SOFT_WYR)))
    ice = secure_random.sample(ICEBREAKER_QUESTIONS, min(3, len(ICEBREAKER_QUESTIONS)))
    board_game = pack.get("board_game")
    board = _empty_board(board_game) if board_game else None
    return {
        "pack_id": pack_id,
        "pack_name": pack["name"],
        "phases": phases,
        "phase_index": 0,
        "current_phase": phases[0],
        "soft_wyr": soft,
        "icebreakers": ice,
        "build_steps": BUILD_A_NIGHT_STEPS if "build_a_night" in phases else [],
        "answers": {},
        "build_choices": {},
        "board_game": board_game,
        "board": board,
        "board_turn": player_1 if board_game else None,
        "chemistry": None,
        "date_plan": None,
        "status": "in_progress",
        "positive_interaction": False,
    }


# ─── Endpoints ────────────────────────────────────────────────────────

@router.get("/session/catalog")
async def session_catalog() -> Dict[str, Any]:
    """Lobby catalog — packs + arena boards."""
    packs = []
    for p in DATE_NIGHT_PACKS.values():
        packs.append(
            {
                "id": p["id"],
                "name": p["name"],
                "tagline": p["tagline"],
                "phases": p["phases"],
                "headline": p.get("headline", False),
                "board_game": p.get("board_game"),
                "arena": ARENA_GAMES.get(p["board_game"]) if p.get("board_game") else None,
            }
        )
    return {"packs": packs, "arena_games": ARENA_GAMES}


@router.post("/session/start")
async def start_date_night_session(body: StartSessionBody, request: Request) -> Dict[str, Any]:
    """Initialize a match-scoped Date Night shared session."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if body.partner_id == user.user_id:
        raise HTTPException(400, "Partner cannot be yourself")

    db = get_database()
    await _resolve_match(db, body.match_id, user.user_id, body.partner_id)

    # One active session per match
    existing = await db.dating_game_sessions.find_one(
        {
            "match_id": body.match_id,
            "mode": "date_night",
            "status": {"$in": ["waiting_for_players", "in_progress"]},
        },
        {"_id": 0},
    )
    if existing:
        return {
            "session_id": existing["session_id"],
            "redirect_to": f"/dating/date-night/{existing['session_id']}",
            "resumed": True,
            "session": existing,
        }

    payload = _pack_payload(body.pack_id, user.user_id, body.partner_id)
    session_id = f"dns_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "session_id": session_id,
        "game_id": session_id,  # alias for older clients
        "mode": "date_night",
        "match_id": body.match_id,
        "player_1_id": user.user_id,
        "player_2_id": body.partner_id,
        "host_id": user.user_id,
        "created_at": now,
        "updated_at": now,
        "room": f"date_night:{session_id}",
        "redirect_to": f"/dating/date-night/{session_id}",
        **payload,
    }
    await db.dating_game_sessions.insert_one(session)

    # Notify partner
    await db.notifications.insert_one(
        {
            "notification_id": str(uuid.uuid4()),
            "user_id": body.partner_id,
            "type": "date_night_invite",
            "title": "Date Night started",
            "message": f"{getattr(user, 'name', 'Your match')} opened a Date Night session",
            "data": {
                "session_id": session_id,
                "redirect_to": session["redirect_to"],
                "pack_id": body.pack_id,
            },
            "read": False,
            "created_at": now,
        }
    )

    # Also mirror into dating_games for PartnerQuiz-compatible polling if needed
    await db.dating_games.insert_one(
        {
            "game_id": session_id,
            "game_type": f"date_night:{body.pack_id}",
            "couple_1": [user.user_id, body.partner_id],
            "couple_2": [],
            "session_id": session_id,
            "status": "in_progress",
            "created_at": now,
        }
    )

    public = {k: v for k, v in session.items() if k != "_id"}
    return {
        "session_id": session_id,
        "redirect_to": session["redirect_to"],
        "resumed": False,
        "session": public,
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    if user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(403, "Not part of this Date Night")
    return session


@router.post("/session/{session_id}/answer")
async def submit_session_answer(
    session_id: str, body: SessionAnswerBody, request: Request
) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")
    if session["status"] != "in_progress":
        raise HTTPException(400, "Session is not active")

    phase = session["current_phase"]
    if phase not in ("soft_wyr", "icebreaker"):
        raise HTTPException(400, f"Phase '{phase}' does not accept answers")

    answers = dict(session.get("answers") or {})
    q_answers = dict(answers.get(body.question_id) or {})
    q_answers[user.user_id] = body.answer
    answers[body.question_id] = q_answers

    # Advance question cursor within phase when both answered current set
    questions = session["soft_wyr"] if phase == "soft_wyr" else session["icebreakers"]
    both_done = all(len(answers.get(q["id"], {})) >= 2 for q in questions)

    updates: Dict[str, Any] = {
        "answers": answers,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "positive_interaction": True,
    }
    if both_done:
        updates.update(_advance_phase_fields(session))

    await db.dating_game_sessions.update_one({"session_id": session_id}, {"$set": updates})
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {"success": True, "session": fresh}


@router.post("/session/{session_id}/build-choice")
async def submit_build_choice(
    session_id: str, body: BuildChoiceBody, request: Request
) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")
    if session["current_phase"] != "build_a_night":
        raise HTTPException(400, "Not in Build-a-Night phase")

    step = next((s for s in session.get("build_steps") or [] if s["id"] == body.step_id), None)
    if not step:
        raise HTTPException(400, "Unknown step")
    if not any(o["id"] == body.option_id for o in step["options"]):
        raise HTTPException(400, "Unknown option")

    choices = dict(session.get("build_choices") or {})
    step_choices = dict(choices.get(body.step_id) or {})
    step_choices[user.user_id] = body.option_id
    choices[body.step_id] = step_choices

    updates: Dict[str, Any] = {
        "build_choices": choices,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "positive_interaction": True,
    }

    # When both players answered every step, merge preferences + advance
    steps = session.get("build_steps") or []
    if all(len(choices.get(s["id"], {})) >= 2 for s in steps):
        prefs = _merge_build_prefs(steps, choices, session["player_1_id"], session["player_2_id"])
        updates["build_preferences"] = prefs
        updates.update(_advance_phase_fields(session))

    await db.dating_game_sessions.update_one({"session_id": session_id}, {"$set": updates})
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {"success": True, "session": fresh}


@router.post("/session/{session_id}/board-move")
async def board_move(session_id: str, body: BoardMoveBody, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")
    if session["current_phase"] != "board":
        raise HTTPException(400, "Not in board arena phase")

    board, next_turn = _apply_board_move(session, user.user_id, body.move)
    updates: Dict[str, Any] = {
        "board": board,
        "board_turn": next_turn,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "positive_interaction": True,
    }
    if board.get("winner") or board.get("draw"):
        updates.update(_advance_phase_fields(session))

    await db.dating_game_sessions.update_one({"session_id": session_id}, {"$set": updates})
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {"success": True, "session": fresh}


@router.post("/session/{session_id}/advance")
async def advance_session(session_id: str, request: Request) -> Dict[str, Any]:
    """Host/partner can manually skip a completed phase (e.g. after viewing chemistry)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")

    updates = _advance_phase_fields(session)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dating_game_sessions.update_one({"session_id": session_id}, {"$set": updates})
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {"success": True, "session": fresh}


@router.post("/session/{session_id}/chemistry")
async def session_chemistry(session_id: str, request: Request) -> Dict[str, Any]:
    """Compute chemistry for the session and stash on the match."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")

    partner_id = (
        session["player_2_id"]
        if user.user_id == session["player_1_id"]
        else session["player_1_id"]
    )
    chemistry = _score_chemistry(session)
    await db.dating_game_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "chemistry": chemistry,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    # Persist on both match collections used in the wild
    for coll in ("matches", "dating_matches"):
        await db[coll].update_one(
            {
                "$or": [
                    {"match_id": session["match_id"]},
                    {
                        "both_ids": {
                            "$all": [session["player_1_id"], session["player_2_id"]]
                        }
                    },
                    {
                        "user1_id": session["player_1_id"],
                        "user2_id": session["player_2_id"],
                    },
                    {
                        "user1_id": session["player_2_id"],
                        "user2_id": session["player_1_id"],
                    },
                ]
            },
            {
                "$set": {"chemistry_score": chemistry["chemistry_score"]},
                "$inc": {"games_played": 1},
            },
        )

    # Align with legacy /dating/chemistry/calculate shape
    return {
        "success": True,
        "chemistry_score": chemistry["chemistry_score"],
        "insights": chemistry["insights"],
        "openers": chemistry["openers"],
        "partner_id": partner_id,
        "session_id": session_id,
    }


@router.post("/session/{session_id}/plan")
async def session_to_planner(session_id: str, request: Request) -> Dict[str, Any]:
    """Handoff Build-a-Night choices into AI Date Planner."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")

    prefs = session.get("build_preferences") or {}
    if not prefs:
        raise HTTPException(400, "Finish Build-a-Night choices first")

    u1 = await db.users.find_one({"user_id": session["player_1_id"]}, {"_id": 0}) or {}
    u2 = await db.users.find_one({"user_id": session["player_2_id"]}, {"_id": 0}) or {}
    # Prefer dating_profile overlays
    for u in (u1, u2):
        dp = u.get("dating_profile") or {}
        for k in ("age", "location", "interests", "favorite_games", "bio"):
            if dp.get(k) and not u.get(k):
                u[k] = dp[k]
        u.setdefault("username", u.get("name") or u.get("display_name") or "Player")

    from routes.ai_date_planner import generate_date_plan  # noqa: PLC0415

    plan = await generate_date_plan(u1, u2, preferences=prefs)
    # Stamp Build-a-Night prefs into plan metadata
    plan_doc = {
        "plan_id": f"plan_{uuid.uuid4().hex[:10]}",
        "match_id": session["match_id"],
        "session_id": session_id,
        "source": "build_a_night",
        "preferences": prefs,
        "restaurant_suggestion": plan.get("restaurant"),
        "activity_suggestion": plan.get("activity"),
        "game_suggestion": plan.get("game"),
        "full_itinerary": plan.get("itinerary"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_id,
    }
    await db.date_plans.insert_one(plan_doc)
    await db.dating_game_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "date_plan": {k: v for k, v in plan_doc.items() if k != "_id"},
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {
        "success": True,
        "plan": {k: v for k, v in plan_doc.items() if k != "_id"},
        "redirect_to": f"/ai-date-planner?match_id={session['match_id']}&plan_id={plan_doc['plan_id']}",
        "session": fresh,
    }


@router.post("/session/{session_id}/end")
async def end_session(session_id: str, request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")
    await db.dating_game_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "ended",
                "ended_by": user.user_id,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "current_phase": "ended",
            }
        },
    )
    fresh = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    await _emit_session(session_id, fresh)
    return {"success": True, "session": fresh}


@router.post("/session/{session_id}/report")
async def report_session(
    session_id: str, body: ReportBody, request: Request
) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    session = await db.dating_game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session or user.user_id not in (session["player_1_id"], session["player_2_id"]):
        raise HTTPException(404, "Session not found")
    partner = (
        session["player_2_id"]
        if user.user_id == session["player_1_id"]
        else session["player_1_id"]
    )
    report = {
        "report_id": f"dnrep_{uuid.uuid4().hex[:10]}",
        "session_id": session_id,
        "match_id": session["match_id"],
        "reporter_id": user.user_id,
        "reported_user_id": partner,
        "reason": body.reason,
        "details": body.details,
        "source": "date_night_session",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    await db.user_reports.insert_one(report)
    return {"success": True, "report_id": report["report_id"]}


# Also expose POST /dating-games/start alias enhancement via thin wrapper
class StartDatingGameAlias(BaseModel):
    game_type: str = "date_night"
    partner_id: str
    match_id: Optional[str] = None
    pack_id: str = "warm_up"
    tournament_id: Optional[str] = None
    opponent_couple_ids: Optional[List[str]] = None


@router.post("/start-session")
async def start_session_alias(body: StartSessionBody, request: Request) -> Dict[str, Any]:
    """Alias kept for clarity — same as /session/start."""
    return await start_date_night_session(body, request)


# ─── Internals ────────────────────────────────────────────────────────

def _advance_phase_fields(session: Dict[str, Any]) -> Dict[str, Any]:
    phases = list(session.get("phases") or [])
    idx = int(session.get("phase_index") or 0) + 1
    if idx >= len(phases):
        return {
            "phase_index": len(phases) - 1,
            "current_phase": "complete",
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    return {"phase_index": idx, "current_phase": phases[idx]}


def _merge_build_prefs(
    steps: List[Dict[str, Any]],
    choices: Dict[str, Any],
    p1: str,
    p2: str,
) -> Dict[str, Any]:
    prefs: Dict[str, Any] = {"player_picks": {}, "consensus": {}}
    for step in steps:
        key = step["key"]
        sc = choices.get(step["id"]) or {}
        a, b = sc.get(p1), sc.get(p2)
        prefs["player_picks"][key] = {p1: a, p2: b}
        # Consensus: same pick wins; else keep both as "mixed"
        prefs["consensus"][key] = a if a == b else f"mixed:{a}+{b}"
    return prefs


def _score_chemistry(session: Dict[str, Any]) -> Dict[str, Any]:
    score = 52
    answers = session.get("answers") or {}
    sync = 0
    total = 0
    for _qid, pair in answers.items():
        if len(pair) >= 2:
            total += 1
            vals = list(pair.values())
            if str(vals[0]).strip().lower() == str(vals[1]).strip().lower():
                sync += 1
                score += 8
    if session.get("positive_interaction"):
        score += 8
    if session.get("build_preferences"):
        score += 10
        cons = (session["build_preferences"].get("consensus") or {})
        agree = sum(1 for v in cons.values() if not str(v).startswith("mixed:"))
        score += agree * 4
    board = session.get("board") or {}
    if board.get("winner") or board.get("draw"):
        score += 10
        if board.get("draw"):
            score += 5  # close game vibes
    score = min(100, score)
    insights = []
    openers = []
    if score >= 80:
        insights += ["Strong connection detected.", "You two sync on the little things."]
        openers.append("We matched on so many picks — coffee this week?")
    elif score >= 60:
        insights += ["Good chemistry spark.", "A few delightful disagreements to explore."]
        openers.append("Okay that Build-a-Night was fun — which pick should we actually do?")
    else:
        insights += ["Still warming up — keep playing."]
        openers.append("Rematch? I want a second round to figure you out.")
    if sync and total:
        insights.append(f"You agreed on {sync}/{total} warm-up answers.")
    return {
        "chemistry_score": score,
        "insights": insights,
        "openers": openers,
        "sync_count": sync,
        "answered_pairs": total,
    }


async def _emit_session(session_id: str, session: Optional[Dict[str, Any]]) -> None:
    try:
        from services.multiplayer import sio  # noqa: PLC0415

        await sio.emit(
            "date_night_session",
            {"session_id": session_id, "session": session},
            room=f"date_night:{session_id}",
        )
    except Exception:
        # Socket optional — HTTP polling remains the source of truth
        pass
