"""
Cultural Onboarding — Detailed Dating Portal Onboarding (v2.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md

Captures the 4 cultural-context categories required for "200% compatibility":

  1. Origin & Current Vibe  — home country / current country (travelers)
  2. Linguistic Range       — fluent + learning languages
  3. Dialect Selection      — for English & Spanish only
  4. Cultural Values Filter — traditions / dietary / etiquette (opt-in)

Persists to MongoDB user_metadata.cultural_profile.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class CulturalProfile:
    user_id: str
    home_country: Optional[str] = None
    current_country: Optional[str] = None
    languages_fluent: List[str] = field(default_factory=list)
    languages_learning: List[str] = field(default_factory=list)
    english_dialect: Optional[str] = None        # e.g. "en-US"
    spanish_dialect: Optional[str] = None        # e.g. "es-MX"
    cultural_values: Dict[str, Any] = field(default_factory=dict)
    completed_steps: List[str] = field(default_factory=list)
    updated_at: str = ""

    def to_doc(self) -> Dict[str, Any]:
        return asdict(self)


CANONICAL_STEPS = [
    "origin_and_vibe",
    "linguistic_range",
    "dialect_selection",
    "cultural_values",
]


def is_complete(profile: CulturalProfile) -> bool:
    """Match feed unlocks only after all 4 cultural categories are answered."""
    return all(s in profile.completed_steps for s in CANONICAL_STEPS)


def merge_step(
    profile: CulturalProfile, step: str, payload: Dict[str, Any],
) -> CulturalProfile:
    """Apply a step submission onto an existing profile (idempotent)."""
    if step not in CANONICAL_STEPS:
        raise ValueError(f"unknown step: {step!r}")

    if step == "origin_and_vibe":
        profile.home_country = (payload.get("home_country") or "").upper() or None
        profile.current_country = (payload.get("current_country") or "").upper() or None
    elif step == "linguistic_range":
        profile.languages_fluent = [
            l.lower().strip() for l in (payload.get("fluent") or []) if l
        ]
        profile.languages_learning = [
            l.lower().strip() for l in (payload.get("learning") or []) if l
        ]
    elif step == "dialect_selection":
        profile.english_dialect = payload.get("english_dialect") or None
        profile.spanish_dialect = payload.get("spanish_dialect") or None
    elif step == "cultural_values":
        cv = payload.get("cultural_values") or {}
        # opt-in fields only — never coerce
        profile.cultural_values = {
            "traditions": list(cv.get("traditions") or []),
            "dietary": list(cv.get("dietary") or []),
            "social_etiquette": cv.get("social_etiquette") or None,
        }

    if step not in profile.completed_steps:
        profile.completed_steps.append(step)
    profile.updated_at = datetime.now(timezone.utc).isoformat()
    return profile


__all__ = [
    "CulturalProfile", "CANONICAL_STEPS",
    "is_complete", "merge_step",
]
