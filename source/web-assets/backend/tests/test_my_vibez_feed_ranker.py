"""Tests for MY VIBEZ personalized For You ranker + feed normalization."""
from __future__ import annotations

import pytest

from routes.my_vibez_feed import (
    _engagement_rate,
    normalize_video_doc,
    rank_for_you,
)


def test_normalize_video_doc_aliases():
    raw = {
        "id": "vibez_abc",
        "likes": 10,
        "comments": 2,
        "shares": 1,
        "views": 100,
        "content_url": "/static/videos/x.webm",
        "username": "Ada",
        "created_at": "2026-07-01T00:00:00+00:00",
    }
    out = normalize_video_doc(raw)
    assert out["video_id"] == "vibez_abc"
    assert out["likes_count"] == 10
    assert out["comments_count"] == 2
    assert out["shares_count"] == 1
    assert out["views_count"] == 100
    assert out["video_url"] == "/static/videos/x.webm"
    assert out["creator_name"] == "Ada"
    assert out["posted_at"] == "2026-07-01T00:00:00+00:00"


def test_engagement_rate_uses_content_field_names():
    rate = _engagement_rate(
        {"likes_count": 5, "comments_count": 1, "shares_count": 0, "views_count": 10}
    )
    assert rate == pytest.approx((5 + 2) / 10)


@pytest.mark.asyncio
async def test_rank_for_you_empty_db(monkeypatch):
    class FakeCursor:
        async def to_list(self, length):
            return []

    class FakeCol:
        def find(self, *a, **k):
            return self

        def sort(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return FakeCursor()

        async def find_one(self, *a, **k):
            return {}

    class FakeDb:
        my_vibez_videos = FakeCol()
        my_vibez_user_prefs = FakeCol()

    monkeypatch.setattr("routes.my_vibez_feed.get_database", lambda: FakeDb())
    out = await rank_for_you("user_1", limit=10)
    assert out["count"] == 0
    assert out["videos"] == []
    assert out["ranker"] == "heuristic-v1"


@pytest.mark.asyncio
async def test_rank_for_you_orders_by_score(monkeypatch):
    docs = [
        {
            "video_id": "old",
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "views_count": 100,
            "created_at": "2020-01-01T00:00:00+00:00",
            "creator_id": "c1",
            "creator_name": "Old",
            "video_url": "/static/videos/old.webm",
        },
        {
            "video_id": "hot",
            "likes_count": 50,
            "comments_count": 10,
            "shares_count": 5,
            "views_count": 100,
            "created_at": "2026-07-28T00:00:00+00:00",
            "creator_id": "c2",
            "creator_name": "Hot",
            "video_url": "/static/videos/hot.webm",
        },
    ]

    class FakeCursor:
        async def to_list(self, length):
            return list(docs)

    class FakeCol:
        def find(self, *a, **k):
            return self

        def sort(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return FakeCursor()

        async def find_one(self, *a, **k):
            return {"avg_completion": 0.5}

    class FakeDb:
        my_vibez_videos = FakeCol()
        my_vibez_user_prefs = FakeCol()

    monkeypatch.setattr("routes.my_vibez_feed.get_database", lambda: FakeDb())
    out = await rank_for_you("user_1", limit=10)
    assert out["count"] == 2
    assert out["videos"][0]["video_id"] == "hot"
    assert out["videos"][0]["_score"] >= out["videos"][1]["_score"]
