"""
Share My Chair — generates social-share assets for chair holders.

Two endpoints:
  GET /api/chairs/share/og.png?ref={user_id}
       Renders a 1200×630 OG image (Twitter/Open-Graph standard) showing
       the holder's chair count, total contribution, multiplier rank,
       and an inline invite code. Returned as a PNG with cache headers.

  POST /api/chairs/share/payload     (auth)
       Returns ready-to-paste social-share text + the OG-image URL +
       a freshly-minted invite code (or reuses the user's last unused
       one). Frontend Share button reads this and pipes into the Web
       Share API or copies to clipboard.

The OG-image is rendered with PIL — no headless browser needed. Cached
in MongoDB by `(user_id, locked_chairs)` so re-shares don't regenerate.
"""
from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── OG image rendering


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Try to use DejaVu (always present in the container); fall back to default."""
    paths_bold = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    paths_reg = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in (paths_bold if bold else paths_reg):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _rank_for(chairs: int) -> str:
    if chairs >= 50:
        return "PIT BOSS"
    if chairs >= 20:
        return "HIGH ROLLER"
    if chairs >= 5:
        return "REGULAR"
    if chairs >= 1:
        return "FOUNDER"
    return "GUEST"


def _render_og_image(
    *,
    chairs: int,
    contribution_usd: float,
    rank: str,
    anon_id: str,
    invite_code: Optional[str],
    phase: str,
) -> bytes:
    """Returns a PNG of the OG card (1200×630)."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), color=(5, 5, 7))
    draw = ImageDraw.Draw(img, "RGBA")

    # Diagonal neon-grid backdrop (cheap visual interest).
    for i in range(-W, W * 2, 56):
        draw.line([(i, 0), (i + H, H)], fill=(34, 211, 238, 18), width=1)
    for i in range(-H, H * 2, 56):
        draw.line([(0, i), (W, i + W)], fill=(244, 63, 94, 14), width=1)

    # Soft radial glow in the upper-right.
    for r in range(380, 0, -40):
        alpha = max(0, int(40 - r / 12))
        draw.ellipse([(W - r - 80, -r), (W - 80 + r, r)], fill=(244, 63, 94, alpha))

    # Header band.
    draw.rectangle([(0, 0), (W, 78)], fill=(0, 0, 0, 200))
    draw.text((40, 20), "GLOBAL VIBEZ DSG", font=_font(38, bold=True),
              fill=(244, 63, 94))
    draw.text((40, 56), "FOUNDER CHAIR · PARKING SUITE", font=_font(16, bold=True),
              fill=(34, 211, 238))

    # Big number.
    n_text = f"{chairs:,}"
    draw.text((40, 140), n_text, font=_font(220, bold=True), fill=(255, 255, 255))
    label = "chair" if chairs == 1 else "chairs parked"
    draw.text((44, 380), label.upper(), font=_font(26, bold=True),
              fill=(34, 211, 238))

    # Right column: rank + contribution + phase.
    draw.text((720, 150),
              "RANK", font=_font(18, bold=True), fill=(34, 211, 238))
    draw.text((720, 175),
              rank, font=_font(54, bold=True), fill=(252, 211, 77))

    draw.text((720, 270),
              "LIFETIME CONTRIBUTION", font=_font(18, bold=True),
              fill=(34, 211, 238))
    draw.text((720, 295),
              f"${contribution_usd:,.2f}", font=_font(50, bold=True),
              fill=(248, 113, 113))

    draw.text((720, 380),
              "CURRENT PHASE", font=_font(18, bold=True), fill=(34, 211, 238))
    draw.text((720, 405),
              phase.upper(), font=_font(36, bold=True), fill=(168, 85, 247))

    # Anon ID + invite footer band.
    draw.rectangle([(0, H - 110), (W, H)], fill=(15, 15, 20, 240))
    draw.text((40, H - 90), "FOUNDER ID", font=_font(14, bold=True),
              fill=(34, 211, 238))
    draw.text((40, H - 68), anon_id, font=_font(28, bold=True),
              fill=(255, 255, 255))

    if invite_code:
        draw.text((720, H - 90), "JOIN ME WITH CODE", font=_font(14, bold=True),
                  fill=(252, 211, 77))
        draw.text((720, H - 68), invite_code, font=_font(36, bold=True),
                  fill=(252, 211, 77))

    # © footer.
    draw.text((40, H - 28), "© 2026 Global Vibez DSG · ₵ Vibez Coins",
              font=_font(13), fill=(168, 85, 247))

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _anon(user_id: str) -> str:
    """Stable anonymized handle for OG cards."""
    if not user_id or len(user_id) < 6:
        return "GUEST"
    return f"FNDR-{user_id[-6:].upper()}"


