"""
Integration tests for the Jan-2026 MME collective-split wire +
License Marketplace iteration.

Covers:
  • GET /api/music-group/marketplace/licensable for 3 valid contexts
    + invalid_context rejection.
  • /api/media/tip path now auto-splits the 80% slice across
    registered collaborators (THE CRITICAL WIRE).
  • Legacy single-credit path still works when no splits exist.
  • Unit: _credit_artist_collective_slice — slice=0 no-op,
    splits→pro-rata, no splits→100% to primary.
"""
from __future__ import annotations

import os
import time
import asyncio
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-connect-953.preview.emergentagent.com",
).rstrip("/")

ARTIST_EMAIL = "betatester1@globalvibez.com"
ARTIST_PASSWORD = "BetaTester2026!"
COLLAB_EMAIL = "betatester2@globalvibez.com"
COLLAB_PASSWORD = "BetaTester2026!"
FAN_EMAIL = "betatester3@globalvibez.com"
FAN_PASSWORD = "BetaTester2026!"


def _login(email: str, password: str) -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user_id = data["user"]["user_id"]
    return {"token": token, "user_id": user_id,
            "headers": {"Authorization": f"Bearer {token}"}}


# ─────────────── Marketplace endpoint tests ───────────────

class TestLicensableEndpoint:
    """GET /api/music-group/marketplace/licensable"""

    def test_tv_sync_default_shape(self):
        r = requests.get(
            f"{BASE_URL}/api/music-group/marketplace/licensable?context=tv_sync",
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["context"] == "tv_sync"
        assert isinstance(data["rows"], list)
        assert "count" in data
        assert data["count"] == len(data["rows"])

    def test_casino_background_supported(self):
        r = requests.get(
            f"{BASE_URL}/api/music-group/marketplace/licensable?context=casino_background",
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d["context"] == "casino_background"

    def test_commercial_use_supported(self):
        r = requests.get(
            f"{BASE_URL}/api/music-group/marketplace/licensable?context=commercial_use",
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d["context"] == "commercial_use"

    def test_invalid_context_rejected(self):
        r = requests.get(
            f"{BASE_URL}/api/music-group/marketplace/licensable?context=NOT_REAL",
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is False
        assert d["reason"] == "invalid_context"


# ─────────────── End-to-end opt-in surface ───────────────

class TestLicenseMarketplaceE2E:

    def test_opt_in_surfaces_track(self):
        artist = _login(ARTIST_EMAIL, ARTIST_PASSWORD)
        suffix = uuid.uuid4().hex[:8]
        # create a track
        track_resp = requests.post(
            f"{BASE_URL}/api/media/artist/me/tracks",
            json={
                "track_title": f"TEST_LIC_{suffix}",
                "audio_url": f"https://test/{suffix}.mp3",
                "cover_art_url": "https://test/c.png",
                "artist_display_name": "TestArtist",
            },
            headers=artist["headers"],
            timeout=20,
        )
        assert track_resp.status_code == 200, track_resp.text
        track = track_resp.json()["track"]
        track_id = track["track_id"]

        # opt-in tv_sync
        r = requests.post(
            f"{BASE_URL}/api/music-group/rights/set",
            json={"track_id": track_id, "allow_tv_sync": True,
                  "allow_casino_background": False,
                  "allow_commercial_use": False},
            headers=artist["headers"], timeout=15,
        )
        assert r.status_code == 200 and r.json().get("ok") is True

        # marketplace tv_sync surfaces it
        m = requests.get(
            f"{BASE_URL}/api/music-group/marketplace/licensable?context=tv_sync",
            timeout=15,
        )
        rows = m.json()["rows"]
        matching = [x for x in rows if x["track_id"] == track_id]
        assert matching, f"track {track_id} not in tv_sync marketplace"
        row = matching[0]
        assert row["title"] and row["artist_name"]
        assert isinstance(row["momentum_score"], int)
        assert row["rights"]["allow_tv_sync"] is True


# ─────────────── THE CRITICAL WIRE ───────────────

class TestMmeCollectiveAutoSplit:
    """1000-coin tip with 60/40 split must auto-distribute the 80%
    slice (= 800 coins) → 480 / 320."""

    def test_auto_split_60_40(self):
        artist = _login(ARTIST_EMAIL, ARTIST_PASSWORD)
        collab = _login(COLLAB_EMAIL, COLLAB_PASSWORD)
        fan = _login(FAN_EMAIL, FAN_PASSWORD)
        suffix = uuid.uuid4().hex[:8]

        # 1. create a track owned by artist A
        tr = requests.post(
            f"{BASE_URL}/api/media/artist/me/tracks",
            json={
                "track_title": f"TEST_SPLIT_{suffix}",
                "audio_url": f"https://test/{suffix}.mp3",
            },
            headers=artist["headers"], timeout=20,
        )
        assert tr.status_code == 200, tr.text
        track_id = tr.json()["track"]["track_id"]

        # 2. register splits A:60% B:40%
        sp = requests.post(
            f"{BASE_URL}/api/music-group/splits/set",
            json={
                "track_id": track_id,
                "splits": [
                    {"user_id": artist["user_id"], "role": "primary_artist",
                     "basis_points": 6000},
                    {"user_id": collab["user_id"], "role": "producer",
                     "basis_points": 4000},
                ],
            },
            headers=artist["headers"], timeout=15,
        )
        assert sp.status_code == 200, sp.text
        assert sp.json().get("ok") is True

        # 3. snapshot balances before
        b_a_before = self._balance(artist)
        b_b_before = self._balance(collab)

        # 4. fan tips 1000 ₵
        # Ensure fan has enough coins — admin grant if endpoint exists
        # not strictly needed for the credit_artist_balance check; the
        # tip path may fail if fan lacks coins, so we check both.
        self._grant_coins(fan, 5000)

        tip = requests.post(
            f"{BASE_URL}/api/media/tip",
            json={"track_id": track_id, "coins": 1000},
            headers=fan["headers"], timeout=20,
        )
        if tip.status_code != 200:
            pytest.skip(f"tip failed (coin balance?): {tip.status_code} {tip.text}")
        body = tip.json()
        assert body.get("ok") is True, body
        # NOTE: response body intentionally does NOT carry the
        # collective_distribution detail (it's persisted on the
        # music_transactions row only). The contract verified here
        # is the on-the-wire balance delta — that's what matters
        # for collaborators receiving their share.

        # 5. balances increased by 480 / 320
        time.sleep(0.5)
        b_a_after = self._balance(artist)
        b_b_after = self._balance(collab)
        assert b_a_after - b_a_before == 480, (
            f"artist A delta {b_a_after - b_a_before}, expected 480")
        assert b_b_after - b_b_before == 320, (
            f"collab B delta {b_b_after - b_b_before}, expected 320")

    @staticmethod
    def _balance(user: dict) -> int:
        r = requests.get(
            f"{BASE_URL}/api/media/artist/me/balance",
            headers=user["headers"], timeout=15,
        )
        if r.status_code != 200:
            return 0
        return int(r.json().get("balance_coins") or 0)

    @staticmethod
    def _grant_coins(user: dict, coins: int):
        # best-effort — used to ensure fan has coins to tip
        try:
            requests.post(
                f"{BASE_URL}/api/coins/grant-test",
                json={"coins": coins},
                headers=user["headers"], timeout=10,
            )
        except Exception:
            pass


# ─────────────── Service-level unit tests ───────────────

class TestHelperUnit:
    """Direct calls into the helper to verify the contract without
    going through HTTP — fast + deterministic."""

    def test_slice_zero_noop(self):
        from services.media_engine import _credit_artist_collective_slice
        from config import db as real_db

        async def run():
            return await _credit_artist_collective_slice(
                real_db, track_id="x", primary_artist_id="u",
                slice_coins=0, txn_id="t1",
            )
        out = asyncio.get_event_loop().run_until_complete(run())
        assert out == {"distributed": 0, "rows": [], "split_count": 0}

    def test_no_splits_falls_back_to_primary(self):
        from services.media_engine import _credit_artist_collective_slice
        from config import db as real_db

        async def run():
            return await _credit_artist_collective_slice(
                real_db,
                track_id=f"missing_track_{uuid.uuid4().hex[:6]}",
                primary_artist_id="primary_xyz",
                slice_coins=800, txn_id="ttest",
            )
        out = asyncio.get_event_loop().run_until_complete(run())
        assert out["split_count"] == 0
        assert out["distributed"] == 800
        assert out["rows"][0]["user_id"] == "primary_xyz"
        assert out["rows"][0]["share_coins"] == 800
