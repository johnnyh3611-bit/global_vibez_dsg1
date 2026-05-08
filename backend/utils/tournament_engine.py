"""
Tournament engine — state machine, scoring, prize distribution, auto-scheduler.

Data model (MongoDB collections):
  tournament_templates   — scheduled recurring tournaments (seeded at boot)
  tournaments            — live/past tournament instances
  tournament_entries     — per-user participation record
  tournament_scores      — per-round score submissions

Tournament lifecycle:
  CREATED → OPEN (players can join) → RUNNING (rounds play out) → FINALIZING → COMPLETED

Auto-scheduler:
  Runs every 60s. For each template, if no upcoming instance exists for the
  next occurrence slot, create one. Also finalize any RUNNING tournaments
  whose window has closed.
"""
import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from utils.database import get_database
from utils.tournament_templates import TEMPLATES


# ==================== SCORING ====================

def score_round(scoring: str, raw: Dict[str, Any]) -> float:
    """
    Normalize per-game scores to a 0-1000 scale so rounds are comparable
    across different games.
    """
    if scoring == "spades_score":
        bid = int(raw.get("bid", 0))
        tricks = int(raw.get("tricks", 0))
        bags = int(raw.get("bags", 0))
        made = tricks >= bid
        base = (bid * 10) if made else -bid * 10
        return max(0.0, min(1000.0, 500 + base + tricks * 15 - bags * 5))

    if scoring == "blackjack_pnl":
        pnl = float(raw.get("net_coins", 0))
        # Normalize: 10K net gain = 1000, zero = 500, -10K = 0
        return max(0.0, min(1000.0, 500.0 + pnl / 20.0))

    if scoring == "poker_stack":
        stack = float(raw.get("final_stack", 100000))
        # Start 100K. Doubling = 1000, halving = 0.
        return max(0.0, min(1000.0, (stack / 200_000.0) * 1000.0))

    if scoring == "rummy_deadwood":
        dw = float(raw.get("final_deadwood", 100))
        gin = bool(raw.get("gin", False))
        base = max(0.0, 100.0 - dw) * 5.0
        return max(0.0, min(1000.0, base + (250 if gin else 0)))

    if scoring == "bid_whist_score":
        bid = int(raw.get("bid", 0))
        made = bool(raw.get("made", False))
        uptown = bool(raw.get("uptown", True))
        multiplier = 1.2 if not uptown else 1.0  # downtown pays bonus
        base = (bid * 80) if made else -bid * 40
        return max(0.0, min(1000.0, 500 + base * multiplier))

    return 0.0


# ==================== SIMULATION (for bracket bot-filler) ====================

def simulate_bot_score(scoring: str, difficulty: float = 0.5) -> float:
    """Produce a bot score centered around difficulty * 1000 with normal jitter."""
    mean = 300 + difficulty * 500  # difficulty 0 → 300, 1 → 800
    score = random.gauss(mean, 120)
    return max(0.0, min(1000.0, score))


# ==================== PUBLIC API ====================

