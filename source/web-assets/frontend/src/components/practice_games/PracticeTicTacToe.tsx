import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicCelebration } from '@/components/CinematicCelebration';
import { useWindowSize } from 'react-use';
import { BoardGameLayout, BoardStatBadge } from './BoardGameLayout';
import { TableSelectorButton } from './TableSelectorButton';
import { AIOpponentCard } from '@/components/AIOpponentCard';
import { getRandomOpponent } from '@/data/aiOpponents';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

/**
 * Tic-Tac-Toe on an extended 12×12 board — official "Five in a Row" ruleset
 * (LOCKED 2026-02-16 per founder directive). The larger canvas gives
 * players room to build threats, and the longer win line removes the
 * forced-draw problem of classic 3×3. Client-side only: moves + win
 * detection + AI happen in-component; the parent's `onMove` is still
 * called for telemetry/score compat.
 */
const BOARD_SIZE = 12;
const WIN_LENGTH = 5;
const EMPTY: '' = '';
type Mark = '' | 'X' | 'O';

const createEmpty = (): Mark[][] =>
  Array.from({ length: BOARD_SIZE }, () => Array<Mark>(BOARD_SIZE).fill(EMPTY));

/**
 * Check every 3-in-a-row line touching (r,c). Returns { winner, cells } or null.
 * 4 directions × 2 orientations, O(1) hit check per placed mark.
 */
const detectWinAt = (board: Mark[][], r: number, c: number): { winner: Mark; cells: [number, number][] } | null => {
  const mark = board[r][c];
  if (!mark) return null;
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[r, c]];
    for (let k = 1; k < WIN_LENGTH; k++) {
      const nr = r + dr * k, nc = c + dc * k;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] !== mark) break;
      line.push([nr, nc]);
    }
    for (let k = 1; k < WIN_LENGTH; k++) {
      const nr = r - dr * k, nc = c - dc * k;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] !== mark) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= WIN_LENGTH) return { winner: mark, cells: line };
  }
  return null;
};

/** Heuristic AI: prefer the move that creates the longest friendly line; break ties by proximity to center. */
const aiPickMove = (board: Mark[][], aiMark: Mark, humanMark: Mark): [number, number] | null => {
  const empties: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === EMPTY) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return null;

  // 1. Immediate win.
  for (const [r, c] of empties) {
    board[r][c] = aiMark;
    const win = detectWinAt(board, r, c);
    board[r][c] = EMPTY;
    if (win) return [r, c];
  }
  // 2. Block opponent's immediate win.
  for (const [r, c] of empties) {
    board[r][c] = humanMark;
    const block = detectWinAt(board, r, c);
    board[r][c] = EMPTY;
    if (block) return [r, c];
  }
  // 3. Score by adjacency to own marks + center bias.
  const mid = BOARD_SIZE / 2;
  let best: [number, number] = empties[0];
  let bestScore = -1;
  for (const [r, c] of empties) {
    let score = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
        if (board[nr][nc] === aiMark) score += 2;
        else if (board[nr][nc] === humanMark) score += 1;
      }
    }
    score -= Math.abs(r - mid) + Math.abs(c - mid);
    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
    }
  }
  return best;
};

