"""Media Master ecosystem — DSG TV Network, Vibe Radio, DSG Music Group,
and AI Scout. Single source of truth for the channel/station/studio/hype
constants defined in `Global_Vibez_DSG_Media_Master.pdf` (May 2026).

Importing this module gives every route (and every regression test) the
same numeric truth: channel categories, pricing, gate types, revenue
hooks, hype-score weights, and clip thresholds.
"""
from __future__ import annotations

from typing import Dict, List, TypedDict


# ────────────────────────────────────────────── DSG TV Network ──
class TvChannel(TypedDict):
    channel_id: str
    name: str
    tagline: str
    category: str           # arena | dating | radio | adult | horror
    requires_18_plus: bool
    requires_paywall: bool   # $VIBEZ paywall enforced server-side
    requires_secondary_pin: bool
    coin_price: int          # 0 for non-paywalled channels


DSG_TV_CHANNELS: List[TvChannel] = [
    {
        "channel_id": "arena",
        "name": "The Arena",
        "tagline": "24/7 AAA Card & Board Games. Always live.",
        "category": "arena",
        "requires_18_plus": False,
        "requires_paywall": False,
        "requires_secondary_pin": False,
        "coin_price": 0,
    },
    {
        "channel_id": "spotlight-lounge",
        "name": "Spotlight Lounge",
        "tagline": "Live Dating & Spotlight Dates from the Glasshouse.",
        "category": "dating",
        "requires_18_plus": False,
        "requires_paywall": False,
        "requires_secondary_pin": False,
        "coin_price": 0,
    },
    {
        "channel_id": "dsg-radio-tv",
        "name": "DSG Radio TV",
        "tagline": "Non-stop music videos. Curated by the AI Scout.",
        "category": "radio",
        "requires_18_plus": False,
        "requires_paywall": False,
        "requires_secondary_pin": False,
        "coin_price": 0,
    },
    {
        "channel_id": "after-dark",
        "name": "After Dark",
        "tagline": "Paid private streams. 21+ verified. Secondary PIN.",
        "category": "adult",
        "requires_18_plus": True,
        "requires_paywall": True,
        "requires_secondary_pin": True,
        "coin_price": 500,  # ₵500 unlocks 24h
    },
    {
        "channel_id": "nightmare-club",
        "name": "Nightmare Club",
        "tagline": "Immersive horror events. Not for the faint of heart.",
        "category": "horror",
        "requires_18_plus": True,
        "requires_paywall": True,
        "requires_secondary_pin": True,
        "coin_price": 250,  # ₵250 unlocks 24h
    },
]

CHANNEL_PASS_DURATION_HOURS = 24


# ────────────────────────────────────────────── Vibe Radio ──
class RadioStation(TypedDict):
    station_id: str
    name: str
    genre: str
    tagline: str


VIBE_RADIO_STATIONS: List[RadioStation] = [
    {
        "station_id": "the-grind",
        "name": "The Grind",
        "genre": "Up-tempo Hip-Hop & EDM",
        "tagline": "Bass-forward beats for the late-night casino floor.",
    },
    {
        "station_id": "neon-drift",
        "name": "Neon Drift",
        "genre": "Synthwave",
        "tagline": "Cruise the lights with VibeRidez.",
    },
    {
        "station_id": "romance-fm",
        "name": "Romance FM",
        "genre": "R&B",
        "tagline": "Slow burn soundtrack for Spotlight Dates.",
    },
]

# Skip-bidding constants — pay $VIBEZ to skip a track, others pay MORE
# to keep it playing. Keeps the audience economically engaged with the
# DJ rotation.
SKIP_BID_FLOOR: int = 25            # min ₵ to start a skip bid
KEEP_BID_INCREMENT: int = 10        # each keep-vote must add at least this
INSTANT_PURCHASE_FEE_BPS: int = 500  # platform takes 5% of every $VIBEZ song buy


# ────────────────────────────────────────────── DSG Music Group ──
class MusicStudio(TypedDict):
    studio_id: str
    name: str
    environment: str    # casino | glasshouse | rooftop
    hourly_rate_coins: int


DSG_MUSIC_STUDIOS: List[MusicStudio] = [
    {
        "studio_id": "casino-vault",
        "name": "Casino Vault Studio",
        "environment": "casino",
        "hourly_rate_coins": 2_000,
    },
    {
        "studio_id": "glasshouse-mirror",
        "name": "Glasshouse Mirror Studio",
        "environment": "glasshouse",
        "hourly_rate_coins": 3_000,
    },
    {
        "studio_id": "rooftop-aurora",
        "name": "Rooftop Aurora Studio",
        "environment": "rooftop",
        "hourly_rate_coins": 5_000,
    },
]

# Affiliate Chairs sponsoring an artist — the chair holder receives this
# percent of all $VIBEZ flowing into the sponsored artist's streams +
# music sales. Locked at 30% per the Media Master economic intent.
AFFILIATE_CHAIR_REVENUE_SHARE_BPS: int = 3_000   # 30.00 %


# ────────────────────────────────────────────── AI Scout ──
# Hype Score = (gift_volume_coins * w_g) + (chat_messages_per_minute * w_c)
# Auto-clip triggers above AUTO_CLIP_THRESHOLD. Break-in triggers above
# BREAK_IN_THRESHOLD (a higher bar — network-wide interruption).
HYPE_WEIGHT_GIFTS_PER_COIN: float = 1.0          # 1 coin gifted = 1 hype point
HYPE_WEIGHT_CHAT_PER_MSG_PER_MIN: float = 2.5    # rapid chat is high signal
AUTO_CLIP_THRESHOLD: int = 1_000                 # mints a 30-sec highlight
BREAK_IN_THRESHOLD: int = 10_000                 # interrupts every channel
AUTO_CLIP_DURATION_SECONDS: int = 30


def compute_hype_score(
    gift_volume_coins: float,
    chat_messages_per_minute: float,
) -> float:
    """Pure helper — deterministic per the Master Blueprint hype formula.
    Used by both the live endpoint and the regression test suite."""
    return (
        gift_volume_coins * HYPE_WEIGHT_GIFTS_PER_COIN
        + chat_messages_per_minute * HYPE_WEIGHT_CHAT_PER_MSG_PER_MIN
    )


def classify_hype(score: float) -> str:
    """Return the AI Scout's verdict bucket — used by the dashboard tile."""
    if score >= BREAK_IN_THRESHOLD:
        return "break_in"
    if score >= AUTO_CLIP_THRESHOLD:
        return "auto_clip"
    return "ambient"


PROTOCOL_VERSION = "Media Master · DSG TV / Vibe Radio / Music Group / AI Scout · 2026"
