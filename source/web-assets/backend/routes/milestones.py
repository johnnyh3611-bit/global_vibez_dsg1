"""
Phase milestone auto-poster.

Watches the chair counter and emits a queued social post every time a phase
crosses 25%, 50%, 75%, or 100% sold. Each milestone:
  • is idempotent — fires exactly once per (phase, threshold) pair
  • renders an OG card via PIL (1200×630)
  • queues a draft post with copy + OG image URL + Twitter intent URL

We do NOT auto-post to X. Real X auto-posting needs the Twitter API +
account credentials + content-policy review. Instead, the founder gets a
one-click "Post on X" button on the admin dashboard that opens the
intent URL with copy + image already attached.

Endpoints:
  GET  /api/admin/milestones/queue   — pending drafts
  POST /api/admin/milestones/{id}/mark-posted   — flag as posted (or skipped)
  GET  /api/milestones/og/{milestone_id}.png    — public OG image
  POST /api/admin/milestones/check-now          — manual scan trigger
"""
from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────── Tunables

# Standard launch-moment thresholds. 100% is the "phase complete" cap.
THRESHOLDS = [25, 50, 75, 100]

# Color palette per phase — locks visual identity for each milestone card
PHASE_PALETTE: Dict[str, Dict[str, Any]] = {
    "Genius":    {"primary": (252, 211, 77),  "accent": (244, 63, 94),
                  "label": "GENIUS", "vibe": "FIRST BELIEVERS"},
    "Genesis":   {"primary": (52, 211, 153),  "accent": (34, 211, 238),
                  "label": "GENESIS", "vibe": "EXPANSION WAVE"},
    "Vanguard":  {"primary": (52, 211, 153),  "accent": (34, 211, 238),
                  "label": "VANGUARD", "vibe": "CRITICAL MASS"},
    "Global":    {"primary": (96, 165, 250),  "accent": (168, 85, 247),
                  "label": "GLOBAL", "vibe": "WORLDWIDE"},
    "Stellar":   {"primary": (192, 132, 252), "accent": (236, 72, 153),
                  "label": "STELLAR", "vibe": "EXPANSION"},
    "Celestial": {"primary": (251, 207, 232), "accent": (167, 139, 250),
                  "label": "CELESTIAL", "vibe": "FINAL CHAPTER"},
}


