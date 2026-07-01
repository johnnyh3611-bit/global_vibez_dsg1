"""
Vibe TV Continuity — v6.5 Phase 6.

Source: Global_Vibez_OMNI_MASTER_v6_5.pdf §Vibe TV.

24/7 channel that plays content back-to-back with AI-inserted ads
between episodes. Targeted by zip code so Mom & Pop businesses on the
"Vibe Yellow Pages" surface in their own neighborhoods.

  • EPISODE_LISTING_FEE_PER_30M = $5  (creators pay to be on Vibe TV)
  • AD slot duration = 60 seconds
  • Ad cadence = 1 ad slot between every 2 episodes (configurable)
  • Zip-code targeting weight = 70% local · 30% national fallback

Pure Python schedule generator + selector. Persistence + WebSocket
broadcast wiring out-of-scope here (Phase 7).
"""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional


EPISODE_LISTING_FEE_PER_30M: float = 5.0
AD_SLOT_DURATION_SECONDS: int = 60
EPISODES_BETWEEN_ADS: int = 2
LOCAL_AD_TARGET_WEIGHT: float = 0.70   # 70% local fallback to 30% national


# ──────────────────────────────────────────────────────────────────────────
# 1. EPISODE / AD MODELS
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class TVEpisode:
    episode_id: str
    creator_id: str
    title: str
    duration_minutes: int
    genre: str
    listing_fee_paid: float        # creator paid this much to be on TV
    is_active: bool = True

    @property
    def duration_seconds(self) -> int:
        return self.duration_minutes * 60


@dataclass(frozen=True)
class TVAd:
    ad_id: str
    advertiser_id: str
    title: str
    target_zip_codes: List[str]    # empty list = national-only
    duration_seconds: int = AD_SLOT_DURATION_SECONDS
    is_active: bool = True


# ──────────────────────────────────────────────────────────────────────────
# 2. LISTING FEE
# ──────────────────────────────────────────────────────────────────────────
def compute_listing_fee(duration_minutes: int) -> float:
    """$5 per 30-minute block (rounded UP). 30 min = $5, 31–60 min = $10, etc."""
    if duration_minutes <= 0:
        raise ValueError("duration must be positive")
    blocks = (duration_minutes + 29) // 30
    return float(blocks) * EPISODE_LISTING_FEE_PER_30M


# ──────────────────────────────────────────────────────────────────────────
# 3. SCHEDULE GENERATOR
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class TVSlot:
    """One scheduled slot in the 24/7 stream."""
    slot_id: str
    kind: Literal["episode", "ad"]
    payload_id: str   # episode_id or ad_id
    title: str
    starts_at: str    # ISO timestamp
    duration_seconds: int


def generate_schedule(
    episodes: List[TVEpisode],
    start_at: datetime,
    duration_hours: int = 24,
) -> List[TVSlot]:
    """Build a flat schedule for the next `duration_hours`. Episodes loop;
    every `EPISODES_BETWEEN_ADS` episodes an ad slot is inserted."""
    if not episodes:
        raise ValueError("at least one active episode required")
    active = [e for e in episodes if e.is_active]
    if not active:
        raise ValueError("no active episodes available")

    slots: List[TVSlot] = []
    cursor = start_at.replace(microsecond=0)
    end_at = cursor + timedelta(hours=duration_hours)
    ep_index = 0
    eps_since_ad = 0

    while cursor < end_at:
        ep = active[ep_index % len(active)]
        slots.append(TVSlot(
            slot_id=str(uuid.uuid4()), kind="episode",
            payload_id=ep.episode_id, title=ep.title,
            starts_at=cursor.isoformat(),
            duration_seconds=ep.duration_seconds,
        ))
        cursor += timedelta(seconds=ep.duration_seconds)
        ep_index += 1
        eps_since_ad += 1

        if eps_since_ad >= EPISODES_BETWEEN_ADS and cursor < end_at:
            slots.append(TVSlot(
                slot_id=str(uuid.uuid4()), kind="ad",
                payload_id="<TBD>", title="<AI Ad Placeholder>",
                starts_at=cursor.isoformat(),
                duration_seconds=AD_SLOT_DURATION_SECONDS,
            ))
            cursor += timedelta(seconds=AD_SLOT_DURATION_SECONDS)
            eps_since_ad = 0

    return slots


# ──────────────────────────────────────────────────────────────────────────
# 4. AI AD INSERTION (zip-code targeting)
# ──────────────────────────────────────────────────────────────────────────
def select_ad_for_viewer(
    ads: List[TVAd], viewer_zip: Optional[str], rng_seed: Optional[int] = None,
) -> Optional[TVAd]:
    """Pick the ad to play. 70% probability we pull from the zip-targeted
    bucket, 30% national. If the targeted bucket is empty we fall back to
    national. If both buckets are empty → None."""
    if not ads:
        return None
    rng = secrets.SystemRandom() if rng_seed is None else _seeded_random(rng_seed)
    local = [a for a in ads if a.is_active and viewer_zip and viewer_zip in a.target_zip_codes]
    national = [a for a in ads if a.is_active and not a.target_zip_codes]

    if local and national:
        bucket = local if rng.random() < LOCAL_AD_TARGET_WEIGHT else national
    elif local:
        bucket = local
    elif national:
        bucket = national
    else:
        return None
    return rng.choice(bucket)


def _seeded_random(seed: int):
    """Deterministic RNG factory for tests."""
    import random
    return random.Random(seed)


# ──────────────────────────────────────────────────────────────────────────
# 5. SCHEDULE → AD INJECTION (resolve "<TBD>" slots into actual ads)
# ──────────────────────────────────────────────────────────────────────────
def inject_ads(
    schedule: List[TVSlot], ads: List[TVAd], viewer_zip: Optional[str],
) -> List[TVSlot]:
    """Walk the schedule, replace each ad placeholder with a selected ad
    based on the viewer's zip. Returns a NEW list of slots."""
    out: List[TVSlot] = []
    for s in schedule:
        if s.kind == "ad" and s.payload_id == "<TBD>":
            ad = select_ad_for_viewer(ads, viewer_zip)
            if ad is None:
                # Skip the slot if we can't fill it (avoids dead air on the front-end)
                continue
            out.append(TVSlot(
                slot_id=s.slot_id, kind="ad",
                payload_id=ad.ad_id, title=ad.title,
                starts_at=s.starts_at, duration_seconds=ad.duration_seconds,
            ))
        else:
            out.append(s)
    return out


__all__ = [
    "EPISODE_LISTING_FEE_PER_30M", "AD_SLOT_DURATION_SECONDS",
    "EPISODES_BETWEEN_ADS", "LOCAL_AD_TARGET_WEIGHT",
    "TVEpisode", "TVAd", "TVSlot",
    "compute_listing_fee",
    "generate_schedule", "select_ad_for_viewer", "inject_ads",
]
