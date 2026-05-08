"""
Custom inline emoji manifest for Global Vibez chat.

Syntax in message text:  `:vibez_fire:` → replaced with <img> at render time.

Reserved code namespace:
  vibez_*     — branded
  coin_*      — economy icons
  table_*     — game-specific reactions
"""

MANIFEST = {
    # Branded
    "vibez_fire":     {"label": "Vibez Fire",     "premium": False, "unicode_fallback": "🔥"},
    "vibez_crown":    {"label": "Vibez Crown",    "premium": True,  "unicode_fallback": "👑"},
    "vibez_dice":     {"label": "Vibez Dice",     "premium": False, "unicode_fallback": "🎲"},
    "vibez_coin":     {"label": "Vibez Coin",     "premium": False, "unicode_fallback": "🪙"},
    "vibez_lightning":{"label": "Lightning",      "premium": False, "unicode_fallback": "⚡"},

    # Premium-only
    "solar_flare":    {"label": "Solar Flare",    "premium": True,  "unicode_fallback": "☀️"},
    "glass_whist":    {"label": "Glasshouse",     "premium": True,  "unicode_fallback": "💎"},
    "nova_dealer":    {"label": "Nova Dealer",    "premium": True,  "unicode_fallback": "✨"},

    # Universal reactions
    "bid_win":        {"label": "Bid Won",        "premium": False, "unicode_fallback": "🎯"},
    "trick_take":     {"label": "Trick Take",     "premium": False, "unicode_fallback": "🃏"},
    "all_in":         {"label": "All-In",         "premium": False, "unicode_fallback": "🚀"},
    "knock":          {"label": "Knock",          "premium": False, "unicode_fallback": "🚪"},
}


def get_manifest(include_premium: bool = True) -> dict:
    if include_premium:
        return MANIFEST
    return {k: v for k, v in MANIFEST.items() if not v["premium"]}


def is_valid_code(code: str) -> bool:
    return code in MANIFEST