export function PracticeTicTacToe({ game, onMove, makingMove, aiThinking }: { game?: any; onMove?: any; makingMove?: any; aiThinking?: any }) {
  const [board, setBoard] = useState<Mark[][]>(() => createEmpty());
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [winLine, setWinLine] = useState<[number, number][] | null>(null);
  const [winner, setWinner] = useState<Mark | 'draw' | null>(null);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number>(0);
  const [gameResult, setGameResult] = useState<{ type: 'win' | 'lose' | 'draw'; message: string } | null>(null);
  const [selectedTable, setSelectedTable] = useState('simple_clean');
  const [aiOpponent, setAiOpponent] = useState<any>(null);
  const { width, height } = useWindowSize();

  const playerSymbol: Mark = 'X';
  const aiSymbol: Mark = 'O';
  const gameOver = winner !== null;
  const [moveCount, setMoveCount] = useState<number>(0);

  useEffect(() => {
    if (!aiOpponent) setAiOpponent(getRandomOpponent());
  }, [aiOpponent]);

  // Fire-and-forget marathon record on terminal states.
  useEffect(() => {
    if (!winner) return;
    const API = process.env.REACT_APP_BACKEND_URL;
    if (!API) return;
    const result = winner === playerSymbol ? 'win' : winner === aiSymbol ? 'loss' : 'draw';
    fetch(`${API}/api/marathon/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_type: 'tictactoe_xl', moves: moveCount, result }),
    }).catch(() => {/* non-fatal — leaderboards are cosmetic */});
  }, [winner, moveCount, playerSymbol, aiSymbol]);

  // Resolve end-of-game state whenever winLine/draw is computed.
  useEffect(() => {
    if (!winner) return;
    if (winner === playerSymbol) {
      cardSoundManager.playWinSound?.();
      setPlayerScore((s) => s + 1);
      setGameResult({ type: 'win', message: 'You Win! 🎉' });
    } else if (winner === aiSymbol) {
      cardSoundManager.playLoseSound?.();
      setAiScore((s) => s + 1);
      setGameResult({ type: 'lose', message: `${aiOpponent?.name || 'AI'} Wins!` });
    } else if (winner === 'draw') {
      setGameResult({ type: 'draw', message: "It's a Draw!" });
    }
    // Fire the parent's onMove with a terminal marker for telemetry. Parent
    // practice pages accept arbitrary payloads; this is best-effort.
    try { onMove?.({ terminal: true, winner }); } catch { /* ignore */ }
  }, [winner, aiOpponent, playerSymbol, aiSymbol, onMove]);

  const applyMove = useCallback((r: number, c: number, mark: Mark) => {
    setBoard((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = mark;
      const hit = detectWinAt(next, r, c);
      if (hit) {
        setWinLine(hit.cells);
        setWinner(hit.winner);
      } else {
        const isFull = next.every((row) => row.every((cell) => cell !== EMPTY));
        if (isFull) setWinner('draw');
      }
      return next;
    });
    setMoveCount((m) => m + 1);
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (gameOver || makingMove || aiThinking) return;
    if (turn !== 'player') return;
    if (board[r][c] !== EMPTY) return;
    cardSoundManager.playCardDeal?.();
    applyMove(r, c, playerSymbol);
    setTurn('ai');
  };

  // AI turn
  useEffect(() => {
    if (gameOver || turn !== 'ai') return;
    const timer = setTimeout(() => {
      const move = aiPickMove(board.map((row) => [...row]), aiSymbol, playerSymbol);
      if (!move) return;
      const [r, c] = move;
      cardSoundManager.playCardDeal?.();
      applyMove(r, c, aiSymbol);
      setTurn('player');
    }, 450);
    return () => clearTimeout(timer);
  }, [turn, board, gameOver, aiSymbol, playerSymbol, applyMove]);

  const resetBoard = () => {
    setBoard(createEmpty());
    setWinLine(null);
    setWinner(null);
    setGameResult(null);
    setTurn('player');
    setMoveCount(0);
  };

  // Visual helpers
  const winCellSet = useMemo(() => new Set((winLine || []).map(([r, c]) => `${r},${c}`)), [winLine]);

  return (
    <>
      <AnimatePresence>
        {gameResult && (
          <CinematicCelebration
            result={gameResult.type}
            message={gameResult.message}
            opponentName={aiOpponent?.name || 'AI'}
            playerScore={playerScore}
            opponentScore={aiScore}
            coinsEarned={gameResult.type === 'win' ? 100 : 0}
            onRestart={resetBoard}
            onContinue={() => window.history.back()}
          />
        )}
      </AnimatePresence>

      <BoardGameLayout
        topLeftStat={
          <BoardStatBadge label="You" value={`${playerScore} Wins`} icon={playerSymbol} color="cyan" />
        }
        topRightStat={<AIOpponentCard opponent={aiOpponent} compact={true} />}
        gameTitle={
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border-2 border-cyan-500/60">
              <p className="text-xl font-black text-transparent bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text">
                ⭕ TIC-TAC-TOE XL · 12×12
              </p>
            </div>
            <span className="text-xs text-white/60 font-mono uppercase tracking-widest">
              3-in-a-row · larger arena
            </span>
            {gameOver && (
              <button
                onClick={resetBoard}
                data-testid="ttt-reset-btn"
                className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-100 text-xs font-bold hover:bg-cyan-500/30"
              >
                New Round ↻
              </button>
            )}
          </div>
        }
        gameBoard={
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full flex justify-center"
          >
            <div
              data-testid="ttt-board"
              className="p-2 rounded-2xl bg-black/40 border-2 border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.25)]"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                gap: '4px',
                width: 'min(720px, 92vw)',
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isWin = winCellSet.has(`${r},${c}`);
                  const disabled = gameOver || cell !== EMPTY || turn !== 'player';
                  return (
                    <motion.button
                      key={`${r}-${c}`}
                      data-testid={`ttt-cell-${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      disabled={disabled}
                      whileHover={cell === EMPTY && !gameOver ? { scale: 1.08 } : {}}
                      whileTap={cell === EMPTY && !gameOver ? { scale: 0.92 } : {}}
                      className={`aspect-square rounded-md border flex items-center justify-center font-black text-lg sm:text-xl transition-all relative ${
                        isWin
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-300 text-black shadow-[0_0_16px_rgba(251,191,36,0.6)]'
                          : cell === EMPTY
                          ? 'bg-purple-900/40 border-purple-500/30 hover:border-cyan-400 cursor-pointer'
                          : cell === playerSymbol
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400 text-white'
                          : 'bg-gradient-to-br from-purple-500 to-fuchsia-600 border-purple-400 text-white'
                      } disabled:cursor-not-allowed`}
                    >
                      {cell && (
                        <motion.span
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 250, damping: 15 }}
                        >
                          {cell}
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        }
        bottomActions={
          !gameOver && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-cyan-400 font-bold text-lg text-center"
              data-testid="ttt-turn-indicator"
            >
              {turn === 'player' ? '🎯 Your Turn' : '⏳ AI Thinking...'}
            </motion.p>
          )
        }
      />

      <TableSelectorButton onTableChange={setSelectedTable} />
      <ParticleEffectsOverlay />
    </>
  );
}
