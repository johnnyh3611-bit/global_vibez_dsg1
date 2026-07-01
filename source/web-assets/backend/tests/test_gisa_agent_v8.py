"""
Tests for the GISA agent (v8.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_GISA_AUDIT_BLUEPRINT.md
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import asdict

import pytest

from services.gisa_agent import (
    GISAAgent, IsolationAuditor, IsolationLeak,
    StressTestEngine, VisualParityChecker,
    THRESHOLDS, write_report,
)


def test_thresholds_locked() -> None:
    """Pass/warn thresholds match the canonical spec."""
    assert THRESHOLDS["ws_p95_ms"]["pass"] == 100
    assert THRESHOLDS["solana_tps"]["pass"] == 1500
    assert THRESHOLDS["leaks"]["pass"] == 0
    assert THRESHOLDS["vibe_parity"]["pass"] == 95.0


def test_stress_engine_runs() -> None:
    eng = StressTestEngine(target_users=50)
    result = asyncio.run(eng.simulate_betting_load())
    assert result.users_simulated == 50
    assert result.requests_sent >= 50 * 5
    assert result.solana_tx_per_sec > 0
    assert 0 < result.p95_latency() < 1000


def test_visual_parity_audits_31_plus_glasshouse() -> None:
    """Master audit covers 31 game rooms + Celestial Glasshouse."""
    checker = VisualParityChecker()
    rooms = checker.audit_all()
    assert len(rooms) == 32  # 31 + Celestial Glasshouse
    names = [r.room_name for r in rooms]
    assert "Celestial Glasshouse" in names
    assert "Spades" in names and "Bid Whist" in names


def test_isolation_auditor_handles_no_db() -> None:
    auditor = IsolationAuditor(db=None)
    leaks = asyncio.run(auditor.crawl())
    assert leaks == []


def test_full_audit_emits_all_blocks() -> None:
    """Full audit runs all 4 vectors and produces a complete report."""
    agent = GISAAgent(db=None, target_users=50)
    report = asyncio.run(agent.run_full_audit())
    assert report.mode == "full_audit"
    assert report.users_simulated == 50
    assert "status" in report.stress
    assert "status" in report.isolation
    assert "status" in report.visual
    assert report.summary["overall_status"] in ("pass", "warn", "fail")
    assert "concurrency" in report.summary["vectors_run"]
    assert "isolation" in report.summary["vectors_run"]
    assert "visual_parity" in report.summary["vectors_run"]


def test_isolation_only_skips_others() -> None:
    agent = GISAAgent(db=None, target_users=10)
    report = asyncio.run(agent.run_isolation_only())
    assert report.mode == "isolation"
    assert report.stress["status"] == "skipped"
    assert report.visual["status"] == "skipped"


def test_write_report_emits_disk_file(tmp_path) -> None:
    agent = GISAAgent(db=None, target_users=20)
    report = asyncio.run(agent.run_visual_only())
    out = tmp_path / "system_health.json"
    path = write_report(report, path=str(out))
    assert os.path.exists(path)
    with open(path) as f:
        data = json.load(f)
    assert data["mode"] == "visual"
    assert data["visual"]["audited"] == 32


def test_isolation_leak_dataclass() -> None:
    leak = IsolationLeak(
        service="gaming", collection="rides",
        field_name="ride_id", sample="r_abc",
    )
    d = asdict(leak)
    assert d["service"] == "gaming"
    assert d["collection"] == "rides"
