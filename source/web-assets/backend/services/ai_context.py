"""
Standard AI context packet injected into every gateway request.

Shape:
  {
    user_id: str,
    balance: float|int,
    mode: "game"|"date"|"live"|"earn",
    room_id: str|None,
    beta_flags: dict,
  }
"""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field

AiMode = Literal["game", "date", "live", "earn"]


class AiContextPacket(BaseModel):
    user_id: str = Field(default="anonymous", max_length=128)
    balance: float = Field(default=0, ge=0)
    mode: AiMode = "game"
    room_id: Optional[str] = Field(default=None, max_length=128)
    beta_flags: Dict[str, Any] = Field(default_factory=dict)

    def as_prompt_block(self) -> str:
        room = self.room_id or "none"
        flags = ", ".join(f"{k}={v}" for k, v in sorted(self.beta_flags.items())) or "none"
        return (
            f"[context user_id={self.user_id} balance={self.balance} "
            f"mode={self.mode} room_id={room} beta_flags={flags}]"
        )


def normalize_context(raw: Optional[Dict[str, Any]], *, user_id: Optional[str] = None) -> AiContextPacket:
    data = dict(raw or {})
    if user_id and not data.get("user_id"):
        data["user_id"] = user_id
    mode = str(data.get("mode") or "game").lower().strip()
    if mode not in ("game", "date", "live", "earn"):
        # map common aliases
        aliases = {
            "gaming": "game",
            "play": "game",
            "dating": "date",
            "streaming": "live",
            "watch": "live",
            "earning": "earn",
            "wallet": "earn",
        }
        mode = aliases.get(mode, "game")
        data["mode"] = mode
    try:
        return AiContextPacket.model_validate(data)
    except Exception:
        return AiContextPacket(user_id=str(user_id or data.get("user_id") or "anonymous"))
