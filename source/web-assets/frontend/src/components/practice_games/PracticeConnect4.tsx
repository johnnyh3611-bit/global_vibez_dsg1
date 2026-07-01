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
 * Connect 4 XL — standard 4-in-a-row rule on an expanded 10×12 board so
 * rounds take longer and players have more strategic room. Fully client-side
 * (state + AI + win detection inside the component); the parent's `onMove`
 * is still called so higher-level telemetry keeps working.
 */
const ROWS = 10;
const COLS = 12;
const WIN_LEN = 4;
type Cell = '' | 'red' | 'yellow';

const createEmpty = (): Cell[][] =>
  Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(''));

/** Drop a disc into `col`, mutating a clone. Returns the landing row, or -1 when full. */
const dropInto = (board: Cell[][], col: number, color: Cell): { board: Cell[][]; row: number } => {
  const next = board.map((row) => [...row]);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (next[r][col] === '') {
      next[r][col] = color;
      return { board: next, row: r };
    }
  }
  return { board: next, row: -1 };
};

/** Win check from the latest drop at (r, c). */
const detectWinAt = (board: Cell[][], r: number, c: number): { winner: Cell; cells: [number, number][] } | null => {
  const color = board[r][c];
  if (!color) return null;
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[r, c]];
    for (let k = 1; k < WIN_LEN; k++) {
      const nr = r + dr * k, nc = c + dc * k;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== color) break;
      line.push([nr, nc]);
    }
    for (let k = 1; k < WIN_LEN; k++) {
      const nr = r - dr * k, nc = c - dc * k;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== color) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= WIN_LEN) return { winner: color, cells: line };
  }
  return null;
};

const isFull = (board: Cell[][]): boolean => board[0].every((c) => c !== '');

/** Simple AI: win if possible, block if opponent threatens, else prefer columns closer to center. */
const aiPickColumn = (board: Cell[][], aiColor: Cell, humanColor: Cell): number => {
  const cols = Array.from({ length: COLS }, (_, i) => i).filter((c) => board[0][c] === '');
  if (cols.length === 0) return -1;

  // 1. Winning move
  for (const c of cols) {
    const { board: b, row } = dropInto(board, c, aiColor);
    if (row !== -1 && detectWinAt(b, row, c)) return c;
  }
  // 2. Block opponent
  for (const c of cols) {
    const { board: b, row } = dropInto(board, c, humanColor);
    if (row !== -1 && detectWinAt(b, row, c)) return c;
  }
  // 3. Center bias with tiny noise
  const mid = (COLS - 1) / 2;
  return cols.reduce(
    (best, c) => (Math.abs(c - mid) + Math.random() * 0.2 < Math.abs(best - mid) ? c : best),
    cols[0]
  );
};

