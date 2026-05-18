"""
Lifespan / background-worker starters.

Extracted from `lifespan.py` (Feb 2026 split). Each ``_start_*``
function schedules an ``asyncio.create_task`` for a background loop.
None of these functions are awaited at startup — they fire-and-forget
the task and return immediately. Failures inside the kicked-off task
are isolated to that task's logger.

`_kick_off` wraps the starter call in try/except so a single broken
import never takes the whole startup chain down.
"""
from __future__ import annotations

import asyncio
import logging

from utils.database import get_database


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


def _start_vibe_radio_resolver() -> None:
    """Auto-resolve Vibe Radio skip-vs-keep bids on a 15s tick.

    A bid is resolved when it's been active for ≥ 30s AND the skip-pool
    exceeds the keep-pool. The current track is advanced; otherwise the
    bid is closed with `outcome=keep`. The full economic rule (and the
    5% platform fee on the losing pool) lives in
    `routes.media_master.resolve_pending_bids` — this loop just calls it
    so the resolver behavior is the same whether invoked manually or
    via this background task.
    """
    async def loop():
        log = logging.getLogger("vibe-radio-resolver")
        await asyncio.sleep(20)  # warm-up so the route module imports cleanly
        try:
            from routes.media_master import resolve_pending_bids  # noqa: PLC0415
        except Exception as exc:
            log.warning(f"resolver import failed — aborting loop: {exc}")
            return
        while True:
            try:
                db = get_database()
                summary = await resolve_pending_bids(db)
                if summary["total_resolved"]:
                    log.info(
                        "resolved %d bids (skipped=%d kept=%d)",
                        summary["total_resolved"], summary["skipped_count"], summary["kept_count"],
                    )
            except Exception as exc:
                log.warning(f"resolver tick failed: {exc}")
            await asyncio.sleep(15)

    asyncio.create_task(loop())


def _start_airlock_release_worker() -> None:
    """Match Consensus 72h airlock-release worker. Every 5 minutes:

      1. Scan `match_airlocks` for rows where `clears_at < now()` and
         `payout_status == "held"`.
      2. For each matured row, check `match_consensus.status` — if the
         match is in DISPUTED_FLAGGED or HASH_MISMATCH_REVIEW, leave
         the airlock held (admin must resolve first).
      3. Otherwise flip `payout_status: held → cleared` + stamp
         `cleared_at`.

    The release logic lives in `routes.match_consensus.release_due_airlocks`
    so the same code path runs whether triggered by this loop or by the
    `POST /airlock/release-due` ops endpoint.
    """
    async def loop():
        log = logging.getLogger("match-airlock-release")
        await asyncio.sleep(25)  # warm-up so the route module imports cleanly
        try:
            from routes.match_consensus import release_due_airlocks  # noqa: PLC0415
        except Exception as exc:
            log.warning(f"release worker import failed — aborting loop: {exc}")
            return
        while True:
            try:
                db = get_database()
                summary = await release_due_airlocks(db)
                if summary["released"] or summary["held_due_to_dispute"]:
                    log.info(
                        "airlock-release tick: matured=%d released=%d held_due_to_dispute=%d",
                        summary["matured"], summary["released"], summary["held_due_to_dispute"],
                    )
            except Exception as exc:
                log.warning(f"airlock-release tick failed: {exc}")
            await asyncio.sleep(5 * 60)  # 5-minute cadence

    asyncio.create_task(loop())


def _start_payout_airlock_release_worker() -> None:
    """Security Directive D2 — generic payout airlock release loop.

    Mirrors `_start_airlock_release_worker` but for the platform-wide
    `payout_airlocks` collection (creator earnings withdrawals, crypto
    bridge withdrawals, driver payouts — anything that calls
    `services.payout_airlock.enqueue_payout()`).

    Every 5 minutes: scan for rows where `clears_at < now` and
    `status == "held"`, flip them to `cleared`. The actual outward
    transfer (Stripe payout, on-chain send, etc.) is handled by a
    downstream consumer keyed off `source` — that piece is intentionally
    NOT wired here so a failed transfer can be retried without
    re-queueing a 72h hold.
    """
    async def loop():
        log = logging.getLogger("payout-airlock-release")
        await asyncio.sleep(30)
        try:
            from services.payout_airlock import release_due_payouts  # noqa: PLC0415
        except Exception as exc:
            log.warning(f"release worker import failed — aborting loop: {exc}")
            return
        while True:
            try:
                db = get_database()
                summary = await release_due_payouts(db)
                if summary["released"]:
                    log.info(
                        "payout-airlock tick: matured=%d released=%d",
                        summary["matured"], summary["released"],
                    )
            except Exception as exc:
                log.warning(f"payout-airlock tick failed: {exc}")
            await asyncio.sleep(5 * 60)

    asyncio.create_task(loop())
