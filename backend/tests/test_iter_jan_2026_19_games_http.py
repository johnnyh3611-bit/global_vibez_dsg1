"""HTTP smoke for all 19 wave-I + wave-II game endpoints via public URL.

Uses correct field names per /app/backend/routes/{founder_engines_routes,casino_wave2_routes}.py.
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
HEADERS = {"Content-Type": "application/json"}

# (slug, sub_path, payload)
PLAY_CASES = [
    # Wave I
    ("caribbean-stud", "deal", {"ante": 10, "seed": 1}),
    ("sic-bo", "play", {"bet_type": "any_triple", "dice": [3, 3, 3], "stake": 10}),
    ("craps", "prop", {"prop": "snake_eyes", "dice_roll": [1, 1], "stake": 10}),
    ("vibes-wheel", "spin", {"stake": 10, "seed": 1}),
    ("keno", "play", {"picks": [1, 2, 3, 4, 5], "stake": 10, "seed": 1}),
    ("vibes-slots", "spin", {"stake": 10, "user_count": 100, "seed": 1}),
    # Wave II
    ("three-card-poker", "play", {"ante": 10, "raise_play": True, "pair_plus": 5, "seed": 1}),
    ("pai-gow", "play", {"stake": 10, "seed": 1}),
    ("casino-war", "play", {"stake": 10, "go_to_war": True, "seed": 1}),
    ("chemin-de-fer", "play", {"bet_side": "player", "stake": 10, "seed": 1}),
    ("european-roulette", "play", {"bet_type": "straight", "bet_value": 17, "stake": 10, "seed": 1}),
    ("hazard", "play", {"main": 7, "stake": 10, "seed": 1}),
    ("chuck-a-luck", "play", {"picked_number": 3, "stake": 10, "seed": 1}),
    ("big-six-wheel", "play", {"bet_label": "1", "stake": 10, "seed": 1}),
    ("fan-tan", "play", {"pick": 1, "stake": 10, "seed": 1}),
    ("faro", "play", {"picked_rank": "7", "stake": 10, "seed": 1}),
    ("vibes-darts", "throw", {"distance_from_bullseye": 0.05, "stake": 10}),
]

CONSTANTS_SLUGS = [
    "bingo", "caribbean-stud", "sic-bo", "craps", "vibes-wheel", "keno", "vibes-slots",
    "three-card-poker", "pai-gow", "casino-war", "chemin-de-fer", "european-roulette",
    "hazard", "chuck-a-luck", "big-six-wheel", "jacks-or-better", "fan-tan", "faro", "vibes-darts",
]


@pytest.mark.parametrize("slug", CONSTANTS_SLUGS)
def test_constants_endpoint(slug):
    r = requests.get(f"{BASE}/api/games/{slug}/constants", timeout=15)
    assert r.status_code == 200, f"{slug}/constants -> {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert isinstance(body, dict) and len(body) > 0, f"{slug}/constants empty"


@pytest.mark.parametrize("slug,sub,payload", PLAY_CASES)
def test_play_endpoint(slug, sub, payload):
    r = requests.post(f"{BASE}/api/games/{slug}/{sub}", json=payload, headers=HEADERS, timeout=15)
    assert r.status_code == 200, f"{slug}/{sub} -> {r.status_code}: {r.text[:300]}"
    assert isinstance(r.json(), dict)


def test_bingo_card_generate():
    r = requests.post(f"{BASE}/api/games/bingo/card/generate", json={"seed": 1}, timeout=15)
    assert r.status_code == 200, r.text[:300]


def test_bingo_draw():
    r = requests.post(f"{BASE}/api/games/bingo/draw", json={"seed": 1, "drawn": []}, timeout=15)
    assert r.status_code == 200, r.text[:300]


def test_jacks_or_better_deal_and_draw():
    d = requests.post(f"{BASE}/api/games/jacks-or-better/deal", json={"seed": 1}, timeout=15)
    assert d.status_code == 200, f"deal: {d.text[:300]}"
    initial = d.json().get("hand", [])
    assert len(initial) == 5, f"expected 5 cards, got {initial}"
    payload = {"initial": initial, "hold_indices": [0, 1, 2, 3, 4], "stake": 10, "seed": 1}
    r2 = requests.post(f"{BASE}/api/games/jacks-or-better/draw", json=payload, timeout=15)
    assert r2.status_code == 200, f"draw: {r2.text[:300]}"
