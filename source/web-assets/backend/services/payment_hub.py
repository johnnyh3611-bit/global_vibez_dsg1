"""
Stripe Checkout hub — RETIRED for fiat checkout.

Global Vibez DSG card/coin rails are Helio + Solana only. ``StripeCheckout``
methods raise HTTP 410 so every legacy caller fails closed with a clear
redirect message. Webhook verification helpers remain for historical tests
but ``handle_webhook`` also returns 410.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Union

import stripe
from pydantic import BaseModel, Field

from services.stripe_retired import raise_stripe_retired

log = logging.getLogger(__name__)


class CheckoutSessionRequest(BaseModel):
    """Compatible with both simple (amount) and advanced (line_items) callers."""

    amount: Optional[float] = None
    currency: str = "usd"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None
    # Advanced shape used by routes/wallet.py
    line_items: Optional[List[Dict[str, Any]]] = None
    mode: str = "payment"


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str = ""
    # Alias for wallet.py which expects ``response.id``
    id: str = ""


class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str = "unpaid"
    amount_total: Optional[float] = None
    currency: Optional[str] = None
    metadata: Dict[str, str] = Field(default_factory=dict)


class WebhookEventResponse(BaseModel):
    event_type: str
    session_id: Optional[str] = None
    payment_status: Optional[str] = None
    metadata: Dict[str, str] = Field(default_factory=dict)
    event_id: Optional[str] = None
    livemode: bool = False
    # Fraud / AVS / CVV summary (never includes PAN)
    card_checks: Optional[Dict[str, Any]] = None


def _stripe_secret() -> str:
    return (
        os.environ.get("STRIPE_API_KEY")
        or os.environ.get("STRIPE_SECRET_KEY")
        or ""
    ).strip()


def _webhook_secret() -> str:
    return (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()


def sanitize_stripe_object(obj: Any) -> Any:
    """Strip card PAN-adjacent fields before persisting webhook payloads.

    Keeps IDs, amounts, statuses, and check results — drops
    ``number``, ``cvc``, ``exp_*`` if ever present, and nested
    ``payment_method_details.card`` number fields.
    """
    BLOCK_KEYS = {
        "number",
        "cvc",
        "cvc_token",
        "exp_month",
        "exp_year",
        "address_line1_check",  # keep checks at summary level only
    }
    SENSITIVE_NESTED = {"payment_method_details"}

    if isinstance(obj, dict):
        out: Dict[str, Any] = {}
        for k, v in obj.items():
            lk = str(k).lower()
            if lk in BLOCK_KEYS or lk.endswith("_pan") or "card_number" in lk:
                continue
            if lk in SENSITIVE_NESTED and isinstance(v, dict):
                card = v.get("card") if isinstance(v.get("card"), dict) else None
                if card:
                    out[k] = {
                        "type": v.get("type"),
                        "card": {
                            "brand": card.get("brand"),
                            "funding": card.get("funding"),
                            "country": card.get("country"),
                            "checks": card.get("checks"),
                            "three_d_secure": card.get("three_d_secure"),
                            # last4 is PCI-safe display data processors expose
                            "last4": card.get("last4"),
                        },
                    }
                else:
                    out[k] = {"type": v.get("type")}
                continue
            out[k] = sanitize_stripe_object(v)
        return out
    if isinstance(obj, list):
        return [sanitize_stripe_object(x) for x in obj]
    return obj


def extract_card_checks(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Pull AVS / CVC check results from a Stripe event (no PAN)."""
    data_obj = (event.get("data") or {}).get("object") or {}
    # charge.* events
    details = data_obj.get("payment_method_details") or {}
    card = details.get("card") if isinstance(details, dict) else None
    if isinstance(card, dict) and card.get("checks"):
        return {
            "cvc_check": card["checks"].get("cvc_check"),
            "address_line1_check": card["checks"].get("address_line1_check"),
            "address_postal_code_check": card["checks"].get(
                "address_postal_code_check"
            ),
            "brand": card.get("brand"),
            "last4": card.get("last4"),
            "three_d_secure": card.get("three_d_secure"),
        }
    # checkout.session — checks live on the linked PaymentIntent later;
    # expose payment_status only here.
    return None


class StripeCheckout:
    """Retired wrapper — every checkout/status/webhook path raises HTTP 410."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ):
        self.api_key = (api_key or _stripe_secret()).strip()
        self.webhook_url = webhook_url
        # Do not set stripe.api_key — checkout is retired.

    def _require_key(self) -> None:
        raise_stripe_retired()

    def _retired(self) -> None:
        raise_stripe_retired()

    def _build_session_kwargs(self, data: CheckoutSessionRequest) -> Dict[str, Any]:
        currency = (data.currency or "usd").lower()
        meta = {str(k): str(v) for k, v in (data.metadata or {}).items()}

        # Fraud controls: require billing address (AVS) + automatic 3DS.
        # Stripe runs CVC checks on card entry; Radar can still decline.
        common: Dict[str, Any] = {
            "mode": data.mode or "payment",
            "success_url": data.success_url,
            "cancel_url": data.cancel_url,
            "metadata": meta,
            "billing_address_collection": "required",
            "payment_method_types": ["card"],
            "payment_intent_data": {
                "metadata": meta,
                "payment_method_options": {
                    "card": {
                        "request_three_d_secure": "automatic",
                    }
                },
            },
        }

        if data.line_items:
            common["line_items"] = data.line_items
            return common

        if data.amount is None:
            raise ValueError("CheckoutSessionRequest requires amount or line_items")

        amount_cents = int(round(float(data.amount) * 100))
        if amount_cents <= 0:
            raise ValueError("amount must be positive")

        common["line_items"] = [
            {
                "price_data": {
                    "currency": currency,
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": meta.get("product_name")
                        or meta.get("package_id")
                        or "Global Vibez purchase",
                    },
                },
                "quantity": 1,
            }
        ]
        return common

    async def create_checkout_session(
        self, data: CheckoutSessionRequest
    ) -> CheckoutSessionResponse:
        self._retired()

    # Sync aliases used by routes/wallet.py
    def create_session(self, data: CheckoutSessionRequest) -> CheckoutSessionResponse:
        self._retired()

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        self._retired()

    def get_session_status(self, session_id: str) -> CheckoutStatusResponse:
        """Sync alias for wallet.py complete flow — retired."""
        self._retired()

    async def handle_webhook(
        self,
        body: Union[bytes, bytearray],
        signature: Optional[str],
    ) -> WebhookEventResponse:
        """Retired — Stripe webhooks are no longer processed for checkout."""
        self._retired()
