"""
GISA CLI — `python gisa_agent.py --mode full_audit --users 1000000`

Source spec: /app/memory/locked_specs/v8_GISA_AUDIT_BLUEPRINT.md

Output: /app/reports/system_health.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

# Ensure backend sources resolve when run as `python gisa_agent.py`
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from services.gisa_agent import GISAAgent, write_report  # noqa: E402
from dataclasses import asdict  # noqa: E402


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="gisa_agent.py",
        description="GISA — Global Integrity & Stress Agent (pre-beta auditor)",
    )
    p.add_argument(
        "--mode",
        choices=("full_audit", "stress", "isolation", "visual"),
        default="full_audit",
        help="Which audit vectors to run",
    )
    p.add_argument(
        "--users", type=int, default=1000,
        help="Simulated user count for the stress vector (max 1,000,000)",
    )
    p.add_argument(
        "--out", default="/app/reports/system_health.json",
        help="Path for the JSON report",
    )
    return p


async def _amain(args: argparse.Namespace) -> int:
    db = None  # CLI runs without a live mongo connection by default
    try:
        from utils.database import get_database, initialize_database
        from config.settings import MONGO_URL, DB_NAME
        initialize_database(MONGO_URL, DB_NAME)
        db = get_database()
    except Exception as e:
        print(f"[gisa] DB unavailable, isolation crawl will be skipped ({e!s})")

    agent = GISAAgent(db=db, target_users=int(args.users))
    if args.mode == "full_audit":
        report = await agent.run_full_audit()
    elif args.mode == "stress":
        report = await agent.run_stress_only()
    elif args.mode == "isolation":
        report = await agent.run_isolation_only()
    else:
        report = await agent.run_visual_only()

    path = write_report(report, path=args.out)
    print(json.dumps({
        "ok": True,
        "mode": report.mode,
        "overall": report.summary["overall_status"],
        "report_written_to": path,
    }, indent=2))
    return 0 if report.summary["overall_status"] != "fail" else 1


def main() -> int:
    args = _build_parser().parse_args()
    return asyncio.run(_amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
