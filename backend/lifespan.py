"""
Startup hooks — extracted from server.py for clarity.

Two functions:
  • register_startup_tasks(app, logger)  — wires the @app.on_event("startup")
    that fans out background asyncio tasks (Card Royale scheduler, daily
    report, VibeRidez hydrate, Solana indexer, profit-share scheduler,
    economy auto-pilot, Apex evolution scheduler, DB-index creation).
  • register_shutdown(app)                — closes the shared motor client.

Optional schedulers stay wrapped in try/except so a single failing import
never takes startup down.
"""
from __future__ import annotations

import asyncio
import logging
import os

from utils.database import get_database
from config import get_client


def register_startup_tasks(app, logger: logging.Logger) -> None:
    """Wire the FastAPI startup event. Must be called BEFORE the app
    starts (i.e. while the module is still importing)."""

    @app.on_event("startup")
    async def _startup_db_indexes():
        # Mongo health-check (founder fix Feb 2026): ping the DB BEFORE
        # we kick off any background scheduler. If Mongo is unreachable
        # at boot, log loudly and abort startup with a clear message
        # instead of letting every request silently 500. Supervisor's
        # `autorestart=true` will retry until Mongo comes back online.
        try:
            client = get_client()
            # 5-second timeout — generous enough for cold cluster wake
            # but short enough to fail fast in dev/CI.
            await asyncio.wait_for(client.admin.command("ping"), timeout=5.0)
            logger.info("Mongo ping OK — proceeding with startup.")
        except Exception as ping_err:
            logger.error(
                "FATAL: Mongo ping failed at startup (%s). "
                "All API requests will return 500 until Mongo is reachable. "
                "Check `sudo supervisorctl status mongod` and disk usage.",
                ping_err,
            )
            # Don't raise — let supervisor's autorestart logic kick in
            # naturally. Raising here would just put us in a tight crash
            # loop; logging loudly is enough to surface the issue.

        logger.info("Creating database indexes...")
        asyncio.create_task(_create_indexes_async(logger))

        # Suppress every background scheduler in test/CI environments to
        # avoid cross-test state churn. Both env names are accepted —
        # DISABLE_BG_SCHEDULERS is the new clearer name; the legacy
        # DISABLE_CARD_ROYALE_SCHEDULER is kept for backward-compat with
        # existing test runners.
        if (
            os.environ.get("DISABLE_BG_SCHEDULERS") == "1"
            or os.environ.get("DISABLE_CARD_ROYALE_SCHEDULER") == "1"
        ):
            return

        _kick_off("Card Royale scheduler", _start_card_royale, logger)
        _kick_off("Daily Vibez recon report scheduler",
                  _start_daily_report, logger)
        _kick_off("VibeRidez driver hydrate", _start_viberidez_hydrate,
                  logger, log_success=False)
        _kick_off("Solana indexer", _start_solana_indexer, logger,
                  log_success=False)
        _kick_off("Profit-share scheduler", _start_profit_share, logger)
        _kick_off("Economy auto-pilot scheduler",
                  _start_auto_pilot, logger,
                  success_msg="Economy auto-pilot scheduler started (1-hour ticks)")
        _kick_off("Apex evolution scheduler",
                  _start_apex_evolution, logger)
        _kick_off("VibeRidez USDC payout daemon",
                  _start_usdc_payout_daemon, logger)
        _kick_off("Treasury monthly distribution scheduler",
                  _start_treasury_monthly, logger)
        _kick_off("Solvency Meter live broadcaster",
                  _start_solvency_broadcaster, logger)
        _kick_off("Performance webhook alert loop",
                  _start_perf_alerts, logger)
        _kick_off("Beta Waitlist weekly digest scheduler",
                  _start_weekly_digest, logger)
        _kick_off("Streamer wrap-up Monday dispatcher",
                  _start_streamer_wrap_up, logger)
        _kick_off("Beta Tester seeder",
                  _start_beta_tester_seeder, logger)
        _kick_off("JFTN demo-room seeder",
                  _start_jftn_demo_room_seeder, logger)
        _kick_off("Marketplace demo seeder",
                  _start_marketplace_demo_seeder, logger)
        _kick_off("TV Totem-Pole survive scheduler",
                  _start_tv_survive, logger,
                  success_msg="TV Totem-Pole survive scheduler started (5-min ticks)")
        _kick_off("Memory Bank Cinema auto-archive",
                  _start_memory_bank_archive, logger)


