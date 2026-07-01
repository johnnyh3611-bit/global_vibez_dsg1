"""SmartStack matcher engine tests."""
import sys
sys.path.insert(0, "/home/johnnie/master-project")

from routes.smartstack import _score_match, haversine, MAX_DETOUR_MI, MIN_PROFIT_BOOST


# Reference points
TIMES_SQUARE = {"lat": 40.7580, "lng": -73.9855}
GRAND_CENTRAL = {"lat": 40.7527, "lng": -73.9772}   # ~0.6 mi from Times Sq
PENN_STATION = {"lat": 40.7506, "lng": -73.9939}    # ~0.7 mi from Times Sq
BROOKLYN_BRIDGE = {"lat": 40.7061, "lng": -73.9969} # ~3.6 mi from Times Sq


def test_haversine_known_distance():
    """Times Square ↔ Grand Central is roughly 0.6 mi."""
    d = haversine(TIMES_SQUARE, GRAND_CENTRAL)
    assert 0.4 < d < 0.9, f"expected ~0.6mi got {d}"


def test_match_qualifies_when_detour_low_and_profit_high():
    """Driver going Times Sq → Brooklyn Bridge picks up food at Penn Stn
    and drops it near Grand Central — small detour, big profit boost."""
    order = {
        "order_id": "test1",
        "merchant_id": "m1",
        "pickup_at": PENN_STATION,
        "deliver_to": GRAND_CENTRAL,
        "food_payout_usd": 14.00,
    }
    match = _score_match(TIMES_SQUARE, BROOKLYN_BRIDGE, order, ride_payout=8.00)
    assert match is not None, "qualifying match should be returned"
    assert match["profit_boost"] >= MIN_PROFIT_BOOST
    assert match["added_distance_mi"] <= MAX_DETOUR_MI
    assert match["added_minutes"] >= 1
    print(f"✓ Qualified match: detour={match['added_distance_mi']}mi profit_boost={match['profit_boost']}x")


def test_match_rejected_when_detour_too_high():
    """Driver Times Sq → Penn (short trip), order requires huge detour."""
    far_pickup = {"lat": 40.7800, "lng": -73.9500}      # 1.5+ mi away
    far_deliver = {"lat": 40.8200, "lng": -73.9000}     # even further
    order = {
        "order_id": "test2", "merchant_id": "m1",
        "pickup_at": far_pickup, "deliver_to": far_deliver,
        "food_payout_usd": 50.00,
    }
    match = _score_match(TIMES_SQUARE, PENN_STATION, order, ride_payout=8.00)
    assert match is None, "should reject due to large detour"
    print("✓ Rejected over-detour match")


def test_match_rejected_when_profit_boost_too_small():
    """Tiny food payout doesn't double the ride profit even if detour fits."""
    order = {
        "order_id": "test3", "merchant_id": "m1",
        "pickup_at": PENN_STATION, "deliver_to": GRAND_CENTRAL,
        "food_payout_usd": 2.00,  # 8 + 2 = 10 → 1.25x → below 2.0
    }
    match = _score_match(TIMES_SQUARE, BROOKLYN_BRIDGE, order, ride_payout=8.00)
    assert match is None, "should reject due to low profit boost"
    print("✓ Rejected low-profit-boost match")


def test_zero_ride_payout_safe():
    order = {
        "order_id": "test4", "merchant_id": "m1",
        "pickup_at": PENN_STATION, "deliver_to": GRAND_CENTRAL,
        "food_payout_usd": 14.00,
    }
    match = _score_match(TIMES_SQUARE, BROOKLYN_BRIDGE, order, ride_payout=0)
    assert match is None, "zero ride payout should not divide-by-zero crash"
    print("✓ Zero ride payout handled gracefully")


if __name__ == "__main__":
    test_haversine_known_distance()
    test_match_qualifies_when_detour_low_and_profit_high()
    test_match_rejected_when_detour_too_high()
    test_match_rejected_when_profit_boost_too_small()
    test_zero_ride_payout_safe()
    print("\n✅ All SmartStack matcher tests passed.")
