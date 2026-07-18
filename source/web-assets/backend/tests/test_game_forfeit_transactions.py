"""Ensure forfeit settlement uses Mongo sessions / transactions."""

from __future__ import annotations

import ast
from pathlib import Path

_FORFEIT = Path(__file__).resolve().parents[1] / "utils" / "game_forfeit.py"


def test_game_forfeit_uses_start_session_and_with_transaction():
    src = _FORFEIT.read_text()
    assert "start_session()" in src
    assert "with_transaction" in src
    assert "get_client" in src


def test_apply_quitter_penalty_defines_session_aware_apply():
    """The inner _apply(session) must exist so writes can take session=."""
    tree = ast.parse(_FORFEIT.read_text())
    found = False
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "apply_quitter_penalty":
            for child in ast.walk(node):
                if isinstance(child, ast.AsyncFunctionDef) and child.name == "_apply":
                    found = True
    assert found, "apply_quitter_penalty must define async _apply for transactional writes"