def register_shutdown(app, logger: logging.Logger) -> None:
    """Wire the FastAPI shutdown event. Always tries to close the motor
    client cleanly — even when background schedulers are disabled."""

    @app.on_event("shutdown")
    async def _shutdown_db_client():
        try:
            client = get_client()
            client.close()
        except Exception as e:
            logger.warning(f"[shutdown] motor client close failed: {e}")


# ────────────────────────────────────────────── Helpers


def _kick_off(
    name: str,
    starter,
    logger: logging.Logger,
    success_msg: str | None = None,
    log_success: bool = True,
) -> None:
    """Call `starter()` (which schedules an asyncio task) inside try/except.
    Logs success once and warnings on failure."""
    try:
        starter()
        if log_success:
            logger.info(success_msg or f"{name} started")
    except Exception as e:
        logger.warning(f"{name} skipped: {e}")


def _start_card_royale() -> None:
    from utils.tournament_engine import scheduler_loop  # noqa: PLC0415
    asyncio.create_task(scheduler_loop(interval_sec=60))


def _start_daily_report() -> None:
    from routes.rewards_queue import daily_report_scheduler  # noqa: PLC0415
    asyncio.create_task(daily_report_scheduler(hour_utc=8))


def _start_viberidez_hydrate() -> None:
    from routes.vibe_ridez_dispatch import hydrate_drivers_from_mongo  # noqa: PLC0415
    asyncio.create_task(hydrate_drivers_from_mongo())


def _start_solana_indexer() -> None:
    from routes.solana_indexer import solana_indexer_loop  # noqa: PLC0415
    asyncio.create_task(solana_indexer_loop())


def _start_perf_alerts() -> None:
    """Fire-and-forget perf-webhook alert loop. No-ops if the
    PERF_ALERT_WEBHOOK_URL env var is unset."""
    from services.perf_alert import perf_alert_loop  # noqa: PLC0415
    asyncio.create_task(perf_alert_loop())


def _start_weekly_digest() -> None:
    """Beta Waitlist Founder digest — dispatches every Monday at 09:00 UTC.
    Idempotent via the iso-week audit row in `beta_digest_runs`."""
    from services.weekly_digest_service import weekly_digest_loop  # noqa: PLC0415
    asyncio.create_task(weekly_digest_loop())


def _start_streamer_wrap_up() -> None:
    """Per-streamer analytics wrap-up — dispatches every Monday at 09:00
    UTC to every streamer with a provisioned Cloudflare live input + an
    email on file. Idempotent via `streamer_wrap_up_runs` audit collection."""
    import os  # noqa: PLC0415
    from motor.motor_asyncio import AsyncIOMotorClient  # noqa: PLC0415
    from services.streamer_wrap_up_service import streamer_wrap_up_loop  # noqa: PLC0415

    _client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
    _db = _client[os.environ.get("DB_NAME", "global_vibez_dsg")]
    asyncio.create_task(streamer_wrap_up_loop(lambda: _db))


def _start_beta_tester_seeder() -> None:
    """Idempotently seed 3 beta tester accounts so the founder can always
    share working credentials post-deploy. Runs once per backend boot."""
    from services.beta_tester_seeder import run_seeder  # noqa: PLC0415
    asyncio.create_task(run_seeder())


def _start_jftn_demo_room_seeder() -> None:
    """Idempotently seed 3 demo rooms in the Just-For-The-Night hub so
    beta testers see content instead of an empty grid on first visit."""
    from services.jftn_demo_room_seeder import run_seeder as run_jftn  # noqa: PLC0415
    asyncio.create_task(run_jftn())


def _start_marketplace_demo_seeder() -> None:
    """Idempotently seed 4 demo restaurants + 2 drivers + 3 rides so
    the HungryVibez and VibeRidez customer pages aren't empty when
    beta testers click in."""
    from services.marketplace_demo_seeder import run_seeder as run_mkt  # noqa: PLC0415
    asyncio.create_task(run_mkt())


def _start_profit_share() -> None:
    from routes.profit_share import profit_share_scheduler  # noqa: PLC0415
    asyncio.create_task(profit_share_scheduler())


