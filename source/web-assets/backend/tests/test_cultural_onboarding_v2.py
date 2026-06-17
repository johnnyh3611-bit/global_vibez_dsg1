"""
Tests for Cultural Onboarding (v2.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md
"""
from __future__ import annotations

import pytest

from services.cultural_onboarding import (
    CulturalProfile, CANONICAL_STEPS,
    is_complete, merge_step,
)


def _new_profile() -> CulturalProfile:
    return CulturalProfile(user_id="u_test")


def test_canonical_steps_locked() -> None:
    assert CANONICAL_STEPS == [
        "origin_and_vibe",
        "linguistic_range",
        "dialect_selection",
        "cultural_values",
    ]


def test_origin_and_vibe_step_persists() -> None:
    p = _new_profile()
    p = merge_step(p, "origin_and_vibe",
                   {"home_country": "us", "current_country": "jp"})
    assert p.home_country == "US"
    assert p.current_country == "JP"
    assert "origin_and_vibe" in p.completed_steps


def test_linguistic_range_step_normalizes_codes() -> None:
    p = _new_profile()
    p = merge_step(p, "linguistic_range",
                   {"fluent": ["EN", "Es"], "learning": ["JA"]})
    assert p.languages_fluent == ["en", "es"]
    assert p.languages_learning == ["ja"]


def test_dialect_step_locks_en_es() -> None:
    p = _new_profile()
    p = merge_step(p, "dialect_selection",
                   {"english_dialect": "en-GB", "spanish_dialect": "es-MX"})
    assert p.english_dialect == "en-GB"
    assert p.spanish_dialect == "es-MX"


def test_cultural_values_optional() -> None:
    p = _new_profile()
    p = merge_step(p, "cultural_values",
                   {"cultural_values": {
                       "traditions": ["Western"],
                       "dietary": ["Vegan"],
                       "social_etiquette": "direct",
                   }})
    assert p.cultural_values["traditions"] == ["Western"]
    assert p.cultural_values["dietary"] == ["Vegan"]
    assert p.cultural_values["social_etiquette"] == "direct"


def test_complete_only_after_all_4_steps() -> None:
    p = _new_profile()
    assert not is_complete(p)
    p = merge_step(p, "origin_and_vibe",
                   {"home_country": "US", "current_country": "US"})
    assert not is_complete(p)
    p = merge_step(p, "linguistic_range", {"fluent": ["en"]})
    p = merge_step(p, "dialect_selection", {"english_dialect": "en-US"})
    assert not is_complete(p)
    p = merge_step(p, "cultural_values", {"cultural_values": {}})
    assert is_complete(p)


def test_unknown_step_raises() -> None:
    p = _new_profile()
    with pytest.raises(ValueError):
        merge_step(p, "bogus_step", {})


def test_merge_step_idempotent_completed_list() -> None:
    p = _new_profile()
    p = merge_step(p, "origin_and_vibe",
                   {"home_country": "US", "current_country": "US"})
    p = merge_step(p, "origin_and_vibe",
                   {"home_country": "JP", "current_country": "JP"})
    assert p.completed_steps.count("origin_and_vibe") == 1
    assert p.home_country == "JP"