# ────────────────────────────────────────── Helpers


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _render_milestone_og(
    *,
    phase: str,
    threshold_pct: int,
    seats_sold: int,
    seats_remaining_in_phase: int,
    price_usd: float,
    weight: float,
) -> bytes:
    W, H = 1200, 630
    palette = PHASE_PALETTE.get(phase, PHASE_PALETTE["Global"])
    primary = palette["primary"]
    accent = palette["accent"]

    img = Image.new("RGB", (W, H), color=(5, 5, 7))
    draw = ImageDraw.Draw(img, "RGBA")

    # Diagonal grid backdrop
    for i in range(-W, W * 2, 56):
        draw.line([(i, 0), (i + H, H)], fill=(*accent, 28), width=1)
    for i in range(-H, H * 2, 56):
        draw.line([(0, i), (W, i + W)], fill=(*primary, 18), width=1)

    # Radial accent glow (top-right)
    for r in range(420, 0, -40):
        alpha = max(0, int(50 - r / 12))
        draw.ellipse([(W - r - 80, -r), (W - 80 + r, r)], fill=(*accent, alpha))

    # Header band
    draw.rectangle([(0, 0), (W, 78)], fill=(0, 0, 0, 200))
    draw.text((40, 20), "GLOBAL VIBEZ DSG", font=_font(38, bold=True),
              fill=primary)
    draw.text((40, 56),
              f"{palette['label']} · {palette['vibe']}",
              font=_font(15, bold=True), fill=(255, 255, 255, 200))

    # The big milestone number
    pct_text = f"{threshold_pct}%"
    if threshold_pct == 100:
        headline = f"{palette['label']} SOLD OUT"
        sub = f"{seats_sold:,} chairs locked. Next phase opens now."
    else:
        headline = f"{pct_text} CLAIMED"
        sub = f"{seats_remaining_in_phase:,} {palette['label'].lower()} chairs left at ${price_usd:.0f}"

    draw.text((40, 140), headline, font=_font(96, bold=True), fill=(255, 255, 255))
    draw.text((44, 250), sub, font=_font(24, bold=True), fill=accent)

    # Multiplier badge
    mult_label = f"{weight:.0f}× EARN RATE — LOCKED FOREVER"
    draw.rectangle([(40, 320), (760, 380)], fill=(*primary, 60))
    draw.rectangle([(40, 320), (760, 380)], outline=primary, width=2)
    draw.text((54, 336), mult_label, font=_font(22, bold=True), fill=primary)

    # Stats column on right
    draw.text((820, 140), "TOTAL SOLD", font=_font(15, bold=True),
              fill=(34, 211, 238))
    draw.text((820, 162), f"{seats_sold:,}", font=_font(48, bold=True),
              fill=(255, 255, 255))

    draw.text((820, 240), "PHASE PRICE", font=_font(15, bold=True),
              fill=(34, 211, 238))
    draw.text((820, 262), f"${price_usd:.0f}", font=_font(48, bold=True),
              fill=primary)

    draw.text((820, 340), "MULTIPLIER", font=_font(15, bold=True),
              fill=(34, 211, 238))
    draw.text((820, 362), f"{weight:.0f}×", font=_font(48, bold=True),
              fill=accent)

    # Footer band
    draw.rectangle([(0, H - 90), (W, H)], fill=(15, 15, 20, 240))
    draw.text((40, H - 70),
              "Park your seat. Stay Premium. Get paid quarterly.",
              font=_font(20, bold=True), fill=(255, 255, 255))
    draw.text((40, H - 32),
              "© 2026 Global Vibez DSG · ₵ Vibez Coins · globalvibez.app/chair-vault",
              font=_font(13), fill=(168, 85, 247))

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _build_post_copy(
    phase: str, threshold_pct: int, seats_remaining: int, price_usd: float,
) -> Dict[str, str]:
    """Generates short + long social copy. Phase + percentage pick the tone."""
    palette = PHASE_PALETTE.get(phase, PHASE_PALETTE["Global"])
    if threshold_pct == 25:
        short = (
            f"🟡 {palette['label']} phase is 25% claimed. "
            f"{seats_remaining:,} chairs left at ${price_usd:.0f}. "
            f"Park your seat at the table → globalvibez.app/chair-vault"
        )
    elif threshold_pct == 50:
        short = (
            f"🚀 {palette['label']} is HALFWAY GONE. "
            f"Only {seats_remaining:,} ${price_usd:.0f} chairs left. "
            f"Don't sleep → globalvibez.app/chair-vault"
        )
    elif threshold_pct == 75:
        short = (
            f"🔥 {palette['label']} is 75% claimed. Final {seats_remaining:,} "
            f"chairs at ${price_usd:.0f}. Next phase price goes UP → "
            f"globalvibez.app/chair-vault"
        )
    else:  # 100%
        short = (
            f"✅ {palette['label']} SOLD OUT. Next phase opens now at a higher "
            f"price + lower multiplier. Genius-rate is gone forever for new "
            f"buyers. Park your seat → globalvibez.app/chair-vault"
        )
    long_post = short  # X has 280 char limit; reuse for now
    return {"short": short, "long": long_post}


# ────────────────────────────────────────── Detector


