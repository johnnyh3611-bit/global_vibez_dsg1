"""MongoDB index hardening — 100K CCU foundation (Production Blueprint).

The Blueprint PDF flags the canonical hot read paths (Live Now Wall,
nearby drivers, user wallet, follower fan-out, leaderboards). Without
the right indexes these become collection scans at scale.

Call `ensure_scale_indexes(db)` once at startup. Each `create_index` is
idempotent (Mongo no-ops on duplicates) so this is safe to re-run.

Designed to be defensive — every index call is wrapped in try/except so
a single collection drift can't crash the whole startup phase.
"""
from __future__ import annotations

import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

# (collection, [(field, direction), ...], name)
SCALE_INDEXES: List[Tuple[str, List[Tuple[str, int]], str]] = [
    # Live Now Wall — featured-first, recency
    ("streams", [("is_live", -1), ("is_featured", -1), ("started_at", -1)], "live_wall_idx"),
    ("streams", [("streamer_id", 1)], "streams_by_streamer"),

    # Streamer follow fan-out — broadcast to all followers
    ("streamer_follows", [("streamer_id", 1), ("created_at", -1)], "follows_by_streamer"),
    ("streamer_follows", [("follower_id", 1)], "follows_by_follower"),

    # High Roller VIP membership lookups
    ("high_roller_vip", [("user_id", 1)], "hr_vip_by_user"),
    ("high_roller_vip", [("vip_until", -1)], "hr_vip_by_expiry"),

    # Featured streamers — sorted active list
    ("featured_streamers", [("featured_until", -1)], "featured_by_expiry"),

    # Wallet / credits — direct user lookup
    ("user_wallets", [("user_id", 1)], "wallet_by_user"),
    ("coin_top_up_transactions", [("user_id", 1), ("created_at", -1)], "topups_by_user_recency"),

    # Live activity ticker — last 72h
    ("jftn_gifts", [("created_at", -1)], "gifts_recency"),
    ("lottery_tickets", [("purchased_at", -1)], "lottery_recency"),

    # Cloudflare stream input → streamer mapping
    ("cloudflare_live_inputs", [("streamer_id", 1)], "cf_inputs_by_streamer"),
    ("cloudflare_live_inputs", [("cf_uid", 1)], "cf_inputs_by_uid"),

    # User sessions — auth hot path
    ("user_sessions", [("session_token", 1)], "sessions_by_token"),
    ("user_sessions", [("expires_at", 1)], "sessions_expiry"),
]


async def ensure_scale_indexes(db) -> dict:
    """Apply the 100K-scale index set. Returns a {created, skipped, failed}
    summary for logging. Safe to call multiple times."""
    summary = {"created": 0, "failed": 0, "collections": []}
    for coll, keys, name in SCALE_INDEXES:
        try:
            await db[coll].create_index(keys, name=name, background=True)
            summary["created"] += 1
            summary["collections"].append(f"{coll}.{name}")
        except Exception as e:
            summary["failed"] += 1
            logger.warning("ensure_scale_indexes: %s.%s failed: %s", coll, name, e)
    logger.info(
        "ensure_scale_indexes: applied %d / failed %d",
        summary["created"], summary["failed"],
    )
    return summary
