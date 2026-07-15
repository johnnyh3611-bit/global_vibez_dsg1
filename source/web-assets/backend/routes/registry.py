"""
Route registry — Waves 1–5 (full surface).

Wave 1: games + tokenomics.
Wave 2: Hunger Vibez / Vibez Spots / Vibe Venues / Vibe Ridez.
Wave 3: DSG TV, media engine, streaming, social/community chat hooks.
Wave 4: game lobby + dating/party games.
Wave 5: My Vibez, admin/ops, economy extras, Solana/sovereign, AI, uploads,
        and every remaining importable router.

Each mount is try/except so one bad import never takes the whole API down.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, FastAPI

# Boot-time mount ledger for GET /api/admin/route-registry
_MOUNTED: list[str] = []
_SKIPPED: list[dict] = []


def _soft_mount(
    api_router: APIRouter,
    log: logging.Logger,
    label: str,
    import_path: str,
    attr: str = "router",
    **include_kwargs,
) -> bool:
    """Import `import_path.attr` and include it. Returns True on success."""
    try:
        module = __import__(import_path, fromlist=[attr])
        router = getattr(module, attr)
        api_router.include_router(router, **include_kwargs)
        log.info("mounted %s", label)
        _MOUNTED.append(label)
        return True
    except Exception as exc:  # noqa: BLE001 — boot must survive flaky routes
        log.warning("registry skip %s: %s", label, exc)
        _SKIPPED.append({"label": label, "error": str(exc)})
        return False


def register_all_routes(
    api_router: APIRouter,
    app: FastAPI,
    logger: Optional[logging.Logger] = None,
) -> None:
    log = logger or logging.getLogger(__name__)
    _MOUNTED.clear()
    _SKIPPED.clear()

    # ── Always-on (existing production surface) ──────────────────────
    try:
        from routes.notifications import router as notifications_router

        api_router.include_router(notifications_router)
    except ImportError:
        log.warning("notifications router missing")

    try:
        from routes.moderation import router as moderation_router

        api_router.include_router(moderation_router)
    except ImportError:
        log.warning("moderation router missing")

    # api_router already has prefix="/api". Use "/auth" so routes land at
    # /api/auth/signup|login (matches the frontend).
    try:
        from routes.email_auth import router as auth_router

        api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
    except ImportError:
        log.warning("email_auth router missing")

    # ── Wave 1A — Core games catalog + locks ─────────────────────────
    _soft_mount(api_router, log, "categories", "routes.categories")
    _soft_mount(api_router, log, "safety", "routes.safety")
    _soft_mount(api_router, log, "games", "routes.games")
    _soft_mount(api_router, log, "tournaments", "routes.tournaments")
    _soft_mount(api_router, log, "games_lock", "routes.games_lock_routes", "games_lock_router")
    _soft_mount(api_router, log, "leaderboard", "routes.leaderboard")
    _soft_mount(api_router, log, "leaderboards", "routes.leaderboards", tags=["leaderboards"])
    _soft_mount(api_router, log, "practice", "routes.practice")
    _soft_mount(api_router, log, "stats", "routes.stats")
    _soft_mount(api_router, log, "game_handshake", "routes.game_handshake")
    _soft_mount(api_router, log, "turn_timer", "routes.turn_timer")

    # ── Wave 1B — Card / table games ─────────────────────────────────
    _soft_mount(api_router, log, "spades", "routes.spades")
    _soft_mount(api_router, log, "spades_practice", "routes.spades_practice")
    _soft_mount(api_router, log, "bid_whist", "routes.bid_whist")
    _soft_mount(api_router, log, "bid_whist_practice", "routes.bid_whist_practice")
    _soft_mount(api_router, log, "bid_whist_meta", "routes.bid_whist_meta")
    _soft_mount(api_router, log, "blackjack", "routes.blackjack", prefix="/blackjack", tags=["blackjack"])
    _soft_mount(api_router, log, "blackjack_universal", "routes.blackjack_universal")
    _soft_mount(api_router, log, "baccarat", "routes.baccarat")
    _soft_mount(api_router, log, "poker_practice", "routes.poker_practice")
    _soft_mount(api_router, log, "card_royale", "routes.card_royale")
    _soft_mount(api_router, log, "card_multiplayer", "routes.card_multiplayer")
    _soft_mount(api_router, log, "card_styles", "routes.card_styles")
    _soft_mount(api_router, log, "http_multiplayer", "routes.http_multiplayer")

    # Practice pack
    for label, path in (
        ("uno_practice", "routes.uno_practice"),
        ("hearts_practice", "routes.hearts_practice"),
        ("rummy_practice", "routes.rummy_practice"),
        ("gin_rummy_practice", "routes.gin_rummy_practice"),
        ("crazy_eights_practice", "routes.crazy_eights_practice"),
        ("euchre_practice", "routes.euchre_practice"),
        ("go_fish_practice", "routes.go_fish_practice"),
        ("pinochle_practice", "routes.pinochle_practice"),
        ("war_practice", "routes.war_practice"),
        ("dominoes_practice", "routes.dominoes_practice"),
        ("dominoes_mp", "routes.dominoes_mp"),
    ):
        _soft_mount(api_router, log, label, path)

    # Casino / specialty
    _soft_mount(api_router, log, "roulette", "routes.roulette")
    _soft_mount(api_router, log, "slots", "routes.slots")
    _soft_mount(api_router, log, "cyber_casino", "routes.cyber_casino")
    _soft_mount(api_router, log, "community_slots", "routes.community_slots")
    _soft_mount(api_router, log, "multiplayer_slots", "routes.multiplayer_slots")
    _soft_mount(api_router, log, "high_roller", "routes.high_roller")
    _soft_mount(api_router, log, "chess_hall", "routes.chess_hall")
    _soft_mount(api_router, log, "big_wheel_lounge", "routes.big_wheel_lounge")
    _soft_mount(api_router, log, "thirty_one", "routes.thirty_one_routes")
    _soft_mount(api_router, log, "yahtzee", "routes.yahtzee_routes")
    _soft_mount(api_router, log, "vibes_slots", "routes.vibes_slots_routes")

    # Vibez 654
    _soft_mount(api_router, log, "vibez_654", "routes.vibez_654")
    _soft_mount(
        api_router,
        log,
        "vibez_654_prescription",
        "routes.vibez_654_prescription",
        prefix="/games/vibe654",
        tags=["vibe654"],
    )
    _soft_mount(api_router, log, "vibe_654_social", "routes.vibe_654_social")
    _soft_mount(api_router, log, "vibe_654_tournament", "routes.vibe_654_tournament")

    # Founder-engine + wave-2 casino (coming-soon surfaces — soft mount)
    try:
        from routes.founder_engines_routes import (
            bingo_router,
            battle_router,
            craps_router,
            cs_router,
            gifts_router,
            keno_router,
            sicbo_router,
            vw_router,
        )

        for r in (
            bingo_router,
            cs_router,
            sicbo_router,
            craps_router,
            vw_router,
            keno_router,
            gifts_router,
            battle_router,
        ):
            api_router.include_router(r)
        log.info("mounted founder_engines")
    except Exception as exc:  # noqa: BLE001
        log.warning("Wave-1 skip founder_engines: %s", exc)

    try:
        from routes.casino_wave2_routes import (
            big_six_router,
            casino_war_router,
            chemin_router,
            chuck_router,
            darts_router,
            eu_roulette_router,
            fan_tan_router,
            faro_router,
            hazard_router,
            jacks_router,
            pai_gow_router,
            three_card_router,
        )

        for r in (
            three_card_router,
            pai_gow_router,
            casino_war_router,
            chemin_router,
            eu_roulette_router,
            hazard_router,
            chuck_router,
            big_six_router,
            jacks_router,
            fan_tan_router,
            faro_router,
            darts_router,
        ):
            api_router.include_router(r)
        log.info("mounted casino_wave2")
    except Exception as exc:  # noqa: BLE001
        log.warning("Wave-1 skip casino_wave2: %s", exc)

    # ── Wave 1C — Tokenomics / economy ───────────────────────────────
    _soft_mount(api_router, log, "coins", "routes.coins")
    _soft_mount(api_router, log, "coin_topup", "routes.coin_topup")
    _soft_mount(api_router, log, "coin_stats", "routes.coin_stats")
    _soft_mount(api_router, log, "currency", "routes.currency")
    _soft_mount(api_router, log, "vibe_wallet", "routes.vibe_wallet", prefix="/wallet", tags=["wallet"])
    _soft_mount(api_router, log, "chairs", "routes.chairs")
    _soft_mount(api_router, log, "chair_share", "routes.chair_share")
    _soft_mount(api_router, log, "chair_holder_votes", "routes.chair_holder_votes")
    _soft_mount(api_router, log, "pricing_tiers", "routes.pricing_tiers_routes", "pricing_router")
    _soft_mount(api_router, log, "dynamic_pricing", "routes.dynamic_pricing", tags=["pricing"])
    _soft_mount(api_router, log, "premium_pricing", "routes.premium_pricing")
    _soft_mount(api_router, log, "admin_pricing", "routes.admin_pricing")
    _soft_mount(api_router, log, "payout", "routes.payout_routes", tags=["treasury"])
    _soft_mount(api_router, log, "treasury", "routes.treasury")
    _soft_mount(api_router, log, "admin_treasury", "routes.admin_treasury_routes", tags=["admin-treasury"])
    _soft_mount(api_router, log, "battle_pass", "routes.battle_pass")
    _soft_mount(api_router, log, "cosmetics", "routes.cosmetics", tags=["cosmetics"])
    _soft_mount(api_router, log, "cosmetics_shop", "routes.cosmetics_shop")
    _soft_mount(api_router, log, "founders_pass", "routes.founders_pass")
    _soft_mount(api_router, log, "economic_engine", "routes.economic_engine")
    _soft_mount(api_router, log, "admin_recirculation", "routes.admin_recirculation")
    _soft_mount(api_router, log, "vibez_rewards", "routes.vibez_rewards")
    _soft_mount(api_router, log, "profit_share", "routes.profit_share")
    _soft_mount(api_router, log, "entry_fee", "routes.entry_fee")
    _soft_mount(api_router, log, "subscriptions", "routes.subscriptions")
    _soft_mount(api_router, log, "subscription_tiers", "routes.subscription_tiers")
    _soft_mount(api_router, log, "tge", "routes.tge")
    _soft_mount(api_router, log, "rewards", "routes.rewards")
    _soft_mount(api_router, log, "vibez", "routes.vibez")

    log.info("Wave-1 registry registration complete")

    # ── Wave 2A — Hunger Vibez (meal delivery + merchant) ────────────
    _soft_mount(api_router, log, "hungryvibes_merchant", "routes.hungryvibes_merchant")
    _soft_mount(
        api_router,
        log,
        "hungryvibes_public",
        "routes.hungryvibes_merchant",
        "public_router",
    )
    _soft_mount(api_router, log, "smartstack", "routes.smartstack")
    _soft_mount(
        api_router,
        log,
        "smartstack_admin",
        "routes.smartstack",
        "admin_router",
    )
    _soft_mount(
        api_router,
        log,
        "hungryvibes_orders",
        "routes.smartstack",
        "customer_router",
    )
    _soft_mount(api_router, log, "restaurants", "routes.restaurants")
    _soft_mount(api_router, log, "merchant_onboarding", "routes.merchant_onboarding")
    _soft_mount(api_router, log, "age_verification", "routes.age_verification")
    _soft_mount(api_router, log, "unified_earnings", "routes.unified_earnings")
    _soft_mount(api_router, log, "stripe_connect", "routes.stripe_connect")
    _soft_mount(api_router, log, "yellow_pages", "routes.yellow_pages")

    # ── Wave 2B — Vibez Spots + Vibe Venues (local / reservations) ───
    _soft_mount(api_router, log, "vibe_spots", "routes.vibe_spots", tags=["vibe-spots"])
    _soft_mount(api_router, log, "vibe_venues", "routes.vibe_venues")

    # ── Wave 2C — Vibe Ridez (courier / delivery routing) ────────────
    _soft_mount(api_router, log, "vibe_ridez", "routes.vibe_ridez")
    _soft_mount(
        api_router,
        log,
        "vibe_ridez_dispatch",
        "routes.vibe_ridez_dispatch",
        tags=["Vibe Ridez Dispatch"],
    )
    _soft_mount(
        api_router,
        log,
        "viberidez_fare_split",
        "routes.viberidez_fare_split",
        tags=["VibeRidez Fare Split"],
    )
    _soft_mount(api_router, log, "viberidez_cargo", "routes.viberidez_cargo_routes")
    _soft_mount(
        api_router,
        log,
        "admin_viberidez_cargo",
        "routes.viberidez_cargo_routes",
        "admin_router",
    )
    _soft_mount(api_router, log, "drivers", "routes.drivers")
    _soft_mount(api_router, log, "driver_verification", "routes.driver_verification")
    _soft_mount(api_router, log, "eld", "routes.eld")
    _soft_mount(api_router, log, "rides", "routes.rides")
    _soft_mount(api_router, log, "rides_safety", "routes.rides_safety")
    _soft_mount(api_router, log, "vibe_drive", "routes.vibe_drive")

    log.info("Wave-2 local-utility registry registration complete")

    # ── Wave 3A — DSG TV / broadcast / media engine ──────────────────
    _soft_mount(api_router, log, "dsg_tv", "routes.dsg_tv_expansion_routes")
    _soft_mount(
        api_router,
        log,
        "admin_dsg_tv",
        "routes.dsg_tv_expansion_routes",
        "admin_router",
    )
    _soft_mount(
        api_router,
        log,
        "vibe_tv",
        "routes.vibe_tv_routes",
        "vibe_tv_router",
    )
    _soft_mount(api_router, log, "media_engine", "routes.media_engine_routes")
    _soft_mount(
        api_router,
        log,
        "admin_media_engine",
        "routes.media_engine_routes",
        "admin_router",
    )
    _soft_mount(api_router, log, "media_master", "routes.media_master")
    _soft_mount(api_router, log, "media_master_pulse", "routes.media_master_pulse")
    _soft_mount(
        api_router,
        log,
        "cinema_date",
        "routes.cinema_date_routes",
        "cinema_router",
    )
    _soft_mount(api_router, log, "cinema_room", "routes.cinema_room", tags=["cinema-room"])
    _soft_mount(
        api_router,
        log,
        "cinema_network_room",
        "routes.cinema_network_room",
        tags=["cinema-network-room"],
    )
    _soft_mount(
        api_router,
        log,
        "dsg_music_group",
        "routes.dsg_music_group_routes",
    )
    _soft_mount(
        api_router,
        log,
        "admin_dsg_music_group",
        "routes.dsg_music_group_routes",
        "admin_router",
    )
    _soft_mount(
        api_router,
        log,
        "memory_bank",
        "routes.memory_bank_routes",
        "memory_bank_router",
    )
    _soft_mount(
        api_router,
        log,
        "freestyle",
        "routes.freestyle_battles_routes",
        "freestyle_router",
    )
    _soft_mount(
        api_router,
        log,
        "collab",
        "routes.collab_matchmaker_routes",
        "collab_router",
    )
    _soft_mount(
        api_router,
        log,
        "beat_auctions",
        "routes.beat_auctions_routes",
        "auctions_router",
    )
    _soft_mount(api_router, log, "video_vault", "routes.video_vault")
    _soft_mount(api_router, log, "landing_video", "routes.landing_video")

    # ── Wave 3B — Streaming hooks / streamer dashboards ──────────────
    _soft_mount(api_router, log, "streaming", "routes.streaming")
    _soft_mount(api_router, log, "live_streaming", "routes.live_streaming")
    _soft_mount(api_router, log, "cloudflare_stream", "routes.cloudflare_stream")
    _soft_mount(api_router, log, "streamer_actions", "routes.streamer_actions")
    _soft_mount(api_router, log, "streamer_follow", "routes.streamer_follow")
    _soft_mount(api_router, log, "streamer_referral", "routes.streamer_referral")
    _soft_mount(api_router, log, "streamer_wrap_up", "routes.streamer_wrap_up")
    _soft_mount(api_router, log, "featured_streamers", "routes.featured_streamers")
    _soft_mount(api_router, log, "streamer_copilot", "routes.streamer_copilot")
    _soft_mount(
        api_router,
        log,
        "streamflow_admin",
        "routes.streamflow_admin",
        tags=["Streamflow"],
    )
    _soft_mount(api_router, log, "underground_live", "routes.underground_live", tags=["underground-live"])
    _soft_mount(api_router, log, "live_activity", "routes.live_activity", tags=["live-activity"])
    _soft_mount(api_router, log, "live_pulse", "routes.live_pulse", tags=["live-pulse"])
    _soft_mount(api_router, log, "live_commerce", "routes.live_commerce")
    _soft_mount(api_router, log, "agora_token", "routes.agora_token", tags=["agora-vibe-call"])
    _soft_mount(api_router, log, "admin_live_seats", "routes.admin_live_seats", tags=["admin-live-seats"])

    # ── Wave 3C — Social / community chat + voice ────────────────────
    # notifications already mounted in the always-on block above
    _soft_mount(api_router, log, "chat", "routes.chat", tags=["chat"])
    _soft_mount(api_router, log, "messaging", "routes.messaging")
    _soft_mount(api_router, log, "friends", "routes.friends")
    _soft_mount(api_router, log, "social", "routes.social")
    _soft_mount(api_router, log, "social_features", "routes.social_features", tags=["social"])
    _soft_mount(api_router, log, "friend_notifier", "routes.friend_notifier", tags=["friend-events"])
    _soft_mount(api_router, log, "tournament_chat", "routes.tournament_chat")
    _soft_mount(api_router, log, "video_chat", "routes.video_chat")
    _soft_mount(api_router, log, "video_call", "routes.video_call")
    _soft_mount(api_router, log, "ai_voice", "routes.ai_voice")
    _soft_mount(api_router, log, "voice_mirror", "routes.voice_mirror")
    _soft_mount(api_router, log, "voice_mirror_pair", "routes.voice_mirror_pair")
    _soft_mount(api_router, log, "voice_coach", "routes.voice_coach")
    _soft_mount(
        api_router,
        log,
        "metahuman_websocket",
        "routes.metahuman_websocket",
        tags=["metahuman-ws"],
    )
    _soft_mount(
        api_router,
        log,
        "vr_dating_websocket",
        "routes.vr_dating_websocket",
        tags=["vr-dating"],
    )
    _soft_mount(api_router, log, "vibe_room_signaling", "routes.vibe_room_signaling")

    log.info("Wave-3 media-streaming registry registration complete")

    # ── Wave 4A — Game lobby: tables / dealers / matchmaking / spectators ──
    _soft_mount(api_router, log, "tables", "routes.tables")
    _soft_mount(api_router, log, "smart_tables", "routes.smart_tables", tags=["smart-tables"])
    _soft_mount(api_router, log, "dealer", "routes.dealer")
    _soft_mount(
        api_router,
        log,
        "dealer_integration",
        "routes.dealer_integration",
        tags=["dealer-integration"],
    )
    _soft_mount(api_router, log, "matchmaking", "routes.matchmaking", tags=["matchmaking"])
    _soft_mount(
        api_router,
        log,
        "spectator_features",
        "routes.spectator_features",
        tags=["spectator"],
    )
    _soft_mount(
        api_router,
        log,
        "spectator_bet",
        "routes.spectator_bet",
        tags=["spectator-bet"],
    )
    _soft_mount(api_router, log, "unity_game_ws", "routes.unity_game_ws", tags=["Unity Game Rooms"])
    _soft_mount(api_router, log, "tournament_ws", "routes.tournament")
    _soft_mount(api_router, log, "tournament_winnings", "routes.tournament_winnings")
    _soft_mount(api_router, log, "ai_practice", "routes.ai_practice")
    _soft_mount(api_router, log, "watch_and_wager", "routes.watch_and_wager")

    # ── Wave 4B — Party / dating games that the UI already routes to ──
    _soft_mount(api_router, log, "quiz", "routes.quiz")
    _soft_mount(api_router, log, "would_you_rather", "routes.would_you_rather")
    _soft_mount(api_router, log, "trivia", "routes.trivia")
    # Legacy /api/trivia/* aliases (canonical is /api/games/trivia/*)
    _soft_mount(
        api_router, log, "trivia_legacy", "routes.trivia", "legacy_router"
    )
    _soft_mount(api_router, log, "dating", "routes.dating")
    _soft_mount(api_router, log, "enhanced_dating", "routes.enhanced_dating")
    _soft_mount(api_router, log, "dating_games", "routes.dating_games")
    _soft_mount(api_router, log, "matching", "routes.matching")
    _soft_mount(api_router, log, "match_consensus", "routes.match_consensus")
    _soft_mount(api_router, log, "vr_dating", "routes.vr_dating", tags=["vr_dating"])
    _soft_mount(api_router, log, "bonds", "routes.bonds")
    _soft_mount(api_router, log, "crews", "routes.crews")
    _soft_mount(api_router, log, "invites", "routes.invites")
    _soft_mount(api_router, log, "avatars", "routes.avatars")
    _soft_mount(api_router, log, "speed_dating", "routes.speed_dating")
    _soft_mount(api_router, log, "speed_dating_video", "routes.speed_dating_video")
    _soft_mount(api_router, log, "table_for_two", "routes.table_for_two")
    _soft_mount(api_router, log, "private_suites", "routes.private_suites")
    _soft_mount(api_router, log, "just_for_the_night", "routes.just_for_the_night")

    # ── Wave 4C — Specialty game rooms still linked from the catalog ──
    _soft_mount(api_router, log, "prize_wheel", "routes.prize_wheel_routes")
    _soft_mount(
        api_router,
        log,
        "admin_prize_wheel",
        "routes.prize_wheel_routes",
        "admin_router",
    )
    _soft_mount(api_router, log, "sports_lounge", "routes.sports_lounge", tags=["sports-lounge"])
    _soft_mount(api_router, log, "marathon", "routes.marathon")
    _soft_mount(api_router, log, "dsg6_lottery", "routes.dsg6_lottery", tags=["dsg6-lottery"])
    _soft_mount(api_router, log, "florida_flow", "routes.florida_flow", tags=["florida-flow"])
    _soft_mount(api_router, log, "roguelite_chess", "routes.roguelite_chess")
    _soft_mount(api_router, log, "recent_rooms", "routes.recent_rooms")
    _soft_mount(api_router, log, "progression", "routes.progression")
    _soft_mount(api_router, log, "safety_streaks_tourneys", "routes.safety_streaks_tourneys")

    # Friends prefix fix lives in routes/friends.py (was /api/friends under
    # api_router → /api/api/friends; frontend expects /api/friends).

    log.info("Wave-4 games-lobby registry registration complete")

    # ── Wave 5A — My Vibez + content / uploads ───────────────────────
    _soft_mount(api_router, log, "my_vibez", "routes.my_vibez")
    _soft_mount(api_router, log, "my_vibez_content", "routes.my_vibez_content")
    _soft_mount(api_router, log, "my_vibez_feed", "routes.my_vibez_feed")
    _soft_mount(api_router, log, "my_vibez_optimization", "routes.my_vibez_optimization")
    _soft_mount(api_router, log, "content_rights", "routes.content_rights")
    _soft_mount(api_router, log, "creator_earnings", "routes.creator_earnings")
    _soft_mount(api_router, log, "beat_dlc", "routes.beat_dlc")
    _soft_mount(api_router, log, "ads", "routes.ads")
    _soft_mount(api_router, log, "uploads", "routes.uploads")
    _soft_mount(api_router, log, "profile_videos", "routes.profile_videos")
    _soft_mount(api_router, log, "insurance_verification", "routes.insurance_verification")
    _soft_mount(api_router, log, "receipts_ocr", "routes.receipts_ocr")
    _soft_mount(api_router, log, "totem_pole", "routes.totem_pole")
    _soft_mount(api_router, log, "plex_room", "routes.plex_room_routes")
    _soft_mount(api_router, log, "vanishing_messages", "routes.vanishing_messages")
    _soft_mount(api_router, log, "rum_collector", "routes.rum_collector")

    # ── Wave 5B — Admin / ops / monitoring ───────────────────────────
    _soft_mount(api_router, log, "admin", "routes.admin")
    _soft_mount(api_router, log, "admin_dashboard", "routes.admin_dashboard", tags=["admin"])
    _soft_mount(api_router, log, "admin_beta_cohort", "routes.admin_beta_cohort")
    _soft_mount(api_router, log, "admin_founder_preview", "routes.admin_founder_preview")
    _soft_mount(api_router, log, "admin_payments_audit", "routes.admin_payments_audit")
    _soft_mount(api_router, log, "admin_security", "routes.admin_security")
    _soft_mount(api_router, log, "audit_log", "routes.audit_log_routes")
    _soft_mount(api_router, log, "god_mode_audit", "routes.god_mode_audit")
    _soft_mount(api_router, log, "god_mode_casino", "routes.god_mode_casino")
    _soft_mount(api_router, log, "god_mode_monitor", "routes.god_mode_monitor")
    _soft_mount(api_router, log, "monitoring", "routes.monitoring")
    _soft_mount(api_router, log, "system_monitor", "routes.system_monitor")
    _soft_mount(api_router, log, "health_routes", "routes.health")
    _soft_mount(api_router, log, "dsg_core_system", "routes.dsg_core_system")
    _soft_mount(api_router, log, "dsg_guard", "routes.dsg_guard")
    _soft_mount(api_router, log, "dsg_logistics", "routes.dsg_logistics_routes")
    _soft_mount(
        api_router,
        log,
        "admin_dsg_logistics",
        "routes.dsg_logistics_routes",
        "admin_router",
    )
    _soft_mount(api_router, log, "staff_management", "routes.staff_management_routes")
    _soft_mount(api_router, log, "usdc_payout_admin", "routes.usdc_payout_admin")
    _soft_mount(api_router, log, "kyc_aml", "routes.kyc_aml_routes")
    _soft_mount(api_router, log, "reports", "routes.reports")
    _soft_mount(api_router, log, "verification", "routes.verification")
    _soft_mount(api_router, log, "beta_waitlist", "routes.beta_waitlist")
    _soft_mount(
        api_router,
        log,
        "admin_beta_waitlist",
        "routes.beta_waitlist",
        "admin_router",
    )
    _soft_mount(api_router, log, "gisa", "routes.gisa_routes", "gisa_router")
    _soft_mount(
        api_router,
        log,
        "integrity_protocol",
        "routes.integrity_protocol",
    )

    # ── Wave 5C — Economy / engagement extras ────────────────────────
    _soft_mount(api_router, log, "economy_control", "routes.economy_control")
    _soft_mount(api_router, log, "elite_subscription", "routes.elite_subscription")
    _soft_mount(api_router, log, "engagement", "routes.engagement")
    _soft_mount(api_router, log, "gift_cards", "routes.gift_cards")
    _soft_mount(api_router, log, "milestones", "routes.milestones")
    _soft_mount(api_router, log, "monetization", "routes.monetization")
    _soft_mount(api_router, log, "power_hour_sponsors", "routes.power_hour_sponsors")
    _soft_mount(api_router, log, "referral_system", "routes.referral_system")
    _soft_mount(api_router, log, "rewards_queue", "routes.rewards_queue")
    _soft_mount(api_router, log, "ratings", "routes.ratings")
    _soft_mount(api_router, log, "user_preferences", "routes.user_preferences")
    _soft_mount(api_router, log, "user_interests", "routes.user_interests_routes")
    _soft_mount(api_router, log, "teleport_cosmetics", "routes.teleport_cosmetics")
    _soft_mount(api_router, log, "wallet_purchase", "routes.wallet")
    _soft_mount(api_router, log, "stripe_payouts_webhook", "routes.stripe_payouts_webhook")
    _soft_mount(api_router, log, "crypto_payments", "routes.crypto_payments")
    _soft_mount(api_router, log, "manifesto_features", "routes.manifesto_features")
    _soft_mount(api_router, log, "v4_closeout", "routes.v4_closeout")
    _soft_mount(api_router, log, "vibe_score", "routes.vibe_score")
    _soft_mount(api_router, log, "vibe_phone", "routes.vibe_phone")
    _soft_mount(api_router, log, "vibe_suites", "routes.vibe_suites")
    _soft_mount(api_router, log, "vibe_core_orchestrator", "routes.vibe_core_orchestrator")
    _soft_mount(
        api_router,
        log,
        "vibe_654_dice",
        "routes.vibe_654_dice",
        prefix="/games/vibe-654-dice",
        tags=["vibe-654-dice"],
    )
    _soft_mount(api_router, log, "games_backup", "routes.games_backup")

    # ── Wave 5D — Solana / sovereign / apex ──────────────────────────
    _soft_mount(api_router, log, "solana_network", "routes.solana_network", tags=["solana-network"])
    _soft_mount(api_router, log, "solana_indexer", "routes.solana_indexer", tags=["solana-indexer"])
    _soft_mount(api_router, log, "jftn_solana", "routes.jftn_solana", tags=["JFTN Solana"])
    _soft_mount(api_router, log, "hybrid_identity", "routes.hybrid_identity")
    _soft_mount(api_router, log, "privy_auth", "routes.privy_auth")
    _soft_mount(api_router, log, "mining", "routes.mining")
    _soft_mount(api_router, log, "immutable_core", "routes.immutable_core")
    _soft_mount(api_router, log, "equity_master", "routes.equity_master")
    _soft_mount(api_router, log, "sovereign_engine", "routes.sovereign_engine_routes")
    _soft_mount(api_router, log, "sovereign_ops", "routes.sovereign_ops_routes")
    _soft_mount(
        api_router,
        log,
        "sovereign_mining",
        "routes.sovereign_mining_routes",
        tags=["sovereign-mining"],
    )
    _soft_mount(api_router, log, "sovereign_tiers", "routes.sovereign_tiers", tags=["tiers"])
    _soft_mount(api_router, log, "apex_evolution", "routes.apex_evolution", tags=["apex-evolution"])
    _soft_mount(
        api_router,
        log,
        "apex_sovereign",
        "routes.apex_sovereign_routes",
        "apex_router",
    )
    _soft_mount(
        api_router,
        log,
        "celestial_glasshouse",
        "routes.celestial_glasshouse_routes",
        "arena_router",
    )

    # ── Wave 5E — AI / planners / integrations / i18n ────────────────
    _soft_mount(api_router, log, "ai_coach", "routes.ai_coach")
    _soft_mount(api_router, log, "ai_content_matching", "routes.ai_content_matching")
    _soft_mount(api_router, log, "ai_date_planner", "routes.ai_date_planner")
    _soft_mount(api_router, log, "ai_date_planner_v2", "routes.ai_date_planner_v2")
    _soft_mount(api_router, log, "agent_learning", "routes.agent_learning")
    _soft_mount(api_router, log, "metahuman_control", "routes.metahuman_control")
    _soft_mount(api_router, log, "date_planner", "routes.date_planner")
    _soft_mount(api_router, log, "group_planner", "routes.group_planner")
    _soft_mount(api_router, log, "i18n", "routes.i18n")
    _soft_mount(
        api_router,
        log,
        "localization",
        "routes.localization_routes",
        "localization_router",
    )
    _soft_mount(
        api_router,
        log,
        "cultural_onboarding",
        "routes.cultural_onboarding_routes",
        "cultural_onboarding_router",
    )
    _soft_mount(
        api_router,
        log,
        "smartcar",
        "routes.third_party_integrations",
        "smartcar_router",
    )
    _soft_mount(
        api_router,
        log,
        "spotify",
        "routes.third_party_integrations",
        "spotify_router",
    )
    _soft_mount(api_router, log, "twilio", "routes.twilio_routes")
    _soft_mount(api_router, log, "vr_physical_bridge", "routes.vr_physical_bridge")

    log.info("Wave-5 remaining-surface registry registration complete")

    # Ops visibility — what soft-mounted vs skipped at boot
    status_router = APIRouter(prefix="/admin/route-registry", tags=["admin-route-registry"])

    @status_router.get("")
    async def route_registry_status():
        return {
            "mounted_count": len(_MOUNTED),
            "skipped_count": len(_SKIPPED),
            "mounted": list(_MOUNTED),
            "skipped": list(_SKIPPED),
        }

    api_router.include_router(status_router)
    log.info(
        "route-registry status endpoint ready (mounted=%s skipped=%s)",
        len(_MOUNTED),
        len(_SKIPPED),
    )