def _start_auto_pilot() -> None:
    from routes.economy_control import auto_pilot_tick  # noqa: PLC0415

    async def loop():
        log = logging.getLogger("auto-pilot")
        while True:
            try:
                await auto_pilot_tick()
            except Exception as exc:
                log.warning(f"tick failed: {exc}")
            await asyncio.sleep(3600)  # 1 hour

    asyncio.create_task(loop())


def _start_apex_evolution() -> None:
    from routes.apex_evolution import apex_evolution_scheduler  # noqa: PLC0415
    asyncio.create_task(apex_evolution_scheduler())


def _start_usdc_payout_daemon() -> None:
    """VibeRidez USDC payout daemon — drains fare_distributions rows
    with driver_payout_status='pending' and ships devnet USDC SPL
    transfers to drivers. DRY_RUN by default (env flag
    VIBEZ_PAYOUT_DRY_RUN=1). Safe to start in every env."""
    from services.usdc_payout_daemon import payout_daemon_loop  # noqa: PLC0415
    asyncio.create_task(payout_daemon_loop())


def _start_treasury_monthly() -> None:
    """Snapshot bucket totals at 00:05 UTC on the 1st of every month.
    Idempotent — `monthly_distribution_job` skips if today's snapshot
    already exists, so doubled cron runs are safe.
    """
    from datetime import datetime, timezone
    from routes.treasury import monthly_distribution_job  # noqa: PLC0415

    async def loop():
        log = logging.getLogger("treasury-monthly")
        db = get_database()
        while True:
            now = datetime.now(timezone.utc)
            # If it's the 1st of the month and we're past 00:05, run it.
            if now.day == 1 and now.hour == 0 and now.minute >= 5:
                try:
                    await monthly_distribution_job(db)
                except Exception as exc:
                    log.warning(f"snapshot failed: {exc}")
                # Sleep ~24h to avoid double-firing in the same hour.
                await asyncio.sleep(23 * 3600)
            else:
                # Check every 30 minutes — cheap and gives us 30-min
                # tolerance on the 00:05 trigger window.
                await asyncio.sleep(30 * 60)

    asyncio.create_task(loop())


def _start_solvency_broadcaster() -> None:
    """Recompute the Solvency Meter every 60s and broadcast to every
    Socket.IO client subscribed to the ``treasury`` room. Frontend
    `/treasury` page joins that room on mount.

    This gives chair-holders a live dollar-collateralisation view
    without polling — one meter update per minute is plenty.

    The first tick fires after a 5s warmup so the first ``/treasury``
    page-load receives fresh data without waiting a full minute.
    """
    async def loop():
        log = logging.getLogger("solvency-broadcaster")
        first_tick_logged = False
        # Short warm-up so we don't race with the index-creation task.
        await asyncio.sleep(5)
        while True:
            try:
                from services.multiplayer import sio  # noqa: PLC0415
                from routes.manifesto_features import _compute_solvency  # noqa: PLC0415
                db = get_database()
                payload = await _compute_solvency(db)
                await sio.emit("solvency_update", payload, room="treasury")
                if not first_tick_logged:
                    log.info(
                        "first tick OK — vault_usd=%s, liability_usd=%s, "
                        "active_chairs=%s",
                        payload.get("vault_usd"),
                        payload.get("liability_usd"),
                        payload.get("active_chairs"),
                    )
                    first_tick_logged = True
            except Exception as exc:
                log.warning(f"broadcast failed: {exc}")
            await asyncio.sleep(60)

    asyncio.create_task(loop())


