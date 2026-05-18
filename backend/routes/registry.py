"""
Route registry — consolidates the 150+ route imports and includes that
were previously inlined at the top of `server.py`. Keeps the runtime
contract identical (same router + same prefix + same tags + same order).

To add a new route, append a `mount(...)` call inside `register_all_routes`.
The optional-mount blocks at the bottom keep `try/except` around still-flaky
or env-gated routers so a single broken import never takes the whole API
down.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter

# ---- core route imports (all ship with the API) ----
from routes.categories import router as categories_router
from routes.safety import router as safety_router
from routes.games import router as games_router
from routes.tournaments import router as tournaments_router
from routes.card_royale import router as card_royale_router
from routes.thirty_one_routes import router as thirty_one_router
from routes.yahtzee_routes import router as yahtzee_router
from routes.vibes_slots_routes import router as vibes_slots_router
from routes.founder_engines_routes import (
    bingo_router as fe_bingo_router,
    cs_router as fe_cs_router,
    sicbo_router as fe_sicbo_router,
    craps_router as fe_craps_router,
    vw_router as fe_vw_router,
    keno_router as fe_keno_router,
    gifts_router as fe_gifts_router,
    battle_router as fe_battle_router,
)
from routes.casino_wave2_routes import (
    three_card_router as w2_three_card_router,
    pai_gow_router as w2_pai_gow_router,
    casino_war_router as w2_casino_war_router,
    chemin_router as w2_chemin_router,
    eu_roulette_router as w2_eu_roulette_router,
    hazard_router as w2_hazard_router,
    chuck_router as w2_chuck_router,
    big_six_router as w2_big_six_router,
    jacks_router as w2_jacks_router,
    fan_tan_router as w2_fan_tan_router,
    faro_router as w2_faro_router,
    darts_router as w2_darts_router,
)
from routes.games_lock_routes import games_lock_router
from routes.apex_sovereign_routes import apex_router
from routes.collab_matchmaker_routes import collab_router
from routes.freestyle_battles_routes import freestyle_router
from routes.memory_bank_routes import memory_bank_router
from routes.cinema_date_routes import cinema_router
from routes.vibe_tv_routes import vibe_tv_router
from routes.pricing_tiers_routes import pricing_router
from routes.beat_auctions_routes import auctions_router
from routes.celestial_glasshouse_routes import arena_router
# v8 — GISA pre-beta auditor + International Logic + Cultural Onboarding
from routes.gisa_routes import gisa_router
from routes.localization_routes import localization_router
from routes.cultural_onboarding_routes import cultural_onboarding_router
from routes.tournament_chat import router as tournament_chat_router
from routes.tge import router as tge_router
from routes.jftn_solana import router as jftn_solana_router
from routes.rewards_queue import router as rewards_queue_router
from routes.hybrid_identity import router as hybrid_identity_router
from routes.game_handshake import router as game_handshake_router
from routes.unity_game_ws import router as unity_game_ws_router
from routes.vibe_ridez_dispatch import router as vibe_ridez_dispatch_router
from routes.viberidez_fare_split import router as viberidez_fare_split_router
from routes.usdc_payout_admin import router as usdc_payout_admin_router
from routes.vibe_room_signaling import router as vibe_room_signaling_router
from routes.power_hour_sponsors import router as power_hour_sponsors_router
from routes.twilio_routes import router as twilio_router
from routes.streamflow_admin import router as streamflow_admin_router
from routes.privy_auth import router as privy_auth_router
from routes.leaderboard import router as leaderboard_router
from routes.third_party_integrations import smartcar_router, spotify_router
from routes.vibe_drive import router as vibe_drive_router
from routes.vanishing_messages import router as vanishing_messages_router
from routes.gift_cards import router as gift_cards_router
from routes.drivers import router as drivers_router
from routes.rides import router as rides_router
from routes.social import router as social_router
from routes.ai_voice import router as ai_voice_router
from routes.profile_videos import router as profile_videos_router
from routes.quiz import router as quiz_router
from routes.matching import router as matching_router
from routes.group_planner import router as group_planner_router
from routes.subscription_tiers import router as subscriptions_router
from routes.would_you_rather import router as would_you_rather_router
from routes.verification import router as verification_router
from routes.driver_verification import router as driver_verification_router
from routes.trivia import router as trivia_router
from routes.practice import router as practice_router
from routes.stats import router as stats_router
from routes.vibez import router as vibez_router
from routes.avatars import router as avatars_router
from routes.dating import router as dating_router
from routes.enhanced_dating import router as enhanced_dating_router
from routes.uploads import router as uploads_router
from routes.restaurants import router as restaurants_router
from routes.vibe_venues import router as vibe_venues_router
from routes.date_planner import router as date_planner_router
from routes.dating_games import router as dating_games_router
from routes.table_for_two import router as table_for_two_router
from routes.vibe_score import router as vibe_score_router
from routes.card_styles import router as card_styles_router
from routes.ai_date_planner import router as ai_date_planner_router
from routes.tournament_winnings import router as tournament_winnings_router
from routes.spades import router as spades_router
from routes.bid_whist import router as bid_whist_router
from routes.bid_whist_practice import router as bid_whist_practice_router
from routes.crazy_eights_practice import router as crazy_eights_practice_router
from routes.euchre_practice import router as euchre_practice_router
from routes.gin_rummy_practice import router as gin_rummy_practice_router
from routes.go_fish_practice import router as go_fish_practice_router
from routes.hearts_practice import router as hearts_practice_router
from routes.pinochle_practice import router as pinochle_practice_router
from routes.spades_practice import router as spades_practice_router
from routes.uno_practice import router as uno_practice_router
from routes.war_practice import router as war_practice_router
from routes.dominoes_practice import router as dominoes_practice_router
from routes.dominoes_mp import router as dominoes_mp_router
from routes.hungryvibes_merchant import router as hungryvibes_merchant_router, public_router as hungryvibes_public_router
from routes.smartstack import router as smartstack_router, customer_router as hungryvibes_orders_router, admin_router as smartstack_admin_router
from routes.blackjack_universal import router as blackjack_universal_router
from routes.poker_practice import router as poker_practice_router
from routes.rummy_practice import router as rummy_practice_router
from routes.mining import router as mining_router
from routes.voice_mirror import router as voice_mirror_router
from routes.voice_mirror_pair import router as voice_mirror_pair_router
from routes.marathon import router as marathon_router
from routes.rewards import router as rewards_router
from routes.baccarat import router as baccarat_router
from routes.vibe_suites import router as vibe_suites_router
from routes.god_mode_casino import router as god_mode_casino_router
from routes.system_monitor import router as system_monitor_router
from routes.insurance_verification import router as insurance_verification_router
from routes.email_auth import router as email_auth_router
from routes.ai_coach import router as ai_coach_router
from routes.vr_dating import router as vr_dating_router
from routes.tables import router as tables_router
from routes.http_multiplayer import router as http_multiplayer_router
from routes.friends import router as friends_router
from routes.ai_date_planner_v2 import router as ai_date_planner_v2_router
from routes.my_vibez import router as my_vibez_router
from routes.my_vibez_content import router as my_vibez_content_router
from routes.coins import router as coins_router
from routes.watch_and_wager import router as watch_and_wager_router
from routes.engagement import router as engagement_router
from routes.live_streaming import router as live_streaming_router
from routes.video_call import router as video_call_router
from routes.ai_content_matching import router as ai_content_matching_router
from routes.ai_practice import router as ai_practice_router
from routes.monetization import router as monetization_router
from routes.rides_safety import router as rides_safety_router
from routes.messaging import router as messaging_router
from routes.admin import router as admin_router
from routes.admin_pricing import router as admin_pricing_router
from routes.reports import router as reports_router
from routes.ratings import router as ratings_router
from routes.notifications import router as notifications_router
from routes.vibe_ridez import router as vibe_ridez_router
from routes.entry_fee import router as entry_fee_router
from routes.battle_pass import router as battle_pass_router
from routes.roulette import router as roulette_router
from routes.blackjack import router as blackjack_router
from routes.cyber_casino import router as cyber_casino_router
from routes.elite_subscription import router as elite_subscription_router
from routes.cosmetics_shop import router as cosmetics_shop_router
from routes.streaming import router as streaming_router
from routes.moderation import router as moderation_router
from routes.ads import router as ads_router
from routes.slots import router as slots_router
from routes.multiplayer_slots import router as multiplayer_slots_router
from routes.video_chat import router as video_chat_router
from routes.dealer import router as dealer_router
from routes.tournament import router as tournament_router
from routes.chat import router as chat_router
from routes.progression import router as progression_router
from routes.cosmetics import router as cosmetics_router
from routes.smart_tables import router as smart_tables_router
from routes.currency import router as currency_router
from routes.bid_whist_meta import router as bid_whist_meta_router
from routes.spectator_features import router as spectator_router
from routes.dealer_integration import router as dealer_integration_router
from routes.social_features import router as social_features_router
from routes.community_slots import router as community_slots_router
from routes.metahuman_websocket import router as metahuman_websocket_router
from routes.private_suites import router as private_suites_router
from routes.matchmaking import router as matchmaking_router
from routes.just_for_the_night import router as just_for_the_night_router
from routes.vr_dating_websocket import router as vr_dating_websocket_router
from routes.vr_physical_bridge import router as vr_physical_bridge_router
from routes.bonds import router as bonds_router
from routes.teleport_cosmetics import router as teleport_cosmetics_router
from routes.admin_dashboard import router as admin_dashboard_router
from routes.metahuman_control import router as metahuman_router
from routes.subscription_tiers import router as subscription_tiers_router
from routes.crypto_payments import router as crypto_payments_router
from routes.referral_system import router as referral_system_router
from routes.leaderboards import router as leaderboards_router
from routes.dynamic_pricing import router as dynamic_pricing_router
from routes.monitoring import router as monitoring_router
from routes.vibez_654_prescription import router as vibez_654_prescription_router
from routes.vibe_654_tournament import router as vibe_654_tournament_router
from routes.vibe_654_social import router as vibe_654_social_router
from routes.card_multiplayer import router as card_multiplayer_router
from routes.vibe_wallet import router as vibe_wallet_router
from routes.payout_routes import router as payout_router
from routes.admin_treasury_routes import router as admin_treasury_router
from routes.staff_management_routes import router as staff_management_router
from routes.audit_log_routes import router as audit_log_router
from routes.god_mode_monitor import router as god_mode_monitor_router


def register_all_routes(
    api_router: APIRouter,
    app,
    logger: Optional[logging.Logger] = None,
) -> None:
    """Mount every router onto `api_router` (and a couple onto `app`).
    Optional/flaky routers stay wrapped in try/except so a single import
    failure never takes the whole API down.
    """
    log = logger or logging.getLogger(__name__)

    # ---- core mount block (failure here is fatal — fail fast) ----
    api_router.include_router(categories_router)
    api_router.include_router(safety_router)
    api_router.include_router(games_router)
    api_router.include_router(tournaments_router)
    api_router.include_router(card_royale_router)
    api_router.include_router(thirty_one_router)
    api_router.include_router(yahtzee_router)
    api_router.include_router(vibes_slots_router)
    api_router.include_router(fe_bingo_router)
    api_router.include_router(fe_cs_router)
    api_router.include_router(fe_sicbo_router)
    api_router.include_router(fe_craps_router)
    api_router.include_router(fe_vw_router)
    api_router.include_router(fe_keno_router)
    api_router.include_router(fe_gifts_router)
    api_router.include_router(fe_battle_router)
    # Casino Wave-II coming-soon games (Three Card Poker, Pai Gow, Casino War,
    # Chemin de Fer, European Roulette, Hazard, Chuck-A-Luck, Big Six Wheel,
    # Jacks or Better, Fan-Tan, Faro, Vibes Darts)
    api_router.include_router(w2_three_card_router)
    api_router.include_router(w2_pai_gow_router)
    api_router.include_router(w2_casino_war_router)
    api_router.include_router(w2_chemin_router)
    api_router.include_router(w2_eu_roulette_router)
    api_router.include_router(w2_hazard_router)
    api_router.include_router(w2_chuck_router)
    api_router.include_router(w2_big_six_router)
    api_router.include_router(w2_jacks_router)
    api_router.include_router(w2_fan_tan_router)
    api_router.include_router(w2_faro_router)
    api_router.include_router(w2_darts_router)
    # Game Lock Status — admin-only health dashboard for shipped games
    api_router.include_router(games_lock_router)
    # Apex Sovereign Layer (v6.5 Phase 1) — synergy + AI Oracle + pulse polls + VIP gate
    api_router.include_router(apex_router)
    # Collab Matchmaker (v6.5 Phase 2) — Duo Up voting + Private Studios
    api_router.include_router(collab_router)
    # Live Freestyle Battles (v6.5 Phase 3) — Beat Vault + battles + betting
    api_router.include_router(freestyle_router)
    # Vibe Memory Bank (v6.5 Phase 4) — DRM cinema sales · 70/30 lifecycle
    api_router.include_router(memory_bank_router)
    # Cinema Date (v6.5 Phase 5) — cross-room shared streaming + Yes/No Pulses
    api_router.include_router(cinema_router)
    # Vibe TV Continuity (v6.5 Phase 6) — 24/7 channel + zip-targeted AI ads
    api_router.include_router(vibe_tv_router)
    # Pricing Tiers + Infrastructure Wallet (v7.0 Phase 7) — closed-loop self-funding
    api_router.include_router(pricing_router)
    # Beat Auctions (v7.0 Phase 8) — sealed-bid exclusive beat marketplace
    api_router.include_router(auctions_router)
    # Celestial Glasshouse Arena (v7.0 Phase 9) — Power Couple status + headliner slots
    api_router.include_router(arena_router)
    # GISA Pre-Beta Auditor (v8.0) — stress test + isolation + visual parity
    api_router.include_router(gisa_router)
    # International Globalization Protocol v2.0 — three-tier localization trigger
    api_router.include_router(localization_router)
    # Cultural Onboarding (v2.0) — detailed dating portal cultural profile
    api_router.include_router(cultural_onboarding_router)
    api_router.include_router(tournament_chat_router)
    api_router.include_router(tge_router)
    api_router.include_router(jftn_solana_router, tags=["JFTN Solana"])
    api_router.include_router(rewards_queue_router, tags=["Unity Rewards Escrow"])
    api_router.include_router(hybrid_identity_router, tags=["Hybrid Identity"])
    api_router.include_router(game_handshake_router, tags=["Game Handshake"])
    api_router.include_router(unity_game_ws_router, tags=["Unity Game Rooms"])
    api_router.include_router(vibe_ridez_dispatch_router, tags=["Vibe Ridez Dispatch"])
    api_router.include_router(viberidez_fare_split_router, tags=["VibeRidez Fare Split"])
    api_router.include_router(usdc_payout_admin_router, tags=["USDC Payout"])
    api_router.include_router(vibe_room_signaling_router, tags=["Vibe Room Signaling"])
    api_router.include_router(power_hour_sponsors_router, tags=["Power Hour & Sponsors"])
    from routes.sovereign_engine_routes import router as sovereign_engine_router  # noqa: PLC0415
    api_router.include_router(sovereign_engine_router)
    from routes.sovereign_ops_routes import router as sovereign_ops_router  # noqa: PLC0415
    api_router.include_router(sovereign_ops_router)
    from routes.turn_timer import router as turn_timer_router  # noqa: PLC0415
    api_router.include_router(turn_timer_router)
    api_router.include_router(twilio_router, tags=["Twilio"])
    api_router.include_router(streamflow_admin_router, tags=["Streamflow"])
    api_router.include_router(privy_auth_router, tags=["Privy Auth"])
    api_router.include_router(leaderboard_router)
    api_router.include_router(smartcar_router)
    api_router.include_router(spotify_router)
    api_router.include_router(vibe_drive_router)
    api_router.include_router(vanishing_messages_router)
    api_router.include_router(gift_cards_router)
    api_router.include_router(drivers_router)
    api_router.include_router(rides_router)
    api_router.include_router(social_router)
    api_router.include_router(ai_voice_router)
    api_router.include_router(profile_videos_router)
    api_router.include_router(quiz_router)
    api_router.include_router(matching_router)
    api_router.include_router(group_planner_router)
    api_router.include_router(subscriptions_router)
    api_router.include_router(would_you_rather_router)
    api_router.include_router(verification_router)
    api_router.include_router(driver_verification_router)
    api_router.include_router(trivia_router)
    api_router.include_router(practice_router)
    api_router.include_router(stats_router)
    api_router.include_router(vibez_router)
    api_router.include_router(avatars_router)
    api_router.include_router(dating_router)
    api_router.include_router(enhanced_dating_router)
    api_router.include_router(uploads_router)
    api_router.include_router(restaurants_router)
    api_router.include_router(vibe_venues_router)
    api_router.include_router(date_planner_router)
    api_router.include_router(dating_games_router)
    api_router.include_router(table_for_two_router)
    api_router.include_router(vibe_score_router)
    api_router.include_router(card_styles_router)
    api_router.include_router(ai_date_planner_router)
    api_router.include_router(tournament_winnings_router)
    # ── 🃏 Card games (all AAA prototype + practice routers) ──
    _register_card_games(api_router)
    # ── 🍔 HungryVibes / SmartStack (Feb 2026 features) ──
    _register_hungryvibes_smartstack(api_router)
    api_router.include_router(blackjack_universal_router)
    api_router.include_router(poker_practice_router)
    api_router.include_router(rummy_practice_router)
    api_router.include_router(mining_router)
    api_router.include_router(voice_mirror_router)
    api_router.include_router(voice_mirror_pair_router)
    api_router.include_router(marathon_router)
    api_router.include_router(rewards_router)
    api_router.include_router(baccarat_router)
    api_router.include_router(vibe_suites_router)
    api_router.include_router(god_mode_casino_router)
    api_router.include_router(system_monitor_router)
    api_router.include_router(insurance_verification_router)
    api_router.include_router(email_auth_router, prefix="/auth", tags=["email_auth"])
    api_router.include_router(ai_coach_router)
    api_router.include_router(vr_dating_router, tags=["vr_dating"])
    api_router.include_router(tables_router)
    api_router.include_router(http_multiplayer_router)
    api_router.include_router(friends_router)
    api_router.include_router(ai_date_planner_v2_router)
    api_router.include_router(my_vibez_router)
    api_router.include_router(my_vibez_content_router)
    api_router.include_router(coins_router)
    api_router.include_router(watch_and_wager_router)
    api_router.include_router(engagement_router)
    api_router.include_router(live_streaming_router)
    api_router.include_router(tournaments_router)
    api_router.include_router(video_call_router)
    api_router.include_router(ai_content_matching_router)
    api_router.include_router(ai_practice_router)
    api_router.include_router(monetization_router)
    api_router.include_router(rides_router)
    api_router.include_router(rides_safety_router)
    api_router.include_router(messaging_router)
    api_router.include_router(admin_router)
    api_router.include_router(admin_pricing_router)
    api_router.include_router(reports_router)
    api_router.include_router(ratings_router)
    api_router.include_router(notifications_router)
    api_router.include_router(vibe_ridez_router)
    api_router.include_router(entry_fee_router)
    api_router.include_router(battle_pass_router)
    api_router.include_router(roulette_router)
    api_router.include_router(blackjack_router, prefix="/blackjack", tags=["blackjack"])
    api_router.include_router(cyber_casino_router)
    api_router.include_router(elite_subscription_router)
    api_router.include_router(cosmetics_shop_router)
    api_router.include_router(streaming_router)
    api_router.include_router(moderation_router)
    api_router.include_router(ads_router)
    api_router.include_router(slots_router)
    api_router.include_router(multiplayer_slots_router)
    api_router.include_router(video_chat_router)
    api_router.include_router(dealer_router)
    api_router.include_router(tournament_router)
    api_router.include_router(chat_router, tags=["chat"])
    api_router.include_router(progression_router, tags=["progression"])
    api_router.include_router(cosmetics_router, tags=["cosmetics"])
    api_router.include_router(smart_tables_router, tags=["smart-tables"])
    api_router.include_router(currency_router, tags=["currency"])
    api_router.include_router(bid_whist_meta_router, tags=["bid-whist-meta"])
    api_router.include_router(spectator_router, tags=["spectator"])
    api_router.include_router(dealer_integration_router, tags=["dealer-integration"])
    api_router.include_router(social_features_router, tags=["social"])
    api_router.include_router(community_slots_router, tags=["slots"])
    api_router.include_router(metahuman_websocket_router, tags=["metahuman-ws"])
    api_router.include_router(private_suites_router, tags=["private-suites"])
    api_router.include_router(matchmaking_router, tags=["matchmaking"])
    api_router.include_router(just_for_the_night_router, tags=["just-for-the-night"])
    api_router.include_router(vr_dating_websocket_router, tags=["vr-dating"])
    api_router.include_router(vr_physical_bridge_router)
    api_router.include_router(bonds_router)
    api_router.include_router(teleport_cosmetics_router)
    api_router.include_router(admin_dashboard_router, tags=["admin"])
    api_router.include_router(vibez_654_prescription_router, prefix="/games/vibe654", tags=["vibe654"])
    api_router.include_router(vibe_654_tournament_router)
    api_router.include_router(vibe_654_social_router)
    api_router.include_router(card_multiplayer_router)
    api_router.include_router(vibe_wallet_router, prefix="/wallet", tags=["wallet"])
    api_router.include_router(payout_router, tags=["treasury"])
    api_router.include_router(admin_treasury_router, tags=["admin-treasury"])
    api_router.include_router(staff_management_router, tags=["admin-staff"])
    api_router.include_router(audit_log_router, tags=["admin-audit"])
    api_router.include_router(god_mode_monitor_router, tags=["god-mode-monitoring"])

    # health is mounted on `app` directly (no /api prefix) for the LB.
    from routes.health import router as health_router  # noqa: PLC0415
    app.include_router(health_router)

    api_router.include_router(metahuman_router, prefix="/metahuman")
    api_router.include_router(subscription_tiers_router, tags=["subscriptions"])
    api_router.include_router(crypto_payments_router, tags=["crypto-payments"])
    api_router.include_router(referral_system_router, tags=["referrals"])
    api_router.include_router(leaderboards_router, tags=["leaderboards"])
    api_router.include_router(dynamic_pricing_router, tags=["pricing"])
    api_router.include_router(monitoring_router, tags=["monitoring"])

    # User preferences — per-user persisted state (table style, wallet memo).
    try:
        from routes.user_preferences import router as user_preferences_router
        api_router.include_router(user_preferences_router, tags=["preferences"])
    except Exception as _e:
        log.warning(f"User preferences routes not mounted: {_e}")

    # Admin live-seats aggregator (Seat Card widget on God-Mode dashboard).
    try:
        from routes.admin_live_seats import router as admin_live_seats_router
        api_router.include_router(admin_live_seats_router, tags=["admin-live-seats"])
    except Exception as _e:
        log.warning(f"Admin live-seats routes not mounted: {_e}")

    # Big Wheel Lounge — public lobbies/leaderboard for the BIG_WHEEL ruleset.
    try:
        from routes.big_wheel_lounge import router as big_wheel_lounge_router
        api_router.include_router(big_wheel_lounge_router, tags=["big-wheel-lounge"])
    except Exception as _e:
        log.warning(f"Big Wheel Lounge routes not mounted: {_e}")

    # Solana network monitor (Gas Monitor + TPS Graph widgets on God-Mode).
    try:
        from routes.solana_network import router as solana_network_router
        api_router.include_router(solana_network_router, tags=["solana-network"])
    except Exception as _e:
        log.warning(f"Solana network routes not mounted: {_e}")

    # ---- optional / env-gated mount blocks ----
    try:
        from routes.vibe_phone import router as vibe_phone_router
        api_router.include_router(vibe_phone_router, tags=["vibe-phone"])
    except Exception as _e:
        log.warning(f"Vibe Phone routes not mounted: {_e}")

    try:
        from routes.vibez_654 import router as vibez_654_router
        from routes.friend_notifier import router as friend_notifier_router
        from routes.god_mode_audit import router as god_mode_audit_router
        from routes.florida_flow import router as florida_flow_router
        api_router.include_router(vibez_654_router, tags=["vibez-654"])
        api_router.include_router(friend_notifier_router, tags=["friend-events"])
        api_router.include_router(god_mode_audit_router, tags=["god-mode-audit"])
        api_router.include_router(florida_flow_router, tags=["florida-flow"])
    except Exception as _e:
        log.warning(f"Florida Flow routes not mounted: {_e}")

    try:
        from routes.profit_share import router as profit_share_router
        api_router.include_router(profit_share_router, tags=["profit-share"])
    except Exception as _e:
        log.warning(f"Profit-share routes not mounted: {_e}")

    # ── Master Blueprint + Genius Phase (PDFs · 2026-05-09) ──────────
    # DSG 6 Lottery · Vibe Spots cancellation · Vibe Core orchestrator.
    # All three are self-contained; failure of one doesn't impact others.
    try:
        from routes.dsg6_lottery import router as dsg6_router
        api_router.include_router(dsg6_router, tags=["dsg6-lottery"])
    except Exception as _e:
        log.warning(f"DSG 6 Lottery routes not mounted: {_e}")
    try:
        from routes.vibe_spots import router as vibe_spots_router
        api_router.include_router(vibe_spots_router, tags=["vibe-spots"])
    except Exception as _e:
        log.warning(f"Vibe Spots routes not mounted: {_e}")
    try:
        from routes.vibe_core_orchestrator import router as vibe_core_router
        api_router.include_router(vibe_core_router, tags=["vibe-core"])
    except Exception as _e:
        log.warning(f"Vibe Core orchestrator not mounted: {_e}")

    # Chess Hall — puzzles, blitz results, tournament queue (May 2026)
    try:
        from routes.chess_hall import router as chess_hall_router
        api_router.include_router(chess_hall_router, tags=["chess-hall"])
    except Exception as _e:
        log.warning(f"Chess Hall routes not mounted: {_e}")

    # Sports Lounge — Vibe Sports Book "Social Stakes" (May 2026)
    try:
        from routes.sports_lounge import router as sports_lounge_router
        api_router.include_router(sports_lounge_router, tags=["sports-lounge"])
    except Exception as _e:
        log.warning(f"Sports Lounge routes not mounted: {_e}")

    # Vibe Integrity & Ban Protocol — crowdsourced consensus + 3-strike ban (May 2026)
    try:
        from routes.integrity_protocol import router as integrity_router
        api_router.include_router(integrity_router, tags=["integrity"])
    except Exception as _e:
        log.warning(f"Integrity Protocol routes not mounted: {_e}")

    # Sovereign Tiers — 5-tier premium ladder (May 2026)
    try:
        from routes.sovereign_tiers import router as sovereign_tiers_router  # noqa: PLC0415
        api_router.include_router(sovereign_tiers_router, tags=["tiers"])
    except Exception as _e:
        log.warning(f"Sovereign Tiers routes not mounted: {_e}")

    # Underground Live Network — Music & Dance Battles + Crowd Judge (May 2026 P2)
    try:
        from routes.underground_live import router as underground_live_router  # noqa: PLC0415
        api_router.include_router(underground_live_router, tags=["underground-live"])
    except Exception as _e:
        log.warning(f"Underground Live routes not mounted: {_e}")

    # Free-Stake Spectator Betting (May 2026 P2)
    try:
        from routes.spectator_bet import router as spectator_bet_router  # noqa: PLC0415
        api_router.include_router(spectator_bet_router, tags=["spectator-bet"])
    except Exception as _e:
        log.warning(f"Spectator-bet routes not mounted: {_e}")

    # Receipt OCR + 15% Merchant Boost (May 2026 P2)
    try:
        from routes.receipts_ocr import router as receipts_ocr_router  # noqa: PLC0415
        api_router.include_router(receipts_ocr_router, tags=["receipts"])
    except Exception as _e:
        log.warning(f"Receipt OCR routes not mounted: {_e}")

    # Recent Rooms — Personal Homeworld feature (May 2026 enhancement)
    try:
        from routes.recent_rooms import router as recent_rooms_router  # noqa: PLC0415
        api_router.include_router(recent_rooms_router, tags=["recent-rooms"])
    except Exception as _e:
        log.warning(f"Recent Rooms routes not mounted: {_e}")

    # Live Activity Ticker (May 2026 — Volumetric Galaxy bottom band)
    try:
        from routes.live_activity import router as live_activity_router  # noqa: PLC0415
        api_router.include_router(live_activity_router, tags=["live-activity"])
    except Exception as _e:
        log.warning(f"Live Activity routes not mounted: {_e}")

    try:
        from routes.cinema_room import router as cinema_room_router
        api_router.include_router(cinema_room_router, tags=["cinema-room"])
    except Exception as _e:
        log.warning(f"Cinema Room routes not mounted: {_e}")

    try:
        from routes.cinema_network_room import router as cinema_network_room_router
        api_router.include_router(cinema_network_room_router, tags=["cinema-network-room"])
    except Exception as _e:
        log.warning(f"Cinema Network Room routes not mounted: {_e}")

    try:
        from routes.live_pulse import router as live_pulse_router
        api_router.include_router(live_pulse_router, tags=["live-pulse"])
    except Exception as _e:
        log.warning(f"Live Pulse routes not mounted: {_e}")

    try:
        from routes.premium_pricing import router as premium_pricing_router
        api_router.include_router(premium_pricing_router, tags=["premium-pricing"])

        from routes.founders_pass import router as founders_pass_router
        api_router.include_router(founders_pass_router, tags=["founders-pass"])

        from routes.chairs import router as chairs_router
        api_router.include_router(chairs_router, tags=["chairs"])

        from routes.invites import router as invites_router
        api_router.include_router(invites_router, tags=["invites"])

        from routes.chair_share import router as chair_share_router
        api_router.include_router(chair_share_router, tags=["chair-share"])

        from routes.economy_control import router as economy_control_router
        api_router.include_router(economy_control_router, tags=["economy-control"])

        from routes.milestones import router as milestones_router
        api_router.include_router(milestones_router, tags=["milestones"])

        from routes.apex_evolution import router as apex_evolution_router
        api_router.include_router(apex_evolution_router, tags=["apex-evolution"])

        from routes.chair_holder_votes import router as chair_holder_votes_router
        api_router.include_router(chair_holder_votes_router, tags=["chair-holder-votes"])
    except Exception as _e:
        log.warning(f"Premium pricing routes not mounted: {_e}")

    try:
        from routes.agora_token import router as agora_token_router
        api_router.include_router(agora_token_router, tags=["agora-vibe-call"])
    except Exception as _e:
        log.warning(f"Agora Vibe Call routes not mounted: {_e}")

    try:
        from routes.solana_indexer import router as solana_indexer_admin_router
        api_router.include_router(solana_indexer_admin_router, tags=["solana-indexer"])
    except Exception as _e:
        log.warning(f"Solana indexer admin routes not mounted: {_e}")

    # Vibez Treasury — 40-30-30 split + transparency dashboard.
    try:
        from routes.treasury import router as treasury_router
        api_router.include_router(treasury_router, tags=["treasury"])
    except Exception as _e:
        log.warning(f"Treasury routes not mounted: {_e}")

    # Sovereign Mining Vault v1.0 — 6 mining streams + 30-day maturity.
    try:
        from routes.sovereign_mining_routes import router as sovereign_mining_router
        api_router.include_router(sovereign_mining_router, tags=["sovereign-mining"])
    except Exception as _e:
        log.warning(f"Sovereign Mining routes not mounted: {_e}")

    # Performance webhook alerts — fires Slack/Discord ping when route p95
    # crosses a threshold. Endpoints are admin-gated; the actual loop is
    # started in lifespan.py only if PERF_ALERT_WEBHOOK_URL is set.
    try:
        from services.perf_alert import router as perf_alert_router
        api_router.include_router(perf_alert_router, tags=["admin"])
    except Exception as _e:
        log.warning(f"Perf alert routes not mounted: {_e}")

    # Agent self-improvement — design-lesson persistence.
    try:
        from routes.agent_learning import router as agent_learning_router
        api_router.include_router(agent_learning_router, tags=["agent"])
    except Exception as _e:
        log.warning(f"Agent-learning routes not mounted: {_e}")

    # Manifesto features (Pyth oracle, solvency, burn queue, vibe-credits, hybrid status).
    try:
        from routes.manifesto_features import router as manifesto_router
        api_router.include_router(manifesto_router, tags=["manifesto"])
    except Exception as _e:
        log.warning(f"Manifesto features not mounted: {_e}")

    # Beta Waitlist (public signup + admin list) — Feb 2026 redeploy.
    try:
        from routes.beta_waitlist import router as beta_waitlist_router, admin_router as beta_waitlist_admin_router
        api_router.include_router(beta_waitlist_router)
        api_router.include_router(beta_waitlist_admin_router)
    except Exception as _e:
        log.warning(f"Beta waitlist routes not mounted: {_e}")

    # i18n translator (Feb 2026 — Emergent LLM-backed, replaces Google Translate widget).
    try:
        from routes.i18n import router as i18n_router
        api_router.include_router(i18n_router)
    except Exception as _e:
        log.warning(f"i18n routes not mounted: {_e}")

    # Vibe Yellow Pages (May 2026 — 4th Pillar: Mom & Pop directory + DSG Guard).
    try:
        from routes.yellow_pages import router as yellow_pages_router
        api_router.include_router(yellow_pages_router)
    except Exception as _e:
        log.warning(f"Yellow Pages routes not mounted: {_e}")

    # Vibez Coin top-up (May 2026 — Stripe → users.credits_balance).
    try:
        from routes.coin_topup import router as coin_topup_router
        api_router.include_router(coin_topup_router)
    except Exception as _e:
        log.warning(f"Coin top-up routes not mounted: {_e}")

    # Public Burn Counter stats (May 2026 — landing-page scarcity widget).
    try:
        from routes.coin_stats import router as coin_stats_router
        api_router.include_router(coin_stats_router)
    except Exception as _e:
        log.warning(f"Coin stats routes not mounted: {_e}")

    # Voice Coach — Cyber-Casino chess coach (Whisper STT + Claude).
    try:
        from routes.voice_coach import router as voice_coach_router
        api_router.include_router(voice_coach_router)
    except Exception as _e:
        log.warning(f"Voice coach routes not mounted: {_e}")

    # Roguelite Chess Trial — 24-hr permadeath ladder.
    try:
        from routes.roguelite_chess import router as roguelite_chess_router
        api_router.include_router(roguelite_chess_router)
    except Exception as _e:
        log.warning(f"Roguelite chess routes not mounted: {_e}")

    # Immutable Core — locked economic constants (Ultimate Blueprint v3).
    # Failure here is FATAL: if the Sovereign Tax or 70/30 split has
    # drifted, the server refuses to start.
    try:
        from routes.immutable_core import router as immutable_core_router, verify_locks
        verify_locks()
        api_router.include_router(immutable_core_router)
    except Exception as _e:
        log.error(f"❌ IMMUTABLE CORE VIOLATION: {_e}")
        raise

    # Equity Master — Crewmate Architecture, 30% Revenue Split, Diamond
    # Market Logic (Global_Vibez_DSG_Equity_Master.pdf). Locked numbers
    # for the ownership pool, dividend math, and chair tier caps.
    try:
        from routes.equity_master import router as equity_master_router
        api_router.include_router(equity_master_router)
    except Exception as _e:
        log.error(f"❌ EQUITY MASTER MOUNT FAILED: {_e}")
        raise

    # DSG Core System — Developer Handbook + Core_System_Code PDFs (Feb 2026).
    # Regional TV Hubs, Cinema 80/20 split, House Revenue Pool tracking,
    # Quarterly Payout Protocol, 24h Settlement Lock. Plugs into the
    # Equity Master locked constants.
    try:
        from routes.dsg_core_system import router as dsg_core_router
        api_router.include_router(dsg_core_router)
    except Exception as _e:
        log.error(f"⚠️ DSG_CORE_SYSTEM mount failed: {_e}")

    # My Vibez Optimization Module + Room Redefinition Blueprint
    # (Feb 2026 PDFs). Dynamic theming (Celestial Glasshouse /
    # Underground Club), regional ad injection, cinema premiere walls,
    # ambassador attribution. Imports & feeds the DSG Core House Pool.
    try:
        from routes.my_vibez_optimization import router as my_vibez_opt_router
        api_router.include_router(my_vibez_opt_router)
    except Exception as _e:
        log.error(f"⚠️ MY_VIBEZ_OPTIMIZATION mount failed: {_e}")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Feb 2026 Founder Roadmap — 8-item engagement/revenue/retention push.
    # All modules below are non-fatal so a single failure can't block the
    # whole API startup.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    for mod_name, label in (
        ("routes.my_vibez_feed",            "MY_VIBEZ_FEED (item 1)"),
        ("routes.creator_earnings",         "CREATOR_EARNINGS (item 2)"),
        ("routes.live_commerce",            "LIVE_COMMERCE (item 3)"),
        ("routes.crews",                    "CREWS (item 4)"),
        ("routes.streamer_copilot",         "STREAMER_COPILOT (item 6)"),
        ("routes.safety_streaks_tourneys",  "SAFETY/STREAKS/TOURNEYS (item 7)"),
        ("routes.rum_collector",            "RUM (item 8)"),
    ):
        try:
            mod = __import__(mod_name, fromlist=["router"])
            api_router.include_router(mod.router)
        except Exception as _e:
            log.error(f"⚠️ {label} mount failed: {_e}")

    # Cinematic Landing Video — Sora 2 generated walkthrough.
    try:
        from routes.landing_video import router as landing_video_router
        api_router.include_router(landing_video_router)
    except Exception as _e:
        log.warning(f"Landing video routes not mounted: {_e}")

    # DSG Guard — Safety & Operations Module (PDF §May 2026).
    # Locks the 1.5-mi route deviation rail, 15s acceptance window,
    # and the VibeShoppers 70/13.5/10 payout split.
    try:
        from routes.dsg_guard import router as dsg_guard_router
        api_router.include_router(dsg_guard_router)
    except Exception as _e:
        log.warning(f"DSG Guard routes not mounted: {_e}")

    # Streamer Action Hub — unifying tip-to-action rail backing the
    # Streamer Revenue / Master Tech / Party Hub blueprints.
    try:
        from routes.streamer_actions import router as streamer_actions_router
        api_router.include_router(streamer_actions_router)
    except Exception as _e:
        log.warning(f"Streamer Action Hub routes not mounted: {_e}")

    # Beat Vault DLC mint — finished-track Vibe DLC flow.
    # SIMULATED mode until the founder confirms the project_complete
    # safe phrase; on-chain mainnet hand-off is identical schema.
    try:
        from routes.beat_dlc import router as beat_dlc_router
        api_router.include_router(beat_dlc_router)
    except Exception as _e:
        log.warning(f"Beat Vault DLC routes not mounted: {_e}")

    # Video Vault — sibling marketplace to Beat Vault for video-side
    # creators (B-roll, motion graphics, stream overlays, tutorials).
    # Wired through services.content_rights so DMCA + signed-URL plumbing
    # is shared with Beat Vault and any future asset class.
    try:
        from routes.video_vault import router as video_vault_router
        api_router.include_router(video_vault_router)
    except Exception as _e:
        log.warning(f"Video Vault routes not mounted: {_e}")

    # Cloudflare Stream — RTMP/SRT ingest for every-device → every-audience
    # broadcast. STUB mode when CF env vars are absent (frontend exercises
    # the full flow); LIVE the moment the founder pastes account+token+subdomain.
    try:
        from routes.cloudflare_stream import router as cf_stream_router
        api_router.include_router(cf_stream_router)
    except Exception as _e:
        log.warning(f"Cloudflare Stream routes not mounted: {_e}")

    # Stripe Connect / Payouts webhook — receives charge.succeeded,
    # payout.paid, account.updated, etc. Signature-verified by Stripe's
    # official SDK using STRIPE_WEBHOOK_SECRET.
    try:
        from routes.stripe_payouts_webhook import router as stripe_payouts_router
        api_router.include_router(stripe_payouts_router)
    except Exception as _e:
        log.warning(f"Stripe payouts webhook not mounted: {_e}")

    # Featured Streamers — paid promotion tier for the Live Now Wall.
    # $5/30 days via Stripe Checkout. Webhook grants are handled by the
    # stripe_payouts_webhook module's _handle_checkout_completed branch.
    try:
        from routes.featured_streamers import router as featured_router
        api_router.include_router(featured_router)
    except Exception as _e:
        log.warning(f"Featured Streamers routes not mounted: {_e}")

    # High Roller VIP tier — gated 10k-coin-minimum casino room.
    # Tiered Stripe Checkout (Genius/Genesis/Apex) flips `vip_until`
    # via the stripe_payouts_webhook's `vip:` ref-prefix handler.
    try:
        from routes.high_roller import router as high_roller_router
        api_router.include_router(high_roller_router)
    except Exception as _e:
        log.warning(f"High Roller routes not mounted: {_e}")

    # Media Master ecosystem — DSG TV Network, Vibe Radio, DSG Music
    # Group, AI Scout. Layers on age_verification + coin_wallet + content_rights.
    try:
        from routes.media_master import router as media_master_router
        api_router.include_router(media_master_router)
    except Exception as _e:
        log.warning(f"Media Master routes not mounted: {_e}")

    # Media Master Pulse — founder analytics dashboard (read-only).
    try:
        from routes.media_master_pulse import router as media_master_pulse_router
        api_router.include_router(media_master_pulse_router)
    except Exception as _e:
        log.warning(f"Media Master Pulse routes not mounted: {_e}")

    # Streamer Wrap-Up emails — Monday 09:00 UTC per-streamer analytics
    # digest. The loop itself is started during server startup (see
    # server.py); these routes provide preview + manual-send surfaces.
    try:
        from routes.streamer_wrap_up import router as wrap_up_router
        api_router.include_router(wrap_up_router)
    except Exception as _e:
        log.warning(f"Streamer Wrap-Up routes not mounted: {_e}")

    # Streamer Referral Program (P3) — viral acquisition loop. Streamer
    # shares ?ref=CODE → new user signs up → on their FIRST live event
    # the original streamer earns 1,000 ₵ + 5 days Featured. Payout is
    # triggered by the Cloudflare Stream webhook (`cloudflare_stream.py`).
    try:
        from routes.streamer_referral import router as referral_router
        api_router.include_router(referral_router)
    except Exception as _e:
        log.warning(f"Streamer Referral routes not mounted: {_e}")

    # Streamer Follow + Live Push Notifications — follow/unfollow API
    # plus the CF-webhook fan-out helper that buzzes every follower's
    # phone the moment a streamer goes live.
    try:
        from routes.streamer_follow import router as follow_router
        api_router.include_router(follow_router)
    except Exception as _e:
        log.warning(f"Streamer Follow routes not mounted: {_e}")

    # $VIBEZ Activity Multiplier reward formula (Roadmap PDF §1).
    # SIMULATED mints until the founder confirms project_complete.
    try:
        from routes.vibez_rewards import router as vibez_rewards_router
        api_router.include_router(vibez_rewards_router)
    except Exception as _e:
        log.warning(f"$VIBEZ rewards routes not mounted: {_e}")

    # Totem Pole rails — Music Arena + TV broadcast survival logic.
    # Implements GlobalVibez_MusicArena_Blueprint.pdf and
    # GlobalVibez_TV_TotemPole_Blueprint.pdf on a single shared rail
    # so the music side and TV side can never drift on threshold or
    # the 70/30 split.
    try:
        from routes.totem_pole import router as totem_pole_router
        api_router.include_router(totem_pole_router)
    except Exception as _e:
        log.warning(f"Totem Pole routes not mounted: {_e}")



# ─── Domain helpers (Feb 2026 polish split) ──────────────────────────
# These keep `register_routes` readable as the router count grew past
# 100. Logic is unchanged from the inline block — purely structural.
# Migrate more groups here over time (admin, casino, social, etc.).

def _register_card_games(api_router) -> None:
    """All card-game routers (AAA practice + spades/bid_whist HTTP MP)."""
    api_router.include_router(spades_router)
    api_router.include_router(bid_whist_router)
    api_router.include_router(bid_whist_practice_router)
    api_router.include_router(crazy_eights_practice_router)
    api_router.include_router(euchre_practice_router)
    api_router.include_router(gin_rummy_practice_router)
    api_router.include_router(go_fish_practice_router)
    api_router.include_router(hearts_practice_router)
    api_router.include_router(pinochle_practice_router)
    api_router.include_router(spades_practice_router)
    api_router.include_router(uno_practice_router)
    api_router.include_router(war_practice_router)
    api_router.include_router(dominoes_practice_router)
    api_router.include_router(dominoes_mp_router)


def _register_hungryvibes_smartstack(api_router) -> None:
    """HungryVibes merchant dashboard + Smart Logistics driver/ops layer."""
    api_router.include_router(hungryvibes_merchant_router)
    api_router.include_router(hungryvibes_public_router)
    api_router.include_router(smartstack_router)
    api_router.include_router(smartstack_admin_router)
    api_router.include_router(hungryvibes_orders_router)

    # 2026-05-12 — unified earnings rollup powering the main-dashboard widget.
    from routes.unified_earnings import router as unified_earnings_router  # noqa: PLC0415
    api_router.include_router(unified_earnings_router)

    # 2026-05-12 — Stripe Connect Express onboarding (scaffolded;
    # auto-degrades to `configured: false` until live keys are added).
    from routes.stripe_connect import router as stripe_connect_router  # noqa: PLC0415
    api_router.include_router(stripe_connect_router)

    # 2026-05-12 — Beta Cohort Report for God Mode.
    from routes.admin_beta_cohort import router as admin_beta_cohort_router  # noqa: PLC0415
    api_router.include_router(admin_beta_cohort_router)

    # 2026-05-13 — DSG Economic Engine (Vibez Coin Dual-Asset Shield).
    # Encodes Global_Vibez_DSG_Economic_Engine.pdf: 3B → 1.5B dynamic
    # burn (4% → 0.5%) + 50/50 revenue split (buyback/burn + liquidity).
    from routes.economic_engine import router as economic_engine_router  # noqa: PLC0415
    api_router.include_router(economic_engine_router)

    # 2026-05-13 — Legal Age Verification Protocol (21+ restricted goods).
    # Encodes Legal_Age_Verification_Protocol.pdf: alcohol + tobacco gate,
    # menu shadow-gating, driver eligibility, audit trail, admin override.
    from routes.age_verification import router as age_verification_router  # noqa: PLC0415
    api_router.include_router(age_verification_router)

    # 2026-05-13 — Content Rights & IP Protection (Content_Rights_And_IP_Policy.pdf).
    # Signed time-limited download URLs, DMCA 24h takedown, 3-strike
    # repeat-infringer policy, 10-day escrow, metadata blocklist.
    from routes.content_rights import router as content_rights_router  # noqa: PLC0415
    api_router.include_router(content_rights_router)

    # 2026-05-16 — Genius Phase Merchant Onboarding (dsg_merchant_strategy.pdf).
    # Flat $100-$150 activation fee, baked-in $20 Chair, 50K cap,
    # 100-chair ceiling, 3-mile Push Blast radius, DSG TV ad-flights.
    from routes.merchant_onboarding import router as merchant_onboarding_router  # noqa: PLC0415
    api_router.include_router(merchant_onboarding_router)

    # 2026-05-17 — Match Consensus Verification + 72h Payout Airlock.
    # Anti-cheat: both teams submit independently, consensus locks the
    # winner, mismatches flag DISPUTED and emit a security alert.
    from routes.match_consensus import router as match_consensus_router  # noqa: PLC0415
    api_router.include_router(match_consensus_router)

    # 2026-05-18 — Security Directive D4: admin security console
    # (events feed + global airlock queue + manual release trigger).
    from routes.admin_security import router as admin_security_router  # noqa: PLC0415
    api_router.include_router(admin_security_router)
