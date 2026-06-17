"""
Lock-in tests for the Pricing Master Vault v1.0 spec
─────────────────────────────────────────────────────
These tests must NEVER be skipped. They guard against silent drift
on the founder-locked Vibe Pack pricing, the 4:1 DSG bridge, the
tier-gating rules, and the 13.5% Sovereign Tax.

If a future change breaks any of these, the contract with the
founder spec has been violated — fix the code, not the test.
"""
import pytest

from services.pricing_master_vault import (
    PACKS,
    USD_TO_CREDITS_RATE,
    DSG_BRIDGE_RATIO,
    SOVEREIGN_TAX_RATE,
    TOTAL_DSG_SUPPLY,
    EXPLORER_DSG_CAP,
    CHAIR_HOLDER_DSG_CEILING,
    TIER_EXPLORER,
    TIER_AMBASSADOR,
    TIER_CHAIR_HOLDER,
    list_packs,
    get_pack,
    usd_to_credits,
    credits_to_dsg,
    derive_user_tier,
    is_pack_purchasable,
    apply_sovereign_tax,
)


# ── Constants ────────────────────────────────────────────────────────────────
def test_universal_constants_locked():
    assert USD_TO_CREDITS_RATE == 2_500
    assert DSG_BRIDGE_RATIO == 4
    assert SOVEREIGN_TAX_RATE == 0.135
    assert TOTAL_DSG_SUPPLY == 3_000_000_000
    assert EXPLORER_DSG_CAP == 100_000
    assert CHAIR_HOLDER_DSG_CEILING == 5_000_000


# ── Pack catalog (verbatim founder spec) ────────────────────────────────────
EXPECTED_PACKS = [
    ("ignition",     1.00,   2_500,    625,   "Entry Access"),
    ("frequency",    5.00,  12_500,  3_125,   "+1 Profile Boost"),
    ("momentum",    10.00,  25_000,  6_250,   "24hr Mining Pulse"),
    ("architect",   20.00,  50_000, 12_500,   "Referral Node Open"),
    ("dynasty",     50.00, 125_000, 31_250,   "Elite Room Access"),
    ("legacy_vault",100.00, 300_000, 75_000,   "Permanent Elite Status"),
]


@pytest.mark.parametrize("pack_id,usd,credits,dsg,perk_substr", EXPECTED_PACKS)
def test_pack_spec_locked(pack_id, usd, credits, dsg, perk_substr):
    pack = get_pack(pack_id)
    assert pack is not None, f"Pack {pack_id} missing from catalog"
    assert pack["usd_amount"] == usd
    assert pack["credits"] == credits
    assert pack["dsg_bridge"] == dsg
    assert perk_substr in pack["perk"]


def test_legacy_vault_bonus_split():
    pack = get_pack("legacy_vault")
    assert pack["base_credits"] == 250_000
    assert pack["bonus_credits"] == 50_000
    assert pack["base_credits"] + pack["bonus_credits"] == pack["credits"] == 300_000


def test_list_packs_returns_six_in_price_order():
    packs = list_packs()
    assert len(packs) == 6
    prices = [p["usd_amount"] for p in packs]
    assert prices == sorted(prices)


# ── Conversion math ─────────────────────────────────────────────────────────
@pytest.mark.parametrize("usd,expected", [
    (1, 2_500), (5, 12_500), (10, 25_000), (20, 50_000),
    (50, 125_000), (100, 250_000),  # base credits — Legacy bonus is added separately
])
def test_usd_to_credits(usd, expected):
    assert usd_to_credits(usd) == expected


@pytest.mark.parametrize("credits,expected_dsg", [
    (2_500, 625), (12_500, 3_125), (25_000, 6_250),
    (50_000, 12_500), (125_000, 31_250), (300_000, 75_000),
])
def test_credits_to_dsg(credits, expected_dsg):
    assert credits_to_dsg(credits) == expected_dsg


def test_credits_to_dsg_floors_fractional():
    # 7 ₵ → 1 $DSG (floor of 7/4 = 1.75)
    assert credits_to_dsg(7) == 1