def _start_tv_survive() -> None:
    """Vibe TV Totem-Pole survival worker. Every 5 minutes we run the
    PDF algorithm: shows below `HYPE_MIN_TO_SURVIVE` get cut, shows
    above promote to PRIMETIME and trigger their 70/30 payout. The
    `/api/totem-pole/tv/survive` endpoint runs the same logic
    on-demand so manual refreshes still work.
    """
    # Side-effect imports — register socket.io handlers if not already
    # wired. Safe to import multiple times.
    try:
        import services.sound_check_leaderboard  # noqa: F401, PLC0415
    except Exception:
        pass
    try:
        import services.hype_meter_ws  # noqa: F401, PLC0415
    except Exception:
        pass

    from utils.database import get_database
    from datetime import datetime, timezone

    async def loop():
        log = logging.getLogger("tv-survive")
        await asyncio.sleep(15)  # warm-up
        while True:
            try:
                from routes.totem_pole import HYPE_MIN_TO_SURVIVE, _split_payout  # noqa: PLC0415
                db = get_database()
                cur = db.tv_pilots.find({"status": "QUEUED"}, {"_id": 0})
                cuts = promotes = 0
                async for pilot in cur:
                    hype = pilot.get("hype_meter_cents", 0)
                    now_iso = datetime.now(timezone.utc).isoformat()
                    if hype < HYPE_MIN_TO_SURVIVE:
                        await db.tv_pilots.update_one(
                            {"pilot_id": pilot["pilot_id"]},
                            {"$set": {"status": "CUT", "cut_at": now_iso}},
                        )
                        cuts += 1
                    else:
                        await db.tv_pilots.update_one(
                            {"pilot_id": pilot["pilot_id"]},
                            {"$set": {
                                "status": "PRIMETIME",
                                "promoted_at": now_iso,
                                "payout_split": _split_payout(hype),
                            }},
                        )
                        promotes += 1
                if cuts or promotes:
                    log.info(f"survival pass: cut={cuts}, promoted={promotes}")
            except Exception as exc:
                log.warning(f"survival pass failed: {exc}")
            await asyncio.sleep(300)  # 5 minutes

    asyncio.create_task(loop())


def _start_memory_bank_archive() -> None:
    """Memory Bank Cinema auto-archive. Every hour we scan resolved
    Totem-Pole battles whose total pot crossed the 'classic' threshold
    ($25 = 2500c) and stamp them as MEMORY_BANK_ARCHIVED. Idempotent —
    we only touch rows that have NOT been archived yet.
    """
    from utils.database import get_database
    from datetime import datetime, timezone
    CLASSIC_THRESHOLD_CENTS = 2500

    async def loop():
        log = logging.getLogger("memory-bank")
        await asyncio.sleep(30)  # warm-up
        while True:
            try:
                db = get_database()
                cur = db.totem_battles.find(
                    {"resolved": True,
                     "memory_bank_archived": {"$ne": True}},
                    {"_id": 0},
                )
                archived = 0
                async for b in cur:
                    total = (b.get("pot_a_cents", 0) + b.get("pot_b_cents", 0))
                    if total < CLASSIC_THRESHOLD_CENTS:
                        continue
                    await db.totem_battles.update_one(
                        {"battle_id": b["battle_id"]},
                        {"$set": {
                            "memory_bank_archived": True,
                            "archived_at": datetime.now(timezone.utc).isoformat(),
                            "classic_total_cents": total,
                        }},
                    )
                    archived += 1
                if archived:
                    log.info(f"archived {archived} classic battles")
            except Exception as exc:
                log.warning(f"archive pass failed: {exc}")
            await asyncio.sleep(3600)  # 1 hour

    asyncio.create_task(loop())


# ────────────────────────────────────────────── Indexes