async def _scan_for_milestones(db) -> List[Dict[str, Any]]:
    """Reads the chair counter, finds any (phase, threshold) crossing that
    hasn't been queued yet, queues + renders OG cards, returns the new ones.
    """
    from routes.chairs import PHASES, _total_chairs_sold  # type: ignore

    sold = await _total_chairs_sold(db)

    new_milestones: List[Dict[str, Any]] = []
    cumulative_floor = 0
    for phase in PHASES:
        cap = phase["limit"]
        capacity = cap - cumulative_floor
        sold_in_phase = max(0, min(sold - cumulative_floor, capacity))
        if capacity <= 0:
            cumulative_floor = cap
            continue
        pct_sold = (sold_in_phase / capacity) * 100

        for thr in THRESHOLDS:
            if pct_sold >= thr:
                # Has this milestone already been queued?
                key = f"{phase['name']}_{thr}"
                existing = await db.phase_milestones.find_one({"_id": key})
                if existing:
                    continue
                # Mint it
                copy = _build_post_copy(
                    phase["name"], thr,
                    seats_remaining=max(0, capacity - sold_in_phase),
                    price_usd=phase["price_usd"],
                )
                doc = {
                    "_id": key,
                    "phase": phase["name"],
                    "threshold_pct": thr,
                    "phase_cap": cap,
                    "phase_capacity": capacity,
                    "phase_price_usd": phase["price_usd"],
                    "phase_weight": phase["weight"],
                    "seats_sold_total_at_trigger": sold,
                    "seats_sold_in_phase_at_trigger": sold_in_phase,
                    "seats_remaining_in_phase_at_trigger": capacity - sold_in_phase,
                    "share_text_short": copy["short"],
                    "share_text_long": copy["long"],
                    "status": "queued",  # queued | posted | skipped
                    "posted_at": None,
                    "skipped_reason": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    await db.phase_milestones.insert_one(dict(doc))
                except Exception as e:
                    # Race or duplicate; safe to ignore.
                    logger.info(f"[milestones] dup insert {key}: {e}")
                    continue

                await record_god_event(
                    "system", "PHASE_MILESTONE_QUEUED", 0,
                    meta={"phase": phase["name"], "threshold": thr,
                          "sold_at_trigger": sold},
                )
                logger.info(
                    f"[milestones] Queued {phase['name']} {thr}% "
                    f"({sold_in_phase}/{capacity})"
                )
                new_milestones.append(doc)
        cumulative_floor = cap
    return new_milestones


# ────────────────────────────────────────── Public OG image


@router.get("/milestones/og/{milestone_id}.png")
async def milestone_og(milestone_id: str) -> Response:
    """Public — render the milestone OG card on the fly. 5-min cache."""
    db = get_database()
    rec = await db.phase_milestones.find_one({"_id": milestone_id}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Milestone not found.")
    png = _render_milestone_og(
        phase=rec["phase"],
        threshold_pct=rec["threshold_pct"],
        seats_sold=int(rec["seats_sold_total_at_trigger"]),
        seats_remaining_in_phase=int(rec["seats_remaining_in_phase_at_trigger"]),
        price_usd=float(rec["phase_price_usd"]),
        weight=float(rec["phase_weight"]),
    )
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=300, s-maxage=300"},
    )


# ────────────────────────────────────────── Admin endpoints


@router.get("/admin/milestones/queue")
async def admin_queue(
    status: Optional[str] = None,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Pending milestone drafts. Optional ?status=queued|posted|skipped filter."""
    db = get_database()
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    rows = await db.phase_milestones.find(q, {"_id": 1, "phase": 1,
        "threshold_pct": 1, "phase_price_usd": 1, "phase_weight": 1,
        "seats_sold_total_at_trigger": 1, "share_text_short": 1, "status": 1,
        "posted_at": 1, "created_at": 1
    }).sort("created_at", -1).limit(200).to_list(length=200)

    out = []
    for r in rows:
        mid = r.pop("_id")
        out.append({
            "milestone_id": mid,
            "og_image_url": f"/api/milestones/og/{mid}.png",
            "twitter_intent": (
                "https://twitter.com/intent/tweet?text="
                + r["share_text_short"].replace(" ", "%20").replace("#", "%23")
            ),
            **r,
        })
    return {"count": len(out), "rows": out}


@router.post("/admin/milestones/{milestone_id}/mark-posted")
async def admin_mark_posted(
    milestone_id: str,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    res = await db.phase_milestones.update_one(
        {"_id": milestone_id},
        {"$set": {"status": "posted",
                   "posted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Milestone not found.")
    return {"ok": True, "milestone_id": milestone_id, "status": "posted"}


@router.post("/admin/milestones/{milestone_id}/skip")
async def admin_skip(
    milestone_id: str,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    res = await db.phase_milestones.update_one(
        {"_id": milestone_id},
        {"$set": {"status": "skipped",
                   "skipped_reason": "manual_admin_skip"}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Milestone not found.")
    return {"ok": True, "milestone_id": milestone_id, "status": "skipped"}


@router.post("/admin/milestones/check-now")
async def admin_check_now(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Manual trigger — useful when seeding or testing."""
    db = get_database()
    new = await _scan_for_milestones(db)
    return {"new_milestones": len(new), "ids": [m["_id"] for m in new]}


@router.get("/admin/milestones/recap")
async def admin_milestones_recap(
    period_days: int = 7,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Posted/skipped/queued recap over the last N days. Drives the
    God-Mode "Milestone Recap" panel. Also returns top-3 most-recently
    posted phases as a content-performance signal."""
    db = get_database()
    period_days = max(1, min(int(period_days), 90))
    since = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()

    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$status", "n": {"$sum": 1}}},
    ]
    rows = await db.phase_milestones.aggregate(pipeline).to_list(length=10)
    counts = {r["_id"]: int(r["n"]) for r in rows}

    posted = counts.get("posted", 0)
    skipped = counts.get("skipped", 0)
    queued = counts.get("queued", 0)
    total = posted + skipped + queued
    post_rate = round((posted / total) * 100, 1) if total else 0.0

    recent_posted = await db.phase_milestones.find(
        {"status": "posted", "created_at": {"$gte": since}},
        {"_id": 1, "phase": 1, "threshold": 1, "posted_at": 1,
         "seats_sold_total_at_trigger": 1},
    ).sort("posted_at", -1).limit(3).to_list(length=3)

    return {
        "period_days": period_days,
        "since": since,
        "counts": {
            "posted": posted,
            "skipped": skipped,
            "queued": queued,
            "total": total,
        },
        "post_rate_pct": post_rate,
        "recent_posted": [
            {
                # _id is a string milestone slug like "Genesis_25" — safe.
                "milestone_id": r.get("_id"),
                "phase": r.get("phase"),
                "threshold": r.get("threshold"),
                "posted_at": r.get("posted_at"),
                "seats_sold_at_trigger": r.get("seats_sold_total_at_trigger"),
            }
            for r in recent_posted
        ],
    }