export function PracticeConnect4({ game, onMove, makingMove, aiThinking }: { game?: any; onMove?: any; makingMove?: any; aiThinking?: any }) {
  const [board, setBoard] = useState<Cell[][]>(() => createEmpty());
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [winLine, setWinLine] = useState<[number, number][] | null>(null);
  const [winner, setWinner] = useState<Cell | 'draw' | null>(null);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number>(0);
  const [gameResult, setGameResult] = useState<{ type: 'win' | 'lose' | 'draw'; message: string } | null>(null);
  const [selectedTable, setSelectedTable] = useState('simple_clean');
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [aiOpponent, setAiOpponent] = useState<any>(null);
  const { width, height } = useWindowSize();

  const playerColor: Cell = 'red';
  const aiColor: Cell = 'yellow';
  const gameOver = winner !== null;
  const [moveCount, setMoveCount] = useState<number>(0);

  useEffect(() => {
    if (!aiOpponent) setAiOpponent(getRandomOpponent());
  }, [aiOpponent]);

  // Record the round in Marathon leaderboard on terminal states.
  useEffect(() => {
    if (!winner) return;
    const API = process.env.REACT_APP_BACKEND_URL;
    if (!API) return;
    const result = winner === playerColor ? 'win' : winner === aiColor ? 'loss' : 'draw';
    fetch(`${API}/api/marathon/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_type: 'connect4_xl', moves: moveCount, result }),
    }).catch(() => {/* non-fatal */});
  }, [winner, moveCount, playerColor, aiColor]);

  useEffect(() => {
    if (!winner) return;
    if (winner === playerColor) {
      cardSoundManager.playWinSound?.();
      setPlayerScore((s) => s + 1);
      setGameResult({ type: 'win', message: 'You Win! 🎉' });
    } else if (winner === aiColor) {
      cardSoundManager.playLoseSound?.();
      setAiScore((s) => s + 1);
      setGameResult({ type: 'lose', message: `${aiOpponent?.name || 'AI'} Wins!` });
    } else {
      setGameResult({ type: 'draw', message: "It's a Draw!" });
    }
    try { onMove?.({ terminal: true, winner }); } catch {/* ignore */}
  }, [winner, aiOpponent, playerColor, aiColor, onMove]);

  const dropAndCheck = useCallback((col: number, color: Cell): 'ok' | 'full' => {
    const { board: next, row } = dropInto(board, col, color);
    if (row === -1) return 'full';
    setBoard(next);
    setMoveCount((m) => m + 1);
    const hit = detectWinAt(next, row, col);
    if (hit) {
      setWinLine(hit.cells);
      setWinner(hit.winner);
    } else if (isFull(next)) {
      setWinner('draw');
    }
    return 'ok';
  }, [board]);

  const handleColumnClick = (col: number) => {
    if (gameOver || makingMove || aiThinking) return;
    if (turn !== 'player') return;
    const res = dropAndCheck(col, playerColor);
    if (res !== 'ok') return;
    cardSoundManager.playCardDeal?.();
    setTurn('ai');
  };

  useEffect(() => {
    if (gameOver || turn !== 'ai') return;
    const t = setTimeout(() => {
      const col = aiPickColumn(board, aiColor, playerColor);
      if (col < 0) return;
      dropAndCheck(col, aiColor);
      cardSoundManager.playCardDeal?.();
      setTurn('player');
    }, 520);
    return () => clearTimeout(t);
  }, [turn, board, gameOver, aiColor, playerColor, dropAndCheck]);

  const resetBoard = () => {
    setBoard(createEmpty());
    setWinLine(null);
    setWinner(null);
    setGameResult(null);
    setTurn('player');
    setMoveCount(0);
  };

  const winCellSet = useMemo(
    () => new Set((winLine || []).map(([r, c]) => `${r},${c}`)),
    [winLine]
  );

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
        topLeftStat={<BoardStatBadge label="You (Red)" value={`${playerScore} Wins`} icon="🔴" color="red" />}
        topRightStat={<AIOpponentCard opponent={aiOpponent} compact={true} />}
        gameTitle={
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border-2 border-rose-500/60">
              <p className="text-xl font-black text-transparent bg-gradient-to-r from-rose-300 to-amber-300 bg-clip-text">
                🔴 CONNECT 4 XL · {ROWS}×{COLS}
              </p>
            </div>
            <span className="text-xs text-white/60 font-mono uppercase tracking-widest">
              4-in-a-row · larger arena
            </span>
            {gameOver && (
              <button
                onClick={resetBoard}
                data-testid="c4-reset-btn"
                className="px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400 text-rose-100 text-xs font-bold hover:bg-rose-500/30"
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
            className="w-full flex flex-col items-center gap-2"
          >
            {/* Column drop indicator bar */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gap: '4px',
                width: 'min(840px, 94vw)',
              }}
            >
              {Array.from({ length: COLS }).map((_, c) => (
                <button
                  key={`col-btn-${c}`}
                  data-testid={`c4-col-btn-${c}`}
                  aria-label={`Drop in column ${c + 1}`}
                  onMouseEnter={() => setHoveredColumn(c)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onClick={() => handleColumnClick(c)}
                  disabled={gameOver || turn !== 'player' || board[0][c] !== ''}
                  className={`h-6 rounded-t-md text-[10px] font-bold transition-all ${
                    hoveredColumn === c && !gameOver && turn === 'player' && board[0][c] === ''
                      ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  ↓
                </button>
              ))}
            </div>

            <div
              data-testid="c4-board"
              className="p-3 rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 border-4 border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.35)]"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gap: '4px',
                width: 'min(840px, 94vw)',
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const isWin = winCellSet.has(`${r},${c}`);
                  const isHoverCol = hoveredColumn === c && cell === '' && !gameOver && turn === 'player';
                  return (
                    <motion.button
                      key={`${r}-${c}`}
                      data-testid={`c4-cell-${r}-${c}`}
                      aria-label={`Connect 4 column ${c + 1}${cell ? ` — ${cell}` : ''}`}
                      onClick={() => handleColumnClick(c)}
                      onMouseEnter={() => setHoveredColumn(c)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      disabled={gameOver || turn !== 'player' || cell !== '' || board[0][c] !== ''}
                      className={`aspect-square rounded-full border-2 flex items-center justify-center relative transition-all ${
                        cell === ''
                          ? `bg-blue-950/60 border-blue-700 ${isHoverCol ? 'ring-2 ring-rose-400/60' : ''}`
                          : isWin
                          ? 'border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.7)]'
                          : 'border-white/30'
                      }`}
                    >
                      {cell && (
                        <motion.div
                          initial={{ y: -200, opacity: 0.6 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                          className={`w-[85%] h-[85%] rounded-full shadow-lg ${
                            cell === playerColor
                              ? 'bg-gradient-to-br from-red-400 to-red-700'
                              : 'bg-gradient-to-br from-yellow-300 to-amber-500'
                          }`}
                        />
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
              className="text-rose-400 font-bold text-lg text-center"
              data-testid="c4-turn-indicator"
            >
              {turn === 'player' ? '🎯 Your Turn — pick a column' : '⏳ AI Thinking...'}
            </motion.p>
          )
        }
      />

      <TableSelectorButton onTableChange={setSelectedTable} />
      <ParticleEffectsOverlay />
    </>
  );
}
