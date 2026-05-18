"""
Lifespan / startup index specifications.

Extracted from `lifespan.py` (Feb 2026 split) so the index catalogue is
trivial to audit and append to without scrolling past 500 lines of
background-worker code.

Two pieces:
  • ``_INDEX_SPECS``  — list[dict] of pymongo create_index args
  • ``_create_indexes_from_spec(db, logger)`` — iterates the list

A new index = append a single dict to ``_INDEX_SPECS``.
"""
from __future__ import annotations

import logging


async def _create_indexes_from_spec(db, logger: logging.Logger) -> None:
    """Iterate `_INDEX_SPECS` and create_index each entry. Failures (e.g.
    'index already exists', schema drift on a single collection) are
    logged at DEBUG so they don't abort the rest."""
    for spec in _INDEX_SPECS:
        try:
            coll = db[spec["coll"]]
            key = spec["key"]
            kwargs = {k: v for k, v in spec.items() if k not in ("coll", "key")}
            await coll.create_index(key, **kwargs)
        except Exception as e:
            logger.debug(f"[idx] {spec['coll']}/{spec.get('name','')} skipped: {e}")


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

    # 100K CCU Scaling indexes (Global Vibez 100K Production Blueprint, May 2026)
    # High Roller VIP membership lookups
    {"coll": "high_roller_vip", "key": "user_id", "unique": True, "background": True},
    {"coll": "high_roller_vip", "key": [("vip_until", -1)], "background": True},
    {"coll": "high_roller_vip", "key": "last_grant_session_id", "sparse": True, "background": True},
    # Featured Streamers — sorted active list
    {"coll": "featured_streamers", "key": "streamer_id", "unique": True, "background": True},
    {"coll": "featured_streamers", "key": [("featured_until", -1)], "background": True},
    # Streamer Follow fan-out (live push)
    {"coll": "streamer_follows", "key": [("streamer_id", 1), ("created_at", -1)], "background": True},
    {"coll": "streamer_follows", "key": "follower_id", "background": True},
    # Live Now Wall hot read
    {"coll": "streams", "key": [("is_live", -1), ("is_featured", -1), ("started_at", -1)], "background": True, "name": "live_wall_idx"},
    {"coll": "streams", "key": "streamer_id", "background": True},
    # Cloudflare live input → streamer mapping
    {"coll": "cloudflare_live_inputs", "key": "streamer_id", "background": True},
    {"coll": "cloudflare_live_inputs", "key": "cf_uid", "background": True},

    # Media Master ecosystem indexes (DSG TV, Vibe Radio, Music Group, AI Scout)
    {"coll": "media_tv_passes", "key": [("user_id", 1), ("channel_id", 1)], "unique": True, "background": True},
    {"coll": "media_tv_passes", "key": [("expires_at", 1)], "background": True},
    {"coll": "media_tv_pins", "key": "user_id", "unique": True, "background": True},
    {"coll": "media_radio_tracks", "key": [("station_id", 1), ("is_current", 1)], "background": True},
    {"coll": "media_radio_skip_bids", "key": [("station_id", 1), ("status", 1)], "background": True},
    {"coll": "media_radio_purchases", "key": [("user_id", 1), ("purchased_at", -1)], "background": True},
    {"coll": "media_studio_bookings", "key": [("user_id", 1), ("booked_at", -1)], "background": True},
    {"coll": "media_artist_sponsorships", "key": [("chair_user_id", 1), ("artist_id", 1)], "unique": True, "background": True},
    {"coll": "media_scout_hype", "key": "room_id", "unique": True, "background": True},
    {"coll": "media_scout_clips", "key": [("room_id", 1), ("minute_bucket", 1)], "unique": True, "background": True},
    {"coll": "media_scout_clips", "key": [("created_at", -1)], "background": True},
    {"coll": "media_scout_alerts", "key": [("expires_at", -1)], "background": True},
    # Channel programming — hot read for HLS resolver
    {"coll": "media_tv_channel_programs", "key": [("channel_id", 1), ("programmed_until", -1)], "background": True},

    # 2026-05-17 — Match Consensus + 72h Airlock indexes
    # Per-team submission must be unique on (match_id, reporting_team_id)
    # so two teams can submit but neither can stuff the ballot.
    {"coll": "match_submissions",
     "key": [("match_id", 1), ("reporting_team_id", 1)],
     "unique": True, "background": True},
    {"coll": "match_submissions", "key": [("match_id", 1)], "background": True},
    # One consensus row per match.
    {"coll": "match_consensus", "key": "match_id", "unique": True, "background": True},
    {"coll": "match_consensus", "key": [("status", 1), ("verified_at", -1)], "background": True},
    # One airlock row per match; ordered scan for "ready to clear" jobs.
    {"coll": "match_airlocks", "key": "match_id", "unique": True, "background": True},
    {"coll": "match_airlocks", "key": [("payout_status", 1), ("clears_at", 1)], "background": True},
    # Security alerts — open-first.
    {"coll": "security_alerts", "key": [("status", 1), ("created_at", -1)], "background": True},

    # 2026-05-18 — Security Directive D2 (Payout Airlock) + D4 (Events)
    {"coll": "payout_airlocks", "key": [("status", 1), ("clears_at", 1)], "background": True},
    {"coll": "payout_airlocks", "key": [("user_id", 1), ("queued_at", -1)], "background": True},
    # security_events — admin console reads newest-first, optionally filtered by type.
    {"coll": "security_events", "key": [("at", -1)], "background": True},
    {"coll": "security_events", "key": [("type", 1), ("at", -1)], "background": True},
]
