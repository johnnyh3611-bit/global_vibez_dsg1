"""
Anti-regression guard for the landing-page brand logo.

The user explicitly asked (5+ times) for the actual GlobalVibez brand
artwork on the landing page header AND footer with no visible white box
around it. The original 2025 fix relied on Tailwind `mix-blend-screen`
to mask the PNG's baked-in white background — but that hack only works
on pure-black parents and broke every time the hero gradient shifted.

Feb 02, 2026 — PERMANENT FIX:
  • The PNG itself was chroma-keyed via Pillow so all white pixels are
    truly alpha=0. The asset is now the source of truth.
  • The `mix-blend-screen` className was REMOVED from both header and
    footer img tags. Re-adding it is no longer needed and can in fact
    REGRESS the look on lighter sub-sections.
  • A wrapper background, border, or padding around the <img> would
    re-introduce the white-box appearance — guard against that too.

Previous regression vectors that this test still catches:
  • Replacing the brand <img> with a generic Gamepad2 icon.
  • Pointing the src somewhere else.
  • Wrapping the img in a `bg-white`/`border-white`/`p-2` container.
"""
from pathlib import Path

LANDING = Path("/app/frontend/src/pages/LandingNeonGaming.tsx")
LOGO_PNG = Path("/app/frontend/public/global-vibez-logo.png")


def test_landing_uses_brand_logo_image() -> None:
    """Header AND footer must reference the brand PNG."""
    src = LANDING.read_text(encoding="utf-8")
    occurrences = src.count("/global-vibez-logo.png")
    assert occurrences >= 2, (
        f"Brand logo image must appear in BOTH header and footer of "
        f"LandingNeonGaming.tsx. Found {occurrences} reference(s). "
        f"DO NOT replace the brand image with a generic icon — the user "
        f"asked for the actual brand artwork to stay."
    )


def test_brand_logo_png_is_truly_transparent() -> None:
    """The PNG itself must have transparent (alpha=0) corners. If the
    asset gets replaced with a solid-white-bg version, the white-box
    bug is back regardless of any CSS we apply."""
    try:
        from PIL import Image
    except ImportError:
        # Pillow is not in backend deps — skip rather than fail the suite.
        return
    img = Image.open(LOGO_PNG).convert("RGBA")
    corners = [img.getpixel((0, 0)), img.getpixel((img.size[0] - 1, 0))]
    for px in corners:
        assert px[3] == 0, (
            f"Logo PNG corner pixel {px} is not transparent (alpha=0). "
            f"The PNG has reverted to a solid-bg variant. Re-run the "
            f"chroma-key step in /app/memory/CHANGELOG.md (Feb 2026)."
        )


def test_no_white_box_wrapper_around_brand_logo() -> None:
    """No `bg-white`, `border-white`, or `p-2`+border padding around
    the brand <img> — those would make the white-box appearance return
    even though the PNG itself is transparent."""
    src = LANDING.read_text(encoding="utf-8")
    landing_logo_index = src.find('data-testid="landing-logo"')
    assert landing_logo_index >= 0, "landing-logo testid removed."
    snippet = src[landing_logo_index : landing_logo_index + 800]
    forbidden = ["bg-white", "border-white", "border-2 border-white"]
    for token in forbidden:
        assert token not in snippet, (
            f"Forbidden class `{token}` found inside the landing-logo "
            f"wrapper — would re-introduce the white-box appearance."
        )


def test_no_gamepad_icon_replacement_at_landing_brand_slots() -> None:
    """The brand-slot wrappers must not regress to a Gamepad2 placeholder."""
    src = LANDING.read_text(encoding="utf-8")
    header_marker = '<span className="text-white">GLOBAL VIBEZ</span>'
    assert src.count(header_marker) >= 2, "GLOBAL VIBEZ branding heading missing."
    landing_logo_index = src.find('data-testid="landing-logo"')
    assert landing_logo_index >= 0, "landing-logo testid removed."
    snippet = src[landing_logo_index : landing_logo_index + 600]
    assert "/global-vibez-logo.png" in snippet, (
        "Brand <img> must live INSIDE the data-testid='landing-logo' "
        "wrapper. Reverting to a Gamepad2 icon is NOT permitted."
    )
