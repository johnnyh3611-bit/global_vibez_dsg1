"""Final Stripe checkout cleanup — every legacy rail returns HTTP 410."""
from __future__ import annotations

import inspect
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]


def test_stripe_retired_helper_shape():
    from services.stripe_retired import raise_stripe_retired, stripe_retired_detail

    detail = stripe_retired_detail()
    assert detail["error"] == "stripe_retired"
    assert "helio" in detail["message"].lower()
    assert "solana" in detail["message"].lower()
    assert detail["use"] == "/api/coins/topup/helio"

    with pytest.raises(HTTPException) as exc:
        raise_stripe_retired()
    assert exc.value.status_code == 410
    assert exc.value.detail["error"] == "stripe_retired"


def test_payment_hub_stripe_checkout_retired():
    from services.payment_hub import CheckoutSessionRequest, StripeCheckout

    sc = StripeCheckout(api_key="sk_test_x")
    with pytest.raises(HTTPException) as exc:
        sc.create_session(
            CheckoutSessionRequest(
                amount=5.0,
                currency="usd",
                success_url="https://example.com/ok",
                cancel_url="https://example.com/cancel",
            )
        )
    assert exc.value.status_code == 410


@pytest.mark.asyncio
async def test_payment_hub_async_checkout_retired():
    from services.payment_hub import CheckoutSessionRequest, StripeCheckout

    sc = StripeCheckout(api_key="sk_test_x")
    with pytest.raises(HTTPException) as exc:
        await sc.create_checkout_session(
            CheckoutSessionRequest(
                amount=5.0,
                currency="usd",
                success_url="https://example.com/ok",
                cancel_url="https://example.com/cancel",
            )
        )
    assert exc.value.status_code == 410


def _source_raises_stripe_retired(fn) -> bool:
    src = inspect.getsource(fn)
    return "raise_stripe_retired" in src or (
        "410" in src and "stripe_retired" in src
    )


def test_auxiliary_checkout_endpoints_raise_410():
    from routes import (
        battle_pass,
        elite_subscription,
        entry_fee,
        founders_pass,
        just_for_the_night,
        merchant_onboarding,
        sovereign_tiers,
        subscriptions,
        vibe_ridez,
        vibe_venues,
        vibe_wallet,
        wallet,
        yellow_pages,
    )

    endpoints = [
        wallet.purchase_credits,
        wallet.complete_credit_purchase,
        vibe_wallet.create_topup_session,
        vibe_wallet.check_topup_status,
        vibe_wallet.stripe_webhook_handler,
        subscriptions.purchase_credits,
        subscriptions.subscribe,
        elite_subscription.subscribe_to_elite,
        elite_subscription.verify_elite_subscription,
        battle_pass.purchase_battle_pass,
        battle_pass.verify_battle_pass_purchase,
        entry_fee.purchase_entry_fee,
        entry_fee.verify_entry_fee_payment,
        founders_pass.create_checkout,
        founders_pass.checkout_status,
        merchant_onboarding._create_session,
        merchant_onboarding._verify_session,
        vibe_venues.artisan_checkout,
        vibe_venues.restaurant_partnership_checkout,
        vibe_venues.payment_status,
        vibe_venues.vibe_venues_stripe_webhook,
        vibe_ridez.create_payment_checkout,
        vibe_ridez.check_payment_status,
        just_for_the_night.start_season_pass_checkout,
        just_for_the_night.verify_season_pass,
        sovereign_tiers.subscribe,
        sovereign_tiers.subscribe_status,
        yellow_pages.check_payment_status,
        yellow_pages.stripe_webhook,
    ]
    for fn in endpoints:
        assert _source_raises_stripe_retired(fn), f"{fn.__module__}.{fn.__name__}"


def test_no_stripe_session_create_in_routes():
    routes_dir = ROOT / "routes"
    offenders = []
    for path in routes_dir.glob("*.py"):
        src = path.read_text(encoding="utf-8")
        if "stripe.checkout.Session.create" in src or "checkout.Session.create" in src:
            offenders.append(path.name)
    assert offenders == [], f"live Stripe Session.create still in: {offenders}"


def test_yellow_pages_card_branch_retired():
    src = (ROOT / "routes" / "yellow_pages.py").read_text(encoding="utf-8")
    assert "Card payment branch" in src
    assert "raise_stripe_retired" in src
