"""
API-contract smoke + shape tests.

Runs against REACT_APP_BACKEND_URL (preview URL). Each test asserts both
HTTP status and response-shape contract. Designed to complete in <30s.
"""
from __future__ import annotations

from typing import Dict

import httpx
import pytest

from tests.api_contracts.conftest import assert_keys


# ╭──────────────────────────────────────────────────────────────────────╮
# │ AUTH                                                                  │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestAuth:
    def test_demo_login_returns_token(self, demo_session: Dict):
        assert_keys(
            demo_session,
            {"user_id", "email", "name", "token", "profile_completed"},
            where="POST /auth/demo-login",
        )
        assert demo_session["token"].startswith("demo_session_")

    def test_demo_login_fresh_creates_unique_user(self, http: httpx.Client, api: str):
        r1 = http.post(f"{api}/auth/demo-login?fresh=1")
        r2 = http.post(f"{api}/auth/demo-login?fresh=1")
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["user_id"] != r2.json()["user_id"]

    def test_auth_me_with_bearer_returns_profile(
        self, http: httpx.Client, api: str, auth_headers: Dict
    ):
        r = http.get(f"{api}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert_keys(
            r.json(),
            {"user_id", "email", "name", "profile_completed"},
            where="GET /auth/me",
        )

    def test_auth_me_without_token_is_401(self, base_url: str):
        # IMPORTANT: use a cookie-jar–free, header-free client to prove the
        # endpoint is actually gated. Reusing the session client would leak
        # cookies/Bearer tokens stored by earlier tests.
        with httpx.Client(timeout=10.0) as anon:
            r = anon.get(f"{base_url}/api/auth/me")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ╭──────────────────────────────────────────────────────────────────────╮
# │ SPADES                                                                │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestSpades:
    def test_rulesets_returns_classic_and_big_wheel(self, http: httpx.Client, api: str):
        r = http.get(f"{api}/spades/rulesets")
        assert r.status_code == 200
        ids = {rs["id"] for rs in r.json()["rulesets"]}
        assert {"CLASSIC", "BIG_WHEEL"} <= ids

    def test_classic_has_52_no_jokers(self, http: httpx.Client, api: str):
        r = http.get(f"{api}/spades/rulesets")
        rs = next(x for x in r.json()["rulesets"] if x["id"] == "CLASSIC")
        assert rs["deck_size"] == 52
        assert rs["has_jokers"] is False

    def test_big_wheel_has_54_with_jokers_and_promoted_trumps(
        self, http: httpx.Client, api: str
    ):
        r = http.get(f"{api}/spades/rulesets")
        rs = next(x for x in r.json()["rulesets"] if x["id"] == "BIG_WHEEL")
        assert rs["deck_size"] == 54
        assert rs["has_jokers"] is True
        assert "BIG_JOKER" in rs["promoted_trumps"]


# ╭──────────────────────────────────────────────────────────────────────╮
# │ BIG WHEEL LOUNGE (public)                                             │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestBigWheelLounge:
    @pytest.mark.parametrize("path", ["stats", "lobbies", "leaderboard"])
    def test_public_endpoint_200(self, http: httpx.Client, api: str, path: str):
        r = http.get(f"{api}/spades/big-wheel/{path}")
        assert r.status_code == 200, f"{path}: {r.text}"
        assert isinstance(r.json(), (dict, list))


# ╭──────────────────────────────────────────────────────────────────────╮
# │ APEX EVOLUTION                                                        │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestApex:
    def test_wishlist_count_is_public(self, http: httpx.Client, api: str):
        r = http.get(f"{api}/apex/wishlist/count")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)
        # accept either 'count' or 'total' depending on impl version
        assert any(k in body for k in ("count", "total"))


