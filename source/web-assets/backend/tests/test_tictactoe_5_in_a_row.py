"""
Tic Tac Toe — Five in a Row engine tests (LOCKED 2026-02-16).

Founder directive: 12×12 board, win on 5-in-a-row.
"""
from __future__ import annotations

import pytest

from services.games.tictactoe import (
    BOARD_SIZE, WIN_LENGTH,
    create_tictactoe_game, make_tictactoe_move, tictactoe_games,
    _detect_winning_line,
    _empty_board,
)


@pytest.fixture(autouse=True)
def _clear_games():
    tictactoe_games.clear()
    yield
    tictactoe_games.clear()


def test_canonical_constants_locked() -> None:
    """Board is 12×12 and win line is 5."""
    assert BOARD_SIZE == 12
    assert WIN_LENGTH == 5


def test_initial_board_shape() -> None:
    g = create_tictactoe_game("RC1", "host", "guest")
    assert len(g["board"]) == BOARD_SIZE
    assert all(len(row) == BOARD_SIZE for row in g["board"])
    assert g["board_size"] == BOARD_SIZE
    assert g["win_length"] == WIN_LENGTH
    assert g["current_player"] == "X"
    assert g["winner"] is None
    assert g["winning_line"] is None


def test_horizontal_win_5_in_a_row() -> None:
    create_tictactoe_game("RC2", "host", "guest")
    # X plays first, alternating with O. Build 5 X in row 5 cols 0..4.
    moves = [
        ("host",  5, 0),  # X
        ("guest", 0, 0),  # O somewhere safe
        ("host",  5, 1),  # X
        ("guest", 0, 1),
        ("host",  5, 2),  # X
        ("guest", 0, 2),
        ("host",  5, 3),  # X
        ("guest", 0, 3),
        ("host",  5, 4),  # X — fifth in a row, should win
    ]
    last = None
    for pid, r, c in moves:
        last = make_tictactoe_move("RC2", pid, r, c)
        assert last is not None, f"Move {pid} {r},{c} rejected"
    assert last["winner"] == "X"
    assert last["game_over"] is True
    assert last["winning_line"] == [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4]]


def test_diagonal_win_5_in_a_row() -> None:
    create_tictactoe_game("RC3", "host", "guest")
    # X builds main diagonal (0,0)-(4,4).
    moves = [
        ("host",  0, 0),  # X
        ("guest", 0, 6),
        ("host",  1, 1),  # X
        ("guest", 0, 7),
        ("host",  2, 2),  # X
        ("guest", 0, 8),
        ("host",  3, 3),  # X
        ("guest", 0, 9),
        ("host",  4, 4),  # X — fifth, win
    ]
    last = None
    for pid, r, c in moves:
        last = make_tictactoe_move("RC3", pid, r, c)
    assert last["winner"] == "X"
    assert last["winning_line"] == [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]


def test_anti_diagonal_win_5_in_a_row() -> None:
    create_tictactoe_game("RC4", "host", "guest")
    # X builds anti-diagonal (0,4)-(4,0).
    moves = [
        ("host",  0, 4),
        ("guest", 11, 11),
        ("host",  1, 3),
        ("guest", 11, 10),
        ("host",  2, 2),
        ("guest", 11, 9),
        ("host",  3, 1),
        ("guest", 11, 8),
        ("host",  4, 0),  # X wins
    ]
    last = None
    for pid, r, c in moves:
        last = make_tictactoe_move("RC4", pid, r, c)
    assert last["winner"] == "X"
    assert last["winning_line"] == [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]]


def test_4_in_a_row_does_NOT_win() -> None:
    """Sanity — 4 in a row must not declare a winner."""
    create_tictactoe_game("RC5", "host", "guest")
    moves = [
        ("host",  5, 0),
        ("guest", 0, 0),
        ("host",  5, 1),
        ("guest", 0, 1),
        ("host",  5, 2),
        ("guest", 0, 2),
        ("host",  5, 3),  # 4 in a row but not 5
    ]
    last = None
    for pid, r, c in moves:
        last = make_tictactoe_move("RC5", pid, r, c)
    assert last["winner"] is None
    assert last["game_over"] is False


def test_invalid_position_rejected() -> None:
    create_tictactoe_game("RC6", "host", "guest")
    # Off-board moves return None
    assert make_tictactoe_move("RC6", "host", -1, 0) is None
    assert make_tictactoe_move("RC6", "host", BOARD_SIZE, 0) is None
    assert make_tictactoe_move("RC6", "host", 0, BOARD_SIZE) is None


def test_cannot_play_on_taken_cell() -> None:
    create_tictactoe_game("RC7", "host", "guest")
    make_tictactoe_move("RC7", "host", 6, 6)
    # O tries the same cell
    assert make_tictactoe_move("RC7", "guest", 6, 6) is None


def test_turn_enforcement() -> None:
    create_tictactoe_game("RC8", "host", "guest")
    # O playing first is rejected
    assert make_tictactoe_move("RC8", "guest", 0, 0) is None


def test_detect_winning_line_lowlevel() -> None:
    board = _empty_board()
    for c in range(5):
        board[3][c] = "X"
    line = _detect_winning_line(board, 3, 4)
    assert line == [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]]
