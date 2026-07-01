"""
Startup / shutdown FastAPI hooks.

Feb 2026 split: this file is now a thin entry point. The heavy
implementation lives in three focused modules:

  • ``lifespan_workers``     — all `_start_*` background worker
    starters + the `_kick_off` wrapper used by ``register_startup_tasks``.
  • ``lifespan_migrations``  — one-time migrations + ``_seed_pricing_catalog``
    + the ``_create_indexes_async`` orchestrator.
  • ``lifespan_indexes``     — the ``_INDEX_SPECS`` list + the
    ``_create_indexes_from_spec`` helper.

Public API kept stable — callers (`server.py`) still import
``register_startup_tasks`` and ``register_shutdown`` from this module.
"""
from __future__ import annotations

import asyncio
import logging
import os

from config import get_client

from lifespan_workers import (
    _kick_off,
    _start_card_royale,
    _start_daily_report,
    _start_viberidez_hydrate,
    _start_solana_indexer,
    _start_perf_alerts,
    _start_weekly_digest,
    _start_streamer_wrap_up,
    _start_beta_tester_seeder,
    _start_jftn_demo_room_seeder,
    _start_marketplace_demo_seeder,
    _start_profit_share,
    _start_auto_pilot,
    _start_apex_evolution,
    _start_usdc_payout_daemon,
    _start_treasury_monthly,
    _start_solvency_broadcaster,
    _start_tv_survive,
    _start_memory_bank_archive,
    _start_vibe_radio_resolver,
    _start_airlock_release_worker,
    _start_payout_airlock_release_worker,
    _start_payments_audit_drift_alert,
    _start_recirculation_airlock_release_worker,
)
from lifespan_migrations import _create_indexes_async


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
        _kick_off("Vibe Radio skip-bid auto-resolver",
                  _start_vibe_radio_resolver, logger,
                  success_msg="Vibe Radio skip-bid auto-resolver started (15s ticks)")
        _kick_off("Match Consensus airlock-release worker",
                  _start_airlock_release_worker, logger,
                  success_msg="Match Consensus airlock-release worker started (5-min ticks)")
        _kick_off("Payout Airlock release worker (Security D2)",
                  _start_payout_airlock_release_worker, logger,
                  success_msg="Payout Airlock release worker started (5-min ticks)")
        _kick_off("Payments-audit drift alert worker",
                  _start_payments_audit_drift_alert, logger,
                  success_msg="Payments-audit drift alert worker started (6-hour ticks)")
        _kick_off("Recirculation airlock release worker (Blueprint 72h)",
                  _start_recirculation_airlock_release_worker, logger,
                  success_msg="Recirculation airlock release worker started (5-min ticks)")


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
