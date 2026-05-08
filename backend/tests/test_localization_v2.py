"""
Tests for International Globalization Protocol v2.0 (LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md
"""
from __future__ import annotations

import pytest

from services.localization import (
    COUNTRIES, LANGUAGES,
    detect_locale, build_payload_from_selection,
    list_countries, list_languages,
)


def test_country_matrix_locked_minimum() -> None:
    """All canonical countries from spec must be present."""
    must_have = {"US", "GB", "JP", "MX", "ES", "BR", "IN", "AU", "DE", "FR"}
    assert must_have.issubset(set(COUNTRIES.keys()))


def test_japan_default_is_metric_yen_japanese() -> None:
    """Spec example: Tokyo user → Japanese / ¥ Yen / Metric."""
    p = COUNTRIES["JP"]
    assert p.default_language == "ja"
    assert p.currency == "JPY"
    assert p.currency_symbol == "¥"
    assert p.unit_system == "metric"


def test_us_default_is_imperial_usd_english() -> None:
    p = COUNTRIES["US"]
    assert p.default_language == "en"
    assert p.currency == "USD"
    assert p.unit_system == "imperial"


def test_english_dialects_include_required_regions() -> None:
    """Spec mentions UK, USA, Caribbean, Aussie, South Africa, Indian dialects."""
    en = LANGUAGES["en"]
    must_have = {"en-US", "en-GB", "en-AU", "en-IN", "en-JM", "en-ZA"}
    assert must_have.issubset(set(en.dialects))


def test_spanish_dialects_include_required_regions() -> None:
    """Spec: Mexico vs. Spain vs. Argentina."""
    es = LANGUAGES["es"]
    must_have = {"es-MX", "es-ES", "es-AR"}
    assert must_have.issubset(set(es.dialects))


def test_tier1_autosync_tokyo() -> None:
    """Spec example — Tokyo IP + JA accept-language → Japanese / Yen / metric."""
    payload = detect_locale(accept_language="ja-JP", cf_country="JP")
    assert payload.locale_code == "ja-JP"
    assert payload.currency == "JPY"
    assert payload.unit_system == "metric"
    assert payload.auto_synced is True


def test_tier1_autosync_unknown_country_falls_back_to_us() -> None:
    payload = detect_locale(accept_language=None, cf_country="ZZ")
    assert payload.country_code == "US"
    assert payload.unit_system == "imperial"


def test_tier2_manual_selection_us_to_mx() -> None:
    """User picks Mexico → Spanish (es-MX) / MXN / metric."""
    payload = build_payload_from_selection(country_code="MX")
    assert payload.country_code == "MX"
    assert payload.language_code == "es"
    assert payload.locale_code == "es-MX"
    assert payload.currency == "MXN"
    assert payload.unit_system == "metric"
    assert payload.auto_synced is False


def test_tier2_manual_dialect_override() -> None:
    """User picks UK → English en-GB → £."""
    payload = build_payload_from_selection(
        country_code="GB", language_code="en", dialect="en-GB",
    )
    assert payload.locale_code == "en-GB"
    assert payload.currency == "GBP"


def test_tier2_unknown_country_raises() -> None:
    with pytest.raises(ValueError):
        build_payload_from_selection(country_code="ZZ")


def test_list_countries_returns_full_matrix() -> None:
    out = list_countries()
    assert len(out) >= 28
    sample = out[0]
    assert {"code", "name", "flag", "currency", "unit_system"}.issubset(sample.keys())


def test_list_languages_includes_dialects() -> None:
    langs = list_languages()
    en = next(l for l in langs if l["code"] == "en")
    assert "en-US" in en["dialects"]
    assert "en-GB" in en["dialects"]
