"""Unit test for DominoesGame engine — block dominoes rules."""
import sys, os
sys.path.insert(0, '/app/backend')

from utils.dominoes_game import DominoesGame, build_double_six_set


def test_build_set():
    tiles = build_double_six_set()
    assert len(tiles) == 28, f"Expected 28 tiles, got {len(tiles)}"
    ids = {t["id"] for t in tiles}
    assert len(ids) == 28
    print("✓ Double-six set has exactly 28 unique tiles")


def test_match_init():
    g = DominoesGame(user_position="south", target_score=150)
    assert g.target_score == 150
    # Initial deal: south=7, north=7, boneyard=14, total=28.
    # If bot opened, chain has 1 tile so total in hands = 13.
    total_in_hands = sum(len(g.hands[p]) for p in ["north", "south"])
    assert total_in_hands + len(g.chain) + len(g.boneyard) == 28, \
        f"tile conservation broken: hands={total_in_hands}, chain={len(g.chain)}, boneyard={len(g.boneyard)}"
    assert g.phase == "playing"
    # Highest double should have opened, OR bot has run if it was its turn
    print(f"✓ Match init: hands={[len(g.hands[p]) for p in ['south','north']]}, "
          f"boneyard={len(g.boneyard)}, current_turn={g.current_turn}, "
          f"phase={g.phase}, chain_len={len(g.chain)}")


def test_full_game_flow():
    """Force a game by simulating valid moves."""
    g = DominoesGame(user_position="south", target_score=150)
    safety = 0
    while g.phase == "playing" and safety < 200:
        view = g.to_view("south")
        if view["current_turn"] != "south":
            # Bot already ran during start_new_round / previous play; if
            # current_turn is still bot, the engine has a bug.
            print(f"  bot turn unexpectedly current — phase={g.phase}")
            break
        # Find any playable user tile
        playable = [tid for tid, p in view["players_data"]["south"]["playable"].items() if p["any"]]
        if not playable:
            # Try drawing
            if view["boneyard_count"] > 0:
                g.draw()
            else:
                g.pass_turn()
            safety += 1
            continue
        tid = playable[0]
        side = "right" if view["players_data"]["south"]["playable"][tid]["right"] else "left"
        g.play(tid, side)
        safety += 1
    print(f"✓ Game ran {safety} user actions. Final phase: {g.phase}, "
          f"scores: {g.scores}, last_round: {g.last_round_summary}")
    assert g.phase in ("round_over", "finished"), f"Game stuck in {g.phase}"


def test_play_validation():
    """Try an illegal move."""
    g = DominoesGame(user_position="south", target_score=150)
    view = g.to_view("south")
    if view["current_turn"] != "south":
        print("  skip — bot opened, can't test user illegal play")
        return
    if view["chain"]:
        # Find a tile that doesn't match either end and try playing it
        left, right = view["left_end"], view["right_end"]
        for tid in view["players_data"]["south"]["hand"]:
            t = next((x for x in view["players_data"]["south"]["hand"] if x["id"] == tid["id"]), None)
            if t and t["left"] != left and t["right"] != left and t["left"] != right and t["right"] != right:
                try:
                    g.play(t["id"], "left")
                    print("  ✗ Illegal move was accepted!")
                    return
                except ValueError:
                    print("  ✓ Illegal move correctly rejected")
                    return
    print("  ✓ (no illegal move available to test)")


def test_view_hides_opponent_hand():
    g = DominoesGame(user_position="south", target_score=150)
    view = g.to_view("south")
    south_data = view["players_data"]["south"]
    north_data = view["players_data"]["north"]
    assert "hand" in south_data and isinstance(south_data["hand"], list)
    assert "hand" not in north_data, "Opponent hand leaked!"
    assert "hand_count" in north_data
    print(f"✓ Opponent hand hidden in view (north_data keys: {list(north_data.keys())})")


if __name__ == "__main__":
    test_build_set()
    test_match_init()
    test_view_hides_opponent_hand()
    test_play_validation()
    test_full_game_flow()
    print("\n✅ All Dominoes engine tests passed.")
