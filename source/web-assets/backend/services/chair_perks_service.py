"""
chair_perks_service — Roadmap PDF §3 "Seated Ownership" UI unlock.

A small read-only helper that returns the deterministic perk payload
for a given user_id, so any surface (chat broadcast, badge renderer,
profile ring) can stamp messages without coupling to the full
`chairs.py` route module.

Pure read; no writes, no exceptions on missing data.
"""
from __future__ import annotations
from typing import Any, Dict


_DEFAULT: Dict[str, Any] = {
    "owns_chair":           False,
    "locked_chairs":        0,
    "generation_boost_pct": 0,
    "name_color":           "",
    "glow_color":           "",
    "badge_label":          "",
}


async def get_chair_perks_for_user(db, user_id: str | None) -> Dict[str, Any]:
    """Return the perk payload for `user_id`. Mirrors the
    GET /api/chairs/perks contract.

    Color mapping (deterministic by best phase owned):
      • Genius   → cyan  (#22d3ee)
      • Founder  → amber (#fbbf24)
      • Standard → fuchsia (#e879f9)
      • Non-holder → "" (caller falls back to its default)
    """
    if not user_id or db is None:
        return dict(_DEFAULT)

    # Fast-path: locked count from the canonical chair record.
    try:
        from routes.chairs import _user_chair_record  # noqa: PLC0415
        rec = await _user_chair_record(db, user_id)
    except Exception:
        return dict(_DEFAULT)

    locked = int(rec.get("locked_chairs") or 0)
    if locked <= 0:
        return dict(_DEFAULT)

    user_id_lookup = (user_id or "")[:8]
    try:
        purchases = await db.chair_purchases.find(
            {"user_id_lookup": user_id_lookup},
            {"_id": 0, "phase_at_purchase": 1},
        ).to_list(length=10_000)
    except Exception:
        purchases = []
    phases = {(p.get("phase_at_purchase") or "Standard") for p in purchases}

    if "Genius" in phases:
        badge, color, glow = "Genius", "#22d3ee", "rgba(34,211,238,0.55)"
    elif "Founder" in phases:
        badge, color, glow = "Founder", "#fbbf24", "rgba(251,191,36,0.55)"
    else:
        badge, color, glow = "Standard", "#e879f9", "rgba(232,121,249,0.55)"

    return {
        "owns_chair":           True,
        "locked_chairs":        locked,
        "generation_boost_pct": 10,
        "name_color":           color,
        "glow_color":           glow,
        "badge_label":          badge,
    }