def test_credits_to_dsg_rejects_negative():
    with pytest.raises(ValueError):
        credits_to_dsg(-1)


# ── Tier derivation ─────────────────────────────────────────────────────────
def test_chair_holder_takes_precedence():
    assert derive_user_tier({"holder_chair_count": 1}) == TIER_CHAIR_HOLDER
    assert derive_user_tier({"holder_chair_count": 5, "is_ambassador": False}) == TIER_CHAIR_HOLDER


def test_ambassador_via_flag():
    assert derive_user_tier({"is_ambassador": True}) == TIER_AMBASSADOR


def test_ambassador_via_purchase_history():
    assert derive_user_tier({"lifetime_pack_purchases": ["architect"]}) == TIER_AMBASSADOR
    assert derive_user_tier({"lifetime_pack_purchases": ["momentum"]}) == TIER_AMBASSADOR
    assert derive_user_tier({"lifetime_pack_purchases": ["dynasty"]}) == TIER_AMBASSADOR


def test_explorer_default():
    assert derive_user_tier({}) == TIER_EXPLORER
    assert derive_user_tier({"lifetime_pack_purchases": ["ignition", "frequency"]}) == TIER_EXPLORER


# ── Tier gating ─────────────────────────────────────────────────────────────
def test_explorer_can_buy_ignition_and_frequency():
    ok, _ = is_pack_purchasable("ignition", TIER_EXPLORER)
    assert ok
    ok, _ = is_pack_purchasable("frequency", TIER_EXPLORER)
    assert ok


def test_explorer_blocked_from_higher_packs():
    for pack_id in ("momentum", "architect", "dynasty", "legacy_vault"):
        ok, reason = is_pack_purchasable(pack_id, TIER_EXPLORER)
        assert not ok
        assert "tier" in reason.lower()


def test_explorer_blocked_at_100k_dsg_cap():
    ok, reason = is_pack_purchasable("frequency", TIER_EXPLORER, lifetime_dsg_acquired=99_000)
    assert not ok
    assert "100,000" in reason


def test_explorer_under_cap_allowed():
    ok, _ = is_pack_purchasable("frequency", TIER_EXPLORER, lifetime_dsg_acquired=10_000)
    assert ok


def test_ambassador_blocked_from_legacy_vault():
    ok, reason = is_pack_purchasable("legacy_vault", TIER_AMBASSADOR)
    assert not ok
    assert "tier" in reason.lower()


def test_ambassador_can_buy_dynasty_and_below():
    for pack_id in ("ignition", "frequency", "momentum", "architect", "dynasty"):
        ok, _ = is_pack_purchasable(pack_id, TIER_AMBASSADOR)
        assert ok, f"Ambassador should be able to buy {pack_id}"


def test_chair_holder_can_buy_all():
    for pack_id in ("ignition", "frequency", "momentum", "architect", "dynasty", "legacy_vault"):
        ok, _ = is_pack_purchasable(pack_id, TIER_CHAIR_HOLDER)
        assert ok


def test_chair_holder_blocked_at_5m_ceiling():
    ok, reason = is_pack_purchasable(
        "legacy_vault", TIER_CHAIR_HOLDER,
        lifetime_dsg_acquired=4_950_000,  # +75k → would breach 5M
    )
    assert not ok
    assert "5,000,000" in reason


def test_unknown_pack_rejected():
    ok, _ = is_pack_purchasable("nonexistent", TIER_CHAIR_HOLDER)
    assert not ok


# ── Sovereign Tax ───────────────────────────────────────────────────────────
def test_sovereign_tax_at_100():
    res = apply_sovereign_tax(100.0)
    assert res["tax"] == 13.5
    assert res["net"] == 86.5
    assert res["tax_rate"] == 0.135


def test_sovereign_tax_zero_safe():
    res = apply_sovereign_tax(0)
    assert res["tax"] == 0
    assert res["net"] == 0


def test_sovereign_tax_rejects_negative():
    with pytest.raises(ValueError):
        apply_sovereign_tax(-10)
