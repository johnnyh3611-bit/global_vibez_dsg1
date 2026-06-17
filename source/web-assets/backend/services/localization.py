"""
Localization — Three-Tier Localization Trigger (v2.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md

This module owns the canonical country / language / dialect / currency /
unit-system matrix for the 200% global fit goal:

  Tier 1: Auto-Sync       — IP + System Language detection
  Tier 2: Globe Overlay   — Cultural Hub manual override
  Tier 3: Deep Persistence — MongoDB user_metadata.localization

The 31 game rooms + AI Dealer never revert to the wrong language.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional


UnitSystem = Literal["imperial", "metric"]


# ──────────────────────────────────────────────────────────────────────────
# Country profile matrix (LOCKED)
# Country → default language code, currency, unit_system, supported dialects
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class CountryProfile:
    code: str            # ISO-3166-1 alpha-2 (e.g. "US")
    name: str
    flag: str            # emoji
    default_language: str  # ISO-639-1 (e.g. "en")
    default_dialect: Optional[str]  # locale (e.g. "en-US")
    currency: str        # ISO-4217 (e.g. "USD")
    currency_symbol: str
    unit_system: UnitSystem


COUNTRIES: Dict[str, CountryProfile] = {
    "US": CountryProfile("US", "United States",  "🇺🇸", "en", "en-US", "USD", "$", "imperial"),
    "GB": CountryProfile("GB", "United Kingdom", "🇬🇧", "en", "en-GB", "GBP", "£", "metric"),
    "CA": CountryProfile("CA", "Canada",         "🇨🇦", "en", "en-CA", "CAD", "C$", "metric"),
    "AU": CountryProfile("AU", "Australia",      "🇦🇺", "en", "en-AU", "AUD", "A$", "metric"),
    "JM": CountryProfile("JM", "Jamaica",        "🇯🇲", "en", "en-JM", "JMD", "J$", "metric"),
    "ZA": CountryProfile("ZA", "South Africa",   "🇿🇦", "en", "en-ZA", "ZAR", "R",  "metric"),
    "IN": CountryProfile("IN", "India",          "🇮🇳", "en", "en-IN", "INR", "₹",  "metric"),
    "MX": CountryProfile("MX", "Mexico",         "🇲🇽", "es", "es-MX", "MXN", "Mex$", "metric"),
    "ES": CountryProfile("ES", "Spain",          "🇪🇸", "es", "es-ES", "EUR", "€",  "metric"),
    "AR": CountryProfile("AR", "Argentina",      "🇦🇷", "es", "es-AR", "ARS", "AR$", "metric"),
    "CO": CountryProfile("CO", "Colombia",       "🇨🇴", "es", "es-CO", "COP", "Col$", "metric"),
    "FR": CountryProfile("FR", "France",         "🇫🇷", "fr", "fr-FR", "EUR", "€",  "metric"),
    "DE": CountryProfile("DE", "Germany",        "🇩🇪", "de", "de-DE", "EUR", "€",  "metric"),
    "IT": CountryProfile("IT", "Italy",          "🇮🇹", "it", "it-IT", "EUR", "€",  "metric"),
    "PT": CountryProfile("PT", "Portugal",       "🇵🇹", "pt", "pt-PT", "EUR", "€",  "metric"),
    "BR": CountryProfile("BR", "Brazil",         "🇧🇷", "pt", "pt-BR", "BRL", "R$", "metric"),
    "JP": CountryProfile("JP", "Japan",          "🇯🇵", "ja", "ja-JP", "JPY", "¥",  "metric"),
    "KR": CountryProfile("KR", "South Korea",    "🇰🇷", "ko", "ko-KR", "KRW", "₩",  "metric"),
    "CN": CountryProfile("CN", "China",          "🇨🇳", "zh", "zh-CN", "CNY", "¥",  "metric"),
    "TW": CountryProfile("TW", "Taiwan",         "🇹🇼", "zh", "zh-TW", "TWD", "NT$", "metric"),
    "IN_HI": CountryProfile("IN_HI", "India (Hindi)", "🇮🇳", "hi", "hi-IN", "INR", "₹", "metric"),
    "RU": CountryProfile("RU", "Russia",         "🇷🇺", "ru", "ru-RU", "RUB", "₽",  "metric"),
    "TR": CountryProfile("TR", "Turkey",         "🇹🇷", "tr", "tr-TR", "TRY", "₺",  "metric"),
    "AE": CountryProfile("AE", "UAE",            "🇦🇪", "ar", "ar-AE", "AED", "د.إ", "metric"),
    "SA": CountryProfile("SA", "Saudi Arabia",   "🇸🇦", "ar", "ar-SA", "SAR", "﷼",  "metric"),
    "NG": CountryProfile("NG", "Nigeria",        "🇳🇬", "en", "en-NG", "NGN", "₦",  "metric"),
    "KE": CountryProfile("KE", "Kenya",          "🇰🇪", "en", "en-KE", "KES", "KSh", "metric"),
    "PH": CountryProfile("PH", "Philippines",    "🇵🇭", "en", "en-PH", "PHP", "₱",  "metric"),
}


# ──────────────────────────────────────────────────────────────────────────
# Language matrix (LOCKED)
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class LanguageProfile:
    code: str           # ISO-639-1
    name: str
    native_name: str
    dialects: List[str] = field(default_factory=list)  # locale codes


LANGUAGES: Dict[str, LanguageProfile] = {
    "en": LanguageProfile("en", "English", "English", [
        "en-US", "en-GB", "en-CA", "en-AU", "en-JM", "en-ZA", "en-IN",
        "en-NG", "en-KE", "en-PH",
    ]),
    "es": LanguageProfile("es", "Spanish", "Español", [
        "es-MX", "es-ES", "es-AR", "es-CO", "es-CL", "es-PE",
    ]),
    "pt": LanguageProfile("pt", "Portuguese", "Português", ["pt-PT", "pt-BR"]),
    "fr": LanguageProfile("fr", "French", "Français", ["fr-FR", "fr-CA"]),
    "de": LanguageProfile("de", "German", "Deutsch", ["de-DE", "de-AT", "de-CH"]),
    "it": LanguageProfile("it", "Italian", "Italiano"),
    "ja": LanguageProfile("ja", "Japanese", "日本語"),
    "ko": LanguageProfile("ko", "Korean", "한국어"),
    "zh": LanguageProfile("zh", "Chinese", "中文", ["zh-CN", "zh-TW", "zh-HK"]),
    "hi": LanguageProfile("hi", "Hindi", "हिन्दी"),
    "ru": LanguageProfile("ru", "Russian", "Русский"),
    "tr": LanguageProfile("tr", "Turkish", "Türkçe"),
    "ar": LanguageProfile("ar", "Arabic", "العربية", ["ar-SA", "ar-AE", "ar-EG"]),
}


# ──────────────────────────────────────────────────────────────────────────
# Localization payload (canonical user_metadata.localization)
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class LocalizationPayload:
    country: str
    country_code: str
    language: str          # name e.g. "English"
    language_code: str     # iso e.g. "en"
    locale_code: str       # e.g. "en-US"
    dialect: Optional[str]
    currency: str
    currency_symbol: str
    unit_system: UnitSystem
    auto_synced: bool
    updated_at: str


# ──────────────────────────────────────────────────────────────────────────
# Tier-1: Auto-Sync detection
# ──────────────────────────────────────────────────────────────────────────
def detect_locale(
    *, accept_language: Optional[str] = None,
    cf_country: Optional[str] = None,
    fallback_country: str = "US",
) -> LocalizationPayload:
    """
    Tier 1 of the trigger pyramid: build a default payload from
    the request's IP-derived country (Cloudflare CF-IPCountry header)
    + the browser's Accept-Language header.

    Falls back gracefully if either header is missing.
    """
    country_code = (cf_country or "").upper().strip() or fallback_country
    if country_code not in COUNTRIES:
        country_code = fallback_country

    profile = COUNTRIES[country_code]
    lang_code = profile.default_language

    # Override language if Accept-Language header tells us otherwise.
    if accept_language:
        primary = accept_language.split(",")[0].split(";")[0].strip().lower()
        # primary may be "en-us", "ja", etc.
        prim_root = primary.split("-")[0]
        if prim_root in LANGUAGES:
            lang_code = prim_root

    lang = LANGUAGES.get(lang_code, LANGUAGES["en"])
    dialect = profile.default_dialect or f"{lang_code}-{country_code}"

    return LocalizationPayload(
        country=profile.name,
        country_code=profile.code,
        language=lang.name,
        language_code=lang.code,
        locale_code=dialect,
        dialect=dialect,
        currency=profile.currency,
        currency_symbol=profile.currency_symbol,
        unit_system=profile.unit_system,
        auto_synced=True,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


def build_payload_from_selection(
    *, country_code: str,
    language_code: Optional[str] = None,
    dialect: Optional[str] = None,
) -> LocalizationPayload:
    """Used by the Cultural Hub (Tier 2) when user picks manually.

    `language_code` accepts both base codes (e.g. "ja", "en") and full
    BCP-47 tags (e.g. "ja-JP", "en-GB"). The base is extracted for
    language lookup, and the full tag wins as the dialect/locale_code
    when no explicit `dialect` is provided.
    """
    cc = country_code.upper().strip()
    if cc not in COUNTRIES:
        raise ValueError(f"unknown country code: {cc!r}")
    profile = COUNTRIES[cc]

    # Accept either "ja" or "ja-JP" — split on hyphen.
    raw_lc = (language_code or profile.default_language).strip()
    if "-" in raw_lc:
        base_part, region_part = raw_lc.split("-", 1)
        # Normalize: lowercase base, uppercase region (per BCP-47 convention).
        raw_lc = f"{base_part.lower()}-{region_part.upper()}"
        base_lc = base_part.lower()
    else:
        raw_lc = raw_lc.lower()
        base_lc = raw_lc
    if base_lc not in LANGUAGES:
        raise ValueError(f"unknown language code: {raw_lc!r}")
    lang = LANGUAGES[base_lc]

    # Dialect priority: explicit dialect arg > full BCP-47 tag passed as
    # language_code > country default > synthesised "{base}-{country}".
    if dialect:
        chosen_dialect = dialect.strip()
    elif "-" in raw_lc:
        chosen_dialect = raw_lc
    else:
        chosen_dialect = profile.default_dialect or f"{base_lc}-{cc}"

    if lang.dialects and chosen_dialect not in lang.dialects:
        # graceful: accept anyway but note the mismatch is the caller's responsibility
        pass

    return LocalizationPayload(
        country=profile.name,
        country_code=profile.code,
        language=lang.name,
        language_code=lang.code,
        locale_code=chosen_dialect,
        dialect=chosen_dialect,
        currency=profile.currency,
        currency_symbol=profile.currency_symbol,
        unit_system=profile.unit_system,
        auto_synced=False,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


def list_countries() -> List[Dict[str, str]]:
    return [
        {
            "code": p.code, "name": p.name, "flag": p.flag,
            "default_language": p.default_language,
            "default_dialect": p.default_dialect or "",
            "currency": p.currency, "currency_symbol": p.currency_symbol,
            "unit_system": p.unit_system,
        }
        for p in COUNTRIES.values()
    ]


def list_languages() -> List[Dict[str, object]]:
    return [
        {
            "code": l.code, "name": l.name, "native_name": l.native_name,
            "dialects": list(l.dialects),
        }
        for l in LANGUAGES.values()
    ]


__all__ = [
    "UnitSystem", "CountryProfile", "LanguageProfile", "LocalizationPayload",
    "COUNTRIES", "LANGUAGES",
    "detect_locale", "build_payload_from_selection",
    "list_countries", "list_languages",
]
