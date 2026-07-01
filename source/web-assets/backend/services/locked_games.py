"""
LOCKED_GAMES_REGISTRY — formal, machine-readable lock for every shipped game.

This is the "lock seal" for the game roster. Once a game is shipped and
locked, only intentional updates (route, engine path, test count) are allowed.
The regression shield asserts that the live state of the codebase still
matches every entry in this registry.

To unlock a game for a redesign:
  1. Open this file
  2. Set its `status` from "LOCKED" to "REDESIGN"
  3. Add the game's id back to /app/frontend/src/data/comingSoonGames.ts
     (so the lobby/practice surfaces show "Coming Soon" until ship)
  4. Once redesign ships, flip status back to "LOCKED" and update
     `last_modified` + `min_tests`

Status enum:
  LOCKED    — green · stable · don't touch without flipping to REDESIGN first
  REDESIGN  — yellow · room is being actively rebuilt — expect breakage
  BLOCKED   — red · room is broken in production · top-priority repair

Each entry:
  id            : matches the lobby tile id in GamesNew.tsx
  name          : human-readable title (matches what the user sees)
  category      : "dice" | "card" | "casino" | "wheel" | "lottery" |
                  "video_poker" | "board" | "arcade" | "skill" | "party"
  route         : the React Router path the player lands on
  engine_module : the python module that holds the deterministic game logic
                  (or None if frontend-only, e.g. PracticeReversi)
  test_module   : pytest module path that proves it still works
                  (or None if covered by regression_shield only)
  min_tests     : minimum number of passing tests this engine MUST keep.
                  If actual pass-count drops below this number, the lock
                  is considered BROKEN.
  last_modified : ISO date the room was last shipped/redesigned
  status        : LOCKED | REDESIGN | BLOCKED
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Literal, Optional

LockStatus = Literal["LOCKED", "REDESIGN", "BLOCKED"]


@dataclass(frozen=True)
class GameLock:
    id: str
    name: str
    category: str
    route: str
    engine_module: Optional[str]
    test_module: Optional[str]
    min_tests: int
    last_modified: str
    status: LockStatus


# ───────────────────────────────────────────────────────────────────────
#                         THE LOCKED-GAMES REGISTRY
# ───────────────────────────────────────────────────────────────────────
# Every shipped game on Global Vibez DSG.  Sorted alphabetically within
# each category so diffs stay small and reviewable.
# ───────────────────────────────────────────────────────────────────────
LOCKED_GAMES: List[GameLock] = [
    # ── DICE ──────────────────────────────────────────────────────────
    GameLock(
        id="vibe_dice_654", name="Vibez 654", category="dice", route="/dice",
        engine_module="routes.vibez_654_prescription",
        test_module="tests.test_vibez_654_5dice",
        min_tests=1, last_modified="2026-02-14", status="LOCKED",
    ),
    GameLock(
        id="yahtzee", name="Yahtzee", category="dice", route="/yahtzee",
        engine_module="services.yahtzee",
        test_module="tests.test_yahtzee",
        min_tests=43, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="sic_bo", name="Sic Bo", category="dice", route="/sic-bo",
        engine_module="services.coming_soon_engines",
        test_module="tests.test_iter_jan_2026_19_games_http",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="craps", name="Craps Props", category="dice", route="/craps",
        engine_module="services.coming_soon_engines",
        test_module="tests.test_iter_jan_2026_19_games_http",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="hazard", name="Hazard", category="dice", route="/hazard",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="chuck_a_luck", name="Chuck-A-Luck", category="dice", route="/chuck-a-luck",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),

    # ── CARD (AAA / Premium card-game rooms) ──────────────────────────
    GameLock(
        id="spades", name="Spades AAA", category="card", route="/spades",
        engine_module="services.spades_referee",
        test_module="tests.test_all_aaa_games_dualbot_smoke",
        min_tests=1, last_modified="2026-02-10", status="LOCKED",
    ),
    GameLock(
        id="bid_whist", name="Vibez Whist Premium", category="card", route="/bid-whist",
        engine_module="services.bid_whist_grand_master",
        test_module=None,
        min_tests=0, last_modified="2026-02-08", status="LOCKED",
    ),
    GameLock(
        id="hearts", name="Hearts", category="card", route="/hearts",
        engine_module="utils.hearts_game",
        test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="thirty_one", name="Thirty-One", category="card", route="/thirty-one",
        engine_module="services.thirty_one",
        test_module="tests.test_thirty_one",
        min_tests=18, last_modified="2026-02-10", status="LOCKED",
    ),
    GameLock(
        id="crazy_eights", name="Crazy Eights", category="card", route="/crazy-eights",
        engine_module=None, test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="go_fish", name="Go Fish", category="card", route="/go-fish",
        engine_module=None, test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="gin_rummy", name="Gin Rummy", category="card", route="/gin-rummy",
        engine_module="utils.gin_rummy_game",
        test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="rummy", name="Rummy", category="card", route="/rummy",
        engine_module="utils.rummy_game",
        test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="war", name="War", category="card", route="/war",
        engine_module=None, test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="uno", name="UNO", category="card", route="/uno",
        engine_module=None, test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="euchre", name="Euchre", category="card", route="/euchre",
        engine_module="utils.euchre_game",
        test_module="tests.regression_shield",
        min_tests=1, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="pinochle", name="Pinochle", category="card", route="/pinochle",
        engine_module="utils.pinochle_game",
        test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),

    # ── CASINO (player-vs-dealer) ─────────────────────────────────────
    GameLock(
        id="blackjack_universal", name="Blackjack Universal", category="casino",
        route="/blackjack-universal",
        engine_module="services.blackjack_multiplayer",
        test_module=None, min_tests=0, last_modified="2026-02-08",
        status="LOCKED",
    ),
    GameLock(
        id="poker_universal", name="Texas Hold'em", category="casino",
        route="/poker-practice",
        engine_module="services.poker_multiplayer",
        test_module=None, min_tests=0, last_modified="2026-02-08",
        status="LOCKED",
    ),
    GameLock(
        id="baccarat_premium", name="Baccarat 3D Premium", category="casino",
        route="/baccarat",
        engine_module=None, test_module=None,
        min_tests=0, last_modified="2026-02-04", status="LOCKED",
    ),
    GameLock(
        id="caribbean_stud", name="Caribbean Stud", category="casino",
        route="/caribbean-stud",
        engine_module="services.caribbean_stud",
        test_module="tests.test_bingo_and_caribbean_stud",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="three_card_poker", name="Three Card Poker", category="casino",
        route="/three-card-poker",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="pai_gow", name="Pai Gow", category="casino", route="/pai-gow",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="casino_war", name="Casino War", category="casino", route="/casino-war",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="chemin_de_fer", name="Chemin de Fer", category="casino",
        route="/chemin-de-fer",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="european_roulette", name="European Roulette", category="casino",
        route="/european-roulette",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="jacks_or_better", name="Jacks or Better", category="video_poker",
        route="/jacks-or-better",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="fan_tan", name="Fan-Tan", category="casino", route="/fan-tan",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="faro", name="Faro", category="casino", route="/faro",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),

    # ── WHEEL ─────────────────────────────────────────────────────────
    GameLock(
        id="vibes_wheel", name="Vibes Wheel", category="wheel", route="/vibes-wheel",
        engine_module="services.coming_soon_engines",
        test_module="tests.test_iter_jan_2026_19_games_http",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="big_six_wheel", name="Big Six Wheel", category="wheel",
        route="/big-six-wheel",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),

    # ── LOTTERY / SLOTS ───────────────────────────────────────────────
    GameLock(
        id="vibes_slots", name="Vibes Slots", category="lottery", route="/vibes-slots",
        engine_module="services.vibes_slots",
        test_module="tests.test_vibes_slots",
        min_tests=10, last_modified="2026-02-12", status="LOCKED",
    ),
    GameLock(
        id="keno", name="Keno", category="lottery", route="/keno",
        engine_module="services.coming_soon_engines",
        test_module="tests.test_iter_jan_2026_19_games_http",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),
    GameLock(
        id="bingo", name="Bingo", category="lottery", route="/bingo",
        engine_module="services.bingo",
        test_module="tests.test_bingo_and_caribbean_stud",
        min_tests=1, last_modified="2026-02-15", status="LOCKED",
    ),

    # ── SKILL ─────────────────────────────────────────────────────────
    GameLock(
        id="vibes_darts", name="Vibes Darts", category="skill", route="/vibes-darts",
        engine_module="services.casino_wave2_engines",
        test_module="tests.test_casino_wave2_engines",
        min_tests=2, last_modified="2026-02-15", status="LOCKED",
    ),
]


def lock_dict() -> List[dict]:
    """Return the registry as a list of dicts for the admin endpoint."""
    return [asdict(g) for g in LOCKED_GAMES]


def find(game_id: str) -> Optional[GameLock]:
    """Lookup a single lock by game id."""
    for g in LOCKED_GAMES:
        if g.id == game_id:
            return g
    return None


__all__ = ["GameLock", "LOCKED_GAMES", "lock_dict", "find", "LockStatus"]