# ────────────────────────────────────────────── Endpoints


@router.get("/chairs/share/og.png")
async def og_image(ref: str = Query(..., min_length=3, max_length=80)) -> Response:
    """Public — renders the OG image for the given user ref."""
    db = get_database()
    bal = await db.profit_share_balances.find_one(
        {"user_id": ref}, {"_id": 0, "locked_chairs": 1, "lifetime_contribution_usd": 1}
    ) or {}
    chairs = int(bal.get("locked_chairs") or 0)
    contribution = float(bal.get("lifetime_contribution_usd") or 0.0)

    # Try to find a usable invite code the holder has minted.
    invite = None
    if chairs > 0:
        rec = await db.invites.find_one(
            {"owner_user_id": ref, "status": "pending"},
            {"_id": 0, "code": 1},
            sort=[("created_at", -1)],
        )
        invite = rec["code"] if rec else None

    # Current chair phase (for context badge).
    counter = await db.profit_share_counters.find_one(
        {"_id": "global_chairs"}, {"_id": 0, "count": 1}
    ) or {}
    sold = int(counter.get("count") or 0)
    if sold < 10_000:
        phase = "Founder"
    elif sold < 30_000:
        phase = "Growth"
    elif sold < 60_000:
        phase = "Serious"
    else:
        phase = "Sold Out"

    png = _render_og_image(
        chairs=chairs,
        contribution_usd=contribution,
        rank=_rank_for(chairs),
        anon_id=_anon(ref),
        invite_code=invite,
        phase=phase,
    )
    return Response(
        content=png,
        media_type="image/png",
        headers={
            # 5-min CDN cache so social platforms grab it once per share.
            "Cache-Control": "public, max-age=300, s-maxage=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/chairs/share/payload")
async def share_payload(http_request: Request) -> Dict[str, Any]:
    """Returns a ready-to-share bundle: text + url + og_image_url + invite_code.

    Mints a fresh invite code if the caller doesn't already have a pending
    one. Caller must be a chair holder OR Founders Pass owner.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    bal = await db.profit_share_balances.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "locked_chairs": 1, "lifetime_contribution_usd": 1},
    ) or {}
    chairs = int(bal.get("locked_chairs") or 0)
    contribution = float(bal.get("lifetime_contribution_usd") or 0.0)
    has_pass = bool(await db.founders_passes.find_one(
        {"user_id": user.user_id, "status": "active"}, {"_id": 0}
    ))
    if chairs < 1 and not has_pass:
        raise HTTPException(
            403,
            "Park at least one chair (or buy a Founders Pass) before sharing."
        )

    # Reuse latest pending invite, or mint a fresh one.
    invite_doc = await db.invites.find_one(
        {"owner_user_id": user.user_id, "status": "pending"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not invite_doc:
        from routes.invites import _new_code  # type: ignore
        code = _new_code()
        for _ in range(3):
            if not await db.invites.find_one({"code": code}):
                break
            code = _new_code()
        await db.invites.insert_one({
            "code": code,
            "owner_user_id": user.user_id,
            "owner_chairs_at_creation": chairs,
            "status": "pending",
            "used_by_user_id": None,
            "used_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        code = invite_doc["code"]

    origin = (
        http_request.headers.get("origin")
        or http_request.headers.get("referer", "").rstrip("/")
        or ""
    ).rstrip("/")
    if not origin:
        host_url = str(http_request.base_url).rstrip("/")
        # Strip /api off the base if it ended up there
        origin = host_url

    join_url = f"{origin}/join/{code}"
    og_url = f"{origin}/api/chairs/share/og.png?ref={user.user_id}"

    rank = _rank_for(chairs)
    chair_word = "chair" if chairs == 1 else "chairs"

    text_short = (
        f"I just parked {chairs} {chair_word} in the Global Vibez Vault — "
        f"{rank} rank. Use my code {code} and meet me at the table."
    )
    text_long = (
        f"🪑 I just parked {chairs} {chair_word} in the Global Vibez DSG Vault.\n"
        f"💎 Lifetime contribution: ${contribution:,.2f}\n"
        f"🔑 Rank: {rank}\n\n"
        f"Use my invite code {code} to claim a seat at the table:\n{join_url}"
    )

    return {
        "ok": True,
        "chairs": chairs,
        "rank": rank,
        "anon_id": _anon(user.user_id),
        "invite_code": code,
        "join_url": join_url,
        "og_image_url": og_url,
        "share_text_short": text_short,
        "share_text_long": text_long,
        "twitter_intent": (
            "https://twitter.com/intent/tweet?text="
            + (text_short.replace(" ", "%20").replace("#", "%23"))
            + f"&url={join_url}"
        ),
    }
