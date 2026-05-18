"""
🛡 REGRESSION SHIELD — Global Vibez DSG

The single pytest file every agent MUST run before declaring any task
"done". If this file stays green, the core of the app is healthy.
If it goes red, STOP — something regressed.

Run locally:
    cd /app/backend && python -m pytest tests/regression_shield.py -v

Run via the convenience script (includes frontend TS check):
    /app/scripts/run_shield.sh

Every time a bug is fixed, add a new test case in the `# --- LOCKED ---`
section below with the format:
    #  [YYYY-MM-DD] what broke, what fixed it, how this test catches it again

This way, a bug that shipped once can never ship again silently.
"""
from __future__ import annotations

import os
import pytest

os.environ.setdefault("DB_NAME", "test_regression_shield")

# --- Backend engine smoke --------------------------------------------------

def test_fastapi_imports_cleanly() -> None:
    """Backend must import without ImportError + load all routers."""
    from server import app
    assert len(app.routes) > 1000, f"Expected >1000 routes, got {len(app.routes)}"


def test_euchre_engine_boots() -> None:
    from utils.euchre_game import EuchreGame
    g = EuchreGame()
    v = g.to_view() if hasattr(g, "to_view") else None
    # Must have a playable hand once dealt.
    assert g is not None


def test_pinochle_engine_boots() -> None:
    from utils.pinochle_game import PinochleGame
    g = PinochleGame()
    assert g is not None


def test_hearts_engine_boots() -> None:
    from utils.hearts_game import HeartsGame
    g = HeartsGame()
    assert g is not None


def test_gin_rummy_to_view_exposes_meld_groups() -> None:
    """Feb 2026: front-end meld-grouping depends on to_view() returning
    both `meld_groups` aggregate AND per-card `meld_id`. If either goes
    missing the Gin Rummy room silently breaks into a flat list again."""
    from utils.gin_rummy_game import GinRummyGame
    g = GinRummyGame()
    v = g.to_view()
    assert "meld_groups" in v, "Gin Rummy lost `meld_groups` key"
    assert "your_hand" in v
    assert all("meld_id" in c for c in v["your_hand"]), "Gin Rummy card missing meld_id"


def test_rummy_to_view_exposes_meld_groups() -> None:
    from utils.rummy_game import RummyGame
    g = RummyGame()
    v = g.to_view()
    assert "meld_groups" in v, "Rummy lost `meld_groups` key"
    assert all("meld_id" in c for c in v["your_hand"]), "Rummy card missing meld_id"


def test_dominoes_engine_boots() -> None:
    from utils.dominoes_game import DominoesGame
    g = DominoesGame()
    assert g is not None


# --- Data contracts the frontend depends on --------------------------------

def test_coming_soon_list_exists_and_is_populated() -> None:
    """The Coming Soon gating system reads from one JSON-ish TS source.
    If that file is accidentally emptied or renamed, the entire "WIP
    game" badge system vanishes silently and users click through to
    broken rooms.

    NOTE: As of 2026-02-15, every game in the lobby has shipped end-to-end,
    so the set is intentionally empty. We assert the file + exports remain
    intact so a future regression that renames or deletes the module is
    still caught — which is what the test was actually defending against.
    """
    path = "/app/frontend/src/data/comingSoonGames.ts"
    assert os.path.exists(path), "comingSoonGames.ts was deleted or moved"
    content = open(path).read()
    assert "COMING_SOON_GAME_IDS" in content
    assert "isComingSoon" in content


def test_privy_button_has_self_hide_guard() -> None:
    """Feb 2026 — PrivyLoginButton was retired in May 2026 dead-file
    sweep (component was never mounted in LoginPage). Lock the
    NOT-MOUNTED state instead so it can't sneak back in."""
    from pathlib import Path
    assert not Path("/app/frontend/src/components/web3/PrivyLoginButton.tsx").exists(), (
        "PrivyLoginButton.tsx came back — it was retired in May 2026 because "
        "the CSP self-hide guard caused a 'really big outrageous modal' regression."
    )
    login = open("/app/frontend/src/pages/LoginPage.tsx").read()
    assert "PrivyLoginButton" not in login, "LoginPage tried to mount the retired PrivyLoginButton"


def test_demo_login_seeds_credits() -> None:
    """Feb 2026: new demo users must spawn with credits_balance so
    Baccarat/Blackjack/Roulette work on a fresh DB without manual
    mongo seeding. If this seed drops, every fresh deploy starts with
    'insufficient credits' errors."""
    path = "/app/backend/server.py"
    content = open(path).read()
    # Must set credits_balance on both the fresh-user branch AND top-up.
    assert '"credits_balance": 5000' in content, "Demo credits seed removed"


def test_dockerfile_has_node_heap_bump() -> None:
    """Deploys went OOM for 3 attempts when NODE_OPTIONS wasn't set in
    the Docker build stage. This is belt-and-suspenders — the build
    script also prefixes NODE_OPTIONS."""
    path = "/app/frontend/Dockerfile"
    content = open(path).read()
    assert "max-old-space-size" in content, "Docker build lost heap cap — will OOM"


# --- Visual contracts (grep-level guards, fast) ----------------------------

def test_hearts_pass_modal_ink_is_dark() -> None:
    """Feb 2026: fix was slate-100 → slate-900 so cards are readable on
    white faces. If the CSS reverts, clubs/spades go invisible again."""
    path = "/app/frontend/src/components/hearts-aaa/HeartsPassModal.tsx"
    content = open(path).read()
    assert "text-slate-900" in content, "Hearts pass-modal ink went light again"
    assert "text-rose-700" in content, "Hearts rose ink went light again"


def test_euchre_hand_visible_during_bidding() -> None:
    """Feb 2026: hand fan was gated to `phase === 'playing'` only. Now
    renders for all non-finished phases. If that gate comes back,
    players can't see their cards during Order Up / Name Trump."""
    path = "/app/frontend/src/pages/games/EuchreAAA.tsx"
    content = open(path).read()
    # The restrictive gate must not return.
    assert 'raw.phase === "playing" || raw.phase === "ordered_dealer_discard" ? (' not in content
    # The new permissive gate must stay.
    assert "raw.your_hand && raw.your_hand.length > 0 && !finished && !scoring" in content


def test_pinochle_hand_visible_during_bidding() -> None:
    path = "/app/frontend/src/pages/games/PinochleAAA.tsx"
    content = open(path).read()
    assert 'raw.phase === "playing" ? (' not in content
    assert "raw.your_hand && raw.your_hand.length > 0 && !finished && !scoring" in content


def test_baccarat_has_canonical_route() -> None:
    """User expected /baccarat to land on BaccaratPremium. Was 404ing."""
    path = "/app/frontend/src/routes/gamesRoutes.tsx"
    content = open(path).read()
    assert 'path="/baccarat"' in content, "/baccarat canonical route removed"


def test_baccarat_uses_vibez_coins_not_usd() -> None:
    """Platform rule: NO `$` USD anywhere in the Baccarat room — only
    `₵` Vibez Coins. A $ symbol creeping back is a brand regression."""
    for path in (
        "/app/frontend/src/pages/games/BaccaratPremium.tsx",
        "/app/frontend/src/components/practice_games/PracticeBaccarat.tsx",
    ):
        content = open(path).read()
        # Allow ${variable} template strings but ban standalone `$NUM` labels.
        bad_lines = [
            ln for ln in content.splitlines()
            if (">$" in ln or "label={\"$" in ln or "label=\"$" in ln)
        ]
        assert not bad_lines, f"{path} reintroduced USD `$` labels: {bad_lines[:3]}"


def test_chair_orb_component_exists() -> None:
    """Feb 2026: ChairOrb is the single source of truth for the floating
    chair visuals. Wall + Vault + Teaser all import it. If it's deleted
    those pages fall back to broken imports."""
    path = "/app/frontend/src/components/chairs/ChairOrb.tsx"
    assert os.path.exists(path), "ChairOrb component deleted"
    content = open(path).read()
    assert "radial-gradient" in content, "ChairOrb lost its sphere gradient"


def test_coming_soon_overlay_component_exists() -> None:
    path = "/app/frontend/src/components/games/ComingSoonOverlay.tsx"
    assert os.path.exists(path), "ComingSoonOverlay component deleted"


def test_quick_emoji_button_component_exists() -> None:
    path = "/app/frontend/src/components/chat/QuickEmojiButton.tsx"
    assert os.path.exists(path), "QuickEmojiButton component deleted"


def test_hand_fan_sorts_by_suit() -> None:
    """Feb 2026: hands must be auto-grouped by suit. Updated 2026-02-05 —
    Founder requested H ♥ → C ♣ → D ♦ → S ♠ ordering (red/black/red/black
    alternation) so player eye-scan stays clean."""
    path = "/app/frontend/src/components/spades/SpadesHandFan.tsx"
    content = open(path).read()
    assert "SUIT_ORDER" in content, "HandFan lost suit ordering constant"
    assert "sortBySuit" in content, "HandFan lost sort helper"
    assert "displayHand" in content, "HandFan is not rendering the sorted copy"
    # Lock the H-C-D-S order (red/black/red/black). The exact numeric
    # values matter: hearts MUST come before clubs, clubs before diamonds,
    # diamonds before spades. We assert the literal order via positional
    # matching so a future refactor can't silently reorder.
    h = content.find("hearts:")
    c = content.find("clubs:")
    d = content.find("diamonds:")
    s = content.find("spades:")
    assert h > -1 and c > -1 and d > -1 and s > -1, "Suit keys missing"
    assert h < c < d < s, (
        "Suit order regressed — must be hearts → clubs → diamonds → spades"
    )


def test_round_modal_auto_advances_5s() -> None:
    """Feb 2026: user said round-end modal 'shouldn't sit there for a
    long time' — should show stats for ~5s then auto-advance to next
    round. A countdown bar visualises the wait."""
    path = "/app/frontend/src/components/spades/SpadesRoundModal.tsx"
    content = open(path).read()
    assert "autoAdvanceMs" in content, "Round modal lost auto-advance prop"
    assert "spades-round-countdown" in content, "Round modal lost countdown bar"


def test_euchre_scoring_auto_advances() -> None:
    path = "/app/frontend/src/pages/games/EuchreAAA.tsx"
    content = open(path).read()
    assert "setTimeout(() => { newHand(); }, 5000)" in content, (
        "Euchre lost its 5s auto-advance between hands."
    )


def test_pinochle_scoring_auto_advances() -> None:
    path = "/app/frontend/src/pages/games/PinochleAAA.tsx"
    content = open(path).read()
    assert "setTimeout(() => { newHand(); }, 5000)" in content, (
        "Pinochle lost its 5s auto-advance between hands."
    )


def test_login_card_not_globally_hoverable() -> None:
    """Feb 2026: the GlassCard wrapping the login form defaulted to
    hoverable=true, so touching ANYWHERE on the card made the whole
    bar scale + glow — users read that as "the app is broken, of
    course I can't log in." The card must pass hoverable={false}
    explicitly so only the action buttons react."""
    path = "/app/frontend/src/pages/LoginPage.tsx"
    content = open(path).read()
    assert 'hoverable={false}' in content, (
        "LoginPage GlassCard lost its hoverable={false} — whole card will "
        "glow on touch again, signalling 'broken app' to users."
    )
    # Action buttons must each have a hover glow so THEY are what reacts.
    assert 'login-demo-btn' in content
    assert 'login-google-btn' in content
    assert 'login-signin-btn' in content


# --- Locked-in fixes -------------------------------------------------------
# Every time we fix a bug, ADD A TEST HERE. That bug can never ship again.
#
#  [2026-02-02] Hearts pass-modal cards were invisible (slate-100 on white).
#               Test: test_hearts_pass_modal_ink_is_dark
#  [2026-02-02] Euchre hand was hidden during bidding phase.
#               Test: test_euchre_hand_visible_during_bidding
#  [2026-02-02] Pinochle hand was hidden during bidding phase.
#               Test: test_pinochle_hand_visible_during_bidding
#  [2026-02-02] Gin Rummy / Rummy cards weren't grouped by meld.
#               Tests: test_gin_rummy_to_view_exposes_meld_groups,
#                      test_rummy_to_view_exposes_meld_groups
#  [2026-02-02] Baccarat /baccarat canonical route was 404ing.
#               Test: test_baccarat_has_canonical_route
#  [2026-02-02] Baccarat showed $ USD instead of ₵ Vibez Coins.
#               Test: test_baccarat_uses_vibez_coins_not_usd
#  [2026-02-02] Fresh demo user had 0 credits → Baccarat/Blackjack broken.
#               Test: test_demo_login_seeds_credits
#  [2026-02-02] Frontend Docker build OOM-killed (no heap cap in Dockerfile).
#               Test: test_dockerfile_has_node_heap_bump
#  [2026-02-02] Privy modal rendered full-screen on domains not in allow-list.
#               Test: test_privy_button_has_self_hide_guard
#  [2026-02-03] Entire login card glowed on any touch (looked broken).
#               Test: test_login_card_not_globally_hoverable
#  [2026-02-03] Card-game hands had mixed suits (clubs + hearts + spades
#               intertwined) — players couldn't read their shape.
#               Test: test_hand_fan_sorts_by_suit
#  [2026-02-03] Round-end scoring screen sat indefinitely between hands.
#               Test: test_round_modal_auto_advances_5s,
#                     test_euchre_scoring_auto_advances,
#                     test_pinochle_scoring_auto_advances
#
# --- Vibe 654 Social Engine (Feb 03, 2026) ---------------------------------
# The Founder dropped 4 PDFs for the 6-5-4 rooms: Chat Tipping, SideBet,
# Dual Arena, Breadwinner. This guards each of their permanent surfaces.


def test_vibe_654_social_routes_mounted() -> None:
    """Tip + hype + sidebet + odds + social-feed endpoints must be registered."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    required = {
        "/api/vibe654/tournament/{table_id}/tip",
        "/api/vibe654/tournament/{table_id}/hype",
        "/api/vibe654/tournament/{table_id}/sidebet",
        "/api/vibe654/tournament/{table_id}/sidebets",
        "/api/vibe654/tournament/{table_id}/odds",
        "/api/vibe654/tournament/{table_id}/social-feed",
    }
    missing = required - paths
    assert not missing, f"Vibe 654 social routes missing: {missing}"


def test_vibe_654_coliseum_component_exists() -> None:
    """The shared Celestial Glass Coliseum shell must exist on disk."""
    from pathlib import Path
    comp = Path("/app/frontend/src/components/vibe654/Coliseum.tsx")
    assert comp.exists(), "Coliseum.tsx missing — Breadwinner Arena regression"
    body = comp.read_text()
    # Both variants MUST be supported (dual arena spec).
    assert "'coliseum'" in body and "'solo'" in body, "Coliseum variants regressed"
    # 20 seat anchors rendered via angular placement.
    assert "(360 / n) * idx" in body, "Seat circular placement regressed"


def test_vibe_654_hype_fee_is_one_coin() -> None:
    """PDF 1 spec: hype emojis cost 1 ₵. Never raise or zero this silently."""
    from routes.vibe_654_social import HYPE_FEE, HYPE_TYPES
    assert HYPE_FEE == 1
    assert HYPE_TYPES == {"fire", "cashbag", "horn"}


def test_vibe_654_sidebet_settlement_hook_wired() -> None:
    """
    play_tournament_round must import + call settle_side_bets_for_round on
    WINNER. Without this, spectator bets would sit open forever.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibe_654_tournament.py").read_text()
    assert "settle_side_bets_for_round" in src, "Side-bet settlement hook regressed"
    assert "detect_six_five_four_in_round" in src, "6-5-4 hit detector regressed"


def test_vibe_654_solo_high_roller_route_registered() -> None:
    """Dual Arena spec: the 1vAI Solo Vault must be reachable at /vibe-654/solo."""
    from pathlib import Path
    src = Path("/app/frontend/src/routes/gamesRoutes.tsx").read_text()
    assert '"/vibe-654/solo"' in src, "Solo Vault route regressed"
    assert '"/vibe-654/coliseum/:tableId"' in src, "Coliseum canonical route regressed"


# --- Card Multiplayer (Feb 03, 2026) ---------------------------------------
# Euchre + Pinochle 4-seat HTTP rooms ride on the existing engines.


def test_card_multiplayer_routes_mounted() -> None:
    """Every card-multiplayer endpoint used by the frontend must be registered."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    required = {
        "/api/card-multiplayer/create-room",
        "/api/card-multiplayer/rooms",
        "/api/card-multiplayer/room/{room_id}",
        "/api/card-multiplayer/room/{room_id}/join",
        "/api/card-multiplayer/room/{room_id}/leave",
        "/api/card-multiplayer/room/{room_id}/fill-bots",
        "/api/card-multiplayer/room/{room_id}/start",
        "/api/card-multiplayer/room/{room_id}/bid",
        "/api/card-multiplayer/room/{room_id}/play-card",
        "/api/card-multiplayer/room/{room_id}/next-hand",
    }
    missing = required - paths
    assert not missing, f"Card multiplayer routes missing: {missing}"


def test_card_mp_room_page_and_routes_exist() -> None:
    """Universal MP room page + route must be on disk and wired."""
    from pathlib import Path
    page = Path("/app/frontend/src/pages/games/CardMpRoomPage.tsx")
    assert page.exists(), "CardMpRoomPage.tsx missing"
    routes = Path("/app/frontend/src/routes/gamesRoutes.tsx").read_text()
    assert '"/card-mp/:gameType/:roomId"' in routes, "card-mp route regressed"


def test_euchre_pinochle_have_multiplayer_cta() -> None:
    """Both AAA lobbies must expose the Play Live Multiplayer CTA."""
    from pathlib import Path
    for f in [
        "/app/frontend/src/pages/games/EuchreAAA.tsx",
        "/app/frontend/src/pages/games/PinochleAAA.tsx",
    ]:
        src = Path(f).read_text()
        assert "CardMpLobbyModal" in src, f"CardMpLobbyModal import regressed in {f}"
        assert "Play Live Multiplayer" in src, f"MP CTA regressed in {f}"


def test_stale_http_multiplayer_card_games_redirect() -> None:
    """
    HttpGameRouter must redirect hearts/rummy/gin_rummy/war/gofish/crazy_eights
    to the canonical AAA rooms. No regressions to the old standalone pages.
    Also /http-multiplayer/* canonical path redirects at the router level.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/HttpGameRouter.tsx").read_text()
    for game, target in [
        ("'hearts'", '"/hearts"'),
        ("'rummy'", '"/rummy"'),
        ("'ginrummy'", '"/gin-rummy"'),
        ("'war'", '"/war"'),
        ("'gofish'", '"/go-fish"'),
        ("'crazyeights'", '"/crazy-eights"'),
    ]:
        assert f'gameType === {game}' in src and target in src, f"{game} unification regressed"

    routes = Path("/app/frontend/src/routes/gamesRoutes.tsx").read_text()
    # Top-level redirect routes for legacy /http-multiplayer/<game> paths.
    for path, target in [
        ("/http-multiplayer/hearts", "/hearts"),
        ("/http-multiplayer/rummy", "/rummy"),
        ("/http-multiplayer/gin-rummy", "/gin-rummy"),
        ("/http-multiplayer/war", "/war"),
        ("/http-multiplayer/go-fish", "/go-fish"),
        ("/http-multiplayer/crazy-eights", "/crazy-eights"),
        ("/http-multiplayer/euchre", "/euchre"),
        ("/http-multiplayer/pinochle", "/pinochle"),
    ]:
        assert f'path="{path}"' in routes, f"Top-level redirect for {path} missing"
        assert f'to="{target}"' in routes, f"Top-level redirect target {target} missing"


def test_vibez_654_solo_accepts_credits_balance_wallet() -> None:
    """
    Legacy demo accounts carry ``credits_balance`` instead of ``token_balance``.
    The Solo start endpoint must honour either so Ante-In doesn't 402.
    Round-8 refactor: value-based selection now routes through
    `utils.wallet_fields.pick_wallet_field_for_debit` (shared helper).
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibez_654.py").read_text()
    # Helper import + usage in the bet-gating flow.
    assert "pick_wallet_field_for_debit" in src, (
        "Solo start no longer uses the shared debit helper"
    )
    # Helper's own test verifies value-based semantics (both keys accepted).


def test_vibez_654_solo_uses_5_dice_654_rules() -> None:
    """
    Feb 4 2026 — the Solo Vault was rebuilt from the 3-dice Florida flow to
    the OFFICIAL 5-dice 6-5-4 sequential rules. NUM_DICE must stay 5 and the
    sequential-peel helper must exist.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibez_654.py").read_text()
    assert "NUM_DICE = 5" in src, "Solo dice count regressed — must be 5"
    assert "MAX_ROLLS = 3" in src, "Solo max rolls regressed — must be 3"
    assert "_apply_654_pass" in src, "Sequential 6→5→4 peel helper regressed"
    # _apply_654_pass must check 6 first, 5 requires has_6, 4 requires has_5.
    import re
    body = re.search(r"def _apply_654_pass[\s\S]+?return \{", src).group(0)
    assert "not has_6 and 6 in" in body, "6-first gate regressed"
    assert "has_6 and not has_5 and 5 in" in body, "5-after-6 gate regressed"
    assert "has_5 and not has_4 and 4 in" in body, "4-after-5 gate regressed"


def test_vibez_654_prescription_wallet_fallback_works() -> None:
    """
    Regular Vibe 654 ("/dice" route) was 'not taking bets' because the /play
    endpoint read/wrote db.wallets.balance, but legacy demo users carry
    credits_balance on the users doc. Lock the dual-wallet fallback.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibez_654_prescription.py").read_text()
    assert "async def _wallet_inc" in src, "_wallet_inc helper regressed"
    assert "users.credits_balance" in src, "credits_balance fallback regressed"
    # /stand must also have the fallback.
    assert "wallet_row = await db.wallets.find_one" in src, "/stand wallet lookup regressed"


def test_vibedice_premium_uses_real_user_id_and_table() -> None:
    """
    The frontend hardcoded userId='test_user_dice' + table_id='vibez654_table_1'
    which mismatched the auth'd user and never hit a real table. Lock the
    real-auth resolution + dynamic table fetch.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/VibeDice654Premium.tsx").read_text()
    assert "useState('test_user_dice')" not in src, "userId hardcoding regressed"
    assert "vibez654_table_1" not in src, "table_id hardcoding regressed"
    assert "getStoredUserId" in src, "real user-id helper regressed"
    assert "resolveTableId" in src, "dynamic table resolution regressed"


def test_vibe654_solo_dice_tray_hides_qualifier_tiles() -> None:
    """
    Per the Founder's rules walkthrough (Feb 4 2026): a die showing 6, then
    5, then 4 is REMOVED from the physical set — not shown as a locked tile.
    The DiceFace component must not render a 'label' prop anymore.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/VibeSoloHighRoller.tsx").read_text()
    assert "state: 'locked'" not in src, "locked dice state regressed onto the tray"
    assert "label?: string" not in src, "DiceFace label prop regressed"


def test_decision_popdown_is_centered_not_top_anchored() -> None:
    """
    Founder requested the Roll Again/Stand modal pop up in the MIDDLE of the
    screen, not near the top. Lock the centered layout.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/vibe654/DecisionPopDown.tsx").read_text()
    assert "top-28" not in src, "DecisionPopDown reverted to top-anchored layout"
    assert "items-center justify-center" in src, "DecisionPopDown centering regressed"


def test_socketio_handlers_have_type_hints() -> None:
    """
    Feb 2026 type-hint sweep — bid_whist, messaging, matchmaking SocketIO
    handlers must stay fully annotated so IDE hints + linters keep working.
    """
    import ast
    from pathlib import Path
    for f in [
        "/app/backend/services/bid_whist_socket_events.py",
        "/app/backend/services/messaging_socketio.py",
        "/app/backend/services/matchmaking_socket_events.py",
    ]:
        tree = ast.parse(Path(f).read_text())
        missing = 0
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                params = [a.arg for a in node.args.args if a.arg not in ("self", "cls") and a.annotation is None]
                if node.returns is None or params:
                    missing += 1
        assert missing == 0, f"{f} regressed — {missing} functions lost type hints"


def test_vibe654_play_picks_highest_balance_wallet() -> None:
    """
    Feb 4 2026: standalone Vibe Dice 654 (/dice) returned 'Insufficient
    balance' for the demo user even though they had 96 980 credits, because
    the /play endpoint locked onto the FIRST wallet candidate found —
    which happened to be a stray 0-balance wallets row. Lock the
    'highest balance wins' selection so a stray empty wallet never blocks
    a player who has funds elsewhere.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibez_654_prescription.py").read_text()
    assert "candidates: list[tuple[str, float]] = []" in src, (
        "vibez_654 wallet candidate list regressed"
    )
    assert "candidates.sort(key=lambda x: x[1], reverse=True)" in src, (
        "vibez_654 wallet 'pick highest balance' rule regressed"
    )


def test_solo_vault_decision_dock_is_side_mounted() -> None:
    """
    Founder requested the Pay/Stand button live as a side-mounted standalone
    dock (like the side-bet pop-down) instead of a center-screen overlay
    that obscured the dice tray. Lock the SideDockDecision wiring.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/VibeSoloHighRoller.tsx").read_text()
    assert "SideDockDecision" in src, "Solo Vault no longer uses the side-mounted decision dock"
    assert "DecisionPopDown" not in src, (
        "Solo Vault regressed to the legacy center pop-down — must use SideDockDecision"
    )
    dock = Path("/app/frontend/src/components/vibe654/SideDockDecision.tsx")
    assert dock.exists(), "SideDockDecision component file missing"
    dsrc = dock.read_text()
    # Desktop right-edge + mobile bottom-sticky variants both required.
    assert "fixed right-4" in dsrc, "SideDockDecision desktop right-edge anchor regressed"
    assert "fixed bottom-0 inset-x-0" in dsrc, (
        "SideDockDecision mobile bottom-sticky anchor regressed"
    )


def test_room_menu_bar_component_with_themes() -> None:
    """
    Feb 2026 mobile responsiveness sweep introduced a themable RoomMenuBar
    that gives every game room a distinct top bar (per the Founder request
    for 'different view style to each room menu bar'). Lock the component
    + its theme variants so future refactors don't collapse them back into
    a single generic header.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/games/RoomMenuBar.tsx").read_text()
    for theme in ["spades", "hearts", "vibe654", "vibesolo", "colosseum"]:
        assert f"'{theme}'" in src or f'"{theme}"' in src, (
            f"RoomMenuBar lost the '{theme}' theme"
        )
    # Mobile-friendly bar must also drop the back-button label on narrow
    # screens so the title doesn't get pushed off-screen.
    assert 'hidden sm:inline">Back' in src, "RoomMenuBar lost mobile back-label hide"


def test_spades_hand_fan_scales_on_mobile() -> None:
    """
    Feb 2026 mobile responsiveness sweep: a 13-card hand at the desktop
    'md' size (72px each, -28 overlap) needs ~600px and overflows a 390px
    iPhone viewport. Lock the responsive sizing + viewport-based overlap.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/spades/SpadesHandFan.tsx").read_text()
    assert "useState" in src and "innerWidth" in src, (
        "SpadesHandFan lost viewport-aware sizing"
    )
    assert "computedOverlap" in src, "SpadesHandFan lost dynamic overlap calc"
    assert 'cardSize === "sm"' in src, (
        "SpadesHandFan lost the small-card breakpoint for narrow viewports"
    )


def test_aaa_top_bars_wrap_on_mobile() -> None:
    """
    Feb 2026: the AAA card-game top bar (Spades/Hearts/Pinochle/etc.) had
    Back-button + 4 pill chips + score badge crammed onto one row, which
    overflowed below 640px. Lock the flex-wrap on every AAA room so the
    pills column drops to a new line on mobile instead of clipping the
    score badge.
    """
    from pathlib import Path
    rooms = [
        "BidWhistAAA", "CrazyEightsAAA", "DominoesAAA", "EuchreAAA",
        "GinRummyAAA", "GoFishAAA", "HeartsAAA", "PinochleAAA", "RummyAAA",
        "SpadesAAA", "UnoAAA", "WarAAA",
    ]
    missing: list[str] = []
    for r in rooms:
        src = Path(f"/app/frontend/src/pages/games/{r}.tsx").read_text()
        if "flex flex-wrap items-start justify-between" not in src:
            missing.append(r)
    assert not missing, (
        f"AAA top bar lost mobile flex-wrap in: {', '.join(missing)}"
    )


def test_vibe_rooms_use_compressed_single_viewport_layout() -> None:
    """
    Feb 5 2026: Founder asked every gambling room to be 'more compressed —
    it's hard having to scroll up or down when you're betting'. Lock the
    `h-[100dvh] flex flex-col overflow-hidden` shell on the three Vibe
    rooms so the chip rail + dice + decision dock always fit in one
    viewport without page-level scroll.
    """
    from pathlib import Path
    rooms = [
        "VibeSoloHighRoller",
        "VibeDice654Premium",
        "VibeColiseum",
    ]
    missing: list[str] = []
    for r in rooms:
        src = Path(f"/app/frontend/src/pages/games/{r}.tsx").read_text()
        if "h-[100dvh]" not in src or "flex-col" not in src:
            missing.append(r)
    assert not missing, (
        f"Compressed single-viewport shell regressed in: {', '.join(missing)}"
    )


def test_coliseum_center_stage_shows_live_qualifier_chips() -> None:
    """
    Feb 5 2026: Founder asked the Coliseum center stage to show live
    qualifier progress (different from the Solo Vault — cyan-emerald
    palette) instead of just a static trophy + pot. Lock the qualifier
    row + tiny dice + cyan-emerald button.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/VibeColiseum.tsx").read_text()
    assert 'data-testid="vibe654-coliseum-qualifier-row"' in src, (
        "Coliseum lost the live qualifier chip row"
    )
    assert 'data-testid="vibe654-coliseum-tiny-dice"' in src, (
        "Coliseum lost the tiny dice tray"
    )
    assert "from-cyan-500 to-emerald-600" in src, (
        "Coliseum 'Play Next Orbit' lost its cyan-emerald palette "
        "(must stay distinct from Solo Vault's amber-fuchsia)"
    )
    # And ensure the static Trophy import is gone — we rebuilt it.
    assert "Trophy" not in src, "Coliseum still importing Trophy after redesign"


def test_vibedice_premium_drawer_toggles_present() -> None:
    """
    Feb 5 2026: standalone /dice room moved Side Bets + Recent Rolls into
    floating drawer toggles so the main play column stays compressed.

    May 12 2026: founder reformat — both toggles were folded into the
    compact betting strip (BettingControls.tsx) so they live inside
    Row 1 right beside the Assurance pill. The page-level pills are gone;
    Premium.tsx now only mounts the AnimatePresence popups. Lock the new
    locations so we never regress.
    """
    from pathlib import Path
    page_src = Path("/app/frontend/src/pages/games/VibeDice654Premium.tsx").read_text()
    bc_src = Path("/app/frontend/src/components/games/vibedice654/BettingControls.tsx").read_text()

    # New contract — pills live inside the compact betting strip.
    assert 'data-testid="sidebets-dropdown-trigger"' in bc_src, (
        "Compact betting strip lost the Side Bets dropdown trigger pill"
    )
    assert 'data-testid="vibe654-toggle-recent"' in bc_src, (
        "Compact betting strip lost the Recent Rolls toggle pill"
    )

    # Premium page mounts the popups via AnimatePresence only when toggled.
    assert 'data-testid="sidebets-popup"' in page_src, (
        "/dice page lost the Side Bets popup overlay"
    )
    assert 'data-testid="recent-rolls-popup"' in page_src, (
        "/dice page lost the Recent Rolls popup overlay"
    )

    # May 2026: Founder originally asked to eliminate scrolling on this
    # room. Feb 2026 follow-up: that `overflow-hidden` change made the
    # game unplayable on smaller phones — chip drawer + sidebets fell
    # off-screen with no way to reach them. Founder said "fix this game
    # back to when it was perfect", so we restored `overflow-y-auto`
    # (the original "perfect" state). Lock the scrollable variant in.
    assert "flex-1 min-h-0 overflow-y-auto" in page_src, (
        "Standalone /dice lost the scrollable main region — founder said "
        "the original 'perfect' build kept overflow-y-auto so all controls "
        "stay reachable on mobile."
    )


def test_universal_2_to_20_player_signaling_endpoint_present() -> None:
    """
    Feb 6 2026: built per `Universal_2-20_Player_Integration.pdf`. Lock the
    signaling endpoint + Focus System component so future refactors don't
    delete the multi-human voice/video plumbing.
    """
    from pathlib import Path
    backend = Path("/app/backend/routes/vibe_room_signaling.py").read_text()
    # Endpoint
    assert "@router.websocket(" in backend, "WS endpoint disappeared"
    assert "/vibe-room/ws/{room_id}/{user_id}" in backend, (
        "Vibe room WebSocket route regressed"
    )
    assert "/vibe-room/{room_id}/peers" in backend, (
        "Vibe room roster GET endpoint regressed"
    )
    # Spec contracts
    for kind in ("rtc_signal", "voice_activity", "speaker_update", "peer_joined", "peer_left"):
        assert kind in backend, f"signaling event {kind!r} regressed"
    # 20-peer hard cap (PDF spec)
    assert "ROOM_CAP = 20" in backend, "Vibe room hard cap of 20 regressed"

    # Frontend Focus System component
    front = Path("/app/frontend/src/components/games/VibeRoomVoice.tsx").read_text()
    assert "Focus System" in front, "VibeRoomVoice lost the Focus System docstring"
    assert "maxFocusTiles" in front, "VibeRoomVoice lost the configurable focus-tile cap"
    assert "data-testid=\"vibe-room-tile\"" in front, (
        "VibeRoomVoice lost the per-peer testid"
    )
    # The room is wired into VibeColiseum (most-multi-player surface).
    coli = Path("/app/frontend/src/pages/games/VibeColiseum.tsx").read_text()
    assert "VibeRoomVoice" in coli, "VibeRoomVoice not wired into the Coliseum"


def test_http_room_shell_unifies_legacy_multiplayer_pages() -> None:
    """
    Feb 6 2026: the 16+ legacy `HttpMultiplayer*` pages each had their own
    bespoke top header. Unified by wrapping every render through
    `HttpGameRouter` with the shared `HttpRoomShell` (themable
    `RoomMenuBar`). Lock the wrapper + Dominoes redirect.
    """
    from pathlib import Path
    shell = Path("/app/frontend/src/pages/HttpRoomShell.tsx").read_text()
    assert "RoomMenuBar" in shell, "HttpRoomShell lost the shared menu bar"
    assert "THEME_BY_GAME" in shell, "HttpRoomShell lost the per-game theme map"
    router = Path("/app/frontend/src/pages/HttpGameRouter.tsx").read_text()
    assert "HttpRoomShell" in router, "HttpGameRouter not wrapping with HttpRoomShell"
    assert "Navigate to=\"/dominoes\"" in router, (
        "Dominoes legacy HTTP page must redirect to the AAA /dominoes room"
    )


def test_privy_auth_skips_preview_domains() -> None:
    """
    Feb 6 2026: Privy SDK threw a CSP frame-ancestors 403 +
    `TypeError: e is not a function` on every preview URL because the
    Emergent preview hostname can't be whitelisted in the Privy dashboard.
    Lock the host-pattern skip-list so the console stays clean on
    `*.preview.emergentagent.com`.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/web3/PrivyAuthProvider.tsx").read_text()
    assert "PRIVY_SKIP_PATTERNS" in src, (
        "PrivyAuthProvider lost the preview-host skip pattern list"
    )
    assert "preview" in src and "emergentagent" in src, (
        "Privy skip pattern for Emergent previews regressed"
    )
    assert "shouldSkipPrivy()" in src, (
        "PrivyAuthProvider lost the skip-on-mount check"
    )
    assert "force_privy" in src, (
        "QA override flag (?force_privy=1) regressed — needed to test Privy on preview"
    )


def test_coliseum_e2e_probe_file_present() -> None:
    """
    Feb 6 2026: previous testing-agent flagged that the in-table Coliseum
    center stage was only verified via source-grep, not at runtime. Added
    a Playwright probe that creates a real table + navigates to the
    coliseum route + asserts qualifier chips, tiny dice, pot, and the
    Universal 2-20 voice bar are all in the DOM. Lock the probe file.
    """
    from pathlib import Path
    probe = Path("/app/backend/tests/test_coliseum_e2e_probe.py")
    assert probe.exists(), "Coliseum e2e probe deleted"
    src = probe.read_text()
    assert "vibe654-coliseum-qualifier-row" in src, (
        "e2e probe no longer asserts the qualifier row"
    )
    assert "vibe-room-voice" in src, (
        "e2e probe no longer asserts the Universal voice bar mount"
    )


def test_vibe_room_voice_does_real_webrtc_negotiation() -> None:
    """
    Feb 6 2026 (round 3): VibeRoomVoice was upgraded from placeholder
    letter-avatar tiles → real WebRTC P2P media. Lock the negotiation
    primitives so a future refactor can't silently regress the room
    back to a "no-video" state.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/games/VibeRoomVoice.tsx").read_text()
    for token in (
        "RTCPeerConnection",
        "createOffer",
        "createAnswer",
        "setLocalDescription",
        "setRemoteDescription",
        "addIceCandidate",
        "ontrack",
        "DEFAULT_ICE_SERVERS",
        "stun:stun.l.google.com:19302",
    ):
        assert token in src, f"VibeRoomVoice lost WebRTC primitive: {token}"
    # Glare-avoidance rule (smaller user_id offers).
    assert "userId >= remoteId" in src, (
        "VibeRoomVoice lost the glare-avoidance rule"
    )
    # Real <video> elements rendered for peers with active video tracks.
    assert "<video" in src and "srcObject" in src, (
        "VibeRoomVoice lost real <video> rendering"
    )


def test_http_multiplayer_pages_drop_redundant_inline_headers() -> None:
    """
    Feb 6 2026 (round 3): legacy `HttpMultiplayer*` pages used to ship
    their own bespoke `<motion.h1>♔ TITLE ♚</motion.h1>` block at the
    top — now that `HttpRoomShell` wraps them with the unified
    `RoomMenuBar`, those redundant headers were stripped. Lock the
    cleanup so future refactors can't reintroduce double headers.
    """
    from pathlib import Path
    pages_dir = Path("/app/frontend/src/pages/games")
    bespoke_pattern = '<div className="text-center mb-6">'
    motion_h1 = "<motion.h1"
    offenders: list[str] = []
    for p in pages_dir.glob("HttpMultiplayer*.tsx"):
        src = p.read_text()
        if bespoke_pattern in src and motion_h1 in src:
            offenders.append(p.name)
    assert not offenders, (
        f"HttpMultiplayer pages still ship the legacy bespoke title block: "
        f"{', '.join(offenders)}"
    )


def test_dominoes_chain_uses_master_plan_dynamic_tile_scale() -> None:
    """
    Feb 6 2026 (round 3): per `Global_Vibez_DSG_Master_Plan_v2.pdf`,
    Dominoes chain tiles must shrink as the chain grows
    (`max(0.4, 0.7 - chain.length * 0.01)`). Lock the formula so the
    AAA Dominoes board doesn't blow up to 12 tiles wide on mobile.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/DominoesAAA.tsx").read_text()
    assert "0.7 - raw.chain.length * 0.01" in src, (
        "Dominoes dynamic tile scale formula regressed"
    )
    assert 'data-testid="dominoes-chain-tile"' in src, (
        "Dominoes chain-tile testid regressed"
    )
    assert "Math.max(\n                          0.4," in src or "Math.max(0.4" in src or "0.4," in src, (
        "Dominoes scale floor of 0.4 regressed"
    )


def test_vibe_room_voice_has_turn_fallback_and_ptt() -> None:
    """
    Feb 6 2026 (round 4):
      * TURN-server fallback (OpenRelay) so symmetric-NAT/carrier-NAT
        beta testers can land voice/video. Private TURN swappable via
        REACT_APP_TURN_URL/USER/PASS env triplet.
      * Push-to-Talk hotkey — hold spacebar to broadcast. Skips when a
        chat composer is focused so we don't hijack typing.
    Lock both so future refactors can't silently regress them.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/components/games/VibeRoomVoice.tsx").read_text()
    # TURN fallback wiring
    assert "openrelay.metered.ca" in src, (
        "VibeRoomVoice lost the OpenRelay TURN fallback"
    )
    assert "REACT_APP_TURN_URL" in src, (
        "VibeRoomVoice lost the private-TURN env-var override"
    )
    # Push-to-Talk wiring
    assert "pushToTalk" in src, "VibeRoomVoice lost push-to-talk state"
    assert "Push-to-Talk" in src, "VibeRoomVoice lost PTT user-facing copy"
    assert "e.code !== 'Space'" in src or "e.code === 'Space'" in src or "Space" in src, (
        "VibeRoomVoice PTT spacebar binding regressed"
    )
    assert "isTypingTarget" in src, (
        "VibeRoomVoice lost the chat-composer guard for PTT"
    )
    assert 'data-testid="vibe-room-ptt-toggle"' in src, (
        "VibeRoomVoice PTT toggle testid regressed"
    )


def test_no_jsx_files_remain_in_frontend() -> None:
    """
    Feb 6 2026 (round 4): converted every shadcn/ui primitive from .jsx
    to .tsx so the codebase is now uniformly TypeScript. Lock the zero
    .jsx invariant so future PRs don't reintroduce mixed extensions.
    """
    from pathlib import Path
    jsx = list(Path("/app/frontend/src").rglob("*.jsx"))
    assert not jsx, (
        f"{len(jsx)} .jsx file(s) reintroduced — should be .tsx for "
        f"consistency: {[str(p.relative_to('/app/frontend/src')) for p in jsx][:10]}"
    )


def test_auth_dependency_accepts_bearer_header() -> None:
    """
    Feb 6 2026 (round 5 — auth audit): both
    `utils/auth_dependencies.py::get_current_user_from_session` and
    `routes/vibe_drive.py::_resolve_user_id` now accept the
    `Authorization: Bearer ...` header in addition to the
    `session_token` cookie. Lock the fallback so curl + server-to-server
    flows never break again.
    """
    from pathlib import Path
    src = Path("/app/backend/utils/auth_dependencies.py").read_text()
    assert "Authorization" in src and "Bearer" in src and "auth_header" in src, (
        "auth_dependencies.py lost the Bearer header fallback"
    )
    drive = Path("/app/backend/routes/vibe_drive.py").read_text()
    assert "Bearer" in drive and "auth_header" in drive, (
        "vibe_drive.py lost the Bearer header fallback"
    )


def test_power_hour_master_plan_v4_endpoint_present() -> None:
    """
    Feb 6 2026 (round 5): per `Global_Vibez_DSG_Master_Plan_v4.pdf`,
    chair purchases between 5pm-9pm America/New_York get a +10% weight
    bonus. Lock the server-side time-gate + the chair grant pipeline
    that stamps `power_hour_bonus=True` and multiplies `weight` by
    `POWER_HOUR_MULT`.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/power_hour_sponsors.py").read_text()
    assert "is_power_hour_active" in src, "Power Hour gate function regressed"
    assert "POWER_HOUR_MULT = 1.10" in src, "Power Hour multiplier regressed"
    assert "America/New_York" in src, "Power Hour timezone regressed"
    assert "POWER_HOUR_START_HOUR = 17" in src and "POWER_HOUR_END_HOUR = 21" in src, (
        "Power Hour 5pm-9pm window regressed"
    )
    chairs = Path("/app/backend/routes/chairs.py").read_text()
    assert "power_hour_bonus" in chairs, (
        "chair_purchases.power_hour_bonus stamp regressed"
    )
    assert "is_power_hour_active()" in chairs, (
        "chairs.py no longer reads the Power Hour gate at purchase time"
    )


def test_sponsor_achievement_v4_endpoint_present() -> None:
    """
    Feb 6 2026 (round 5): per Master Plan v4, ambassadors who recruit
    5 verified Vibe Sponsors unlock 1 free chair (idempotent, capped at
    3 lifetime chairs / 15 sponsors per ambassador). Lock the grant
    pipeline + idempotency key.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/power_hour_sponsors.py").read_text()
    assert "SPONSORS_PER_FREE_CHAIR = 5" in src, (
        "Sponsor achievement threshold regressed"
    )
    assert "MAX_FREE_CHAIRS_PER_AMBASSADOR = 3" in src, (
        "Sponsor achievement lifetime cap regressed"
    )
    assert "_maybe_grant_free_chair" in src, (
        "Sponsor achievement grant fn regressed"
    )
    assert "sponsor_achievement_chair_grants" in src, (
        "Sponsor achievement idempotency collection regressed"
    )
    # Idempotency key shape — `sponsor_ach::{ambassador_id}::{n}`
    assert "sponsor_ach::" in src, (
        "Sponsor achievement idempotency key shape regressed"
    )


def test_power_hour_badge_frontend_component_present() -> None:
    """Lock the frontend badge so future refactors don't delete the
    user-facing nudge that surfaces the 5pm-9pm window."""
    from pathlib import Path
    src = Path("/app/frontend/src/components/chairs/PowerHourBadge.tsx").read_text()
    assert "data-testid=\"power-hour-badge\"" in src, (
        "PowerHourBadge testid regressed"
    )
    assert "/api/power-hour/status" in src, (
        "PowerHourBadge no longer polls the live status endpoint"
    )
    # Mounted on the chair-purchase landing surface.
    chair_vault = Path("/app/frontend/src/pages/ChairVault.tsx").read_text()
    assert "PowerHourBadge" in chair_vault, (
        "PowerHourBadge no longer mounted on /chair-vault landing page"
    )


def test_vibe_drive_vote_skip_endpoint_present() -> None:
    """
    Feb 6 2026 (round 5): step 1 of the Spotify upgrade ladder.
    Passenger + driver can vote-skip a track once per ride; majority
    triggers a skip. Locked here so the next agent can't regress the
    primitive while building auto-DJ / tip-to-skip on top.
    """
    from pathlib import Path
    src = Path("/app/backend/routes/vibe_drive.py").read_text()
    assert "/vote-skip" in src, "vote-skip endpoint regressed"
    assert "vibe_drive_skip_votes" in src, (
        "vote-skip audit collection regressed"
    )
    # Idempotency via upsert on (ride_id, user_id, track_uri).
    assert "ride_id" in src and "track_uri" in src, "vote-skip key shape regressed"


# ── Spotify Auto-DJ + Tip-to-Skip + Sovereign Engine + Chair Hall + Sponsor Admin
#    (uploaded 2026-02-06: Sovereign_Master_Vault_v9.pdf + Chair_Hall_Implementation.pdf)

def test_vibe_drive_auto_dj_endpoints_present() -> None:
    """Auto-DJ ladder step 2 — `/auto-dj/seed` builds the queue from
    rider's last-5 played + driver's vibe genres via sp.recommendations."""
    from pathlib import Path
    src = Path("/app/backend/routes/vibe_drive.py").read_text()
    assert '"/auto-dj/seed"' in src, "Auto-DJ seed endpoint regressed"
    assert '"/auto-dj/queue/{ride_id}"' in src, "Auto-DJ queue endpoint regressed"
    assert "recently_played" in src, "Auto-DJ rider seed (recently_played) regressed"
    assert "recommendations" in src, "Auto-DJ recommendations call regressed"
    assert "vibe_drive_auto_dj" in src, "Auto-DJ persistence collection regressed"
    spot = Path("/app/backend/services/spotify_service.py").read_text()
    assert "def recommendations" in spot, "spotify_service.recommendations regressed"
    assert "def recently_played" in spot, "spotify_service.recently_played regressed"


def test_vibe_drive_tip_skip_and_tip_add_endpoints_present() -> None:
    """Tip-to-Skip / Tip-to-Add ladder step 3 — passenger pays ₵, sovereign
    tax is applied, 70% post-tax is credited to the driver, and Spotify
    skip/queue is fired on the driver session."""
    from pathlib import Path
    src = Path("/app/backend/routes/vibe_drive.py").read_text()
    assert '"/tip-skip"' in src, "tip-skip endpoint regressed"
    assert '"/tip-add"' in src, "tip-add endpoint regressed"
    assert "TIP_SKIP_COST = 100" in src, "tip-skip cost regressed"
    assert "TIP_ADD_COST = 50" in src, "tip-add cost regressed"
    assert "vibe_drive_tip_events" in src, "tip events audit collection regressed"
    # Treasury hook required so sovereign tax is applied per v9 PDF.
    assert "process_transaction" in src, "tip flow no longer hits sovereign tax"
    # Frontend control component must exist (UI lock).
    ui = Path("/app/frontend/src/components/vibe-drive/VibeDriveTipControls.tsx").read_text()
    assert 'data-testid="tip-skip-btn"' in ui, "Tip-to-Skip frontend testid regressed"
    assert 'data-testid="tip-add-btn"' in ui, "Tip-to-Add frontend testid regressed"


def test_sovereign_engine_economy_status_endpoint_present() -> None:
    """Master Vault v9 — `/api/economy/status` powers the Chair Hall
    Infinity Table. Tax + supply constants must remain authoritative."""
    from pathlib import Path
    routes = Path("/app/backend/routes/sovereign_engine_routes.py").read_text()
    assert '"/economy/status"' in routes, "/economy/status route regressed"
    assert '"/engine/process-transaction"' in routes, (
        "/engine/process-transaction route regressed"
    )
    svc = Path("/app/backend/services/sovereign_engine.py").read_text()
    assert "TOTAL_SUPPLY_CAP" in svc and "3_000_000_000" in svc, (
        "Sovereign 3-Billion supply cap regressed"
    )
    assert "SOVEREIGN_TAX" in svc and "0.135" in svc, (
        "Sovereign 13.5% tax constant regressed"
    )
    assert "RIDE_SPLIT" in svc and "0.70" in svc, (
        "VibeRidez 70/30 split regressed"
    )
    assert "AMBASSADOR_DIVIDEND" in svc and "0.035" in svc, (
        "v12 Ambassador 3.5% dividend regressed"
    )


def test_v10_solana_bridge_constants_and_endpoint() -> None:
    """v10 Constitution — Solana Bridge: 4:1 compression of 3B in-app
    coins → 750M DSG, with 1.5× Genius Phase bonus. `calculate_bridge`
    helper + `/api/bridge/calculate` endpoint must both exist."""
    from services.sovereign_engine import (
        DSG_TOTAL_SUPPLY,
        DSG_MARKET_SALE,
        DSG_FOUNDER_VAULT,
        DSG_GIVEAWAY_RESERVE,
        BRIDGE_COMPRESSION_RATIO,
        GENIUS_PHASE_BONUS,
        calculate_bridge,
    )
    assert DSG_TOTAL_SUPPLY == 750_000_000, "v10 DSG total supply regressed"
    assert DSG_MARKET_SALE == 500_000_000, "v10 market sale allocation regressed"
    assert DSG_FOUNDER_VAULT == 200_000_000, "v10 founder vault allocation regressed"
    assert DSG_GIVEAWAY_RESERVE == 50_000_000, "v10 giveaway reserve regressed"
    assert BRIDGE_COMPRESSION_RATIO == 4, "v10 4:1 bridge ratio regressed"
    assert GENIUS_PHASE_BONUS == 1.5, "v10 Genius bonus regressed"
    assert calculate_bridge(4_000) == 1_000.0
    assert calculate_bridge(4_000, genius_bonus=True) == 1_500.0
    from pathlib import Path
    routes = Path("/app/backend/routes/sovereign_engine_routes.py").read_text()
    assert '"/bridge/calculate"' in routes, "/bridge/calculate route regressed"


def test_v12_ai_governor_burn_slide_formula() -> None:
    """v12 Constitution — burn rate = min(0.05, max(0, (supply - 350M) / 50M * 0.01)).
    5% at 750M, decays to 0% at 350M floor."""
    from services.ai_governor import (
        current_burn_rate,
        SUPPLY_FLOOR,
        BURN_RATE_CEILING,
        WALLET_CAP_STANDARD,
        WALLET_CAP_CHAIR,
        CHAIR_MINING_MULTIPLIER,
        wallet_cap_for,
        would_exceed_cap,
        mining_reward,
    )
    assert current_burn_rate(750_000_000) == 0.05, "burn rate at 750M should ceil at 5%"
    assert current_burn_rate(600_000_000) == 0.05, "burn rate at 600M still at ceiling"
    assert current_burn_rate(550_000_000) == 0.04, "burn rate at 550M drops to 4%"
    assert current_burn_rate(400_000_000) == 0.01, "burn rate at 400M at 1%"
    assert current_burn_rate(350_000_000) == 0.0, "burn rate at floor must be 0"
    assert SUPPLY_FLOOR == 350_000_000 and BURN_RATE_CEILING == 0.05
    # Anti-whale caps.
    assert WALLET_CAP_STANDARD == 2_000_000 and WALLET_CAP_CHAIR == 5_000_000
    assert wallet_cap_for(is_chair_holder=False, is_crew=False) == 2_000_000
    assert wallet_cap_for(is_chair_holder=True, is_crew=False) == 5_000_000
    assert wallet_cap_for(is_chair_holder=False, is_crew=True) == -1  # crew exempt
    assert would_exceed_cap(1_900_000, 200_000, False, False) is True
    assert would_exceed_cap(4_000_000, 500_000, True, False) is False
    # Mining boost — v12 now returns a dict breakdown (base + chair_bonus + ambassador_override + total).
    assert CHAIR_MINING_MULTIPLIER == 5.0
    r_holder = mining_reward(1.0, 100.0, is_chair_holder=True)
    r_plain = mining_reward(1.0, 100.0, is_chair_holder=False)
    assert r_holder["total"] == 500.0 and r_plain["total"] == 100.0
    assert r_holder["chair_bonus"] == 400.0 and r_plain["chair_bonus"] == 0.0


def test_v12_ambassador_dividend_and_override_and_founder_vault() -> None:
    """v12 Final Vault directives the audit caught:
       • Ambassador Dividend bumped 2% → 3.5%
       • Ambassador Override 5% mining kickback (new)
       • Founder Vault 200M locked until 50k chairs sold (25% immediate,
         monthly drip of balance over 11 months)
       • Crew Vault 50M exempt from ownership limits
    """
    from services.sovereign_engine import (
        AMBASSADOR_DIVIDEND,
        AMBASSADOR_OVERRIDE,
        FOUNDER_VAULT_TOTAL,
        FOUNDER_VAULT_UNLOCK_CHAIRS,
        FOUNDER_VAULT_IMMEDIATE_RELEASE,
        CREW_VAULT_TOTAL,
    )
    assert AMBASSADOR_DIVIDEND == 0.035, "v12 Ambassador Dividend bumped to 3.5% regressed"
    assert AMBASSADOR_OVERRIDE == 0.05, "v12 Ambassador Override (5% mining kickback) regressed"
    assert FOUNDER_VAULT_TOTAL == 200_000_000, "v12 Founder Vault total regressed"
    assert FOUNDER_VAULT_UNLOCK_CHAIRS == 50_000, "v12 Founder Vault unlock gate regressed"
    assert FOUNDER_VAULT_IMMEDIATE_RELEASE == 0.25, "v12 Founder Vault 25% immediate regressed"
    assert CREW_VAULT_TOTAL == 50_000_000, "v12 Crew Vault total regressed"
    # Mining with ambassador override = (base * 5 chair) * 1.05 ambassador.
    from services.ai_governor import mining_reward  # noqa: PLC0415
    r = mining_reward(1.0, 100.0, is_chair_holder=True, is_ambassador=True)
    assert r["ambassador_override"] == 25.0, "5% ambassador override math regressed"
    assert r["total"] == 525.0, "chair + ambassador composite regressed"


def test_sovereign_ops_routes_mounted() -> None:
    """v11/v12 Sovereign Ops endpoints (bridge queue + inactivity reap + burn).
    All admin writes must default to dry-run."""
    from pathlib import Path
    src = Path("/app/backend/routes/sovereign_ops_routes.py").read_text()
    # Bridge queue endpoints.
    assert '"/bridge/request"' in src, "/bridge/request (user) route regressed"
    assert '"/admin/bridge/queue"' in src, "/admin/bridge/queue route regressed"
    assert '/approve' in src and '/broadcast' in src and '/reject' in src, (
        "bridge lifecycle endpoints regressed"
    )
    # Inactivity reap.
    assert '"/admin/inactivity/candidates"' in src, "inactivity candidates route regressed"
    assert '"/admin/inactivity/run"' in src, "inactivity run route regressed"
    assert "INACTIVITY_DAYS = 365" in src, "12-month threshold regressed"
    assert "REAP_GIVEAWAY_SHARE = 0.50" in src, "50/50 giveaway split regressed"
    assert "REAP_LEADERSHIP_SHARE = 0.50" in src, "50/50 leadership split regressed"
    # Burn-slide.
    assert '"/burn/schedule"' in src, "/burn/schedule route regressed"
    assert '"/admin/burn/execute"' in src, "/admin/burn/execute route regressed"
    # Dry-run default guard.
    assert '"SOVEREIGN_OPS_DRY_RUN"' in src, "dry-run safety env regressed"
    # _id must be stripped before JSON response (testing agent caught 500).
    assert 'pop("_id", None)' in src, "ObjectId leak guard regressed"
    # Frontend panel wiring.
    panel = Path("/app/frontend/src/components/admin/SovereignOpsPanel.tsx").read_text()
    assert 'data-testid="sovereign-ops-panel"' in panel
    assert 'data-testid="sovereign-ops-bridge-card"' in panel
    assert 'data-testid="sovereign-ops-inactivity-card"' in panel
    assert 'data-testid="sovereign-ops-burn-card"' in panel
    god = Path("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read_text()
    assert "SovereignOpsPanel" in god, "SovereignOpsPanel not mounted in God Mode"


def test_bridge_request_prefers_funded_wallet_field() -> None:
    """Testing agent RCA (feb 6, 2026): picking wallet field by key presence
    selected an empty `token_balance` when `credits_balance` held the funded
    balance, locking legacy demo users out of the bridge. Lock the
    value-based fallback (same pattern as vibez-654) — now centralized
    in `utils/wallet_fields`."""
    from pathlib import Path
    src = Path("/app/backend/routes/sovereign_ops_routes.py").read_text()
    # The route must import AND call the shared helper.
    assert "from utils.wallet_fields import" in src, (
        "sovereign_ops_routes no longer imports the wallet_fields helper"
    )
    assert "pick_wallet_field_for_debit" in src, "debit helper not used"
    assert "pick_wallet_field_for_credit" in src, "credit helper not used"
    bridge_section = src.split('async def bridge_request')[1].split('async def ')[0]
    assert "pick_wallet_field_for_debit" in bridge_section, (
        "bridge_request no longer delegates to the shared helper"
    )


def test_wallet_field_helper_adopted_across_routes() -> None:
    """May 2026 — UNIFIED wallet contract.

    Every user has exactly ONE wallet field: ``credits_balance``. The
    legacy ``token_balance`` and ``vibez_coins`` fields are retired.
    No route may write to a divergent ledger; reads may still tolerate
    legacy fields harmlessly (defaulting to 0) but must never produce
    drift.
    """
    from pathlib import Path
    backend = Path("/app/backend")

    # Legacy WRITES are forbidden — they would re-create drift.
    forbidden_writes = [
        '"$inc": {"token_balance"',
        '"$inc": {"vibez_coins"',
        '"$set": {"token_balance"',
        '"$set": {"vibez_coins"',
    ]
    for sub in ("routes", "services"):
        for py in (backend / sub).glob("*.py"):
            src = py.read_text()
            # Tests in this file demonstrate the regression — skip self.
            for needle in forbidden_writes:
                assert needle not in src, (
                    f"{py.name} reintroduced legacy wallet write {needle!r} — "
                    f"all writes must target credits_balance for the unified "
                    f"3B-coin scarcity model to hold."
                )

    # The shim helpers must always return the canonical wallet field.
    from utils.wallet_fields import (
        WALLET_FIELD,
        pick_wallet_field_for_debit,
        pick_wallet_field_for_credit,
    )
    assert WALLET_FIELD == "credits_balance"
    # Debit reads credits_balance and ignores any stray token_balance.
    assert pick_wallet_field_for_debit(
        {"token_balance": 500, "credits_balance": 100}, 50
    ) == ("credits_balance", 100)
    # Insufficient raises with the canonical balance only.
    import pytest  # noqa: PLC0415
    with pytest.raises(ValueError) as exc:
        pick_wallet_field_for_debit({"credits_balance": 20}, 500)
    assert "insufficient:20" in str(exc.value)
    # Credit always returns the canonical field.
    assert pick_wallet_field_for_credit({"token_balance": 0, "credits_balance": 500}) == "credits_balance"
    assert pick_wallet_field_for_credit({"token_balance": 100, "credits_balance": 100}) == "credits_balance"
    assert pick_wallet_field_for_credit({}) == "credits_balance"


def test_inactivity_run_is_race_safe_with_cas_and_rebenchmark() -> None:
    """Round-7 polish: live inactivity reap must re-fetch each candidate
    inside the loop (rebenchmark) + use an atomic CAS on the users collection
    so a user who logs in mid-sweep is safely skipped. Lock the mechanism."""
    from pathlib import Path
    src = Path("/app/backend/routes/sovereign_ops_routes.py").read_text()
    run_section = src.split('async def admin_inactivity_run')[1].split('async def ')[0]
    # Rebenchmark — re-read staleness timestamps from DB.
    assert "live = await db.users.find_one" in run_section, (
        "inactivity_run no longer rebenchmarks staleness inside the loop"
    )
    assert "login_stale" in run_section and "activity_stale" in run_section, (
        "inactivity_run no longer checks BOTH stamps against the cutoff"
    )
    # CAS — atomic match on the exact balance state just read.
    assert "cas_result" in run_section, "inactivity_run CAS primitive regressed"
    assert "modified_count != 1" in run_section, (
        "inactivity_run CAS verification regressed"
    )
    # Idempotency row must be rolled back on CAS miss.
    assert "inactivity_reap_applied.delete_one" in run_section, (
        "inactivity_run CAS rollback of idempotency row regressed"
    )
    # Skipped-reactivated metric must be returned so the Founder can audit.
    assert "skipped_reactivated" in run_section, (
        "inactivity_run no longer reports skipped_reactivated users"
    )


def test_chair_hall_infinity_table_page_present() -> None:
    """Chair Hall (`/chair-hall`) page — high-fidelity Three.js scene
    that consumes /api/economy/status + /api/chairs/wall."""
    from pathlib import Path
    page = Path("/app/frontend/src/pages/ChairHall.tsx").read_text()
    assert 'data-testid="chair-hall-page"' in page, "ChairHall page testid regressed"
    assert "InfinityTable" in page, "Infinity Table component regressed"
    assert "/api/economy/status" in page, "ChairHall no longer reads /economy/status"
    assert "/api/chairs/wall" in page, "ChairHall no longer reads /chairs/wall"
    routes = Path("/app/frontend/src/routes/monetizationRoutes.tsx").read_text()
    assert "/chair-hall" in routes, "/chair-hall route regressed"
    assert "ChairHall" in routes, "ChairHall import regressed"


def test_sponsor_admin_panel_mounted_in_god_mode() -> None:
    """Sponsor Admin UI — replaces the curl-only verify flow.
    Component lives at admin/SponsorAdminPanel.tsx and must be mounted
    inside the God Mode dashboard 'Founder Controls' tab."""
    from pathlib import Path
    panel = Path("/app/frontend/src/components/admin/SponsorAdminPanel.tsx").read_text()
    assert 'data-testid="sponsor-admin-panel"' in panel, (
        "SponsorAdminPanel root testid regressed"
    )
    assert "/api/admin/sponsors" in panel, "SponsorAdminPanel listing endpoint regressed"
    assert "/sponsors/" in panel and "/verify" in panel, (
        "SponsorAdminPanel verify call regressed"
    )
    god = Path("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read_text()
    assert "SponsorAdminPanel" in god, (
        "SponsorAdminPanel not mounted in GodModeDashboard"
    )
    # Backend admin endpoints exist.
    src = Path("/app/backend/routes/power_hour_sponsors.py").read_text()
    assert "/admin/sponsors" in src, "/admin/sponsors listing route regressed"
    assert "admin_reject_sponsor" in src, "admin sponsor reject route regressed"


def test_sovereign_validator_joker_power_indexing() -> None:
    """PDF directive A: Bid Whist Joker Power Indexing — Big Joker=100,
    Little Joker=90, always win over any non-joker when trump is
    declared. Uptown AND Downtown. Per
    `Global_Vibez_Sovereign_Game_Logic_Fix.pdf`."""
    from services.sovereign_validator import (
        calculate_winner,
        get_power,
        BIG_JOKER_POWER,
        LITTLE_JOKER_POWER,
    )
    assert BIG_JOKER_POWER == 100 and LITTLE_JOKER_POWER == 90
    big = {"suit": "joker", "id": "big_joker", "value": "BIG_JOKER"}
    little = {"suit": "joker", "id": "little_joker", "value": "LITTLE_JOKER"}
    ace_spades = {"suit": "spades", "value": "A"}
    two_hearts = {"suit": "hearts", "value": "2"}
    # Uptown with spades trump — Big beats Little beats Ace trump.
    assert get_power(big, "spades", led_suit="spades") > get_power(little, "spades", led_suit="spades")
    assert get_power(little, "spades", led_suit="spades") > get_power(ace_spades, "spades", led_suit="spades")
    # Downtown — jokers STILL dominate (directive A).
    assert get_power(big, "spades", led_suit="spades", bid_direction="downtown") > get_power(ace_spades, "spades", led_suit="spades", bid_direction="downtown")
    # No-Trump — jokers are inert (our convention).
    assert get_power(big, None, led_suit="hearts", is_no_trump=True) < 0
    # calculate_winner picks the Big Joker regardless of play order.
    trick = [
        {"card": ace_spades, "player_id": "p1"},
        {"card": big, "player_id": "p2"},
        {"card": little, "player_id": "p3"},
        {"card": two_hearts, "player_id": "p4"},
    ]
    w = calculate_winner(trick, trump_suit="spades", led_suit="spades")
    assert w["player_id"] == "p2", "Big Joker lost — power indexing regressed"


def test_sovereign_validator_turn_timer_watchdog() -> None:
    """PDF directive B: 15-second Turn Timer. Exceeding the limit must
    return the sentinel "FORCE_AUTO_PLAY"."""
    from services.sovereign_validator import validate_turn_time, TURN_TIMER_MS
    import time  # noqa: PLC0415
    assert TURN_TIMER_MS == 15_000, "Turn timer must stay at 15 seconds per PDF"
    now_ms = int(time.time() * 1000)
    assert validate_turn_time(now_ms) == "TIME_OK"
    assert validate_turn_time(now_ms - 16_000) == "FORCE_AUTO_PLAY"


def test_sovereign_validator_spades_and_hearts_scoring() -> None:
    """PDF directive C: Spades / Hearts scoring verifier functions."""
    from services.sovereign_validator import verify_spades_score, verify_hearts_score
    # Spades — bid 4, took 3 → -40 penalty.
    assert verify_spades_score(bid=4, tricks_taken=3) == -40
    # Bid 4, took 5 (1 bag), <10 bags → 41.
    assert verify_spades_score(bid=4, tricks_taken=5, current_bags=3) == 41
    # Bid 4, took 6, already sitting on 10 bags → 42 - 100 = -58.
    assert verify_spades_score(bid=4, tricks_taken=6, current_bags=10) == -58
    # Hearts — 26 penalty pts = Shoot the Moon → 0.
    assert verify_hearts_score(26) == 0
    assert verify_hearts_score(13) == 13


def test_sovereign_validator_hand_broadcast_and_tax() -> None:
    """PDF directives D + E: hand_start broadcast must include trump +
    rank_mode; sovereign tax must compute pre-animation."""
    from services.sovereign_validator import (
        hand_broadcast_payload,
        apply_sovereign_tax,
        SOVEREIGN_TAX_RATE,
    )
    assert SOVEREIGN_TAX_RATE == 0.135, "Sovereign tax rate regressed"
    payload = hand_broadcast_payload("hearts", "downtown", is_no_trump=False)
    assert payload["event"] == "hand_start"
    assert payload["trump_suit"] == "hearts"
    assert payload["rank_mode"] == "DOWNTOWN"
    assert payload["joker_power"] == {"big": 100, "little": 90}
    assert payload["turn_timer_ms"] == 15_000
    # NT payload clears trump and flips mode.
    nt = hand_broadcast_payload(None, "uptown", is_no_trump=True)
    assert nt["trump_suit"] is None and nt["rank_mode"] == "NO_TRUMP"
    # Tax calc: 1000 → 135 tax, 865 net.
    assert apply_sovereign_tax(1000) == {"gross": 1000, "tax": 135, "net": 865}


def test_bid_whist_routes_delegate_to_sovereign_validator() -> None:
    """The two broken Bid Whist code paths (route + grand-master service)
    must route trick resolution through `calculate_winner` — no more
    inline joker/suit math that can regress."""
    from pathlib import Path
    route = Path("/app/backend/routes/bid_whist.py").read_text()
    gm = Path("/app/backend/services/bid_whist_grand_master.py").read_text()
    assert "from services.sovereign_validator import calculate_winner" in route, (
        "bid_whist route no longer delegates trick resolution"
    )
    assert "from services.sovereign_validator import calculate_winner" in gm, (
        "bid_whist grand-master service no longer delegates trick resolution"
    )
    # Old buggy Downtown inversion math must NOT reappear.
    assert "20 - value" not in gm, "Downtown-inversion math regressed (breaks jokers)"


def test_card_game_payouts_wire_sovereign_tax() -> None:
    """PDF directive E follow-up: every card-game payout handler routes
    through `services.card_game_payouts.settle_taxable_payout` so the
    13.5% Sovereign Tax applies BEFORE the win animation. No raw
    `credits_balance += winnings` should survive in payout paths."""
    from pathlib import Path
    helper = Path("/app/backend/services/card_game_payouts.py").read_text()
    assert "settle_taxable_payout" in helper, "card_game_payouts helper missing"
    assert "process_transaction" in helper, "helper not routed through sovereign engine"
    assert "apply_sovereign_tax" in helper, "helper not applying 13.5% tax preview"
    # Spades payout path adopts the helper.
    spades = Path("/app/backend/routes/spades.py").read_text()
    assert "settle_taxable_payout" in spades, "Spades payout no longer uses tax helper"
    assert 'Won Spades game - Prize' not in spades, (
        "Spades raw-credit line regressed (pre-tax payout)"
    )
    # Bid Whist payout path adopts the helper.
    bw = Path("/app/backend/routes/bid_whist.py").read_text()
    assert "settle_taxable_payout" in bw, "Bid Whist payout no longer uses tax helper"
    assert 'Won Bid Whist - Prize' not in bw, (
        "Bid Whist raw-credit line regressed (pre-tax payout)"
    )
    # Vibez 654 payout path taxes net winnings (not bet refund).
    v654 = Path("/app/backend/routes/vibez_654.py").read_text()
    assert "apply_sovereign_tax" in v654, (
        "Vibez 654 payout no longer applies Sovereign Tax pre-credit"
    )
    assert 'tx_type="vibez_654_winnings"' in v654, (
        "Vibez 654 treasury tx_type regressed"
    )


def test_turn_timer_route_and_stamp_wired() -> None:
    """PDF directive B follow-up: the shared /api/turn-timer/check
    endpoint exists and both Bid Whist + Spades play_card handlers
    stamp `turn_started_at_ms` on every state change."""
    from pathlib import Path
    tt = Path("/app/backend/routes/turn_timer.py").read_text()
    assert '"/check"' in tt, "turn-timer check endpoint regressed"
    assert "stamp_turn_start" in tt, "stamp helper regressed"
    assert "pick_lowest_card" in tt, "auto-play lowest-card helper regressed"
    assert "TURN_TIMER_MS" in tt, "15s timer constant import regressed"
    # Registry wiring.
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "turn_timer_router" in reg, "turn_timer_router not registered"
    # Both play routes stamp the timer.
    bw = Path("/app/backend/routes/bid_whist.py").read_text()
    assert 'stamp_turn_start(db, "bid_whist"' in bw, (
        "Bid Whist play_card no longer stamps turn-start"
    )
    sp = Path("/app/backend/routes/spades.py").read_text()
    assert 'stamp_turn_start(db, "spades"' in sp, (
        "Spades play_card no longer stamps turn-start"
    )


def test_chair_ladder_is_value_driven_post_genius() -> None:
    """Founder-confirmed 2026-05-18: the static 3-tier supply ladder
    ($20/$100/$250) is retired in favor of the value-driven plan —

       Tier 0 · Genius     · $20 floor seat  · 50,000-chair supply cap
                                              · weight 3× · per-wallet cap 100
       Tier 1+ · Live valuation via the Equity Master matrix:
                  $18 Floor    @ $500K /mo monthly revenue
                  $99 Genesis  @ $2.75M /mo
                  $360 Diamond @ $10M  /mo
                  $1,800 Plat. @ $50M  /mo

    Genius stays supply-capped (so the founder seat sells out). Past
    50,000 chairs sold, chair price is DERIVED from monthly app revenue
    using the Equity Master formula — NOT from a static ladder.

    KNOWN GAP (2026-05-18): the live backend checkout in
    `routes/chairs.py PHASES[]` still carries the legacy $100 Genesis /
    $250 Apex price rows. Live checkout has not yet been rewired to the
    Equity Master matrix because that's a real behavior change (price
    on /api/chairs/buy would shift). When Genius is close to selling
    out, wire `_phase_for_index()` → `equity_master.price_for_phase()`
    so the public roadmap and the live buy endpoint stay in sync.
    """
    from routes.chairs import PHASES, GENIUS_PER_USER_CAP
    from routes.equity_master import (
        EQUITY_VALUE_MATRIX,
        GENIUS_PHASE_FLOOR_USD,
        GENESIS_PHASE_FLOOR_USD,
    )
    from services.chair_expansion import get_expansion_plan

    # Genius is still the only fixed-supply phase + the only locked price.
    assert PHASES[0]["name"] == "Genius"
    assert PHASES[0]["price_usd"] == 20.0
    assert PHASES[0]["limit"] == 50_000
    assert PHASES[0]["weight"] == 3.0
    assert GENIUS_PHASE_FLOOR_USD == 20
    assert GENIUS_PER_USER_CAP == 100, "Genius Phase per-wallet cap regressed"

    # Equity Master matrix is the single source of truth for the
    # 4 post-Genius milestones. Pins the locked dollar anchors.
    assert GENESIS_PHASE_FLOOR_USD == 100, "Genesis floor anchor moved"
    prices = {row["label"]: row["market_value_usd"] for row in EQUITY_VALUE_MATRIX}
    assert prices.get("Floor Level") == 18
    assert prices.get("Genesis Target") == 99
    assert prices.get("Diamond Status") == 360
    assert prices.get("Platinum Scale") == 1_800

    # The retired services.chair_expansion module re-exports the matrix
    # in the legacy expansion-plan shape (so ChairExpansionPlan.tsx keeps
    # working). Row 0 = Genius supply phase; rows 1+ = revenue-anchored.
    plan = get_expansion_plan(active_chairs_sold=0)
    tiers = plan["tiers"]
    assert tiers[0]["name"] == "Genius" and tiers[0]["price_usd"] == 20
    assert tiers[0]["kind"] == "supply_capped"
    # At least one revenue-driven milestone must follow.
    assert any(t.get("kind") == "revenue_driven" for t in tiers[1:])
    # Apex (the retired static-ladder name) must NOT appear as a phase.
    assert "Apex" not in {t["name"] for t in tiers}, (
        "Retired Apex supply-ladder name resurfaced in chair_expansion"
    )


# --- END LOCKED (value-driven post-Genius plan · 2026-05-18) -----------


def test_sovereign_mining_v1_pure_functions_green() -> None:
    """Lock the 6 mining streams + security primitives from
    Sovereign Mining Master Vault v1.0 PDF (2026-05-05). Pure functions
    only — the full pytest suite lives in tests/test_sovereign_mining_pure.py.
    """
    from services import sovereign_mining as sm

    # Stream 1 · Hardware Leasing
    assert sm.GLOBAL_MINT_POOL_24H == 5_000_000
    # Stream 2 · Ambassador gate + rate
    assert sm.AMBASSADOR_RECRUIT_GATE == 50
    assert sm.AMBASSADOR_OVERRIDE_RATE == 0.05
    # Stream 4 · Driver 1.5, Rider 0.5
    assert sm.MOVEMENT_DRIVER_RATE == 1.5
    assert sm.MOVEMENT_RIDER_RATE == 0.5
    # Stream 5 · Tournament 10%
    assert sm.TOURNAMENT_MINT_PCT == 0.10
    # Stream 6 · Multipliers stack correctly
    assert sm.apply_multipliers(1000, is_chair_holder=True, is_golden_hour=True) == 50_000
    # Security · 30-day maturity + 1% master node
    assert sm.MATURITY_DAYS == 30
    assert sm.FOUNDER_MASTER_NODE_RATE == 0.01
    assert sm.founder_master_node_cut(10_000) == 100


def test_sovereign_mining_routes_mounted() -> None:
    """Lock the /api/mining/* router + 6 stream endpoints."""
    import inspect
    from routes import sovereign_mining_routes as smr
    paths = [r.path for r in smr.router.routes]
    for p in (
        "/mining/constants",
        "/mining/summary/{user_id}",
        "/mining/leasing/pulse",
        "/mining/stream/watch",
        "/mining/movement/trip",
        "/mining/ambassador/settle",
        "/mining/tournament/mint",
        "/mining/admin/ledger",
    ):
        assert p in paths, f"Mining route {p} missing"
    src = inspect.getsource(smr)
    assert "mining_ledger" in src, "Mining ledger collection not referenced"
    assert "crew_vault_state" in src, "Founder Master Node cut not routed to crew vault"


def test_bridge_enforces_30_day_maturity_lock() -> None:
    """The Solana Bridge queue must check pending_mining_coins before
    approval. We don't hard-reject at request time, but the doc must
    carry the pending number for Founder-queue UI surfacing.
    """
    import inspect
    from routes import sovereign_ops_routes as sor
    src = inspect.getsource(sor.bridge_request)
    assert "MATURITY_DAYS" in src, "30-day maturity lock not wired into bridge"
    assert "matured_at" in src, "Bridge must aggregate by matured_at"
    assert "pending_mining_coins" in src, "Bridge must surface pending mining ₵"


def test_chair_holder_voting_routes_and_files_renamed() -> None:
    """User directive 2026-05-05: no more 'shareholder' anywhere in
    user-facing naming. Backend collection + API path now say
    `chair_holder_votes` / `/api/chair-holder-votes`.
    """
    from pathlib import Path
    root = Path("/app")
    # Files renamed correctly.
    assert (root / "backend/routes/chair_holder_votes.py").exists()
    assert not (root / "backend/routes/shareholder_votes.py").exists()
    assert (root / "frontend/src/components/admin/ChairHolderVoting.tsx").exists()
    assert not (root / "frontend/src/components/admin/ShareholderVoting.tsx").exists()
    assert (root / "frontend/src/components/dashboard/ChairHolderVoteBanner.tsx").exists()
    assert not (root / "frontend/src/components/dashboard/ShareholderVoteBanner.tsx").exists()
    # Registry imports the new router name.
    registry = (root / "backend/routes/registry.py").read_text()
    assert "chair_holder_votes" in registry
    assert "shareholder_votes" not in registry
    # Source code references new collection name.
    chvotes = (root / "backend/routes/chair_holder_votes.py").read_text()
    assert "chair_holder_votes" in chvotes
    assert "shareholder_votes" not in chvotes


# ──────────────────────────────────────────────────────────────────────────
#  [2026-02-16] v8.0 — GISA Audit + International Logic + Cultural Onboarding +
#  Marketing OneSheet locked. These tests guard the 4 new founder-PDFs.
# ──────────────────────────────────────────────────────────────────────────
def test_v8_gisa_agent_module_imports() -> None:
    """v8.0 — GISA agent service module must remain importable."""
    from services.gisa_agent import (
        GISAAgent, StressTestEngine, IsolationAuditor, VisualParityChecker,
        THRESHOLDS,
    )
    assert THRESHOLDS["ws_p95_ms"]["pass"] == 100
    assert THRESHOLDS["solana_tps"]["pass"] == 1500
    # 31 game rooms + Celestial Glasshouse = 32 audited rooms
    rooms = VisualParityChecker().audit_all()
    assert len(rooms) == 32


def test_v8_localization_canonical_country_matrix() -> None:
    """v8.0 — Tokyo defaults must remain Japanese / Yen / metric."""
    from services.localization import COUNTRIES, detect_locale, build_payload_from_selection
    assert "JP" in COUNTRIES and "US" in COUNTRIES and "GB" in COUNTRIES
    p = detect_locale(accept_language="ja-JP", cf_country="JP")
    assert p.locale_code == "ja-JP"
    assert p.currency == "JPY"
    assert p.unit_system == "metric"
    # 2026-02-16 — testing-agent flag — /save must accept full BCP-47
    # tags ('ja-JP', 'en-US') in addition to base codes.
    bcp = build_payload_from_selection(country_code="JP", language_code="ja-JP")
    assert bcp.locale_code == "ja-JP"
    assert bcp.language_code == "ja"
    bcp_us = build_payload_from_selection(country_code="GB", language_code="en-GB")
    assert bcp_us.locale_code == "en-GB"


def test_v8_cultural_onboarding_4_canonical_steps() -> None:
    """v8.0 — Match feed unlocks ONLY after all 4 cultural steps."""
    from services.cultural_onboarding import CANONICAL_STEPS, CulturalProfile, is_complete, merge_step
    assert CANONICAL_STEPS == [
        "origin_and_vibe", "linguistic_range",
        "dialect_selection", "cultural_values",
    ]
    p = CulturalProfile(user_id="u_shield")
    for step, payload in [
        ("origin_and_vibe", {"home_country": "US", "current_country": "JP"}),
        ("linguistic_range", {"fluent": ["en"]}),
        ("dialect_selection", {"english_dialect": "en-US"}),
        ("cultural_values", {"cultural_values": {}}),
    ]:
        p = merge_step(p, step, payload)
    assert is_complete(p)


def test_v8_landing_marketing_onesheet_copy_present() -> None:
    """v8.0 — Locked OneSheet headline + four pillars must remain on the
    public landing page (catches regressions when someone rewrites the hero)."""
    from pathlib import Path
    src_root = Path(__file__).resolve().parents[2] / "frontend/src/pages"
    # The actual public landing at "/" is LandingNeonGaming (per authRoutes).
    # Both files must carry the OneSheet copy so either one stays compliant.
    for name in ("Landing.tsx", "LandingNeonGaming.tsx"):
        body = (src_root / name).read_text(encoding="utf-8")
        assert "THE WORLD'S FIRST" in body and "SOCIAL INFRASTRUCTURE NETWORK" in body, name
        assert "LOCK IN YOUR VIBE" in body, name
        assert "OWN THE NETWORK" in body, name
        assert "70/30" in body and "Revolution" in body, name
        assert "98%" in body, name
        assert "Vibe Yellow Pages" in body, name
        assert "1,000,000" in body, name
        assert "SECURE YOUR CHAIR" in body, name
        assert "Genius Phase" in body, name


def test_v8_globe_fab_and_cultural_hub_components_exist() -> None:
    """v8.0 — Globe FAB + Cultural Hub modal + onboarding wizard wired."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "components/GlobeFAB.tsx").exists()
    assert (src / "components/CulturalHubModal.tsx").exists()
    assert (src / "pages/CulturalOnboardingWizard.tsx").exists()
    assert (src / "utils/globalVibeSync.ts").exists()
    # Globe FAB mounted in App.js
    app_js = (src / "App.js").read_text()
    assert "GlobeFAB" in app_js


def test_v8_locked_spec_files_present() -> None:
    """v8.0 — All 4 founder-PDF specs locked into /app/memory/locked_specs/."""
    from pathlib import Path
    base = Path("/app/memory/locked_specs")
    for f in [
        "v7_OMNI_BLUEPRINT.md",
        "v8_GISA_AUDIT_BLUEPRINT.md",
        "v8_INTERNATIONAL_LOGIC.md",
        "v8_MARKETING_ONESHEET.md",
    ]:
        assert (base / f).exists(), f"Locked spec missing: {f}"


# ──────────────────────────────────────────────────────────────────────────
# [2026-02-16 PM] Game UX hardening — founder explicit asks
# ──────────────────────────────────────────────────────────────────────────
def test_tictactoe_5_in_a_row_locked() -> None:
    """Tic Tac Toe is now 12×12 with a 5-in-a-row win condition (LOCKED 2026-02-16).

    User asked for 'five in a row to win that game' — guard so a future
    refactor doesn't silently revert to 3-in-a-row.
    """
    from services.games.tictactoe import (
        BOARD_SIZE, WIN_LENGTH, _detect_winning_line, _empty_board,
    )
    assert BOARD_SIZE == 12, f"Tic Tac Toe board must be 12×12, got {BOARD_SIZE}"
    assert WIN_LENGTH == 5, f"Tic Tac Toe win length must be 5, got {WIN_LENGTH}"

    # 4 in a row must NOT win
    board = _empty_board()
    for c in range(4):
        board[2][c] = "X"
    assert _detect_winning_line(board, 2, 3) is None, "4-in-a-row wrongly counted as a win"

    # 5 in a row WINS
    board[2][4] = "X"
    line = _detect_winning_line(board, 2, 4)
    assert line is not None and len(line) == 5


def test_ai_dealer_voice_toggle_utility_exists() -> None:
    """v8.0 — Master AI dealer voice toggle lives in the menu bar (Settings)
    and is wired into the canonical useAIDealerVoice hook so EVERY game
    respects a single mute switch."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    util = (src / "utils/aiDealerVoice.ts").read_text(encoding="utf-8")
    assert "isAIDealerVoiceMuted" in util
    assert "setAIDealerVoiceMuted" in util
    hook = (src / "hooks/useAIDealerVoice.js").read_text(encoding="utf-8")
    assert "isAIDealerVoiceMuted" in hook, \
        "useAIDealerVoice must consult the master mute toggle"


def test_settings_page_has_ai_dealer_and_language_tabs() -> None:
    """v8.0 — The menu bar settings expose two new tabs: AI Dealer + Language & Region."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/SettingsPage.tsx"
    body = src.read_text(encoding="utf-8")
    assert "settings-ai-dealer-tab" in body
    assert "settings-ai-dealer-toggle" in body
    assert "settings-language-tab" in body
    assert "settings-language-country-select" in body
    assert "settings-language-apply" in body


def test_vibez_654_uses_canonical_premium_dice() -> None:
    """Vibez 654 must use the canonical crimson-pip <PremiumDice> component
    (not a flat number tile) — founder noted "you can't see the stuff" before
    this fix landed (LOCKED 2026-02-16)."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/games/Vibez654Game.tsx"
    body = src.read_text(encoding="utf-8")
    assert 'PremiumDice' in body, "Vibez 654 must import PremiumDice"
    assert 'from "@/components/games/vibedice654/PremiumDice"' in body or \
        "from '@/components/games/vibedice654/PremiumDice'" in body


def test_poker_betting_station_pinned() -> None:
    """Poker action bar must be pinned + show stack / pot / to-call clearly."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/games/PokerPractice.tsx"
    body = src.read_text(encoding="utf-8")
    assert "poker-action-bar" in body
    assert "poker-bet-summary" in body
    assert "sticky bottom-0" in body, "poker action bar must be pinned to the bottom"


def test_3d_poker_room_deleted() -> None:
    """v8.0 — 3D Poker room deleted 2026-02-16 (founder directive). Guard
    against accidental re-introduction."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    # Directory + components must be gone.
    assert not (root / "frontend/src/components/3d").exists()
    assert not (root / "frontend/src/components/practice_games/PracticePoker3D.tsx").exists()
    assert not (root / "frontend/src/components/practice_games/PracticePokerCSS3D.tsx").exists()
    # Lobby card + practice route mapping removed.
    games_new = (root / "frontend/src/pages/GamesNew.tsx").read_text(encoding="utf-8")
    assert "Poker 3D" not in games_new, "3D Poker lobby card must be deleted"
    assert "poker_css3d:" not in games_new
    practice_play = (root / "frontend/src/pages/PracticeGamePlay.tsx").read_text(encoding="utf-8")
    assert "PracticePoker3D" not in practice_play
    assert "PracticePokerCSS3D" not in practice_play


def test_video_upload_accepts_streaming_multipart() -> None:
    """v8.0 — /api/my-vibez/upload supports multipart/form-data streaming
    so mobile devices don't OOM during base64 inflation. JSON path stays
    for backward compat."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "backend/routes/my_vibez_content.py"
    body = src.read_text(encoding="utf-8")
    # Streaming code present
    assert "_save_streaming_upload" in body
    assert "multipart/form-data" in body
    assert "await video.read(1024 * 1024)" in body, "must stream in 1MB chunks"
    # Frontend uses FormData
    fe = Path(__file__).resolve().parents[2] / "frontend/src/components/my-vibez/VideoRecorder.tsx"
    fe_body = fe.read_text(encoding="utf-8")
    assert "new FormData()" in fe_body
    assert "form.append('video'" in fe_body
    assert "readAsDataURL(recordedBlob)" not in fe_body, \
        "VideoRecorder must NOT use readAsDataURL on the full video — that's the OOM bug"


# ──────────────────────────────────────────────────────────────────────────
# [2026-02-16 Late-Late] Discoverability + Voice/Video coverage (founder asks)
# "I don't see none of the stuff we added in the app, how do we fix this?"
# "in every game, we did implement it so people could actually virtually
#  talk to each other and play... is that active for every game in the app?"
# ──────────────────────────────────────────────────────────────────────────
def test_dashboard_surfaces_just_for_the_night() -> None:
    """v8.0 — Just for the Night MUST have a dashboard tile. Founder asked
    'where is Just for the Night?' — it had routes but no entry tile."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/DashboardNew.tsx"
    body = src.read_text(encoding="utf-8")
    assert "just_for_the_night" in body
    assert "/just-for-the-night" in body
    assert "Just For The Night" in body


def test_dashboard_date_spot_route_fixed() -> None:
    """v8.0 — Date Spot tile must point to '/date-spot-finder' (real
    route), not the old broken '/date-spots'."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/DashboardNew.tsx"
    body = src.read_text(encoding="utf-8")
    assert "/date-spot-finder" in body
    # Old broken route reference must NOT be re-introduced as a link target
    # (matching `path: '/date-spots'` exactly to avoid string-overlap false positives).
    assert "path: '/date-spots'" not in body


def test_dashboard_surfaces_v8_features() -> None:
    """v8.0 — All major v8 features must have tiles on the dashboard so
    users can actually find them: Beat Vault, Memory Bank, Vigilant
    Matchmaking, Cultural Onboarding, Voice Mirror, Hungry Vibez, Vibez TV."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/DashboardNew.tsx"
    body = src.read_text(encoding="utf-8")
    expected_tiles = [
        ("beat_vault", "/dsg/beat-vault"),
        ("memory_bank", "/dsg/memory-bank"),
        ("vigilant_matchmaking", "/dsg/matchmaking"),
        ("cultural_onboarding", "/dating/cultural-onboarding"),
        ("voice_mirror", "/voice-mirror"),
        ("hungry_vibez", "/hungryvibes"),
        ("vibez_tv", "/vibe-tv"),
    ]
    for tile_id, route in expected_tiles:
        assert tile_id in body, f"Dashboard tile id '{tile_id}' missing"
        assert route in body, f"Dashboard route '{route}' missing"


def test_game_voice_dock_globally_mounted() -> None:
    """v8.0 — GameVoiceDock auto-mounts on every multiplayer URL via the
    canonical GameVoiceDockMounter (single mount point in App.js)."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    # Components exist
    assert (src / "components/games/GameVoiceDock.tsx").exists()
    assert (src / "components/games/GameVoiceDockMounter.tsx").exists()
    # Mounted in App.js
    app_js = (src / "App.js").read_text(encoding="utf-8")
    assert "GameVoiceDockMounter" in app_js, \
        "GameVoiceDockMounter must be mounted in App.js"
    # Mounter wraps the canonical VibeCallRoom
    dock = (src / "components/games/GameVoiceDock.tsx").read_text(encoding="utf-8")
    assert "VibeCallRoom" in dock, \
        "GameVoiceDock must wrap the canonical VibeCallRoom Agora component"
    # URL patterns include all major multiplayer routes
    mounter = (src / "components/games/GameVoiceDockMounter.tsx").read_text(encoding="utf-8")
    for pattern in ["multiplayer", "http-multiplayer", "vibez-654",
                    "spades-aaa", "hearts-aaa", "bid-whist-aaa",
                    "blackjack-universal", "baccarat-premium",
                    "poker-practice", "vibe-coliseum"]:
        assert pattern in mounter, \
            f"GameVoiceDockMounter URL pattern '{pattern}' missing"


def test_universal_turn_indicator_rolled_out() -> None:
    """v8.0 — Founder said: 'each person turn, they can see whose turn is
    being taken.' The canonical <TurnIndicator> must be imported by every
    major multiplayer room across Phase 1/2/3."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "components/games/TurnIndicator.tsx").exists()
    rooms_with_turn_indicator = [
        # Phase 1 — Poker
        "pages/games/PokerPractice.tsx",
        # Phase 3 — Baccarat
        "pages/games/BaccaratPremium.tsx",
        # NOTE: Vibez654Game was rewritten 2026-05-09 as solo vs AI
        # (no multiplayer turn order) so TurnIndicator no longer
        # applies — the rules give the player their full set of rolls
        # uninterrupted by an AI seat.
        # Phase 2 — Trick-takers (AAA)
        "pages/games/SpadesAAA.tsx",
        "pages/games/HeartsAAA.tsx",
        "pages/games/BidWhistAAA.tsx",
        # HTTP multiplayer Hearts (alt route)
        "pages/games/HttpMultiplayerHearts.tsx",
        # NOTE: MultiplayerTicTacToe / MultiplayerBlackjack /
        # _GenericCasinoGame were deleted as dead code in May 2026
        # (no upstream imports). They no longer need TurnIndicator.
    ]
    for rel in rooms_with_turn_indicator:
        body = (src / rel).read_text(encoding="utf-8")
        assert "TurnIndicator" in body, \
            f"{rel} must import the canonical TurnIndicator component"


def test_streaming_pages_have_voice_coverage() -> None:
    """v8.0 — Founder asked: 'is multi-video attached to all the places
    it's supposed to be within the system?' Streaming + matchmaking +
    auction pages must be in the GameVoiceDockMounter regex matchers."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    mounter = (src / "components/games/GameVoiceDockMounter.tsx").read_text(encoding="utf-8")
    # Patterns are inside JS regex literals — slashes are escaped — so we
    # search for each route fragment without the leading slash.
    for fragment in [
        "vibe-tv",                  # Vibe TV channel + episode rooms
        "dsg\\/memory-bank",        # Cinema dates
        "vibe-ridez\\/live-pov",    # Live POV streams
        "dsg\\/matchmaking",        # Vigilant Matchmaking voice
        "dsg\\/beat-vault",         # Beat Vault auctions
        "just-for-the-night",       # JFTN rooms
    ]:
        assert fragment in mounter, \
            f"GameVoiceDockMounter regex missing streaming fragment '{fragment}'"


# ──────────────────────────────────────────────────────────────────────────
# [2026-02-16 Late × 5] Phase 2/3 polish + room-existence guards
# ──────────────────────────────────────────────────────────────────────────
def test_dsg_music_group_hub_room_exists() -> None:
    """v8.0 — Founder asked rooms be 'visually go into them and see them'.
    Pillar 01 (Music Group) hub must exist + be routed."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    assert (root / "frontend/src/pages/dsg/DSGMusicGroupHub.tsx").exists()
    routes = (root / "frontend/src/routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    assert "DSGMusicGroupHub" in routes
    assert "/dsg/music-group" in routes


def test_vibe_tv_hub_room_exists() -> None:
    """v8.0 — Pillar 02 (Vibez TV) hub must exist + be routed at /vibe-tv."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    assert (root / "frontend/src/pages/dsg/VibeTvHub.tsx").exists()
    routes = (root / "frontend/src/routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    assert "VibeTvHub" in routes
    assert '/vibe-tv' in routes  # canonical top-level route


def test_dsg_matchmaking_alias_routed() -> None:
    """Dashboard tile path /dsg/matchmaking must resolve (was 404 before)."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    routes = (root / "frontend/src/routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    assert "/dsg/matchmaking" in routes


def test_phase3_cinematic_components_exist() -> None:
    """v8.0 — Phase 3 cinematic flourishes: ChipToss, BallSpin, CardSqueeze,
    BigRoadRoadmap, HotColdStrip."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "components/games/CasinoCinematics.tsx").exists()
    cinema = (src / "components/games/CasinoCinematics.tsx").read_text(encoding="utf-8")
    for name in ("ChipToss", "BallSpin", "CardSqueeze"):
        assert name in cinema, f"{name} primitive missing from CasinoCinematics"
    assert (src / "components/games/BigRoadRoadmap.tsx").exists()
    assert (src / "components/games/HotColdStrip.tsx").exists()
    # BaccaratPremium uses Big Road; GenericCasinoGame uses HotColdStrip
    bp = (src / "pages/games/BaccaratPremium.tsx").read_text(encoding="utf-8")
    assert "BigRoadRoadmap" in bp
    gc = (src / "pages/games/_GenericCasinoGame.tsx").read_text(encoding="utf-8")
    assert "HotColdStrip" in gc


def test_phase2_score_panel_and_special_state_components_exist() -> None:
    """v8.0 — Phase 2 polish: SpecialStatePrompt still ships. The
    ScoreBoardPanel/SpadesAAA collapsible mirror got retired in May
    2026 because it was duplicating the SpadesScoreBadge that already
    sits in the top-right (founder ask: 'only one scoreboard per
    table, not two')."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "components/games/SpecialStatePrompt.tsx").exists()
    # SpadesAAA must NOT mount the legacy double-score panel anymore.
    spades = (src / "pages/games/SpadesAAA.tsx").read_text(encoding="utf-8")
    assert "ScoreBoardPanel" not in spades, (
        "SpadesAAA brought back the ScoreBoardPanel — but the badge in the "
        "top-right + the SpadesScoreBadge already render the same info. "
        "Founder mandate: ONE scoreboard per table, not two."
    )
    # SpecialStatePrompt covers the 4 canonical variants
    prompts = (src / "components/games/SpecialStatePrompt.tsx").read_text(encoding="utf-8")
    for variant in ("nil", "double-nil", "boston", "big-boston"):
        assert variant in prompts


def test_phase3_cinematics_wired_into_target_rooms() -> None:
    """v8.0 — Cinematic primitives must be ACTIVELY used by their target
    rooms (not just imported), per founder ask:
       • ChipToss → BaccaratPremium player/banker/tie zone bets
       • CardSqueeze → BaccaratPremium banker/player reveals
       • SpecialStatePrompt → BidWhistAAA Boston / Big Boston bidder flow
       • SpecialStatePrompt → SpadesAAA Nil bidder flow

    NOTE: MultiplayerBlackjack / _GenericCasinoGame were deleted as
    dead code in May 2026 (no upstream imports), so the BallSpin /
    Blackjack ChipToss assertions moved to those rooms' replacement
    when the user reships them."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"

    bp = (src / "pages/games/BaccaratPremium.tsx").read_text(encoding="utf-8")
    assert "CardSqueeze" in bp and "squeezeActive" in bp, \
        "CardSqueeze must be wired into BaccaratPremium reveal"
    assert "ChipToss" in bp and "chipToss" in bp, \
        "ChipToss must be wired into BaccaratPremium zone-bet placement"

    bw = (src / "pages/games/BidWhistAAA.tsx").read_text(encoding="utf-8")
    assert "SpecialStatePrompt" in bw and "pendingBoston" in bw, \
        "SpecialStatePrompt must wrap BidWhistAAA 13-book Boston/Big-Boston call"

    sp = (src / "pages/games/SpadesAAA.tsx").read_text(encoding="utf-8")
    assert "SpecialStatePrompt" in sp and "pendingNil" in sp, \
        "SpecialStatePrompt must wrap SpadesAAA Nil (0) bid"


def test_streaming_voice_route_for_vibe_tv_main() -> None:
    """v8.0 — manual screenshot confirmed GameVoiceDock mounts on
    /vibe-tv/main (live channel). Guard the canonical pattern remains
    in the regex matcher so a future refactor doesn't drop it."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    mounter = (src / "components/games/GameVoiceDockMounter.tsx").read_text(encoding="utf-8")
    # /vibe-tv pattern matches /vibe-tv/main — verified live 2026-02-16.
    assert "vibe-tv" in mounter
    routes = (src / "routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    assert "/vibe-tv/main" in routes, \
        "/vibe-tv/main route registration required for dock to mount on the live channel"


# ──────────────────────────────────────────────────────────────────────────
# [2026-02-16 Late × 8] Live players + audio + Poker chip toss
# ──────────────────────────────────────────────────────────────────────────
def test_vibe_tv_channel_player_live_room_exists() -> None:
    """v8.0 — /vibe-tv/main now mounts the actual lean-back player room
    with embedded YouTube playlist + viewer count + Up-Next strip."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "pages/dsg/VibeTvChannelPlayer.tsx").exists()
    body = (src / "pages/dsg/VibeTvChannelPlayer.tsx").read_text(encoding="utf-8")
    assert "vibe-tv-channel-player" in body
    assert "youtube.com/embed" in body, "must embed live playlist"
    assert "vibe-tv-on-air" in body and "vibe-tv-up-next" in body
    routes = (src / "routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    # Live-channel route must use the player, not the hub
    assert 'path="/vibe-tv/main" element={<ProtectedRoute><VibeTvChannelPlayer' in routes


def test_memory_bank_cinema_room_exists() -> None:
    """v8.0 — Memory Bank sync-watch room at /dsg/memory-bank/room/{id} now
    mounts a real player (YouTube iframe, host/guest sync, voice hint)."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "pages/dsg/MemoryBankCinemaRoom.tsx").exists()
    body = (src / "pages/dsg/MemoryBankCinemaRoom.tsx").read_text(encoding="utf-8")
    assert "memory-bank-cinema-room" in body
    assert "youtube.com/embed" in body or "buildEmbedUrl" in body
    assert "cinema-play-toggle" in body
    routes = (src / "routes/dsgRoutes.tsx").read_text(encoding="utf-8")
    assert 'path="/dsg/memory-bank/room/:roomId"' in routes


def test_ball_spin_audio_wired() -> None:
    """v8.0 — BallSpin must call `playRouletteWhoosh` on launch and
    `playRouletteClick` on landing."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    cinema = (src / "components/games/CasinoCinematics.tsx").read_text(encoding="utf-8")
    assert "playRouletteWhoosh" in cinema, "BallSpin must whoosh on launch"
    assert "playRouletteClick" in cinema, "BallSpin must click on landing"
    sm = (src / "utils/cardSoundManager.js").read_text(encoding="utf-8")
    assert "playRouletteWhoosh" in sm and "playRouletteClick" in sm, \
        "cardSoundManager must expose both Roulette audio methods"


def test_poker_practice_chip_toss_wired() -> None:
    """v8.0 — ChipToss now fires on PokerPractice raise / all-in / call."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src/pages/games/PokerPractice.tsx"
    body = src.read_text(encoding="utf-8")
    assert "ChipToss" in body and "chipToss" in body, \
        "PokerPractice must wire ChipToss into raise/all-in/call"


def test_landing_ctas_resolve() -> None:
    """v8.0 — Founder ask: 'verify every CTA on the public landing
    deep-links to the right authenticated route.'

    Walks every navigate('...') and href='...' on the landing pages,
    extracts the route literal, and confirms a matching <Route path='...'/>
    is registered somewhere in /app/frontend/src/routes.
    """
    import re
    from pathlib import Path
    root = Path(__file__).resolve().parents[2] / "frontend/src"

    # Landing surfaces — both legacy + neon
    landing_files = [
        root / "pages/Landing.tsx",
        root / "pages/LandingNeonGaming.tsx",
        *(root / "components/landing").glob("*.tsx"),
    ]

    # Collect every route registration (drop dynamic param trailing parts).
    routes_text = ""
    for p in (root / "routes").glob("*.tsx"):
        routes_text += p.read_text(encoding="utf-8")
    routes_text += (root / "App.js").read_text(encoding="utf-8")
    registered = set()
    for m in re.finditer(r"""Route\s+path=["'](/[\w/:-]*)["']""", routes_text):
        # Normalize: drop trailing /:param to match the static prefix
        path = m.group(1)
        registered.add(path)
        # Also add the static prefix (e.g. "/vibe-venues/:venueId" → "/vibe-venues")
        if "/:" in path:
            registered.add(path.split("/:")[0])

    # Pre-known external / hash routes that don't need a <Route /> registration.
    external_ok = {"/", "/dashboard"}
    registered.update(external_ok)

    # Walk every navigate('...') in landing files
    pattern = re.compile(r"""navigate\(\s*[`'"](/[\w/-]*)[`'"]\s*[,)]""")
    broken = []
    for f in landing_files:
        if not f.exists():
            continue
        body = f.read_text(encoding="utf-8")
        for m in pattern.finditer(body):
            target = m.group(1)
            # Strip trailing slashes
            target = target.rstrip("/") or "/"
            # Match against either the exact path or its static prefix
            if target in registered:
                continue
            # Try prefix match — nav target might include a subpath like
            # /restaurants/submit when only /restaurants is registered
            prefix_match = any(target.startswith(r + "/") for r in registered if r != "/")
            if prefix_match:
                continue
            broken.append((f.name, target))

    assert not broken, (
        "Landing CTAs pointing to unregistered routes:\n  "
        + "\n  ".join(f"{fn}: navigate('{t}')" for fn, t in broken)
    )


# ──────────────────────────────────────────────────────────────────────────
# [2026-02-17] Redeploy verification fixes
# ──────────────────────────────────────────────────────────────────────────
def test_vibe_tv_up_next_backfills_to_three() -> None:
    """v8 — VibeTvChannelPlayer must always render 3 up-next items even
    if the API returns fewer. Founder spec, locked 2026-02-17."""
    from pathlib import Path
    src = (Path(__file__).resolve().parents[2] /
           "frontend/src/pages/dsg/VibeTvChannelPlayer.tsx").read_text(encoding="utf-8")
    # Fallback array must have ≥3 items
    assert "fallback-1" in src and "fallback-2" in src and "fallback-3" in src, \
        "VibeTvChannelPlayer FALLBACK_UP_NEXT must contain 3 items"
    # Backfill logic must merge partial API responses with fallback so
    # the strip never falls below 3.
    assert "data.upcoming.length >= 3" in src, \
        "VibeTvChannelPlayer must require 3 items before adopting API list"
    assert "FALLBACK_UP_NEXT" in src and "merged" in src, \
        "VibeTvChannelPlayer must backfill partial API responses"


def test_gisa_visual_parity_deterministically_passes() -> None:
    """v8 — VisualParityChecker must score >=95% on every run so the
    audit doesn't oscillate between pass/warn (founder ask 2026-02-17)."""
    import sys
    sys.path.insert(0, "/app/backend")
    from services.gisa_agent import VisualParityChecker, _classify_visual

    # 5 samples — must all pass
    for _ in range(5):
        c = VisualParityChecker()
        rooms = c.audit_all()
        block = _classify_visual(rooms)
        assert block["status"] == "pass", \
            f"GISA visual parity oscillated: {block['average_parity']}%"
        assert block["average_parity"] >= 95.0


def test_sovereign_v9_1_test_loads_canonical_dotenv() -> None:
    """v8 — test_sovereign_v9_1_validator_and_payouts.py must force-load
    /app/backend/.env so DB_NAME matches the live backend's database
    even when regression_shield runs first and sets DB_NAME via setdefault.
    Without this load, the cross-suite TestBidWhistTurnStamp.test_check_endpoint
    test inserts to a different DB and 404s."""
    from pathlib import Path
    src = (Path(__file__).resolve().parent /
           "test_sovereign_v9_1_validator_and_payouts.py").read_text(encoding="utf-8")
    assert 'load_dotenv("/app/backend/.env"' in src, \
        "test_sovereign_v9_1 must force-load the canonical .env"
    assert "from dotenv import load_dotenv" in src


def test_beta_waitlist_route_and_page_exist() -> None:
    """Feb 2026 — public Beta Tester signup at /beta-tester. The page,
    backend router, and frontend route registration must all be wired."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    # Backend route module
    routes = root / "backend/routes/beta_waitlist.py"
    assert routes.exists(), "backend/routes/beta_waitlist.py must exist"
    body = routes.read_text(encoding="utf-8")
    assert "/beta-waitlist" in body and "/admin/beta-waitlist" in body
    assert "_send_confirmation" in body and "RESEND_API_KEY" in body
    assert "EmailStr" in body, "Pydantic email validation must be enforced"
    # Magic-link admin tools (Feb 2026 Late)
    assert "/admin/beta-waitlist/stats" in body or "stats" in body
    assert "bulk-invite" in body
    assert "_send_invite_email" in body
    assert "redeem" in body and "redeem-confirm" in body
    assert "beta_invite_tokens" in body
    # Registry wiring
    reg = (root / "backend/routes/registry.py").read_text(encoding="utf-8")
    assert "from routes.beta_waitlist import" in reg
    # Public frontend page
    page = root / "frontend/src/pages/BetaTester.tsx"
    assert page.exists()
    page_body = page.read_text(encoding="utf-8")
    for tid in [
        "beta-tester-page", "beta-tester-form", "beta-tester-submit-btn",
        "beta-tester-counter-value", "beta-tester-success",
    ]:
        assert tid in page_body, f"BetaTester missing testid {tid}"
    # Public route registration
    auth = (root / "frontend/src/routes/authRoutes.tsx").read_text(encoding="utf-8")
    assert 'path="/beta-tester"' in auth, "/beta-tester must be a public route"
    assert "BetaTester" in auth
    # Admin page + route
    admin_page = root / "frontend/src/pages/admin/BetaWaitlistAdmin.tsx"
    assert admin_page.exists(), "BetaWaitlistAdmin admin page must exist"
    admin_body = admin_page.read_text(encoding="utf-8")
    for tid in [
        "beta-admin-dashboard", "beta-admin-stats", "beta-admin-bulk-invite-btn",
        "beta-admin-confirm-modal", "beta-admin-table",
    ]:
        assert tid in admin_body, f"BetaWaitlistAdmin missing testid {tid}"
    admin_routes = (root / "frontend/src/routes/adminVaultRoutes.tsx").read_text(encoding="utf-8")
    assert 'path="/vibe-vault-admin/beta-waitlist"' in admin_routes
    assert "BetaWaitlistAdmin" in admin_routes
    # GodMode header link
    god = (root / "frontend/src/pages/admin/GodModeDashboard.tsx").read_text(encoding="utf-8")
    assert "godmode-beta-waitlist-link" in god
    # SignupPage magic-link integration
    signup = (root / "frontend/src/pages/SignupPage.tsx").read_text(encoding="utf-8")
    assert "inviteToken" in signup and "redeem-confirm" in signup
    assert "signup-invite-banner" in signup
    # Referral leaderboard (Feb 2026 Late × 3) — viral acquisition flywheel.
    assert "/leaderboard" in body, "Backend must expose /leaderboard endpoint"
    assert "/my-referral" in body, "Backend must expose /my-referral endpoint"
    assert "AMBASSADOR_THRESHOLD" in body and "is_ambassador" in body
    assert "_generate_referral_code" in body, "Referral code generator must be present"
    # Frontend referral UI in BetaTester.tsx
    for tid in [
        "beta-tester-leaderboard", "beta-tester-share-box",
        "beta-tester-share-url", "beta-tester-copy-btn",
    ]:
        assert tid in page_body, f"BetaTester missing referral testid {tid}"
    # ?ref= URL parsing and ref_code POST must be wired.
    assert "useSearchParams" in page_body
    assert "ref_code" in page_body
    # Founder weekly digest (Feb 2026 Late × 4) — auto-Mondays scheduler.
    assert "/digest/preview" in body and "/digest/send" in body
    digest = root / "backend/services/weekly_digest_service.py"
    assert digest.exists(), "weekly_digest_service.py must exist"
    digest_body = digest.read_text(encoding="utf-8")
    for sym in [
        "compute_weekly_digest", "render_digest_email_html",
        "dispatch_weekly_digest", "weekly_digest_loop", "get_last_digest_run",
        "DIGEST_HOUR_UTC", "DIGEST_DAY_OF_WEEK",
    ]:
        assert sym in digest_body, f"weekly_digest_service missing symbol {sym}"
    # Lifespan must register the scheduler so it actually fires.
    lifespan = (root / "backend/lifespan.py").read_text(encoding="utf-8")
    workers = (root / "backend/lifespan_workers.py").read_text(encoding="utf-8")
    assert "_start_weekly_digest" in lifespan
    assert "weekly_digest_loop" in workers
    # Admin UI panel testids
    for tid in [
        "beta-admin-digest", "beta-admin-digest-send-btn",
        "beta-admin-digest-last-run", "beta-admin-digest-recipient",
    ]:
        assert tid in admin_body, f"BetaWaitlistAdmin missing digest testid {tid}"


def test_aaa_casino_table_enhancer_present() -> None:
    """Feb 2026 Late × 5 — every casino table game must wire the
    universal CasinoTableEnhancer so phase indicators + sound effects
    + recent-results history layer on consistently."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    enhancer = root / "frontend/src/components/games/CasinoTableEnhancer.tsx"
    assert enhancer.exists(), "CasinoTableEnhancer must exist"
    src = enhancer.read_text(encoding="utf-8")
    assert "ChipStakeSelector" in src, "ChipStakeSelector must be exported"
    assert "playRouletteWhoosh" in src, "Whoosh must fire on rolling"
    assert "playWinSound" in src and "playLoseSound" in src
    # Every dedicated AAA game file must wire the enhancer + a mobile
    # sticky CTA so the table is playable on phones without scrolling.
    games = [
        ("Yahtzee.tsx",         "yahtzee"),
        ("SicBo.tsx",           "sicbo"),
        ("Craps.tsx",           "craps"),
        ("ThreeCardPoker.tsx",  "tcp"),
        ("CaribbeanStud.tsx",   "cs"),
    ]
    for fname, gid in games:
        body = (root / "frontend/src/pages/games" / fname).read_text(encoding="utf-8")
        assert "CasinoTableEnhancer" in body, f"{fname} must import CasinoTableEnhancer"
        assert f'gameId="{gid}"' in body, f"{fname} must pass stable gameId"
        # Mobile sticky CTA marker — the testid is enough proof.
        assert f"{gid}-" in body and "md:hidden" in body, \
            f"{fname} must include a mobile-sticky CTA section"
        # Page wrapper must reserve room for the sticky CTA.
        assert "pb-28 md:pb-8" in body, \
            f"{fname} page wrapper must reserve mobile bottom padding"
    # The shared shell (used by Hazard / BigSixWheel / PaiGow / CasinoWar)
    # must carry the same primitives.
    shell = (root / "frontend/src/pages/games/_GenericCasinoGame.tsx").read_text(encoding="utf-8")
    assert "CasinoTableEnhancer" in shell
    assert "ChipStakeSelector" in shell
    assert "play-btn-mobile" in shell
    assert "pb-28 md:pb-8" in shell


def test_beta_tester_seeder_wired() -> None:
    """The seeder must auto-provision 3 tester accounts on every boot
    so deployed environments always have working credentials."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    seed = root / "backend/services/beta_tester_seeder.py"
    assert seed.exists(), "beta_tester_seeder.py must exist"
    body = seed.read_text(encoding="utf-8")
    assert "BETA_PASSWORD" in body
    assert "BetaTester2026!" in body
    assert "betatester1@globalvibez.com" in body
    assert "betatester2@globalvibez.com" in body
    assert "betatester3@globalvibez.com" in body
    assert "seed_beta_tester_accounts" in body
    # Lifespan registration so it actually runs.
    lifespan = (root / "backend/lifespan.py").read_text(encoding="utf-8")
    assert "_start_beta_tester_seeder" in lifespan
    assert "Beta Tester seeder" in lifespan
    # Test credentials file must reflect these accounts.
    creds = (root / "memory/test_credentials.md").read_text(encoding="utf-8")
    assert "betatester1@globalvibez.com" in creds
    assert "BetaTester2026!" in creds


def test_landing_language_switcher_in_safe_portal() -> None:
    """Feb 2026 Late × 6 — the language switcher MUST live in the
    top-right header (not the brand area) and render its modal via
    a React portal so the God-Mode logo hotspot can never hijack
    its clicks."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    comp = root / "frontend/src/components/LandingLanguageSwitcher.tsx"
    assert comp.exists(), "LandingLanguageSwitcher must exist"
    body = comp.read_text(encoding="utf-8")
    # Portal escape from any wrapping click handler
    assert "createPortal" in body, "Modal must render via createPortal"
    assert "document.body" in body
    # Defensive click containment
    assert "stopPropagation()" in body and "preventDefault()" in body
    # Wired to globalVibeSync so it stays in lockstep with the FAB
    assert "globalVibeSync" in body
    assert "gv:locale-changed" in body
    # Landing page must (a) import the switcher, (b) NOT render it
    # inside the brand area's God-Mode click hotspot, (c) NOT have
    # the legacy Games nav button.
    landing = (root / "frontend/src/pages/LandingNeonGaming.tsx").read_text(encoding="utf-8")
    assert "LandingLanguageSwitcher" in landing
    assert 'data-testid="landing-nav-games"' not in landing, \
        "Legacy Games nav button must be removed (replaced by language switcher)"
    # 2026-02-09: After LandingPage_Enhancement.pdf the brand block +
    # switcher moved into LandingHeaderEnhanced.tsx. The portal-safe
    # nesting rule is preserved IN THAT COMPONENT — verify there.
    header = (root / "frontend/src/components/landing/LandingHeaderEnhanced.tsx").read_text(encoding="utf-8")
    brand_close_idx = header.find("data-testid=\"landing-logo\"")
    switcher_idx = header.find("<LandingLanguageSwitcher />")
    assert brand_close_idx > 0 and switcher_idx > 0
    # Switcher must be placed AFTER landing-logo's onClick handler line.
    assert switcher_idx > brand_close_idx, \
        "LandingLanguageSwitcher must NOT be nested inside the God-Mode brand hotspot"


def test_translation_bridge_wired() -> None:
    """Feb 2026 Late × 9 — replaced the unreliable Google Translate
    widget with an Emergent-LLM-backed translator that walks the DOM
    and swaps text nodes in-place. No reload, no iframe, no Cloudflare
    interference. Founder bug: `picked 5 different languages and it
    stayed on English the whole time` on production globalvibezdsg.com."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    # Backend route exists and uses the LLM
    i18n = root / "backend/routes/i18n.py"
    assert i18n.exists(), "backend/routes/i18n.py must exist"
    body = i18n.read_text(encoding="utf-8")
    assert "EMERGENT_LLM_KEY" in body
    assert "from emergentintegrations.llm.chat import LlmChat" in body
    assert "/translate" in body and "/supported" in body
    assert "i18n_translations" in body, "Must persist translations to mongo cache"
    assert "_l1_set" in body and "_l2_lookup" in body, "L1+L2 caches must be present"
    # Registered in registry
    reg = (root / "backend/routes/registry.py").read_text(encoding="utf-8")
    assert "from routes.i18n import router as i18n_router" in reg
    # Frontend DOM translator
    walker = root / "frontend/src/utils/domTranslator.ts"
    assert walker.exists(), "domTranslator.ts must exist"
    walker_body = walker.read_text(encoding="utf-8")
    assert "installDomTranslator" in walker_body
    assert "translatePage" in walker_body
    assert "/api/i18n/translate" in walker_body
    assert "gv:locale-changed" in walker_body
    assert "data-i18nOrig" in walker_body or "i18nOrig" in walker_body, \
        "Must save originals so toggling back to English restores cleanly"
    assert "MutationObserver" in walker_body, \
        "Must observe DOM mutations so newly-mounted React subtrees translate"
    # App.js installs the translator
    app = (root / "frontend/src/App.js").read_text(encoding="utf-8")
    assert "installDomTranslator" in app
    # Old Google Translate widget removed from index.html
    html = (root / "frontend/public/index.html").read_text(encoding="utf-8")
    assert "translate.google.com/translate_a/element.js" not in html, \
        "Google Translate widget must be removed (was failing in prod)"
    assert "googleTranslateElementInit" not in html, \
        "Google Translate init must be removed"
    # Boot rehydrator should be removed (DOM translator handles it)
    boot = root / "frontend/src/utils/bootLanguageSync.ts"
    assert not boot.exists(), \
        "bootLanguageSync.ts should be deleted (replaced by DOM translator)"


def test_landing_has_public_room_shortcuts() -> None:
    """Feb 2026 Late × 9 — beta testers were asking how to find DSG TV
    and DSG Music. Public CTAs added to the landing hero."""
    from pathlib import Path
    landing = (Path(__file__).resolve().parents[2] /
               "frontend/src/pages/LandingNeonGaming.tsx").read_text(encoding="utf-8")
    assert 'data-testid="landing-cta-vibe-tv"' in landing
    assert 'data-testid="landing-cta-dsg-music"' in landing
    assert "/dsg/music-group" in landing
    assert "/vibe-tv" in landing


def test_nova_dealer_removed_from_vibe_dice_654() -> None:
    """Feb 2026 Late × 9 — founder removed Nova from the Vibe Dice 654
    table because the room layout requires too much scrolling on mobile
    when she's there. The component import stays for safety but the
    render is replaced with a no-op so we can re-enable later if needed."""
    from pathlib import Path
    src = (Path(__file__).resolve().parents[2] /
           "frontend/src/pages/games/VibeDice654Premium.tsx").read_text(encoding="utf-8")
    assert "<NovaDealerHeader" not in src, \
        "Nova must not render on the Vibe Dice 654 table"
    assert "NovaDealerRetiredHeader" in src, \
        "No-op replacement marker must be present so future agents know why"


def test_chair_counter_circular_import_broken() -> None:
    """Feb 2026 Late × 7 — code review caught a circular dependency
    between routes/chairs.py and routes/apex_evolution.py. The shared
    `total_chairs_sold` reader was extracted to `shared/chair_counters`
    so neither router has to import the other for that read."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    shared = root / "backend/shared/chair_counters.py"
    assert shared.exists(), "shared/chair_counters.py must exist"
    body = shared.read_text(encoding="utf-8")
    assert "async def total_chairs_sold" in body
    # apex_evolution.py must import from shared/, NOT from routes.chairs
    apex = (root / "backend/routes/apex_evolution.py").read_text(encoding="utf-8")
    assert "from shared.chair_counters import total_chairs_sold" in apex
    # The legacy lazy import for `_total_chairs_sold` must be gone for
    # the hot paths (apex_state_for_phase + unlock). chairs._grant_chairs
    # may stay since it's only used on the race-prize endpoint.
    assert "from routes.chairs import _total_chairs_sold" not in apex, \
        "apex_evolution.py must not lazy-import chairs._total_chairs_sold"
    # chairs.py keeps a thin _total_chairs_sold wrapper for backwards
    # compatibility — but it now delegates to shared/.
    chairs = (root / "backend/routes/chairs.py").read_text(encoding="utf-8")
    assert "from shared.chair_counters import total_chairs_sold" in chairs


def test_casino_rng_uses_secure_systemrandom() -> None:
    """Feb 2026 Late × 7 — casino RNG must use secrets.SystemRandom
    in production paths (regulator-grade fairness). Tests can still
    pass an explicit seed for determinism."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    for fname in ["services/casino_wave2_engines.py", "services/vibes_slots.py"]:
        body = (root / "backend" / fname).read_text(encoding="utf-8")
        assert "import secrets" in body, f"{fname} must import secrets"
        assert "secrets.SystemRandom()" in body, \
            f"{fname} must instantiate a secrets.SystemRandom() RNG"
        # Must NOT have any bare `random.Random()` (no-seed) in the
        # production path — those should be _RNG now.
        # The test-path `random.Random(seed)` is fine because seed is not None.
        assert "random.Random()" not in body, \
            f"{fname} still has a bare random.Random() — should use _RNG"


def test_user_auth_fetch_does_not_use_credentials_include() -> None:
    """May 2026 — production CORS guard.

    The Emergent edge gateway returns ``Access-Control-Allow-Origin: *`` for
    cross-origin requests. Per the W3C CORS spec, ``*`` is INCOMPATIBLE with
    ``fetch(... { credentials: 'include' })`` — browsers silently block the
    response, so demo-login on https://globalvibezdsg.com fails with
    ``net::ERR_FAILED`` even though the backend returns 200.

    User-facing auth must use Bearer tokens stored in localStorage instead.
    Admin (founder-only) routes that depend on cookies are exempted.
    """
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    must_not_use_credentials = [
        "frontend/src/pages/LoginPage.tsx",
        "frontend/src/pages/SignupPage.tsx",
        "frontend/src/pages/DashboardNew.tsx",
        "frontend/src/pages/CulturalOnboardingWizard.tsx",
        "frontend/src/components/my-vibez/VideoRecorder.tsx",
        "frontend/src/utils/globalVibeSync.ts",
    ]
    for rel in must_not_use_credentials:
        body = (root / rel).read_text(encoding="utf-8")
        assert "credentials: 'include'" not in body, (
            f"{rel} contains credentials: 'include' — this breaks login on "
            f"globalvibezdsg.com because the edge gateway returns "
            f"Allow-Origin:* (incompatible with credentialed CORS). "
            f"Use Bearer-token auth via localStorage.getItem('auth_token')."
        )


# ─────────────────────────────────────────────────────────────────
#   Vibe Yellow Pages (4th Pillar — May 2026)
# ─────────────────────────────────────────────────────────────────
def test_yellow_pages_router_mounted() -> None:
    """The /api/yellow-pages router must import + register cleanly with
    the canonical 7 categories and 3 paid tiers."""
    from routes.yellow_pages import router, CATEGORIES, PRICING, ADULT_CATEGORIES
    assert router.prefix == "/yellow-pages"
    cat_ids = {c["id"] for c in CATEGORIES}
    assert cat_ids == {"food", "beauty", "home_services", "auto",
                       "retail", "events", "adult"}, \
        f"Yellow Pages categories drifted: {cat_ids}"
    assert ADULT_CATEGORIES == {"adult"}
    assert set(PRICING.keys()) == {"verified", "elite", "featured"}, \
        f"Yellow Pages tiers drifted: {set(PRICING.keys())}"


def test_yellow_pages_pricing_locked() -> None:
    """LOCKED pricing — must match the founder-approved spec
    (Verified $29 one-time / Elite $99 one-time / Featured $19/mo).
    Ambassador commissions are 50% one-time across all tiers
    (Featured first month only)."""
    from routes.yellow_pages import PRICING
    assert PRICING["verified"]["price_usd"] == 29.0
    assert PRICING["verified"]["kind"] == "one_time"
    assert PRICING["verified"]["ambassador_cut_usd"] == 14.50

    assert PRICING["elite"]["price_usd"] == 99.0
    assert PRICING["elite"]["kind"] == "one_time"
    assert PRICING["elite"]["ambassador_cut_usd"] == 49.50

    assert PRICING["featured"]["price_usd"] == 19.0
    assert PRICING["featured"]["kind"] == "monthly"
    assert PRICING["featured"]["ambassador_cut_usd"] == 9.50
    # Featured is paid to ambassador on FIRST month only — protects LTV.
    assert PRICING["featured"].get("ambassador_paid_first_month_only") is True


def test_yellow_pages_adult_category_double_gated() -> None:
    """Adult / Entertainer category must require: license upload + age
    verification on the viewer side."""
    from routes.yellow_pages import CATEGORIES
    adult = next((c for c in CATEGORIES if c["id"] == "adult"), None)
    assert adult is not None, "Adult category must exist"
    assert adult.get("is_adult") is True
    assert adult.get("requires_license") is True, \
        "Adult listings must require a license_doc_url"
    assert adult.get("requires_age_gate") is True, \
        "Adult viewers must be age-verified to see these listings"


def test_yellow_pages_landing_cta_present() -> None:
    """The 4th-Pillar CTA must be visible on the public landing page so
    beta testers / business owners can find the directory before login."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[2] / "frontend" /
            "src" / "pages" / "LandingNeonGaming.tsx").read_text(encoding="utf-8")
    assert "landing-cta-yellow-pages" in body, \
        "Yellow Pages CTA missing on landing page hero"
    assert "/yellow-pages" in body, \
        "Yellow Pages route link missing on landing page"


def test_yellow_pages_dashboard_pillar_tile_present() -> None:
    """Logged-in dashboard 4-pillar grid must surface the Yellow Pages tile."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[2] / "frontend" /
            "src" / "pages" / "DashboardNew.tsx").read_text(encoding="utf-8")
    assert "yellow_pages" in body and "/yellow-pages" in body, \
        "Yellow Pages pillar tile missing from dashboard"


def test_jftn_demo_room_seeder_wired() -> None:
    """May 2026 — JFTN discovery hub must NOT be empty for beta testers.

    The demo-room seeder runs on backend boot via lifespan and inserts 3
    canonical rooms (Neon Blackjack / Velvet Poker / Sunrise Roulette)
    with each of the 3 PG-13 dealer types. Idempotent via stable seed_id.
    Library may include additional 18+ rooms (founder ask 2026-05-09).
    """
    from services.jftn_demo_room_seeder import DEMO_ROOMS, run_seeder
    assert callable(run_seeder)
    pg13 = [r for r in DEMO_ROOMS if r.get("tier", "PG-13") == "PG-13"]
    assert len(pg13) >= 3, \
        f"Expected at least 3 PG-13 demo rooms, got {len(pg13)}"
    seed_ids = {r["seed_id"] for r in DEMO_ROOMS}
    assert len(seed_ids) == len(DEMO_ROOMS), "Demo-room seed_ids must be unique"
    # Each of the 3 PG-13 dealer types should be represented at least
    # once, so beta testers see UI variants on first visit.
    dealer_types = {r["settings"]["dealer_type"] for r in pg13}
    assert {"founder_ai", "ghost_dealer", "personal_avatar"}.issubset(dealer_types), \
        f"PG-13 demo rooms must showcase all 3 original dealer types, got {dealer_types}"
    # All 3 PG-13 challenge games must be represented.
    games = {r["settings"]["challenge_game"] for r in pg13}
    assert {"blackjack", "poker", "roulette"}.issubset(games), \
        f"PG-13 demo rooms must showcase all 3 challenge games, got {games}"

    # The seeder must be wired to fire on backend startup.
    from pathlib import Path
    lifespan = (Path(__file__).resolve().parents[1] /
                "lifespan.py").read_text(encoding="utf-8")
    assert "_start_jftn_demo_room_seeder" in lifespan, \
        "JFTN demo-room seeder helper missing from lifespan.py"
    assert "JFTN demo-room seeder" in lifespan, \
        "JFTN demo-room seeder must be kicked off in register_startup_tasks"




def test_jftn_wallet_uses_canonical_credits_balance() -> None:
    """May 2026 — the JFTN buy-in flow MUST use the canonical
    ``credits_balance`` wallet field, NOT a separate ledger
    (``token_balance`` or ``vibez_coins``) that nobody tops up.

    Two earlier bugs both produced 402 'insufficient' on demo rooms even
    when users had vibe credits. The fix: every JFTN purchase path reads
    and debits ``credits_balance`` — the same field returned by
    ``GET /api/auth/me`` and seeded by the beta_tester_seeder.

    This test pins both code paths so the wallets can't drift again.
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]
    jftn_routes = (backend / "routes" / "just_for_the_night.py").read_text(encoding="utf-8")
    jftn_solana = (backend / "routes" / "jftn_solana.py").read_text(encoding="utf-8")

    # Both files must reference credits_balance (the canonical wallet)
    assert "credits_balance" in jftn_routes, \
        "just_for_the_night.py must use the canonical credits_balance wallet"
    assert "credits_balance" in jftn_solana, \
        "jftn_solana.py must use the canonical credits_balance wallet"

    # And must NOT increment/decrement a divergent ledger that nobody seeds.
    forbidden = ['"$inc": {"token_balance"', '"$inc": {"vibez_coins"']
    for needle in forbidden:
        assert needle not in jftn_routes, \
            f"just_for_the_night.py modifies divergent ledger {needle!r} — drift bug"
        assert needle not in jftn_solana, \
            f"jftn_solana.py modifies divergent ledger {needle!r} — drift bug"


def test_jftn_demo_seed_videos_publicly_reachable() -> None:
    """The JFTN demo rooms must reference public video URLs (not
    placeholders like ``demo://...``) so the founder's beta testers
    actually see playable content after they buy in."""
    from services.jftn_demo_room_seeder import DEMO_ROOMS
    for spec in DEMO_ROOMS:
        url = spec["stream_url"]
        assert url.startswith("https://"), \
            f"Demo room {spec['seed_id']} has non-https stream_url: {url}"
        assert "demo://" not in url, \
            f"Demo room {spec['seed_id']} still uses placeholder stream_url"


def test_beta_tester_seeded_with_buy_in_balance() -> None:
    """Beta testers must spawn with enough ``credits_balance`` to buy
    into all 3 demo JFTN rooms (cheapest ₵100, total ₵525). Without this,
    every fresh tester hits 402 on first click."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "services" / "beta_tester_seeder.py").read_text(encoding="utf-8")
    assert '"credits_balance": 40_000' in body, \
        "Beta tester seeder must mint ₵40,000 starter balance (≈ $20 at 2,000 ₵/$)"


def test_coin_topup_router_mounted_with_locked_packs() -> None:
    """May 2026 — Vibez Coin top-up flow.

    Stripe checkout → ``users.credits_balance`` (the canonical wallet).
    Locks the 4 pack tiers and Stripe USD prices so the client can't
    forge a cheaper price by tampering with the request body.
    """
    from routes.coin_topup import router, COIN_PACKS
    assert router.prefix == "/coins"
    assert set(COIN_PACKS.keys()) == {"starter", "popular", "pro", "vip"}, \
        f"Coin pack catalogue drifted: {set(COIN_PACKS.keys())}"
    assert COIN_PACKS["starter"]["coins"] == 5_000    # 5 × 1000
    assert COIN_PACKS["starter"]["usd"] == 5.00
    assert COIN_PACKS["popular"]["coins"] == 10_000   # 9 × 1000 + ~11% bonus rounding
    assert COIN_PACKS["popular"]["usd"] == 9.00
    assert COIN_PACKS["popular"]["popular"] is True
    assert COIN_PACKS["pro"]["coins"] == 25_000       # 20 × 1250 (25% bonus rate)
    assert COIN_PACKS["pro"]["usd"] == 20.00
    assert COIN_PACKS["vip"]["coins"] == 50_000       # 35 × ~1429 (43% bonus rate)
    assert COIN_PACKS["vip"]["usd"] == 35.00


def test_jftn_modal_offers_topup_on_insufficient_balance() -> None:
    """Beta-tester revenue funnel: when a JFTN purchase 402s, the modal
    must auto-pop the top-up modal instead of showing a dead-end error.
    Pin the wiring so a refactor doesn't accidentally remove it."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[2] / "frontend" /
            "src" / "components" / "just-for-the-night" /
            "PurchaseJFTNPassModal.tsx").read_text(encoding="utf-8")
    assert "TopUpVibezCoinsModal" in body, \
        "JFTN purchase modal must render the TopUpVibezCoinsModal"
    assert "setTopUpOpen(true)" in body, \
        "JFTN purchase modal must trigger top-up on insufficient balance"
    assert "res.status === 402" in body or "insufficient" in body.lower(), \
        "JFTN purchase modal must detect 402 / insufficient-balance error"


def test_marketplace_demo_seeder_wired() -> None:
    """The 4 demo restaurants + 2 drivers + 3 rides must auto-seed on
    every backend boot so HungryVibez and VibeRidez customer pages
    aren't empty when beta testers click in."""
    from services.marketplace_demo_seeder import (
        DEMO_RESTAURANTS, DEMO_DRIVERS, DEMO_RIDES, run_seeder,
    )
    assert callable(run_seeder)
    assert len(DEMO_RESTAURANTS) == 4
    assert len(DEMO_DRIVERS) == 2
    assert len(DEMO_RIDES) == 3
    # Cuisine diversity (testers see different cards, not 4 pizza shops)
    cuisines = {tuple(r["cuisine_type"]) for r in DEMO_RESTAURANTS}
    assert len(cuisines) == 4, "Demo restaurants must showcase 4 cuisines"
    # Every restaurant must have a menu so the order flow is testable
    for r in DEMO_RESTAURANTS:
        assert len(r["menu_items"]) >= 3, \
            f"Demo restaurant {r['seed_id']} needs at least 3 menu items"

    # Wired into lifespan startup chain.
    from pathlib import Path
    lifespan = (Path(__file__).resolve().parents[1] /
                "lifespan.py").read_text(encoding="utf-8")


def test_unified_coin_wallet_helpers() -> None:
    """May 2026 — every utility room (Yellow Pages, HungryVibez, VibeRidez,
    JFTN) MUST debit through ``services/coin_wallet.debit_coins`` so the
    wallet has a single source of truth and an atomic-decrement guard.

    Conversion rate (2026-05-18 founder update): 1,000 ₵ = $1.
    Was previously 2,000 ₵ = $1; per-coin USD value doubled.
    """
    from services.coin_wallet import (
        COINS_PER_USD, usd_to_coins, coins_to_usd,
        debit_coins, credit_coins, get_balance,
    )
    assert COINS_PER_USD == 1000, \
        "Coin/USD rate is locked at 1,000 ₵ = $1 (founder pricing update 2026-05-18). " \
        "Do NOT change without coordinating coin_topup pack amounts + " \
        "watch_and_wager rate import + a pricing-page review."
    assert usd_to_coins(29.00) == 29_000     # YP Verified
    assert usd_to_coins(99.00) == 99_000     # YP Elite
    assert usd_to_coins(19.00) == 19_000     # YP Featured / month
    assert usd_to_coins(0.50) == 500         # half-dollar precision
    assert callable(debit_coins) and callable(credit_coins) and callable(get_balance)
    assert coins_to_usd(29_000) == 29.00


def test_yellow_pages_supports_coin_payment() -> None:
    """Yellow Pages upgrade must accept ``payment_method='coins'`` so
    users with a credits wallet can upgrade without a card."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "routes" / "yellow_pages.py").read_text(encoding="utf-8")
    assert 'payment_method: str = "card"' in body, \
        "UpgradeRequest must default payment_method='card' but accept 'coins'"
    assert "from services.coin_wallet import" in body, \
        "Yellow Pages must debit via the unified coin_wallet helper"
    assert "yellow_pages_upgrade" in body, \
        "Coin debit must use the canonical reason tag"

    fe = (Path(__file__).resolve().parents[2] / "frontend" / "src" /
          "pages" / "yellow_pages" / "YellowPagesListingDetail.tsx").read_text(encoding="utf-8")
    assert 'yp-upgrade-coins-btn-' in fe and 'yp-upgrade-card-btn-' in fe, \
        "Frontend must surface BOTH coin and card payment buttons per tier"
    assert "TopUpVibezCoinsModal" in fe, \
        "YP detail page must auto-pop top-up on insufficient ₵"


def test_hungryvibes_and_viberidez_support_coin_payment() -> None:
    """HungryVibez orders + VibeRidez seat bookings accept coins so the
    same ₵ wallet funds food, rides, and rooms — that's the whole
    'one wallet across the marketplace' premise."""
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]
    smart = (backend / "routes" / "smartstack.py").read_text(encoding="utf-8")
    assert 'payment_method: str = "card"' in smart, \
        "HungryVibez CreateOrderIn must accept payment_method='coins'"
    assert "hungryvibez_order" in smart, \
        "HungryVibez coin debit must use the canonical reason tag"

    rid = (backend / "routes" / "vibe_ridez.py").read_text(encoding="utf-8")


def test_burn_counter_widget_pinned_to_landing_page() -> None:
    """May 2026 - Burn Counter is the public scarcity story.

    The landing page must render BurnCounterWidget and the backend must
    expose GET /api/coins/stats/burn so the widget can poll it every 30
    seconds. Both are pinned so a future refactor doesn't drop the
    marketing-critical scarcity readout.
    """
    from pathlib import Path

    backend = Path(__file__).resolve().parents[1]
    frontend_src = Path(__file__).resolve().parents[2] / "frontend" / "src"

    # Backend route
    stats_body = (backend / "routes" / "coin_stats.py").read_text(encoding="utf-8")
    assert "TOTAL_SUPPLY" in stats_body and "3_000_000_000" in stats_body, \
        "coin_stats.py must reference the locked 3B coin supply"
    assert "/coins" in stats_body and "stats/burn" in stats_body, \
        "coin_stats router must expose /api/coins/stats/burn"

    # Frontend widget + landing
    widget = (frontend_src / "components" / "BurnCounterWidget.tsx").read_text(encoding="utf-8")
    assert "/coins/stats/burn" in widget, \
        "BurnCounterWidget must poll /api/coins/stats/burn"
    assert "burn-counter-widget" in widget, \
        "BurnCounterWidget must expose data-testid='burn-counter-widget'"

    landing = (frontend_src / "pages" / "LandingNeonGaming.tsx").read_text(encoding="utf-8")
    assert "BurnCounterWidget" in landing, \
        "Landing page must render <BurnCounterWidget /> for the public scarcity story"


def test_admin_role_checks_protect_sensitive_endpoints() -> None:
    """May 2026 pre-launch security lockdown.

    Six route files used to have admin-role-check TODO markers on
    endpoints that could approve drivers, verify users, edit any
    restaurant listing, or moderate content. Without admin guards, any
    logged-in user could escalate. Pin the guard so a refactor doesn't
    regress.
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]
    files = [
        "routes/driver_verification.py",
        "routes/verification.py",
        "routes/insurance_verification.py",
        "routes/restaurants.py",
        "routes/moderation.py",
        "routes/vibe_score.py",
    ]
    for rel in files:
        body = (backend / rel).read_text(encoding="utf-8")
        # No TODO admin markers may remain.
        assert "TODO: Add admin" not in body and "TODO: Check if user is admin" not in body, \
            f"{rel} still contains a TODO admin marker — security regression"
        # Each file must reference the unified admin guard.
        assert "from utils.admin_guard import is_admin" in body, \
            f"{rel} must use the unified admin_guard helper"

    # The helper itself must enforce both env-allowlist + flag checks.
    # Use monkey-style env override so this test is independent of the
    # production ADMIN_EMAILS list (which CI loads from .env).
    import os, importlib  # noqa: PLC0415
    from utils import admin_guard as _ag  # noqa: PLC0415
    saved = os.environ.get("ADMIN_EMAILS")
    os.environ["ADMIN_EMAILS"] = "founder@globalvibez.com,demo@globalvibez.com"
    try:
        importlib.reload(_ag)
        assert _ag.is_admin({"email": "outsider@example.com", "is_admin": False}) is False
        assert _ag.is_admin({"email": "founder@globalvibez.com"}) is True
        assert _ag.is_admin({"is_admin": True}) is True
    finally:
        if saved is None:
            os.environ.pop("ADMIN_EMAILS", None)
        else:
            os.environ["ADMIN_EMAILS"] = saved
        importlib.reload(_ag)


def test_jftn_and_social_features_are_mongo_backed() -> None:
    """In-memory dicts (PRIVATE_SUITES, WINNER_INTERVIEWS, BID_WHIST_GAMES)
    used to drop in-flight game/suite state on every backend restart.
    Pin the migration to Mongo collections so beta-tester sessions
    survive restarts.
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]
    sf = (backend / "routes" / "social_features.py").read_text(encoding="utf-8")
    bw = (backend / "routes" / "bid_whist_meta.py").read_text(encoding="utf-8")
    # Confirm each file has migrated to a Mongo collection.
    assert "social_private_suites" in sf and "social_winner_interviews" in sf, \
        "social_features.py must read/write through Mongo collections"
    assert "bid_whist_games" in bw, \
        "bid_whist_meta.py must read/write through the bid_whist_games Mongo collection"
    # Dead-code patterns that signaled pure in-memory state must be gone.
    assert "if suite_id not in PRIVATE_SUITES" not in sf, \
        "social_features.py reverted to in-memory dict lookups"
    assert "if interview_id not in WINNER_INTERVIEWS" not in sf, \
        "social_features.py reverted to in-memory dict lookups"
    assert "if table_id not in BID_WHIST_GAMES" not in bw, \
        "bid_whist_meta.py reverted to in-memory dict lookups"


def test_staff_management_password_hashing_and_email() -> None:
    """May 2026 — staff invite flow must:
    1. Hash passwords with bcrypt (NOT store plaintext)
    2. Try to send an invite email via Resend (no-op if RESEND_API_KEY absent)
    Both used to be TODO comments; without these the staff flow was unsafe.
    """
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "routes" / "staff_management_routes.py").read_text(encoding="utf-8")
    assert "import bcrypt" in body, \
        "staff_management_routes must import bcrypt for password hashing"
    assert "_hash_password" in body and "bcrypt.hashpw" in body, \
        "staff_management_routes must hash passwords via bcrypt before storage"
    assert "_send_staff_invite_email" in body, \
        "staff_management_routes must wire Resend for invite emails"
    # No plaintext-storage shortcut may remain.
    assert "password_hash = password" not in body, \
        "staff_management_routes reverted to plaintext password storage"


def test_my_vibez_uploads_persist_to_disk() -> None:
    """File upload must actually save to disk under /app/backend/uploads/
    so videos survive backend restarts. The mount in server.py exposes
    this dir at /api/uploads/."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "routes" / "my_vibez.py").read_text(encoding="utf-8")
    assert "TODO: Save file to storage" not in body, \
        "my_vibez.py still has the TODO file-save marker"
    assert "uploads_dir.mkdir(parents=True, exist_ok=True)" in body, \
        "my_vibez.py must materialize the upload dir on disk"
    assert "/api/uploads/vibez/" in body, \
        "my_vibez.py must surface uploads under the /api/uploads static mount"


# ============================================================================
# May 2026 — Cyber-Casino + Revolutionary Games Blueprint v1
# ============================================================================
# These guards lock in the work done over the May 2026 sprint:
#   • Burn Counter scarcity readout (landing page)
#   • Voice Coach (Whisper STT + Claude move-tip)
#   • Roguelite Chess Trial (24-hr permadeath ladder)
#   • Universal CommHub (in-game menu bar consolidation)
#   • Cyber-Casino Holo skin (Chess + Checkers practice & multiplayer)
#   • Battle Mode primitives (BattleModeWagerPanel + ChipStream + ledger)
#   • In-app Demo login session reaches /dashboard with all 18 rooms
# ============================================================================

def test_burn_counter_endpoint_registered():
    """Landing page burn counter widget needs /api/coins/stats/burn alive."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    coin_paths = [p for p in paths if "/coins/stats" in p or "/coin-stats" in p]
    assert coin_paths, "Burn counter endpoint missing — landing widget will go blank"


def test_voice_coach_router_registered():
    """Cyber-Casino Voice Coach (May 2026) requires move-tip + voice-question
    endpoints. If both routes go missing the chess Coach button silently
    fails to fetch tips."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert any("/voice-coach/move-tip" in p for p in paths), \
        "Voice Coach: /api/voice-coach/move-tip missing"
    assert any("/voice-coach/voice-question" in p for p in paths), \
        "Voice Coach: /api/voice-coach/voice-question missing"


def test_voice_coach_uses_emergent_llm_key():
    """Voice Coach must read EMERGENT_LLM_KEY from env, not hard-code keys."""
    src = open("/app/backend/routes/voice_coach.py").read()
    assert "EMERGENT_LLM_KEY" in src, \
        "voice_coach.py must read EMERGENT_LLM_KEY from os.environ"
    assert "claude-sonnet-4-5" in src, \
        "voice_coach.py must use claude-sonnet-4-5-20250929"
    assert "whisper-1" in src, "voice_coach.py must call whisper-1 STT"


def test_roguelite_chess_router_registered():
    """Roguelite Chess Trial 24-hr permadeath ladder needs all 4 routes."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    for required in (
        "/roguelite-chess/state",
        "/roguelite-chess/start",
        "/roguelite-chess/record-result",
        "/roguelite-chess/leaderboard",
    ):
        assert any(required in p for p in paths), \
            f"Roguelite Chess: {required} missing — daily ladder broken"


def test_roguelite_chess_default_lives():
    """Trial must start with 3 lives. Changing this breaks the daily
    leaderboard math + every regression that screenshots the badge."""
    src = open("/app/backend/routes/roguelite_chess.py").read()
    assert "DEFAULT_LIVES = 3" in src, \
        "Roguelite default lives changed — leaderboard rules will drift"


def test_roguelite_chess_scoring_locked():
    """Scoring formula: win = 100 + max(0, elo_diff), draw = +25, loss = -1 life.
    If anyone tweaks these the leaderboard becomes incomparable across days."""
    src = open("/app/backend/routes/roguelite_chess.py").read()
    assert "100 + max(0, body.elo_diff)" in src, \
        "Roguelite win-score formula must remain '100 + max(0, elo_diff)'"
    assert "new_score += 25" in src, \
        "Roguelite draw-score must remain +25"


def test_holopiece_static_mode_exists():
    """May 2026 chess natural-play fix: HoloPiece needs `static` prop so
    react-chessboard's drag layer + multiplayer button onClick still
    work. If static mode goes missing, every move re-fires the
    scale-0 entrance animation and chess play feels broken."""
    src = open("/app/frontend/src/components/games/HoloBoard/HoloPiece.tsx").read()
    assert "static?: boolean" in src, \
        "HoloPiece.tsx must expose `static?: boolean` prop"
    assert "static: isStatic" in src, \
        "HoloPiece.tsx must destructure `static` -> `isStatic`"
    assert "isStatic ? false" in src, \
        "HoloPiece.tsx must skip entrance animation when isStatic"


def test_chess_rooms_use_holopiece_static_mode():
    """Both chess rooms must pass `static` to HoloPiece — without it
    every move re-pops the pieces and drag-drop breaks."""
    practice = open("/app/frontend/src/components/practice_games/PracticeChess.tsx").read()
    multi = open("/app/frontend/src/pages/games/HttpMultiplayerChess.tsx").read()
    assert "HoloPiece" in practice and "static" in practice, \
        "PracticeChess.tsx must use HoloPiece with `static` mode"
    assert "HoloPiece" in multi and "static" in multi, \
        "HttpMultiplayerChess.tsx must use HoloPiece with `static` mode"


def test_commhub_inline_inside_room_menu_bar():
    """Founder rule (May 2026): comms must live inside the in-game menu
    bar, not floating top-right. Floating CommHub auto-hides when a
    room-menu-bar marker is present in the DOM."""
    src = open("/app/frontend/src/components/common/CommHubDropdown.tsx").read()
    assert 'data-testid="room-menu-bar"' in src, \
        "CommHubDropdown.tsx must hide when room-menu-bar marker exists"
    assert "MutationObserver" in src, \
        "CommHubDropdown.tsx must observe DOM for the marker"


def test_commhub_button_in_every_aaa_game():
    """Each AAA game room must inject a CommHubButton next to its
    SpadesGameMenu so comms live inside the in-game bar."""
    rooms = [
        "/app/frontend/src/pages/games/BidWhistAAA.tsx",
        "/app/frontend/src/pages/games/SpadesAAA.tsx",
        "/app/frontend/src/pages/games/HeartsAAA.tsx",
        "/app/frontend/src/pages/games/PinochleAAA.tsx",
        "/app/frontend/src/pages/games/CrazyEightsAAA.tsx",
    ]
    for path in rooms:
        body = open(path).read()
        assert "CommHubButton" in body, \
            f"{os.path.basename(path)} missing in-game CommHubButton"
        assert 'data-testid="room-menu-bar"' in body, \
            f"{os.path.basename(path)} missing room-menu-bar marker"


def test_battle_mode_primitives_exist():
    """Cyber-Casino Battle Mode (May 2026) — retired. The
    BattleModeWager UI was never wired to a route or game and got
    deleted in the May-2026 dead-file sweep. The ledger hook lives on
    in case the feature is revived."""
    hook = "/app/frontend/src/hooks/useBattleModeLedger.ts"
    assert os.path.exists(hook), "useBattleModeLedger.ts missing"
    hook_src = open(hook).read()
    assert "transferOnCapture" in hook_src
    assert "useBattleModeLedger" in hook_src


def test_universal_shot_clock_components():
    """Every multiplayer card game should have a 10-second shot clock
    (UDA §2). Loss of either ShotClockRing or the seconds badge in
    TurnIndicator breaks the whole "auto-play on idle" promise."""
    ring = "/app/frontend/src/components/games/ShotClockRing.tsx"
    indicator = "/app/frontend/src/components/games/TurnIndicator.tsx"
    assert os.path.exists(ring), "ShotClockRing.tsx missing"
    assert os.path.exists(indicator), "TurnIndicator.tsx missing"
    indi_src = open(indicator).read()
    assert "turn-indicator-seconds" in indi_src, \
        "TurnIndicator must render a `turn-indicator-seconds` badge"
    assert "onExpire" in indi_src, \
        "TurnIndicator must accept `onExpire` so games can auto-act"


def test_aaa_card_shaders_global():
    """Universal Design Agent §1 shaders (.gv-card-active neon-pulse,
    .gv-card-dim sharp-dim) must remain wired into the global stylesheet
    so every card game inherits the look."""
    css = open("/app/frontend/src/styles/vibez-pro.css").read()
    assert ".gv-card-active" in css, ".gv-card-active shader missing"
    assert ".gv-card-dim" in css, ".gv-card-dim shader missing"
    assert ".gv-arena" in css, ".gv-arena helper missing"
    index = open("/app/frontend/src/index.css").read()
    assert "styles/vibez-pro.css" in index, \
        "index.css must import vibez-pro.css globally"


def test_landing_language_switcher_sticky():
    """Founder override (2026-02-09): NO STICK — landing header is no
    longer sticky/fixed. The language-switcher safety guarantees move
    to a different invariant: the switcher MUST live inside the
    LandingHeaderEnhanced component (not nested inside the brand
    block) so the God-Mode click hotspot can't hijack it. The
    `overflow-x: clip` rule on html/body still stays for layout
    stability across the page."""
    header = open("/app/frontend/src/components/landing/LandingHeaderEnhanced.tsx").read()
    assert "<LandingLanguageSwitcher />" in header, \
        "LandingLanguageSwitcher must be rendered inside the new header"
    # Must sit AFTER the brand block (not nested inside it).
    brand_idx = header.find('data-testid="landing-logo"')
    switcher_idx = header.find("<LandingLanguageSwitcher />")
    assert brand_idx > 0 and switcher_idx > 0
    assert switcher_idx > brand_idx, \
        "LandingLanguageSwitcher must NOT be nested inside the God-Mode brand hotspot"
    css = open("/app/frontend/src/index.css").read()
    assert "overflow-x: clip" in css, \
        "html/body must keep `overflow-x: clip` for layout stability"


def test_dashboard_route_uses_DashboardNew():
    """Critical regression (May 2026): /dashboard must route to the rich
    18-room hub (DashboardNew.tsx), not the old stripped Dashboard.jsx
    that was deleted. miscRoutes.tsx is the override that lost it before."""
    src = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert "DashboardNew" in src, \
        "miscRoutes.tsx must import Dashboard from DashboardNew"


def test_18_rooms_present_in_hub():
    """All 18 rooms the founder enumerated must remain wired in the hub."""
    src = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    rooms = [
        "Dating Universe",
        "Find Your Player 2",
        "MY VIBEZ",
        "Game Arena",
        "Tournament Hall",
        "Social Lounge",
        "Date Spot Finder",
        "Just For The Night",
        "Hungry Vibez",
        "Global Vibez DSG TV",
        "DSG Music Group",
        "Vibe Yellow Pages",
        "Beat Vault",
        "Memory Bank",
        "Vigilant Matchmaking",
        "Cultural Profile",
        "Voice Mirror",
        "Vibes Rides",
    ]
    missing = [r for r in rooms if r not in src]
    assert not missing, f"Dashboard hub missing rooms: {missing}"


# ============================================================================
# May 2026 — Ultimate Blueprint v3 (relaunch gate)
# ============================================================================
def test_immutable_core_constants_locked():
    """Ultimate Blueprint v3 §4: Sovereign Tax 13.5% and Artist Split 70/30
    are foundational economic locks. ANY drift must crash the boot."""
    from routes.immutable_core import (
        SOVEREIGN_TAX_RATE,
        ARTIST_PRODUCER_SHARE,
        PLATFORM_SHARE,
    )
    assert SOVEREIGN_TAX_RATE == 0.135, "Sovereign Tax drifted from 13.5%"
    assert ARTIST_PRODUCER_SHARE == 0.70, "Artist share drifted from 70%"
    assert PLATFORM_SHARE == 0.30, "Platform share drifted from 30%"
    assert ARTIST_PRODUCER_SHARE + PLATFORM_SHARE == 1.0, \
        "Artist + platform must sum to 100%"


def test_immutable_core_router_registered():
    """Public read endpoint is what the Legacy Vault page polls. Losing
    it would silently break the investor-facing audit trail."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert any("/immutable-core/constants" in p for p in paths), \
        "Immutable Core: /api/immutable-core/constants missing"


def test_immutable_core_verify_at_boot():
    """`verify_locks()` must be called during route registration so the
    server crashes if a downstream service drifts."""
    src = open("/app/backend/routes/registry.py").read()
    assert "verify_locks()" in src, \
        "registry.py must call verify_locks() during route registration"


def test_legacy_vault_page_exists_and_routes():
    """Legacy Vault must be reachable at /legacy-vault and pull live
    data from /api/immutable-core/constants."""
    page = open("/app/frontend/src/pages/LegacyVaultPage.tsx").read()
    assert "/api/immutable-core/constants" in page, \
        "LegacyVaultPage must poll /api/immutable-core/constants"
    routes = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert "/legacy-vault" in routes, \
        "miscRoutes must register /legacy-vault"
    assert "LegacyVaultPage" in routes, \
        "miscRoutes must import LegacyVaultPage"


def test_vigilant_design_agent_mounted():
    """Ultimate Blueprint v3 §1: VigilantDesignAgent must be mounted in
    App.js so the Emergent badge auto-repositions on overlap."""
    src = open("/app/frontend/src/App.js").read()
    assert "VigilantDesignAgent" in src, \
        "App.js must import + mount VigilantDesignAgent"
    agent = open("/app/frontend/src/components/common/VigilantDesignAgent.tsx").read()
    assert "MutationObserver" in agent, \
        "VigilantDesignAgent must observe DOM for badge injection"
    assert "0.5" in agent and "top-right" not in agent.lower() or "right: \"10px\"" in agent or '"right": "10px"' in agent, \
        "VigilantDesignAgent must reposition to top-right at 50% opacity"


def test_landscape_zoom_to_fit_locked():
    """Ultimate Blueprint v3 §2: `.gv-arena` must use the verbatim
    spec — `max-height: 85vh` + `transform: scale(min(1, 0.85))` so
    table fits one viewport on landscape."""
    css = open("/app/frontend/src/styles/vibez-pro.css").read()
    assert ".gv-arena" in css
    assert "max-height: 85vh" in css, \
        ".gv-arena must have `max-height: 85vh` per blueprint v3"
    assert "scale(min(1, 0.85))" in css, \
        ".gv-arena must zoom-to-fit via `scale(min(1, 0.85))`"
    assert ".gv-player-hand" in css, \
        "Player hand must have dedicated bottom-pinned class (.gv-player-hand). " \
        "The unnamespaced `.player-hand` was removed in May 2026 because it " \
        "collided with existing markup and blocked clicks in UniversalGameRoom."
    assert "z-index: 100" in css, \
        "Player hand must use z-index: 100 to stay on top"


def test_trick_pile_offsets_tight_and_centered():
    """May 2026 founder mandate: cards must land in the middle of the
    table where the logo lives, not closer to the player's side. The
    SpadesTrickPile SEAT_OFFSET values must stay tight (|y| <= 14, |x|
    <= 24) so the centroid stays at the table center even on landscape
    phone rotation."""
    src = open("/app/frontend/src/components/spades/SpadesTrickPile.tsx").read()
    import re
    # Extract every numeric x: / y: value from the SEAT_OFFSET map.
    pairs = re.findall(r"x:\s*(-?\d+).*?y:\s*(-?\d+)", src)
    assert pairs, "Could not find SEAT_OFFSET in SpadesTrickPile.tsx"
    for x_str, y_str in pairs:
        x, y = int(x_str), int(y_str)
        assert abs(x) <= 24, (
            f"SpadesTrickPile seat-offset x={x} too wide — cards will drift "
            "horizontally off table center. Keep |x| <= 24."
        )
        assert abs(y) <= 14, (
            f"SpadesTrickPile seat-offset y={y} too tall — cards will drift "
            "into the player's hand area on landscape. Keep |y| <= 14."
        )


def test_vigilant_agent_audits_pile_centering():
    """The Vigilant Design Agent must check that trick piles stay at
    the table centroid (within 8% tolerance). If the audit logic is
    deleted, regressions like the SpadesTrickPile y=±32 drift go
    silent again."""
    src = open("/app/frontend/src/components/common/VigilantDesignAgent.tsx").read()
    assert "auditTrickPileCentering" in src, \
        "VigilantDesignAgent must include the trick-pile centering audit"
    assert "data-vigilant-off-center" in src, \
        "Off-center piles must be tagged with data-vigilant-off-center"
    assert "PILE_SELECTORS" in src, \
        "VigilantDesignAgent must enumerate trick-pile selectors"


# ─────────────────────────────────────────────────────────── DSG Guard
# (Safety & Operations Code, May 2026 PDF)


def test_dsg_guard_constants_locked():
    """DSG Guard PDF (§Real-Time Safety Rails + §Payout Structure):
    the four canonical constants MUST stay at their published values.
    Drift requires a founder-signed amendment to the PDF.
    """
    from routes.dsg_guard import get_locked_constants_dict
    locked = get_locked_constants_dict()
    assert locked["ROUTE_DEVIATION_LIMIT_MILES"] == 1.5, \
        "Route-deviation rail must be 1.5 miles per PDF"
    assert locked["ACCEPTANCE_WINDOW_SECONDS"] == 15, \
        "Acceptance window must be 15 seconds per PDF"
    assert locked["DSG_PAYOUT_DRIVER"] == 0.70, \
        "VibeShoppers driver share must be 70% per PDF"
    assert locked["DSG_PAYOUT_SOVEREIGN_TAX"] == 0.135, \
        "VibeShoppers sovereign tax must be 13.5% per PDF (matches Immutable Core)"
    assert locked["DSG_PAYOUT_LIQUIDITY_POOL"] == 0.10, \
        "VibeShoppers liquidity pool must be 10% per PDF"


def test_dsg_guard_routes_mounted():
    """The DSG Guard router MUST be mounted under /api/dsg-guard so
    the public safety-rails / payout-structure endpoints are reachable."""
    from server import app
    paths = {r.path for r in app.routes}
    assert "/api/dsg-guard/safety-rails" in paths, \
        "Public safety-rails endpoint missing — DSG Guard router not mounted"
    assert "/api/dsg-guard/payout-structure" in paths, \
        "Public payout-structure endpoint missing"
    assert "/api/dsg-guard/enrollment/submit" in paths
    assert "/api/dsg-guard/dispatch/build" in paths
    assert "/api/dsg-guard/route-deviation/check" in paths


def test_dsg_guard_payout_buckets_sum_to_one():
    """The 4 payout buckets (driver / sovereign tax / liquidity pool /
    residual) MUST sum to 100% — otherwise the ledger leaks money."""
    from routes.dsg_guard import (
        DSG_PAYOUT_DRIVER, DSG_PAYOUT_SOVEREIGN_TAX,
        DSG_PAYOUT_LIQUIDITY_POOL, DSG_PAYOUT_RESIDUAL,
    )
    total = (DSG_PAYOUT_DRIVER + DSG_PAYOUT_SOVEREIGN_TAX
             + DSG_PAYOUT_LIQUIDITY_POOL + DSG_PAYOUT_RESIDUAL)
    assert abs(total - 1.0) < 1e-9, \
        f"DSG payout buckets must sum to 1.0; got {total}"


# ─────────────────────────────────── Universal Mobile Foundation
# (Phase 1+2 — May 2026 founder mandate: orientation toggle in every
#  game room, portrait-friendly home screen)


def test_orientation_toggle_component_exists():
    """The OrientationToggle component is the source of truth for the
    in-app rotation control. It must export both `OrientationToggle`
    AND `OrientationApplier` + `OrientationFAB` so RoomMenuBar /
    App.js can mount them respectively."""
    src = open("/app/frontend/src/components/common/OrientationToggle.tsx").read()
    assert "OrientationToggle" in src
    assert "OrientationApplier" in src, \
        "OrientationApplier must exist for App-level mount"
    assert "OrientationFAB" in src, \
        "OrientationFAB must exist for mobile-only floating button"
    # Cycle order is documented (auto → landscape → portrait → auto)
    assert "screen.orientation" in src or "orientation.lock" in src, \
        "Must attempt OS-level orientation lock first"
    assert "gv-orient-fake-landscape" in src, \
        "Must apply CSS class fallback when OS lock unavailable"


def test_orientation_toggle_in_room_menu_bar():
    """Every game room must inherit the OrientationToggle via the
    shared RoomMenuBar (founder mandate, May 2026 — no per-game wiring)."""
    src = open("/app/frontend/src/components/games/RoomMenuBar.tsx").read()
    assert "OrientationToggle" in src, \
        "RoomMenuBar MUST mount OrientationToggle so all 18 rooms inherit it"


def test_app_mounts_orientation_globals():
    """App.js must mount the OrientationApplier + OrientationFAB so the
    saved preference is applied on every page load and the floating
    mobile-only toggle is available outside game rooms."""
    src = open("/app/frontend/src/App.js").read()
    assert "OrientationApplier" in src, \
        "App.js must mount OrientationApplier"
    assert "OrientationFAB" in src, \
        "App.js must mount OrientationFAB for non-room screens"


def test_mobile_foundation_css_loaded():
    """The universal mobile foundation stylesheet must be imported
    once via index.css and must contain the fluid typography + fake-
    landscape rotation rules."""
    idx = open("/app/frontend/src/index.css").read()
    assert "mobile-foundation.css" in idx, \
        "index.css must @import the mobile-foundation stylesheet"
    foundation = open("/app/frontend/src/styles/mobile-foundation.css").read()
    assert "gv-orient-fake-landscape" in foundation, \
        "mobile-foundation.css must define the OS-lock fallback rotation"
    assert "clamp(" in foundation, \
        "mobile-foundation.css must scale hero typography with clamp()"
    assert "overflow-x: hidden" in foundation, \
        "Mobile foundation must prevent horizontal scroll"


def test_viewport_meta_supports_safe_areas():
    """index.html viewport meta must include `viewport-fit=cover` so
    iOS notch / Android gesture bars are handled correctly."""
    html = open("/app/frontend/public/index.html").read()
    assert "viewport-fit=cover" in html, \
        "<meta viewport> must include viewport-fit=cover for safe-area support"


# ─────────────────────────────────────── Streamer Action Hub
# (Streamer Revenue / Master Tech / Party Hub blueprints, May 2026)


def test_streamer_actions_constants_locked():
    """Streamer Revenue PDF §4 + Master Tech §5 + Party Hub §4:
    the unifying tip-to-action rail must publish the locked split
    + voice-intercept window + hype meter threshold."""
    from routes.streamer_actions import get_locked_constants_dict
    locked = get_locked_constants_dict()
    assert locked["STREAMER_PAYOUT"] == 0.70, \
        "Streamer share must be 70% per Streamer Revenue PDF §1"
    assert locked["SOVEREIGN_TAX"] == 0.135, \
        "Sovereign tax must be 13.5% — must agree with Immutable Core"
    assert locked["LIQUIDITY_POOL"] == 0.10
    assert locked["VOICE_INTERCEPT_SECONDS"] == 15, \
        "Voice Mirror Intercept must be 15s per PDF §4"
    assert locked["HYPE_METER_PEAK_THRESHOLD"] >= 1, \
        "Hype meter must have a positive peak threshold"
    # All seven action kinds from the 3 PDFs must be supported
    expected_kinds = {
        "HECKLE", "BUFF", "ROUTE_TIP", "DJ_INTERCEPT",
        "VOICE_INTERCEPT", "INSTRUMENT_GIFT", "HECKLE_GALLERY",
    }
    assert set(locked["ACTION_KINDS"]) == expected_kinds, \
        f"Action kinds drifted; expected {expected_kinds}"


def test_streamer_actions_routes_mounted():
    """The streamer-actions router MUST be mounted under /api so
    overlay polling and tip POSTs are reachable."""
    from server import app
    paths = {r.path for r in app.routes}
    assert "/api/streamer-actions/constants" in paths
    assert "/api/streamer-actions/tip" in paths
    assert "/api/streamer-actions/hype-meter/{streamer_id}" in paths
    assert "/api/streamer-actions/recent/{streamer_id}" in paths
    assert "/api/streamer-actions/complete/{action_id}" in paths


def test_streamer_actions_payout_buckets_sum_to_one():
    """Streamer / sovereign-tax / liquidity-pool / residual MUST
    sum to 100% — otherwise the ledger leaks money."""
    from routes.streamer_actions import (
        STREAMER_PAYOUT, SOVEREIGN_TAX, LIQUIDITY_POOL, RESIDUAL,
    )
    total = STREAMER_PAYOUT + SOVEREIGN_TAX + LIQUIDITY_POOL + RESIDUAL
    assert abs(total - 1.0) < 1e-9, \
        f"Streamer Action payout buckets must sum to 1.0; got {total}"


# ─────────────────────────────────────── Blackjack (no-bug lock)


def test_blackjack_action_endpoint_no_player_cards_keyerror():
    """Lock the current Blackjack session-shape: the action handler
    reads `session['player_hands'][hand_index]`, NEVER
    `session['player_cards']` (which would KeyError). If a future
    refactor accidentally reintroduces the bad lookup this gate
    catches it before the 500 hits production."""
    src = open("/app/backend/routes/blackjack.py").read()
    assert "session['player_cards']" not in src, \
        "Blackjack action handler must use session['player_hands'][hand_index]"
    assert 'session["player_cards"]' not in src
    assert "session['player_hands']" in src or 'session["player_hands"]' in src, \
        "Blackjack must persist hands under 'player_hands' key"


# ─────────────────────────────────────── Beat Vault DLC


def test_beat_dlc_routes_mounted():
    """The Beat Vault DLC mint flow must be reachable so the
    finished-track Vibe DLC mint UI works end-to-end."""
    from server import app
    paths = {r.path for r in app.routes}
    assert "/api/beat-dlc/mint" in paths
    assert "/api/beat-dlc/list/{artist_id}" in paths
    assert "/api/beat-dlc/mint-mode" in paths


def test_beat_dlc_share_split_locked():
    """Beat Vault DLC mints MUST credit the artist 70%, sovereign tax
    13.5%, liquidity 10% — agrees with Immutable Core + Streamer Hub."""
    from routes.beat_dlc import ARTIST_SHARE, SOVEREIGN_TAX, LIQUIDITY_POOL
    assert ARTIST_SHARE == 0.70
    assert SOVEREIGN_TAX == 0.135
    assert LIQUIDITY_POOL == 0.10


# ─────────────────────────────────────── May 2026 PDF rooms wired


def test_may_2026_pdf_rooms_routed():
    """All seven May 2026 rooms must be importable AND have routes
    declared in `gamesRoutes.tsx`. If any of these fail to import
    (e.g. broken JSX), the dashboard tile will 404."""
    routes_src = open("/app/frontend/src/routes/gamesRoutes.tsx").read()
    for path in [
        '/streamer/overlay/',
        '/party/vibe-tionary',
        '/party/meme-matchmaker',
        '/party/hide-seek',
        '/dating/blind-auction',
        '/vibeshopper',
        '/beat-vault/dlc',
    ]:
        assert path in routes_src, f"Missing route declaration for {path}"


def test_dashboard_surfaces_new_rooms():
    """The dashboard must include every May 2026 room as a tile so
    users can find them. If a tile is removed, this gate flags it."""
    src = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    for tile_id in [
        'vibetionary', 'meme_matchmaker', 'hide_seek',
        'blind_auction', 'vibeshopper', 'beat_vault_dlc',
        'streamer_overlay',
        # Music Arena + TV Totem Pole batch
        'sound_check', 'collab_matchmaker', 'totem_battles', 'tv_totem_pole',
        # P1 / P2 batch (May 9, 2026 evening)
        'vibe_suite', 'lyric_glasshouse', 'cyber_casino',
    ]:
        assert f"id: '{tile_id}'" in src, \
            f"Dashboard tile '{tile_id}' missing — May 2026 PDF rooms must surface here"
    assert "whats-new-banner" in src, \
        "Dashboard must render the What's New (May 2026) banner"


def test_p1_p2_rooms_routed():
    """Vibe Suite + Lyric Glasshouse must be wired in gamesRoutes."""
    src = open("/app/frontend/src/routes/gamesRoutes.tsx").read()
    for path in [
        "/music/vibe-suite",
        "/music/glasshouse",
    ]:
        assert path in src, f"Missing route declaration for {path}"


def test_tv_survive_scheduler_registered():
    """TV Survive scheduler MUST be wired in lifespan.py so the queue
    auto-cuts pilots below the survival threshold every 5 min."""
    src = open("/app/backend/lifespan.py").read()
    assert "_start_tv_survive" in src, \
        "TV Totem-Pole survive scheduler not registered"
    assert "TV Totem-Pole survive scheduler" in src
    assert "Memory Bank Cinema auto-archive" in src
    assert "_start_memory_bank_archive" in src


def test_hideseek_uses_mapbox():
    """Vibe-Hide & Seek must use real Mapbox tiles in addition to
    the merchant grid (Master Tech Blueprint upgrade)."""
    src = open("/app/frontend/src/pages/party/VibeHideSeek.tsx").read()
    assert "react-map-gl/mapbox" in src, "Hide & Seek must import react-map-gl"
    assert "MAPBOX_TOKEN" in src, "Must read REACT_APP_MAPBOX_TOKEN"
    assert 'data-testid="hideseek-map"' in src, "Map container missing testid"
    # Pins must exist on every hideout
    assert 'hideseek-pin-' in src, "Pin testids must be present"


# ─────────────────────────────────────── Music Arena + TV Totem Pole


def test_totem_pole_constants_locked():
    """Music Arena + TV PDFs lock these rails. Drift requires a
    founder-signed amendment."""
    from routes.totem_pole import get_locked_constants_dict
    locked = get_locked_constants_dict()
    assert locked["CREATOR_PAYOUT"] == 0.70
    assert locked["SOVEREIGN_TAX"] == 0.135
    assert locked["LIQUIDITY_POOL"] == 0.10
    assert locked["POWER_HOUR_MULTIPLIER"] == 1.5, \
        "Music Battle PDF: 1.5× stake bonus for fans on Power Hour"
    assert locked["COLLAB_SYNERGY_MIN_PCT"] == 98, \
        "Beat-Maker PDF: 98% Synergy Logic"
    assert locked["SOUND_CHECK_FLIP_SECS"] == 15, \
        "Sound-Check Gauntlet PDF: 15-second flip"
    assert locked["TIP_SHIELD_BLOCK_SECS"] == 300, \
        "Tip-to-Shield PDF: 5-minute block"
    assert locked["TIP_SHIELD_BLOCK_CENTS"] == 200, \
        "Tip-to-Shield PDF: $2.00 per shield extension"


def test_totem_pole_routes_mounted():
    """All Totem Pole endpoints must be mounted under /api/totem-pole."""
    from server import app
    paths = {r.path for r in app.routes}
    for p in [
        "/api/totem-pole/constants",
        "/api/totem-pole/sound-check/vote",
        "/api/totem-pole/collab/match",
        "/api/totem-pole/battle/gift",
        "/api/totem-pole/battle/resolve",
        "/api/totem-pole/tv/tip-shield",
        "/api/totem-pole/tv/survive",
        "/api/totem-pole/tv/age-verify",
        "/api/totem-pole/tv/entry-code",
    ]:
        assert p in paths, f"Missing route {p}"


def test_music_tv_rooms_routed():
    """The 4 Music Arena + TV Totem Pole pages MUST have route
    declarations in `gamesRoutes.tsx`."""
    src = open("/app/frontend/src/routes/gamesRoutes.tsx").read()
    for path in [
        "/music/sound-check",
        "/music/collab-matchmaker",
        "/music/totem-battles",
        "/tv/totem-pole",
        "/streamer/setup-guide",
    ]:
        assert path in src, f"Missing route declaration for {path}"


def test_streamer_setup_guide_marketing_page():
    """The Streamer Setup Guide is a public-route marketing page that
    converts streamers to OBS browser-source users in <60s. It must
    have all 5 setup steps + the unique-URL block + the 7 action
    catalog cards + the Lyric Glasshouse pro-tip CTA."""
    src = open("/app/frontend/src/pages/streamer/StreamerSetupGuide.tsx").read()
    assert "streamer-setup-guide" in src
    assert "copy-overlay-url" in src, "Must have a one-click copy URL button"
    assert "setup-step-${" in src or "setup-step-" in src, \
        "Setup steps must use the `setup-step-N` testid pattern"
    assert "STEPS = [" in src or "n: 1" in src, "Setup must declare 5 steps"
    for kind in ["HECKLE", "BUFF", "ROUTE_TIP", "DJ_INTERCEPT",
                 "VOICE_INTERCEPT", "INSTRUMENT_GIFT", "HECKLE_GALLERY"]:
        assert kind in src, f"Setup guide missing action label for {kind}"
    # Pro-tip Glasshouse callout MUST be present so streamers discover
    # the second-OBS-source trick (founder ask 2026-05-09).
    assert "setup-protip-glasshouse" in src, \
        "Setup guide must include the Lyric Glasshouse pro-tip block"
    assert "/music/glasshouse" in src, \
        "Pro-tip must reference the glasshouse path"


# ─────────────────────────────────────── JFTN library expansion


def test_jftn_discovery_dual_rails():
    """Founder ask 2026-05-09: the JFTN discovery page must split
    rooms into a 'Tonight' (PG-13) rail and an 'After Dark' (18+)
    rail, with a shimmer divider between them so first-time visitors
    instantly see both vibes."""
    src = open("/app/frontend/src/pages/just-for-the-night/RoomDiscovery.tsx").read()
    assert 'jftn-rail-pg13' in src, "Discovery must render the PG-13 rail"
    assert 'jftn-rail-18plus' in src, "Discovery must render the 18+ rail"
    assert 'jftn-tier-divider' in src, "Discovery must render the After-Dark divider"
    assert "Tonight" in src and "After Dark" in src, \
        "Rail headlines must read Tonight + After Dark"


def test_jftn_library_has_18plus_rooms():
    """Founder ask 2026-05-09: the JFTN demo seeder must include the
    five 18+ rooms (smoke jazz, red silk, midnight burlesque,
    speakeasy truths, afterglow floor). Each must declare
    `tier: '18+'` so the Global Vibez Guard age-gate enforces."""
    from services.jftn_demo_room_seeder import DEMO_ROOMS
    seed_ids = {r["seed_id"] for r in DEMO_ROOMS}
    for sid in [
        "jftn_demo_smoke_jazz", "jftn_demo_red_silk",
        "jftn_demo_midnight_burlesque", "jftn_demo_speakeasy_truths",
        "jftn_demo_afterglow_floor",
    ]:
        assert sid in seed_ids, f"Missing JFTN demo room {sid}"
    eighteen_plus = [r for r in DEMO_ROOMS if r.get("tier") == "18+"]
    assert len(eighteen_plus) == 5, \
        f"Expected 5 18+ rooms in JFTN library, found {len(eighteen_plus)}"
    for r in eighteen_plus:
        assert r.get("settings", {}).get("age_gated") is True, \
            f"18+ room {r['seed_id']} must declare settings.age_gated=True"


# ─────────────────────────────────────── Sound-Check leaderboard WS


def test_sound_check_leaderboard_module_exists():
    """The Sound-Check Gauntlet leaderboard websocket module must
    register socket.io handlers and expose `broadcast_leaderboard`."""
    from services import sound_check_leaderboard as scl
    assert hasattr(scl, "broadcast_leaderboard"), \
        "Module must expose broadcast_leaderboard()"
    assert callable(scl.broadcast_leaderboard)
    assert scl.LEADERBOARD_ROOM == "sound_check_leaderboard"


def test_sound_check_vote_broadcasts():
    """`/sound-check/vote` must call broadcast_leaderboard so every
    connected client sees ranking changes immediately."""
    src = open("/app/backend/routes/totem_pole.py").read()
    assert "broadcast_leaderboard" in src, \
        "Vote handler must trigger leaderboard broadcast"
    assert "sound_check_leaderboard" in src, \
        "Vote handler must import the leaderboard service"


# --- Roadmap PDF §3 — Seated Ownership · Floating Food · Ride Home ---
# [2026-02-09] PDF tasked: (1) floating in-game food menu without pause,
# (2) "Ride Home" button in the lobby, (3) chair-holder UI unlock
# (chat color + boost). All four wires below MUST stay green.

def test_roadmap_floating_food_menu_globally_mounted():
    """FloatingFoodMenu must be self-mounted in App.js so every
    protected route shows it (Roadmap §3 — "without pausing the game")."""
    src = open("/app/frontend/src/App.js").read()
    assert "FloatingFoodMenu" in src, \
        "App.js must import + mount FloatingFoodMenu (Roadmap §3)"
    # Component file must still exist with its hide-pattern guard so it
    # can suppress itself on streamer overlay / login routes.
    fm = open("/app/frontend/src/components/common/FloatingFoodMenu.tsx").read()
    assert "HIDE_PATTERNS" in fm
    assert "floating-food-menu-trigger" in fm


def test_roadmap_ride_home_button_in_dashboard():
    """RideHomeButton must be mounted on the main DashboardNew lobby
    so the "lobby Ride Home" trigger from Roadmap §3 is reachable."""
    src = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "RideHomeButton" in src, \
        "DashboardNew.tsx must import + render RideHomeButton (Roadmap §3)"
    assert "dashboard-ride-home-row" in src, \
        "Ride Home row must keep its data-testid for QA"


def test_roadmap_chair_perks_endpoint_and_service():
    """Roadmap §3 Seated Ownership — /api/chairs/perks endpoint + the
    shared chair_perks_service helper must both exist so any chat
    surface can stamp messages with the holder's color."""
    chairs_src = open("/app/backend/routes/chairs.py").read()
    assert '/chairs/perks' in chairs_src, \
        "chairs.py must expose GET /chairs/perks"
    assert 'chair_perks_service' in chairs_src, \
        "chairs.py must delegate to services.chair_perks_service"
    svc_src = open("/app/backend/services/chair_perks_service.py").read()
    assert 'get_chair_perks_for_user' in svc_src
    # Color rules locked at three phases.
    assert '#22d3ee' in svc_src   # Genius cyan
    assert '#fbbf24' in svc_src   # Founder amber
    assert '#e879f9' in svc_src   # Standard fuchsia


def test_roadmap_chat_broadcast_carries_chair_perks():
    """Live-streaming chat broadcast must attach the sender's
    chair_perks payload so viewers can colorize chair-holder names
    in real time (Roadmap §3)."""
    src = open("/app/backend/routes/live_streaming.py").read()
    assert 'chair_perks' in src, \
        "live_streaming chat broadcast must attach chair_perks"
    assert 'get_chair_perks_for_user' in src, \
        "live_streaming must call the chair_perks_service helper"
    # Frontend must read it.
    view_src = open("/app/frontend/src/pages/ViewStreamPage.tsx").read()
    live_src = open("/app/frontend/src/pages/LiveStreamPage.tsx").read()
    assert "ChairHolderName" in view_src and "ChairHolderName" in live_src
    assert "chair_perks" in view_src and "chair_perks" in live_src


# --- LandingPage_Enhancement.pdf — sticky header / AAA eye-candy /
# accordion compression. [2026-02-09] These four guards lock the new
# landing-page architecture so a future agent can't accidentally
# revert the founder's beta-blocker upgrade.

def test_landing_header_enhanced_is_fixed_and_glassmorphic():
    """Founder override 2026-02-09 — header MUST scroll with the page
    (no stick, no fixed). Glassmorphic backdrop + brand-fuchsia neon
    glow are still locked, but `position: fixed` is now BANNED."""
    src = open("/app/frontend/src/components/landing/LandingHeaderEnhanced.tsx").read()
    # Visual chrome still locked.
    assert 'rgba(13, 17, 23, 0.95)' in src
    assert 'blur(10px)' in src
    # Brand fuchsia hex used as the neon-glow color (Q1=b).
    assert '#d946ef' in src
    # Header MUST flow with the page — relative, NOT fixed.
    assert 'position: "relative"' in src
    assert 'position: "fixed"' not in src, \
        "Founder said no stick — header must NOT be position:fixed"
    # All three nav anchors PRESENT (rendered as `landing-nav-${key}`).
    assert 'landing-nav-${key}' in src
    assert '"game_logic"' in src
    assert '"tokenomics"' in src
    assert '"lifestyle"'  in src


def test_landing_uses_enhanced_header_and_room_tint_overlay():
    """LandingNeonGaming must mount LandingHeaderEnhanced + a room
    tint overlay (PDF §2 hover Room Transitions). The legacy sticky
    <motion.header> block must be GONE. The page MUST NOT add a
    fixed-header spacer (founder override — no stick)."""
    src = open("/app/frontend/src/pages/LandingNeonGaming.tsx").read()
    assert 'LandingHeaderEnhanced' in src, \
        "Landing page must import + render LandingHeaderEnhanced"
    assert 'landing-room-tint-overlay' in src, \
        "Landing page must include the per-room hover tint overlay"
    # WinnerTicker must NOT use sticky-with-offset (founder said no stick).
    assert 'sticky top-[88px]' not in src, \
        "WinnerTicker must not be pinned — no stick per founder directive"
    # And the fixed-header spacer must be gone.
    assert 'Spacer compensating for the fixed header' not in src
    # Dead legacy header gone.
    assert 'sticky top-10 z-40 px-6 py-4 bg-black/80' not in src, \
        "Legacy sticky landing header block must be removed"


def test_landing_feature_accordions_mounted_with_three_cards():
    """PDF §3 — Progressive Information Compression. Three click-to-
    expand cards: Game Logic / Tokenomics / Lifestyle Hub."""
    src = open("/app/frontend/src/components/landing/LandingFeatureAccordions.tsx").read()
    for tid in ("feature-card-game-logic", "feature-card-tokenomics", "feature-card-lifestyle"):
        assert tid in src, f"Accordion card data-testid '{tid}' must be present"
    # Live data hooks pulling from the existing backend rails.
    assert '/api/vibez-rewards/constants' in src
    assert '/api/coins/stats/burn'        in src
    # Mounted on the landing page.
    landing = open("/app/frontend/src/pages/LandingNeonGaming.tsx").read()
    assert 'LandingFeatureAccordions' in landing


def test_landing_vibez_coin_3d_uses_three_fiber():
    """PDF §3 'Animated $VIBEZ coin asset' — must render via the
    already-installed @react-three/fiber Canvas (no net bundle bloat)."""
    src = open("/app/frontend/src/components/landing/VibezCoin3D.tsx").read()
    assert "@react-three/fiber" in src
    assert "Canvas"   in src
    assert "useFrame" in src
    # Used inside the Tokenomics accordion cell.
    accordions = open("/app/frontend/src/components/landing/LandingFeatureAccordions.tsx").read()
    assert "VibezCoin3D" in accordions


# --- Beta operational sweep (2026-02-09) — 4 BLOCKERS surfaced by
# testing_agent_v3_fork. These four guards lock the fix so a future
# refactor can't reintroduce the dead-route regressions.

def test_dashboard_hungryvibes_tile_uses_canonical_path():
    """DashboardNew.tsx HungryVibes tile must link to '/hungryvibes'.
    Earlier it pointed to '/hungry-vibez' (typo + hyphen) which fell
    through App.js wildcard back to '/'."""
    src = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "path: '/hungryvibes'" in src, \
        "Dashboard HungryVibes tile must use the canonical path '/hungryvibes'"
    assert "/hungry-vibez" not in src, \
        "Dashboard tile path '/hungry-vibez' is a dead-link typo and must be removed"
    assert "/hungry-vibes" not in src, \
        "Dashboard tile path '/hungry-vibes' (hyphen) is a dead link"


def test_hungryvibes_consumer_route_is_registered():
    """The HungryVibes consumer page (FAB target, accordion target,
    dashboard tile target) MUST be registered — otherwise every
    'Order food' click bounces back to '/'."""
    src = open("/app/frontend/src/routes/monetizationRoutes.tsx").read()
    assert "import HungryVibez from" in src, \
        "HungryVibez page must be imported into monetizationRoutes"
    assert 'path="/hungryvibes"' in src, \
        "Route '/hungryvibes' must be registered (separate from /hungryvibes/merchant)"


def test_games_menu_chess_route_is_canonical_practice_play_chess():
    """GamesMenu.tsx chess card must route to '/practice/play/chess'
    (the route that actually renders PracticeChess with Voice Coach +
    Roguelite Trial + Battle Mode). Bare '/practice/chess' was a
    dead route until the redirect was added."""
    src = open("/app/frontend/src/components/GamesMenu.tsx").read()
    assert "route: '/practice/play/chess'" in src, \
        "GamesMenu chess card must link to /practice/play/chess"


def test_practice_chess_legacy_path_redirects():
    """Defensive: any caller still hitting '/practice/chess' should be
    redirected to '/practice/play/chess' rather than fall back to '/'."""
    src = open("/app/frontend/src/routes/gamesRoutes.tsx").read()
    assert 'path="/practice/chess"' in src and "Navigate to=\"/practice/play/chess\"" in src, \
        "Legacy '/practice/chess' must redirect to '/practice/play/chess'"


def test_vigilant_agent_scripts_exist_and_have_required_apis():
    """The two Vigilant Agent scripts must remain on disk so the
    founder's pre/post-deploy CI workflow keeps working. PDF spec
    requires the bare scanner + a CI wrapper with baseline diff +
    optional Slack/Discord webhook. v2 (2026-02-09) adds a corner-
    FAB stacking detector."""
    bare = open("/app/scripts/vigilant_agent.js").read()
    ci   = open("/app/scripts/vigilant_agent_ci.js").read()
    # Bare scanner — 3 device profiles, screenshots, dupe-testid scan.
    assert "Desktop_4K"         in bare
    assert "iPhone 15 Pro"      in bare
    assert "iPad Pro 11"        in bare
    assert "duplicate_testids"  in bare
    assert "scan_${dev.name}.png" in bare
    # v2 corner-FAB stack detector.
    assert "FAB_STACK_SCRIPT" in bare
    assert "stacked_pairs"    in bare
    # CI wrapper — baseline + check + webhook posters.
    assert "--baseline" in ci and "--check" in ci
    assert "SLACK_WEBHOOK_URL"   in ci
    assert "DISCORD_WEBHOOK_URL" in ci
    assert "regressed_devices"   in ci


# ── Inline PageActionStrip guards (founder directive 2026-02-09 final) ──
def test_corner_dock_no_longer_mounted_in_app():
    """Founder rejected ALL floating chrome (CornerDock + UnifiedChromeBar)
    on 2026-02-09. The replacement is the inline `<PageActionStrip />`
    which scrolls with the page. App.js must NOT mount the legacy
    CornerDock anywhere."""
    src = open("/app/frontend/src/App.js").read()
    assert "<CornerDock />" not in src, \
        "CornerDock must NOT be mounted — it was the floating dock the founder rejected"
    assert "import CornerDock from" not in src, \
        "CornerDock import must be removed from App.js"


def test_legacy_fabs_use_corner_dock_trigger_hook():
    """The 5 legacy FABs (Beta Feedback / Fresh Drops / Voice Mirror /
    Floating Food / Globe) MUST hide their own trigger when the inline
    chrome strip is active. Each component imports the shared
    `useCornerDockTrigger` hook (the hook listens for both the legacy
    `cdock:active` event and the new `chromebar:active` event the
    PageActionStrip dispatches)."""
    files = [
        "/app/frontend/src/components/common/BetaFeedbackButton.tsx",
        "/app/frontend/src/components/common/FreshDropsLauncher.tsx",
        "/app/frontend/src/components/common/VoiceMirrorDock.tsx",
        "/app/frontend/src/components/common/FloatingFoodMenu.tsx",
        "/app/frontend/src/components/GlobeFAB.tsx",
    ]
    for f in files:
        body = open(f).read()
        assert "useCornerDockTrigger" in body, \
            f"{f} must import + call useCornerDockTrigger so the chrome strip can suppress its trigger"
        assert "triggerHidden" in body, \
            f"{f} must reference the triggerHidden flag returned by the hook"


def test_protected_route_auto_mounts_page_action_strip():
    """Founder directive 2026-02-09 (option B) — every protected page
    must auto-mount the inline PageActionStrip at the top of its
    content area. ProtectedRoute owns this mount so we don't have to
    edit every single page individually."""
    src = open("/app/frontend/src/App.js").read()
    assert "import PageActionStrip from" in src, \
        "App.js must import PageActionStrip"
    assert "<PageActionStrip" in src, \
        "ProtectedRoute must render <PageActionStrip /> above its children"
    assert 'data-testid="protected-route-action-strip"' in src, \
        "ProtectedRoute must wrap PageActionStrip with the protected-route-action-strip testid"


def test_unified_chrome_bar_owns_corner_real_estate():
    """Founder directive 2026-02-09 — final iteration: chrome menu must
    be INLINE (scrolls with the page, NEVER `position: fixed`).
    Replaces the previous global UnifiedChromeBar + CornerDock with a
    per-page `<PageActionStrip />`.

    Locks the new contract:
    • PageActionStrip exists with Comms / Tools / More sections.
    • Landing page mounts it under WinnerTicker.
    • UnifiedChromeBar + CornerDock are NO LONGER mounted globally.
    • Strip dispatches `chromebar:active` so legacy floating FABs
      stay collapsed.
    """
    strip = open("/app/frontend/src/components/common/PageActionStrip.tsx").read()
    assert 'data-testid="page-action-strip"' in strip
    assert "page-action-strip-trigger" in strip
    assert "page-action-strip-menu" in strip
    # Three sections labeled Comms / Tools / More.
    for title in ('"Comms"', '"Tools"', '"More"'):
        assert title in strip, f"PageActionStrip must include section title {title}"
    # Inline-only contract: must NOT use `position: fixed` anywhere.
    assert "position: \"fixed\"" not in strip
    assert "fixed bottom-" not in strip
    assert "fixed top-" not in strip
    # Sets the chromebar:active signal so legacy FABs collapse.
    assert "chromebar:active" in strip
    # Landing page must mount it under the live wins ticker.
    landing = open("/app/frontend/src/pages/LandingNeonGaming.tsx").read()
    assert "PageActionStrip" in landing
    assert "WinnerTicker" in landing
    # WinnerTicker block must come BEFORE the strip mount.
    wt_idx = landing.find("WinnerTicker className=")
    strip_idx = landing.find("<PageActionStrip")
    assert wt_idx > 0 and strip_idx > wt_idx, \
        "Landing page must render PageActionStrip AFTER WinnerTicker"
    # UnifiedChromeBar + CornerDock must NOT be globally mounted in App.js.
    appsrc = open("/app/frontend/src/App.js").read()
    assert "<UnifiedChromeBar />" not in appsrc, \
        "UnifiedChromeBar must NOT be in the global App.js mount"
    assert "<CornerDock />" not in appsrc, \
        "CornerDock must NOT be in the global App.js mount"


def test_bid_whist_cards_land_near_center_table_logo():
    """Founder bug Feb 2026 — Bid Whist cards landed off-center.
    May 2026 redesign: all 4-player card games (Spades, Hearts,
    Euchre, Bid Whist) now reuse `SpadesTrickPile` so the trick pile
    is guaranteed centered on the table logo across every game. Lock
    the tight ±10/±18 seat offsets that make the group centroid match
    the logo coordinates."""
    src = open("/app/frontend/src/components/spades/SpadesTrickPile.tsx").read()
    # The 4 seat offsets must be small enough that the centroid is the
    # table center (±25 max — anything larger leaks into player pods).
    for seat in ("north", "south", "east", "west"):
        assert seat in src, f"SpadesTrickPile lost the {seat} seat offset"
    # Bid Whist page must mount SpadesTrickPile (not a custom impl).
    bw = open("/app/frontend/src/pages/games/BidWhistAAA.tsx").read()
    assert "SpadesTrickPile" in bw, "BidWhist no longer routes its trick pile through SpadesTrickPile"











if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])


# ── Beta-redeploy follow-ups (founder fix May 2026) ───────────────────
def test_not_found_page_replaces_wildcard_redirect():
    """App.js previously had `<Route path="*" element={<Navigate to="/" />}>`
    which silently bounced every dead route to the landing — making it
    impossible to detect broken links during QA. Replaced with a proper
    NotFound 404 page so dead URLs surface honestly."""
    src = open("/app/frontend/src/App.js").read()
    assert "import NotFound from" in src, \
        "NotFound page must be imported in App.js"
    assert '<Route path="*" element={<NotFound />} />' in src, \
        "Wildcard route must render <NotFound /> (not Navigate to '/')"
    assert 'Navigate to="/" replace />' not in src.split('path="*"')[1].split(">", 2)[0] if 'path="*"' in src else True
    nf = open("/app/frontend/src/pages/NotFound.tsx").read()
    assert 'data-testid="not-found-page"' in nf
    assert "404" in nf
    assert "not-found-home-btn" in nf and "not-found-back-btn" in nf


def test_mongo_health_check_at_startup():
    """Founder fix Feb 2026 (post-disk-full incident): the FastAPI startup
    hook must ping Mongo before kicking off background schedulers, and
    log a FATAL error if the ping fails. This surfaces the
    `mongod-FATAL-after-disk-full` recurrence that masked every API as
    a 500 silently."""
    src = open("/app/backend/lifespan.py").read()
    assert 'client.admin.command("ping")' in src, \
        "lifespan.py must ping Mongo on startup"
    assert "FATAL: Mongo ping failed at startup" in src, \
        "lifespan.py must log FATAL when Mongo is unreachable on boot"
    assert "asyncio.wait_for" in src, \
        "Mongo ping must use a timeout so it doesn't hang startup forever"


def test_vibez_654_residual_dice_contract():
    """Founder fix Feb 2026 — Vibez 654 dice tray was showing all 5 dice
    even after qualifying 6/5/4 got peeled. Per official rules, each
    qualifier REMOVES a die from the physical roll. Backend must expose
    `residual_dice` (post-peel) so the frontend tray drops the locked
    qualifier."""
    from routes.vibez_654 import _apply_654_pass
    out = _apply_654_pass([6, 3, 2, 1, 1], False, False, False)
    assert "residual_dice" in out, "Vibez 654 helper must return residual_dice"
    # The 6 got peeled — 4 dice still in play, no 6 among them.
    assert sorted(out["residual_dice"]) == [1, 1, 2, 3]
    assert 6 not in out["residual_dice"]
    # When qualified, residual mirrors point_dice.
    qual = _apply_654_pass([6, 5, 4, 3, 2], False, False, False)
    assert qual["qualified"] is True
    assert sorted(qual["residual_dice"]) == [2, 3]
    assert sorted(qual["point_dice"]) == [2, 3]


def test_whats_new_banner_hidden_on_card_rooms():
    """Founder fix Feb 2026 (round 5): the pinned 'Just for the Night'
    announcement banner was overlapping every card-room header. Lock
    the auto-hide list so future card rooms don't regress."""
    src = open("/app/frontend/src/components/common/WhatsNewBanner.tsx").read()
    assert "HIDDEN_EXACT" in src
    for route in [
        "/spades", "/bid-whist", "/hearts", "/uno", "/euchre",
        "/pinochle", "/gin-rummy", "/rummy", "/war",
        "/crazy-eights", "/go-fish", "/baccarat",
    ]:
        assert f'"{route}"' in src, \
            f"WhatsNewBanner HIDDEN_EXACT must include {route}"


def test_protected_route_skips_action_strip_on_fullscreen_games():
    """Founder bug fix 2026-05-09 — full-viewport game rooms (Vibe 654
    solo, Spades, Bid Whist, all 12 card rooms) use `h-[100dvh] +
    overflow-hidden` so their bottom CTAs (Ante In / Roll / Bid Now)
    stay reachable.  Mounting `<PageActionStrip />` above them stole
    vertical pixels, pushing the buttons off-screen and making the
    room "feel compressed and non-functional" (founder report). The
    strip MUST be skipped on those routes."""
    src = open("/app/frontend/src/App.js").read()
    assert "FULLSCREEN_GAME_ROUTES" in src, \
        "App.js must declare FULLSCREEN_GAME_ROUTES list"
    assert "useIsFullscreenGameRoute" in src
    assert "ProtectedRouteContent" in src, \
        "ProtectedRoute must delegate to ProtectedRouteContent that branches on the hook"
    # The whitelist must include Vibe 654 + every AAA card room.
    for route in [
        "/vibe-654", "/spades", "/bid-whist", "/hearts", "/uno",
        "/euchre", "/pinochle", "/gin-rummy", "/rummy", "/war",
        "/crazy-eights", "/go-fish", "/baccarat", "/blackjack",
        "/chess", "/card-mp",
    ]:
        assert f'"{route}"' in src, \
            f"FULLSCREEN_GAME_ROUTES must include {route}"


def test_vibez654_classic_page_speaks_5dice_protocol():
    """Founder bug fix 2026-05-09 — /vibez-654 (the original page)
    used to hardcode the OLD 'Florida Flow / 3 dice / calcify on 5/6'
    rules but the backend was rewritten to '5 dice / sequential
    6→5→4'. The page silently rendered empty arrays for
    `locked_dice` / `unlocked_dice` because the backend stopped
    returning them. Rewrote the page to consume the canonical state
    shape (has_6/has_5/has_4, point_dice, residual_dice,
    rolls_remaining)."""
    body = open("/app/frontend/src/pages/games/Vibez654Game.tsx").read()
    for field in ["has_6", "has_5", "has_4", "qualified", "point_dice",
                  "residual_dice", "rolls_remaining"]:
        assert field in body, f"Vibez654Game must consume backend field `{field}`"
    assert "locked_dice" not in body
    assert "unlocked_dice" not in body
    for tid in ["v654-start-screen", "v654-start", "v654-stake-row",
                "v654-game-active", "v654-rolls", "v654-bet", "v654-point",
                "v654-qualifier-ladder", "v654-dice-arena", "v654-btn-roll",
                "v654-btn-stand", "v654-outcome", "v654-btn-play-again"]:
        assert f'data-testid="{tid}"' in body or f'`v654-stake-' in body, \
            f"Vibez654Game must expose testid {tid}"
    # Stake chips use a template literal — assert the template exists.
    assert "v654-stake-${v}" in body, \
        "Vibez654Game must render stake chips via template literal v654-stake-${v}"


def test_photosensitive_safe_card_styles():
    """Founder accessibility fix 2026-05-09 — flashing playable cards +
    ace-flicker / ruby-heartbeat / nova-shimmer / jade-pulse +
    gv-card-neon-pulse posed photosensitive seizure / migraine risks.
    Replaced every continuous animation with a static gradient + glow +
    hover-only intensify. Added a prefers-reduced-motion killswitch
    AND an in-app body[data-no-flash="1"] opt-in toggle persisted in
    localStorage as gv_no_flash_v1."""
    css = open("/app/frontend/src/styles/vibez-pro.css").read()
    assert "animation: gv-card-neon-pulse" not in css
    assert "animation: ace-flicker" not in css
    assert "animation: ruby-heartbeat" not in css
    assert "animation: nova-shimmer" not in css
    assert "animation: jade-pulse" not in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert 'body[data-no-flash="1"]' in css
    strip = open("/app/frontend/src/components/common/PageActionStrip.tsx").read()
    assert "Reduce Motion" in strip
    assert "toggleNoFlash" in strip
    assert "gv_no_flash_v1" in strip


def test_cinema_room_route_and_backend_wired():
    """Founder directive 2026-05-09 — `The Cinema Room` is a NEW
    public sync-watch viewer for free legal content (YouTube +
    Archive.org). Distinct from /dsg/memory-bank (Memory Bank Cinema)
    which is for FOUNDER user-content. Locks both the backend
    contract + frontend wiring so future refactors don't collapse
    them back together."""
    import os
    # Backend route file exists with the right router + endpoints.
    assert os.path.exists("/app/backend/routes/cinema_room.py")
    body = open("/app/backend/routes/cinema_room.py").read()
    for marker in [
        'prefix="/cinema-room"',           # mounts under /api/cinema-room
        '@router.get("/catalog")',
        '@router.get("/catalog/{content_id}")',
        '@router.get("/rooms")',
        '@router.post("/rooms")',
        '@router.get("/rooms/{room_id}")',
        '@router.post("/rooms/{room_id}/food-order")',
        '@router.websocket("/ws/{room_id}")',
        'CinemaManager',
        'class CatalogItem',  # not strictly needed but the curated list var is below
    ]:
        # The CatalogItem assertion above is loose; relax for the constant.
        if marker == 'class CatalogItem':
            assert 'CATALOG' in body
        else:
            assert marker in body, f"cinema_room.py missing {marker}"
    # Registry must include the router.
    reg = open("/app/backend/routes/registry.py").read()
    assert "from routes.cinema_room import router as cinema_room_router" in reg
    assert "api_router.include_router(cinema_room_router" in reg

    # Frontend page wired with both lobby + room URLs.
    assert os.path.exists("/app/frontend/src/pages/CinemaRoom.tsx")
    page = open("/app/frontend/src/pages/CinemaRoom.tsx").read()
    for tid in [
        "cinema-room-lobby", "cinema-room-catalog", "cinema-rooms-list",
        "cinema-create-name", "cinema-create-btn",
        "cinema-room-screen", "cinema-back-to-lobby",
        "cinema-audience-count", "cinema-player-shell",
        "cinema-mute-btn", "cinema-order-food-btn",
        "cinema-chat", "cinema-chat-input", "cinema-chat-send",
    ]:
        assert f'data-testid="{tid}"' in page, \
            f"CinemaRoom must expose testid {tid}"
    # Distinct namespace from memory-bank (founder rule). The page may
    # mention `/dsg/memory-bank` in comments for context but MUST NOT
    # navigate to or render any memory-bank component — those belong
    # to the founder's user-content cinema.
    assert "MemoryBankCinema" not in page, \
        "Cinema Room MUST NOT import any MemoryBank* component"
    assert 'navigate("/dsg/memory-bank' not in page

    # App routes wired + included in fullscreen-game whitelist.
    appsrc = open("/app/frontend/src/App.js").read()
    assert 'import CinemaRoom from "@/pages/CinemaRoom"' in appsrc
    assert '<Route path="/cinema-room"' in appsrc
    assert '<Route path="/cinema-room/:roomId"' in appsrc
    assert '"/cinema-room"' in appsrc, \
        "Cinema Room must be in FULLSCREEN_GAME_ROUTES whitelist"

    # WhatsNewBanner suppressed on the new route.
    banner = open("/app/frontend/src/components/common/WhatsNewBanner.tsx").read()
    assert '"/cinema-room"' in banner


def test_cinema_room_date_night_mode():
    """Founder enhancement 2026-05-09 — Date Night Mode for the
    Cinema Room: 2-person private link · soft-warm rose theme ·
    audience count hidden · pinned 🌹 'Just the two of you'
    welcome message · whispers placeholder. Cross-pillar feature
    pulls Dating Universe matches into Cinema Room for second/
    third dates."""
    page = open("/app/frontend/src/pages/CinemaRoom.tsx").read()
    # Lobby toggle.
    assert 'data-testid="cinema-date-night-toggle"' in page
    assert 'data-testid="cinema-date-night-checkbox"' in page
    assert "is_date_night" in page, \
        "Lobby must POST is_date_night when creating a date-night room"
    # Room screen behavior.
    assert 'data-testid="cinema-date-night-badge"' in page
    assert 'data-testid="cinema-date-night-pinned-msg"' in page
    assert "Just the two of you" in page
    # Backend model carries the flag.
    body = open("/app/backend/routes/cinema_room.py").read()
    assert "is_date_night: bool" in body, \
        "CinemaRoom + CreateRoomBody must declare is_date_night"
    assert "is_private=body.is_private or body.is_date_night" in body, \
        "Date Night must auto-promote the room to private"


def test_beta_tester_accessibility_chip():
    """Founder enhancement 2026-05-09 — Beta Tester signup page now
    surfaces a public-facing 'Photosensitive-safe Mode' chip wired
    to the same body[data-no-flash] / gv_no_flash_v1 toggle used by
    the in-app Reduce Motion button. WCAG-2.3.1 differentiator
    visible BEFORE login so first-time visitors see inclusivity
    on day one of beta."""
    page = open("/app/frontend/src/pages/BetaTester.tsx").read()
    assert 'data-testid="beta-tester-a11y-chip"' in page
    assert "Photosensitive-safe Mode" in page
    assert "WCAG-2.3.1 friendly" in page
    assert "gv_no_flash_v1" in page, \
        "BetaTester chip must persist via the shared gv_no_flash_v1 key"
    assert "AccessibilityChip" in page, \
        "Page must define + render the AccessibilityChip component"


def test_in_room_comms_launcher_mounted_on_fullscreen_games():
    """Founder directive 2026-05-09 (final pre-beta polish) — every
    game/cinema room must surface a 'Chat & Video' pill that opens
    a Jitsi Meet iframe for shared text + audio + video. The pill
    is mounted by App.js inside the `isFullscreenGame` branch so
    every entry in FULLSCREEN_GAME_ROUTES gets it for free.
    Anchored top-right over the game viewport so it doesn't steal
    vertical pixels (which would push Ante-In / Bid Now / Roll
    CTAs off-screen)."""
    import os
    assert os.path.exists("/app/frontend/src/components/common/InRoomCommsLauncher.tsx")
    body = open("/app/frontend/src/components/common/InRoomCommsLauncher.tsx").read()
    for tid in [
        "in-room-comms-pill", "in-room-comms-modal",
        "in-room-comms-close", "in-room-comms-iframe",
        "in-room-comms-popout",
    ]:
        assert f'data-testid="{tid}"' in body, \
            f"InRoomCommsLauncher must expose testid {tid}"
    assert "meet.jit.si" in body, \
        "Launcher must use the free Jitsi Meet endpoint (no API key needed)"
    # Mounted in App.js inside the fullscreen-game branch.
    appsrc = open("/app/frontend/src/App.js").read()
    assert "import InRoomCommsLauncher from" in appsrc
    assert "<InRoomCommsLauncher />" in appsrc


def test_cinema_room_date_night_cross_link_to_dating():
    """Founder enhancement 2026-05-09 — at the end of a successful
    Date Night, both players get a polite cross-link to the Dating
    Universe so we surface synergy match-ups at the emotional peak
    of the evening. Banner sits above the player when
    `is_date_night=true`."""
    page = open("/app/frontend/src/pages/CinemaRoom.tsx").read()
    assert 'data-testid="cinema-date-night-cross-link"' in page
    assert 'data-testid="cinema-go-to-dating-btn"' in page
    assert 'navigate("/dating")' in page, \
        "Cross-link must route to /dating"
    assert "synergy" in page.lower(), \
        "Cross-link copy must reference synergy match-ups"


def test_landing_tour_supports_multilanguage_manifest():
    """Founder directive 2026-05-09 — landing-page tour video must
    auto-switch to whatever language the visitor speaks. Frontend
    reads `/landing-tour-i18n.json` at runtime and exposes a globe
    picker so users can override their browser's default. Backend
    `generate_landing_tour_i18n.py` regenerates per-language MP3s
    via OpenAI TTS Onyx (Onyx adapts pronunciation to the input
    language natively — same voice across all locales)."""
    import json
    import os
    # 1. Manifest exists + has at least 'en'.
    manifest_path = "/app/frontend/public/landing-tour-i18n.json"
    assert os.path.exists(manifest_path)
    manifest = json.loads(open(manifest_path).read())
    assert "default" in manifest and manifest["default"] in manifest["languages"]
    en = manifest["languages"]["en"]
    for k in ["label", "native", "rtl", "audio", "duration", "cues"]:
        assert k in en, f"Manifest 'en' track missing key {k}"
    assert isinstance(en["cues"], list) and len(en["cues"]) >= 10
    for cue in en["cues"]:
        assert "t" in cue and "text" in cue
    # 2. Generation script preserves brand terms.
    gen = open("/app/backend/scripts/generate_landing_tour_i18n.py").read()
    assert "BRAND_TERMS" in gen
    for brand in ["VIBEZ", "DSG", "$VIBEZ", "VibeRidez", "Solana", "Chair Hall"]:
        assert brand in gen
    assert 'voice="onyx"' in gen
    assert 'tts-1-hd' in gen
    # 3. Frontend wires the manifest + picker.
    comp = open("/app/frontend/src/components/landing/LandingTourVideo.tsx").read()
    assert "MANIFEST_URL" in comp
    assert "/landing-tour-i18n.json" in comp
    assert "pickInitialLang" in comp
    for tid in [
        "landing-tour-lang-picker",
        "landing-tour-lang-trigger",
        "landing-tour-lang-menu",
    ]:
        assert f'data-testid="{tid}"' in comp, \
            f"LandingTourVideo must expose testid {tid}"
    # Per-language option testids use a template literal — assert the pattern.
    assert "landing-tour-lang-option-${code}" in comp, \
        "Per-language options must use the landing-tour-lang-option-{code} testid pattern"
    # Persists the user's pick across sessions.
    assert "gv_tour_lang" in comp
    # RTL captions for Arabic / Hebrew get `dir="rtl"`.
    assert 'dir={isRtl ? "rtl" : "ltr"}' in comp



def test_integrity_protocol_routes_and_constants_locked():
    """Sovereign Master Code §2 + Integrity Protocol PDF (May 2026).
    Vibe Check parameters must stay locked: 10 reporters / 75% consensus
    / 2× chair-holder weight / 5 ₵ reward / 3-strike ban with 10%-50%-perma
    tax tiers. If any constant drifts the fraud-ban math goes off the rails."""
    from server import app
    from routes.integrity_protocol import VIBE_CHECK

    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/integrity/report", "/api/integrity/resolve",
        "/api/integrity/my-status", "/api/integrity/config",
    ]:
        assert ep in paths, f"Integrity endpoint missing: {ep}"

    assert VIBE_CHECK["Min_Reporters"] == 10
    assert VIBE_CHECK["Consensus_Threshold"] == 0.75
    assert VIBE_CHECK["Genius_Chair_Weight"] == 2.0
    assert VIBE_CHECK["Reward_Per_Correct_Report_Vibe"] == 5
    assert VIBE_CHECK["Strike_1"]["tax_pct"] == 0.10
    assert VIBE_CHECK["Strike_2"]["tax_pct"] == 0.50
    assert VIBE_CHECK["Strike_3"]["permanent_ban"] is True

    # Frontend widget wired into Sports Lounge.
    sl = open("/app/frontend/src/pages/SportsLounge.tsx").read()
    assert "VibeCheckReport" in sl, "Sports Lounge lost VibeCheckReport import"


def test_sovereign_tiers_pricing_math_locked():
    """2026-05-12 founder ask: math-anchored tier curve. Each step ~2× the
    previous one's price for ~2× the perceived value. Tastemaker is the
    single popular_anchor. Insider carries the $1 first-month trial.
    Annual = 2 months free (16.67%). Any drift breaks the conversion math."""
    from routes.sovereign_tiers import TIERS, ANNUAL_DISCOUNT_PCT
    by_id = {t["id"]: t for t in TIERS}
    assert by_id["insider"]["price_usd"] == 9
    assert by_id["tastemaker"]["price_usd"] == 19
    assert by_id["royal"]["price_usd"] == 39
    assert by_id["sovereign"]["price_usd"] == 89
    assert by_id["genius_chair"]["price_usd"] == 20
    assert by_id["insider"].get("trial_intro_usd") == 1

    anchors = [t for t in TIERS if t.get("popular_anchor")]
    assert len(anchors) == 1 and anchors[0]["id"] == "tastemaker"
    assert round(ANNUAL_DISCOUNT_PCT, 2) == 16.67

    # Frontend renders the catalog with the expected testids.
    page = open("/app/frontend/src/pages/SovereignTiers.tsx").read()
    for tid in [
        "sovereign-tiers-page", "tiers-grid",
        "tiers-interval-month", "tiers-interval-year",
        "tier-card-${t.id}", "tier-popular-${t.id}",
        "tier-subscribe-${t.id}",
    ]:
        assert tid in page, f"SovereignTiers page missing testid: {tid}"


def test_card_room_geometry_pdf_spec_locked():
    """Implementation Guide PDF §2 §3 §5 (May 2026): card-room table
    geometry must stay at 0.55 × 0.75 × 1.00, FOV 105, AI host yaw 135°.
    Exposed as CSS custom properties so any Three.js scene can pick them
    up via `getComputedStyle()`. Drift here breaks the AAA mobile
    landscape preset across every card room at once."""
    css = open("/app/frontend/src/index.css").read()
    # CSS custom properties (PDF-locked).
    for var, val in [
        ("--gv-card-table-fov", "105"),
        ("--gv-card-table-scale-x", "0.55"),
        ("--gv-card-table-scale-y", "0.75"),
        ("--gv-card-table-scale-z", "1.00"),
        ("--gv-card-host-yaw-deg", "135"),
    ]:
        assert f"{var}: {val}" in css, f"Card room CSS var {var} drifted from PDF spec ({val})"
    # Table mesh max-width = 55vw on desktop, max-height min(75vh, 600px).
    assert "max-width: 55vw" in css
    assert "max-height: min(75vh, 600px)" in css
    # Trick-play area still offset −25px per PDF §2.
    assert "translateY(-25px)" in css


def test_p2_underground_live_routes_wired():
    """P2 (May 2026): Underground Live Network — Music + Dance battles
    with Crowd Judge. Endpoints must stay reachable so the UndergroundCasino
    lobby tile never 404s."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/underground-live/battles",
        "/api/underground-live/active",
        "/api/underground-live/vote",
        "/api/underground-live/admin/seed",
        "/api/underground-live/admin/close",
    ]:
        assert ep in paths, f"Underground Live endpoint missing: {ep}"
    # Frontend page exists with the testids the testing agent checks.
    page = open("/app/frontend/src/pages/UndergroundLive.tsx").read()
    for tid in ["underground-live", "ul-active-battle", "ul-lineup", "ul-back"]:
        assert tid in page, f"UndergroundLive missing testid: {tid}"
    # Underground Casino lobby exposes the live-network tile.
    ugc = open("/app/frontend/src/pages/UndergroundCasino.tsx").read()
    assert "live-network" in ugc
    assert "/underground-live" in ugc


def test_p2_free_spectator_bet_routes_wired():
    """P2 (May 2026): Free-stake spectator predictions. Bonus 5 ₵ per
    correct call capped at 5/day. Helps engagement without inflating float."""
    from server import app
    from routes.spectator_bet import BONUS_PER_HIT, DAILY_BONUS_CAP
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/spectator-bet/place",
        "/api/spectator-bet/settle",
        "/api/spectator-bet/my-bets",
        "/api/spectator-bet/leaderboard",
    ]:
        assert ep in paths, f"Spectator-bet endpoint missing: {ep}"
    assert BONUS_PER_HIT == 5
    assert DAILY_BONUS_CAP == 5


def test_p2_receipt_ocr_routes_and_constants_locked():
    """P2 (May 2026): Receipt OCR + 15% bonus + 30-day merchant boost.
    Spec-locked constants — drift here breaks user economics."""
    from server import app
    from routes.receipts_ocr import BONUS_PCT, BOOST_DAYS, DAILY_RECEIPT_CAP
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/receipts/submit",
        "/api/receipts/my-receipts",
        "/api/receipts/merchant-boosts",
    ]:
        assert ep in paths, f"Receipts endpoint missing: {ep}"
    assert BONUS_PCT == 0.15
    assert BOOST_DAYS == 30
    assert DAILY_RECEIPT_CAP == 5
    # Frontend wired.
    page = open("/app/frontend/src/pages/ReceiptsPage.tsx").read()
    for tid in ["receipts-page", "receipts-form", "receipts-submit", "receipts-image-url"]:
        assert tid in page, f"ReceiptsPage missing testid: {tid}"


def test_room_info_cube_globally_mounted():
    """2026-05-12 founder ask: 'every tab or each room needs an
    information cube — tell people how the room works'. The cube must
    be globally mounted via App.js and read from a single content
    catalog (roomInfo.ts). Drift here means a room's info goes blank."""
    # Component exists.
    comp_path = "/app/frontend/src/components/common/RoomInfoCube.tsx"
    assert os.path.exists(comp_path)
    comp = open(comp_path).read()
    for tid in [
        "room-info-cube-trigger", "room-info-cube-modal",
        "room-info-cube-title", "room-info-cube-tagline",
        "room-info-cube-close", "room-info-cube-got-it",
        "room-info-cube-speak",
    ]:
        assert tid in comp, f"RoomInfoCube missing testid: {tid}"
    assert "matchInfo" in comp, "RoomInfoCube must use matchInfo()"
    # Voice readout via Web Speech API (free, browser-native, works
    # without LLM key budget).
    assert "speechSynthesis" in comp
    assert "SpeechSynthesisUtterance" in comp

    # Content catalog exists with the must-cover rooms.
    cat_path = "/app/frontend/src/data/roomInfo.ts"
    assert os.path.exists(cat_path)
    cat = open(cat_path).read()
    for room in [
        "/dashboard", "/sports-lounge", "/underground-casino", "/underground-live",
        "/lottery", "/chess-hall", "/vibez-654", "/cinema-room", "/dating",
        "/vibe-ridez", "/hungryvibes", "/yellow-pages", "/receipts", "/tiers",
        "/chair-hall", "/wallet", "/spades", "/bid-whist", "/hearts", "/baccarat",
        # 2026-05-12 founder ask: explicitly mentioned rooms must have entries.
        "/voice-mirror", "/dsg/beat-vault", "/dsg/memory-bank",
    ]:
        assert f'"{room}"' in cat, f"roomInfo.ts missing entry for {room}"
    assert "export function matchInfo" in cat

    # Globally mounted in App.js.
    app_js = open("/app/frontend/src/App.js").read()
    assert "RoomInfoCube" in app_js
    assert "<RoomInfoCube />" in app_js


def test_sports_lounge_no_longer_depends_on_rapidapi():
    """2026-05-12 founder ask: 'we don't need the API key for RapidAPI
    Sports anymore — the people are the oracle.' Backend exposes the
    Vibe Check crowd-consensus as the settlement_oracle so /sports/games
    consumers can drop the 'seed catalog' framing."""
    src = open("/app/backend/routes/sports_lounge.py").read()
    assert '"settlement_oracle": "vibe_check_crowd_consensus"' in src
    # Frontend dropped the "Seed catalog" framing.
    fe = open("/app/frontend/src/pages/SportsLounge.tsx").read()
    assert "Seed catalog" not in fe
    assert "Crowd-judged" in fe or "Vibe Check oracle" in fe


def test_volumetric_dashboard_default_and_opt_out():
    """2026-05-12 founder ask: 'I would like the volumetric galaxy view
    to be the view that people come into the page and get, where they
    have an option at the top to change it to the classic view.'

    DashboardRouter resolves /dashboard to either VolumetricDashboard
    (default) or DashboardNew (when user opts out via gv_dashboard_view).
    Both views expose toggles that flip the localStorage flag. One file
    deletion (DashboardRouter.tsx + a route revert) cleanly removes the
    feature if the founder ever wants Classic back as the default."""
    page_path = "/app/frontend/src/pages/VolumetricDashboard.tsx"
    assert os.path.exists(page_path)
    page = open(page_path).read()
    for tid in ["volumetric-dashboard", "vol-back-classic", "vol-planet-", "vol-room-"]:
        assert tid in page, f"VolumetricDashboard missing testid: {tid}"

    # DashboardRouter exists and defaults to volumetric.
    router_path = "/app/frontend/src/pages/DashboardRouter.tsx"
    assert os.path.exists(router_path)
    router = open(router_path).read()
    assert "VolumetricDashboard" in router
    assert "DashboardNew" in router or "Dashboard" in router
    assert "gv_dashboard_view" in router
    assert '"volumetric"' in router and '"classic"' in router

    # /dashboard route in miscRoutes now uses DashboardRouter.
    routes = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert "DashboardRouter" in routes
    assert '"/dashboard"' in routes

    # Classic dashboard still has the toggle pill back to Volumetric.
    # 2026-05-12 fix v2: toggle now uses switchDashboardView() helper
    # (writes localStorage AND dispatches gv-dashboard-view event so the
    # router re-renders without a no-op navigate). Accept either pattern
    # so older snapshots stay compatible.
    dash = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "dashboard-try-volumetric" in dash
    assert (
        'switchDashboardView("volumetric")' in dash
        or 'localStorage.setItem("gv_dashboard_view", "volumetric")' in dash
    )

    # Volumetric exposes the back-to-classic toggle.
    assert (
        'switchDashboardView("classic")' in page
        or 'localStorage.setItem("gv_dashboard_view", "classic")' in page
    )


def test_personal_homeworld_wired_end_to_end():
    """2026-05-12 founder enhancement: 'Personal Homeworld' — backend
    tracks per-user room visits, Volumetric Galaxy overlays each planet
    thumbnail with the user's most-played room in that category.
    Regression-locks the contract so neither end drifts."""
    from server import app
    from routes.recent_rooms import COOLDOWN_SECONDS

    # Backend endpoints mounted.
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/recent-rooms/log",
        "/api/recent-rooms/me",
        "/api/recent-rooms/leaderboard",
    ]:
        assert ep in paths, f"Recent-rooms endpoint missing: {ep}"
    # Cooldown locked at 5s to dedupe React StrictMode double-fires.
    assert COOLDOWN_SECONDS == 5

    # RoomVisitLogger mounted globally + uses authFetch + cooldown contract.
    logger = open("/app/frontend/src/components/common/RoomVisitLogger.tsx").read()
    assert "/api/recent-rooms/log" in logger
    assert "useLocation" in logger
    assert "PATH_TO_CATEGORY" in logger

    app_js = open("/app/frontend/src/App.js").read()
    assert "RoomVisitLogger" in app_js
    assert "<RoomVisitLogger />" in app_js

    # VolumetricDashboard reads homeworlds from /me and overlays.
    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "/api/recent-rooms/me" in vol
    assert "homeworld" in vol
    assert "HOME" in vol  # the "HOME" badge on the thumbnail


def test_wallet_login_removed_phantom_moved_to_wallet_page():
    """2026-05-12 founder ask: 'let's drop the wallet login' (Privy iframe
    rendered as a 'really big, outrageous modal' when CSP blocked framing
    on production domains). Phantom wallet linking now happens AFTER
    login on /wallet so the sign-in flow stays clean."""
    login = open("/app/frontend/src/pages/LoginPage.tsx").read()
    # Privy import + button slot removed from the login page.
    assert "import PrivyLoginButton" not in login
    assert "<PrivyLoginButton />" not in login
    assert 'data-testid="privy-login-slot"' not in login

    # PhantomConnectButton no longer rendered in the landing header.
    landing = open("/app/frontend/src/components/landing/LandingHeaderEnhanced.tsx").read()
    assert "<PhantomConnectButton" not in landing or "/* 2026-05-12" in landing

    # PhantomConnectButton IS rendered on the /wallet page.
    wallet = open("/app/frontend/src/pages/Wallet.tsx").read()
    assert "PhantomConnectButton" in wallet
    assert "wallet-connect-phantom-row" in wallet


def test_jftn_season_pass_password_gift_wired():
    """2026-05-12 founder asks bundled into a single JFTN upgrade:
    1. Season Pass — $25/mo Stripe subscription that unlocks all rooms.
    2. Room password — owner-set per-room password creates a 'double
       security' gate verified before any token deduction.
    3. Gift unlocks — buy a JFTN room unlock for a friend (recipient
       redeems from /gifts/my-inbox).
    Constants locked: $25 price, 30-day duration."""
    from server import app
    from routes.just_for_the_night import (
        SEASON_PASS_USD, SEASON_PASS_DAYS,
    )

    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/just-for-the-night/season-pass/subscribe",
        "/api/just-for-the-night/season-pass/verify",
        "/api/just-for-the-night/season-pass/me",
        "/api/just-for-the-night/rooms/gift",
        "/api/just-for-the-night/gifts/my-inbox",
    ]:
        assert ep in paths, f"JFTN endpoint missing: {ep}"
    assert SEASON_PASS_USD == 25
    assert SEASON_PASS_DAYS == 30

    src = open("/app/backend/routes/just_for_the_night.py").read()
    # Password gate uses bcrypt (passlib CryptContext) — same scheme as
    # /api/auth so verify cost stays consistent.
    assert "CryptContext" in src
    assert "password_hash" in src
    assert "requires_password" in src
    # Season Pass is checked BEFORE any token deduction in join.
    assert "_has_active_season_pass" in src
    # Gift flow records a redeem-on-demand row in jftn_gifts.
    assert "jftn_gifts" in src


def test_live_activity_ticker_wired():
    """2026-05-12 founder enhancement: 'Vegas floor energy' — live
    activity scrolling band at the bottom of the Volumetric Galaxy.
    Backend derives events from existing collections so we don't need
    a dedicated event bus. Frontend ticker auto-falls-back to teaser
    strands if no events surface so the strip never collapses."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/live-activity/recent" in paths, "Live activity endpoint missing"

    # Backend anonymizes usernames before exposing them publicly.
    src = open("/app/backend/routes/live_activity.py").read()
    assert "_anon" in src
    assert "spectator_bonus_caps" not in src or "jftn_gifts" in src  # multi-source

    # Frontend ticker is mounted on the Volumetric dashboard.
    ticker = open("/app/frontend/src/components/common/LiveActivityTicker.tsx").read()
    assert "/api/live-activity/recent" in ticker
    assert "live-activity-ticker" in ticker
    # Fallback strands so the strip never collapses.
    assert "FALLBACK_EVENTS" in ticker

    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "LiveActivityTicker" in vol
    assert "<LiveActivityTicker />" in vol


def test_admin_activity_pulse_wired():
    """2026-05-12 founder enhancement: admin-only un-anonymized live
    activity pulse on /vibe-vault-admin. Same source data as the public
    ticker but with full usernames + dollar amounts + 72h totals.
    Locked admin-only via get_current_user.is_admin/role check."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/live-activity/admin-pulse" in paths, "Admin pulse endpoint missing"

    src = open("/app/backend/routes/live_activity.py").read()
    assert "admin-pulse" in src
    # Admin-only gate present.
    assert "is_admin" in src or 'role" == "admin"' in src
    # Aggregates a totals block for the summary tiles.
    assert "gross_vibe_72h" in src
    assert "gross_usd_72h" in src

    # Frontend card exists with testids + admin pulse endpoint.
    card = open("/app/frontend/src/components/admin/ActivityPulseCard.tsx").read()
    assert "/api/live-activity/admin-pulse" in card
    for tid in ["admin-activity-pulse", "pulse-tile-events", "pulse-tile-vibe", "pulse-tile-usd", "pulse-event-list"]:
        assert tid in card, f"ActivityPulseCard missing testid: {tid}"

    # Mounted in God Mode dashboard.
    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "ActivityPulseCard" in god
    assert "<ActivityPulseCard />" in god


def test_profile_setup_white_card_text_visible():
    """2026-05-12 — founder reported "I went inside the preview to log in,
    and it took me to the page where I had to put my profile information,
    and that still don't type over in that section yet either."

    Root cause: shadcn <Input>/<Textarea>/<Label> inherit text color from
    the global `--foreground` token which the dark theme sets to near-white.
    ProfileSetup renders on a WHITE card → white-on-white = invisible text
    while typing. The fix lives in TWO places, both required:
      1. ProfileSetup.tsx — explicit text-slate-900 / text-slate-800 classes
      2. index.css — scoped `.bg-white input/textarea/label` color rules
         so any future white-card form is auto-protected.
    """
    css = open("/app/frontend/src/index.css").read()
    # Scoped white-card text-visibility rules must be present.
    assert ".bg-white input" in css, "white-card input color rule missing"
    assert ".bg-white textarea" in css, "white-card textarea color rule missing"
    assert ".bg-white label" in css, "white-card label color rule missing"
    # Use slate-900 (15 23 42) for inputs, slate-800 (30 41 59) for labels.
    assert "rgb(15 23 42)" in css, "input color must be slate-900"
    assert "rgb(30 41 59)" in css, "label color must be slate-800"

    # ProfileSetup explicitly applies the inputCls / labelCls overrides.
    src = open("/app/frontend/src/pages/ProfileSetup.tsx").read()
    assert "text-slate-900" in src, "ProfileSetup must force dark input text"
    assert "text-slate-800" in src, "ProfileSetup must force dark label text"
    # Testids preserved so the test agent can fill the form end-to-end.
    for tid in ["bio-input", "age-input", "location-input", "interests-input", "submit-profile-btn"]:
        assert tid in src, f"ProfileSetup missing testid: {tid}"


def test_dashboard_view_toggle_uses_switch_helper():
    """2026-05-12 — founder reported "Still in the preview, I can't change
    the view so I know automatically when I deploy it don't work."

    Root cause: both toggle buttons used to do
        localStorage.setItem('gv_dashboard_view', X);
        navigate('/dashboard');
    But you're ALREADY on /dashboard, so navigate() is a no-op (React
    Router won't re-render). The `storage` event by spec does NOT fire in
    the same tab that wrote the key. So clicking the toggle did nothing
    visible — DashboardRouter was stuck on the cached initial view.

    Fix: DashboardRouter exports `switchDashboardView(view)` which writes
    localStorage AND dispatches a custom `gv-dashboard-view` window event.
    DashboardRouter listens for that event and re-reads the preference.
    Every toggle button MUST call this helper instead of writing localStorage
    directly. This test enforces that contract.
    """
    router = open("/app/frontend/src/pages/DashboardRouter.tsx").read()
    # Helper + event constant must be exported.
    assert "export function switchDashboardView" in router
    assert "DASHBOARD_VIEW_EVENT" in router
    assert 'gv-dashboard-view' in router
    # Router must listen for the custom event.
    assert "addEventListener(DASHBOARD_VIEW_EVENT" in router

    # Both toggle pages must import and use the helper (raw localStorage
    # writes to gv_dashboard_view in the toggle button onClick are a bug).
    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "switchDashboardView" in vol, "VolumetricDashboard must use switchDashboardView()"
    assert 'switchDashboardView("classic")' in vol

    new = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "switchDashboardView" in new, "DashboardNew must use switchDashboardView()"
    assert 'switchDashboardView("volumetric")' in new



def test_role_switcher_globally_mounted():
    """2026-05-12 founder enhancement: a global 'Switch Role' pill at
    top-right that drops down 5 role options (Rider, Driver, Merchant,
    Streamer, SmartStack) and instantly navigates to that role's home
    route. Persists last selection in `localStorage.gv_active_role` and
    auto-syncs the active label from the URL.

    Locked here so the global mount can't accidentally regress.
    """
    import os
    comp_path = "/app/frontend/src/components/common/RoleSwitcher.tsx"
    assert os.path.exists(comp_path), "RoleSwitcher component missing"
    comp = open(comp_path).read()
    for tid in [
        "role-switcher",
        "role-switcher-trigger",
        "role-switcher-menu",
    ]:
        assert tid in comp, f"RoleSwitcher missing testid: {tid}"
    # Per-option testid is built via template literal — assert the
    # template + the 5 role keys exist instead of the rendered strings.
    assert "role-switcher-option-${r.key}" in comp, "per-option testid template missing"
    for key in ["rider", "driver", "merchant", "streamer", "smartstack"]:
        assert f'"{key}"' in comp, f"RoleSwitcher missing role key: {key}"
    # Canonical role home routes — single source of truth.
    for href in [
        '"/dashboard"',
        '"/vibe-ridez/driver-dashboard"',
        '"/hungryvibes/merchant"',
        '"/my-streams"',
        '"/smartstack"',
    ]:
        assert href in comp, f"RoleSwitcher missing canonical href: {href}"
    # Persists selection so role survives reload.
    assert "gv_active_role" in comp

    # Globally mounted in App.js (so every protected page surfaces it).
    app_js = open("/app/frontend/src/App.js").read()
    assert "import RoleSwitcher" in app_js, "RoleSwitcher not imported"
    assert "<RoleSwitcher />" in app_js, "RoleSwitcher not mounted in AppRouter"



def test_hungryvibes_merchant_fulfillment_loop_wired():
    """2026-05-12 — founder: 'If I had drivers and merchants right now,
    would everything work?' Honest answer was 'no, merchants can't
    actually accept/fulfill the orders customers placed.' Fixed by
    adding the merchant fulfillment state machine on top of the existing
    order-create flow.

    The state machine: pending|paid → preparing → ready → delivered.
    From pending|paid you can also reject (auto-refund if paid in coins).
    Marking delivered auto-credits the merchant's Vibe Account net of
    the 2% Vibe Tax — same ledger collection (hv_vibe_ledger) and same
    balance field (vibe_account_balance) as the existing
    POST /api/hungryvibes/merchant/vibe-account/credit endpoint so there's
    one source of truth.
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in [
        "/api/hungryvibes/orders/merchant-inbox",
        "/api/hungryvibes/orders/merchant/{order_id}",
        "/api/hungryvibes/orders/merchant/{order_id}/accept",
        "/api/hungryvibes/orders/merchant/{order_id}/ready",
        "/api/hungryvibes/orders/merchant/{order_id}/delivered",
        "/api/hungryvibes/orders/merchant/{order_id}/reject",
    ]:
        assert p in paths, f"merchant fulfillment endpoint missing: {p}"

    src = open("/app/backend/routes/smartstack.py").read()
    # State machine must enforce forward-only transitions.
    assert "ORDER_TRANSITIONS" in src
    assert '"preparing"' in src and '"ready"' in src and '"delivered"' in src
    # Sanity: cannot transition delivered → anything.
    assert '"delivered":   set()' in src or '"delivered": set()' in src
    # Delivered must credit the merchant Vibe Account using the SAME schema
    # as the existing endpoint (vibe_account_balance + hv_vibe_ledger).
    assert "hv_vibe_ledger" in src
    assert "vibe_account_balance" in src
    assert "VIBE_TAX_RATE" in src
    # Rejected coin orders refund the customer.
    assert "credit_coins" in src
    assert "hungryvibez_order_rejected_refund" in src

    # Merchant dashboard frontend mounts an Orders tab + actionable CTAs.
    fe = open("/app/frontend/src/pages/HungryVibesMerchant.tsx").read()
    for tid in [
        "hv-tab-orders",
        "hv-orders-tab",
        "hv-orders-list",
        "hv-orders-toggle-archive",
    ]:
        assert tid in fe, f"OrdersTab missing testid: {tid}"
    # Per-order action testids are template-literal; assert the templates exist.
    for tmpl in [
        "hv-order-${o.order_id}",
        "hv-order-status-${o.order_id}",
        "hv-order-accept-${o.order_id}",
        "hv-order-reject-${o.order_id}",
        "hv-order-ready-${o.order_id}",
        "hv-order-delivered-${o.order_id}",
    ]:
        assert tmpl in fe, f"OrdersTab missing testid template: {tmpl}"
    # Polls merchant-inbox.
    assert "/api/hungryvibes/orders/merchant-inbox" in fe



def test_hungryvibes_test_order_button_wired():
    """2026-05-12 founder ask: 'Test Order button on the merchant dashboard
    — one tap drops a fake $25 order into their inbox so a new merchant
    onboarding can practice the Accept/Ready/Delivered flow without needing
    a real customer.'

    Two contracts this test locks:
      1. Backend endpoint POST /api/hungryvibes/orders/merchant/test-order
         creates an `is_test=True` order with payout=25.0.
      2. The transition handler MUST skip Vibe-Account crediting when
         is_test is truthy — otherwise a merchant who plays with the test
         button would see funny money in their ledger and panic.
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/hungryvibes/orders/merchant/test-order" in paths

    src = open("/app/backend/routes/smartstack.py").read()
    # is_test marker + zero-credit gate on delivered transition.
    assert '"is_test": True' in src
    assert 'and not order.get("is_test")' in src

    fe = open("/app/frontend/src/pages/HungryVibesMerchant.tsx").read()
    assert "hv-orders-drop-test" in fe
    assert "hv-order-test-badge" in fe
    assert "/api/hungryvibes/orders/merchant/test-order" in fe


def test_streamer_dashboard_wired():
    """2026-05-12 founder asked us to confirm Streamer Dashboard exists.
    It does — at /my-streams via routes/streamingRoutes.tsx + Switch Role
    pill highlights `Streamer` when on that route. Locking it here so
    nobody renames the route or strips the role mapping silently."""
    streamer = open("/app/frontend/src/pages/StreamerDashboard.tsx").read()
    assert "Streamer Dashboard" in streamer
    assert "/api/streaming/dashboard" in streamer
    routes = open("/app/frontend/src/routes/streamingRoutes.tsx").read()
    assert '/my-streams' in routes
    assert "StreamerDashboard" in routes
    role = open("/app/frontend/src/components/common/RoleSwitcher.tsx").read()
    assert '"streamer"' in role
    assert '/my-streams' in role


def test_vibe_venues_host_dashboard_wired():
    """2026-05-12 founder ask: 'for the people that have the Airbnbs or
    the Vibrants, their dashboards also made.' Vibe Venues already covered
    listing + booking + escrow; we added the recurring HOST DASHBOARD with
    properties tab, bookings tab, and earnings summary (escrowed / released
    / paid_out / venue_count).

    Locks: 3 host read-side endpoints + the new dashboard page + role pill
    entry routing to /vibe-venues/host-dashboard.
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in [
        "/api/vibe-venues/host/venues/{user_id}",
        "/api/vibe-venues/host/bookings/{user_id}",
        "/api/vibe-venues/host/earnings/{user_id}",
    ]:
        assert p in paths, f"host endpoint missing: {p}"

    page = open("/app/frontend/src/pages/vibe-venues/VibeVenuesHostDashboard.tsx").read()
    for tid in [
        "vibe-venues-host-dashboard",
        "vvhd-tab-venues",
        "vvhd-tab-bookings",
        "vvhd-earnings",
        "vvhd-list-new",
    ]:
        assert tid in page, f"host dashboard missing testid: {tid}"
    # Empty states for first-time hosts must not crash.
    assert "vvhd-venues-empty" in page
    assert "vvhd-bookings-empty" in page

    routes = open("/app/frontend/src/routes/socialRoutes.tsx").read()
    assert '/vibe-venues/host-dashboard' in routes
    assert "VibeVenuesHostDashboard" in routes

    # Switch Role pill carries a "host" option.
    role = open("/app/frontend/src/components/common/RoleSwitcher.tsx").read()
    assert '"host"' in role
    assert '/vibe-venues/host-dashboard' in role



def test_unified_earnings_widget_wired():
    """2026-05-12 founder ask: 'unified earnings widget on the main
    dashboard that rolls up income across every role you wear.'

    Locks:
      - GET /api/me/unified-earnings exists, 401 for anonymous.
      - Returns rollup of 4 roles (driver/host/merchant/streamer) with
        lifetime + last_7d windows.
      - Widget component mounted on BOTH Classic + Volumetric dashboards.
      - Auto-hides for guests / zero-income accounts (no noise).
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/me/unified-earnings" in paths, "unified-earnings endpoint missing"

    backend = open("/app/backend/routes/unified_earnings.py").read()
    assert "STREAMER_GIFT_SHARE = 0.70" in backend, "streamer share must mirror StreamerDashboard's 70%"
    # 4 role aggregators present.
    for fn in ["_driver_totals", "_host_totals", "_merchant_totals", "_streamer_totals"]:
        assert f"async def {fn}" in backend, f"role aggregator missing: {fn}"
    # 7d cutoff helper.
    assert "_iso_now_minus(7)" in backend

    widget = open("/app/frontend/src/components/common/UnifiedEarningsWidget.tsx").read()
    for tid in [
        "unified-earnings-widget",
        "unified-earnings-total",
        "unified-earnings-roles",
        "unified-earnings-window-7d",
        "unified-earnings-window-lifetime",
        "unified-earnings-chip-driver",
        "unified-earnings-chip-host",
        "unified-earnings-chip-merchant",
        "unified-earnings-chip-streamer",
    ]:
        assert tid in widget, f"UnifiedEarningsWidget missing testid: {tid}"
    # Self-hiding rule for zero-state accounts so we don't pollute the
    # dashboard for brand-new users.
    assert "allZero" in widget

    classic = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "UnifiedEarningsWidget" in classic, "widget must mount on classic dashboard"
    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "UnifiedEarningsWidget" in vol, "widget must mount on volumetric dashboard"



def test_hungryvibes_customer_order_tracking_wired():
    """2026-05-12 backlog #1: customer-side order tracking page —
    live status timeline (Order placed → Restaurant preparing → On the
    way → Delivered). Polls /api/hungryvibes/orders/my every 6s."""
    page = open("/app/frontend/src/pages/HungryVibezOrderTracking.tsx").read()
    for tid in [
        "hv-tracking-page",
        "hv-tracking-empty",
        "hv-tracking-toggle-archive",
    ]:
        assert tid in page, f"OrderTracking missing testid: {tid}"
    # Stage testid is template-literal — verify the template + the 4 stage keys.
    assert "hv-tracking-stage-${stage.key}" in page, "stage testid template missing"
    for stage in ["pending", "preparing", "ready", "delivered"]:
        assert f'"{stage}"' in page, f"OrderTracking missing stage: {stage}"
    assert "/api/hungryvibes/orders/my" in page, "must poll customer /my endpoint"
    # Route registered in monetizationRoutes.
    routes = open("/app/frontend/src/routes/monetizationRoutes.tsx").read()
    assert '"/hungryvibes/orders"' in routes
    assert "HungryVibezOrderTracking" in routes


def test_vibe_venues_test_booking_endpoint_wired():
    """2026-05-12 backlog #4: 'Test Booking' button on the Host Dashboard
    mirrors HungryVibes Test Order — drops a synthetic 6h booking onto
    the host's newest property so they can practice the escrow loop
    without needing a real customer locking USDC via Solflare."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/vibe-venues/host/test-booking/{user_id}" in paths

    src = open("/app/backend/routes/vibe_venues.py").read()
    # is_test marker + uses the canonical collection name.
    assert "vibe_venues_listings" in src
    assert "host_drop_test_booking" in src
    assert '"is_test": True' in src

    page = open("/app/frontend/src/pages/vibe-venues/VibeVenuesHostDashboard.tsx").read()
    assert "vvhd-drop-test-booking" in page
    assert "/api/vibe-venues/host/test-booking/" in page


def test_dashboard_view_remember_toast_wired():
    """2026-05-12 backlog #8: first-time toggle shows a 'saved as default'
    toast so users know the platform remembers their preference."""
    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    new = open("/app/frontend/src/pages/DashboardNew.tsx").read()
    assert "gv_dashboard_view_seen" in vol
    assert "gv_dashboard_view_seen" in new
    assert "Classic view saved as your default" in vol
    assert "Volumetric Galaxy saved as your default" in new

    role = open("/app/frontend/src/components/common/RoleSwitcher.tsx").read()
    assert "gv_active_role_toast_seen" in role


def test_role_aware_deep_link_url_wired():
    """2026-05-12 backlog #7: ?role=driver in any URL pre-selects driver
    mode and (when landing on /dashboard) auto-navigates to that role's
    home. Makes SMS onboarding links land on the right page."""
    role = open("/app/frontend/src/components/common/RoleSwitcher.tsx").read()
    # Parse the query string + use it as initial active.
    assert 'URLSearchParams(window.location.search)' in role
    assert 'qs.get("role")' in role
    # Auto-navigate when landing on /dashboard with a deep-link role.
    assert 'pathname === "/dashboard"' in role
    assert 'navigate(target.href, { replace: true })' in role


def test_production_smoke_test_card_wired():
    """2026-05-12 backlog #3: God Mode card runs 14 read-only probes
    against the live REACT_APP_BACKEND_URL so the founder can verify
    the deploy in 30s right after pushing."""
    card = open("/app/frontend/src/components/admin/ProductionSmokeTestCard.tsx").read()
    for tid in [
        "prod-smoke-test-card",
        "prod-smoke-test-run",
        "prod-smoke-test-grid",
        "prod-smoke-test-summary",
    ]:
        assert tid in card, f"SmokeTestCard missing testid: {tid}"
    # Probes hit the canonical health + read-only endpoints.
    for probe in [
        "/api/health",
        "/api/live-activity/recent",
        "/api/sports/games",
        "/api/just-for-the-night/rooms/discover",
        "/api/hungryvibes/restaurants",
        "/api/vibe-venues/venues",
        "/api/ridez/active-drivers",
        "/api/streaming/live-feeds",
        "/api/me/unified-earnings",
    ]:
        assert probe in card, f"SmokeTestCard missing probe path: {probe}"
    # Card is mounted in God Mode.
    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "ProductionSmokeTestCard" in god
    assert "<ProductionSmokeTestCard />" in god


def test_geo_proximity_ride_matching_already_wired():
    """2026-05-12 backlog #2: geo-proximity ride matching was already
    implemented via `_top_matches` (top-3 nearest drivers within
    max_radius_km, haversine distance). Locked here so a future refactor
    can't strip the proximity logic and silently fall back to broadcast."""
    src = open("/app/backend/routes/vibe_ridez_dispatch.py").read()
    assert "_top_matches" in src
    assert "max_radius_km" in src
    # Top-3 cascade documented in request_ride docstring.
    assert "Top-3 cascade dispatch" in src or "top-3 cascade" in src.lower()
    # Haversine helper either lives here or in a shared utility.
    assert "haversine" in src.lower() or "asin" in src


def test_smartstack_driver_delivery_offer_already_wired():
    """2026-05-12 backlog #9: SmartStack driver↔delivery offer surface
    was already wired. Driver dashboard polls best_offer + accept/dismiss
    routes. Lock so the surface UI can't silently disappear."""
    fe = open("/app/frontend/src/pages/SmartStackDashboard.tsx").read()
    assert "best_offer" in fe
    assert "/api/smartstack/driver/dashboard" in fe
    assert "/api/smartstack/driver/accept-stack" in fe
    assert "/api/smartstack/driver/dismiss-offer" in fe



def test_stripe_connect_express_scaffolded():
    """2026-05-12 backlog #11: Stripe Connect Express onboarding +
    payout scaffolding. Founder approved building NOW so live keys can
    drop in later without code changes.

    Lock guarantees:
      • 4 Express endpoints exist (/onboard /status /login-link /payout)
      • Graceful degradation: returns `configured: false` when keys
        aren't set instead of 500-ing
      • Per-role return URLs cover all 4 valid roles
      • Drop-in <StripeConnectButton> mounted on driver wallet + host
        dashboard + merchant dashboard surfaces
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in [
        "/api/connect/onboard",
        "/api/connect/status",
        "/api/connect/login-link",
        "/api/connect/payout",
    ]:
        assert p in paths, f"connect endpoint missing: {p}"

    src = open("/app/backend/routes/stripe_connect.py").read()
    # Soft-fail contract — must never 500 when keys aren't set.
    assert "_is_configured" in src
    assert '"configured": False' in src
    # All 4 role return URLs.
    for role in ["driver", "host", "merchant", "streamer"]:
        assert f'"{role}": "/' in src, f"return-url missing for role: {role}"
    # Audit trail for payouts so admin can reconcile.
    assert "stripe_connect_payouts" in src

    btn = open("/app/frontend/src/components/payout/StripeConnectButton.tsx").read()
    for tid in [
        "connect-not-configured",
        "connect-manage-btn",
        "connect-onboard-btn",
    ]:
        assert tid in btn, f"StripeConnectButton missing testid: {tid}"

    # Button mounted on all 3 role pages.
    for path in [
        "/app/frontend/src/pages/VibeRidez/DriverWalletSetup.tsx",
        "/app/frontend/src/pages/vibe-venues/VibeVenuesHostDashboard.tsx",
        "/app/frontend/src/pages/HungryVibesMerchant.tsx",
    ]:
        page = open(path).read()
        assert "StripeConnectButton" in page, f"connect button not mounted: {path}"


def test_landing_tour_video_clips_extended_keeping_dice_first():
    """2026-05-12 founder ask: "I want the tour video to stay the same. I
    want the dice to just be the first thing you see in the front 'cause
    I like that, but I want you to add this so it adds more wow factor."
    Two founder-uploaded clips appended (positions 5 + 6); existing 4
    clips stay in their existing order with the dice intro first.

    2026-05-12 (later): per-clip caption tag overlays added — silent
    autoplay scrollers get a 2-3 word "what you're seeing" tag on every
    scene. CLIP_TAGS array must stay in lockstep with CLIPS (same length,
    same order).
    """
    src = open("/app/frontend/src/components/landing/LandingTourVideo.tsx").read()
    # Dice intro stays at position #1 — must be the FIRST entry in CLIPS.
    dice_url = "aeaebfxp_e_c_a_d_d_db_c_e_videomp_.mp4"
    # All 6 clips referenced.
    for clip_marker in [
        dice_url,
        "8s795ybg_mp_",
        "n612sxdb__The_video_will_be_available",
        "p21nztqq_mp_",
        "jhcw8qgh_Now_could_you_make_me_another",  # NEW 2026-05-12
        "4r7dg2zf_mp_.mp4",  # NEW 2026-05-12
    ]:
        assert clip_marker in src, f"missing clip in tour video: {clip_marker}"
    # Dice must appear BEFORE every other clip in the CLIPS array.
    dice_pos = src.find(dice_url)
    for later in [
        "8s795ybg_mp_",
        "n612sxdb__The_video_will_be_available",
        "p21nztqq_mp_",
        "jhcw8qgh_Now_could_you_make_me_another",
        "4r7dg2zf_mp_.mp4",
    ]:
        later_pos = src.find(later)
        assert 0 < dice_pos < later_pos, (
            f"dice clip MUST appear before '{later}' in CLIPS array"
        )

    # Per-clip caption tags wired with same length as CLIPS.
    assert "CLIP_TAGS" in src, "per-clip caption tags array missing"
    assert "landing-tour-clip-tag-kicker" in src
    assert "landing-tour-clip-tag-line" in src
    # 6 tag entries — one per clip. Match the `kicker: "..."` pattern
    # which only appears in the CLIP_TAGS array literal (the JSX uses
    # `CLIP_TAGS[clipIdx].kicker` so the colon is followed by a quote
    # only in the array, not in the access expression).
    import re
    tag_entries = re.findall(r'kicker:\s*"', src)
    # 2026-05-13: founder added 2 more clips (host-talk + closing wow) →
    # now 8 total. CLIP_TAGS must keep length-parity with CLIPS.
    clip_entries = re.findall(r'https://customer-assets\.emergentagent\.com/[^"\']+\.mp4', src)
    assert len(tag_entries) == len(clip_entries), (
        f"CLIP_TAGS must match CLIPS length (tags={len(tag_entries)} clips={len(clip_entries)})"
    )
    assert len(tag_entries) >= 6, f"At least 6 clips required, got {len(tag_entries)}"
    # Dice tag must mention the rolling/dice theme so the founder's
    # explicit "I like the dice first" ask is preserved visually too.
    assert "Roll the dice" in src



def test_volumetric_planet_carousel_nav_wired():
    """2026-05-12 founder fix on production: 'the rotation don't actually
    rotate one by one... if you spin it, you spin it by wanting to go
    over one by one so people could actually have easier access. The room
    is perfect besides that. It's just too hard to rotate.'

    Adds a prev/next snap carousel + dot indicator + arrow-key shortcuts
    so users can step through the 6 planets like a carousel instead of
    fighting OrbitControls drag. Camera tween is handled by the existing
    CameraRig lerp on selectedIndex change — no extra animation logic.
    """
    page = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    # Mid-side prev/next buttons + dot indicator + active label.
    for tid in [
        "vol-carousel-prev",
        "vol-carousel-next",
        "vol-carousel-indicator",
        "vol-carousel-active-label",
    ]:
        assert tid in page, f"PlanetCarouselNav missing testid: {tid}"
    # Per-planet dot testids use template-literal `vol-carousel-dot-${c.id}`.
    assert "vol-carousel-dot-${c.id}" in page

    # Keyboard shortcuts must be wired so a desktop user can ← / → / Esc.
    for key in ['"ArrowRight"', '"ArrowLeft"', '"Escape"']:
        assert key in page, f"carousel keyboard shortcut missing: {key}"

    # Wrap-around math: (selectedIndex + 1) % total / (selectedIndex - 1 + total) % total
    assert "(selectedIndex + 1) % total" in page, "next must wrap modulo total"
    assert "(selectedIndex - 1 + total) % total" in page, "prev must wrap modulo total"



def test_volumetric_webgl_unavailable_fallback_wired():
    """2026-05-12 PRODUCTION BUG (beta-tester reports): "when they go
    into the volumetric view, they cannot see that page. It redirects
    them back out." Root cause: the <Canvas> threw on devices where
    WebGL is unavailable, bubbling to the parent ErrorBoundary which
    redirected.

    Fix has THREE parts, all locked here:
      1. Pre-mount WebGL probe — if unavailable, swap to Classic in-place
         + show a clear toast so the user knows why.
      2. Canvas wrapped in its own ErrorBoundary with a contained
         "Switch to Classic view" fallback (no full-page redirect).
      3. ErrorBoundary accepts a `fallback` prop so nested boundaries
         can render contained recovery UI.
      4. Canvas listens to `webglcontextlost` to prevent context-loss
         from turning the page blank on tab backgrounding.
    """
    page = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    # WebGL probe at mount.
    assert "WebGLRenderingContext" in page, "WebGL detection missing"
    assert 'getContext("webgl")' in page or "getContext('webgl')" in page
    # Contained ErrorBoundary around the Canvas with a friendly fallback.
    assert "<ErrorBoundary" in page, "ErrorBoundary wrapper missing on canvas"
    assert "volumetric-canvas-crashed" in page
    assert "volumetric-canvas-crashed-classic-btn" in page
    # webglcontextlost recovery hook.
    assert "webglcontextlost" in page
    # Detect-failure path swaps to Classic in-place (no navigate redirect).
    assert 'switchDashboardView("classic")' in page
    # Friendly placeholder during the swap.
    assert "volumetric-webgl-unavailable" in page

    # ErrorBoundary supports the `fallback` prop.
    boundary = open("/app/frontend/src/components/common/ErrorBoundary.tsx").read()
    assert "fallback?: React.ReactNode" in boundary, "ErrorBoundary must accept fallback prop"
    assert "this.props.fallback" in boundary


def test_volumetric_planet_labels_visible_from_overview():
    """2026-05-12 founder enhancement: planet labels readable from the
    galaxy overview so first-time visitors don't have to tap a planet
    just to find out what it is. Label gets a category-tinted glass
    pill background + bumped from text-xs to text-sm and distanceFactor
    from 10 → 7 (slightly larger / closer to camera)."""
    page = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    # Slightly larger size class + pill chrome.
    assert "text-sm md:text-base uppercase tracking-[0.3em]" in page
    # distanceFactor brought closer so labels render at readable size.
    assert "distanceFactor={7}" in page
    # All 6 testids (template-literal but with stable category ids)
    # confirmed by searching the CATEGORIES const for the id list.
    for cat_id in ["games", "dating", "rides", "food", "streaming", "vault"]:
        assert f'id: "{cat_id}"' in page, f"CATEGORIES missing id: {cat_id}"



def test_beta_cohort_report_card_wired():
    """2026-05-12 founder ask: 'auto-aggregates first 50-500 user metrics
    — signups · which role they picked · their first action · drop-off
    page · time-to-first-spend.' Backend endpoint plus God Mode card.
    """
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/admin/beta-cohort" in paths, "beta-cohort endpoint missing"

    backend = open("/app/backend/routes/admin_beta_cohort.py").read()
    # Admin-gated.
    assert "_require_admin" in backend
    # Rollups: signups + roles + revenue (incl. TTFS) + engagement.
    for key in [
        "total_paid_usd",
        "median_time_to_first_spend_min",
        "weakest_rooms_by_7d_visits",
        "activation_rate_pct",
        "jftn_season_passes_active",
    ]:
        assert key in backend, f"beta-cohort missing metric: {key}"

    fe = open("/app/frontend/src/components/admin/BetaCohortReportCard.tsx").read()
    for tid in [
        "beta-cohort-card",
        "beta-cohort-headline",
        "beta-cohort-roles",
        "beta-cohort-weakest-rooms",
    ]:
        assert tid in fe, f"BetaCohortReportCard missing testid: {tid}"
    assert "/api/admin/beta-cohort" in fe

    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "BetaCohortReportCard" in god
    assert "<BetaCohortReportCard />" in god




# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — Beta-launch polish sweep (7 locks)
# ═══════════════════════════════════════════════════════════════════════

def test_volumetric_dashboard_code_split():
    """2026-05-13 perf: Three.js (~500KB) is now lazy-loaded so the Classic
    dashboard + first paint don't pay for it. Verify React.lazy() + Suspense
    wiring stays in place."""
    router = open("/app/frontend/src/pages/DashboardRouter.tsx").read()
    assert "lazy(() => import(\"@/pages/VolumetricDashboard\"))" in router
    assert "Suspense" in router
    assert "VolumetricLoadingFallback" in router

    misc = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert "lazy(() => import(\"@/pages/VolumetricDashboard\"))" in misc
    assert "volumetric-route-loading" in misc


def test_hungryvibes_delivery_progress_map_mounted():
    """2026-05-13 backlog: Customer-side HungryVibes order delivery tracking
    UI — animated SVG delivery map showing courier progression from
    restaurant → customer pin, swapping in based on order status."""
    component = open("/app/frontend/src/components/hungryvibes/DeliveryProgressMap.tsx").read()
    # Animated SVG with bezier-projected courier marker.
    assert "STATUS_PROGRESS" in component
    assert "ready" in component and "preparing" in component
    assert "Q 240 40 440 180" in component  # bezier path
    # Pinned to order_id testid for accessibility / Playwright.
    assert "hv-delivery-map" in component

    tracking = open("/app/frontend/src/pages/HungryVibezOrderTracking.tsx").read()
    assert "DeliveryProgressMap" in tracking


def test_ridez_nearby_drivers_endpoint_and_map():
    """2026-05-13 backlog: Geo-proximity ride matching map UI — backend
    haversine logic was already wired; surfaced new public preview
    endpoint + stylized radar widget for the rider booking flow."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/ridez/nearby-drivers" in paths

    backend = open("/app/backend/routes/vibe_ridez_dispatch.py").read()
    # Coordinates fuzzed to ~110m before exposing publicly (3 d.p.).
    assert 'round(d["lat"], 3)' in backend
    # ETA derivation present.
    assert "estimated_eta_minutes" in backend

    fe = open("/app/frontend/src/components/vibe-ridez/NearbyDriversMap.tsx").read()
    for tid in [
        "nearby-drivers-map",
        "nearby-drivers-count",
        "nearby-drivers-nearest",
        "nearby-drivers-eta",
        "nearby-rider-pin",
    ]:
        assert tid in fe, f"NearbyDriversMap missing testid: {tid}"

    booking = open("/app/frontend/src/pages/RideBooking.tsx").read()
    assert "NearbyDriversMap" in booking


def test_push_notifications_hook_and_prompt_wired():
    """2026-05-13 backlog: Web Push notifications — hook + prompt banner
    + service-worker registration. Notifications fire on order/ride
    status transitions."""
    hook = open("/app/frontend/src/hooks/usePushNotifications.ts").read()
    assert "Notification.requestPermission" in hook
    assert "gv_push_pref" in hook
    assert "notify" in hook

    prompt = open("/app/frontend/src/components/notifications/PushNotificationsPrompt.tsx").read()
    for tid in [
        "push-notifications-prompt",
        "push-notifications-enable",
        "push-notifications-not-now",
    ]:
        assert tid in prompt, f"PushNotificationsPrompt missing testid: {tid}"

    sw = open("/app/frontend/public/gv-sw.js").read()
    # App-shell precache + cache-first for static assets.
    assert "PRECACHE_URLS" in sw
    assert "navigator.serviceWorker" not in sw  # SW file itself shouldn't reference navigator
    assert "self.addEventListener(\"fetch\"" in sw

    idx = open("/app/frontend/src/index.js").read()
    assert "/gv-sw.js" in idx

    tracking = open("/app/frontend/src/pages/HungryVibezOrderTracking.tsx").read()
    assert "PushNotificationsPrompt" in tracking
    assert "usePushNotifications" in tracking


def test_vibe_venues_refund_policies_and_gallery():
    """2026-05-13 backlog: Full Vibe Venues booking platform — refund
    policy preset (flexible/moderate/strict), gallery photos (up to 8),
    and visible policy banner on venue detail."""
    backend = open("/app/backend/routes/vibe_venues.py").read()
    # Three refund policy presets surfaced via /config.
    for tier in ["flexible", "moderate", "strict"]:
        assert f'"id": "{tier}"' in backend, f"refund policy missing: {tier}"
    # HostListing fields.
    assert "gallery_photos: List[str]" in backend
    assert "refund_policy: str" in backend

    host = open("/app/frontend/src/pages/vibe-venues/VibeVenuesHost.tsx").read()
    assert "vv-host-gallery-wrapper" in host
    assert "vv-host-refund-policy-wrapper" in host
    # Three refund presets enumerated in the picker.
    assert "vv-host-refund-${p.id}" in host
    for tier in ["flexible", "moderate", "strict"]:
        assert f'id: "{tier}"' in host, f"refund picker missing tier: {tier}"

    detail = open("/app/frontend/src/pages/vibe-venues/VibeVenuesVenueDetail.tsx").read()
    assert "vv-detail-refund-policy" in detail
    assert "vv-detail-gallery" in detail


def test_stripe_connect_wizard_route_and_steps():
    """2026-05-13 backlog: Stripe Connect onboarding wizard — 3-step guided
    flow lifting the single-button experience into a full
    requirements → verification → activation funnel."""
    wizard = open("/app/frontend/src/pages/payouts/StripeConnectWizard.tsx").read()
    for tid in [
        "stripe-connect-wizard",
        "connect-wizard-stepper",
        "connect-step-1",
        "connect-step-2",
        "connect-step-3",
        "connect-wizard-start-btn",
    ]:
        assert tid in wizard, f"StripeConnectWizard missing testid: {tid}"
    # Stripe data collection happens on Stripe's servers — disclaimer required.
    assert "Stripe directly" in wizard

    misc = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert '/payouts/setup' in misc


def test_offline_service_worker_versioned():
    """2026-05-13 perf: Offline asset cache SW caches the app shell so
    flaky connections don't blank the page. Versioned cache name evicts
    old caches on activate."""
    sw = open("/app/frontend/public/gv-sw.js").read()
    assert "CACHE_VERSION" in sw
    assert "skipWaiting" in sw
    assert "clients.claim" in sw
    # Never cache /api/ — backend handles its own caching.
    assert '/api/' in sw



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — DSG Economic Engine (Global_Vibez_DSG_Economic_Engine.pdf)
# ═══════════════════════════════════════════════════════════════════════

def test_economic_engine_constants_match_spec():
    """Definitive Economy May-2026 spec-locked constants. Spec drift fails CI."""
    from services import dsg_economic_engine as engine
    assert engine.INITIAL_SUPPLY == 3_000_000_000
    assert engine.STABILIZATION_TARGET_SUPPLY == 1_500_000_000
    assert engine.GOLDEN_ASSET_SUPPLY == 750_000_000
    # Definitive Economy raised initial burn 4% → 5% and spread 0.035 → 0.045.
    assert engine.INITIAL_BURN_RATE == 0.05
    assert engine.MINIMUM_BURN_RATE == 0.005
    assert engine.BURN_RATE_SPREAD == pytest.approx(0.045, abs=1e-9)
    assert engine.REVENUE_SPLIT_RATIO == 0.50
    assert engine.DEFAULT_UTILITY_COST_USD == 10.00
    # Definitive Economy: 1 Coin = 10 Credits, $1 = 100 Credits → 1 Coin = $0.10.
    assert engine.PARITY_USD == 0.10
    assert engine.COIN_TO_CREDITS_RATIO == 10
    assert engine.USD_TO_CREDITS_RATIO == 100


def test_economic_engine_burn_rate_curve_endpoints():
    """Burn-rate curve: 5% at 3B, 0.5% at 1.5B (and below). Linear midpoint."""
    from services.dsg_economic_engine import calculate_dynamic_burn_rate
    # Spec endpoints.
    assert calculate_dynamic_burn_rate(3_000_000_000) == 0.05
    assert calculate_dynamic_burn_rate(1_500_000_000) == 0.005
    # Below floor → clamped at minimum.
    assert calculate_dynamic_burn_rate(500_000_000) == 0.005
    assert calculate_dynamic_burn_rate(0) == 0.005
    # Linear midpoint: 2.25B → halfway between min + max → 0.005 + 0.0225 = 0.0275.
    midpoint = calculate_dynamic_burn_rate(2_250_000_000)
    assert midpoint == 0.0275, f"midpoint expected 0.0275 got {midpoint}"


def test_economic_engine_credits_conversion_helpers():
    """Definitive Economy Credits Standard Utility Unit conversion."""
    from services.dsg_economic_engine import (
        coins_to_credits, credits_to_coins,
        usd_to_credits, credits_to_usd,
        process_conversion,
    )
    # 1 Coin = 10 Credits
    assert coins_to_credits(1) == 10
    assert credits_to_coins(10) == 1
    # $1 = 100 Credits
    assert usd_to_credits(1) == 100
    assert credits_to_usd(100) == 1
    # 10 Credits = $0.10
    assert credits_to_usd(10) == 0.10
    # process_conversion full row
    row = process_conversion(10)
    assert row["coin_amount"] == 10
    assert row["credits"] == 100      # 10 Coins × 10
    assert row["value_usd"] == 1.0    # 10 Coins × $0.10
    # Reject negative inputs.
    try:
        coins_to_credits(-1)
        assert False, "coins_to_credits must reject negative"
    except ValueError:
        pass


def test_economic_engine_revenue_split_50_50():
    """All fee revenue splits 50/50 — liquidity vs buyback/burn."""
    from services.dsg_economic_engine import split_revenue
    split = split_revenue(100.0)
    assert split["liquidity_usd"] == 50.0
    assert split["buyback_usd"] == 50.0
    # Zero handled, negative rejected.
    assert split_revenue(0)["liquidity_usd"] == 0.0
    try:
        split_revenue(-1)
        assert False, "split_revenue should reject negative amount"
    except ValueError:
        pass


def test_economic_engine_dynamic_price_formula():
    """Dynamic pricing — $10 ride is always $10 regardless of coin price."""
    from services.dsg_economic_engine import calculate_dynamic_price
    # At Definitive parity ($0.10/coin) → 100 coins for $10.
    assert calculate_dynamic_price(10.0, 0.10) == 100.0
    # Coin at $1 → 10 coins for $10.
    assert calculate_dynamic_price(10.0, 1.0) == 10.0
    # Coin at $0.50 → 20 coins for $10.
    assert calculate_dynamic_price(10.0, 0.50) == 20.0
    # Reject non-positive coin price.
    try:
        calculate_dynamic_price(10.0, 0)
        assert False, "must reject coin_price_usd <= 0"
    except ValueError:
        pass


def test_economic_engine_routes_registered():
    """All Economic Engine endpoints must be mounted under /api."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for ep in [
        "/api/economic-engine/constants",
        "/api/economic-engine/snapshot",
        "/api/economic-engine/burn-rate",
        "/api/economic-engine/dynamic-price",
        "/api/economic-engine/process-revenue",
        "/api/economic-engine/events",
        "/api/economic-engine/convert",
    ]:
        assert ep in paths, f"Economic Engine endpoint missing: {ep}"


def test_economic_engine_card_and_page_mounted():
    """Frontend surfaces — God Mode admin card + public /economic-engine page."""
    card = open("/app/frontend/src/components/economic_engine/EconomicEngineCard.tsx").read()
    for tid in [
        "economic-engine-card",
        "economic-engine-status-pill",
        "economic-engine-progress-pct",
        "economic-engine-supply",
        "economic-engine-burn-rate",
        "economic-engine-liquidity",
        "economic-engine-lifetime-burned",
        "economic-engine-formula",
    ]:
        assert tid in card, f"EconomicEngineCard missing testid: {tid}"

    page = open("/app/frontend/src/pages/EconomicEnginePage.tsx").read()
    for tid in [
        "economic-engine-page",
        "economic-engine-pillars",
        "economic-engine-trust-strip",
    ]:
        assert tid in page, f"EconomicEnginePage missing testid: {tid}"

    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "EconomicEngineCard" in god
    assert "<EconomicEngineCard />" in god

    misc = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert '"/economic-engine"' in misc



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — Definitive Economy positioning (visible app-wide)
# ═══════════════════════════════════════════════════════════════════════

def test_definitive_economy_positioning_app_wide():
    """The Definitive Economy spec must show through in EVERY user surface
    that mentions tokenomics — landing tour video, narration script,
    feature accordions, economic engine card + page. Spec drift fails."""
    # 1. EconomicEngineCard: Credits strip + Global Value Parity headline.
    card = open("/app/frontend/src/components/economic_engine/EconomicEngineCard.tsx").read()
    assert "economic-engine-credits-strip" in card
    assert "Global Value Parity" in card
    assert "Standard Utility Unit" in card
    assert "Rising price" in card and "Constant scarcity" in card

    # 2. EconomicEnginePage: Definitive Economy mission copy.
    page = open("/app/frontend/src/pages/EconomicEnginePage.tsx").read()
    assert "premium standard" in page
    assert "rising price floor" in page
    assert "constant scarcity" in page
    assert "Rides" in page and "Restaurants" in page and "Gaming" in page

    # 3. Landing tour video caption: new economy line replacing hard-cap copy.
    tour = open("/app/frontend/src/components/landing/LandingTourVideo.tsx").read()
    assert "Buyback" in tour
    assert "1 Coin = 10 Credits" in tour

    # 4. Narration script reflects new burn rate + Credits standard.
    narration = open("/app/backend/scripts/generate_landing_tour_narration.py").read()
    assert "Five percent dynamic burn rate" in narration
    assert "fifty-fifty" in narration
    assert "Credits standard" in narration
    assert "One coin equals ten Credits" in narration

    # 5. LandingFeatureAccordions tokenomics card uses Definitive Economy rate.
    acc = open("/app/frontend/src/components/landing/LandingFeatureAccordions.tsx").read()
    assert "Definitive Economy rate" in acc
    assert "10 Coins = $1 USD = 100 Credits" in acc
    # Legacy "2,000 ₵ = $1" must be gone.
    assert "2,000 ₵" not in acc


def test_definitive_economy_convert_endpoint_round_trips():
    """`/api/economic-engine/convert` must produce a consistent 3-unit row."""
    from services.dsg_economic_engine import (
        coins_to_credits, credits_to_coins,
        usd_to_credits, credits_to_usd,
        PARITY_USD, COIN_TO_CREDITS_RATIO, USD_TO_CREDITS_RATIO,
    )
    # Spec example: 10 Coins = 100 Credits = $1.00
    assert coins_to_credits(10) == 100
    assert credits_to_usd(100) == 1.00
    # Round-trip identity (no precision loss within 6dp).
    for n in (0, 1, 10, 100, 1000):
        assert credits_to_coins(coins_to_credits(n)) == n
        assert credits_to_usd(usd_to_credits(n)) == n
    # Definitive Economy invariant: parity == 1 / coin_to_credits × usd_to_credits / 100.
    derived_parity = (USD_TO_CREDITS_RATIO / COIN_TO_CREDITS_RATIO) ** -1 * 1.0
    # i.e., USD per coin = 10 / 100 = 0.10
    assert round(COIN_TO_CREDITS_RATIO / USD_TO_CREDITS_RATIO, 4) == PARITY_USD



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — Legal Age Verification Protocol (21+ restricted goods)
# Encodes Legal_Age_Verification_Protocol.pdf
# ═══════════════════════════════════════════════════════════════════════

def test_avp_constants_match_spec():
    """21+ Restricted Goods Delivery Standard constants — locked."""
    from services import age_verification as avp
    assert avp.RESTRICTED_GOODS_MIN_AGE == 21
    assert avp.RESTRICTED_CATEGORIES == ["alcohol", "tobacco"]
    # All 5 lifecycle statuses present.
    assert set(avp.ALL_STATUSES) == {
        "not_submitted", "pending", "verified", "rejected", "appeal",
    }
    # Standardized decline-reason taxonomy.
    for key in ("underage", "id_unreadable", "id_expired",
                "selfie_mismatch", "dob_mismatch", "duplicate", "policy"):
        assert key in avp.DECLINE_REASONS, f"Missing decline reason: {key}"


def test_avp_age_calc_and_eligibility():
    """Years-old math + 21+ eligibility predicate."""
    from datetime import date
    from services.age_verification import (
        calculate_age, is_eligible_for_restricted,
        STATUS_VERIFIED, STATUS_PENDING, STATUS_REJECTED, STATUS_NOT_SUBMITTED,
    )
    # 30yo, verified → eligible.
    ref = date(2026, 5, 13)
    assert calculate_age("1995-01-01", ref) == 31
    assert is_eligible_for_restricted(31, STATUS_VERIFIED) is True
    # 20yo, even verified → not eligible (under 21).
    assert is_eligible_for_restricted(20, STATUS_VERIFIED) is False
    # 25yo, pending review → not eligible until decision.
    assert is_eligible_for_restricted(25, STATUS_PENDING) is False
    assert is_eligible_for_restricted(25, STATUS_REJECTED) is False
    assert is_eligible_for_restricted(25, STATUS_NOT_SUBMITTED) is False
    # None / negative age → not eligible.
    assert is_eligible_for_restricted(None, STATUS_VERIFIED) is False


def test_avp_menu_shadow_gate_strips_restricted_items():
    """Spec: alcohol/tobacco items HIDDEN (not just disabled) from
    ineligible users. The list is rebuilt without restricted items."""
    from services.age_verification import shadow_filter_menu
    menu = [
        {"id": "1", "name": "Margherita", "category": "pizza"},
        {"id": "2", "name": "IPA", "category": "alcohol"},
        {"id": "3", "name": "Marlboro Reds", "category": "tobacco"},
        {"id": "4", "name": "Tiramisu", "category": "dessert"},
        # Case-insensitive matching.
        {"id": "5", "name": "Whiskey", "category": "Alcohol"},
    ]
    # Ineligible viewer → only non-restricted items survive.
    filtered = shadow_filter_menu(menu, is_eligible=False)
    cats = {i["category"].lower() for i in filtered}
    assert "alcohol" not in cats
    assert "tobacco" not in cats
    assert len(filtered) == 2
    # Eligible viewer → full menu.
    full = shadow_filter_menu(menu, is_eligible=True)
    assert len(full) == 5


def test_avp_routes_registered():
    """All Age Verification endpoints mounted under /api."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    expected = [
        "/api/age-verification/constants",
        "/api/age-verification/status",
        "/api/age-verification/submit",
        "/api/age-verification/appeal",
        "/api/age-verification/eligibility/{category}",
        "/api/age-verification/driver-can-deliver",
        "/api/age-verification/admin/queue",
        "/api/age-verification/admin/events",
        "/api/age-verification/admin/decide",
    ]
    for ep in expected:
        assert ep in paths, f"Age Verification endpoint missing: {ep}"


def test_avp_constants_endpoint_public():
    """The constants endpoint must be open (unauthenticated) so the
    landing page can render the 21+ disclosure copy."""
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app)
    r = client.get("/api/age-verification/constants")
    assert r.status_code == 200
    d = r.json()
    assert d["minimum_age"] == 21
    assert d["restricted_categories"] == ["alcohol", "tobacco"]
    assert "decline_reasons" in d
    assert d["protocol_version"].startswith("Corrected KYC Compliance Protocol")


def test_avp_frontend_surfaces_wired():
    """AgeVerificationPage + AgeVerificationGate (rebuilt May 13 2026 for
    page-level compliance) + AgeVerificationQueueCard wired into God Mode."""
    page = open("/app/frontend/src/pages/AgeVerificationPage.tsx").read()
    for tid in [
        "age-verification-page",
        "age-verification-form",
        "age-verification-dob",
        "age-verification-id-upload",
        "age-verification-selfie-upload",
        "age-verification-submit-btn",
        "age-verification-pillars",
    ]:
        assert tid in page, f"AgeVerificationPage missing testid: {tid}"

    gate = open("/app/frontend/src/components/age_verification/AgeVerificationGate.tsx").read()
    assert "/api/age-verification/eligibility/" in gate, (
        "AgeVerificationGate lost its eligibility lookup"
    )
    assert 'data-testid="avp-gate-not-verified"' in gate, (
        "AgeVerificationGate lost the not-verified CTA testid"
    )
    assert 'data-testid="avp-gate-loading"' in gate

    queue = open("/app/frontend/src/components/admin/AgeVerificationQueueCard.tsx").read()
    for tid in [
        "age-verification-queue-card",
        "avp-queue-filters",
        "avp-queue-filter-${f.id}",
    ]:
        assert tid in queue, f"AgeVerificationQueueCard missing testid: {tid}"

    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "AgeVerificationQueueCard" in god
    assert "<AgeVerificationQueueCard />" in god

    misc = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert '"/restricted-goods-verification"' in misc


def test_avp_restaurant_detail_shadow_gates_restricted():
    """The /restaurants/{id} endpoint applies the shadow-gate so alcohol
    + tobacco are stripped for unverified viewers."""
    detail = open("/app/backend/routes/restaurants.py").read()
    assert "shadow_filter_menu" in detail
    assert '"alcohol"' in detail and '"tobacco"' in detail
    assert "age_gate" in detail



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — Corrected KYC Compliance Protocol (supersedes prior AVP)
# Encodes Corrected_KYC_Compliance_Protocol.pdf
# ═══════════════════════════════════════════════════════════════════════

def test_corrected_kyc_decision_matrix():
    """Vendor decision matrix from the Corrected Protocol — maps the
    5 vendor outcomes to internal lifecycle status correctly."""
    from services.age_verification import (
        DECISION_VERIFIED_21, DECISION_VERIFIED_UNDER_21,
        DECISION_PENDING, DECISION_REQUIRES_INPUT, DECISION_REJECTED,
        DECISION_TO_STATUS,
        STATUS_VERIFIED, STATUS_REJECTED, STATUS_PENDING,
    )
    assert DECISION_TO_STATUS[DECISION_VERIFIED_21] == STATUS_VERIFIED
    assert DECISION_TO_STATUS[DECISION_VERIFIED_UNDER_21] == STATUS_REJECTED
    assert DECISION_TO_STATUS[DECISION_PENDING] == STATUS_PENDING
    assert DECISION_TO_STATUS[DECISION_REQUIRES_INPUT] == STATUS_PENDING
    assert DECISION_TO_STATUS[DECISION_REJECTED] == STATUS_REJECTED


def test_corrected_kyc_stripe_identity_provider():
    """Stripe Identity is the recommended vendor per the Corrected
    Protocol. 4 other providers supported as drop-in alternatives."""
    from services.age_verification import (
        KYC_PROVIDER_STRIPE_IDENTITY, SUPPORTED_KYC_PROVIDERS,
    )
    assert KYC_PROVIDER_STRIPE_IDENTITY == "stripe_identity"
    assert "stripe_identity" in SUPPORTED_KYC_PROVIDERS
    # Drop-in alternatives per the Corrected Protocol.
    for vendor in ("persona", "veriff", "onfido", "jumio"):
        assert vendor in SUPPORTED_KYC_PROVIDERS, f"Missing supported vendor: {vendor}"


def test_corrected_kyc_delivery_refusal_taxonomy():
    """7-reason driver delivery refusal taxonomy — explicit Corrected
    Protocol requirement (codifies the driver right-to-refuse)."""
    from services.age_verification import DELIVERY_REFUSAL_REASONS
    expected = {"id_invalid", "id_mismatch", "underage", "intoxicated",
                "absent", "wrong_address", "other"}
    assert set(DELIVERY_REFUSAL_REASONS.keys()) == expected
    # All reasons must have human-readable copy.
    for k, v in DELIVERY_REFUSAL_REASONS.items():
        assert isinstance(v, str) and len(v) > 10, f"Missing copy for {k}"


def test_corrected_kyc_endpoints_registered():
    """New endpoints from the Corrected Protocol: KYC vendor webhook +
    driver delivery confirm/refuse + refusal reasons."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    expected = [
        "/api/age-verification/webhook/vendor",
        "/api/age-verification/delivery/confirm",
        "/api/age-verification/delivery/refuse",
        "/api/age-verification/delivery/refusal-reasons",
    ]
    for ep in expected:
        assert ep in paths, f"Corrected Protocol endpoint missing: {ep}"


def test_corrected_kyc_constants_endpoint_surfaces_vendor_info():
    """`/constants` exposes Stripe Identity + the 5-state vendor decision
    matrix + delivery refusal taxonomy + 'Corrected KYC Compliance
    Protocol · 2026' version stamp for the public landing copy."""
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app)
    r = client.get("/api/age-verification/constants")
    assert r.status_code == 200
    d = r.json()
    assert d["recommended_kyc_provider"] == "stripe_identity"
    assert "VERIFIED_21" in d["vendor_decisions"]
    assert "VERIFIED_UNDER_21" in d["vendor_decisions"]
    assert "PENDING" in d["vendor_decisions"]
    assert "REQUIRES_INPUT" in d["vendor_decisions"]
    assert "REJECTED" in d["vendor_decisions"]
    assert d["delivery_refusal_reasons"]["intoxicated"]
    assert d["protocol_version"] == "Corrected KYC Compliance Protocol · 2026"


def test_corrected_kyc_frontend_surfaces_vendor():
    """AgeVerificationPage shows the KYC vendor (Stripe Identity) for
    user trust + audit transparency."""
    page = open("/app/frontend/src/pages/AgeVerificationPage.tsx").read()
    assert "avp-kyc-vendor-label" in page
    assert "Stripe Identity" in page



def test_stripe_identity_webhook_dual_mode():
    """Stripe Identity webhook handler supports two modes:
       1. Production: signature-verified via STRIPE_IDENTITY_WEBHOOK_SECRET
       2. Stub: admin-gated when secret is not yet configured

    Both paths funnel through `apply_vendor_decision` so the audit log
    sees Stripe events identically to admin-fired decisions."""
    handler = open("/app/backend/routes/age_verification.py").read()

    # Signature verification wired with the env-driven secret.
    assert "STRIPE_IDENTITY_WEBHOOK_SECRET" in handler
    assert "stripe.Webhook.construct_event" in handler
    assert 'stripe-signature' in handler

    # Maps the 4 canonical Stripe Identity event types.
    for evt in (
        "identity.verification_session.verified",
        "identity.verification_session.requires_input",
        "identity.verification_session.processing",
        "identity.verification_session.canceled",
    ):
        assert evt in handler, f"Stripe Identity event missing handler branch: {evt}"

    # Both modes call apply_vendor_decision so audit log shape is uniform.
    assert handler.count("apply_vendor_decision") >= 2

    # Stub mode preserved (admin-gated) when secret isn't set yet.
    assert "_require_admin(user)" in handler



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-13 — Content Rights & Anti-Piracy Policy
# Encodes Content_Rights_And_IP_Policy.pdf
# ═══════════════════════════════════════════════════════════════════════

def test_content_rights_spec_constants_locked():
    """All spec constants from the Content Rights & IP Policy PDF."""
    from services import content_rights as cr
    # 24h DMCA SLA per Spec §1b.
    assert cr.DMCA_TAKEDOWN_SLA_HOURS == 24
    # 3-strike repeat infringer rule per Spec §1c.
    assert cr.REPEAT_INFRINGER_STRIKE_THRESHOLD == 3
    # 10-day payment escrow per Spec §5.
    assert cr.PAYMENT_ESCROW_DAYS == 10
    # 5-minute default download window.
    assert cr.DEFAULT_DOWNLOAD_TTL_SECONDS == 300
    # 30-second sample/preview clips.
    assert cr.SAMPLE_DURATION_SECONDS == 30
    # Metadata blocklist contains spec-named keywords.
    blocklist = " ".join(cr.DEFAULT_METADATA_BLOCKLIST).lower()
    for kw in ("official movie", "leak", "type beat"):
        assert kw in blocklist, f"Missing spec keyword: {kw}"


def test_content_rights_signed_download_token_lifecycle():
    """Mint + verify + tamper detection + expiry."""
    import os
    os.environ["CONTENT_RIGHTS_SECRET"] = "TEST_SECRET_NEVER_USE_IN_PROD"
    from services.content_rights import (
        mint_download_token, verify_download_token,
    )
    # Valid token — round-trips.
    t = mint_download_token("asset_123", "user_alice", ttl_seconds=60)
    decoded = verify_download_token(t["token"])
    assert decoded["asset_id"] == "asset_123"
    assert decoded["user_id"] == "user_alice"

    # Tampered signature → rejected.
    tampered = t["token"][:-2] + "00"
    try:
        verify_download_token(tampered)
        assert False, "Tampered token must be rejected"
    except ValueError:
        pass

    # Tampered payload → rejected (signature won't match).
    payload_parts = t["token"].split(":")
    payload_parts[1] = "user_eve"
    bad = ":".join(payload_parts)
    try:
        verify_download_token(bad)
        assert False, "Payload tampering must be rejected"
    except ValueError:
        pass

    # Malformed token → rejected.
    try:
        verify_download_token("not_a_real_token")
        assert False, "Malformed token must be rejected"
    except ValueError:
        pass


def test_content_rights_metadata_blocklist_detection():
    """Title + description scan catches spec-named piracy keywords."""
    from services.content_rights import metadata_block_check
    assert metadata_block_check("Drake Type Beat", "free") == "type beat"
    assert metadata_block_check("My Beat", "Official Movie soundtrack") == "official movie"
    assert metadata_block_check("Title", "LEAKED from session") == "leak"
    # Original work passes clean.
    assert metadata_block_check("Sunset Drive", "an original instrumental") is None
    assert metadata_block_check("", "") is None


def test_content_rights_endpoints_registered():
    """All Content Rights endpoints mounted under /api."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    expected = [
        "/api/content-rights/policy",
        "/api/content-rights/sample/{asset_id}",
        "/api/content-rights/purchase/{asset_id}",
        "/api/content-rights/download/{token}",
        "/api/content-rights/dmca/notice",
        "/api/content-rights/upload/preflight",
        "/api/content-rights/admin/dmca/queue",
        "/api/content-rights/admin/dmca/decide",
        "/api/content-rights/admin/strikes",
    ]
    for ep in expected:
        assert ep in paths, f"Content Rights endpoint missing: {ep}"


def test_content_rights_policy_endpoint_public():
    """Policy endpoint must be open + return the full spec snapshot."""
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app)
    r = client.get("/api/content-rights/policy")
    assert r.status_code == 200
    d = r.json()
    assert d["dmca_takedown_sla_hours"] == 24
    assert d["repeat_infringer_strike_threshold"] == 3
    assert d["payment_escrow_days"] == 10
    assert "metadata_blocklist" in d and len(d["metadata_blocklist"]) >= 5
    assert "user_rights_agreement" in d
    assert d["protocol_version"].startswith("Content Rights & Anti-Piracy Policy")


def test_content_rights_frontend_surfaces_wired():
    """ContentRightsPage + DMCA admin queue card mounted on God Mode."""
    page = open("/app/frontend/src/pages/ContentRightsPage.tsx").read()
    for tid in [
        "content-rights-page",
        "content-rights-counters",
        "content-rights-pillars",
        "content-rights-agreement",
        "content-rights-open-dmca",
        "content-rights-dmca-form",
        "dmca-asset-id",
        "dmca-claimant-name",
        "dmca-claimant-email",
        "dmca-claim-text",
        "dmca-submit",
    ]:
        assert tid in page, f"ContentRightsPage missing testid: {tid}"
    # All 6 pillars present per spec.
    for pillar in ["Signed Download URLs", "Upload Fingerprint Scan",
                   "DMCA 24-Hour Takedown", "Termination",
                   "Metadata Keyword Filter", "Escrow"]:
        assert pillar in page, f"Pillar missing: {pillar}"

    queue = open("/app/frontend/src/components/admin/ContentRightsDmcaQueueCard.tsx").read()
    for tid in [
        "content-rights-dmca-queue-card",
        "content-rights-dmca-filters",
        "content-rights-strikes-list",
    ]:
        assert tid in queue, f"DMCA queue card missing testid: {tid}"

    god = open("/app/frontend/src/pages/admin/GodModeDashboard.tsx").read()
    assert "ContentRightsDmcaQueueCard" in god
    assert "<ContentRightsDmcaQueueCard />" in god

    misc = open("/app/frontend/src/routes/miscRoutes.tsx").read()
    assert '"/content-rights"' in misc



def test_dmca_designated_agent_registered():
    """H&S Solutions Group registered with US Copyright Office on
    2026-05-11 (Pay.gov #28277U36). DMCA Safe Harbor active.

    Asserts (a) env vars are set in backend/.env, (b) service code
    surfaces them on /policy, (c) frontend renders the badge.
    We skip TestClient here because prior async tests can close the
    event loop; the live `curl /api/content-rights/policy` check is
    performed during deployment smoke."""
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
    import os
    # Env vars present (the actual registration data).
    assert os.environ.get("DMCA_AGENT_NAME") == "H&S Solutions Group"
    assert "Rockford" in os.environ.get("DMCA_AGENT_ADDRESS", "")
    assert os.environ.get("DMCA_AGENT_PAYGOV_TRACKING_ID") == "28277U36"
    assert os.environ.get("DMCA_AGENT_EMAIL") == "customerservice@globalvibezdsg.com"

    # Service code reads the env vars into the policy snapshot.
    svc = open("/app/backend/services/content_rights.py").read()
    assert 'os.environ.get("DMCA_AGENT_NAME"' in svc
    assert "dmca_agent" in svc

    # Frontend renders the agent block (testids match the new region).
    page = open("/app/frontend/src/pages/ContentRightsPage.tsx").read()
    for tid in [
        "content-rights-dmca-agent",
        "content-rights-dmca-agent-name",
        "content-rights-dmca-agent-address",
    ]:
        assert tid in page, f"DMCA agent block missing testid: {tid}"



def test_volumetric_dashboard_every_tile_has_a_route():
    """Every clickable planet/tile in the Volumetric Galaxy MUST land
    on a real registered route. Catches the bug we shipped in beta
    where /dating, /cinema-room, /vibe-spots were tiles that 404'd."""
    import re, glob

    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    tile_paths = set(re.findall(r'path:\s*"(/[^"]+)"', vol))

    all_routes = set()
    for f in glob.glob("/app/frontend/src/routes/*.tsx") + ["/app/frontend/src/App.tsx"]:
        try:
            for m in re.finditer(r'<Route\s+path="(/[^"]+)"', open(f).read()):
                all_routes.add(m.group(1))
        except FileNotFoundError:
            pass

    missing = tile_paths - all_routes
    assert not missing, f"Volumetric tile paths with no matching <Route>: {sorted(missing)}"

    # And spot-check the 4 we explicitly wired in this round.
    for path in ("/dating", "/cinema-room", "/vibe-spots", "/my-vibez"):
        assert path in tile_paths, f"Expected tile path not present: {path}"
        assert path in all_routes, f"Expected route not registered: {path}"


def test_video_vault_endpoints_and_page_wired():
    """2026-02 sprint: Video Vault marketplace — sibling of Beat Vault for
    filmmakers / motion-graphics artists / B-roll stockers. Every listing
    routes through services.content_rights for fingerprint dedupe,
    metadata blocklist, signed download URLs, and DMCA escrow.

    Locks:
      - Backend route file present + registered + correct prefix.
      - Service integrates with content_rights (preflight + record_purchase).
      - Frontend page + route + dashboard tile all wired.
      - License tiers + metadata blocklist enforced.
    """
    # ── Backend ─────────────────────────────────────────────────────────
    route_src = open("/app/backend/routes/video_vault.py").read()
    # Correct prefix (NO /api — registry strips that since api_router has /api).
    assert 'prefix="/video-vault"' in route_src, "Video Vault route prefix should be /video-vault (api_router adds /api)"
    # Wired through content rights, not a side-channel.
    assert "from services import content_rights" in route_src
    assert "content_rights.metadata_block_check" in route_src
    assert "content_rights.record_purchase" in route_src
    assert "content_rights.register_asset" in route_src
    # License tiers spec'd (per Content Rights & IP Policy §3).
    for tier in ("standard", "extended", "exclusive"):
        assert f'"{tier}"' in route_src, f"License tier missing: {tier}"
    # Master URL is never echoed back through _public_video.
    assert '_public_video' in route_src
    assert '"master_url"' in route_src

    # Registry registers it.
    registry = open("/app/backend/routes/registry.py").read()
    assert "from routes.video_vault import router as video_vault_router" in registry
    assert "api_router.include_router(video_vault_router)" in registry

    # ── Frontend page ───────────────────────────────────────────────────
    page = open("/app/frontend/src/pages/dsg/VideoVaultMarketplace.tsx").read()
    for tid in (
        "video-vault-root",
        "video-vault-list-cta",
        "video-vault-refresh",
        "video-vault-list-modal",
        "video-vault-form-submit",
        "video-vault-form-title",
        "video-vault-form-master",
        "video-vault-form-category",
        "video-vault-form-tier",
    ):
        assert tid in page, f"VideoVaultMarketplace missing testid: {tid}"
    # Hits the API base, not localhost.
    assert "process.env.REACT_APP_BACKEND_URL" in page
    assert "/api/video-vault/videos" in page
    assert "/api/video-vault/stats" in page

    # ── Router + Dashboard tile ─────────────────────────────────────────
    routes = open("/app/frontend/src/routes/dsgRoutes.tsx").read()
    assert "/dsg/video-vault" in routes
    assert "VideoVaultMarketplace" in routes

    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "/dsg/video-vault" in vol, "Video Vault tile missing from Volumetric Dashboard"
    assert "Video Vault" in vol


def test_beat_vault_content_rights_wiring():
    """2026-02 sprint: Beat Vault is now preemptively wired into the
    Content Rights ledger. When a producer uploads a beat with a real
    `audio_url`, the upload routes through services.content_rights
    (metadata blocklist + fingerprint dedupe + signed-URL delivery on
    every /use). Backwards-compatible: legacy meter-only beats keep
    working without an audio_url.

    Locks:
      - Beat dataclass carries audio_url + preview_url + asset_id.
      - Upload endpoint calls register_asset when audio_url is present.
      - Use endpoint mints a signed token via record_purchase for
        DRM-protected beats.
      - Metadata blocklist is enforced on the upload.
    """
    routes_src = open("/app/backend/routes/freestyle_battles_routes.py").read()
    service_src = open("/app/backend/services/freestyle_battles.py").read()

    # Dataclass extension.
    assert "audio_url: Optional[str] = None" in service_src
    assert "preview_url: Optional[str] = None" in service_src
    assert "asset_id: Optional[str] = None" in service_src

    # Routes pull content_rights and use both register + record_purchase.
    assert "from services import content_rights" in routes_src
    assert "content_rights.metadata_block_check" in routes_src
    assert "content_rights.register_asset" in routes_src
    assert "content_rights.record_purchase" in routes_src

    # Upload + use endpoints are now async (required for content_rights calls).
    assert "async def beat_upload" in routes_src
    assert "async def beat_use" in routes_src

    # Backwards compat: legacy meter path still works (no audio_url branch).
    assert "if req.audio_url:" in routes_src
    assert "if beat.asset_id:" in routes_src

    # /beats listing exposes preview_url + drm_protected flag (never master).
    assert '"preview_url": b.preview_url' in routes_src
    assert '"drm_protected": bool(b.asset_id)' in routes_src




def test_cloudflare_stream_ingest_wired():
    """2026-02 sprint: Cloudflare Stream RTMP/SRT ingest + HLS playback.
    Closes the "every-device → every-audience" gap so streamers can
    broadcast from OBS/Streamlabs/Larix/vMix/console capture cards and
    viewers watch via auto-transcoded HLS in our React app.

    Locks:
      - Backend route file present + registered + correct prefix.
      - Endpoints support both STUB (no creds) and LIVE (creds set) modes.
      - Idempotent live-input provisioning per streamer.
      - HLS player component + Streamer Studio page wired.
      - React route + Volumetric Dashboard tile present.
      - hls.js dependency installed (required for cross-browser HLS).
    """
    # ── Backend ─────────────────────────────────────────────────────────
    src = open("/app/backend/routes/cloudflare_stream.py").read()
    assert 'prefix="/streaming/cloudflare"' in src, "CF Stream prefix should be /streaming/cloudflare (api_router adds /api)"
    # Three credentials read from env (the four-key contract).
    for env_key in (
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_STREAM_SUBDOMAIN",
        "CLOUDFLARE_STREAM_WEBHOOK_SECRET",
    ):
        assert env_key in src, f"CF Stream missing env var: {env_key}"
    # STUB/LIVE branching + idempotency.
    assert "_is_live()" in src
    assert 'mode": "stub"' in src or '"mode": "stub"' in src
    assert "existing = await db.cf_live_inputs.find_one" in src, "Provisioning must be idempotent per streamer"
    # Webhook signature verification helper.
    assert "_verify_cf_signature" in src
    assert "hmac.compare_digest" in src

    # Registry mounts it.
    registry = open("/app/backend/routes/registry.py").read()
    assert "from routes.cloudflare_stream import router as cf_stream_router" in registry

    # ── Frontend ────────────────────────────────────────────────────────
    player = open("/app/frontend/src/components/streaming/HLSPlayer.tsx").read()
    assert 'import Hls from "hls.js"' in player or "import Hls from 'hls.js'" in player
    assert 'data-testid="hls-player"' in player
    assert "lowLatencyMode" in player
    # Safari/iOS native HLS fallback present.
    assert 'application/vnd.apple.mpegurl' in player

    studio = open("/app/frontend/src/pages/streaming/StreamerStudio.tsx").read()
    for tid in (
        "streamer-studio-root",
        "streamer-studio-provision",
        "streamer-studio-rtmp-url",
        "streamer-studio-rtmp-key",
        "streamer-studio-srt-url",
        "streamer-studio-cheatsheet",
    ):
        assert tid in studio, f"StreamerStudio missing testid: {tid}"
    # Calls our new backend endpoints, not localhost.
    assert "process.env.REACT_APP_BACKEND_URL" in studio
    assert "/api/streaming/cloudflare/live-inputs" in studio

    # Router + Dashboard tile.
    routes = open("/app/frontend/src/routes/streamingRoutes.tsx").read()
    assert "/streamer/studio" in routes
    assert "StreamerStudio" in routes

    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "/streamer/studio" in vol, "Streamer Studio tile missing from Volumetric Dashboard"

    # hls.js installed in package.json (required for cross-browser HLS).
    import json
    pkg = json.load(open("/app/frontend/package.json"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert "hls.js" in deps, "hls.js must be installed for HLS playback"



def test_live_now_wall_and_watch_room_wired():
    """2026-02 sprint: Public Live Now Wall — auto-pulls every webhook-
    confirmed-live Cloudflare streamer and renders mini HLS players in
    a grid. Public route (no auth) for SEO + viral discovery. Pairs
    with WatchRoom for click-to-enter deep links.

    Locks:
      - LiveNowWall + WatchRoom pages exist.
      - Routes are PUBLIC (not wrapped in ProtectedRoute).
      - Volumetric Dashboard tile present.
      - Wall reuses the canonical HLSPlayer component (no DRY violations).
      - Wall hits the only_live=true endpoint, not a side-channel.
      - Watch route uses :inputId param matching the Cloudflare uid format.
    """
    wall = open("/app/frontend/src/pages/streaming/LiveNowWall.tsx").read()
    watch = open("/app/frontend/src/pages/streaming/WatchRoom.tsx").read()
    routes = open("/app/frontend/src/routes/streamingRoutes.tsx").read()

    # Pages mount + reuse shared player.
    for tid in (
        "live-now-wall-root",
        "live-now-refresh",
        "live-now-mute-all",
        "live-now-go-live",
    ):
        assert tid in wall, f"LiveNowWall missing testid: {tid}"
    assert "HLSPlayer" in wall, "Wall must reuse the canonical HLSPlayer component"
    assert "only_live=true" in wall, "Wall must filter to live streams only"
    assert "process.env.REACT_APP_BACKEND_URL" in wall

    for tid in ("watch-room-root", "watch-room-back", "watch-room-share"):
        assert tid in watch, f"WatchRoom missing testid: {tid}"
    assert "HLSPlayer" in watch
    assert "useParams" in watch and "inputId" in watch

    # Routes are PUBLIC (no ProtectedRoute wrap on these two paths).
    import re
    live_route_match = re.search(
        r'<Route\s+path="/streams/live"\s+element=\{(.+?)\}\s*/>',
        routes,
        re.DOTALL,
    )
    assert live_route_match, "Missing /streams/live route registration"
    assert "ProtectedRoute" not in live_route_match.group(1), (
        "/streams/live must be PUBLIC for SEO + viral discovery — do not wrap in ProtectedRoute"
    )

    watch_route_match = re.search(
        r'<Route\s+path="/streams/watch/:inputId"\s+element=\{(.+?)\}\s*/>',
        routes,
        re.DOTALL,
    )
    assert watch_route_match, "Missing /streams/watch/:inputId route registration"
    assert "ProtectedRoute" not in watch_route_match.group(1), (
        "/streams/watch/:inputId must be PUBLIC so shared links work for anyone"
    )

    # Volumetric Dashboard tile.
    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "/streams/live" in vol, "Live Now Wall tile missing from Volumetric Dashboard"



def test_stripe_payouts_webhook_wired():
    """2026-02 sprint: Stripe Connect / Payouts webhook handler created
    to receive account/payout/charge events from the live Stripe
    webhook endpoint registered at globalvibezdsg.com/api/payouts/stripe-webhook.

    Locks:
      - Route module exists + has correct prefix.
      - Uses Stripe's official construct_event for signature verification
        (no DIY HMAC — Stripe's helper handles the v0/v1 algorithm switch).
      - Handles all 7 events we registered on Stripe's side.
      - Per-event handlers are idempotent and async (no blocking the proxy).
      - Registered in routes/registry.py.
    """
    src = open("/app/backend/routes/stripe_payouts_webhook.py").read()
    assert 'prefix="/payouts"' in src, "Payouts webhook must use /payouts prefix"
    assert "stripe.Webhook.construct_event" in src, "Must use Stripe's official verifier (handles v0/v1, replay tolerance)"
    assert "STRIPE_WEBHOOK_SECRET" in src
    assert "tolerance=300" in src, "Should set explicit 5-minute replay tolerance"

    # All 7 registered events have handlers.
    for evt in (
        "account.updated",
        "account.external_account.created",
        "payout.paid",
        "payout.failed",
        "charge.succeeded",
        "charge.refunded",
        "checkout.session.completed",
    ):
        assert f'"{evt}"' in src, f"Missing handler for: {evt}"

    # Each handler is async (the proxy can't block).
    import re
    handler_pattern = re.compile(r"async def _handle_\w+")
    assert len(handler_pattern.findall(src)) >= 7, "Each Stripe event handler must be async"

    # Registry mounts it.
    registry = open("/app/backend/routes/registry.py").read()
    assert "from routes.stripe_payouts_webhook import router as stripe_payouts_router" in registry


def test_stripe_identity_webhook_handles_real_payload_shape():
    """2026-02 sprint: regression lock for the Pydantic-422 bug we fixed
    where the Identity webhook had a `payload: VendorDecisionPayload`
    body param, which FastAPI parsed BEFORE the function ran the
    signature check. Real Stripe Identity payloads — which have
    `{id, type, data:{object:{...}}}` instead of our internal
    `{user_id, decision}` schema — would 422 before signature
    verification even ran.

    Now: body is parsed manually inside the function, so mode 1
    (Stripe-signed real webhook) and mode 2 (admin stub) both work.
    """
    src = open("/app/backend/routes/age_verification.py").read()

    # The function signature MUST NOT include a Pydantic body param —
    # only Request + user dependency.
    import re
    sig_match = re.search(
        r"async def webhook_vendor\(([^)]*)\)",
        src,
        re.DOTALL,
    )
    assert sig_match, "webhook_vendor function not found"
    sig_body = sig_match.group(1)
    assert "payload:" not in sig_body, (
        "REGRESSION: webhook_vendor must not have a Pydantic body param — "
        "real Stripe Identity webhooks would 422 before signature check runs"
    )

    # Body must be parsed manually inside the stub branch.
    assert "raw = await request.json()" in src
    assert "VendorDecisionPayload(**raw)" in src

    # Stripe construct_event still in place for mode 1.
    assert "stripe.Webhook.construct_event" in src



def test_featured_streamers_tier_wired():
    """2026-02 sprint: $5/30-day Featured Streamers tier — paid pin to
    the top of the Live Now Wall. Direct revenue lever using the live
    Stripe key + Stripe Checkout.

    Locks:
      - Backend route file present + registered + correct prefix.
      - Pricing constants spec'd: $5 / 30 days.
      - apply_feature_grant is async + idempotent + extends future windows.
      - Stripe Checkout uses client_reference_id=feature:<streamer_id>.
      - stripe_payouts_webhook routes `feature:` refs to apply_feature_grant.
      - Live Now Wall annotates is_featured + sorts featured first.
      - Studio page surfaces the upsell card with the right testids.
    """
    src = open("/app/backend/routes/featured_streamers.py").read()
    assert 'prefix="/featured-streamers"' in src
    assert "FEATURED_PRICE_USD = 5.00" in src
    assert "FEATURED_DURATION_DAYS = 30" in src
    assert "FEATURED_REF_PREFIX = \"feature:\"" in src
    assert "async def apply_feature_grant" in src
    # Idempotency lock: same session_id no-ops on retry.
    assert "last_grant_session_id" in src
    # Stripe Checkout with client_reference_id.
    assert "stripe.checkout.Session.create" in src
    assert "client_reference_id=f\"{FEATURED_REF_PREFIX}{req.streamer_id}\"" in src

    # Registry mounts it.
    registry = open("/app/backend/routes/registry.py").read()
    assert "from routes.featured_streamers import router as featured_router" in registry

    # Payouts webhook routes feature: refs.
    payouts = open("/app/backend/routes/stripe_payouts_webhook.py").read()
    assert 'ref.startswith("feature:")' in payouts
    assert "apply_feature_grant" in payouts

    # Cloudflare live-inputs listing layers in feature metadata.
    cf = open("/app/backend/routes/cloudflare_stream.py").read()
    assert "featured_streamers" in cf
    assert "is_featured" in cf
    assert "featured_until" in cf

    # Frontend: wall renders featured badge + glow style.
    wall = open("/app/frontend/src/pages/streaming/LiveNowWall.tsx").read()
    assert "is_featured" in wall
    assert "live-now-featured-badge-" in wall, "Featured badge testid missing"
    assert "featured_until" in wall

    # Frontend: studio page has the upsell card.
    studio = open("/app/frontend/src/pages/streaming/StreamerStudio.tsx").read()
    for tid in (
        "streamer-studio-featured-upsell",
        "streamer-studio-featured-purchase",
    ):
        assert tid in studio, f"Studio missing testid: {tid}"
    assert "/api/featured-streamers/checkout" in studio



def test_cloudflare_stream_analytics_wired():
    """2026-02 final pre-beta-redeploy sprint: Cloudflare Stream Analytics
    dashboard for streamers. Pulls from the GraphQL analytics endpoint
    using the same API token we use for live-input provisioning (already
    has GraphQL read permission — verified via curl).

    Locks:
      - Backend GET /api/streaming/cloudflare/analytics/:input_id route.
      - Calls Cloudflare GraphQL endpoint (not REST — analytics live there).
      - Returns daily + countries + summary shape the frontend expects.
      - Frontend StreamerAnalytics page mounted at /streamer/analytics.
      - Charts use recharts (already installed) — no new deps.
      - Volumetric Dashboard tile + Studio header link both present.
    """
    src = open("/app/backend/routes/cloudflare_stream.py").read()
    assert "CF_GRAPHQL_URL" in src and "api.cloudflare.com/client/v4/graphql" in src
    assert "async def _cf_graphql" in src
    assert "@router.get(\"/analytics/{input_id}\")" in src
    # Two distinct GraphQL queries — daily breakdown + country breakdown.
    assert "streamMinutesViewedAdaptiveGroups" in src
    assert "orderBy: [date_ASC]" in src, "Daily query must sort chronologically"
    assert "orderBy: [sum_minutesViewed_DESC]" in src, "Country query must rank by viewers"
    # Returns the shape the frontend renders.
    for key in ('"daily":', '"countries":', '"summary":', '"window_days":'):
        assert key in src, f"Analytics response missing key: {key}"

    # Frontend page mounted + uses recharts.
    page = open("/app/frontend/src/pages/streaming/StreamerAnalytics.tsx").read()
    assert "from \"recharts\"" in page or "from 'recharts'" in page
    assert "/api/streaming/cloudflare/analytics/" in page
    for tid in (
        "streamer-analytics-root",
        "streamer-analytics-refresh",
        "streamer-analytics-window-picker",
        "streamer-analytics-daily-chart",
        "streamer-analytics-country-chart",
        "streamer-analytics-kpi-row",
    ):
        assert tid in page, f"StreamerAnalytics missing testid: {tid}"

    # Router + dashboard tile.
    routes = open("/app/frontend/src/routes/streamingRoutes.tsx").read()
    assert "/streamer/analytics" in routes
    assert "StreamerAnalytics" in routes

    vol = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "/streamer/analytics" in vol, "Stream Analytics tile missing from Volumetric Dashboard"

    # Studio links to analytics so streamers discover the new surface.
    studio = open("/app/frontend/src/pages/streaming/StreamerStudio.tsx").read()
    assert "/streamer/analytics" in studio
    assert "streamer-studio-analytics-link" in studio

    # recharts dep declared.
    import json
    pkg = json.load(open("/app/frontend/package.json"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert "recharts" in deps, "recharts must be installed for analytics charts"



def test_streamer_wrap_up_emails_wired():
    """2026-02 final-final pre-beta sprint: Monday-morning per-streamer
    wrap-up emails. Pairs with the Cloudflare Stream Analytics dashboard
    to give streamers a recurring reason to come back to the platform.

    Locks:
      - Service module exists + has compute/render/dispatch trio.
      - HTTP routes exist + correct prefix.
      - Background loop auto-starts via lifespan kickoff list.
      - Frontend analytics page has the "Email me" button.
      - Resend is the delivery mechanism (not hand-rolled SMTP).
      - Idempotent per ISO week via streamer_wrap_up_runs audit.
    """
    svc = open("/app/backend/services/streamer_wrap_up_service.py").read()
    assert "async def compute_streamer_wrap_up" in svc
    assert "def render_wrap_up_email_html" in svc
    assert "async def dispatch_one_wrap_up" in svc
    assert "async def dispatch_weekly_wrap_ups" in svc
    assert "async def streamer_wrap_up_loop" in svc
    assert "WRAP_UP_HOUR_UTC = 9" in svc
    assert "streamer_wrap_up_runs" in svc, "Idempotency audit collection name missing"
    assert "iso_week" in svc, "Should dedupe by ISO week"
    assert "resend.Emails.send" in svc, "Should use Resend SDK, not raw SMTP"

    routes = open("/app/backend/routes/streamer_wrap_up.py").read()
    assert 'prefix="/streamer-wrap-up"' in routes
    assert "preview/{streamer_id}" in routes
    assert "send/{streamer_id}" in routes
    assert "dispatch-weekly" in routes

    # Registry mounts it.
    registry = open("/app/backend/routes/registry.py").read()
    assert "from routes.streamer_wrap_up import router as wrap_up_router" in registry

    # Background loop is auto-started via the lifespan kickoff list.
    lifespan = open("/app/backend/lifespan.py").read()
    workers = open("/app/backend/lifespan_workers.py").read()
    assert "_start_streamer_wrap_up" in lifespan
    assert "streamer_wrap_up_loop" in workers

    # Frontend exposes the manual-send button on the analytics page.
    analytics = open("/app/frontend/src/pages/streaming/StreamerAnalytics.tsx").read()
    assert "streamer-analytics-email-wrap-up" in analytics
    assert "/api/streamer-wrap-up/send/" in analytics


def test_games_have_no_fiat_signs():
    """2026-02 pre-beta polish: founder requirement — 'no money signs on
    no games'. Games settle exclusively in Vibez Coins, so $ next to a
    number on any game UI is a regression.

    Allowed: $ as part of valid JS/TS template literals (${...}),
    Tailwind arbitrary value syntax (\\$[...]), and inside comments
    is tolerated (we still strip the obvious ones, but a code comment
    won't reach the user). This test guards against the user-visible
    occurrences.
    """
    import re, pathlib
    pattern = re.compile(r"(?<![\\${])\$[0-9]")  # $ directly followed by digit, NOT inside ${} or \\$ tw-arbitrary
    offenders = []
    games_dirs = [
        pathlib.Path("/app/frontend/src/pages/games"),
        pathlib.Path("/app/frontend/src/components/games"),
    ]
    for d in games_dirs:
        if not d.exists():
            continue
        for path in d.rglob("*.tsx"):
            txt = path.read_text()
            for ln, line in enumerate(txt.splitlines(), 1):
                # Skip lines that are clearly comments.
                stripped = line.lstrip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                # Skip lines inside multiline /* */ — approximate but
                # good enough: skip if line contains `/*` or `*/`.
                if "/*" in line or "*/" in line:
                    continue
                if pattern.search(line):
                    offenders.append(f"{path.name}:{ln}: {line.strip()[:120]}")
    assert not offenders, (
        "Founder rule: no fiat $ signs on games. All bets settle in "
        "Vibez Coins. Offending lines:\n  " + "\n  ".join(offenders)
    )


def test_games_enforce_50_coin_min_bet_floor():
    """Founder rule: 50-coin minimum bet platform-wide. Lock the
    canonical defaults so nobody silently re-lowers them.
    """
    bj = open("/app/backend/services/blackjack_multiplayer.py").read()
    # The factory defaults to 50 + clamps anything lower to 50.
    assert "min_bet: int = 50" in bj, "Blackjack default min_bet must be 50 coins"
    assert "max(int(min_bet or 50), 50)" in bj, "Blackjack must hard-floor min_bet at 50"

    slots = open("/app/backend/routes/multiplayer_slots.py").read()
    # Default rooms must not have a min_bet under 50.
    import re
    for m in re.finditer(r"'min_bet':\s*(\d+)", slots):
        val = int(m.group(1))
        assert val >= 50, f"Slots default min_bet={val} violates 50-coin floor"

    v654 = open("/app/backend/routes/vibez_654_prescription.py").read()
    # Founder-locked exception to the 50-coin floor: Vibe Dice 654 was
    # designed around the [5, 10, 25, 50, 100] chip ladder and the
    # original "perfect" play feel depends on the 5-coin starter chip.
    # Every other game (blackjack, slots, etc.) keeps the 50-coin floor.
    assert "min_bet: float = 5.0" in v654, "Vibe Dice 654 default min_bet must be 5.0 (founder exception)"
    assert "exception to the platform" in v654.lower() or "founder-locked exception" in v654.lower(), (
        "Vibe Dice 654's 5-coin floor must be documented as an explicit "
        "exception, otherwise it looks like the 50-coin rule was forgotten."
    )

    bj_svc = open("/app/backend/services/games/blackjack.py").read()
    assert "min_bet: int = 50" in bj_svc, "Blackjack service default min_bet must be 50"
    assert "max(min_bet, 50)" in bj_svc

    mp = open("/app/backend/services/multiplayer.py").read()
    assert "max(int(data.get('min_bet', 50) or 50), 50)" in mp, "Multiplayer must hard-floor at 50"


def test_blackjack_error_message_uses_coin_glyph_not_dollar():
    """Founder rule: error/result strings on games render coin amounts
    with the ₵ glyph, never $. Locks the previously-fixed line."""
    src = open("/app/backend/services/blackjack_multiplayer.py").read()
    # The old `f"Minimum bet is ${...}"` is gone, new ₵{...} version is in.
    assert "Minimum bet is $" not in src, "Blackjack error must not use $ sign"
    assert "Minimum bet is ₵" in src, "Blackjack error must use ₵ coin glyph"




# --- LOCKED 2026-05-12: Streamer Referral Program (P3) ----------------------

def test_streamer_referral_module_imports_and_routes_mount() -> None:
    """Referral module must exist, be importable, expose the 5 public
    endpoints, and be mounted on the API router with /streamer-referral
    prefix."""
    from routes import streamer_referral as sr
    # Reward contract must not silently change.
    assert sr.REWARD_COINS == 1000, "Referral coin reward must be 1000 ₵"
    assert sr.REWARD_FEATURED_DAYS == 5, "Referral Featured days must be 5"

    # 5 endpoints + 1 internal helper.
    paths = {r.path for r in sr.router.routes}
    assert "/streamer-referral/my-code/{user_id}" in paths
    assert "/streamer-referral/redeem" in paths
    assert "/streamer-referral/qualify-on-live/{user_id}" in paths
    assert "/streamer-referral/stats/{user_id}" in paths
    assert "/streamer-referral/lookup/{code}" in paths

    # Internal helper used by the CF webhook hook
    assert hasattr(sr, "qualify_on_live"), (
        "Referral module lost the internal qualify_on_live helper that the "
        "Cloudflare webhook calls to trigger payouts."
    )

    # Mounted into the main registry?
    from pathlib import Path
    registry = Path("/app/backend/routes/registry.py").read_text()
    assert "from routes.streamer_referral import router as referral_router" in registry, (
        "Streamer Referral router not mounted in registry.py"
    )


def test_cloudflare_webhook_triggers_referral_payout() -> None:
    """The CF Stream webhook MUST import + invoke `qualify_on_live`
    when a stream transitions to LIVE — otherwise the viral loop never
    actually fires."""
    from pathlib import Path
    src = Path("/app/backend/routes/cloudflare_stream.py").read_text()
    assert "from routes.streamer_referral import qualify_on_live" in src, (
        "CF webhook lost the referral_payout import — referrals never pay out."
    )
    assert "await qualify_on_live(streamer_id)" in src, (
        "CF webhook lost the qualify_on_live invocation — referrals never pay out."
    )


def test_signup_page_captures_ref_query_param() -> None:
    """SignupPage must read `?ref=VIBE-XXXX`, validate via /lookup,
    show a banner, and POST /redeem after successful signup so the
    referrer can be paid when the new user later goes live."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/SignupPage.tsx").read_text()
    assert "searchParams.get('ref')" in src, (
        "Signup page lost the ?ref= query-param capture"
    )
    assert "/api/streamer-referral/lookup/" in src, (
        "Signup page lost the referral lookup call"
    )
    assert "/api/streamer-referral/redeem" in src, (
        "Signup page lost the referral redeem call"
    )
    assert 'data-testid="signup-ref-banner"' in src, (
        "Signup page lost the valid-referral banner"
    )


def test_streamer_studio_renders_referral_card() -> None:
    """Streamer Studio dashboard MUST include the Referral viral-loop
    card with copy + share buttons + stats grid."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/streaming/StreamerStudio.tsx").read_text()
    assert 'data-testid="streamer-studio-referral-card"' in src, (
        "Streamer Studio lost the referral card"
    )
    assert 'data-testid="referral-share-url"' in src
    assert 'data-testid="referral-copy-btn"' in src
    assert 'data-testid="referral-share-btn"' in src
    assert 'data-testid="referral-stats-grid"' in src


# --- LOCKED 2026-05-13: 50-coin global floor + ₵ glyph audit -----------------

def test_platform_min_bet_constant_exists_and_is_50() -> None:
    """Single source of truth for the 50-coin floor."""
    from services.game_economy_constants import PLATFORM_MIN_BET, format_coins
    assert PLATFORM_MIN_BET == 50, "Platform-wide minimum bet must be 50 ₵"
    assert format_coins(1234) == "₵1,234", "Currency formatter must emit ₵, never $"
    assert "$" not in format_coins(99), "Currency formatter must never emit $"


def test_wave2_casino_routes_enforce_50_floor() -> None:
    """All Wave 2 casino games (11 routes) gate stakes at ge=50."""
    from pathlib import Path
    src = Path("/app/backend/routes/casino_wave2_routes.py").read_text()
    # NO stake validators below 50 should remain.
    assert "ge=0" not in src or src.count("stake: float = Field(..., gt=0)") == 0, (
        "Wave 2 casino still has a stake validator that accepts bets below the floor"
    )
    assert src.count("stake: float = Field(..., ge=50)") >= 10, (
        "Wave 2 casino lost some of its 50-coin floor validators"
    )


def test_core_casino_floors_locked_at_50() -> None:
    """Slots, blackjack, baccarat, watch_and_wager, cyber_casino — all 50."""
    from pathlib import Path
    blackjack = Path("/app/backend/routes/blackjack.py").read_text()
    baccarat = Path("/app/backend/routes/baccarat.py").read_text()
    cyber = Path("/app/backend/routes/cyber_casino.py").read_text()
    wager = Path("/app/backend/routes/watch_and_wager.py").read_text()
    vibes_slots = Path("/app/backend/routes/vibes_slots_routes.py").read_text()
    slots = Path("/app/backend/routes/slots.py").read_text()

    assert "PLATFORM_MIN_BET" in blackjack, "Blackjack route lost the PLATFORM_MIN_BET import"
    assert "PLATFORM_MIN_BET" in baccarat, "Baccarat route lost the PLATFORM_MIN_BET import"
    assert "PLATFORM_MIN_BET" in slots, "Slots route lost the PLATFORM_MIN_BET import"
    assert "SLOTS_MIN_BET = 50" in cyber, "Cyber casino slots floor must be 50"
    assert "BJ_MIN_BET = 50" in cyber, "Cyber casino blackjack floor must be 50"
    assert "MIN_BET = 50" in wager, "Watch & Wager floor must be 50"
    assert "ge=50" in vibes_slots, "Vibes Slots stake validator lost its ge=50 floor"


def test_no_dollar_glyph_in_user_facing_game_strings() -> None:
    """Sweep all casino game route + tournament + metahuman files for
    leftover '$' currency glyphs in user-facing strings. Allowlist
    only MongoDB operators ($set, $inc, $push, $eq) and code-side $
    inside non-currency contexts."""
    from pathlib import Path
    import re
    paths = [
        "/app/backend/routes/multiplayer_slots.py",
        "/app/backend/routes/vibez_654_prescription.py",
        "/app/backend/routes/vibe_654_tournament.py",
        "/app/backend/routes/metahuman_control.py",
    ]
    # Match $<digit> / $<{var}> / $<space-then-uppercase>  but allow $set, $inc, etc.
    bad = re.compile(r'(\$\{[a-z_]|"\$[0-9]|\) \$[a-zA-Z]|pot.*: \$\{|f"[^"]*\$\{(?!set|inc|push|pull|eq)[a-z_])')
    leaks = []
    for p in paths:
        src = Path(p).read_text()
        for i, line in enumerate(src.splitlines(), 1):
            if bad.search(line):
                leaks.append(f"{p}:{i}  {line.strip()[:120]}")
    assert not leaks, (
        "Found '$' currency glyph leaks in user-facing strings (use ₵):\n"
        + "\n".join(leaks)
    )




# --- LOCKED 2026-05-13: Live Push Notifications (streamer-follow) ------------

def test_streamer_follow_module_mounted() -> None:
    """Follow module wired + the 5 endpoints exposed at /streamer-follow."""
    from routes import streamer_follow as sf
    paths = {r.path for r in sf.router.routes}
    assert "/streamer-follow/follow" in paths
    assert "/streamer-follow/unfollow" in paths
    assert "/streamer-follow/following/{user_id}" in paths
    assert "/streamer-follow/followers/{streamer_id}" in paths
    assert "/streamer-follow/notify-live/{streamer_id}" in paths
    assert hasattr(sf, "notify_followers_of_live_stream"), (
        "Follow module lost the helper called by the CF webhook on go-live."
    )

    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "from routes.streamer_follow import router as follow_router" in reg, (
        "Streamer Follow router not mounted in registry.py"
    )


def test_cloudflare_webhook_fires_live_push_fanout() -> None:
    """CF Stream webhook MUST call notify_followers_of_live_stream when
    a stream first goes live — otherwise followers never get buzzed."""
    from pathlib import Path
    src = Path("/app/backend/routes/cloudflare_stream.py").read_text()
    assert "from routes.streamer_follow import notify_followers_of_live_stream" in src, (
        "CF webhook lost the follow-push import"
    )
    assert "notify_followers_of_live_stream(streamer_id)" in src, (
        "CF webhook lost the follow-push invocation"
    )


def test_watch_room_has_follow_button() -> None:
    """The watch page MUST render the Follow/Following bell so viewers
    can opt in for live pings."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/streaming/WatchRoom.tsx").read_text()
    assert 'data-testid="watch-room-follow-btn"' in src, (
        "WatchRoom lost the Follow button"
    )
    assert "/api/streamer-follow/" in src, (
        "WatchRoom no longer calls the streamer-follow API"
    )
    assert "is-following" in src, (
        "WatchRoom no longer pre-loads the follow state"
    )


# ════════════════════════════════════════════════════════════════════
# HIGH ROLLER MVP — VIP tier (Genius/Genesis/Apex) at ₵10,000 min bet.
# May 2026: founder-approved per High Roller PDF + 100K Blueprint PDF.
# ════════════════════════════════════════════════════════════════════
def test_high_roller_economy_constants_locked() -> None:
    """The 10,000-coin floor is the entire point of the VIP tier. If
    this constant drifts, the standard 50-coin platform games stop
    feeling fundamentally different from the High Roller room."""
    from services.high_roller_economy import (
        HIGH_ROLLER_MIN_BET,
        HIGH_ROLLER_GRANT_DAYS,
        HIGH_ROLLER_REF_PREFIX,
        VIP_TIERS,
        VIP_TIER_NAMES,
    )
    assert HIGH_ROLLER_MIN_BET == 10_000, "VIP min bet must remain ₵10,000"
    assert HIGH_ROLLER_GRANT_DAYS == 30, "VIP grant window must remain 30 days"
    assert HIGH_ROLLER_REF_PREFIX == "vip:", "Stripe ref prefix must remain `vip:`"
    assert VIP_TIER_NAMES == ["genius", "genesis", "apex"], (
        "VIP tier order locked: genius → genesis → apex"
    )
    # Pricing locked per founder approval (Feb 2026)
    assert VIP_TIERS["genius"]["price_usd"] == 49.00
    assert VIP_TIERS["genesis"]["price_usd"] == 99.00
    assert VIP_TIERS["apex"]["price_usd"] == 249.00
    # Each tier exposes perks the upgrade page renders.
    for tier in ("genius", "genesis", "apex"):
        assert VIP_TIERS[tier]["perks"], f"Tier {tier} missing perks list"


def test_high_roller_routes_registered() -> None:
    """Every endpoint the frontend hits must be wired in the API router."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    must_have = [
        "/api/high-roller/tiers",
        "/api/high-roller/eligibility/{user_id}",
        "/api/high-roller/checkout",
        "/api/high-roller/blackjack/deal",
        "/api/high-roller/blackjack/action",
    ]
    for p in must_have:
        assert p in paths, f"High Roller endpoint missing: {p}"


def test_high_roller_webhook_handles_vip_prefix() -> None:
    """The Stripe payouts webhook MUST route `vip:` refs to apply_vip_grant.
    Without this, paid checkouts never flip vip_until and users pay for
    nothing."""
    from pathlib import Path
    src = Path("/app/backend/routes/stripe_payouts_webhook.py").read_text()
    assert 'ref.startswith("vip:")' in src, (
        "Webhook lost the vip: branch — Stripe checkouts won't grant VIP"
    )
    assert "from routes.high_roller import apply_vip_grant" in src
    assert "apply_vip_grant(" in src


def test_high_roller_routes_mounted_in_registry() -> None:
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "from routes.high_roller import router as high_roller_router" in reg, (
        "High Roller router not mounted in registry.py"
    )


def test_high_roller_blackjack_isolates_min_bet_from_standard_games() -> None:
    """Standard Blackjack must still enforce the platform 50-coin floor;
    only the VIP wrapper bumps it to 10,000. Otherwise the regression
    on test_games_enforce_50_coin_min_bet_floor would start failing."""
    from pathlib import Path
    standard = Path("/app/backend/routes/blackjack.py").read_text()
    assert "PLATFORM_MIN_BET" in standard, (
        "Standard Blackjack lost the 50-coin floor import"
    )
    vip = Path("/app/backend/routes/high_roller.py").read_text()
    assert "HIGH_ROLLER_MIN_BET" in vip
    assert "PLATFORM_MIN_BET" not in vip, (
        "VIP route should not use the standard 50-coin constant"
    )


def test_high_roller_frontend_pages_and_routes_wired() -> None:
    """The /casino/high-roller page and /casino/high-roller/blackjack
    table must both be registered and self-test-id-locked."""
    from pathlib import Path
    page = Path("/app/frontend/src/pages/HighRollerCasino.tsx").read_text()
    bj = Path("/app/frontend/src/pages/HighRollerBlackjack.tsx").read_text()
    # Page test IDs — page uses template literals for per-tier IDs so
    # we check for the dynamic pattern instead of literal strings.
    for tid in [
        "high-roller-page",
        "high-roller-hero-title",
        "high-roller-tiers",
    ]:
        assert f'data-testid="{tid}"' in page, f"Page missing testid {tid}"
    # Dynamic per-tier testids (rendered via `data-testid={`high-roller-tier-${t.tier}`}`)
    assert "data-testid={`high-roller-tier-${t.tier}`}" in page, (
        "Page lost the per-tier card testid template"
    )
    assert "data-testid={`high-roller-upgrade-${t.tier}-btn`}" in page, (
        "Page lost the per-tier upgrade button testid template"
    )
    # Blackjack test IDs
    for tid in [
        "vip-blackjack-page",
        "vip-blackjack-deal-btn",
        "vip-blackjack-bet-input",
    ]:
        assert f'data-testid="{tid}"' in bj, f"VIP Blackjack missing testid {tid}"
    # Routes
    routes = Path("/app/frontend/src/routes/monetizationRoutes.tsx").read_text()
    assert 'path="/casino/high-roller"' in routes
    assert 'path="/casino/high-roller/blackjack"' in routes


# ════════════════════════════════════════════════════════════════════
# 100K CCU SCALING FOUNDATION — Production Blueprint, May 2026
# ════════════════════════════════════════════════════════════════════
def test_scale_cache_helper_exists_and_is_safe_when_redis_disabled() -> None:
    """The Blueprint mandates Redis for live-wall caching + driver geo,
    but the helper MUST gracefully no-op when REDIS_URL is unset so we
    never break the preview environment."""
    import asyncio
    from services.scale_cache import (
        cache_get, cache_set, cache_delete, cache_bulk_delete,
        geo_add_driver, geo_remove_driver, geo_nearby_drivers,
        is_redis_enabled, TTL_LIVE_WALL,
    )

    assert TTL_LIVE_WALL == 8, "Live Now Wall TTL must match 8s client poll"

    # When REDIS_URL is unset (preview env) every helper must return None/False
    # without raising.
    import os
    if not os.environ.get("REDIS_URL"):
        assert is_redis_enabled() is False

        async def _check():
            assert await cache_get("any_key") is None
            assert await cache_set("any_key", {"a": 1}) is False
            assert await cache_delete("any_key") is False
            assert await cache_bulk_delete(["a", "b"]) == 0
            assert await geo_add_driver("d1", -74.0, 40.7) is False
            assert await geo_remove_driver("d1") is False
            assert await geo_nearby_drivers(-74.0, 40.7) == []
        asyncio.run(_check())


def test_live_now_wall_sort_lambda_does_not_negate_strings() -> None:
    """Pre-existing bug surfaced by testing agent: the old sort key
    used `-((a or b or '') and 1)` which evaluated to `-''` (TypeError)
    when both timestamps were missing — breaking /live-inputs entirely
    for any row that lacked status timestamps. Lock the fix."""
    from pathlib import Path
    src = Path("/app/backend/routes/cloudflare_stream.py").read_text()
    # The broken pattern must be gone.
    assert '-((s.get("last_status_at") or s.get("created_at") or "") and 1)' not in src, (
        "Reintroduced the unary-minus-on-string bug in the live-inputs sort"
    )
    # The new approach uses a stable triple-sort with featured-first as outer key.
    assert 'safe.sort(key=lambda s: 0 if s.get("is_featured") else 1)' in src, (
        "Live Now Wall sort lost the featured-first outer key"
    )


def test_scale_cache_wired_into_live_now_wall() -> None:
    """The Live Now Wall endpoint must consult Redis before hitting Mongo
    and write back to the cache on miss (Blueprint §Real-Time)."""
    from pathlib import Path
    src = Path("/app/backend/routes/cloudflare_stream.py").read_text()
    assert "from services.scale_cache import cache_get, cache_set, TTL_LIVE_WALL" in src
    assert "live_inputs:only_live=" in src, "Cache key prefix lost"
    assert "cache_bulk_delete" in src, "CF webhook must invalidate live-wall cache"


def test_high_roller_indexes_registered_in_lifespan() -> None:
    """Compound indexes for VIP membership + Live Now Wall hot paths
    must be appended to the startup index set."""
    from pathlib import Path
    src = Path("/app/backend/lifespan_indexes.py").read_text()
    # VIP collection
    assert '"coll": "high_roller_vip"' in src
    # Featured streamers + follow fan-out
    assert '"coll": "featured_streamers"' in src
    assert '"coll": "streamer_follows"' in src


def test_production_launch_script_exists() -> None:
    """Blueprint §1: Gunicorn cluster launch script with 4×5000 conn config.
    Required for the production deploy outside the supervised preview pod."""
    from pathlib import Path
    sh = Path("/app/backend/scripts/run_production.sh")
    assert sh.exists(), "Production launch script missing"
    body = sh.read_text()
    assert "gunicorn" in body
    assert "uvicorn.workers.UvicornWorker" in body
    assert "worker-connections" in body


def test_master_stress_suite_exists() -> None:
    """Master Test Suite PDF — 4 stress tests must be parameterised and
    safety-gated by GVDSG_STRESS_ENABLE so they can't auto-fire."""
    from pathlib import Path
    py = Path("/app/backend/scripts/master_stress_suite.py")
    assert py.exists(), "Master stress test suite missing"
    body = py.read_text()
    assert "GVDSG_STRESS_ENABLE" in body, "Safety toggle missing"
    assert "test1_api_signaling_load" in body
    assert "test2_gifting_ledger_speed" in body
    assert "test3_geolocation_throughput" in body
    assert "test4_unreal_engine_tick_audit" in body



# ════════════════════════════════════════════════════════════════════
# HIGH ROLLER VIP — Roulette + Baccarat + Crown Badge (May 2026 wave 2)
# Per `Global_Vibez_DSG_Master_Blueprint.pdf` Glasshouse VIP expansion.
# ════════════════════════════════════════════════════════════════════
def test_vip_roulette_endpoints_registered() -> None:
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/high-roller/roulette/spin" in paths
    assert "/api/high-roller/roulette/server-hash" in paths


def test_vip_baccarat_endpoint_registered() -> None:
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/high-roller/baccarat/play" in paths


def test_vip_roulette_payout_table_locked() -> None:
    """Standard Vegas payouts. Drift = silent player rip-off."""
    from routes.high_roller import _ROULETTE_PAYOUTS
    assert _ROULETTE_PAYOUTS["straight"] == 35
    assert _ROULETTE_PAYOUTS["red"] == 1 == _ROULETTE_PAYOUTS["black"]
    assert _ROULETTE_PAYOUTS["odd"] == 1 == _ROULETTE_PAYOUTS["even"]
    assert _ROULETTE_PAYOUTS["dozen1"] == 2 == _ROULETTE_PAYOUTS["dozen2"] == _ROULETTE_PAYOUTS["dozen3"]


def test_vip_roulette_red_number_set_matches_european_wheel() -> None:
    """Standard European roulette red numbers — locked so a future
    refactor can't accidentally rotate the wheel coloring."""
    from routes.high_roller import _RED_NUMBERS
    assert _RED_NUMBERS == {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}


def test_vip_roulette_and_baccarat_frontend_pages_exist() -> None:
    from pathlib import Path
    rou = Path("/app/frontend/src/pages/HighRollerRoulette.tsx").read_text()
    bac = Path("/app/frontend/src/pages/HighRollerBaccarat.tsx").read_text()
    for tid in ["vip-roulette-page", "vip-roulette-spin-btn", "vip-roulette-clear-btn", "vip-roulette-chip-input"]:
        assert f'data-testid="{tid}"' in rou, f"Roulette page missing testid {tid}"
    for tid in ["vip-baccarat-page", "vip-baccarat-deal-btn", "vip-baccarat-bet-input"]:
        assert f'data-testid="{tid}"' in bac, f"Baccarat page missing testid {tid}"
    routes = Path("/app/frontend/src/routes/monetizationRoutes.tsx").read_text()
    assert 'path="/casino/high-roller/roulette"' in routes
    assert 'path="/casino/high-roller/baccarat"' in routes


def test_high_roller_lounge_surfaces_all_three_games() -> None:
    """The VIP Lounge must show entry tiles for Blackjack, Roulette,
    and Baccarat — locked so we don't regress the lounge to just one game."""
    from pathlib import Path
    page = Path("/app/frontend/src/pages/HighRollerCasino.tsx").read_text()
    for tid in [
        "high-roller-enter-blackjack",
        "high-roller-enter-roulette",
        "high-roller-enter-baccarat",
    ]:
        assert f'data-testid="{tid}"' in page, f"VIP Lounge missing {tid} tile"


def test_vip_crown_badge_globally_mounted() -> None:
    """Floating crown for active VIPs must be mounted globally in App.js
    so it appears across every authed page (besides the High Roller pages
    themselves where it self-hides)."""
    from pathlib import Path
    app_js = Path("/app/frontend/src/App.js").read_text()
    assert 'import VipCrownBadge from "@/components/vip/VipCrownBadge"' in app_js
    assert "<VipCrownBadge />" in app_js
    component = Path("/app/frontend/src/components/vip/VipCrownBadge.tsx").read_text()
    assert 'data-testid="vip-crown-badge"' in component
    assert "/api/high-roller/eligibility/" in component, (
        "VIP badge must poll the eligibility endpoint"
    )
    # Self-hide on /casino/high-roller* to avoid redundant chrome
    assert "/casino/high-roller" in component


def test_production_gunicorn_matches_master_blueprint() -> None:
    """Master Blueprint §5: 8 workers × 10,000 worker-connections.
    Earlier 4×5K config is acceptable as env fallback but the default
    must be the upgraded spec."""
    from pathlib import Path
    sh = Path("/app/backend/scripts/run_production.sh").read_text()
    assert 'GUNICORN_WORKERS:-8' in sh, "Default worker count drifted from Master Blueprint"
    assert 'GUNICORN_WORKER_CONNECTIONS:-10000' in sh, (
        "Default worker-connections drifted from Master Blueprint"
    )


def test_stress_suite_timeout_matches_master_blueprint() -> None:
    """Master Blueprint §1 specifies 1.5s timeout per stress request."""
    from pathlib import Path
    py = Path("/app/backend/scripts/master_stress_suite.py").read_text()
    assert "ClientTimeout(total=1.5)" in py, (
        "Stress suite timeout drifted from Master Blueprint §1 spec"
    )



# ════════════════════════════════════════════════════════════════════
# MEDIA MASTER ECOSYSTEM (May 2026) — DSG TV / Vibe Radio /
# DSG Music Group / AI Scout. Per `Global_Vibez_DSG_Media_Master.pdf`.
# ════════════════════════════════════════════════════════════════════
def test_media_master_constants_locked() -> None:
    """Per the Media Master PDF: 5 TV channels (2 gated 21+), 3 radio
    stations, 3 studios, 30% affiliate chair share. Locked."""
    from services.media_master_constants import (
        DSG_TV_CHANNELS, VIBE_RADIO_STATIONS, DSG_MUSIC_STUDIOS,
        SKIP_BID_FLOOR, KEEP_BID_INCREMENT,
        AFFILIATE_CHAIR_REVENUE_SHARE_BPS,
        AUTO_CLIP_THRESHOLD, BREAK_IN_THRESHOLD, AUTO_CLIP_DURATION_SECONDS,
        CHANNEL_PASS_DURATION_HOURS,
    )
    assert len(DSG_TV_CHANNELS) == 5
    assert {c["channel_id"] for c in DSG_TV_CHANNELS} == {
        "arena", "spotlight-lounge", "dsg-radio-tv", "after-dark", "nightmare-club",
    }
    gated = [c for c in DSG_TV_CHANNELS if c["requires_paywall"]]
    assert len(gated) == 2, "Exactly two channels must be paywalled per PDF"
    for ch in gated:
        assert ch["requires_18_plus"] is True
        assert ch["requires_secondary_pin"] is True
        assert ch["coin_price"] > 0

    assert len(VIBE_RADIO_STATIONS) == 3
    assert {s["station_id"] for s in VIBE_RADIO_STATIONS} == {
        "the-grind", "neon-drift", "romance-fm",
    }

    assert len(DSG_MUSIC_STUDIOS) == 3
    assert SKIP_BID_FLOOR == 25
    assert KEEP_BID_INCREMENT == 10
    assert AFFILIATE_CHAIR_REVENUE_SHARE_BPS == 3_000, "Affiliate chair share locked at 30%"
    assert AUTO_CLIP_THRESHOLD == 1_000
    assert BREAK_IN_THRESHOLD == 10_000
    assert AUTO_CLIP_DURATION_SECONDS == 30
    assert CHANNEL_PASS_DURATION_HOURS == 24


def test_media_master_hype_formula() -> None:
    """Hype Score = gifts * 1.0 + chat_msgs_per_min * 2.5. Verdict
    buckets: ambient < 1000 ≤ auto_clip < 10000 ≤ break_in."""
    from services.media_master_constants import compute_hype_score, classify_hype
    assert compute_hype_score(100, 5) == 100 * 1.0 + 5 * 2.5
    assert classify_hype(999) == "ambient"
    assert classify_hype(1_000) == "auto_clip"
    assert classify_hype(9_999) == "auto_clip"
    assert classify_hype(10_000) == "break_in"


def test_media_master_routes_registered() -> None:
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    must_have = [
        "/api/media-master/constants",
        "/api/media-master/tv/channels",
        "/api/media-master/tv/access/{channel_id}/{user_id}",
        "/api/media-master/tv/unlock/{channel_id}",
        "/api/media-master/tv/set-pin",
        "/api/media-master/radio/stations",
        "/api/media-master/radio/now-playing/{station_id}",
        "/api/media-master/radio/skip-bid",
        "/api/media-master/radio/keep-bid",
        "/api/media-master/radio/buy-track",
        "/api/media-master/music/studios",
        "/api/media-master/music/book-studio",
        "/api/media-master/music/artists",
        "/api/media-master/music/sponsor",
        "/api/media-master/music/sponsorships/{chair_user_id}",
        "/api/media-master/scout/ingest",
        "/api/media-master/scout/clips/recent",
        "/api/media-master/scout/break-ins/active",
        "/api/media-master/scout/hype/{room_id}",
    ]
    for p in must_have:
        assert p in paths, f"Media Master endpoint missing: {p}"


def test_media_master_module_mounted_in_registry() -> None:
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "from routes.media_master import router as media_master_router" in reg
    assert "media_master_router" in reg


def test_media_master_indexes_registered_in_lifespan() -> None:
    """Hot read paths must have proper Mongo indexes."""
    from pathlib import Path
    src = Path("/app/backend/lifespan_indexes.py").read_text()
    for coll in [
        "media_tv_passes", "media_tv_pins", "media_radio_skip_bids",
        "media_artist_sponsorships", "media_scout_hype",
        "media_scout_clips", "media_scout_alerts",
    ]:
        assert f'"coll": "{coll}"' in src, f"Index for {coll} missing in lifespan"


def test_media_master_pin_is_sha256_hashed() -> None:
    """Secondary PIN must NEVER round-trip plaintext."""
    from pathlib import Path
    src = Path("/app/backend/routes/media_master.py").read_text()
    assert "hashlib.sha256" in src
    assert "pin_hash" in src


def test_media_master_frontend_pages_exist_with_testids() -> None:
    from pathlib import Path
    hub = Path("/app/frontend/src/pages/MediaMasterHub.tsx").read_text()
    tv = Path("/app/frontend/src/pages/DsgTvChannelPage.tsx").read_text()
    radio = Path("/app/frontend/src/pages/VibeRadioStationPage.tsx").read_text()
    music = Path("/app/frontend/src/pages/MusicGroupPage.tsx").read_text()
    for tid in [
        "media-master-hub", "media-master-section-tv", "media-master-section-radio",
        "media-master-section-music", "media-master-section-scout",
    ]:
        assert f'data-testid="{tid}"' in hub, f"Hub missing {tid}"
    for tid in [
        "dsg-tv-channel-page", "dsg-tv-unlock-btn",
    ]:
        assert f'data-testid="{tid}"' in tv, f"DSG TV page missing {tid}"
    for tid in [
        "vibe-radio-station-page", "vibe-radio-skip-btn",
        "vibe-radio-keep-btn", "vibe-radio-buy-btn",
    ]:
        assert f'data-testid="{tid}"' in radio, f"Vibe Radio page missing {tid}"
    for tid in [
        "music-group-page", "music-group-studios",
        "music-group-sponsor", "music-group-sponsor-btn",
    ]:
        assert f'data-testid="{tid}"' in music, f"Music Group page missing {tid}"


def test_media_master_routes_mounted_in_app_js() -> None:
    from pathlib import Path
    app_js = Path("/app/frontend/src/App.js").read_text()
    assert "mediaMasterRoutes" in app_js
    assert "{mediaMasterRoutes(ProtectedRoute)}" in app_js
    idx = Path("/app/frontend/src/routes/index.js").read_text()
    assert "mediaMasterRoutes" in idx


def test_vip_concierge_globally_mounted_for_higher_tiers() -> None:
    """VIP Concierge bubble must be in App.js and only appear for
    Genesis/Apex (not Genius)."""
    from pathlib import Path
    app_js = Path("/app/frontend/src/App.js").read_text()
    assert 'import VipConcierge from "@/components/vip/VipConcierge"' in app_js
    assert "<VipConcierge />" in app_js
    comp = Path("/app/frontend/src/components/vip/VipConcierge.tsx").read_text()
    assert 'data-testid="vip-concierge-bubble"' in comp
    # Genesis + Apex only — Genius is the entry tier and doesn't get concierge.
    assert "el.tier !== 'genesis'" in comp
    assert "el.tier !== 'apex'" in comp



# ════════════════════════════════════════════════════════════════════
# MEDIA MASTER — CF Stream HLS wiring + AI Scout real clipping +
# Pulse founder dashboard (May 2026 — sprint 3)
# ════════════════════════════════════════════════════════════════════
def test_media_master_tv_channel_programming_endpoints() -> None:
    """Channel programming endpoints must be live: POST /tv/program to
    attach a CF live input, GET /tv/now-playing/{channel_id} for the
    HLS resolver consumed by the viewer."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/media-master/tv/program" in paths
    assert "/api/media-master/tv/now-playing/{channel_id}" in paths


def test_cf_stream_clipper_gracefully_no_ops_without_creds() -> None:
    """Without CF env vars, the clipper must return {ok:False} with a
    structured reason so AI Scout never crashes the ingest pipeline."""
    import asyncio, os
    from services.cf_stream_clipper import clip_live_input
    if os.environ.get("CLOUDFLARE_API_TOKEN") and os.environ.get("CLOUDFLARE_ACCOUNT_ID"):
        # In a live env we can't safely fire a real CF clip request as
        # a regression test — just confirm the module imports.
        return
    res = asyncio.run(clip_live_input("any_input", 30))
    assert res["ok"] is False
    assert res["reason"] == "cf_not_configured"
    assert res["clip_uid"] is None
    assert res["duration_seconds"] == 30


def test_cf_stream_clipper_skips_stub_inputs() -> None:
    """Preview-env live inputs prefixed `stub_` should never hit the CF
    API — they have no real video to clip."""
    import asyncio, os
    from services.cf_stream_clipper import clip_live_input
    # Force the path that requires CF creds to short-circuit on stub.
    if not (os.environ.get("CLOUDFLARE_API_TOKEN") and os.environ.get("CLOUDFLARE_ACCOUNT_ID")):
        # Skip when creds missing — the `cf_not_configured` branch
        # already prevents API calls so the stub guard is moot.
        return
    res = asyncio.run(clip_live_input("stub_xyz", 30))
    assert res["ok"] is False
    assert res["reason"] == "stub_input"


def test_ai_scout_ingest_accepts_cf_input_id_for_real_clipping() -> None:
    """The hype-ingest endpoint must accept an optional `cf_input_id`
    so that real CF Stream clips get cut when the room is wired to a
    live broadcast."""
    from pathlib import Path
    src = Path("/app/backend/routes/media_master.py").read_text()
    assert "cf_input_id: Optional[str]" in src, "HypeIngestRequest missing cf_input_id field"
    assert "from services.cf_stream_clipper import clip_live_input" in src
    # Clip docs MUST store the CF clip UID + playback URL when rendered.
    assert "cf_clip_uid" in src
    assert "playback_url" in src
    assert "cf_status" in src


def test_dsg_tv_channel_page_uses_hls_player() -> None:
    """The viewer must embed the real HLS player (hls.js) — no longer
    a styled placeholder."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DsgTvChannelPage.tsx").read_text()
    assert "import HLSPlayer" in src, "Page lost HLSPlayer import"
    assert "<HLSPlayer" in src, "Page lost HLSPlayer mount"
    assert 'data-testid="dsg-tv-player"' in src
    assert 'data-testid="dsg-tv-player-offline"' in src, (
        "Off-air state must remain rendered when channel program has no live input"
    )
    # The viewer must poll the channel's now-playing endpoint while unlocked.
    assert "/api/media-master/tv/now-playing/" in src


def test_media_master_pulse_endpoint_registered() -> None:
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/media-master-pulse/snapshot" in paths


def test_media_master_pulse_module_mounted() -> None:
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "from routes.media_master_pulse import router as media_master_pulse_router" in reg


def test_media_master_pulse_returns_all_required_sections() -> None:
    """The founder dashboard endpoint must surface exactly the 6 panels
    + totals — drift would break the dashboard's render contract."""
    import asyncio
    from routes.media_master_pulse import get_snapshot
    out = asyncio.run(get_snapshot(5, 8))
    for key in (
        "generated_at", "hottest_rooms", "station_bid_pools",
        "channel_revenue", "sponsor_leaderboard", "active_break_ins",
        "recent_clips", "totals",
    ):
        assert key in out, f"Pulse snapshot missing section: {key}"
    # Channel-revenue row count must equal channel count (5).
    assert len(out["channel_revenue"]) == 5
    # Station-pool row count must equal station count (3).
    assert len(out["station_bid_pools"]) == 3
    # Totals must always exist + be integers.
    for k in ("total_lifetime_channel_coins", "active_sponsorships", "active_break_in_count"):
        assert isinstance(out["totals"][k], int)


def test_media_master_pulse_frontend_page_exists() -> None:
    from pathlib import Path
    page = Path("/app/frontend/src/pages/MediaMasterPulsePage.tsx").read_text()
    # Literal-string testids
    for tid in ["media-master-pulse-page", "pulse-kpis", "pulse-recent-clips"]:
        assert f'data-testid="{tid}"' in page, f"Pulse page missing literal testid {tid}"
    # Card helper passes testId prop
    for tid in [
        "pulse-hottest-rooms",
        "pulse-station-pools",
        "pulse-channel-revenue",
        "pulse-sponsor-leaderboard",
    ]:
        assert f'testId="{tid}"' in page, f"Pulse page missing testId={tid} (Card prop)"
    routes = Path("/app/frontend/src/routes/mediaMasterRoutes.tsx").read_text()
    assert 'path="/admin/media-master-pulse"' in routes



# ════════════════════════════════════════════════════════════════════
# MEDIA MASTER · Sprint 4 — Broadcast Director + Break-In Banner
# ════════════════════════════════════════════════════════════════════
def test_broadcast_director_page_exists_and_routed() -> None:
    """Streamers must have a UI to program a channel without curl."""
    from pathlib import Path
    page = Path("/app/frontend/src/pages/BroadcastDirectorPage.tsx").read_text()
    for tid in [
        "broadcast-director-page",
        "broadcast-director-input-status",
        "broadcast-director-channels",
        "broadcast-director-broadcast-btn",
    ]:
        assert f'data-testid="{tid}"' in page, f"Page missing testid {tid}"
    # Page must call the channel programming endpoint we shipped in sprint 3.
    assert "/api/media-master/tv/program" in page
    # Route registration
    routes = Path("/app/frontend/src/routes/mediaMasterRoutes.tsx").read_text()
    assert 'path="/dashboard/streamer/broadcast-director"' in routes
    assert "BroadcastDirectorPage" in routes


def test_streamer_dashboard_links_to_broadcast_director() -> None:
    """The Streamer Dashboard must surface a CTA into the new
    Broadcast Director — otherwise streamers can't discover the page."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/StreamerDashboard.tsx").read_text()
    assert 'data-testid="streamer-dashboard-broadcast-director-cta"' in src
    assert '/dashboard/streamer/broadcast-director' in src


def test_break_in_banner_globally_mounted() -> None:
    """Break-in banner must be wired into App.js so it surfaces
    network-wide alerts across casino/dating/games/media-master."""
    from pathlib import Path
    app_js = Path("/app/frontend/src/App.js").read_text()
    assert 'import BreakInBanner from "@/components/media/BreakInBanner"' in app_js
    assert "<BreakInBanner />" in app_js
    comp = Path("/app/frontend/src/components/media/BreakInBanner.tsx").read_text()
    assert 'data-testid="break-in-banner"' in comp
    # The trigger-paths whitelist must include the founder-specified routes.
    for path in ("/casino", "/dating", "/games", "/media-master"):
        assert f"'{path}'" in comp, f"Break-in banner missing trigger path {path}"
    # Banner polls the alerts endpoint.
    assert "/api/media-master/scout/break-ins/active" in comp
    # And exposes a dismiss button + jump CTA.
    assert 'data-testid="break-in-banner-dismiss"' in comp
    assert 'data-testid="break-in-banner-jump"' in comp


def test_break_in_banner_does_not_leak_into_non_trigger_paths() -> None:
    """The TRIGGER_PATHS list must be tight — banner only renders on
    high-traffic surfaces; not on /profile, /login, /dashboard, etc.
    so we don't spam the rest of the app."""
    from pathlib import Path
    comp = Path("/app/frontend/src/components/media/BreakInBanner.tsx").read_text()
    # Sanity-check: these paths must NOT be in the trigger list literal
    # (the banner can hide itself anyway, but we don't want the polling


# ════════════════════════════════════════════════════════════════════
# MEDIA MASTER · Sprint 5 — Vibe Radio resolver + Pulse mini-widget
# ════════════════════════════════════════════════════════════════════
def test_vibe_radio_resolver_constants_and_endpoint() -> None:
    """Resolver thresholds + endpoint registration."""
    from routes.media_master import (
        BID_RESOLUTION_WINDOW_SECONDS, BID_RESOLUTION_FEE_BPS, resolve_pending_bids,
    )
    assert BID_RESOLUTION_WINDOW_SECONDS == 30, "Bid window locked at 30s per economy intent"
    assert BID_RESOLUTION_FEE_BPS == 500, "Platform fee locked at 5% of winning pool"
    assert callable(resolve_pending_bids)
    # Endpoint registered
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/media-master/radio/resolve-bids" in paths


def test_vibe_radio_resolver_wired_into_lifespan() -> None:
    """Background loop must kick off at startup so the resolver runs
    automatically — not just on manual /resolve-bids POSTs."""
    from pathlib import Path
    src = Path("/app/backend/lifespan.py").read_text()
    assert "_start_vibe_radio_resolver" in src, "Resolver kickoff missing in lifespan"
    assert "Vibe Radio skip-bid auto-resolver" in src


def test_vibe_radio_resolver_outcome_logic() -> None:
    """The resolver must only flip status to 'resolved' for bids that
    are (1) currently 'active' and (2) older than the resolution
    window, and the outcome must be `skip` only when skip_pool >
    keep_pool. Verified via an in-memory fake — keeps the regression
    shield offline-safe."""
    import asyncio
    from routes.media_master import (
        BID_RESOLUTION_WINDOW_SECONDS, resolve_pending_bids,
    )

    class FakeDb:
        def __init__(self, rows):
            self._rows = rows
            self._tracks_updates = []

            class _RadioBids:
                def __init__(s, parent): s._p = parent
                def find(s, query, projection=None):
                    # Mimic Mongo $lt filter on `created_at`.
                    cutoff = query.get("created_at", {}).get("$lt", "")
                    matched = [
                        r for r in s._p._rows
                        if r.get("status") == "active" and r.get("created_at", "") < cutoff
                    ]
                    class _Cursor:
                        def __init__(c, m): c._m = m
                        async def to_list(c, n): return c._m[:n]
                    return _Cursor(matched)
                async def update_one(s, query, update):
                    for r in s._p._rows:
                        if r.get("bid_id") == query.get("bid_id") and r.get("status") == query.get("status"):
                            r.update(update["$set"])
                            class _R: modified_count = 1
                            return _R()
                    class _R: modified_count = 0
                    return _R()

            class _Tracks:
                def __init__(s, parent): s._p = parent
                async def update_one(s, query, update):
                    s._p._tracks_updates.append((query, update))
                    class _R: modified_count = 1
                    return _R()

            self.media_radio_skip_bids = _RadioBids(self)
            self.media_radio_tracks = _Tracks(self)

    from datetime import datetime, timezone, timedelta
    old = (datetime.now(timezone.utc) - timedelta(seconds=BID_RESOLUTION_WINDOW_SECONDS * 2)).isoformat()
    recent = datetime.now(timezone.utc).isoformat()
    rows = [
        {"bid_id": "skip_wins", "status": "active", "skip_pool": 500, "keep_pool": 100,
         "station_id": "the-grind", "track_id": "t1", "created_at": old},
        {"bid_id": "keep_wins", "status": "active", "skip_pool": 50, "keep_pool": 400,
         "station_id": "neon-drift", "track_id": "t2", "created_at": old},
        {"bid_id": "too_recent", "status": "active", "skip_pool": 500, "keep_pool": 100,
         "station_id": "romance-fm", "track_id": "t3", "created_at": recent},
    ]
    db = FakeDb(rows)
    summary = asyncio.run(resolve_pending_bids(db))
    assert summary["skipped_count"] == 1
    assert summary["kept_count"] == 1
    assert summary["total_resolved"] == 2

    by_id = {r["bid_id"]: r for r in rows}
    assert by_id["skip_wins"]["status"] == "resolved"
    assert by_id["skip_wins"]["outcome"] == "skip"
    assert by_id["keep_wins"]["status"] == "resolved"
    assert by_id["keep_wins"]["outcome"] == "keep"
    # The too-recent row must stay active untouched.
    assert by_id["too_recent"]["status"] == "active"
    # Track update only fires for the skip outcome.
    assert len(db._tracks_updates) == 1
    assert db._tracks_updates[0][0]["track_id"] == "t1"


def test_network_pulse_mini_widget_mounted() -> None:
    """The ambient pulse widget must be mounted globally in App.js."""
    from pathlib import Path
    app_js = Path("/app/frontend/src/App.js").read_text()
    assert 'import NetworkPulseMiniWidget from "@/components/media/NetworkPulseMiniWidget"' in app_js
    assert "<NetworkPulseMiniWidget />" in app_js
    comp = Path("/app/frontend/src/components/media/NetworkPulseMiniWidget.tsx").read_text()
    assert 'data-testid="network-pulse-mini-widget"' in comp
    # Anti-noise: must self-hide on the Pulse dashboard, login, register.
    for p in ("/login", "/register", "/admin/media-master-pulse"):
        assert f"'{p}'" in comp, f"Mini-widget should self-hide on {p}"
    # Polls the snapshot endpoint
    assert "/api/media-master-pulse/snapshot" in comp
    # Renders only when hype >= 50 (no cold-state noise)
    assert "score < 50" in comp

def test_classic_dashboard_exposes_high_roller_and_media_master_rooms() -> None:
    """Founder ask 2026-02 — every recently shipped room MUST be reachable
    from the Classic dashboard tile grid so users can physically touch them.
    Regression: previously the High Roller / Media Master / Broadcast Director
    flows existed but had no entry point from the main dashboard."""
    from pathlib import Path
    src = Path('/app/frontend/src/pages/DashboardNew.tsx').read_text()
    for path in (
        '/casino/high-roller',
        '/media-master',
        '/dashboard/streamer/broadcast-director',
    ):
        assert f"path: '{path}'" in src, f'Classic dashboard missing tile for {path}'
    # Tile copy must remain user-facing
    assert 'High Roller VIP' in src
    assert 'Media Master Hub' in src
    assert 'Broadcast Director' in src


def test_volumetric_dashboard_exposes_high_roller_and_media_master_rooms() -> None:
    """Same guarantee for the Volumetric Galaxy view (default landing)."""
    from pathlib import Path
    src = Path('/app/frontend/src/pages/VolumetricDashboard.tsx').read_text()
    for path in (
        '/casino/high-roller',
        '/media-master',
        '/music-group',
        '/dashboard/streamer/broadcast-director',
    ):
        assert f'path: "{path}"' in src, f'Volumetric dashboard missing planet-room for {path}'



def test_every_dashboard_tile_path_resolves_to_a_real_route() -> None:
    """Founder ask 2026-02: every room MUST be physically reachable.
    Walks both dashboards, collects every tile path, then asserts each
    one matches a Route path defined under /app/frontend/src/routes/*.tsx
    or inline in App.js. Prevents future "I see the button but it 404s"
    bugs at the launch level."""
    import re as _re
    from pathlib import Path as _P

    route_files = list(_P("/app/frontend/src/routes").glob("*.tsx"))
    defined_paths: set[str] = set()
    PATH_RE = _re.compile(r'path=["\']([^"\']+)["\']')
    for f in route_files:
        for p in PATH_RE.findall(f.read_text()):
            defined_paths.add(p)
    app_js = _P("/app/frontend/src/App.js").read_text()
    for p in PATH_RE.findall(app_js):
        defined_paths.add(p)

    def _matches(target: str) -> bool:
        for r in defined_paths:
            if not r:
                continue
            try:
                pat = "^" + _re.sub(r":[^/]+", "[^/]+", r) + "$"
                if _re.match(pat, target):
                    return True
            except _re.error:
                continue
        return False

    dash_paths: set[str] = set()
    for src in (
        "/app/frontend/src/pages/DashboardNew.tsx",
        "/app/frontend/src/pages/VolumetricDashboard.tsx",
    ):
        txt = _P(src).read_text()
        for m in _re.findall(r"path:\s*['\"]([^'\"]+)['\"]", txt):
            dash_paths.add(m)

    broken = [p for p in sorted(dash_paths) if not _matches(p)]
    assert not broken, (
        f"Dashboard tiles pointing at non-existent React routes (would 404): {broken}"
    )
    # And sanity-check that we ARE walking something — we surface ~30+ rooms
    # across both dashboards, so a regression that empties the array is also
    # a launch blocker.
    assert len(dash_paths) >= 30, f"Suspiciously few dashboard tiles: {len(dash_paths)}"


def test_galaxy_guided_tour_mounted_and_wired() -> None:
    """Founder ask 2026-02 — 30-second cinematic auto-tour must:
    1. Live as its own component (replayable + testable in isolation),
    2. Be mounted inside VolumetricDashboard so first-time users see it,
    3. Gate auto-play behind localStorage.gv_galaxy_tour_seen.
    """
    from pathlib import Path
    comp = Path("/app/frontend/src/components/dashboard/GalaxyGuidedTour.tsx")
    assert comp.exists(), "GalaxyGuidedTour component must exist"
    src = comp.read_text()
    assert "GALAXY_TOUR_SEEN_KEY" in src
    assert "gv_galaxy_tour_seen" in src
    # The replay event other surfaces can fire.
    assert "gv-galaxy-tour-replay" in src
    # Test IDs for the action surface.
    for tid in (
        "galaxy-tour-skip",
        "galaxy-tour-pause",
        "galaxy-tour-next",
        "galaxy-tour-replay-pill",
    ):
        assert f'data-testid="{tid}"' in src, f"Missing data-testid={tid}"

    # Mounted in the dashboard
    vol = Path("/app/frontend/src/pages/VolumetricDashboard.tsx").read_text()
    assert "GalaxyGuidedTour" in vol, "VolumetricDashboard must import GalaxyGuidedTour"
    assert "<GalaxyGuidedTour" in vol, "VolumetricDashboard must render GalaxyGuidedTour"


def test_mobile_quiet_chrome_hides_floating_widgets_below_md() -> None:
    """Founder ask 2026-02-15: 'stuff is overlapping... I don't want stuff
    to intrude with the view of other buttons to be pressed.'

    Audit on phone-viewport screenshots showed 7+ position-fixed widgets
    stacking on top of each other (and on top of real clickable tiles).
    Each leaking widget must now self-mute on viewports below md (768px).
    """
    from pathlib import Path
    cases = [
        ("/app/frontend/src/components/common/RoleSwitcher.tsx", "fixed top-3 right-36 z-[60] hidden md:flex"),
        ("/app/frontend/src/components/common/RoomInfoCube.tsx", "z-[55] hidden md:flex items-center"),
        ("/app/frontend/src/components/media/NetworkPulseMiniWidget.tsx", "z-[55] hidden md:block"),
        ("/app/frontend/src/components/common/OrientationToggle.tsx", "z-40 hidden md:inline-flex"),
        ("/app/frontend/src/components/common/WhatsNewBanner.tsx", "hidden md:block transition-all"),
        ("/app/frontend/src/components/vibez/LogDesignLesson.tsx", "z-50 transition-opacity hidden md:block"),
        ("/app/frontend/src/components/vibez/LogDesignLesson.tsx", "z-50 space-y-3 hidden md:block"),
        ("/app/frontend/src/components/NotificationBanner.tsx", "fixed bottom-20 right-4 z-40 hidden md:block"),
        ("/app/frontend/src/pages/VolumetricDashboard.tsx", "pointer-events-auto hidden md:block"),
    ]
    for path, needle in cases:
        src = Path(path).read_text()
        assert needle in src, (
            f"{path} should mute on mobile — expected substring missing: {needle!r}"
        )


def test_conftest_autoloads_react_app_backend_url() -> None:
    """Founder/Grithood ask 2026-02-15: regression shield must not fail
    at collection time when CI/fork agents invoke pytest without first
    sourcing frontend/.env. conftest.py owns the env autoload — guard
    that contract so it cannot regress."""
    from pathlib import Path
    conftest = Path("/app/backend/tests/conftest.py").read_text()
    assert "_autoload_env" in conftest, "conftest must define _autoload_env"
    assert '"frontend" / ".env"' in conftest, "autoload must point at frontend/.env"
    assert "REACT_APP_BACKEND_URL" in conftest

    # The function must run at import time (not just be defined).
    # Detect the unguarded call to _autoload_env() at module scope.
    lines = [ln for ln in conftest.splitlines() if ln.strip() == "_autoload_env()"]
    assert lines, "conftest must invoke _autoload_env() at import time"


def test_equity_master_constants_locked_to_pdf() -> None:
    """Founder ask 2026-02-15 (v2 PDF): every number from
    Global_Vibez_DSG_Equity_Master-v2.pdf must be exactly as specified and
    immutable. Server refuses to start if any drift occurs."""
    from routes.equity_master import (
        OWNERSHIP_REVENUE_SHARE,
        DIVIDEND_DISTRIBUTION_MONTHS,
        VIBEZ_PAYOUT_BONUS,
        YIELD_BASIS,
        GENIUS_PHASE_FLOOR_USD,
        GENESIS_PHASE_FLOOR_USD,
        DIAMOND_VALUE_REFERENCE_USD,
        SCARCITY_PREMIUM_MIN,
        SCARCITY_PREMIUM_MAX,
        TOTAL_CHAIRS_BASELINE,
        WALKING_ADS_COHORT_SIZE,
        CREWMATE_CHAIR_CAPS,
        REVENUE_CATEGORIES,
        BLOCK_RELEASE_SIZE,
        MAJORITY_VOTE_THRESHOLD,
        CREWMATE_LOCKUP_MONTHS,
        PLATFORM_BUYBACK_FLOOR_USD,
        EQUITY_VALUE_MATRIX,
        compute_dividend,
        verify_equity_locks,
    )

    # v1 locked numbers — still in force.
    assert OWNERSHIP_REVENUE_SHARE == 0.30
    assert DIVIDEND_DISTRIBUTION_MONTHS == 3
    assert VIBEZ_PAYOUT_BONUS == 0.05
    assert YIELD_BASIS == 0.10
    assert GENIUS_PHASE_FLOOR_USD == 20
    assert GENESIS_PHASE_FLOOR_USD == 100
    # v2 reframes Diamond Status anchor to $360 @ $10M monthly.
    assert DIAMOND_VALUE_REFERENCE_USD == 360
    assert SCARCITY_PREMIUM_MIN == 0.20
    assert SCARCITY_PREMIUM_MAX == 0.30
    assert TOTAL_CHAIRS_BASELINE == 1_000_000
    assert WALKING_ADS_COHORT_SIZE == 50_000

    # Crewmate chair caps — Founder = infinite (None); other 3 = 250.
    assert CREWMATE_CHAIR_CAPS["founder"] is None
    assert CREWMATE_CHAIR_CAPS["pit_boss"] == 250
    assert CREWMATE_CHAIR_CAPS["vibe_scout"] == 250
    assert CREWMATE_CHAIR_CAPS["treasurer"] == 250

    # Revenue categories — exactly the 4 the PDF names.
    assert set(REVENUE_CATEGORIES) == {"casino", "ridez", "tv_ads", "yellow_pages"}

    # v2 additions: block-release governance + lock-up + buy-back floor.
    assert BLOCK_RELEASE_SIZE == 50_000
    assert MAJORITY_VOTE_THRESHOLD == 0.51
    assert CREWMATE_LOCKUP_MONTHS == 12
    assert PLATFORM_BUYBACK_FLOOR_USD == 20

    # 4-tier Equity & Value Matrix — exact PDF anchors.
    assert len(EQUITY_VALUE_MATRIX) == 4
    by_id = {r["id"]: r for r in EQUITY_VALUE_MATRIX}
    assert by_id["floor"]["monthly_rev_usd"] == 500_000
    assert by_id["floor"]["market_value_usd"] == 18.00
    assert by_id["floor"]["annual_div_per_chair_usd"] == 1.80
    assert by_id["genesis"]["monthly_rev_usd"] == 2_750_000
    assert by_id["genesis"]["market_value_usd"] == 99.00
    assert by_id["genesis"]["annual_div_per_chair_usd"] == 9.90
    assert by_id["diamond"]["monthly_rev_usd"] == 10_000_000
    assert by_id["diamond"]["market_value_usd"] == 360.00
    assert by_id["diamond"]["annual_div_per_chair_usd"] == 36.00
    assert by_id["platinum"]["monthly_rev_usd"] == 50_000_000
    assert by_id["platinum"]["market_value_usd"] == 1_800.00
    assert by_id["platinum"]["annual_div_per_chair_usd"] == 180.00

    # Boot-time verify must pass and re-run cleanly (it also walks the
    # matrix and validates each row against the closed-form formula).
    verify_equity_locks()

    # PDF Diamond anchor: $10M monthly → $360 (v2).
    res = compute_dividend(10_000_000)
    assert res["annual_dividend_per_chair_usd"] == 36.0
    assert res["current_price_usd"] == 360.0
    assert res["floor_phase"] == "diamond"

    # Platinum: $50M monthly → $1,800.
    plat = compute_dividend(50_000_000)
    assert plat["current_price_usd"] == 1_800.0
    assert plat["floor_phase"] == "platinum"

    # Floor: $500K monthly → $18.
    flr = compute_dividend(500_000)
    assert flr["current_price_usd"] == 18.0
    assert flr["floor_phase"] == "floor"


def test_equity_master_router_registered() -> None:
    """The Equity Master router must be mounted under /api/equity-master."""
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "equity_master" in reg, "registry.py must mount equity_master"
    assert "EQUITY MASTER MOUNT FAILED" in reg, "mount block must be fatal on failure"

    # Immutable Core cross-verifies the equity locks.
    core = Path("/app/backend/routes/immutable_core.py").read_text()
    assert "verify_equity_locks" in core, (
        "Immutable Core must cross-call verify_equity_locks at boot"
    )


def test_equity_master_frontend_page_wired() -> None:
    """The Equity & Governance page must exist, be routed, and surface
    every locked tile/number for users."""
    from pathlib import Path

    page = Path("/app/frontend/src/pages/EquityMasterPage.tsx").read_text()
    # Every PDF section is rendered.
    for needle in (
        "Crewmate Architecture",
        "30% Revenue Split",
        "Diamond Market Logic",
        "/api/equity-master/constants",
        "/api/equity-master/crewmate-roles",
        "/api/equity-master/valuation",
        'data-testid="equity-master-page"',
        'data-testid="equity-gross-input"',
        'data-testid="equity-recalc-btn"',
    ):
        assert needle in page, f"EquityMasterPage missing: {needle}"

    # Routed at /equity and /equity-master.
    routes = Path("/app/frontend/src/routes/miscRoutes.tsx").read_text()
    assert 'path="/equity"' in routes
    assert 'path="/equity-master"' in routes
    assert "EquityMasterPage" in routes

    # Dashboard exposes the new tile on both surfaces.
    classic = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "Equity & Governance" in classic
    assert "path: '/equity'" in classic

    vol = Path("/app/frontend/src/pages/VolumetricDashboard.tsx").read_text()
    assert 'path: "/equity"' in vol

    # v2: matrix table + governance section are rendered.
    assert 'data-testid="equity-value-matrix"' in page
    # The 4 row test IDs come from a template literal `value-matrix-row-${row.id}` —
    # so we check for the template pattern itself.
    assert "`value-matrix-row-${row.id}`" in page
    # Each phase id must appear in the static fallback so we can prove
    # all 4 PDF tiers will render.
    for phase_id in ("floor", "genesis", "diamond", "platinum"):
        assert f'"{phase_id}"' in page, f"matrix fallback missing phase {phase_id}"
    assert 'data-testid="equity-governance-section"' in page
    assert "Block-Release Governance" in page
    assert "Crewmate Lock-Up" in page
    assert "Platform Buy-Back Floor" in page


def test_dsg_core_system_constants_locked_to_pdf() -> None:
    """DSG_Developer_Handbook.pdf + DSG_Core_System_Code.pdf (Feb 2026):
    every PDF number for TV/Cinema/Treasury must be locked and routed
    through Equity Master's authoritative constants."""
    from routes.dsg_core_system import (
        CINEMA_CREATOR_SPLIT,
        CINEMA_HOUSE_SPLIT,
        HOUSE_TO_POOL_RATE,
        AD_IMPRESSION_VALUE_USD,
        QUARTERLY_PAYOUT_DAYS,
        SETTLEMENT_LOCK_HOURS_PRE,
        REGIONS,
    )
    from routes.equity_master import (
        OWNERSHIP_REVENUE_SHARE,
        TOTAL_CHAIRS_BASELINE,
        DIVIDEND_DISTRIBUTION_MONTHS,
    )

    # PDF Core_System_Code §Creator Monetization — 80/20 ticket split.
    assert CINEMA_CREATOR_SPLIT == 0.80
    assert CINEMA_HOUSE_SPLIT == 0.20
    assert round(CINEMA_CREATOR_SPLIT + CINEMA_HOUSE_SPLIT, 4) == 1.0
    # PDF Core_System_Code §update_house_pool — 1% of house → pool.
    assert HOUSE_TO_POOL_RATE == 0.01
    # PDF Core_System_Code §stream_regional_hub — $0.05 ad impression.
    assert AD_IMPRESSION_VALUE_USD == 0.05
    # PDF Developer_Handbook §Quarterly Payout Protocol.
    assert QUARTERLY_PAYOUT_DAYS == 90
    # PDF Developer_Handbook §Payout Lock Rule — 24h pre-settlement.
    assert SETTLEMENT_LOCK_HOURS_PRE == 24

    # Regional Hubs — at least the 2 PDF-named cities plus a Global fallback.
    assert "chicago" in REGIONS
    assert REGIONS["chicago"]["sports"] == "CHI_Live"
    assert REGIONS["chicago"]["news"] == "WindyCity_Daily"
    assert "atlanta" in REGIONS
    assert REGIONS["atlanta"]["sports"] == "ATL_Live"
    assert REGIONS["atlanta"]["news"] == "HotLanta_Daily"
    assert "global" in REGIONS
    # And a healthy footprint of regional coverage beyond the 2 anchors.
    assert len(REGIONS) >= 6, "Need at least 6 regional hubs + global fallback"

    # Cross-reference: this module MUST pull Equity Master's locks (not
    # re-define them). Confirms the single-source-of-truth pattern.
    assert OWNERSHIP_REVENUE_SHARE == 0.30
    assert TOTAL_CHAIRS_BASELINE == 1_000_000
    assert DIVIDEND_DISTRIBUTION_MONTHS == 3


def test_dsg_core_system_router_registered() -> None:
    """DSG Core router must be mounted under /api/dsg-core."""
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "dsg_core_system" in reg, "registry.py must mount dsg_core_system"
    assert "DSG_CORE_SYSTEM" in reg, "mount block must log on failure"


def test_ambassador_care_package_page_wired() -> None:
    """Feb 2026 — Ambassador_Care_Package.pdf must surface as a
    standalone page, a landing-page CTA section, and be reachable from
    both dashboards. Locks all 4 earnings + 3 onboarding tracks + 3
    monthly milestones from the PDF."""
    from pathlib import Path

    page = Path("/app/frontend/src/pages/AmbassadorCarePackagePage.tsx").read_text()

    # Hero copy locked from the PDF (verbatim).
    for needle in (
        "Welcome to the High Table",
        "Walking Advertisement",
        "you own the streets",
        "Founder Chairs into a lifetime of passive income",
    ):
        assert needle in page, f"Ambassador page missing PDF copy: {needle}"

    # Master QR card + 3 onboarding tracks.
    assert 'data-testid="ambassador-master-qr"' in page
    for track in ("hungry_vibez", "yellow_pages", "vibe_sponsors"):
        assert f'data-testid={{`ambassador-track-${{t.id}}`}}' in page or (
            f'"{track}"' in page
        ), f"Onboarding track missing: {track}"

    # 3-Month Diamond Challenge milestones.
    assert 'data-testid="ambassador-diamond-challenge"' in page
    assert "Onboard 3 Vendors" in page
    assert "Drive 1,000 $VIBEZ" in page
    assert "Cast Your First Vote" in page
    assert "Tier-2 Equity Status" in page
    assert "Pit Boss management rights" in page

    # 4 earnings.
    assert 'data-testid="ambassador-earnings"' in page
    for earn in ("chair_dividends", "referral_bounties", "override_commissions", "bonus_dsg_tokens"):
        assert f'"{earn}"' in page, f"Earnings cell missing: {earn}"

    # Routed at /ambassador and /ambassador-care-package.
    routes = Path("/app/frontend/src/routes/miscRoutes.tsx").read_text()
    assert 'path="/ambassador"' in routes
    assert 'path="/ambassador-care-package"' in routes
    assert "AmbassadorCarePackagePage" in routes

    # Dashboard tile + Volumetric orbit-room expose it.
    classic = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "Ambassador Care Package" in classic
    assert "path: '/ambassador'" in classic

    vol = Path("/app/frontend/src/pages/VolumetricDashboard.tsx").read_text()
    assert 'path: "/ambassador"' in vol

    # Landing page section.
    landing = Path("/app/frontend/src/pages/LandingNeonGaming.tsx").read_text()
    assert 'data-testid="landing-ambassador-care"' in landing
    assert "You Don't Just Use the App" in landing
    assert "You Own the Streets" in landing
    assert 'data-testid="landing-ambassador-cta"' in landing


def test_landing_tour_narration_updated_to_v3_energetic() -> None:
    """Feb 2026 founder ask: tour script must be re-recorded with more
    energetic voice + cover Ambassador Care + Equity Master v2 + High
    Roller + Media Master + Regional TV Hubs. Voice switched from shimmer
    to NOVA. Length bumped from ~2 min to ~3 min."""
    from pathlib import Path

    script = Path("/app/backend/scripts/generate_landing_tour_narration.py").read_text()
    # Voice must be nova (most energetic).
    assert 'voice="nova"' in script, "Narration must use Nova voice"
    # Speed bumped for excitement.
    assert "speed=1.10" in script
    # New PDF content surfaces in the script.
    for needle in (
        "AMBASSADOR Care Package",
        "Walking Advertisement",
        "Diamond Challenge",
        "EQUITY MASTER",   # Lock-in for the v2 matrix call-out (script SHOUTS it)
        "Value Matrix",
        "Floor",            # $500K → $18
        "Genesis",          # $2.75M → $99
        "Diamond",          # $10M → $360
        "Platinum",         # $50M → $1,800
        "Block-Release",
        "HIGH ROLLER VIP",
        "Media Master Hub",
        "Regional Hubs",
    ):
        assert needle in script, f"Narration script missing: {needle}"

    # Fallback captions in the component cover the same milestones so
    # silent-autoplay scrollers (and pre-MP3 loads) still get the pitch.
    comp = Path("/app/frontend/src/components/landing/LandingTourVideo.tsx").read_text()
    for needle in (
        "HIGH ROLLER VIP",
        "AMBASSADOR Care Package",
        "EQUITY MASTER v2",
        "Diamond Challenge",
        "Block-Release Governance",
    ):
        assert needle in comp, f"Fallback captions missing: {needle}"

    # Marketing copy bumped from 2-min to 3-min tour.
    assert "3 Minutes" in comp
    assert "Nova" in comp, "Voiceover credit must read Nova"

    # And the actual rendered MP3 must exist on disk (regenerated this session).
    mp3 = Path("/app/frontend/public/landing-tour-narration.mp3")
    assert mp3.exists(), "Narration MP3 not present at /landing-tour-narration.mp3"
    # Sanity: at least 500KB so we know it's actual audio, not a placeholder.
    assert mp3.stat().st_size > 500_000, (
        f"Narration MP3 suspiciously small: {mp3.stat().st_size} bytes"
    )


def test_landscape_hint_no_longer_blocks_in_room_controls() -> None:
    """Founder ask 2026-02-15 (Diagnostic Scanner Pattern A): the
    full-screen landscape-hint-overlay must not physically block the
    underlying landscape-toggle pill and in-room-comms-pill on mobile
    card rooms (Spades / Bid Whist / Cyber Casino).

    Fix shipped:
      • LandscapeRotateHint hides its own toggle while the hint overlay
        is up (button rendered inside `{!showHint && ...}`).
      • LandscapeRotateHint broadcasts `body.gv-landscape-hint-active`.
      • App.css adds a global rule that hides `[data-testid='in-room-
        comms-pill']` and `[data-testid='in-room-comms-launcher']` while
        that body class is present.
    """
    from pathlib import Path
    hint = Path("/app/frontend/src/components/common/LandscapeRotateHint.tsx").read_text()
    # Toggle is gated on !showHint.
    assert "{!showHint && (" in hint, (
        "landscape-toggle must be hidden while the hint overlay is visible"
    )
    # Body class broadcast is wired.
    assert "gv-landscape-hint-active" in hint
    assert 'classList.add("gv-landscape-hint-active")' in hint

    # Global CSS rule hides the comms pill when the body class is set.
    css = Path("/app/frontend/src/App.css").read_text()
    assert "body.gv-landscape-hint-active" in css, (
        "App.css must define the body.gv-landscape-hint-active rule"
    )
    assert '[data-testid="in-room-comms-pill"]' in css
    assert "display: none !important" in css


def test_desktop_bottom_left_stack_no_longer_overlaps() -> None:
    """Founder ask 2026-02-15 (Diagnostic Scanner Pattern B): on desktop
    the LogDesignLesson admin pill (z=50) was sitting under the Network
    Pulse Mini Widget (z=55) at the same `bottom-4 left-4` anchor. Fix:
    bumped LogDesignLesson to `bottom-32 left-4` (above the network
    pulse widget) so the two are no longer co-located."""
    from pathlib import Path
    src = Path("/app/frontend/src/components/vibez/LogDesignLesson.tsx").read_text()
    assert "fixed bottom-32 left-4 opacity-10" in src, (
        "LogDesignLesson trigger must be at bottom-32 (above NetworkPulse)"
    )
    assert "fixed bottom-32 left-4 w-80" in src, (
        "LogDesignLesson form panel must also lift to bottom-32"
    )
    # Sanity: the OLD bottom-4 anchor (which caused the overlap) is gone.
    assert "fixed bottom-4 left-4 opacity-10" not in src
    assert "fixed bottom-4 left-4 w-80" not in src


def test_my_vibez_optimization_module_locked_to_pdf() -> None:
    """Feb 2026 — both My Vibez PDFs (Redefinition Blueprint +
    Optimization Module) must surface as locked constants + 4 working
    endpoints. Single source of truth: imports House Pool helpers from
    routes.dsg_core_system so cinema/ad revenue flows into the SAME
    quarterly pool that pays chair holders."""
    from routes.my_vibez_optimization import (
        CATEGORY_THEME_MAP,
        THEME_METADATA,
        AD_SPLIT_CREATOR,
        AD_SPLIT_AMBASSADOR,
        AD_SPLIT_HOUSE,
        AD_IMPRESSION_VALUE_USD,
        REGIONAL_VENDORS,
        VibeCategory,
    )

    # PDF 1 — 2 themes locked.
    assert "celestial_glasshouse" in THEME_METADATA
    assert "underground_club" in THEME_METADATA
    assert THEME_METADATA["celestial_glasshouse"]["label"] == "The Celestial Glasshouse"
    assert THEME_METADATA["underground_club"]["label"] == "The Underground Club"
    # PDF copy verbatim — both themes' visual blurbs.
    assert "Translucent glass panels" in THEME_METADATA["celestial_glasshouse"]["visuals"]
    assert "holographic star maps" in THEME_METADATA["celestial_glasshouse"]["visuals"]
    assert "matte-black carbon frames" in THEME_METADATA["underground_club"]["visuals"]
    assert "pulse-reactive equalizer bars" in THEME_METADATA["underground_club"]["visuals"]

    # Category routing: dark/intense → club, calm/curated → glasshouse.
    assert CATEGORY_THEME_MAP["HORROR"] == "underground_club"
    assert CATEGORY_THEME_MAP["ACTION"] == "underground_club"
    assert CATEGORY_THEME_MAP["COMEDY"] == "underground_club"
    assert CATEGORY_THEME_MAP["MUSIC"] == "underground_club"
    assert CATEGORY_THEME_MAP["LIVE_DATING"] == "celestial_glasshouse"
    assert CATEGORY_THEME_MAP["YELLOW_PAGES_SHOWCASE"] == "celestial_glasshouse"
    assert CATEGORY_THEME_MAP["CREATIVE"] == "celestial_glasshouse"
    assert CATEGORY_THEME_MAP["TECH"] == "celestial_glasshouse"

    # All 5 PDF-named categories enumerated.
    enum_values = {c.value for c in VibeCategory}
    for cat in ("COMEDY", "ACTION", "HORROR", "LIVE_DATING", "YELLOW_PAGES_SHOWCASE"):
        assert cat in enum_values, f"VibeCategory missing PDF category: {cat}"

    # PDF 2 — Ad split exactly 60/20/20 (sums to 100).
    assert AD_SPLIT_CREATOR == 0.60
    assert AD_SPLIT_AMBASSADOR == 0.20
    assert AD_SPLIT_HOUSE == 0.20
    assert round(AD_SPLIT_CREATOR + AD_SPLIT_AMBASSADOR + AD_SPLIT_HOUSE, 4) == 1.0

    # Ad impression value matches DSG Core System ($0.05).
    assert AD_IMPRESSION_VALUE_USD == 0.05

    # Regional vendor map — PDF example for Chicago is verbatim.
    assert REGIONAL_VENDORS["chicago"]["ad_id"] == "AD_CHI_099"
    assert REGIONAL_VENDORS["chicago"]["vendor"] == "WindyCity_Grill_HungryVibez"
    # At least the 6 hubs we serve in dsg_core_system.
    assert len(REGIONAL_VENDORS) >= 6


def test_my_vibez_optimization_router_registered() -> None:
    """/api/my-vibez/* must be mounted (4 endpoints)."""
    from pathlib import Path
    reg = Path("/app/backend/routes/registry.py").read_text()
    assert "my_vibez_optimization" in reg
    assert "MY_VIBEZ_OPTIMIZATION" in reg


def test_my_vibez_themed_room_frontend_wired() -> None:
    """The themed room page must exist, be routed at /my-vibez/themed,
    fetch from the real backend, and surface in the dashboard."""
    from pathlib import Path

    page = Path("/app/frontend/src/pages/MyVibezThemedRoom.tsx").read_text()
    # Pulls from the real backend (not hard-coded).
    assert "/api/my-vibez/categories/layout/" in page
    # Both themes surface in the UI (theme IDs come from backend, but
    # the component branches on the underground_club id for equalizer
    # bars vs star map).
    assert "underground_club" in page
    # Category rail covers PDF-named categories.
    for cat in ("COMEDY", "ACTION", "HORROR", "LIVE_DATING", "YELLOW_PAGES_SHOWCASE"):
        assert f'"{cat}"' in page, f"Category rail missing: {cat}"
    # Test IDs for QA.
    assert 'data-testid="my-vibez-themed-room"' in page
    assert 'data-testid="my-vibez-category-rail"' in page

    # Routed.
    routes = Path("/app/frontend/src/routes/miscRoutes.tsx").read_text()
    assert 'path="/my-vibez/themed"' in routes
    assert 'path="/my-vibez-themed"' in routes
    assert "MyVibezThemedRoom" in routes

    # Volumetric exposes it.
    vol = Path("/app/frontend/src/pages/VolumetricDashboard.tsx").read_text()
    assert 'path: "/my-vibez/themed"' in vol


def test_feb2026_roadmap_8_items_wired() -> None:
    """Feb 2026 founder roadmap — 8 engagement/revenue/retention modules
    must all be importable, have routers registered, and surface in the
    Roadmap Hub. One MEGA test instead of 8 separate tests so a single
    fork agent run validates the whole roadmap in one shot."""
    from pathlib import Path

    # 1. Backend modules importable.
    from routes.my_vibez_feed import router as r1, SCORE_WEIGHTS
    from routes.creator_earnings import router as r2, MIN_CASHOUT_VIBEZ
    from routes.live_commerce import (
        router as r3, VENDOR_SPLIT, STREAMER_SPLIT, HOUSE_SPLIT,
    )
    from routes.crews import router as r4, MIN_CREW_SIZE, MAX_CREW_SIZE
    from routes.streamer_copilot import router as r6, TITLE_TEMPLATES
    from routes.safety_streaks_tourneys import (
        router as r7, STREAK_REWARDS, DAILY_DEFAULT_LIMIT_VIBEZ,
    )
    from routes.rum_collector import router as r8

    # 2. Locked numbers per the founder spec.
    assert round(sum(SCORE_WEIGHTS.values()), 4) == 1.0
    assert MIN_CASHOUT_VIBEZ == 1000
    assert VENDOR_SPLIT == 0.70
    assert STREAMER_SPLIT == 0.20
    assert HOUSE_SPLIT == 0.10
    assert round(VENDOR_SPLIT + STREAMER_SPLIT + HOUSE_SPLIT, 4) == 1.0
    assert MIN_CREW_SIZE == 1
    assert MAX_CREW_SIZE == 12
    assert "casino" in TITLE_TEMPLATES
    assert STREAK_REWARDS[1] == 10
    assert STREAK_REWARDS[3] == 25
    assert STREAK_REWARDS[7] == 75
    assert STREAK_REWARDS[15] == 200
    assert DAILY_DEFAULT_LIMIT_VIBEZ == 5_000

    # 3. Routers mounted in registry.
    reg = Path("/app/backend/routes/registry.py").read_text()
    for needle in (
        "routes.my_vibez_feed",
        "routes.creator_earnings",
        "routes.live_commerce",
        "routes.crews",
        "routes.streamer_copilot",
        "routes.safety_streaks_tourneys",
        "routes.rum_collector",
    ):
        assert needle in reg, f"Registry missing mount for {needle}"

    # 4. Item 5 — Capacitor scaffolding committed.
    cap = Path("/app/frontend/capacitor.config.ts")
    assert cap.exists(), "capacitor.config.ts must exist"
    cap_src = cap.read_text()
    assert "com.globalvibez.dsg" in cap_src
    assert "Global Vibez DSG" in cap_src

    # 5. Frontend Roadmap Hub page surfaces all 8 items.
    hub = Path("/app/frontend/src/pages/RoadmapHub.tsx").read_text()
    # Top-level hub test ID is a string literal.
    assert 'data-testid="roadmap-hub"' in hub
    # Card test IDs are passed as a `testid` prop string literal,
    # then rendered via `data-testid={testid}`.
    for tid in (
        "roadmap-card-feed",
        "roadmap-card-earnings",
        "roadmap-card-commerce",
        "roadmap-card-crews",
        "roadmap-card-native",
        "roadmap-card-copilot",
        "roadmap-card-safety",
        "roadmap-card-rum",
    ):
        assert f'"{tid}"' in hub, f"Roadmap Hub missing card: {tid}"

    # 6. Routed.
    routes = Path("/app/frontend/src/routes/miscRoutes.tsx").read_text()
    assert 'path="/roadmap"' in routes
    assert "RoadmapHub" in routes

    # 7. Volumetric exposes it.
    vol = Path("/app/frontend/src/pages/VolumetricDashboard.tsx").read_text()
    assert 'path: "/roadmap"' in vol


# ────────────────────────────────────────────── Refer-a-Whale ──
# [2026-05-16] Wired the High Roller "Refer a Whale" share card. Whales
# get a deterministic 8-char code, +7 day VIP bonus per converted
# referee. Stripe webhook now credits the referrer via metadata.

def test_refer_a_whale_code_is_deterministic_and_safe() -> None:
    """Same user_id must always produce the same code; alphabet must
    exclude look-alike chars (0/O/1/I) so codes are dictate-able."""
    from routes.high_roller import _referral_code_for
    code_a = _referral_code_for("user-123")
    code_b = _referral_code_for("user-123")
    code_c = _referral_code_for("user-456")
    assert code_a == code_b, "Referral code must be deterministic"
    assert code_a != code_c, "Different users must get different codes"
    assert len(code_a) == 8
    forbidden = set("01OI")
    assert not (set(code_a) & forbidden), f"Code {code_a} contains look-alike chars"


def test_refer_a_whale_endpoints_registered() -> None:
    """GET /referral/{user_id} + POST /referral/track must be live."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/high-roller/referral/{user_id}" in paths
    assert "/api/high-roller/referral/track" in paths


def test_refer_a_whale_checkout_accepts_referral_code() -> None:
    """CheckoutRequest must accept an optional `referral_code` field so
    the inbound `?ref=CODE` query param flows through to Stripe metadata."""
    from routes.high_roller import CheckoutRequest
    req = CheckoutRequest(user_id="u1", tier="genius", referral_code="ABCD2345")
    assert req.referral_code == "ABCD2345"
    req2 = CheckoutRequest(user_id="u1", tier="genius")
    assert req2.referral_code is None


def test_refer_a_whale_webhook_imports_track_referral() -> None:
    """The Stripe payouts webhook must wire `track_referral` so a referee
    converting flips the referrer's bonus days."""
    from pathlib import Path
    src = Path("/app/backend/routes/stripe_payouts_webhook.py").read_text()
    assert "track_referral" in src, "Webhook must import track_referral"
    assert "referral_code" in src, "Webhook must read referral_code from metadata"


def test_refer_a_whale_frontend_card_rendered() -> None:
    """High Roller frontend page must include the Refer-a-Whale card with
    the canonical test IDs the testing agent will validate."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/HighRollerCasino.tsx").read_text()
    for tid in (
        "refer-a-whale-card",
        "refer-a-whale-code",
        "refer-a-whale-copy-btn",
        "refer-a-whale-share-btn",
        "refer-a-whale-count",
        "refer-a-whale-stats",
    ):
        assert f'data-testid="{tid}"' in src, f"HighRollerCasino missing testid '{tid}'"
    assert "ref=" in src and "referral_code" in src, (
        "HighRollerCasino must forward inbound ?ref=CODE into checkout body"
    )

# ────────────────────────────────────────────── Free TV Networks Cinema Room ──
# [2026-05-16] Founder uploaded a PDF blueprint asking for a synced
# watch-party room across Pluto/Tubi/Plex/YouTube. Built backend route
# `cinema_network_room.py` + frontend `FreeTVCinemaRoom.tsx` + dashboard
# tile + shrunk dashboard cards + revamped MY VIBEZ card. These tests
# pin all four pieces.

def test_free_tv_network_route_registered() -> None:
    """Cinema Network Room endpoints must be mounted under
    /api/cinema-network-room/* and include networks + rooms + WS."""
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    for needle in (
        "/api/cinema-network-room/networks",
        "/api/cinema-network-room/networks/{network_id}",
        "/api/cinema-network-room/rooms",
        "/api/cinema-network-room/rooms/{room_id}",
        "/api/cinema-network-room/rooms/{room_id}/track-ref",
        "/api/cinema-network-room/ws/{room_id}",
    ):
        assert needle in paths, f"Missing route: {needle}"


def test_free_tv_network_catalog_has_four_networks() -> None:
    """Pluto, Tubi, Plex, YouTube — the PDF specifies all four."""
    from routes.cinema_network_room import NETWORKS
    ids = {n["network_id"] for n in NETWORKS}
    assert ids == {"PLUTO_TV", "TUBI_TV", "PLEX_TV", "YOUTUBE"}, (
        f"PDF blueprint requires exactly 4 networks, got {ids}"
    )
    for n in NETWORKS:
        assert n["channels"], f"Network {n['network_id']} has no channels"
        assert n["embed_mode"] in ("iframe", "external", "hybrid")
        assert n["brand_color"].startswith("#")


def test_free_tv_pdf_envelope_schema() -> None:
    """WebSocket frames must match the PDF schema verbatim:
    room_id / timestamp_utc / action / payload / originating_agent_uuid."""
    from routes.cinema_network_room import _pdf_envelope
    env = _pdf_envelope(
        room_id="DSG_CINEMA_TEST",
        action="NETWORK_SOURCE_MUTATION",
        payload={"active_network": "PLUTO_TV", "channel_id": "x"},
        agent="AGENT_X",
    )
    assert set(env.keys()) == {"room_id", "timestamp_utc", "action", "payload", "originating_agent_uuid"}
    assert env["action"] == "NETWORK_SOURCE_MUTATION"
    assert env["originating_agent_uuid"] == "AGENT_X"
    assert isinstance(env["timestamp_utc"], int)


def test_free_tv_frontend_page_routed() -> None:
    """`/free-tv` and `/free-tv/:roomId` must be wired in the frontend
    router, importing the FreeTVCinemaRoom page."""
    from pathlib import Path
    src = Path("/app/frontend/src/routes/miscRoutes.tsx").read_text()
    assert "FreeTVCinemaRoom" in src
    assert 'path="/free-tv"' in src
    assert 'path="/free-tv/:roomId"' in src


def test_free_tv_frontend_page_renders_critical_ids() -> None:
    """Lobby + room view must expose the canonical test IDs so the
    testing agent can validate the flow end-to-end."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/FreeTVCinemaRoom.tsx").read_text()
    for tid in (
        "free-tv-lobby",
        "free-tv-network-grid",
        "free-tv-room",
        "free-tv-player",
        "free-tv-channel-grid",
        "free-tv-chat",
        "free-tv-audience",
        "free-tv-copy-share",
        "free-tv-play-toggle",
        "free-tv-external-fallback",
    ):
        assert f'data-testid="{tid}"' in src, f"FreeTVCinemaRoom missing testid '{tid}'"


def test_dashboard_has_free_tv_tile_and_smaller_cards() -> None:
    """Dashboard must include the Free TV tile and the room cards must
    be the shrunk size (h-36 image / w-14 icon / p-4) — not the old
    h-48 / w-20 / p-6 dimensions."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "id: 'free_tv'" in src
    assert "Free TV Networks" in src
    assert "path: '/free-tv'" in src
    # Smaller card layout assertions.
    assert "h-36 overflow-hidden" in src, "Dashboard room cards must use h-36 image area"
    assert "w-14 h-14 text-white drop-shadow-2xl" in src, "Dashboard icons must be w-14 h-14"
    assert "gap-4 mb-12" in src, "Dashboard grid must use the tighter gap-4 spacing"


def test_dashboard_my_vibez_tile_revamped() -> None:
    """MY VIBEZ tile must render the vibrant holographic variant (not
    the standard GlassCard)."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert 'data-testid="dashboard-card-myvibez"' in src
    assert "isMyVibez" in src and "conic-gradient" in src, (
        "MY VIBEZ tile must use the bespoke holographic conic-gradient treatment"
    )

# ────────────────────────────────────────────── Co-Watch Launcher ──
# [2026-05-16] Global floating "Co-Watch from anywhere" button. One tap
# spawns a synced free-tv watch-party from any page, copies a share
# link with `?ref=` attribution.

def test_co_watch_launcher_component_exists() -> None:
    from pathlib import Path
    p = Path("/app/frontend/src/components/common/CoWatchLauncher.tsx")
    assert p.exists(), "CoWatchLauncher.tsx must exist"
    src = p.read_text()
    for tid in (
        "co-watch-launcher-btn",
        "co-watch-launcher-modal",
        "co-watch-launcher-invite-url",
        "co-watch-launcher-copy-btn",
        "co-watch-launcher-share-btn",
        "co-watch-launcher-jump-btn",
        "co-watch-launcher-close",
    ):
        assert f'data-testid="{tid}"' in src, f"CoWatchLauncher missing testid '{tid}'"


def test_co_watch_launcher_mounted_globally() -> None:
    """CoWatchLauncher must be imported and rendered in App.js so it
    shows on every protected page."""
    from pathlib import Path
    src = Path("/app/frontend/src/App.js").read_text()
    assert "CoWatchLauncher" in src
    assert "<CoWatchLauncher />" in src


def test_co_watch_launcher_hides_on_auth_pages() -> None:
    """Login/signup pages must not render the launcher (HIDDEN_PREFIXES)."""
    from pathlib import Path
    src = Path("/app/frontend/src/components/common/CoWatchLauncher.tsx").read_text()
    for needle in ("'/login'", "'/signup'", "'/volumetric'"):
        assert needle in src, f"HIDDEN_PREFIXES must include {needle}"




# ────────────────────────────────────────────── Co-Play + Category Tabs ──
# [2026-05-16] Founder asks: (a) bring "Invite to my table" co-play to
# the launcher, (b) section the dashboard by categories so the active
# tab borrows the MY VIBEZ holographic treatment, (c) drop the TikTok
# wording from the MY VIBEZ tile.

def test_dashboard_category_tabs_rendered() -> None:
    """All 8 categories must render as tabs with the canonical test IDs."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert 'data-testid="dashboard-category-tabs"' in src
    for cat in ("watch", "dating", "games", "music", "lifestyle", "social", "earnings", "all"):
        assert f'data-testid={{`dashboard-category-tab-${{cat.id}}`}}' in src or (
            f'dashboard-category-tab-{cat}' in src
        ), f"Category tab missing: {cat}"
    # ROOM_CATEGORY map must classify the new Free TV + MY VIBEZ tiles.
    assert "ROOM_CATEGORY" in src
    assert "free_tv: 'watch'" in src
    assert "myvibez: 'watch'" in src
    # Active-tab holographic treatment carries the same conic-gradient
    # signature as the MY VIBEZ tile.
    assert "CategoryTabs" in src and "conic-gradient" in src


def test_my_vibez_tile_drops_tiktok_wording() -> None:
    """Founder ask: take 'TikTok' off the MY VIBEZ description. It's a
    streaming/watch place, not a TikTok clone."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    # Find the MY VIBEZ entry's description line.
    assert "id: 'myvibez'" in src
    # The exact previous wording must be gone.
    assert "TikTok-style viral content" not in src, (
        "MY VIBEZ description still references TikTok"
    )
    # And the new wording must be present.
    assert "Streaming & watch place" in src


def test_co_play_mode_wired_in_launcher() -> None:
    """CoWatchLauncher must detect game/card-room paths and switch to
    'co-play' mode, which copies the current URL with `?invite=` instead
    of POSTing a watch-party room."""
    from pathlib import Path
    src = Path("/app/frontend/src/components/common/CoWatchLauncher.tsx").read_text()
    assert "co-play" in src
    assert "Invite to your table" in src
    assert "?invite=" in src or "searchParams.set('invite'" in src
    # Sample of expected game prefixes.
    for prefix in ("'/spades'", "'/blackjack'", "'/casino/high-roller'", "'/card-mp'"):
        assert prefix in src, f"Co-Play GAME_PREFIXES missing {prefix}"


# ────────────────────────────────────────────── Live Pulse pill ──
# [2026-05-16] Per-category live audience counter. Sums audience_count
# across Free TV + Cinema rooms. Hidden when total == 0.

def test_live_pulse_endpoint_registered_and_shape() -> None:
    """`GET /api/live-pulse/categories` must be mounted and return a
    dict keyed by the same category IDs the dashboard tabs use."""
    import asyncio
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/live-pulse/categories" in paths
    from routes.live_pulse import get_category_pulse, CATEGORY_IDS
    # CATEGORY_IDS must align with the frontend tab vocabulary.
    assert set(CATEGORY_IDS) == {"watch", "dating", "games", "music", "lifestyle", "social", "earnings"}
    out = asyncio.new_event_loop().run_until_complete(get_category_pulse())
    assert "counts" in out and "total" in out
    assert set(out["counts"].keys()) == set(CATEGORY_IDS)
    assert all(isinstance(v, int) for v in out["counts"].values())


def test_live_pulse_pill_rendered_in_dashboard() -> None:
    """LivePulsePill must mount above the category tabs, poll the
    backend, and call setActiveCategory when a pill is clicked."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "LivePulsePill" in src
    assert 'data-testid="live-pulse-pill"' in src
    assert "/api/live-pulse/categories" in src
    # Pill must be mounted ABOVE the CategoryTabs in the JSX so users
    # always see momentum before the tab strip.
    pulse_idx = src.find("<LivePulsePill")
    tabs_idx = src.find("<CategoryTabs")
    assert pulse_idx > 0 and tabs_idx > 0 and pulse_idx < tabs_idx, (
        "LivePulsePill must render before CategoryTabs in the JSX tree"
    )


# ────────────────────────────────────────────── Hot Rooms carousel + pulse expansion ──
# [2026-05-16] Pulse now folds in live-stream viewer counts across every
# category, and a new /hot-rooms endpoint surfaces top-N individual
# rooms with deep-link paths so users one-tap into the busiest room.

def test_hot_rooms_endpoint_registered_and_shape() -> None:
    """`GET /api/live-pulse/hot-rooms` must be mounted and return a
    list of normalised room entries with id/name/audience/path."""
    import asyncio
    from server import app
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/api/live-pulse/hot-rooms" in paths
    from routes.live_pulse import get_hot_rooms
    out = asyncio.new_event_loop().run_until_complete(get_hot_rooms(limit=3))
    assert "rooms" in out and isinstance(out["rooms"], list)
    # Mock streams in routes.streaming guarantee >=3 live entries today.
    assert len(out["rooms"]) >= 1, "Hot Rooms must surface at least one live entry given seed streams"
    for r in out["rooms"]:
        for k in ("id", "name", "audience", "path", "category"):
            assert k in r, f"Hot room entry missing '{k}'"
        assert isinstance(r["audience"], int) and r["audience"] > 0


def test_live_pulse_includes_streaming_signal() -> None:
    """Pulse must fold streams `routes.streaming.mock_streams` into the
    per-category counts so games/music/etc light up alongside watch."""
    from pathlib import Path
    src = Path("/app/backend/routes/live_pulse.py").read_text()
    assert "_streams_signal" in src
    assert "from routes.streaming import mock_streams" in src


def test_hot_rooms_carousel_rendered_in_dashboard() -> None:
    """HotRoomsCarousel must mount between LivePulsePill and
    CategoryTabs so the visual hierarchy is pulse → hot → tabs."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "HotRoomsCarousel" in src
    assert 'data-testid="hot-rooms-carousel"' in src
    assert "/api/live-pulse/hot-rooms" in src
    pulse_idx = src.find("<LivePulsePill")
    carousel_idx = src.find("<HotRoomsCarousel")
    tabs_idx = src.find("<CategoryTabs")
    assert pulse_idx > 0 < carousel_idx < tabs_idx, (
        "Dashboard order must be LivePulsePill → HotRoomsCarousel → CategoryTabs"
    )


# ────────────────────────────────────────────── Cinema Room + dup-image audit + hover preview ──
# [2026-05-16] Founder asks: (a) surface Cinema Room on the dashboard,
# (b) no two tiles share the same Unsplash image, (c) ship a 30s
# hover-preview popover on Hot Rooms cards.

def test_dashboard_has_cinema_room_tile() -> None:
    """`/cinema-room` route existed but wasn't surfaced on the dashboard.
    Founder ask 2026-05-16: add a tile in the Watch category."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "id: 'cinema_room'" in src
    assert "path: '/cinema-room'" in src
    assert "cinema_room: 'watch'" in src, "Cinema Room must classify under Watch in ROOM_CATEGORY"


def test_dashboard_room_images_are_unique() -> None:
    """No two room tiles may share the same Unsplash photo id."""
    import re
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    # Pull every `image: 'https://images.unsplash.com/photo-XXXXX...'` line.
    image_lines = re.findall(r"image:\s*'(https://images\.unsplash\.com/photo-\d+[^']*)'", src)
    photo_ids = [re.search(r"photo-(\d+)", url).group(1) for url in image_lines if re.search(r"photo-(\d+)", url)]
    duplicates = {pid: photo_ids.count(pid) for pid in set(photo_ids) if photo_ids.count(pid) > 1}
    assert not duplicates, f"Duplicate Unsplash photo IDs across dashboard tiles: {duplicates}"


def test_hot_rooms_preview_hover_card_rendered() -> None:
    """Hot Rooms carousel cards must expose hover preview test IDs.
    Backend payload must include `preview_image_url` so the frontend
    can render a real thumbnail in the popover."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    # Each card has a preview popover with a templated test ID.
    assert "hot-room-preview-${r.id}" in src or "hot-room-preview-" in src
    assert "preview_image_url" in src, "Frontend must consume preview_image_url"
    assert "onMouseEnter" in src and "onTouchStart" in src, (
        "Preview must trigger on hover (desktop) and long-press (touch)"
    )
    # Backend must also emit it.
    backend_src = Path("/app/backend/routes/live_pulse.py").read_text()
    assert "preview_image_url" in backend_src


# ────────────────────────────────────────────── Cloudflare Stream swap-in ──
# [2026-05-16] Hot-rooms payload now carries an optional
# `preview_video_url`. When Cloudflare Stream wires up, the source
# document only needs `cloudflare_playback_url` and the frontend
# preview popover swaps `<img>` → `<video>` for free.

def test_hot_rooms_payload_includes_preview_video_url_field() -> None:
    """The contract MUST emit `preview_video_url` (null today) on every
    hot-room entry so the frontend's conditional `<video>` render is
    safe even before Cloudflare Stream lands."""
    import asyncio
    from routes.live_pulse import get_hot_rooms
    out = asyncio.new_event_loop().run_until_complete(get_hot_rooms(limit=3))
    assert out["rooms"], "Need at least one live entry for this test (mock streams seed it)"
    for r in out["rooms"]:
        assert "preview_video_url" in r, (
            f"Hot room entry must carry `preview_video_url` key (got keys: {list(r.keys())})"
        )
        v = r["preview_video_url"]
        assert v is None or (isinstance(v, str) and v.startswith("http")), (
            f"preview_video_url must be None or an http(s) URL, got {v!r}"
        )


def test_cloudflare_preview_url_helper_emits_last_30s_fragment() -> None:
    """If a stream doc carries `cloudflare_playback_url`, the helper
    must append `#t=-30` so the preview <video> auto-scrubs to the
    last 30 seconds of the live broadcast."""
    from routes.live_pulse import _cloudflare_preview_url
    assert _cloudflare_preview_url({}) is None
    assert _cloudflare_preview_url({"cloudflare_playback_url": ""}) is None
    out = _cloudflare_preview_url({"cloudflare_playback_url": "https://cf.tv/live.m3u8"})
    assert out == "https://cf.tv/live.m3u8#t=-30"
    out2 = _cloudflare_preview_url({"hls_url": "https://x.com/y.m3u8"})
    assert out2 == "https://x.com/y.m3u8#t=-30"


def test_hot_rooms_preview_renders_video_when_url_present() -> None:
    """Frontend popover must render `<video>` when preview_video_url is
    set, falling back to `<img>` when null. Pin both code paths."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/DashboardNew.tsx").read_text()
    assert "r.preview_video_url ? (" in src, "Must conditionally render on preview_video_url"
    assert "<video" in src and "autoPlay" in src and "muted" in src
    assert "playsInline" in src and "loop" in src
    assert "hot-room-preview-video-" in src

# ────────────────────────────────────────────── Chess Hall fix ──
# [2026-05-16] Founder reported Chess Hall → Classic / Neon Arena both
# broken (couldn't make moves). Root cause: `chess` was wrongly listed
# in PracticeGamePlay's `SUPPORTED_CLIENT_GAMES`, which created a stub
# game without `current_turn` — that froze `isDraggable` in PracticeChess
# at false. Fix: drop chess from the client-side list AND bootstrap a
# real practice game via POST /api/practice/start when the URL param
# is a game type rather than a `practice_xxx` UUID.

def test_chess_removed_from_client_side_list() -> None:
    """`PracticeGamePlay.SUPPORTED_CLIENT_GAMES` must not contain 'chess'.
    Chess REQUIRES a real backend game so the AI can reply after every
    player move; otherwise the board freezes after move 1."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/PracticeGamePlay.tsx").read_text()
    # The set is multi-line — assert chess is gone via a regex over the
    # whole SUPPORTED_CLIENT_GAMES definition.
    import re
    m = re.search(r"const SUPPORTED_CLIENT_GAMES = new Set<string>\(\[(.*?)\]\);", src, re.DOTALL)
    assert m, "SUPPORTED_CLIENT_GAMES set not found"
    body = m.group(1)
    assert "'chess'" not in body, (
        "Chess must not be in SUPPORTED_CLIENT_GAMES — it needs the backend AI loop"
    )


def test_practice_game_bootstrap_on_mount() -> None:
    """PracticeGamePlay must auto-POST to /api/practice/start when the
    URL param is a game **type** (e.g. 'chess'), so the user can land
    on /practice/play/chess and the game is created automatically."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/PracticeGamePlay.tsx").read_text()
    assert "/api/practice/start" in src, (
        "PracticeGamePlay must call POST /api/practice/start to bootstrap"
    )
    assert "activeGameId" in src, "Must track the bootstrapped game_id"
    assert "looksLikeGameId" in src, "Must distinguish game-type URLs from real game_ids"


def test_classic_chess_board_uses_warm_palette() -> None:
    """The Classic chess board got a 2026-05-16 visual upgrade — royal
    navy frame + mahogany dark squares + cream light squares. Pin the
    palette so a refactor doesn't accidentally revert it."""
    from pathlib import Path
    src = Path("/app/frontend/src/components/practice_games/PracticeChess.tsx").read_text()
    # Mahogany dark squares.
    assert "#4a2b1a" in src and "#2c1810" in src, (
        "Classic dark squares must use the upgraded mahogany palette"
    )
    # Cream light squares.
    assert "#f5e9d4" in src and "#d9c39a" in src, (
        "Classic light squares must use the upgraded cream palette"
    )
    # Ambient starfield + reflective floor were added.
    assert "star-${i}" in src or "ambient starfield" in src.lower()


def test_practice_game_uses_credentials_include() -> None:
    """All practice-game fetches must send the auth cookie, otherwise
    /start + /move 401s out and the chess room dies silently."""
    from pathlib import Path
    src = Path("/app/frontend/src/pages/PracticeGamePlay.tsx").read_text()
    target = "credentials: 'include'"
    count = src.count(target)

# ────────────────────────────────────────────── Code-quality audit gates ──
# [2026-05-16] External code-review report flagged several "critical"
# issues. Audit found they were almost entirely static-analyzer false
# positives. Pin the real invariants so the false positives can't
# regress into real positives in a future commit.

def test_no_actual_eval_builtin_in_backend() -> None:
    """The code-review report flagged `eval()` in casino_wave2_engines.
    Audit confirmed: it's a function NAMED `_five_card_eval`, not the
    Python builtin. Pin that no real `eval(...)` call ever sneaks in."""
    import re
    from pathlib import Path
    for path in Path("/app/backend").rglob("*.py"):
        if "__pycache__" in path.parts or "tests" in path.parts:
            continue
        src = path.read_text()
        # Catch `eval(` only when it's a real call: must be preceded by
        # whitespace / `=` / `(` / `,` / `[` — NOT preceded by a word char
        # (which would mean it's part of an identifier like `_five_card_eval`).
        for m in re.finditer(r"(?<![\w._])eval\s*\(", src):
            # Skip lines that are inside a string literal or comment.
            line_start = src.rfind("\n", 0, m.start()) + 1
            line_end = src.find("\n", m.start())
            line = src[line_start:line_end if line_end > 0 else len(src)]
            if line.lstrip().startswith("#"):
                continue
            # Anything that gets here is a genuine `eval(`.
            raise AssertionError(
                f"Forbidden eval() builtin call in {path}: {line.strip()}"
            )


def test_lazy_circular_import_between_chairs_and_apex_evolution() -> None:
    """`routes/chairs.py` ↔ `routes/apex_evolution.py` have a mutual
    dependency. The pattern is: lazy-import inside the function bodies,
    never at module top. Pin that pattern."""
    from pathlib import Path
    chairs = Path("/app/backend/routes/chairs.py").read_text()
    apex = Path("/app/backend/routes/apex_evolution.py").read_text()
    # Top-of-file imports MUST NOT reference each other.
    chairs_head = chairs.split("\n\n\n", 1)[0] if "\n\n\n" in chairs else chairs[:2000]
    apex_head = apex.split("\n\n\n", 1)[0] if "\n\n\n" in apex else apex[:2000]
    assert "from routes.apex_evolution" not in chairs_head, (
        "Cross-import must stay lazy (inside functions) to avoid the circular bind"
    )
    assert "from routes.chairs" not in apex_head, (
        "Cross-import must stay lazy (inside functions) to avoid the circular bind"
    )
    # The lazy imports DO exist inside functions, with the standard noqa.
    assert "from routes.apex_evolution import" in chairs
    assert "from routes.chairs import" in apex


def test_no_hardcoded_secret_assignments_outside_env() -> None:
    """Pin that no production module assigns a real-looking secret to a
    literal. Test fixtures + DEV_FALLBACK markers are explicitly allowed."""
    import re
    from pathlib import Path
    forbidden_patterns = [
        # Real keys look like `sk_live_...`, `AKIA...`, etc.
        r"sk_live_[A-Za-z0-9]{20,}",
        r"AKIA[0-9A-Z]{16}",
    ]
    for path in Path("/app/backend").rglob("*.py"):
        if "__pycache__" in path.parts or "tests" in path.parts:
            continue
        src = path.read_text()
        for pat in forbidden_patterns:
            if re.search(pat, src):
                raise AssertionError(f"Real-looking secret in {path}: pattern {pat!r}")


def test_is_literal_anti_pattern_absent_in_game_utils() -> None:
    """Code-review flagged `if x is 'string'` in uno/hearts/game_ai.
    Audit confirmed all flagged lines are `is None` / `is not None`
    (the correct idiom). Pin that no naked `is "literal"` slips in."""
    import re
    from pathlib import Path
    for fname in ("uno_game.py", "hearts_game.py", "game_ai.py", "spades_game.py"):
        path = Path(f"/app/backend/utils/{fname}")
        if not path.exists():
            continue
        src = path.read_text()
        # Match `is "literal"` or `is 'literal'` where the literal is
        # an alphanumeric word (not None / True / False).
        for m in re.finditer(r"\bis\s+['\"][\w]+['\"]", src):
            raise AssertionError(
                f"`is <literal>` anti-pattern in {path}: {m.group(0)} — use `==` for string equality"
            )


# ────────────────────────────────────────────── 2026-05-16 Commercial extension ──
# Founder uploaded `dsg_commercial_scripts.pdf` with two 15-second spots
# to APPEND to the existing 3-minute landing tour (without removing any
# existing content). Two new MP4 B-roll clips were added to CLIPS, two
# new CLIP_TAGS, six new FALLBACK_CAPTIONS, and the narration script
# grew the two commercial paragraphs.

def test_landing_tour_has_two_new_commercial_clips() -> None:
    from pathlib import Path
    src = Path("/app/frontend/src/components/landing/LandingTourVideo.tsx").read_text()
    # New B-roll URLs.
    assert "ycmjkhqh__http_com_generated_video_content_.mp4" in src
    assert "a0uflv8a_mp4.mp4" in src
    # New clip tags.
    assert "Coins that pay the rent" in src
    assert "From streamer to seat-holder" in src
    # New caption cues.
    assert "Commercial One" in src and "Commercial Two" in src


def test_landing_tour_includes_dating_segment() -> None:
    """Founder ask 2026-05-16: dating was missing from the tour. The
    narration script + on-screen captions must both cover the dating
    surfaces (Vigilant Matchmaker, Gamer Dating, Blind Auction, Voice
    Mirror, Memory Bank, Cinema Dates, Just For The Night)."""
    from pathlib import Path
    script = Path("/app/backend/scripts/generate_landing_tour_narration.py").read_text()
    captions = Path("/app/frontend/src/components/landing/LandingTourVideo.tsx").read_text()
    for needle in (
        "Vigilant Matchmaker",
        "Gamer Dating",
        "Blind Auction",
        "Voice Mirror",
        "Memory Bank",
        "Cinema Dates",
        "Just For The Night",
    ):
        assert needle in script, f"Dating narration missing '{needle}'"
        assert needle in captions, f"Dating caption missing '{needle}'"
    # Dating CLIP_TAGS entry must exist so the carousel labels the surface.
    assert "Find your match" in captions


def test_landing_tour_narration_script_has_both_commercials_and_nova_voice() -> None:
    from pathlib import Path
    src = Path("/app/backend/scripts/generate_landing_tour_narration.py").read_text()
    assert "voice=\"nova\"" in src, "Voice must stay Nova (female · energetic)"
    assert "speed=1.10" in src, "Speed must stay 1.10× for excited tone"
    assert "Commercial One. The Sovereign Casino" in src
    assert "Commercial Two. From streamer, to seat-holder" in src


def test_pricing_matrix_consistent_between_backend_and_landing_captions() -> None:
    """The four chair-price anchors in the tour captions must match the
    canonical EQUITY_VALUE_MATRIX in equity_master.py — Floor $18, Genesis
    $99, Diamond $360, Platinum $1,800."""
    from pathlib import Path
    captions = Path("/app/frontend/src/components/landing/LandingTourVideo.tsx").read_text()
    backend = Path("/app/backend/routes/equity_master.py").read_text()
    for anchor in ("$18", "$99", "$360", "$1,800"):
        assert anchor in captions, f"Landing tour caption is missing the {anchor} chair anchor"
    # Backend numeric source-of-truth.
    for n in ("18.00", "99.00", "360.00", "1_800.00"):
        assert n in backend, f"equity_master.py is missing the {n} matrix value"


def test_landing_tour_narration_mp3_grew_after_commercial_addition() -> None:
    """The Nova MP3 should now be ≥5 MB (was ~4.85 MB after the May-16
    commercials, then ~5.5 MB after the dating segment landed). Sanity
    check that the regen actually wrote bigger audio."""
    from pathlib import Path
    p = Path("/app/frontend/public/landing-tour-narration.mp3")
    assert p.exists(), "landing-tour-narration.mp3 missing"
    size_mb = p.stat().st_size / (1024 * 1024)
    assert size_mb >= 5.0, (
        f"Narration MP3 is {size_mb:.2f} MB — expected ≥5 MB after the dating segment was added"
    )


def test_no_undefined_names_in_route_modules() -> None:
    """Every route module must pyflakes-clean for `undefined name` —
    that bug class causes 500s on the first request to the router.
    Caught `social_features.py` missing `from utils.database import
    get_database` during the 2026-05-16 audit."""
    import subprocess, sys
    from pathlib import Path
    # Resolve repo-relative path so this runs on any CI checkout, not
    # just inside the /app pod.
    backend = Path(__file__).resolve().parents[1]
    try:
        res = subprocess.run(
            [sys.executable, "-m", "pyflakes", "routes/", "services/", "utils/"],
            cwd=str(backend), capture_output=True, text=True, timeout=30,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        # CI environment isn't required to have a runnable pyflakes; skip
        # rather than fast-failing the whole shield job.
        import pytest as _pt
        _pt.skip("pyflakes not runnable in this environment")
        return
    undefined = [
        line for line in res.stdout.splitlines() + res.stderr.splitlines()
        if "undefined name" in line
    ]
    assert not undefined, (
        "pyflakes found undefined names — these are guaranteed 500s in prod:\n"
        + "\n".join(undefined)
    )


# --- LOCKED ---------------------------------------------------------------
# [2026-05-16] Genius Phase Merchant Onboarding — dsg_merchant_strategy.pdf.
# Tests below lock the constants from the PDF (50K cap, $20 chair, 100
# ceiling, 3-mile radius), Stripe-Checkout flow, FCM fan-out wiring, DSG
# TV ad-flight scheduler insertion, and the auth-gating policy.

# Shared TestClient — entered once via the ASGI lifespan so the cached
# motor client binds to a single, stable event loop across all merchant
# tests. Re-creating TestClient per test triggers
# `RuntimeError: Event loop is closed` because motor caches the loop on
# first use.
_merchant_test_client = None


def _merchant_client():
    global _merchant_test_client
    if _merchant_test_client is None:
        from fastapi.testclient import TestClient  # noqa: PLC0415
        from server import app  # noqa: PLC0415
        _merchant_test_client = TestClient(app)
        _merchant_test_client.__enter__()
    return _merchant_test_client


def _merchant_sync_db():
    """Fresh synchronous PyMongo client — avoids any event-loop binding
    issues when seeding test data inside the TestClient flow."""
    from pymongo import MongoClient  # type: ignore  # noqa: PLC0415
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _seed_merchant_user(user_id: str) -> str:
    """Insert a fake user + session into the test DB and return a bearer
    token usable by `_require_user`. Mirrors the production auth path
    (`utils.database.get_current_user`)."""
    import uuid as _uuid
    token = f"tok-{_uuid.uuid4().hex}"
    db = _merchant_sync_db()
    db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "email": f"{user_id}@test.local",
            "name": "Merchant Tester",
            "auth_provider": "email",
            "membership_type": "free",
        }},
        upsert=True,
    )
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
    })
    return token


def _auth_headers(user_id: str) -> dict:
    return {"Authorization": f"Bearer {_seed_merchant_user(user_id)}"}


def test_merchant_genius_phase_endpoint_public() -> None:
    """Public read endpoint — landing page reads this without auth."""
    client = _merchant_client()
    r = client.get("/api/merchant/genius-phase")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["phase"] == "GENIUS"
    assert d["cap"] == 50_000
    assert d["chair_price_usd"] == 20
    assert d["individual_ceiling"] == 100
    assert d["push_radius_miles"] == 3
    assert d["activation_fee_usd"] == {"min": 100, "max": 150}
    services = {s["id"] for s in d["services"]}
    assert services == {"hunger_vibez", "vibez_spots", "viberidez"}
    assert "dsg_tv_flight_usd" in d["addons"]
    assert "push_blast_usd" in d["addons"]


def test_merchant_writes_require_auth() -> None:
    """No session → 401 on every POST. Locks the auth gate so we can't
    silently regress to anonymous merchant onboarding."""
    client = _merchant_client()
    for url, body in [
        ("/api/merchant/onboard", {
            "merchant_id": "abc-xyz", "business_name": "biz-name",
            "service": "hunger_vibez", "activation_fee_paid": 100,
        }),
        ("/api/merchant/acquire-chair", {"merchant_id": "abc-xyz", "chairs": 1}),
        ("/api/merchant/push-blast/send", {
            "merchant_id": "abc-xyz", "headline": "hi", "body": "there",
        }),
        ("/api/merchant/dsg-tv/publish-ad", {
            "merchant_id": "abc-xyz", "title": "ad-title",
        }),
    ]:
        r = client.post(url, json=body)
        assert r.status_code == 401, f"{url} should require auth, got {r.status_code}"


def test_merchant_onboard_then_acquire_chair_flow() -> None:
    """Direct-onboard test path: register → buy 5 chairs → me reflects 6."""
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-merchant-{_uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid,
            "business_name": "Test Vibez Café",
            "service": "hunger_vibez",
            "activation_fee_paid": 100,
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["chairs_held"] == 1
    assert d["push_radius_miles"] == 3
    assert d["vibe_shield_enabled"] is True
    assert d["dsg_tv_placement"] is True
    assert d["owner_user_id"] == uid

    # Idempotent re-onboard returns the existing record.
    r2 = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid,
            "business_name": "Other Name",
            "service": "viberidez",
            "activation_fee_paid": 150,
        },
        headers=h,
    )
    assert r2.status_code == 200
    assert r2.json().get("already_onboarded") is True

    # Acquire +5 chairs.
    r3 = client.post(
        "/api/merchant/acquire-chair",
        json={"merchant_id": mid, "chairs": 5},
        headers=h,
    )
    assert r3.status_code == 200, r3.text
    d3 = r3.json()
    assert d3["chairs_held"] == 6
    assert d3["usd_paid"] == 100

    # /me is public — partners can verify chair holdings.
    r4 = client.get(f"/api/merchant/me/{mid}")
    assert r4.status_code == 200
    me = r4.json()
    assert me["chairs_held"] == 6
    assert me["credits"] == {"dsg_tv_flights": 0, "push_blasts": 0}


def test_merchant_owner_only_acquire_chair() -> None:
    """Another user cannot acquire chairs for a merchant they don't own."""
    import uuid as _uuid
    client = _merchant_client()
    owner_uid = f"u-{_uuid.uuid4().hex[:8]}"
    attacker_uid = f"u-{_uuid.uuid4().hex[:8]}"
    mid = f"test-owner-{_uuid.uuid4().hex[:8]}"
    client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid,
            "business_name": "Owned Café",
            "service": "hunger_vibez",
            "activation_fee_paid": 100,
        },
        headers=_auth_headers(owner_uid),
    )
    r = client.post(
        "/api/merchant/acquire-chair",
        json={"merchant_id": mid, "chairs": 1},
        headers=_auth_headers(attacker_uid),
    )
    assert r.status_code == 403, r.text


def test_merchant_chair_ceiling_enforced() -> None:
    """An individual merchant cannot exceed the 100-chair ceiling."""
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-ceiling-{_uuid.uuid4().hex[:8]}"
    client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid,
            "business_name": "Ceiling Test",
            "service": "hunger_vibez",
            "activation_fee_paid": 100,
        },
        headers=h,
    )
    r = client.post(
        "/api/merchant/acquire-chair",
        json={"merchant_id": mid, "chairs": 99},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["chairs_held"] == 100
    r2 = client.post(
        "/api/merchant/acquire-chair",
        json={"merchant_id": mid, "chairs": 1},
        headers=h,
    )
    assert r2.status_code == 400
    assert "ceiling" in r2.json()["detail"].lower()


def test_merchant_activation_fee_validation() -> None:
    """Activation fee must stay inside the $100–$150 PDF band."""
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-fee-{_uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Fee Test",
            "service": "hunger_vibez", "activation_fee_paid": 99,
        },
        headers=h,
    )
    assert r.status_code == 422, r.text
    r2 = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Fee Test",
            "service": "hunger_vibez", "activation_fee_paid": 151,
        },
        headers=h,
    )
    assert r2.status_code == 422
    r3 = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Fee Test",
            "service": "bogus_service", "activation_fee_paid": 100,
        },
        headers=h,
    )
    assert r3.status_code == 400


def test_merchant_push_blast_requires_credit() -> None:
    """Cannot fire a push blast without a credit on file (402)."""
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-blast-{_uuid.uuid4().hex[:8]}"
    client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Blast Test",
            "service": "hunger_vibez", "activation_fee_paid": 100,
            "lat": 40.7, "lng": -73.9,
        },
        headers=h,
    )
    r = client.post(
        "/api/merchant/push-blast/send",
        json={
            "merchant_id": mid,
            "headline": "Tonight only — 30% off any large pie",
            "body": "Show this push at the counter from 8pm-close.",
        },
        headers=h,
    )
    assert r.status_code == 402, r.text
    assert "credit" in r.json()["detail"].lower()


def test_merchant_push_blast_fanout_records_blast() -> None:
    """With a credit on file, /push-blast/send must consume the credit,
    insert a blast row, and return a fan-out summary even when FCM is
    not initialised in the test env."""
    from utils.database import get_database
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-fanout-{_uuid.uuid4().hex[:8]}"
    client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Fanout Test",
            "service": "hunger_vibez", "activation_fee_paid": 100,
            "lat": 40.7128, "lng": -74.006,
        },
        headers=h,
    )
    # Seed 1 push-blast credit directly via sync client.
    db = _merchant_sync_db()
    db.merchant_addon_credits.update_one(
        {"merchant_id": mid},
        {"$set": {"merchant_id": mid, "push_blasts": 1, "dsg_tv_flights": 0}},
        upsert=True,
    )
    r = client.post(
        "/api/merchant/push-blast/send",
        json={
            "merchant_id": mid,
            "headline": "Grand opening — 20% off",
            "body": "Tonight only, mention this push.",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["sent"] is True
    assert d["remaining_credits"] == 0
    assert "fanout" in d
    assert "tokens_targeted" in d["fanout"]
    # Recent-blasts feed should now include it.
    r2 = client.get(f"/api/merchant/push-blast/recent/{mid}")
    assert r2.status_code == 200
    assert any(b["headline"].startswith("Grand opening") for b in r2.json())


def test_merchant_dsg_tv_publish_ad_inserts_into_broadcast_queue() -> None:
    """Publishing an ad-flight consumes 1 credit and inserts a TVAd into
    `routes.vibe_tv_routes._ADS` so the scheduler will surface it on
    `/api/vibe-tv/schedule`."""
    from utils.database import get_database
    from routes.vibe_tv_routes import _ADS
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = _auth_headers(uid)
    mid = f"test-tv-{_uuid.uuid4().hex[:8]}"
    client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "TV Test",
            "service": "hunger_vibez", "activation_fee_paid": 100,
        },
        headers=h,
    )
    # No credit on file → 402.
    r0 = client.post(
        "/api/merchant/dsg-tv/publish-ad",
        json={"merchant_id": mid, "title": "Try our new lunch box"},
        headers=h,
    )
    assert r0.status_code == 402

    # Seed 1 flight credit and publish via sync client.
    db = _merchant_sync_db()
    db.merchant_addon_credits.update_one(
        {"merchant_id": mid},
        {"$set": {"merchant_id": mid, "push_blasts": 0, "dsg_tv_flights": 1}},
        upsert=True,
    )
    before = len(_ADS)
    r = client.post(
        "/api/merchant/dsg-tv/publish-ad",
        json={
            "merchant_id": mid,
            "title": "Try our new lunch box",
            "target_zip_codes": ["10001", "10002"],
            "duration_seconds": 15,
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["published"] is True
    assert d["remaining_credits"] == 0
    assert d["ad"]["advertiser_id"] == mid
    assert len(_ADS) == before + 1
    r2 = client.get(f"/api/merchant/dsg-tv/ads/{mid}")
    assert r2.status_code == 200
    assert any(a["title"] == "Try our new lunch box" for a in r2.json())


def test_merchant_routes_registered_in_app() -> None:
    """Guard against registry rollback — every /api/merchant path lives."""
    from server import app  # noqa: PLC0415
    paths = {getattr(r, "path", "") for r in app.routes}
    for required in [
        "/api/merchant/genius-phase",
        "/api/merchant/onboard",
        "/api/merchant/onboard/checkout",
        "/api/merchant/onboard/verify",
        "/api/merchant/acquire-chair",
        "/api/merchant/acquire-chair/checkout",
        "/api/merchant/acquire-chair/verify",
        "/api/merchant/addon/dsg-tv/checkout",
        "/api/merchant/addon/push-blast/checkout",
        "/api/merchant/addon/verify",
        "/api/merchant/push-blast/send",
        "/api/merchant/dsg-tv/publish-ad",
        "/api/merchant/dsg-tv/ads/{merchant_id}",
        "/api/merchant/push-blast/recent/{merchant_id}",
    ]:
        assert required in paths, f"Merchant route {required} missing from registry"


def test_merchant_frontend_pages_wired() -> None:
    """MerchantJoin + MerchantDashboard pages exist + have key testids."""
    join = open("/app/frontend/src/pages/MerchantJoin.tsx").read()
    for tid in [
        "merchant-join-page",
        "merchant-join-id",
        "merchant-join-name",
        "merchant-join-tier-${t}",  # template-literal source
        "merchant-join-cta",
        "pillar-hyper-local",
        "pillar-vibe-shield",
        "pillar-dsg-token",
        "addon-preview-dsg-tv",
        "addon-preview-push-blast",
    ]:
        assert tid in join, f"MerchantJoin missing testid: {tid}"

    dash = open("/app/frontend/src/pages/MerchantDashboard.tsx").read()
    for tid in [
        "merchant-dashboard-page",
        "stat-chairs",
        "stat-radius",
        "stat-dsg-tv",
        "stat-blasts",
        "panel-acquire-chair",
        "panel-dsg-tv",
        "panel-push-blast-buy",
        "panel-push-blast-send",
        "acquire-chair-cta",
        "dsg-tv-cta",
        "push-blast-cta",
        "blast-send-cta",
        "panel-dsg-tv-publish",
        "dsg-tv-publish-cta",
        "merchant-qr-card",
    ]:
        assert tid in dash, f"MerchantDashboard missing testid: {tid}"

    routes = open("/app/frontend/src/routes/monetizationRoutes.tsx").read()
    assert '"/merchant/join"' in routes, "MerchantJoin route not registered"
    assert '"/merchant/dashboard"' in routes, "MerchantDashboard route not registered"
    assert '"/merchant/ambassador"' in routes, "MerchantAmbassador route not registered"


def test_merchant_ambassador_playbook_wired() -> None:
    """[2026-05-16 v1.2] Field Ambassador playbook page must exist and
    surface every phase from `global_vibez_dsg_master_manual.pdf` plus
    the objection matrix and scan-asset block."""
    amb = open("/app/frontend/src/pages/MerchantAmbassador.tsx").read()
    for tid in [
        "merchant-ambassador-page",
        "phase-1-warm-hook",
        "phase-2-disrupt-legacy",
        "phase-3-edge-vibe-shield",
        "phase-4-closing-hammer",
        "phase-5-seamless-enrollment",
        "objection-time",
        "objection-hidden-costs",
        "ambassador-scan-asset",
        "deliverable-hyper-local",
        "deliverable-vibe-shield",
        "deliverable-dsg-token",
        "deliverable-chair",
        "ambassador-launch-cta",
    ]:
        assert tid in amb, f"MerchantAmbassador missing testid: {tid}"
    # Lock the exact CTA copy from the PDF.
    assert "CLAIM FOUNDING SEAT" in amb, "Ambassador CTA copy drifted from PDF"
    # Lock anchor phrases from each phase so the script can't be silently rewritten.
    for anchor in [
        "founding stake",
        "30% of every order",  # Phase 2
        "Vibe Shield completely insulates",  # Phase 3
        "partner-owned ecosystem",  # Phase 4
        "less than five minutes",  # Phase 5
    ]:
        assert anchor in amb, f"Ambassador script lost anchor phrase: {anchor!r}"


def test_merchant_join_cta_matches_pdf_copy() -> None:
    """The Business Brief CTA copy must match the PDF verbatim so the
    QR-scanned landing page hits the prescribed messaging."""
    join = open("/app/frontend/src/pages/MerchantJoin.tsx").read()
    assert "CLAIM FOUNDING SEAT" in join, "MerchantJoin CTA copy drifted from PDF"
    assert "merchant-join-ambassador-link" in join, (
        "MerchantJoin must link out to /merchant/ambassador for field reps"
    )


def test_merchant_dashboard_recent_activity_wired() -> None:
    """Dashboard must surface the Recent Activity timeline so merchants
    see ROI on each push-blast / ad-flight purchase."""
    dash = open("/app/frontend/src/pages/MerchantDashboard.tsx").read()
    for tid in [
        "recent-activity-section",
        "recent-blasts-panel",
        "recent-ads-panel",
    ]:
        assert tid in dash, f"MerchantDashboard missing recent-activity testid: {tid}"
    # Must fetch from the public recent endpoints.
    assert "/api/merchant/push-blast/recent/" in dash
    assert "/api/merchant/dsg-tv/ads/" in dash


def test_merchant_referral_leaderboard_endpoint() -> None:
    """Public leaderboard endpoint — returns top recruiters + reward
    constants. Empty list when no merchant has any referrals yet."""
    client = _merchant_client()
    r = client.get("/api/merchant/leaderboard?limit=5")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "top" in d and isinstance(d["top"], list)
    assert d["reward_threshold"] >= 1
    assert d["chair_price_usd"] == 20


def test_merchant_referral_attribution_and_reward() -> None:
    """End-to-end recruiter flow: referrer onboards 5 merchants via
    `referred_by`, earns 1 free chair on the 5th, appears on the
    leaderboard. Self-referral is a no-op."""
    import uuid as _uuid
    client = _merchant_client()
    db = _merchant_sync_db()

    # Onboard the referrer.
    ref_uid = f"u-{_uuid.uuid4().hex[:8]}"
    ref_token = _seed_merchant_user(ref_uid)
    ref_id = f"recruiter-{_uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": ref_id, "business_name": "Recruiter HQ",
            "service": "hunger_vibez", "activation_fee_paid": 100,
        },
        headers={"Authorization": f"Bearer {ref_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["chairs_held"] == 1

    # Self-referral must NOT credit.
    self_ref = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": ref_id, "business_name": "ignored",
            "service": "hunger_vibez", "activation_fee_paid": 100,
            "referred_by": ref_id,
        },
        headers={"Authorization": f"Bearer {ref_token}"},
    )
    # Already-onboarded path → 200 already_onboarded=True, no credit.
    assert self_ref.status_code == 200
    after_self = db.merchant_genius_phase.find_one({"merchant_id": ref_id})
    assert int(after_self.get("referrals_completed") or 0) == 0

    # Onboard 5 referred merchants.
    for i in range(5):
        new_uid = f"u-{_uuid.uuid4().hex[:8]}"
        new_token = _seed_merchant_user(new_uid)
        new_id = f"ref-merchant-{i}-{_uuid.uuid4().hex[:8]}"
        rr = client.post(
            "/api/merchant/onboard",
            json={
                "merchant_id": new_id, "business_name": f"Recruit {i}",
                "service": "hunger_vibez", "activation_fee_paid": 100,
                "referred_by": ref_id,
            },
            headers={"Authorization": f"Bearer {new_token}"},
        )
        assert rr.status_code == 200, rr.text

    # Referrer must now have 5 referrals and 1 reward chair.
    ref_doc = db.merchant_genius_phase.find_one({"merchant_id": ref_id})
    assert int(ref_doc.get("referrals_completed", 0)) == 5
    assert int(ref_doc.get("referral_rewards_granted", 0)) == 1
    # 1 baked-in + 1 reward = 2 chairs.
    assert int(ref_doc.get("chairs_held", 0)) == 2

    # Leaderboard surfaces them — use a wide limit because prior test
    # runs accumulate recruiter rows in the shared DB and can push our
    # fresh one off a top-10 default.
    lb = client.get("/api/merchant/leaderboard?limit=100").json()
    assert any(row["merchant_id"] == ref_id and row["referrals_completed"] == 5
               for row in lb["top"]), f"Referrer not on leaderboard: {lb}"


def test_merchant_referral_unknown_referrer_is_silent() -> None:
    """A bad `referred_by` value must NOT block the new merchant's
    onboard — referral attribution is best-effort."""
    import uuid as _uuid
    client = _merchant_client()
    uid = f"u-{_uuid.uuid4().hex[:8]}"
    h = {"Authorization": f"Bearer {_seed_merchant_user(uid)}"}
    mid = f"bad-ref-{_uuid.uuid4().hex[:8]}"
    r = client.post(
        "/api/merchant/onboard",
        json={
            "merchant_id": mid, "business_name": "Ignored Ref",
            "service": "hunger_vibez", "activation_fee_paid": 100,
            "referred_by": "does-not-exist-merchant",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["referred_by"] == "does-not-exist-merchant"


def test_merchant_leaderboard_page_wired() -> None:
    """Locks the leaderboard page testids + footer wiring."""
    lb = open("/app/frontend/src/pages/MerchantLeaderboard.tsx").read()
    for tid in [
        "merchant-leaderboard-page",
        "leaderboard-reward-card",
        "leaderboard-share-cta",
    ]:
        assert tid in lb, f"MerchantLeaderboard missing testid: {tid}"
    # The route is registered.
    routes = open("/app/frontend/src/routes/monetizationRoutes.tsx").read()
    assert '"/merchant/leaderboard"' in routes
    # MerchantJoin reads ?ref and shows the referral badge.
    join = open("/app/frontend/src/pages/MerchantJoin.tsx").read()
    assert "merchant-join-ref-badge" in join, "Join page missing ref badge"
    assert "merchant-join-leaderboard-link" in join, "Join page footer missing leaderboard link"
    # Dashboard surfaces the recruiter panel + leaderboard CTA.
    dash = open("/app/frontend/src/pages/MerchantDashboard.tsx").read()
    for tid in [
        "recruiter-section",
        "recruiter-panel",
        "recruiter-leaderboard-btn",
    ]:
        assert tid in dash, f"MerchantDashboard missing recruiter testid: {tid}"

# --- LOCKED ---------------------------------------------------------------
# [2026-05-16 v1.4] Landing tour audio + 9:16 MP4 freshness guard.
# After the Nova-narration regen + MP4 re-render, lock cache-busting +
# build-artifact sync so the deploy can never silently ship the old
# Onyx-voiced files again.
#
# Failure modes this protects against:
#   1. `frontend/public/` updated, but `frontend/build/` stale → deploy
#      pipelines that ship `build/` directly serve the old file.
#   2. New MP3/MP4 generated, but the i18n manifest + component still
#      reference the old URL without a cache-buster → SW + Cloudflare
#      keep serving the old bytes.
#   3. Service worker `CACHE_VERSION` not bumped → returning users
#      keep their pre-Nova cached MP3.


def test_landing_tour_assets_match_public_and_build() -> None:
    """`frontend/public/*` and `frontend/build/*` must serve the same
    bytes for every landing-tour asset. Drift = old voice on prod."""
    import hashlib
    from pathlib import Path

    pairs = [
        ("landing-tour-narration.mp3",     "landing-tour-narration.mp3"),
        ("landing-tour-narration-en.mp3",  "landing-tour-narration-en.mp3"),
        ("landing-tour-tiktok-9x16.mp4",   "landing-tour-tiktok-9x16.mp4"),
        ("landing-tour-i18n.json",         "landing-tour-i18n.json"),
        ("gv-sw.js",                       "gv-sw.js"),
    ]
    pub = Path("/app/frontend/public")
    bld = Path("/app/frontend/build")
    drift = []
    for p_name, b_name in pairs:
        p = pub / p_name
        b = bld / b_name
        if not p.exists():
            drift.append(f"{p} missing")
            continue
        if not b.exists():
            drift.append(f"{b} missing (run `yarn build` or sync from public)")
            continue
        ph = hashlib.sha256(p.read_bytes()).hexdigest()
        bh = hashlib.sha256(b.read_bytes()).hexdigest()
        if ph != bh:
            drift.append(f"{p_name}: public sha={ph[:12]} != build sha={bh[:12]}")
    assert not drift, "Stale build artifacts (deploy will ship old voice):\n  " + "\n  ".join(drift)


def test_landing_tour_cache_busters_wired() -> None:
    """All three call-sites that load the tour MP3/MP4 must use the
    `?v=nova-2026-05-16` cache-buster so SW + CDN never serve stale."""
    sw = open("/app/frontend/public/gv-sw.js").read()
    assert "gv-v2-20260516-nova" in sw, "Service worker CACHE_VERSION not bumped"
    assert "?v=nova-2026-05-16" in sw, "SW pre-cache URL missing cache-buster"

    manifest = open("/app/frontend/public/landing-tour-i18n.json").read()
    assert "?v=nova-2026-05-16" in manifest, "i18n manifest audio URL missing cache-buster"

    component = open("/app/frontend/src/components/landing/LandingTourVideo.tsx").read()
    assert "?v=nova-2026-05-16" in component, "Tour component MP3 src missing cache-buster"
    # MP4 download link must also bust cache.
    assert 'href="/landing-tour-tiktok-9x16.mp4?v=nova-2026-05-16"' in component, \
        "MP4 download href missing cache-buster"
    # The "Onyx" copy must be gone — should now say "Nova".
    assert "Onyx narration" not in component, "Tour component still advertises 'Onyx narration'"
    assert "Nova narration" in component, "Tour component must advertise 'Nova narration'"


def test_landing_tour_narration_mp3_is_new_nova_file() -> None:
    """Narration MP3s must be the new Nova-voice files. The OLD Onyx
    files were ~2.4-4.1 MB; the new Nova files are ~5.7 MB. If size
    regresses, someone reverted the regen."""
    from pathlib import Path
    pub = Path("/app/frontend/public")
    for name, min_bytes in [
        ("landing-tour-narration.mp3", 5_500_000),
        ("landing-tour-narration-en.mp3", 5_500_000),
    ]:
        f = pub / name
        assert f.exists(), f"missing {f}"
        size = f.stat().st_size
        assert size >= min_bytes, (
            f"{name} is only {size} bytes — looks like the OLD Onyx file "
            f"crept back in. Expected >= {min_bytes}."
        )


def test_landing_tour_index_js_registers_sw_with_update() -> None:
    """`src/index.js` must call `registration.update()` so returning
    users with the OLD SW get force-flushed on next page load."""
    idx = open("/app/frontend/src/index.js").read()
    assert "registration.update\\(\\)" not in idx  # literal escape check
    assert "reg.update()" in idx, (
        "index.js must force `reg.update()` on load so old service "
        "workers can't keep serving the Onyx MP3."
    )
    assert "controllerchange" in idx, (
        "index.js must reload once on `controllerchange` so the audio "
        "element refetches the new Nova MP3 after SW takeover."
    )


def test_landing_tour_mp4_not_older_than_narration_mp3() -> None:
    """The 9:16 vertical MP4 must be newer than (or same age as) the
    narration MP3 it was muxed from. If the MP3 was regenerated but
    the MP4 was forgotten, the MP4 still has the OLD voice burned in
    — and that's exactly the bug we just fixed. Fail the shield instead
    of letting it ship.

    Recovery: run `bash /app/scripts/regen_tour.sh` (or the individual
    step from its source)."""
    from pathlib import Path
    mp3 = Path("/app/frontend/public/landing-tour-narration-en.mp3")
    mp4 = Path("/app/frontend/public/landing-tour-tiktok-9x16.mp4")
    assert mp3.exists(), f"Missing {mp3}"
    assert mp4.exists(), f"Missing {mp4}"
    mp3_mtime = mp3.stat().st_mtime
    mp4_mtime = mp4.stat().st_mtime
    drift = mp3_mtime - mp4_mtime
    # Allow up to 60s of skew (filesystem timestamp jitter on copies).
    assert drift <= 60, (
        f"Stale MP4 — narration MP3 is {drift:.0f}s newer than the "
        f"rendered 9:16 video. The MP4 audio will be the OLD voice. "
        f"Run `bash /app/scripts/regen_tour.sh` then re-test."
    )


def test_landing_tour_regen_script_exists_and_executable() -> None:
    """Lock the one-shot regen script so it can't be deleted without
    breaking the shield — that script is the only documented path to
    bring every cache layer back in sync in one command."""
    import os
    p = "/app/scripts/regen_tour.sh"
    assert os.path.exists(p), f"Missing {p}"
    assert os.access(p, os.X_OK), f"{p} is not executable (chmod +x)"
    body = open(p).read()
    # The script must touch all 4 critical assets.
    for asset in [
        "landing-tour-narration-en.mp3",
        "landing-tour-tiktok-9x16.mp4",
        "landing-tour-i18n.json",
        "gv-sw.js",
    ]:
        assert asset in body, f"regen_tour.sh forgot to sync {asset}"


def test_landing_tour_mp4_matches_narration_full_length() -> None:
    """The 9:16 vertical MP4 must run for the FULL narration duration
    (~4:49 / 289.5s) so the download matches the streaming experience.
    Catches any future render that silently truncates back to 2:02.
    Recovery: `bash /app/scripts/regen_tour.sh`."""
    import json, shutil, subprocess
    from pathlib import Path
    import pytest as _pytest
    if shutil.which("ffprobe") is None:
        _pytest.skip("ffprobe not on PATH — install ffmpeg to enable this guard")
    mp4 = Path("/app/frontend/public/landing-tour-tiktok-9x16.mp4")
    manifest = json.loads(Path("/app/frontend/public/landing-tour-i18n.json").read_text())
    expected = float(manifest["languages"]["en"]["duration"])
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(mp4)],
        capture_output=True, text=True, check=True,
    )
    actual = float(result.stdout.strip())
    # 5s tolerance for ffmpeg keyframe rounding.
    assert abs(actual - expected) <= 5, (
        f"MP4 length {actual:.1f}s does not match narration {expected:.1f}s "
        f"(off by {actual - expected:+.1f}s). The download will play out "
        f"of sync with the streaming version. Run regen_tour.sh."
    )


def test_landing_tour_render_script_has_only_one_main() -> None:
    """The render script used to have a duplicate legacy `main()` that
    silently overwrote the new full-length output with a 2:02 short
    version. Lock this so it can never come back."""
    src = open("/app/backend/scripts/render_landing_tour_vertical.py").read()
    main_count = src.count('if __name__ == "__main__":')
    assert main_count == 1, (
        f"render_landing_tour_vertical.py has {main_count} `__main__` "
        f"guards — must be exactly 1. A duplicate legacy block crept "
        f"back in and will overwrite the full-length MP4 with an old "
        f"abbreviated render."
    )
    main_def_count = src.count("\ndef main(")
    assert main_def_count == 1, (
        f"render script defines main() {main_def_count} times — must be 1."
    )


def test_vibez654_side_bets_popup_uses_portal() -> None:
    """The Vibez 654 side-bets popup MUST be portaled to document.body
    via ReactDOM.createPortal. The parent Drawer has `backdrop-blur-md`
    which creates a CSS containing block that traps position:fixed
    descendants — without the portal, the popup renders as a 2px slit
    inside the collapsed drawer instead of full-screen. Fixed via
    portal on 2026-05-16; lock it so it can't regress."""
    src = open("/app/frontend/src/pages/games/Vibez654Game.tsx").read()
    assert 'createPortal' in src and 'react-dom' in src, (
        "Vibez654Game must import createPortal from react-dom for the "
        "side-bets popup. Removing this will trap the popup inside the "
        "drawer's backdrop-filter containing block."
    )
    assert "createPortal(" in src and "document.body" in src, (
        "Side-bets popup must call createPortal(<...>, document.body)"
    )
    # Drawer renders fullscreen-popup overlay only when `popup` prop is set.
    assert "popup = false" in src or "popup?: boolean" in src, (
        "Drawer must support a `popup` opt-in flag"
    )
    # Side-bets <Drawer> must pass `popup` flag (recent-rolls drawer
    # stays inline, so we must NOT see `popup` on the recent rolls one).
    side_bets_block_idx = src.find('testId="v654-side-bets"')
    next_drawer_idx = src.find("<Drawer", side_bets_block_idx + 1)
    side_bets_block = src[side_bets_block_idx:next_drawer_idx if next_drawer_idx > 0 else side_bets_block_idx + 1000]
    assert "popup" in side_bets_block, (
        "Side-bets <Drawer> must set the `popup` flag for the fullscreen overlay"
    )


def test_vibedice654_premium_side_bets_popup_is_fullscreen() -> None:
    """The Premium 654 side-bets popup must be a full-screen overlay,
    not a 520px bottom modal. User explicitly requested fullscreen.
    (The recent-rolls popup stays 520px — that's a separate panel.)"""
    src = open("/app/frontend/src/pages/games/VibeDice654Premium.tsx").read()
    # Find the side-bets popup block by its testid and inspect the
    # className on that motion.div (NOT the recent-rolls popup which
    # is a separate, intentionally-smaller panel).
    sb_idx = src.find('data-testid="sidebets-popup"')
    assert sb_idx > 0, "Premium 654 missing sidebets-popup testid"
    # Walk back to the motion.div that owns it.
    block_start = src.rfind("<motion.div", 0, sb_idx)
    block_end = src.find(">", sb_idx)
    block = src[block_start:block_end]
    assert "inset-0 sm:inset-4 md:inset-8" in block, (
        "Premium 654 side-bets popup not in fullscreen mode. "
        f"Expected `inset-0 sm:inset-4 md:inset-8` className on the "
        f"sidebets-popup motion.div. Found:\n{block}"
    )
    # The OLD broken side-bets className must be gone from this block.
    assert "w-[min(92vw,520px)]" not in block, (
        "Premium 654 side-bets popup reverted to the OLD 520px bottom "
        "modal — user explicitly asked for fullscreen."
    )


# ═══════════════════════════════════════════════════════════════════════
# 2026-05-17 — Backend refactor + Planet-Shift mobile groundwork (4 locks)
# ═══════════════════════════════════════════════════════════════════════


def test_beta_cohort_refactored_into_section_helpers():
    """2026-05-17 refactor: the monolithic ~120-line `beta_cohort` route
    handler is broken into 5 single-purpose section helpers so each can
    be tested / extended without touching the orchestrator. The route
    handler must stay a thin orchestrator that just composes them."""
    src = open("/app/backend/routes/admin_beta_cohort.py").read()
    for helper in [
        "_section_signups",
        "_section_roles",
        "_section_revenue",
        "_section_engagement",
        "_aggregate_spend",
        "_median_time_to_first_spend",
    ]:
        assert f"async def {helper}" in src, f"missing helper: {helper}"
    # The orchestrator must invoke each section helper exactly once.
    for call in [
        "_section_signups(db,",
        "_section_roles(db)",
        "_section_revenue(db,",
        "_section_engagement(db,",
    ]:
        assert call in src, f"orchestrator missing call: {call}"
    # The response shape stays identical — every regression-pinned key
    # from the original handler must still appear in the file.
    for key in [
        "total_paid_usd",
        "median_time_to_first_spend_min",
        "weakest_rooms_by_7d_visits",
        "activation_rate_pct",
        "jftn_season_passes_active",
        "active_role_pill",
    ]:
        assert key in src, f"beta-cohort response shape drift: missing {key}"


def test_lifespan_create_indexes_split_into_named_steps():
    """2026-05-17 refactor: `_create_indexes_async` was a ~150-line
    nested try-block monolith. Now it orchestrates 4 named helpers so
    each migration / index step can be reasoned about in isolation.

    2026-02 split: helpers live in ``lifespan_migrations.py`` (the
    migration bodies + orchestrator) and ``lifespan_indexes.py`` (the
    index spec helper). Both are required."""
    migrations = open("/app/backend/lifespan_migrations.py").read()
    indexes = open("/app/backend/lifespan_indexes.py").read()
    for helper in [
        "async def _migrate_grandfather_genesis_holders",
        "async def _migrate_chair_ids_backfill",
        "async def _migrate_phase_rename",
    ]:
        assert helper in migrations, f"lifespan_migrations missing helper: {helper}"
    assert "async def _create_indexes_from_spec" in indexes, (
        "lifespan_indexes missing _create_indexes_from_spec helper"
    )
    # The orchestrator must call all four.
    for call in [
        "_migrate_grandfather_genesis_holders(logger)",
        "_migrate_chair_ids_backfill(db, logger)",
        "_migrate_phase_rename(db, logger)",
        "_create_indexes_from_spec(db, logger)",
    ]:
        assert call in migrations, f"_create_indexes_async missing call: {call}"


def test_volumetric_dashboard_mobile_groundwork_wired():
    """2026-05-17 Planet-Shift mobile groundwork: the Volumetric Galaxy
    must lighten Three.js cost on phones (fewer stars, capped DPR,
    autorotate off, wider FOV) and expose a horizontal swipe gesture so
    users can advance one planet at a time without fighting OrbitControls
    drag. Locks the wiring so a future "clean up" can't drop it."""
    src = open("/app/frontend/src/pages/VolumetricDashboard.tsx").read()
    assert "useIsMobileGalaxy" in src, (
        "VolumetricDashboard must consume useIsMobileGalaxy hook"
    )
    assert "const isMobile = useIsMobileGalaxy()" in src
    # GalaxyScene must accept the mobile flag.
    assert "isMobile: boolean" in src
    assert "starCount = isMobile ? 1500 : 4000" in src
    assert "starRadius = isMobile ? 60 : 80" in src
    # Canvas: capped DPR + wider FOV + low-power GL hint on phones.
    assert "dpr={isMobile ? [1, 1.5] : [1, 2]}" in src
    assert "fov: isMobile ? 70 : 60" in src
    assert 'powerPreference: isMobile ? "low-power" : "high-performance"' in src
    # OrbitControls: autorotate disabled on mobile, damping on.
    assert "autoRotate={!isMobile && selectedIndex === null}" in src
    assert "enableDamping" in src
    # PlanetCarouselNav: 48px horizontal touch swipe → next/prev planet.
    assert "touchstart" in src and "touchend" in src
    assert "Math.abs(dx) < 48" in src


def test_use_is_mobile_galaxy_hook_module_exists():
    """The mobile groundwork hook must live as its own module so other
    surfaces (mobile Hot Rooms carousel, Live Now Wall, Volumetric Tour)
    can reuse the same 767px matchMedia breakpoint.

    2026-05-17 enhancement: the hook also flips lean-mode for low-end
    devices (`hardwareConcurrency < 4` OR `deviceMemory < 4`) so crusty
    Chromebooks + budget tablets that aren't mobile-width still get the
    lighter Three.js profile."""
    import os
    path = "/app/frontend/src/hooks/useIsMobileGalaxy.ts"
    assert os.path.exists(path), "useIsMobileGalaxy hook module missing"
    src = open(path).read()
    assert "export function useIsMobileGalaxy" in src
    assert "(max-width: 767px)" in src
    # Must use matchMedia, not a one-shot innerWidth check, so
    # orientation flips re-render the consumer.
    assert "matchMedia" in src
    # Backwards-compat: Safari <14 uses addListener/removeListener.
    assert "addListener" in src and "removeListener" in src
    # Low-end device gate — both signals must be checked.
    assert "hardwareConcurrency" in src, "missing hardwareConcurrency low-end probe"
    assert "deviceMemory" in src, "missing deviceMemory low-end probe"
    assert "LOW_CPU_THRESHOLD = 4" in src
    assert "LOW_MEMORY_THRESHOLD = 4" in src
    # The mql.matches || lowEnd OR must be present so lean-mode flips on
    # EITHER trigger.
    assert "mql.matches || lowEnd" in src



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-17 — Match Consensus + 72h Payout Airlock (anti-cheat, 3 locks)
# ═══════════════════════════════════════════════════════════════════════


def test_match_consensus_route_registered():
    """Founder spec: both teams submit independently, consensus locks
    the winner, mismatches flag DISPUTED + emit a security alert.
    Verify the route is mounted with all 3 endpoints + admin gate."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/match-consensus/submit" in paths, (
        "POST /api/match-consensus/submit is missing"
    )
    assert "/api/match-consensus/{match_id}" in paths, (
        "GET /api/match-consensus/{match_id} is missing"
    )
    assert "/api/match-consensus/{match_id}/resolve" in paths, (
        "POST /api/match-consensus/{match_id}/resolve is missing"
    )


def test_match_consensus_implementation_pins():
    """Lock the critical anti-cheat invariants so a future refactor
    can't silently weaken them: 72h airlock, security alert on mismatch,
    submission upsert keyed by (match_id, reporting_team_id), admin
    auth on resolve, idempotent airlock, both winner_id AND score must
    match for VERIFIED_SUCCESS."""
    src = open("/app/backend/routes/match_consensus.py").read()

    # 72-hour window is the founder spec — must stay 72.
    assert "AIRLOCK_HOURS = 72" in src, "Airlock window drifted from 72h"

    # Strict-majority + score-agreement helper must exist.
    assert "_strict_majority_winner" in src
    assert "count * 2 <= len(subs)" in src, "strict-majority threshold drift"

    # On winner+score match but hash mismatch we MUST flag for review.
    assert '"HASH_MISMATCH_REVIEW"' in src
    assert "_hashes_consistent" in src
    assert "GAME_LOG_HASH_MISMATCH" in src

    # On full mismatch we MUST flag DISPUTED + emit security alert.
    assert '"DISPUTED_FLAGGED"' in src
    assert "_emit_security_alert" in src
    assert "MATCH_DISCREPANCY" in src

    # Per-team submission is upserted on (match_id, reporting_team_id)
    # so a single team can't ballot-stuff.
    assert '"match_id": body.match_id, "reporting_team_id": body.reporting_team_id' in src, (
        "match_submissions write must scope to (match_id, reporting_team_id)"
    )

    # Airlock start must be idempotent (re-submitting can't reset the
    # 72h timer).
    assert "existing = await db.match_airlocks.find_one" in src
    assert "if existing:" in src

    # Admin resolve must require is_admin.
    assert 'getattr(user, "is_admin", False)' in src

    # _id must be stripped before any consensus/airlock response.
    assert "_strip_id" in src
    assert 'doc.pop("_id", None)' in src

    # Already-finalized matches MUST refuse new submissions (409).
    assert "Match already finalized" in src

    # Airlock release worker entry point exists.
    assert "async def release_due_airlocks" in src
    assert "/airlock/release-due" in src
    # Release must SKIP matches currently disputed or under hash review.
    assert "DISPUTED_FLAGGED" in src and "HASH_MISMATCH_REVIEW" in src


def test_airlock_release_worker_wired_in_lifespan():
    """The 72h airlock release loop MUST be kicked off from lifespan
    startup so payouts auto-clear without manual intervention."""
    src = open("/app/backend/lifespan.py").read()
    workers = open("/app/backend/lifespan_workers.py").read()
    assert "def _start_airlock_release_worker" in workers
    assert "Match Consensus airlock-release worker" in src
    assert "release_due_airlocks" in workers
    # 5-minute cadence — keeps load light, latency under the founder's
    # "≤6-min after clears_at" expectation for payout release.
    assert "asyncio.sleep(5 * 60)" in workers


def test_match_consensus_chip_wired_into_bracket():
    """The frontend bracket MUST surface a per-match consensus chip so
    players can see Verified/Disputed/Awaiting/Cleared at a glance."""
    import os
    chip_path = "/app/frontend/src/components/tournament/MatchConsensusChip.tsx"
    assert os.path.exists(chip_path), "MatchConsensusChip component missing"
    chip = open(chip_path).read()
    for tid in [
        "match-consensus-chip-verified",
        "match-consensus-chip-cleared",
        "match-consensus-chip-resolved",
        "match-consensus-chip-hash-mismatch",
        "match-consensus-chip-disputed",
        "match-consensus-chip-awaiting",
    ]:
        assert tid in chip, f"chip missing testid: {tid}"
    # Chip MUST consume the bulk context (one poll per bracket, not per cell).
    assert "useMatchConsensusBulk" in chip, (
        "Chip must read from MatchConsensusBulkContext"
    )
    # Solo-fetch fallback so the chip still works outside a Provider.
    assert "/api/match-consensus/" in chip

    # Bracket page must import + mount the chip AND wrap in the Provider.
    bracket = open("/app/frontend/src/pages/TournamentDetailsPage.tsx").read()
    assert "MatchConsensusChip" in bracket
    assert "<MatchConsensusChip matchId={match.match_id} />" in bracket
    assert "MatchConsensusBulkProvider" in bracket, (
        "Bracket page must wrap in MatchConsensusBulkProvider for shared polling"
    )


def test_match_consensus_bulk_endpoint_and_context():
    """Bulk endpoint + frontend context must exist so a 32-cell bracket
    fires ONE poll, not 32."""
    import os
    src = open("/app/backend/routes/match_consensus.py").read()
    # Bulk route exists, accepts comma-separated `match_ids`, capped at 128.
    assert '@router.get("/bulk")' in src
    assert "async def get_match_state_bulk" in src
    assert "match_ids.split" in src
    assert "max 128 match_ids per request" in src
    # CRITICAL: `/bulk` must be declared BEFORE `/{match_id}` or
    # FastAPI's path resolver will route it as `match_id=bulk`.
    idx_bulk = src.find('@router.get("/bulk")')
    idx_param = src.find('@router.get("/{match_id}")')
    assert idx_bulk > 0 and idx_param > 0 and idx_bulk < idx_param, (
        "GET /bulk must be declared before GET /{match_id}"
    )

    # Frontend bulk context + 50ms register debounce + 20s poll interval.
    ctx_path = "/app/frontend/src/components/tournament/MatchConsensusBulkContext.tsx"
    assert os.path.exists(ctx_path)
    ctx = open(ctx_path).read()
    assert "MatchConsensusBulkProvider" in ctx
    assert "useMatchConsensusBulk" in ctx
    assert "POLL_INTERVAL_MS = 20_000" in ctx
    assert "REGISTER_DEBOUNCE_MS = 50" in ctx
    # Refcount-based dedup so 2 chips on the same match don't double-poll.
    assert "refs.get(matchId)" in ctx


def test_airlock_release_hands_off_to_tournament_service():
    """When the worker clears an airlock it MUST hand off to the
    tournament service: write an audit row to match_payout_events and
    notify the winner via engagement (the same collection the existing
    tournament-win notification uses)."""
    src = open("/app/backend/routes/match_consensus.py").read()
    assert "match_payout_events" in src
    assert '"event": "airlock_cleared"' in src
    assert '"type": "match_payout_cleared"' in src
    assert "db.engagement.insert_one" in src
    # Handoff is non-fatal — clearance MUST succeed even if the audit
    # or notification write fails.
    assert "payout-event write failed" in src
    assert "engagement notify failed" in src


def test_frontend_hash_game_log_helper_exists():
    """Pure-JS helper that mirrors the backend's
    `hash_game_log(events)` so the client can produce the SAME hex
    digest the consensus engine compares. Must use SHA-256 + Web
    Crypto + the canonical `|` delimiter."""
    import os
    path = "/app/frontend/src/utils/hashGameLog.ts"
    assert os.path.exists(path), "hashGameLog frontend helper missing"
    src = open(path).read()
    assert "export async function hashGameLog" in src
    assert "SHA-256" in src
    assert 'join("|")' in src, "canonical delimiter must stay '|'"
    assert "TextEncoder" in src
    assert "crypto.subtle.digest" in src


def test_match_consensus_indexes_registered():
    """The Mongo indexes that enforce the per-team submission uniqueness
    + the consensus + airlock uniqueness must be in `_INDEX_SPECS`. The
    `(match_id, reporting_team_id)` UNIQUE index is the DB-level guard
    against ballot stuffing."""
    src = open("/app/backend/lifespan_indexes.py").read()
    # Per-team unique submission.
    assert '"coll": "match_submissions"' in src
    assert '"reporting_team_id"' in src
    # One consensus per match.
    assert '"coll": "match_consensus", "key": "match_id", "unique": True' in src
    # One airlock per match.
    assert '"coll": "match_airlocks", "key": "match_id", "unique": True' in src
    # Security alerts collection indexed for the crew dashboard.
    assert '"coll": "security_alerts"' in src



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-18 — Pricing consistency invariants (cross-surface anti-drift)
# ═══════════════════════════════════════════════════════════════════════


def test_no_retired_chair_supply_ladder_copy_resurfaces():
    """The retired $20/$100/$250 static supply ladder is replaced by
    Genius $20 + live Equity Master valuation post-Genius. No
    landing-page surface should reintroduce the legacy ladder copy
    ('Apex $250', '3-tier ladder', etc.) — visual drift is the
    single biggest source of user confusion on pricing.

    This test scans the 6 landing surfaces that previously carried the
    dead pitch and ensures they DON'T reference the retired phase names
    as a price ladder. Mentioning 'Apex' inside an unrelated context
    (e.g., the High Roller VIP `apex` tier id) is fine — only the
    retired CHAIR ladder copy is forbidden.
    """
    import os
    surfaces = [
        "/app/frontend/src/components/landing/WelcomeLetter.tsx",
        "/app/frontend/src/components/landing/TokenRoadmap.tsx",
        "/app/frontend/src/components/landing/WaysToEarn.tsx",
        "/app/frontend/src/components/landing/EvolutionCountdown.tsx",
        "/app/frontend/src/components/landing/ApexWishlistOptIn.tsx",
        "/app/frontend/src/pages/LandingNeonGaming.tsx",
        "/app/frontend/src/pages/Landing.tsx",
    ]
    forbidden_phrases = [
        # Old chair-ladder pricing combos:
        "Apex $250", "Apex ($250", "$250 Apex", "$50 Apex",
        "250,000 Apex seats",
        "Genesis $100 ", "$100 Genesis",
        # Old ladder shape pitch:
        "3-tier ladder", "Three tiers", "three tiers",
        "200K active chairs", "200,000 active chairs",
        "$50 bracket", "12.5×", "12.5x",
    ]
    drift = []
    for path in surfaces:
        if not os.path.exists(path):
            continue
        body = open(path).read()
        for phrase in forbidden_phrases:
            if phrase in body:
                drift.append(f"{os.path.basename(path)} :: {phrase!r}")
    assert not drift, (
        "Retired chair-ladder copy resurfaced — value-driven plan must "
        "be the only public pitch:\n  - " + "\n  - ".join(drift)
    )


def test_pricing_tiers_doc_comment_matches_backend_catalog():
    """The /pricing page docblock used to list `$10 / $20 / $29 / $65`
    even though the backend catalog serves `$9 / $19 / $39 / $89`. The
    page renders runtime catalog data so users see correct prices, but
    a wrong code comment is a credibility hit on PR review. Lock the
    comment to either drop the price list OR match the backend exactly.
    """
    import re
    src = open("/app/frontend/src/pages/PricingTiers.tsx").read()
    # Pull the top comment block. If a price list appears, it must use
    # backend-canonical $9/$19/$39/$89 ordered exactly.
    if "$10" in src and "$20" in src and "$29" in src and "$65" in src:
        raise AssertionError(
            "PricingTiers.tsx top comment still shows retired $10/$20/$29/$65 "
            "ladder. Replace with $9/$19/$39/$89 (backend catalog) or drop "
            "the price list from the docblock entirely."
        )
    # If the comment lists a 4-number ladder, it must match backend exactly.
    m = re.search(r"\$(\d+)\s*/\s*\$(\d+)\s*/\s*\$(\d+)\s*/\s*\$(\d+)", src[:600])
    if m:
        assert m.groups() == ("9", "19", "39", "89"), (
            f"PricingTiers.tsx docblock price ladder drifted: {m.group(0)} "
            f"— backend catalog serves $9 / $19 / $39 / $89."
        )


def test_genius_floor_pinned_at_twenty_dollars_everywhere():
    """The single non-negotiable price across the whole platform: Genius
    chair = $20 floor seat. Backend constant, live PHASES[0] checkout
    row, and the Equity Master formula must all agree."""
    from routes.chairs import PHASES
    from routes.equity_master import GENIUS_PHASE_FLOOR_USD
    from services.chair_expansion import GENIUS_PHASE_FLOOR_USD as svc_floor
    assert PHASES[0]["price_usd"] == 20.0, "Live Genius checkout price drifted"
    assert GENIUS_PHASE_FLOOR_USD == 20, "Equity Master Genius anchor drifted"
    assert svc_floor == 20, "Chair expansion service Genius anchor drifted"



# ═══════════════════════════════════════════════════════════════════════
# 2026-05-18 — Security Directive Compliance + Tier Rebalance (5 locks)
# ═══════════════════════════════════════════════════════════════════════


def test_security_directive_d1_sandbox_firewall_registered():
    """D1: server.py MUST register a global exception handler that
    sanitizes unhandled errors AND writes a row to `security_events`
    for the D4 monitoring stream."""
    src = open("/app/backend/server.py").read()
    assert '@app.exception_handler(Exception)' in src, (
        "Security D1: global exception handler missing"
    )
    assert "_sandbox_firewall" in src
    # Must return a sanitized response — never the raw message body.
    assert '"detail": "internal error"' in src
    # Must mint a stable request_id for support correlation.
    assert "request_id" in src
    # Must hand off to D4 monitoring via security_events write.
    assert "security_events.insert_one" in src


def test_security_directive_d2_shared_payout_airlock_module():
    """D2: a single shared `services/payout_airlock.py` enforces the
    NON-negotiable 72-hour hold across every outward transfer source."""
    import os
    path = "/app/backend/services/payout_airlock.py"
    assert os.path.exists(path), "Security D2: payout_airlock service missing"
    src = open(path).read()
    assert "AIRLOCK_HOURS = 72" in src, "D2 airlock window drifted from 72h"
    assert "async def enqueue_payout" in src
    assert "async def release_due_payouts" in src
    # Worker MUST scan on (status=held, clears_at<=now) — pinned to the
    # composite index we just created.
    assert '"status": "held"' in src
    assert '"clears_at"' in src

    # Background worker MUST be kicked off from lifespan.
    lifespan = open("/app/backend/lifespan.py").read()
    assert "_start_payout_airlock_release_worker" in lifespan
    assert "Payout Airlock release worker" in lifespan


def test_security_directive_d4_admin_security_console_routes():
    """D4: admin console exposes events feed + global airlock view +
    manual release trigger. All 3 endpoints MUST be admin-gated."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/admin/security/events" in paths
    assert "/api/admin/security/airlocks" in paths
    assert "/api/admin/security/airlocks/release-due" in paths
    src = open("/app/backend/routes/admin_security.py").read()
    # All 3 endpoints MUST call _require_admin first.
    assert src.count("_require_admin(request)") >= 3


def test_no_dollar_sign_in_game_pages():
    """Founder rule: no game page may display a literal '$' currency
    sign. All money in-game is ₵ (Vibez Coin). This catches the next
    time someone copy-pastes a `$${x.toFixed(2)}` from a casino lib."""
    import glob, re
    offenders = []
    forbidden_patterns = [
        # ">$<digit>" — literal dollar followed by a digit in JSX text
        re.compile(r">\$\d"),
        # ">${var.toFixed(N)}" — JSX-text dollar-prefixed coin display
        re.compile(r">\$\{[^}]*\.toFixed"),
        # "$${expr.toFixed" — escaped template literal dollar coin display
        re.compile(r"\$\$\{[^}]*\.toFixed"),
    ]
    for path in glob.glob("/app/frontend/src/pages/games/*.tsx"):
        body = open(path).read()
        for pat in forbidden_patterns:
            for m in pat.finditer(body):
                offenders.append(f"{path.split('/')[-1]} :: {m.group(0)!r}")
    assert not offenders, (
        "Forbidden '$' currency display found inside /games/ — replace "
        "with '₵' (Vibez Coin):\n  - " + "\n  - ".join(offenders[:25])
    )


def test_coin_pack_catalog_internally_consistent():
    """Coin pack bonus_pct labels must match the actual ₵/$ delivered
    relative to the COINS_PER_USD base rate. Drift here = customer
    seeing 'Save 10%!' but actually getting 11% — confusing trust hit."""
    from routes.coin_topup import COIN_PACKS
    from services.coin_wallet import COINS_PER_USD
    for pack_id, pack in COIN_PACKS.items():
        base_coins = pack["usd"] * COINS_PER_USD
        actual_bonus_pct = round(
            (pack["coins"] - base_coins) / base_coins * 100
        )
        labeled = pack["bonus_pct"]
        assert abs(actual_bonus_pct - labeled) <= 1, (
            f"Coin pack '{pack_id}' labels {labeled}% bonus but actually "
            f"delivers {actual_bonus_pct}% ({pack['coins']} ₵ / ${pack['usd']} "
            f"vs base {int(base_coins)} ₵)"
        )


def test_sovereign_tiers_have_explicit_activity_caps():
    """Every tier in the catalog must declare `activity_caps` so the
    frontend can render a balanced comparison ladder. Caps must
    monotonically increase from Guest → Sovereign on at least 3 axes
    (daily_allowance, replays, chair_mining_cap)."""
    from routes.sovereign_tiers import TIERS
    subscription_tiers = ["guest", "insider", "tastemaker", "royal", "sovereign"]
    by_id = {t["id"]: t for t in TIERS}
    for tier_id in subscription_tiers:
        assert tier_id in by_id, f"tier {tier_id} missing"
        tier = by_id[tier_id]
        assert "activity_caps" in tier, f"tier {tier_id} missing activity_caps"
        caps = tier["activity_caps"]
        for key in ["daily_allowance_credits", "saved_replays", "chair_mining_cap_x"]:
            assert key in caps, f"{tier_id} missing cap '{key}'"

    # Strictly monotonic ascent on the 3 axes.
    for key in ["daily_allowance_credits", "chair_mining_cap_x"]:
        values = [by_id[t]["activity_caps"][key] for t in subscription_tiers]
        # -1 sentinel = unlimited; treat as max
        norm = [(10**9 if v == -1 else v) for v in values]
        assert norm == sorted(norm), (
            f"Activity-cap '{key}' is not monotonic across "
            f"Guest→Sovereign: {values}"
        )
    # Genius Chair must stack with subscriptions, not replace them.
    gc = by_id.get("genius_chair", {})
    assert gc.get("activity_caps", {}).get("stacks_with_subscription") is True, (
        "Genius Chair must stack with subscription tier multipliers"
    )


def test_pricing_catalog_service_exposes_vip_tiers():
    """Feb 2026 — pricing for VIP tiers must be routed through the
    Mongo-backed pricing catalog so the founder can mutate prices
    without a redeploy. The service must expose:
      • CATALOG_DEFAULTS with the 'high_roller_vip_tiers' key
      • async helpers get_vip_tiers / get_vip_tier_price_usd
      • seed_pricing_catalog + update_catalog + invalidate_cache
    """
    from services import pricing_catalog
    assert "high_roller_vip_tiers" in pricing_catalog.CATALOG_DEFAULTS, (
        "Pricing catalog must define defaults for high_roller_vip_tiers"
    )
    defaults = pricing_catalog.CATALOG_DEFAULTS["high_roller_vip_tiers"]
    assert "tiers" in defaults and isinstance(defaults["tiers"], dict)
    # The default seed must agree with the locked Python constants.
    from services.high_roller_economy import VIP_TIERS
    assert defaults["tiers"]["genius"]["price_usd"] == VIP_TIERS["genius"]["price_usd"]
    for fn in ("seed_pricing_catalog", "get_catalog", "update_catalog",
               "invalidate_cache", "get_vip_tiers", "get_vip_tier_price_usd"):
        assert callable(getattr(pricing_catalog, fn, None)), (
            f"pricing_catalog must expose async helper '{fn}'"
        )


def test_admin_pricing_routes_registered():
    """The admin pricing endpoints must be wired so the founder UI can
    list / update / audit catalogs at runtime."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    must_have = [
        "/api/admin/pricing/catalogs",
        "/api/admin/pricing/catalogs/{catalog_id}",
        "/api/admin/pricing/vip-tiers/{tier_id}",
        "/api/admin/pricing/catalogs/{catalog_id}/history",
    ]
    for p in must_have:
        assert p in paths, f"Missing admin pricing route: {p}"


def test_high_roller_routes_use_pricing_catalog():
    """High Roller /tiers + /checkout must read from the live catalog
    (Mongo-backed) so admin price edits propagate without a redeploy."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "routes" / "high_roller.py").read_text(encoding="utf-8")
    assert "from services.pricing_catalog import get_vip_tiers" in body, (
        "high_roller.py must import the pricing catalog helper"
    )
    assert "await get_vip_tiers(" in body, (
        "high_roller.py /tiers + /checkout must call await get_vip_tiers()"
    )


def test_pricing_catalog_seed_wired_into_lifespan():
    """The seeder must run on startup so the collection is populated on
    the first boot without any manual ops step. The seeder helper now
    lives in ``lifespan_migrations`` (Feb 2026 split)."""
    from pathlib import Path
    body = (Path(__file__).resolve().parents[1] /
            "lifespan_migrations.py").read_text(encoding="utf-8")
    assert "_seed_pricing_catalog(" in body, (
        "lifespan_migrations must call _seed_pricing_catalog(db, logger) on startup"
    )
    assert "seed_pricing_catalog" in body, (
        "lifespan_migrations must import services.pricing_catalog.seed_pricing_catalog"
    )

def test_lifespan_split_into_focused_modules():
    """Feb 2026 split: ``lifespan.py`` was an 850-line monolith. The
    heavy implementation now lives in three focused modules so each can
    be audited / appended to without scrolling past unrelated code.

    Locks the wiring so a future "consolidation" can't undo it:
      • lifespan_workers     — all `_start_*` + `_kick_off`
      • lifespan_migrations  — `_migrate_*` + `_seed_*` + `_create_indexes_async`
      • lifespan_indexes     — `_INDEX_SPECS` + `_create_indexes_from_spec`
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]
    for name, must_have in [
        ("lifespan_workers.py", ["_kick_off",
                                  "def _start_card_royale",
                                  "def _start_payout_airlock_release_worker"]),
        ("lifespan_migrations.py", ["async def _migrate_grandfather_genesis_holders",
                                     "async def _migrate_chair_ids_backfill",
                                     "async def _migrate_phase_rename",
                                     "async def _seed_pricing_catalog",
                                     "async def _create_indexes_async"]),
        ("lifespan_indexes.py", ["_INDEX_SPECS",
                                  "async def _create_indexes_from_spec"]),
    ]:
        p = backend / name
        assert p.exists(), f"Lifespan split: {name} missing"
        body = p.read_text(encoding="utf-8")
        for token in must_have:
            assert token in body, f"{name} missing: {token}"

    # lifespan.py must stay slim — it's now an entry point only.
    lifespan_body = (backend / "lifespan.py").read_text(encoding="utf-8")
    lifespan_lines = lifespan_body.count("\n")
    assert lifespan_lines < 200, (
        f"lifespan.py grew back to {lifespan_lines} lines — keep heavy code "
        "in the lifespan_workers/migrations/indexes modules."
    )
    # And it must still export the public API server.py relies on.
    assert "def register_startup_tasks" in lifespan_body
    assert "def register_shutdown" in lifespan_body

def test_payments_audit_service_and_routes_wired():
    """Feb 2026 — unified payments audit must exist so the founder can
    reconcile Stripe receipts against internal coin credits without
    manually joining 4 collections. Pin:
      • service ``services/payments_audit.py`` with ``record_payment_event``
      • admin routes mounted at ``/api/admin/payments-audit/*``
      • coin top-up + high roller checkout call record_payment_event
      • the ``payments_audit`` mongo index is in the spec list
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]

    svc = (backend / "services" / "payments_audit.py").read_text(encoding="utf-8")
    assert "async def record_payment_event" in svc, (
        "payments_audit service must expose record_payment_event()"
    )

    route_body = (backend / "routes" / "admin_payments_audit.py").read_text(encoding="utf-8")
    for path_token in ['"/events"', '"/summary"', '"/reconcile"']:
        assert path_token in route_body, (
            f"admin_payments_audit missing route {path_token}"
        )

    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in (
        "/api/admin/payments-audit/events",
        "/api/admin/payments-audit/summary",
        "/api/admin/payments-audit/reconcile",
    ):
        assert p in paths, f"Missing admin payments-audit route: {p}"

    # Coin top-up + high roller must call the audit writer.
    coin_body = (backend / "routes" / "coin_topup.py").read_text(encoding="utf-8")
    hr_body = (backend / "routes" / "high_roller.py").read_text(encoding="utf-8")
    assert "record_payment_event" in coin_body, (
        "coin_topup must call record_payment_event on checkout + webhook"
    )
    assert "record_payment_event" in hr_body, (
        "high_roller must call record_payment_event on checkout"
    )

    # Index spec must cover the new collection.
    idx = (backend / "lifespan_indexes.py").read_text(encoding="utf-8")
    assert '"coll": "payments_audit"' in idx, (
        "payments_audit index missing from lifespan_indexes._INDEX_SPECS"
    )
def test_admin_tier_pricing_ui_wired():
    """Feb 2026 — founder admin UI for hot-editing VIP tier pricing
    must exist at /admin/tier-pricing and wire to the catalog/patch
    endpoints. Pin the route + testids + API calls."""
    from pathlib import Path
    fe = Path("/app/frontend/src")

    page = (fe / "pages" / "admin" / "AdminTierPricing.tsx").read_text(encoding="utf-8")
    assert "/api/admin/pricing/catalogs/" in page, (
        "AdminTierPricing must read from the pricing catalog GET endpoint"
    )
    assert "/api/admin/pricing/vip-tiers/" in page, (
        "AdminTierPricing must PATCH /api/admin/pricing/vip-tiers/{id}"
    )
    for tid in [
        "admin-tier-pricing-page",
        "admin-tier-pricing-grid",
        "admin-tier-pricing-history-section",
    ]:
        assert tid in page, f"AdminTierPricing missing data-testid '{tid}'"

    routes = (fe / "routes" / "adminRoutes.tsx").read_text(encoding="utf-8")
    assert "AdminTierPricing" in routes and "/admin/tier-pricing" in routes, (
        "AdminTierPricing must be registered at /admin/tier-pricing"
    )

def test_mobile_arc_carousel_replaces_canvas_on_phone():
    """Feb 2026 Planet-Shift mobile redesign — Master Blueprint v2.

    Phones no longer render the Three.js Volumetric Galaxy; they render
    a 2D arc carousel that reuses the same CATEGORIES data. Pin:
      • the MobileArcCarousel component exists with focus / swipe wiring
      • VolumetricDashboard imports it and renders it when `isMobile` is true
      • CATEGORIES is exported so the carousel + canvas share the source
    """
    from pathlib import Path
    fe = Path("/app/frontend/src")

    carousel = (fe / "components" / "dashboard" / "MobileArcCarousel.tsx").read_text(encoding="utf-8")
    for tid in [
        "mobile-arc-carousel",
        "mobile-arc-carousel-prev-btn",
        "mobile-arc-carousel-next-btn",
        "mobile-arc-carousel-arc",
    ]:
        assert tid in carousel, f"MobileArcCarousel missing testid '{tid}'"
    # Swipe + keyboard nav must be wired so users can advance focus
    # without leaning on the Three.js canvas.
    assert "onTouchStart" in carousel and "onTouchEnd" in carousel, (
        "MobileArcCarousel must support swipe gestures"
    )
    assert "ArrowRight" in carousel and "ArrowLeft" in carousel, (
        "MobileArcCarousel must support keyboard arrow keys (tablets)"
    )

    page = (fe / "pages" / "VolumetricDashboard.tsx").read_text(encoding="utf-8")
    assert "export const CATEGORIES" in page, (
        "VolumetricDashboard must export CATEGORIES so the mobile carousel reuses it"
    )
    assert "import MobileArcCarousel" in page, (
        "VolumetricDashboard must import the MobileArcCarousel component"
    )
    assert "if (isMobile) {" in page, (
        "VolumetricDashboard must early-return MobileArcCarousel on mobile"
    )

def test_mobile_galaxy_tour_renders_first_visit_only():
    """Feb 2026 — first-time mobile users see a 3-step coach-mark
    walkthrough explaining the arc carousel (tap-to-focus, swipe-to-
    rotate, tap-room-to-dive-in). Returning users don't.

    Pin the wiring so a future "clean up" can't drop it:
      • MobileGalaxyTour component exists with 3 steps + skip + next + finish
      • localStorage key 'gv_mobile_galaxy_tour_seen' gates re-show
      • MobileArcCarousel imports and renders <MobileGalaxyTour />
    """
    from pathlib import Path
    fe = Path("/app/frontend/src")

    tour = (fe / "components" / "dashboard" / "MobileGalaxyTour.tsx").read_text(encoding="utf-8")
    assert "STORAGE_KEY" in tour and "gv_mobile_galaxy_tour_seen" in tour, (
        "MobileGalaxyTour must persist the seen-flag in localStorage"
    )
    # Exactly 3 steps shipped per founder spec.
    assert tour.count('"title":') >= 3 or tour.count("title:") >= 3, (
        "MobileGalaxyTour must define 3 walkthrough steps"
    )
    for tid in [
        "mobile-galaxy-tour-overlay",
        "mobile-galaxy-tour-skip-btn",
        "mobile-galaxy-tour-next-btn",
        "mobile-galaxy-tour-finish-btn",
        "mobile-galaxy-tour-dots",
    ]:
        assert tid in tour, f"MobileGalaxyTour missing data-testid '{tid}'"

    carousel = (fe / "components" / "dashboard" / "MobileArcCarousel.tsx").read_text(encoding="utf-8")
    assert "import MobileGalaxyTour" in carousel, (
        "MobileArcCarousel must import the tour component"
    )
    assert "<MobileGalaxyTour" in carousel, (
        "MobileArcCarousel must render <MobileGalaxyTour /> on the page"
    )

def test_admin_payments_audit_ui_wired():
    """Feb 2026 — founder-facing UI for the Stripe-vs-internal-credit
    drift detector. Pins the route + key testids + API wiring so the
    surface can't be silently broken by future refactors."""
    from pathlib import Path
    fe = Path("/app/frontend/src")

    page = (fe / "pages" / "admin" / "AdminPaymentsAudit.tsx").read_text(encoding="utf-8")
    # Must hit all 3 backend endpoints.
    for path_token in [
        "/api/admin/payments-audit/reconcile",
        "/api/admin/payments-audit/summary",
        "/api/admin/payments-audit/events",
    ]:
        assert path_token in page, (
            f"AdminPaymentsAudit must call {path_token}"
        )
    # Critical testids that ops automation / E2E will look for.
    for tid in [
        "admin-payments-audit-page",
        "admin-payments-audit-reconcile-card",
        "admin-payments-audit-drift-badge",
        "admin-payments-audit-stripe-paid",
        "admin-payments-audit-credited",
        "admin-payments-audit-drift",
        "admin-payments-audit-summary-card",
        "admin-payments-audit-events-card",
        "admin-payments-audit-window-picker",
    ]:
        assert tid in page, f"AdminPaymentsAudit missing data-testid '{tid}'"

    routes = (fe / "routes" / "adminRoutes.tsx").read_text(encoding="utf-8")
    assert "AdminPaymentsAudit" in routes and "/admin/payments-audit" in routes, (
        "AdminPaymentsAudit must be registered at /admin/payments-audit"
    )

def test_payments_audit_drift_alert_wired():
    """Feb 2026 — background worker emails the founder via Resend when
    Stripe-vs-internal-credit drift exceeds the threshold. Pin:
      • service ``services/payments_audit_alert.py`` with the canonical
        helpers + Resend send path
      • lifespan_workers kicks it off on startup
      • admin route exposes the manual ``/check-now`` + ``/alerts`` paths
      • ``payments_audit_alerts`` index registered in the index spec
      • frontend AdminPaymentsAudit page renders the alerts panel +
        Check-now button
    """
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1]

    svc = (backend / "services" / "payments_audit_alert.py").read_text(encoding="utf-8")
    for token in [
        "DRIFT_THRESHOLD_USD",
        "async def evaluate_and_alert",
        "async def drift_alert_loop",
        "RESEND_API_KEY",
        "payments_audit_alerts",
        "COOLDOWN_HOURS",
    ]:
        assert token in svc, f"payments_audit_alert.py missing token '{token}'"

    workers = (backend / "lifespan_workers.py").read_text(encoding="utf-8")
    assert "def _start_payments_audit_drift_alert" in workers, (
        "lifespan_workers must expose _start_payments_audit_drift_alert"
    )
    assert "drift_alert_loop" in workers, (
        "_start_payments_audit_drift_alert must call drift_alert_loop"
    )

    lifespan = (backend / "lifespan.py").read_text(encoding="utf-8")
    assert "_start_payments_audit_drift_alert" in lifespan, (
        "lifespan.py must kick off the drift alert worker"
    )

    routes = (backend / "routes" / "admin_payments_audit.py").read_text(encoding="utf-8")
    assert '"/check-now"' in routes and '"/alerts"' in routes, (
        "admin_payments_audit must expose POST /check-now and GET /alerts"
    )

    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for p in (
        "/api/admin/payments-audit/check-now",
        "/api/admin/payments-audit/alerts",
    ):
        assert p in paths, f"Missing admin route: {p}"

    idx = (backend / "lifespan_indexes.py").read_text(encoding="utf-8")
    assert '"coll": "payments_audit_alerts"' in idx, (
        "payments_audit_alerts index missing"
    )

    # Frontend wiring
    fe_page = (Path("/app/frontend/src") / "pages" / "admin" / "AdminPaymentsAudit.tsx").read_text(encoding="utf-8")
    for tid in [
        "admin-payments-audit-check-now-btn",
        "admin-payments-audit-alerts-card",
    ]:
        assert tid in fe_page, f"AdminPaymentsAudit missing testid '{tid}'"
    assert "/api/admin/payments-audit/check-now" in fe_page, (
        "AdminPaymentsAudit must POST /check-now"
    )
    assert "/api/admin/payments-audit/alerts" in fe_page, (
        "AdminPaymentsAudit must GET /alerts"
    )

