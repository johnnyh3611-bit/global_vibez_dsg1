"""
Shared chair counters — small pure DB-read utilities used by both
`routes/chairs.py` and `routes/apex_evolution.py`.

Why this module exists
----------------------
A circular dependency previously existed:
  routes/chairs.py            ↔  routes/apex_evolution.py
  (`_total_chairs_sold`)         (`apex_state_for_phase`)
…masked by lazy `from … import …` calls inside functions.

Static analyzers correctly flagged the cycle. Extracting the smallest
pure-data reader into this neutral module breaks the loop without
forcing a larger refactor: now both routers import _total_chairs_sold
from here, and only chairs.py needs apex_state_for_phase (no longer
the other way around).
"""
from __future__ import annotations

from typing import Any


async def total_chairs_sold(db: Any) -> int:
    """Return the global chairs-sold counter as an int.

    Reads `profit_share_counters._id == "global_chairs"`. Returns 0 if
    the document hasn't been seeded yet (so a fresh deploy doesn't crash).
    """
    rec = await db.profit_share_counters.find_one(
        {"_id": "global_chairs"}, {"_id": 0, "count": 1}
    ) or {}
    return int(rec.get("count") or 0)


__all__ = ["total_chairs_sold"]
