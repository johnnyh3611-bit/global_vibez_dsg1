"""
Locked-Spec Integrity — v8.0 (GISA + International + Marketing OneSheet).

Source PDFs uploaded 2026-02-16 — these specs MUST persist verbatim.
"""
from __future__ import annotations

import os


SPEC_DIR = "/app/memory/locked_specs"


def _read(name: str) -> str:
    with open(os.path.join(SPEC_DIR, name), encoding="utf-8") as f:
        return f.read()


def test_v7_omni_blueprint_still_present() -> None:
    body = _read("v7_OMNI_BLUEPRINT.md")
    assert "Omni-Blueprint v7.0" in body
    assert "70/30" in body
    assert "PRICING_TIERS" in body


def test_v8_gisa_audit_blueprint_locked() -> None:
    body = _read("v8_GISA_AUDIT_BLUEPRINT.md")
    assert "GLOBAL INTEGRITY & STRESS AGENT" in body or "Global Integrity & Stress Agent" in body
    assert "Concurrency" in body
    assert "1,000,000" in body
    assert "5654 Vibe" in body
    assert "GlobalVibezAuditor" in body
    assert "/api/v1/ledger/validate" in body


def test_v8_international_logic_locked() -> None:
    body = _read("v8_INTERNATIONAL_LOGIC.md")
    assert "Three-Tier Localization Trigger" in body
    assert "Auto-Sync" in body
    assert "Globe Overlay" in body
    assert "Deep Persistence" in body
    assert "globalVibeSync" in body
    assert "200% global fit" in body or "200% Global Fit" in body
    assert "Origin & Current Vibe" in body
    assert "Linguistic Range" in body
    assert "Dialect Selection" in body
    assert "Cultural Values Filter" in body


def test_v8_marketing_onesheet_locked() -> None:
    body = _read("v8_MARKETING_ONESHEET.md")
    assert "THE WORLD'S FIRST SOCIAL INFRASTRUCTURE NETWORK" in body
    assert "LOCK IN YOUR VIBE" in body
    assert "70/30 Revolution" in body
    assert "98% synergy logic" in body
    assert "1,000,000 Chairs" in body
    assert "Genius Phase" in body
    assert "Vibe Yellow Pages" in body
    assert "Cinema Dates" in body
