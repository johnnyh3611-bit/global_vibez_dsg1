"""Vibe Memory Bank — Phase 4 test sweep."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import memory_bank as mb


client = TestClient(app)


# ── Sale settlement ──────────────────────────────────────────────────────

def test_sale_70_30_split() -> None:
    content = mb.MemoryBankContent(
        content_id="c1", creator_id="creator", title="Test Movie",
        price=10.0, duration_minutes=90, genre="drama",
    )
    lic = mb.settle_memory_bank_sale(content, "buyer1")
    assert lic.purchase_price == 10.0
    assert lic.creator_payout == 7.0
    assert lic.platform_share == 3.0
    assert lic.sovereign_tax > 0
    assert lic.status == "ACTIVE"
    assert lic.buyer_id == "buyer1"


def test_sale_inactive_content_rejected() -> None:
    content = mb.MemoryBankContent(
        content_id="c1", creator_id="creator", title="x",
        price=10.0, duration_minutes=90, genre="drama", is_active=False,
    )
    with pytest.raises(ValueError):
        mb.settle_memory_bank_sale(content, "buyer1")


# ── DRM: signed URL issuance + verification ──────────────────────────────

def test_playback_url_round_trip_ok() -> None:
    content = mb.MemoryBankContent(content_id="c1", creator_id="cr",
                                   title="x", price=5.0, duration_minutes=60, genre="drama")
    lic = mb.settle_memory_bank_sale(content, "buyer42")
    url = mb.issue_playback_url(lic, "https://example.com")

    # Parse out the query params
    from urllib.parse import urlparse, parse_qs
    qs = parse_qs(urlparse(url["url"]).query)
    result = mb.verify_playback_request(
        license_id=qs["lid"][0], buyer_id=qs["buyer"][0],
        content_id=qs["cid"][0], expires=qs["exp"][0],
        signature=qs["sig"][0], requesting_user_id="buyer42",
    )
    assert result["ok"] is True


def test_playback_url_wrong_user_rejected() -> None:
    content = mb.MemoryBankContent(content_id="c1", creator_id="cr",
                                   title="x", price=5.0, duration_minutes=60, genre="drama")
    lic = mb.settle_memory_bank_sale(content, "buyer42")
    url = mb.issue_playback_url(lic, "https://example.com")
    from urllib.parse import urlparse, parse_qs
    qs = parse_qs(urlparse(url["url"]).query)
    result = mb.verify_playback_request(
        license_id=qs["lid"][0], buyer_id=qs["buyer"][0],
        content_id=qs["cid"][0], expires=qs["exp"][0],
        signature=qs["sig"][0],
        requesting_user_id="ATTACKER",
    )
    assert result["ok"] is False
    assert result["reason"] == "license_belongs_to_another_user"


def test_playback_tampered_signature_rejected() -> None:
    content = mb.MemoryBankContent(content_id="c1", creator_id="cr",
                                   title="x", price=5.0, duration_minutes=60, genre="drama")
    lic = mb.settle_memory_bank_sale(content, "buyer42")
    url = mb.issue_playback_url(lic, "https://example.com")
    from urllib.parse import urlparse, parse_qs
    qs = parse_qs(urlparse(url["url"]).query)
    result = mb.verify_playback_request(
        license_id=qs["lid"][0], buyer_id=qs["buyer"][0],
        content_id=qs["cid"][0], expires=qs["exp"][0],
        signature="BAD_SIG_NEVER_SIGNED",
        requesting_user_id="buyer42",
    )
    assert result["ok"] is False
    assert result["reason"] == "signature_invalid"


def test_revoked_license_cannot_issue_playback() -> None:
    content = mb.MemoryBankContent(content_id="c1", creator_id="cr",
                                   title="x", price=5.0, duration_minutes=60, genre="drama")
    lic = mb.settle_memory_bank_sale(content, "buyer1")
    revoked = mb.MemoryBankLicense(
        license_id=lic.license_id, content_id=lic.content_id,
        buyer_id=lic.buyer_id, purchased_at=lic.purchased_at,
        purchase_price=lic.purchase_price, creator_payout=lic.creator_payout,
        platform_share=lic.platform_share, sovereign_tax=lic.sovereign_tax,
        status="REVOKED",
    )
    with pytest.raises(ValueError):
        mb.issue_playback_url(revoked, "https://example.com")


# ── Library filtering ────────────────────────────────────────────────────

def test_filter_user_library_excludes_others() -> None:
    content = mb.MemoryBankContent(content_id="c1", creator_id="cr",
                                   title="x", price=5.0, duration_minutes=60, genre="drama")
    a = mb.settle_memory_bank_sale(content, "user_a")
    b = mb.settle_memory_bank_sale(content, "user_b")
    out = mb.filter_user_library([a, b], "user_a")
    assert len(out) == 1
    assert out[0].buyer_id == "user_a"


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_full_purchase_flow() -> None:
    pub = client.post("/api/memory-bank/content/publish", json={
        "creator_id": "creator1", "title": "Test Movie", "price": 10.0,
        "duration_minutes": 90, "genre": "drama", "rating": "PG-13",
    })
    assert pub.status_code == 200
    cid = pub.json()["content_id"]

    # List should include it
    lst = client.get("/api/memory-bank/content?genre=drama")
    assert lst.status_code == 200
    assert any(c["content_id"] == cid for c in lst.json()["content"])

    # Purchase
    p = client.post("/api/memory-bank/purchase", json={
        "content_id": cid, "buyer_id": "buyer1",
    })
    assert p.status_code == 200
    license_id = p.json()["license_id"]
    assert p.json()["creator_payout"] == 7.0

    # Library now contains it
    lib = client.get("/api/memory-bank/library/buyer1")
    assert lib.status_code == 200
    assert lib.json()["owned_count"] >= 1
    assert any(item["license_id"] == license_id for item in lib.json()["library"])

    # Issue playback URL
    play = client.post("/api/memory-bank/playback/url", json={"license_id": license_id})
    assert play.status_code == 200
    assert "url" in play.json()


def test_http_constants() -> None:
    r = client.get("/api/memory-bank/constants")
    assert r.status_code == 200
    body = r.json()
    assert body["creator_share"] == 0.70
    assert body["platform_share"] == 0.30