async def _create_indexes_async(logger: logging.Logger) -> None:
    """One-time index creation — every block is wrapped in try/except so a
    single 'index already exists' or schema drift doesn't abort the rest.
    """
    try:
        await asyncio.sleep(2)  # let motor warm up
        db = get_database()

        # ---- One-time chair grandfather migration -------------------
        try:
            from routes.chairs import _grandfather_genesis_holders  # noqa: PLC0415
            await _grandfather_genesis_holders()
        except Exception as e:
            logger.warning(f"[chairs] grandfather migration skipped: {e}")

        # ---- One-time chair_ids backfill (Apr 30 2026) ---------------
        # Every chair_purchases row gets a unique sequential `chair_ids`
        # array stamped at buy-time. Rows created BEFORE that schema
        # change have `quantity` but no `chair_ids` — backfill them in
        # purchase order so the public Chair Wall has a clean
        # chronological numbering. Idempotent: only touches rows
        # missing `chair_ids`.
        try:
            counter = await db.profit_share_counters.find_one(
                {"_id": "global_chairs"}, {"_id": 0, "count": 1}
            ) or {}
            global_count = int(counter.get("count") or 0)
            cur = db.chair_purchases.find(
                {"chair_ids": {"$exists": False}},
                {"_id": 1, "quantity": 1, "purchased_at": 1},
            ).sort("purchased_at", 1)
            next_id = 1
            assigned = 0
            async for row in cur:
                qty = int(row.get("quantity") or 0)
                if qty < 1:
                    continue
                ids = list(range(next_id, next_id + qty))
                next_id += qty
                await db.chair_purchases.update_one(
                    {"_id": row["_id"]},
                    {"$set": {"chair_ids": ids}},
                )
                assigned += qty
            # Re-sync the counter so the next live purchase doesn't
            # collide with backfilled IDs.
            if assigned and (next_id - 1) > global_count:
                await db.profit_share_counters.update_one(
                    {"_id": "global_chairs"},
                    {"$set": {"count": next_id - 1}},
                    upsert=True,
                )
            if assigned:
                logger.info(
                    f"[chairs] chair_ids backfill assigned {assigned} "
                    f"sequential IDs across legacy purchases."
                )
        except Exception as e:
            logger.warning(f"[chairs] chair_ids backfill skipped: {e}")


        # ---- One-time phase rename migration (Apr 30 2026) ----------
        # Phase 1 was renamed Genesis → Genius; Phase 2 was renamed
        # "Phase II" → "Genesis". Migrate any historical rows so all
        # downstream lookups (calculator denominator, milestone IDs,
        # admin live-seat phase tags) keep working. Idempotent: each
        # update runs on the OLD name only, so re-runs are no-ops.
        try:
            r1 = await db.chair_purchases.update_many(
                {"phase_at_purchase": "Genesis"},
                {"$set": {"phase_at_purchase": "Genius"}},
            )
            r2 = await db.chair_purchases.update_many(
                {"phase_at_purchase": "Phase II"},
                {"$set": {"phase_at_purchase": "Genesis"}},
            )
            # Milestone slugs: "Genesis_25/50/75/100" → "Genius_*"
            ms = await db.profit_share_milestones.find(
                {"_id": {"$regex": "^Genesis_"}}, {"_id": 1}
            ).to_list(length=10_000)
            ms_renamed = 0
            for row in ms:
                old_id = row["_id"]
                new_id = old_id.replace("Genesis_", "Genius_", 1)
                full = await db.profit_share_milestones.find_one({"_id": old_id})
                if full and not await db.profit_share_milestones.find_one({"_id": new_id}):
                    full["_id"] = new_id
                    await db.profit_share_milestones.insert_one(full)
                    await db.profit_share_milestones.delete_one({"_id": old_id})
                    ms_renamed += 1
            if (r1.modified_count or r2.modified_count or ms_renamed):
                logger.info(
                    f"[chairs] Phase rename migration: "
                    f"Genesis→Genius={r1.modified_count}, "
                    f"PhaseII→Genesis={r2.modified_count}, "
                    f"milestones_renamed={ms_renamed}"
                )
        except Exception as e:
            logger.warning(f"[chairs] phase rename migration skipped: {e}")

        # ---- Index groups -------------------------------------------
        for spec in _INDEX_SPECS:
            try:
                coll = db[spec["coll"]]
                key = spec["key"]
                kwargs = {k: v for k, v in spec.items() if k not in ("coll", "key")}
                await coll.create_index(key, **kwargs)
            except Exception as e:
                logger.debug(f"[idx] {spec['coll']}/{spec.get('name','')} skipped: {e}")

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")


