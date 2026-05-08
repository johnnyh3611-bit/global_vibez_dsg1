"""
Just For The Night — Demo Room Seeder (May 2026)
─────────────────────────────────────────────────
Auto-seeds 3 example late-night rooms so beta testers don't see an
empty `/just-for-the-night` discovery hub on first visit. Runs once
per backend boot via lifespan.register_startup_tasks.

Idempotent: if any of the 3 demo rooms already exist (matched by
`seed_id`), they are healed (re-published, refreshed) rather than
duplicated. Safe to redeploy any time.

Founder ask 2026-05-07: "Seed 2-3 demo rooms so when beta testers
click Just For The Night they see content instead of an empty grid."
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Seed_id keys (NOT room_ids — these are stable across reseeds).
DEMO_ROOMS = [
    {
        "seed_id": "jftn_demo_neon_blackjack",
        "owner_id": "demo_founder",
        "owner_name": "Founder · Demo",
        "title": "Neon Blackjack After Hours",
        "description": (
            "21 with the Founder AI dealer · vanishing voice + chat · "
            "win the challenge to unlock the late-night cinema room."
        ),
        "preview_image_url": (
            "https://images.unsplash.com/photo-1511193311914-0346f16efe90"
            "?auto=format&fit=crop&w=1200&q=80"
        ),
        "stream_url": "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/unslioda_mp_.mp4",
        "settings": {
            "dealer_type": "founder_ai",
            "challenge_game": "blackjack",
            "entry_tokens": 100,
            "challenge_difficulty": "medium",
            "room_theme": "neon_nights",
            "enable_watermark": True,
        },
    },
    {
        "seed_id": "jftn_demo_velvet_poker",
        "owner_id": "demo_founder",
        "owner_name": "Founder · Demo",
        "title": "Velvet Lounge — High-Stakes Poker",
        "description": (
            "5-handed poker, two ghost dealers · whisper voice channel · "
            "big stack walks away with the room's pass for tomorrow night."
        ),
        "preview_image_url": (
            "https://images.unsplash.com/photo-1511193311914-0346f16efe90"
            "?auto=format&fit=crop&w=1200&q=80&sat=-40"
        ),
        "stream_url": "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/id27iw8u__The_video_will_be_available_for_hours.mp4",
        "settings": {
            "dealer_type": "ghost_dealer",
            "challenge_game": "poker",
            "entry_tokens": 250,
            "challenge_difficulty": "hard",
            "room_theme": "velvet_lounge",
            "enable_watermark": True,
        },
    },
    {
        "seed_id": "jftn_demo_sunrise_roulette",
        "owner_id": "demo_founder",
        "owner_name": "Founder · Demo",
        "title": "Sunrise Roulette — Vanishes at 6AM",
        "description": (
            "European roulette · personal-avatar dealer · the wheel "
            "stops spinning when the sun comes up. Pass holders only."
        ),
        "preview_image_url": (
            "https://images.unsplash.com/photo-1518895949257-7621c3c786d7"
            "?auto=format&fit=crop&w=1200&q=80"
        ),
        "stream_url": "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/unslioda_mp_.mp4",
        "settings": {
            "dealer_type": "personal_avatar",
            "challenge_game": "roulette",
            "entry_tokens": 175,
            "challenge_difficulty": "easy",
            "room_theme": "neon_nights",
            "enable_watermark": True,
        },
    },
]


async def run_seeder() -> dict:
    """Idempotent seed of demo rooms. Returns counts for logging."""
    from utils.database import get_database

    db = get_database()
    coll = db.jftn_rooms
    now = datetime.now(timezone.utc).isoformat()

    created = healed = untouched = 0

    for spec in DEMO_ROOMS:
        seed_id = spec["seed_id"]
        existing = await coll.find_one({"seed_id": seed_id}, {"_id": 0})

        if not existing:
            room_id = f"room_demo_{seed_id.split('_')[-1]}"
            doc = {
                **spec,
                "room_id": room_id,
                "is_active": True,
                "is_demo": True,                # marker for filtering/UX
                "total_visits": 0,
                "total_revenue": 0,
                "created_at": now,
                "updated_at": now,
            }
            await coll.insert_one(doc)
            created += 1
            continue

        # Heal: re-publish + refresh fields if they drift, but keep
        # accumulated total_visits / revenue intact.
        updates = {
            "is_active": True,
            "is_demo": True,
            "title": spec["title"],
            "description": spec["description"],
            "preview_image_url": spec["preview_image_url"],
            "stream_url": spec["stream_url"],
            "settings": spec["settings"],
            "owner_id": spec["owner_id"],
            "owner_name": spec["owner_name"],
            "updated_at": now,
        }
        # Only count as "healed" if anything actually changed.
        drift = any(existing.get(k) != v for k, v in updates.items()
                    if k != "updated_at")
        if drift:
            await coll.update_one({"seed_id": seed_id}, {"$set": updates})
            healed += 1
        else:
            untouched += 1

    logger.info(
        "JFTN demo-room seeder: created=%d healed=%d untouched=%d",
        created, healed, untouched,
    )
    return {"created": created, "healed": healed, "untouched": untouched}
