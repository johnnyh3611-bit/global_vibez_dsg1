"""
AI Guide — contextual room hints for the floating AI Navigator.

POST /api/ai/guide-hint
  Body: {
    room: str,
    path?: str,
    diagnostics?: {
      viewport_w?: int,
      viewport_h?: int,
      orientation?: "portrait" | "landscape",
      force_landscape?: bool,
      authenticated?: bool,
    }
  }
  Returns: {
    hint: str,
    room: str,
    source: "catalog" | "path" | "default",
    tips: list[str],
    known_issues: list[str],
  }

Static catalog first (fast, offline-safe). Optional Gemini enrichment
is intentionally NOT required — guidance must work without LLM budget.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["AI Guidance"])

# Category-level blurbs (fallback when no path-specific tip matches).
HINTS: Dict[str, str] = {
    "gaming": (
        "You're in a gaming room. Pick a table or stake, buy in with ₵ Vibez Coins, "
        "and jump into a single-viewport session. On phones, turn sideways (or tap "
        "Rotate phone) so the table and your hand fit without scrolling."
    ),
    "streaming": (
        "Welcome to live streaming. Tap any active broadcast to watch, drop reactions, "
        "or open the creator's profile. Co-Watch spawns an authorized Cinema Room invite."
    ),
    "dating": (
        "Explore connections here. Browse profiles, start an icebreaker chat, or join a "
        "Just-for-the-Night lounge. Voice Mirror translates if you need it."
    ),
    "rides": (
        "Vibe Ridez is your in-app lift. Request a ride, track your driver live, and chat "
        "in Ride Chat. Keep your wallet funded for fare."
    ),
    "food": (
        "HungryVibes / Vibez Spots — order without leaving your game. Use the food menu "
        "from Quick Access so you never pause the table."
    ),
    "hub": (
        "This is your hub. Tap any tile to teleport into games, dating, rides, food, or "
        "streaming. Your wallet pill shows ₵ balance; mining streak grows with daily logins."
    ),
    "sports": (
        "Vibe Sports Book — pick a stake, lock odds, and wait for the crowd Vibe Check "
        "before payouts. Bet of the Day pins the hottest vaulted bet."
    ),
    "underground": (
        "The Underground is high-limit. Confirm the floor, then pick a private table. "
        "Royal / Sovereign tiers may skip the minimum."
    ),
    "default": (
        "Take your time exploring! Jump between rooms with the main navigation or "
        "Quick Access (⋯). Tap Need Guidance anytime — I know this room and common fixes."
    ),
}

# Path-specific guidance (longest prefix wins). Keys are path prefixes.
PATH_HINTS: Dict[str, str] = {
    "/spades": (
        "Spades AAA — bid after the review countdown, then follow suit. Your hand sits "
        "at the bottom of the landscape table. If cards feel cut off, tap Rotate phone "
        "or turn the device sideways."
    ),
    "/bid-whist": (
        "Bid Whist — bid amount + Uptown/Downtown/No Trump, then kitty exchange. "
        "Use landscape so the bid modal and hand stay on one screen."
    ),
    "/dominoes": (
        "Dominoes — you sit at the table looking across the chain. Match left or right "
        "ends; draw from the boneyard when blocked. Highest double usually leads."
    ),
    "/practice/play/checkers": (
        "Checkers practice — top-ish board view. Select your piece, then a destination. "
        "Forced jumps apply when available."
    ),
    "/practice/play/pool": (
        "Pool — overhead table, pulled a bit closer so balls read clearly. Aim, then "
        "strike; stripes vs solids after the break."
    ),
    "/practice/play/bowling": (
        "Bowling — ground-level lane view: ball near you, pins down-lane. Set power "
        "and release; score follows standard ten-pin frames."
    ),
    "/hearts": (
        "Hearts — pass three cards first (except hold hands), then avoid hearts and "
        "the Queen of Spades unless you're shooting the moon."
    ),
    "/euchre": (
        "Euchre — order up or name trump, then play tricks. Landscape keeps the upcard "
        "and your five-card hand visible together."
    ),
    "/pinochle": (
        "Pinochle — meld then trick-take. Watch trump and the meld window before play."
    ),
    "/cinema-room": (
        "Cinema Room — authorized internal / curated catalog only. Co-Watch creates a "
        "synced invite to this room (not third-party free-TV networks)."
    ),
    "/free-tv": (
        "Free TV stubs were removed. You are redirected to the authorized Cinema Room."
    ),
    "/games": (
        "Games lobby — pick a card room, casino table, or practice lane. Demo Login "
        "unlocks play quickly if you are not signed in."
    ),
    "/practice": (
        "Practice arena — no-stakes training for card rooms, checkers, pool, bowling, "
        "and more. Perfect for learning rules before live tables."
    ),
    "/wallet": (
        "Wallet — ₵ Vibez Coins fund buy-ins. Top up before joining stake tables; "
        "practice rooms usually do not require a balance."
    ),
}

# Longest-prefix wins — keep ordered by specificity when matching.
PATH_RULES: tuple[tuple[str, str], ...] = (
    ("/underground", "underground"),
    ("/sports-lounge", "sports"),
    ("/dashboard", "hub"),
    ("/dashboard-volumetric", "hub"),
    ("/hungryvibes", "food"),
    ("/hungry-vibes", "food"),
    ("/restaurants", "food"),
    ("/vibe-ridez", "rides"),
    ("/vibe-drive", "rides"),
    ("/dating", "dating"),
    ("/matches", "dating"),
    ("/just-for-the-night", "dating"),
    ("/jftn", "dating"),
    ("/streaming", "streaming"),
    ("/streamer", "streaming"),
    ("/dsg-tv", "streaming"),
    ("/vibe-tv", "streaming"),
    ("/cinema", "streaming"),
    ("/cinema-room", "streaming"),
    ("/free-tv", "streaming"),
    ("/games", "gaming"),
    ("/practice", "gaming"),
    ("/spades", "gaming"),
    ("/bid-whist", "gaming"),
    ("/dominoes", "gaming"),
    ("/hearts", "gaming"),
    ("/euchre", "gaming"),
    ("/pinochle", "gaming"),
    ("/uno", "gaming"),
    ("/war", "gaming"),
    ("/go-fish", "gaming"),
    ("/crazy-eights", "gaming"),
    ("/gin-rummy", "gaming"),
    ("/rummy", "gaming"),
    ("/casino", "gaming"),
    ("/chess", "gaming"),
    ("/checkers", "gaming"),
    ("/vibez-654", "gaming"),
    ("/three-card", "gaming"),
    ("/wallet", "hub"),
)

# Known friction points the guide can surface (path prefix → issues).
KNOWN_ISSUES: Dict[str, List[str]] = {
    "/": [
        "Portrait phones often hide the hand under the fold — rotate to landscape or tap Rotate phone.",
        "Casino / table stakes usually require ≥ 50 ₵ and a signed-in session (Demo Login works).",
        "If a route 404s after a deploy, hard-refresh; soft-mounted games appear in /api/admin/route-registry.",
    ],
    "/spades": [
        "If bidding never appears, wait for the review countdown or tap Bid Now.",
        "Landscape keeps the fan and table on one screen — use the Rotate phone control if needed.",
    ],
    "/bid-whist": [
        "Kitty exchange only opens for the bid winner — others wait.",
        "Boston / Big Boston asks for an extra confirm before submitting.",
    ],
    "/dominoes": [
        "Empty chain means lead with the highest double when you have it.",
        "Sitting-table view uses perspective — if tiles look tiny, rotate to landscape.",
    ],
    "/practice/play/pool": [
        "Closer overhead view is intentional so ball numbers stay readable.",
    ],
    "/practice/play/bowling": [
        "Ground-lane view puts the ball near you and pins down-range.",
    ],
    "/cinema-room": [
        "Third-party free TV (Tubi/Pluto stubs) were removed; use Cinema Room or DSG TV.",
    ],
    "/free-tv": [
        "This path redirects to /cinema-room — free-TV network catalogs are purged.",
    ],
}


def resolve_room_key(room: str, path: Optional[str] = None) -> str:
    raw = (room or "").strip().lower()
    if raw in HINTS:
        return raw

    candidate = (path or room or "").strip().lower()
    if not candidate:
        return "default"

    aliases = {
        "game": "gaming",
        "games": "gaming",
        "casino": "gaming",
        "stream": "streaming",
        "live": "streaming",
        "date": "dating",
        "social": "dating",
        "ride": "rides",
        "ridez": "rides",
        "food": "food",
        "hungry": "food",
        "home": "hub",
        "lobby": "hub",
    }
    if raw in aliases:
        return aliases[raw]

    path_only = candidate.split("?", 1)[0]
    if not path_only.startswith("/"):
        path_only = f"/{path_only}"

    rules = sorted(PATH_RULES, key=lambda r: len(r[0]), reverse=True)
    for prefix, key in rules:
        if path_only == prefix or path_only.startswith(prefix + "/"):
            return key
    return "default"


def _normalize_path(path: Optional[str], room: str) -> str:
    candidate = (path or room or "").strip().lower().split("?", 1)[0]
    if not candidate:
        return "/"
    if not candidate.startswith("/"):
        candidate = f"/{candidate}"
    return candidate


def resolve_path_hint(path: str) -> Optional[str]:
    rules = sorted(PATH_HINTS.items(), key=lambda r: len(r[0]), reverse=True)
    for prefix, hint in rules:
        if path == prefix or path.startswith(prefix + "/"):
            return hint
    return None


def collect_known_issues(path: str) -> List[str]:
    issues: List[str] = []
    # Always include global baseline once.
    issues.extend(KNOWN_ISSUES.get("/", []))
    rules = sorted(
        ((k, v) for k, v in KNOWN_ISSUES.items() if k != "/"),
        key=lambda r: len(r[0]),
        reverse=True,
    )
    for prefix, items in rules:
        if path == prefix or path.startswith(prefix + "/"):
            issues.extend(items)
            break
    # Dedupe while preserving order.
    seen = set()
    out: List[str] = []
    for item in issues:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out[:5]


def build_tips(path: str, diagnostics: Optional[Dict[str, Any]]) -> List[str]:
    tips: List[str] = []
    diag = diagnostics or {}
    orient = str(diag.get("orientation") or "").lower()
    forced = bool(diag.get("force_landscape"))
    vw = diag.get("viewport_w")
    vh = diag.get("viewport_h")
    auth = diag.get("authenticated")

    is_game = any(
        path.startswith(p)
        for p in (
            "/spades",
            "/bid-whist",
            "/hearts",
            "/euchre",
            "/pinochle",
            "/dominoes",
            "/uno",
            "/games",
            "/practice",
            "/casino",
            "/chess",
            "/checkers",
        )
    )

    if is_game and orient == "portrait" and not forced:
        tips.append(
            "You're in portrait — turn the phone sideways, or tap the amber "
            "Rotate phone control (top-right) to force landscape."
        )
    if forced:
        tips.append(
            "Forced landscape is ON. Tap Forced landscape · Tap to exit when you want normal orientation back."
        )
    if isinstance(vh, (int, float)) and isinstance(vw, (int, float)) and vh < 520 and vw > vh:
        tips.append(
            "Short landscape viewport detected — HUD and hand shrink automatically so cards stay visible."
        )
    if auth is False and is_game:
        tips.append(
            "Not signed in — use Demo Login from the auth screen if a table asks for a session."
        )
    if path.startswith("/practice"):
        tips.append("Practice mode is no-stakes — great for learning before live buy-ins.")
    if not tips and is_game:
        tips.append("Use Quick Access (⋯) for voice, orientation, and room tools without leaving the table.")
    return tips[:4]


class Diagnostics(BaseModel):
    viewport_w: Optional[int] = None
    viewport_h: Optional[int] = None
    orientation: Optional[str] = None
    force_landscape: Optional[bool] = None
    authenticated: Optional[bool] = None


class RoomContext(BaseModel):
    room: str = Field(..., description="Category id or path segment")
    path: Optional[str] = Field(None, description="Optional full pathname for finer matching")
    diagnostics: Optional[Diagnostics] = None


@router.post("/guide-hint")
async def get_guide_hint(context: RoomContext) -> Dict[str, Any]:
    path = _normalize_path(context.path, context.room)
    key = resolve_room_key(context.room, path)
    path_hint = resolve_path_hint(path)
    source = "path" if path_hint else ("catalog" if key in HINTS else "default")
    hint = path_hint or HINTS.get(key, HINTS["default"])
    diag_dict = context.diagnostics.model_dump() if context.diagnostics else {}
    return {
        "hint": hint,
        "room": key,
        "path": path,
        "source": source,
        "tips": build_tips(path, diag_dict),
        "known_issues": collect_known_issues(path),
    }