async def create_tournament_from_template(template_id: str, scheduled_for: datetime) -> Dict[str, Any]:
    db = get_database()
    tpl = await db.tournament_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not tpl:
        raise ValueError(f"No template {template_id}")

    tid = f"t_{template_id}_{scheduled_for.strftime('%Y%m%d_%H%M')}"
    # Idempotent: skip if exists
    existing = await db.tournaments.find_one({"tournament_id": tid}, {"_id": 0})
    if existing:
        return existing

    ends = scheduled_for + timedelta(hours=tpl.get("duration_hours", 4))
    doc = {
        "tournament_id": tid,
        "template_id": template_id,
        "name": tpl["name"],
        "format": tpl["format"],
        "rounds": tpl["rounds"],
        "status": "OPEN",
        "starts_at": scheduled_for.isoformat(),
        "ends_at": ends.isoformat(),
        "free_daily_entry": tpl.get("free_daily_entry", False),
        "retry_buy_in_coins": tpl.get("retry_buy_in_coins", 0),
        "prize_pool_vibez": float(tpl.get("prize_pool_seed_vibez", 0)),
        "prize_pool_coins": int(tpl.get("prize_pool_seed_coins", 0)),
        "prize_split": tpl.get("prize_split", [1.0]),
        "max_participants": tpl.get("max_participants", 1000),
        "participant_count": 0,
        "description": tpl.get("description", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tournaments.insert_one(doc)
    return doc


async def enter_tournament(tournament_id: str, user_id: str, is_free_entry: bool = True) -> Dict[str, Any]:
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        return {"error": "Tournament not found"}
    if t["status"] not in ("OPEN", "RUNNING"):
        return {"error": f"Tournament is {t['status']}"}
    if t["participant_count"] >= t["max_participants"]:
        return {"error": "Tournament full"}

    # Already entered?
    prior = await db.tournament_entries.find_one(
        {"tournament_id": tournament_id, "user_id": user_id}, {"_id": 0},
    )

    # Entry cost handling
    if is_free_entry:
        # Only the first entry per-day-per-template can be free
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        free_used = await db.tournament_entries.find_one({
            "user_id": user_id,
            "template_id": t["template_id"],
            "free_entry_date": today_key,
        }, {"_id": 0})
        if free_used and (not prior or prior.get("entry_count", 0) > 0):
            # They already used their free today; require paid retry
            is_free_entry = False

    buy_in = 0
    if not is_free_entry and t["retry_buy_in_coins"] > 0:
        buy_in = t["retry_buy_in_coins"]
        # Atomic: only deduct if balance is sufficient. Prevents race
        # conditions on concurrent paid-retry spam.
        update_res = await db.users.update_one(
            {"user_id": user_id, "balance_coins": {"$gte": buy_in}},
            {"$inc": {"balance_coins": -buy_in}},
        )
        if update_res.modified_count == 0:
            return {"error": f"Insufficient ₵. Need {buy_in:,}."}
        # 50% of buy-in goes to pot (cashable), 50% house
        pot_bump = buy_in * 0.5
        await db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {"$inc": {"prize_pool_coins": int(pot_bump)}},
        )

    entry_doc = {
        "tournament_id": tournament_id,
        "template_id": t["template_id"],
        "user_id": user_id,
        "joined_at": now,
        "free_entry_date": datetime.now(timezone.utc).strftime("%Y-%m-%d") if is_free_entry else None,
        "entry_count": (prior or {}).get("entry_count", 0) + 1,
        "buy_in_paid": buy_in,
        "total_score": 0.0,
        "rounds_completed": 0,
        "rounds_total": len(t["rounds"]),
        "status": "ACTIVE",
    }
    if prior:
        await db.tournament_entries.update_one(
            {"tournament_id": tournament_id, "user_id": user_id},
            {"$set": {**entry_doc}, "$setOnInsert": {"created_at": now}},
        )
    else:
        await db.tournament_entries.insert_one({**entry_doc, "created_at": now})
        await db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {"$inc": {"participant_count": 1}, "$set": {"status": "RUNNING"}},
        )

    return {"ok": True, "tournament_id": tournament_id, "free_entry": is_free_entry, "buy_in_paid": buy_in}


