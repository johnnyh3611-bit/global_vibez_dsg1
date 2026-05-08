from pydantic import BaseModel
from typing import Optional


class TranslateRequest(BaseModel):
    text: str
    target_language: Optional[str] = None  # If None, auto-detect and translate to English
