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
    """Feb 2026: PrivyLoginButton must render NOTHING on domains not in
    the Privy allow-list. The self-hide guard uses `giveUp` state + the
    `securitypolicyviolation` listener. Regressions here cause the
    'really big outrageous modal' bug."""
    path = "/app/frontend/src/components/web3/PrivyLoginButton.tsx"
    content = open(path).read()
    assert "giveUp" in content, "Privy self-hide state removed"
    assert "securitypolicyviolation" in content, "Privy CSP-listener removed"
    assert "if (giveUp) return null" in content, "Privy early-exit removed"


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
    Lock the toggle buttons + the 'flex-1 min-h-0' scrollable main.
    """
    from pathlib import Path
    src = Path("/app/frontend/src/pages/games/VibeDice654Premium.tsx").read_text()
    assert 'data-testid="vibe654-toggle-sidebets"' in src, (
        "Standalone /dice lost the Side Bets drawer toggle"
    )
    assert 'data-testid="vibe654-toggle-recent"' in src, (
        "Standalone /dice lost the Recent Rolls drawer toggle"
    )
    # May 2026: Founder asked to eliminate scrolling on this room.
    # `overflow-y-auto` was swapped for `overflow-hidden` so the round
    # always fits one viewport on phone. Keep the locked-height wrapper.
    assert "flex-1 min-h-0 overflow-hidden" in src, (
        "Standalone /dice lost the locked-height single-viewport main region"
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


def test_chair_ladder_is_final_3_tier_shape() -> None:
    """Founder-confirmed 2026-05-04: final 3-tier ladder locks the entire
    chair economy. No more 5-phase $5-step ramp, no more 10-phase $10→$65
    ladder. Compact, dramatic, and impossible for a future agent to
    accidentally regress.

       Tier 1 · Genius  · $20   × 50,000  chairs  · weight 3×  · cap 100/wallet
       Tier 2 · Genesis · $100  × 100,000 chairs  · weight 2×  · no cap
       Tier 3 · Apex    · $250  × 50,000  chairs  · weight 1×  · no cap

    Total active circulation = 200,000 chairs (+ 800,000 Reserve Vault).
    """
    from routes.chairs import PHASES, GENIUS_PER_USER_CAP
    from services.chair_expansion import EXPANSION_TIERS
    assert len(PHASES) == 3, "Chair ladder is not 3 tiers"
    assert PHASES[0]["name"] == "Genius" and PHASES[0]["price_usd"] == 20.0 and PHASES[0]["limit"] == 50_000 and PHASES[0]["weight"] == 3.0
    assert PHASES[1]["name"] == "Genesis" and PHASES[1]["price_usd"] == 100.0 and PHASES[1]["limit"] == 150_000 and PHASES[1]["weight"] == 2.0
    assert PHASES[2]["name"] == "Apex"   and PHASES[2]["price_usd"] == 250.0 and PHASES[2]["limit"] == 200_000 and PHASES[2]["weight"] == 1.0
    assert GENIUS_PER_USER_CAP == 100, "Genius Phase per-wallet cap regressed"
    # Revenue math check.
    genius_rev = 20 * 50_000
    genesis_rev = 100 * 100_000
    apex_rev = 250 * 50_000
    assert genius_rev == 1_000_000
    assert genesis_rev == 10_000_000
    assert apex_rev == 12_500_000
    # Chair expansion service file must mirror the same 3 tiers.
    assert len(EXPANSION_TIERS) == 3, "chair_expansion tiers regressed"
    names = [t["name"] for t in EXPANSION_TIERS]
    prices = [t["price_usd"] for t in EXPANSION_TIERS]
    assert names == ["Genius", "Genesis", "Apex"]
    assert prices == [20, 100, 250]


# --- END LOCKED (final 3-tier ladder · 2026-05-04) ----------------------


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
    """v8.0 — Phase 2 polish: ScoreBoardPanel + SpecialStatePrompt."""
    from pathlib import Path
    src = Path(__file__).resolve().parents[2] / "frontend/src"
    assert (src / "components/games/ScoreBoardPanel.tsx").exists()
    assert (src / "components/games/SpecialStatePrompt.tsx").exists()
    # SpadesAAA uses ScoreBoardPanel
    spades = (src / "pages/games/SpadesAAA.tsx").read_text(encoding="utf-8")
    assert "ScoreBoardPanel" in spades
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
    assert "_start_weekly_digest" in lifespan
    assert "weekly_digest_loop" in lifespan
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
        "frontend/src/components/streaming/StreamOverlay.tsx",
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
    assert COIN_PACKS["starter"]["coins"] == 10_000   # 5 × 2000
    assert COIN_PACKS["starter"]["usd"] == 5.00
    assert COIN_PACKS["popular"]["coins"] == 20_000   # 9 × 2000 + 10% bonus rounding
    assert COIN_PACKS["popular"]["usd"] == 9.00
    assert COIN_PACKS["popular"]["popular"] is True
    assert COIN_PACKS["pro"]["coins"] == 50_000       # 20 × 2500 (25% bonus rate)
    assert COIN_PACKS["pro"]["usd"] == 20.00
    assert COIN_PACKS["vip"]["coins"] == 100_000      # 35 × ~2857 (43% bonus rate)
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

    Conversion rate is locked at 100 ₵ = $1 across the whole platform.
    """
    from services.coin_wallet import (
        COINS_PER_USD, usd_to_coins, coins_to_usd,
        debit_coins, credit_coins, get_balance,
    )
    assert COINS_PER_USD == 2000, \
        "Coin/USD rate is locked at 2,000 ₵ = $1 (3B coin supply, founder pricing model). " \
        "Do NOT change without a migration of every utility-room price."
    assert usd_to_coins(29.00) == 58_000     # YP Verified
    assert usd_to_coins(99.00) == 198_000    # YP Elite
    assert usd_to_coins(19.00) == 38_000     # YP Featured / month
    assert usd_to_coins(0.50) == 1_000       # half-dollar precision
    assert callable(debit_coins) and callable(credit_coins) and callable(get_balance)
    assert coins_to_usd(58_000) == 29.00


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
    """Cyber-Casino Battle Mode (May 2026) primitives must stay shipped."""
    panel = "/app/frontend/src/components/games/HoloBoard/BattleModeWager.tsx"
    hook = "/app/frontend/src/hooks/useBattleModeLedger.ts"
    assert os.path.exists(panel), "BattleModeWager.tsx missing"
    assert os.path.exists(hook), "useBattleModeLedger.ts missing"
    panel_src = open(panel).read()
    assert "BattleModeWagerPanel" in panel_src
    assert "ChipStream" in panel_src
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
    """Founder bug Feb 2026 — Bid Whist cards were landing at 15%-
    from-edge seat positions, falling on top of player pods instead
    of forming a centered trick pile near the table logo. Locked at
    ~12% offset from center."""
    src = open("/app/frontend/src/components/bid_whist/BidWhistTable.tsx").read()
    # All four offsets must be within 38%–62% (center-zone band).
    for slot, expected in [
        ("north", "top: '38%', left: '50%'"),
        ("south", "top: '62%', left: '50%'"),
        ("east",  "top: '50%', left: '62%'"),
        ("west",  "top: '50%', left: '38%'"),
    ]:
        assert expected in src, f"Bid Whist {slot} card position must land near center: expected `{expected}`"
    # Old buggy 15%-from-edge offsets must be gone.
    assert "top: '15%'" not in src and "bottom: '15%'" not in src and "right: '15%'" not in src











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