async def submit_round_score(tournament_id: str, user_id: str, round_num: int, raw_score: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t or t["status"] not in ("OPEN", "RUNNING"):
        return {"error": "Tournament not active"}
    entry = await db.tournament_entries.find_one(
        {"tournament_id": tournament_id, "user_id": user_id}, {"_id": 0},
    )
    if not entry:
        return {"error": "Not entered"}

    round_def = next((r for r in t["rounds"] if r["round"] == round_num), None)
    if not round_def:
        return {"error": f"No round {round_num}"}

    score = score_round(round_def["scoring"], raw_score)

    await db.tournament_scores.insert_one({
        "tournament_id": tournament_id,
        "user_id": user_id,
        "round": round_num,
        "game": round_def["game"],
        "raw": raw_score,
        "normalized_score": score,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Update entry
    new_total = entry["total_score"] + score
    new_completed = entry["rounds_completed"] + 1
    update: Dict[str, Any] = {
        "total_score": new_total,
        "rounds_completed": new_completed,
    }
    if new_completed >= entry["rounds_total"]:
        update["status"] = "COMPLETED"
    await db.tournament_entries.update_one(
        {"tournament_id": tournament_id, "user_id": user_id},
        {"$set": update},
    )
    return {"ok": True, "round_score": round(score, 2), "total_score": round(new_total, 2), "rounds_completed": new_completed}


async def get_leaderboard(tournament_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    entries = await db.tournament_entries.find(
        {"tournament_id": tournament_id},
        {"_id": 0},
    ).sort("total_score", -1).limit(limit).to_list(length=limit)
    # Decorate with usernames
    user_ids = [e["user_id"] for e in entries]
    users = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"user_id": 1, "username": 1, "_id": 0}
    ).to_list(length=len(user_ids))
    name_map = {u["user_id"]: u.get("username", u["user_id"]) for u in users}
    return [
        {
            "rank": i + 1,
            "user_id": e["user_id"],
            "username": name_map.get(e["user_id"], e["user_id"]),
            "total_score": round(e["total_score"], 2),
            "rounds_completed": e["rounds_completed"],
            "rounds_total": e["rounds_total"],
            "status": e.get("status", "ACTIVE"),
        }
        for i, e in enumerate(entries)
    ]


async def finalize_tournament(tournament_id: str) -> Dict[str, Any]:
    """Distribute prizes based on prize_split to top finishers."""
    db = get_database()
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        return {"error": "Not found"}
    if t["status"] == "COMPLETED":
        return {"ok": True, "already_finalized": True}

    # For bracket: fill empty slots with simulated bot scores before final ranking.
    if t["format"] == "bracket_16":
        human_count = t.get("participant_count", 0)
        needed = max(0, t["max_participants"] - human_count)
        for i in range(needed):
            bot_uid = f"bot_{tournament_id}_{i}"
            await db.tournament_entries.insert_one({
                "tournament_id": tournament_id,
                "template_id": t["template_id"],
                "user_id": bot_uid,
                "joined_at": datetime.now(timezone.utc).isoformat(),
                "total_score": sum(simulate_bot_score(r["scoring"], 0.35 + random.random() * 0.4) for r in t["rounds"]),
                "rounds_completed": len(t["rounds"]),
                "rounds_total": len(t["rounds"]),
                "status": "COMPLETED",
                "is_bot": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    leaderboard = await get_leaderboard(tournament_id, limit=len(t["prize_split"]))
    splits = t["prize_split"]
    pot_vibez = float(t.get("prize_pool_vibez", 0))
    pot_coins = int(t.get("prize_pool_coins", 0))
    results: List[Dict[str, Any]] = []

    for i, row in enumerate(leaderboard):
        if i >= len(splits):
            break
        share = splits[i]
        prize_vibez = round(pot_vibez * share, 2)
        prize_coins = int(pot_coins * share)
        # Bots don't get paid
        is_bot = row["user_id"].startswith("bot_")
        if not is_bot and (prize_vibez > 0 or prize_coins > 0):
            # 50/50 split per user direction: half in $DSG, half in ₵
            # But the prize_split fractions are already what the user wins total.
            # Here we keep coins fully credited and $DSG goes through record_event
            if prize_coins > 0:
                await db.users.update_one(
                    {"user_id": row["user_id"]},
                    {"$inc": {"balance_coins": prize_coins}},
                )
            if prize_vibez > 0:
                # Attribute as a custom mining event (tournament win). Skip shadow/eligibility
                # checks for pure prize distribution — write directly to ledger.
                now_iso = datetime.now(timezone.utc).isoformat()
                hold_until = (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat()
                await db.vibez_mining_ledger.insert_one({
                    "user_id": row["user_id"],
                    "event": "tournament_prize",
                    "tournament_id": tournament_id,
                    "mined": prize_vibez,
                    "status": "PENDING_VIBE_CHECK",
                    "hold_until": hold_until,
                    "created_at": now_iso,
                })
                await db.vibez_mining_balance.update_one(
                    {"user_id": row["user_id"]},
                    {
                        "$inc": {"pending_balance": prize_vibez, "lifetime_mined": prize_vibez},
                        "$setOnInsert": {"user_id": row["user_id"], "balance": 0.0, "created_at": now_iso},
                    },
                    upsert=True,
                )
        results.append({
            "rank": row["rank"],
            "user_id": row["user_id"],
            "username": row["username"],
            "score": row["total_score"],
            "prize_vibez": prize_vibez,
            "prize_coins": prize_coins,
            "is_bot": is_bot,
        })

    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {
            "status": "COMPLETED",
            "finalized_at": datetime.now(timezone.utc).isoformat(),
            "results": results,
        }},
    )

    # Auto-pin the top-3 celebration message in the tournament chat room.
    try:
        from routes.tournament_chat import post_system_message
        top3 = [r for r in results if not r.get("is_bot")][:3]
        if top3:
            medals = ["🥇", "🥈", "🥉"]
            lines = [
                f"{medals[i]} {r['username']} · {r['score']:.1f} pts · "
                f"{r['prize_vibez']:.2f} $DSG + ₵{r['prize_coins']:,}"
                for i, r in enumerate(top3)
            ]
            await post_system_message(
                tournament_id,
                "🏆 Tournament complete!\n" + "\n".join(lines),
                pinned=True,
            )
    except Exception as e:  # pragma: no cover — never let chat break finalize
        print(f"[tournament_engine] chat pin failed: {e}")

    return {"ok": True, "results": results}


# ==================== AUTO-SCHEDULER ====================

def _next_slot_for(cron: str, now: datetime) -> Optional[datetime]:
    """
    Super simple cron interpreter supporting:
        - "daily@HH:MM"           — next UTC HH:MM
        - "weekly@<day>@HH:MM"    — next <mon|tue|...|sat|sun> at HH:MM UTC
        - "every_Nh"              — next multiple of N hours UTC
    """
    parts = cron.split("@")
    if cron.startswith("every_") and cron.endswith("h"):
        try:
            n = int(cron[len("every_"):-1])
        except ValueError:
            return None
        if n <= 0:
            return None
        next_hour = ((now.hour // n) + 1) * n
        day_offset = 0
        if next_hour >= 24:
            next_hour -= 24
            day_offset = 1
        return (now + timedelta(days=day_offset)).replace(hour=next_hour, minute=0, second=0, microsecond=0)

    if parts[0] == "daily" and len(parts) == 2:
        h, m = [int(x) for x in parts[1].split(":")]
        candidate = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    if parts[0] == "weekly" and len(parts) == 3:
        day_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
        day = day_map.get(parts[1].lower())
        if day is None:
            return None
        h, m = [int(x) for x in parts[2].split(":")]
        candidate = now.replace(hour=h, minute=m, second=0, microsecond=0)
        days_ahead = (day - candidate.weekday()) % 7
        if days_ahead == 0 and candidate <= now:
            days_ahead = 7
        return candidate + timedelta(days=days_ahead)

    return None


async def scheduler_tick() -> Dict[str, Any]:
    """
    Runs every minute (called by the background task). For each template,
    if no OPEN/RUNNING tournament exists for the upcoming slot, create one.
    Also finalizes any tournaments past their ends_at.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    created = 0
    finalized = 0

    # 1. Create upcoming tournaments
    templates = await db.tournament_templates.find({}, {"_id": 0}).to_list(length=100)
    for tpl in templates:
        slot = _next_slot_for(tpl["schedule_cron"], now)
        if not slot:
            continue
        try:
            tid = f"t_{tpl['template_id']}_{slot.strftime('%Y%m%d_%H%M')}"
            existing = await db.tournaments.find_one({"tournament_id": tid}, {"tournament_id": 1, "_id": 0})
            if not existing:
                await create_tournament_from_template(tpl["template_id"], slot)
                created += 1
        except Exception as e:
            print(f"[scheduler] failed to create {tpl['template_id']}: {e}")

    # 2. Finalize expired
    expiring = await db.tournaments.find(
        {"status": {"$in": ["OPEN", "RUNNING"]}, "ends_at": {"$lt": now.isoformat()}},
        {"tournament_id": 1, "_id": 0},
    ).to_list(length=50)
    for e in expiring:
        try:
            await finalize_tournament(e["tournament_id"])
            finalized += 1
        except Exception as ex:
            print(f"[scheduler] finalize failed {e['tournament_id']}: {ex}")

    return {"created": created, "finalized": finalized, "now": now.isoformat()}


async def scheduler_loop(interval_sec: int = 60) -> None:
    """Background loop spawned on app startup."""
    # Seed templates once
    db = get_database()
    for tpl in TEMPLATES:
        await db.tournament_templates.update_one(
            {"template_id": tpl["template_id"]},
            {"$set": tpl},
            upsert=True,
        )
    # First tick immediately so the lobby isn't empty on fresh boot
    try:
        await scheduler_tick()
    except Exception as e:
        print(f"[scheduler] first tick error: {e}")

    while True:
        await asyncio.sleep(interval_sec)
        try:
            result = await scheduler_tick()
            if result["created"] or result["finalized"]:
                print(f"[scheduler] {result}")
        except Exception as e:
            print(f"[scheduler] tick error: {e}")