# Each entry: {coll, key, ... pymongo create_index kwargs}.
# Adding a new index = append a dict here.
_INDEX_SPECS = [
    # Users
    {"coll": "users", "key": "user_id", "unique": True},
    {"coll": "users", "key": "email", "unique": True},
    {"coll": "users", "key": "referral_code"},
    {"coll": "users", "key": "membership_type"},
    # TTL on throwaway demo users (?fresh=1 flow)
    {
        "coll": "users",
        "key": "created_at",
        "expireAfterSeconds": 24 * 60 * 60,
        "partialFilterExpression": {"is_throwaway_demo": True},
    },

    # Swipes / matches / messages
    {"coll": "swipes",
     "key": [("user_id", 1), ("target_user_id", 1)], "unique": True},
    {"coll": "swipes", "key": "target_user_id"},
    {"coll": "swipes", "key": "action"},
    {"coll": "matches", "key": "both_ids"},
    {"coll": "matches", "key": [("user_id_1", 1), ("user_id_2", 1)]},
    {"coll": "matches", "key": "match_id", "unique": True},
    {"coll": "messages", "key": "match_id"},
    {"coll": "messages", "key": [("match_id", 1), ("created_at", -1)]},
    {"coll": "messages", "key": [("receiver_id", 1), ("read", 1)]},

    # Sessions / password reset / vanishing messages
    {"coll": "user_sessions", "key": "session_token", "unique": True},
    {"coll": "user_sessions", "key": "user_id"},
    {"coll": "password_reset_tokens", "key": "token_hash", "unique": True},
    {"coll": "password_reset_tokens", "key": "user_id"},
    {"coll": "vanishing_messages", "key": "msg_id", "unique": True},
    {"coll": "vanishing_messages",
     "key": [("room_id", 1), ("sent_at", -1)]},

    # Payments / Stripe rake ledger
    {"coll": "payment_transactions", "key": "transaction_id", "unique": True},
    {"coll": "payment_transactions", "key": "user_id"},
    {"coll": "gvdsg_operating_ledger",
     "key": [("ref", 1), ("type", 1)], "unique": True},

    # Founders Pass
    {"coll": "founders_passes", "key": "payment_ref", "unique": True},
    {"coll": "founders_passes", "key": [("user_id", 1), ("status", 1)]},
    {"coll": "founders_passes",
     "key": [("tier_id", 1), ("pass_number", 1)],
     "unique": True, "sparse": True},
    {"coll": "founders_pass_pending", "key": "session_id", "unique": True},

    # Founder Chairs
    {"coll": "chair_purchases", "key": "payment_ref", "unique": True},
    {"coll": "chair_purchases",
     "key": [("user_id", 1), ("purchased_at", -1)]},
    {"coll": "chair_pending", "key": "session_id", "unique": True},
    {"coll": "invites", "key": "code", "unique": True},
    {"coll": "invites", "key": [("owner_user_id", 1), ("created_at", -1)]},
    {"coll": "profit_share_chair_quarters", "key": "quarter_key", "unique": True},

    # TGE + Mining
    {"coll": "vibez_mining_balance", "key": "user_id", "unique": True},
    {"coll": "vibez_mining_balance",
     "key": [("balance", -1), ("pending_balance", -1)]},
    {"coll": "vibez_tge_batches", "key": "batch_id", "unique": True},
    {"coll": "vibez_tge_batches", "key": [("initiated_at", -1)]},

    # Tournaments
    {"coll": "tournaments", "key": "tournament_id", "unique": True},
    {"coll": "tournaments", "key": [("status", 1), ("starts_at", 1)]},
    {"coll": "tournament_entries",
     "key": [("tournament_id", 1), ("user_id", 1)]},
    {"coll": "tournament_entries", "key": "user_id"},

    # Florida-Flow (Vibez 654 + audit, added 2026-04-26)
    {
        "coll": "vibez_654_games",
        "key": [("status", 1), ("ended_at", -1), ("score", -1)],
        "background": True,
        "name": "v654_leaderboard_idx",
    },
    {"coll": "vibez_654_games", "key": "user_id", "background": True},
    {"coll": "god_mode_audit", "key": [("at", -1)], "background": True},
    {"coll": "god_mode_audit",
     "key": [("action", 1), ("at", -1)], "background": True},
    {"coll": "beta_feedback",
     "key": [("status", 1), ("submitted_at", -1)], "background": True},
    {"coll": "friend_events",
     "key": [("from_user_id", 1), ("at", -1)], "background": True},

    # Vibez Treasury (40-30-30 ledger)
    {"coll": "treasury_ledger", "key": "tx_id", "unique": True, "background": True},
    {"coll": "treasury_ledger", "key": [("created_at", -1)], "background": True},
    {"coll": "treasury_ledger", "key": "source", "background": True},
    {"coll": "treasury_distributions",
     "key": "period_label", "unique": True, "background": True},
    {"coll": "treasury_config", "key": "_key", "unique": True, "background": True},
    {"coll": "design_lessons", "key": [("created_at", -1)], "background": True},
    {"coll": "vibe_credits", "key": "user_id", "unique": True, "background": True},
    {"coll": "vibe_credits_log", "key": [("user_id", 1), ("at", -1)], "background": True},
    {"coll": "chair_burn_log", "key": [("burned_at", -1)], "background": True},
    {"coll": "chair_purchases", "key": [("status", 1), ("premium_lapsed_at", 1)], "background": True},
    {"coll": "chair_purchases", "key": "user_id_lookup", "background": True},
]