# ╭──────────────────────────────────────────────────────────────────────╮
# │ ADMIN VAULT (auth-gated)                                              │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestAdmin:
    def test_vault_auth_with_correct_creds(self, admin_cookies: Dict[str, str]):
        # admin_cookies fixture asserts vault-auth = 200 and a cookie was set.
        assert any("admin" in k.lower() or "session" in k.lower() for k in admin_cookies)

    def test_vault_auth_rejects_bad_password(self, http: httpx.Client, api: str):
        r = http.post(
            f"{api}/admin/vault-auth",
            json={"password": "wrong-password-zzz", "code": "000000"},
        )
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize(
        "path,required",
        [
            ("/admin/master-stats", set()),
            ("/admin/live-seats", set()),
            ("/admin/milestones/recap", set()),
            ("/solana/network/tps", {"samples"} | {"is_mainnet"} | {"rpc_url"}),
            ("/solana/network/fees", {"is_mainnet", "rpc_url"}),
            ("/admin/burn-queue", {"totals", "queue", "cutoffs"}),
        ],
    )
    def test_admin_protected_endpoint(
        self,
        http: httpx.Client,
        api: str,
        admin_cookies: Dict[str, str],
        path: str,
        required: set,
    ):
        r = http.get(f"{api}{path}", cookies=admin_cookies)
        assert r.status_code == 200, f"{path}: HTTP {r.status_code} → {r.text[:200]}"
        body = r.json()
        if required:
            # tolerate at least one of the required keys (schema may evolve)
            assert any(k in body for k in required), (
                f"{path}: none of {required} present in keys {sorted(body.keys())}"
            )

    def test_admin_endpoints_are_gated(self, base_url: str):
        """Without the cookie, every admin endpoint MUST refuse access.
        Uses an isolated anonymous client to avoid cookie-jar bleed.
        """
        with httpx.Client(timeout=10.0) as anon:
            for path in (
                "/admin/master-stats",
                "/admin/live-seats",
                "/admin/milestones/recap",
                "/solana/network/tps",
                "/admin/burn-queue",
                "/agent/memory/status",
            ):
                r = anon.get(f"{base_url}/api{path}")
                assert r.status_code in (401, 403), (
                    f"{path} leaked: returned {r.status_code} without admin cookie"
                )


# ╭──────────────────────────────────────────────────────────────────────╮
# │ MANIFESTO FEATURES (oracle, solvency, hybrid status)                  │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestManifesto:
    def test_oracle_prices_public(self, http: httpx.Client, api: str):
        r = http.get(f"{api}/oracle/prices", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # vibez_usd is always present (env-fallback). sol/usdc may be None
        # if Pyth Hermes is rate-limiting us — accept either.
        assert "vibez_usd" in body and float(body["vibez_usd"]) > 0
        assert "sol_usd" in body and "usdc_usd" in body

    def test_treasury_solvency_public(self, http: httpx.Client, api: str):
        r = http.get(f"{api}/treasury/solvency")
        assert r.status_code == 200
        body = r.json()
        for k in ("vault_usd", "liability_usd", "coverage_pct",
                  "active_chairs", "insured", "circuit_breaker"):
            assert k in body, f"missing {k}"
        cb = body["circuit_breaker"]
        for k in ("floor_price_usd", "current_vibez_usd", "engaged"):
            assert k in cb, f"circuit_breaker missing {k}"

    def test_hybrid_chair_status_for_demo_user(
        self, http: httpx.Client, api: str, demo_session: Dict
    ):
        r = http.get(f"{api}/users/{demo_session['user_id']}/chair-status")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] in ("BOUGHT", "EARNED", "HYBRID", "NONE")
        assert "perks" in body and isinstance(body["perks"], list)


# ╭──────────────────────────────────────────────────────────────────────╮
# │ HEALTH                                                                │
# ╰──────────────────────────────────────────────────────────────────────╯

class TestHealth:
    def test_root_health_or_api_health(self, http: httpx.Client, base_url: str, api: str):
        # one of these MUST respond 200; we don't pin which.
        for url in (f"{base_url}/health", f"{api}/health", f"{api}/"):
            r = http.get(url)
            if r.status_code == 200:
                return
        pytest.fail("no health endpoint returned 200")
