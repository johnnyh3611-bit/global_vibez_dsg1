import React, { useState, useMemo } from 'react';
import { Trophy, Dice5, ArrowRight } from 'lucide-react';

interface GameState {
  points: number[];
  bar: { player: number; ai: number };
  off: { player: number; ai: number };
  last_roll?: number | null;
  current_turn?: string;
}

interface LegalMove {
  source: number | 'bar';
  target: number;
}

export default function PracticeBackgammon({
  game,
  onMove,
  makingMove,
  aiThinking,
}: {
  game?: { game_state?: GameState; status?: string; winner?: string | null; current_turn?: string };
  onMove?: (move: any) => void;
  makingMove?: boolean;
  aiThinking?: boolean;
}) {
  const gameState: GameState = game?.game_state || {
    points: new Array(24).fill(0),
    bar: { player: 0, ai: 0 },
    off: { player: 0, ai: 0 },
  };
  const points = gameState.points;
  const bar = gameState.bar;
  const off = gameState.off;
  const lastRoll = gameState.last_roll ?? null;
  const isGameOver = game?.status === 'completed';
  const winner = game?.winner;
  const isPlayerTurn = game?.current_turn === 'player' && !isGameOver;

  const [currentDie, setCurrentDie] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<number | 'bar' | null>(null);

  const playerCheckersOnBoard = points.reduce((sum, c) => sum + (c > 0 ? c : 0), 0) + bar.player;
  const playerAllHome = useMemo(() => {
    if (bar.player > 0) return false;
    for (let i = 6; i < 24; i++) {
      if (points[i] > 0) return false;
    }
    return true;
  }, [points, bar.player]);

  const legalMoves = useMemo<LegalMove[]>(() => {
    if (currentDie === null || !isPlayerTurn) return [];
    const die = currentDie;
    const moves: LegalMove[] = [];

    if (bar.player > 0) {
      const target = 25 - die;
      if (target >= 1 && target <= 24) {
        const idx = target - 1;
        if (points[idx] >= -1) {
          moves.push({ source: 'bar', target });
        }
      }
      return moves;
    }

    for (let p = 1; p <= 24; p++) {
      const idx = p - 1;
      if (points[idx] <= 0) continue;
      const target = p - die;
      if (target >= 1) {
        const tidx = target - 1;
        if (points[tidx] >= -1) {
          moves.push({ source: p, target });
        }
      } else if (target <= 0) {
        if (playerAllHome) {
          let higherExists = false;
          for (let q = p + 1; q <= 6; q++) {
            if (points[q - 1] > 0) {
              higherExists = true;
              break;
            }
          }
          if (p === die || (p < die && !higherExists)) {
            moves.push({ source: p, target: 0 });
          }
        }
      }
    }
    return moves;
  }, [currentDie, points, bar.player, isPlayerTurn, playerAllHome]);

  const sourceSet = useMemo(() => {
    const set = new Set<number | 'bar'>();
    for (const m of legalMoves) set.add(m.source);
    return set;
  }, [legalMoves]);

  const targetSet = useMemo(() => {
    const set = new Set<number>();
    for (const m of legalMoves) {
      if (m.source === selectedSource) set.add(m.target);
    }
    return set;
  }, [legalMoves, selectedSource]);

  const canRoll = isPlayerTurn && !makingMove && !aiThinking && currentDie === null;

  const rollDie = () => {
    if (!canRoll) return;
    const die = Math.floor(Math.random() * 6) + 1;
    setCurrentDie(die);
    setSelectedSource(null);
  };

  const handleSourceClick = (source: number | 'bar') => {
    if (!isPlayerTurn || makingMove || aiThinking || currentDie === null) return;
    if (!sourceSet.has(source)) return;
    setSelectedSource(source);
  };

  const handleTargetClick = (target: number) => {
    if (!isPlayerTurn || makingMove || aiThinking || selectedSource === null) return;
    if (!targetSet.has(target)) return;
    if (onMove) {
      onMove({ die: currentDie, from: selectedSource, to: target });
    }
    setCurrentDie(null);
    setSelectedSource(null);
  };

  const passTurn = () => {
    if (!isPlayerTurn || makingMove || aiThinking || currentDie === null) return;
    if (legalMoves.length > 0) return;
    if (onMove) {
      onMove({ die: currentDie });
    }
    setCurrentDie(null);
    setSelectedSource(null);
  };

  const Point = ({ pointNum }: { pointNum: number }) => {
    const idx = pointNum - 1;
    const count = points[idx];
    const isTopRow = pointNum >= 13;
    const displayNum = pointNum;
    const isSource = sourceSet.has(pointNum);
    const isTarget = targetSet.has(pointNum);
    const isSelected = selectedSource === pointNum;

    let checkerColor: 'white' | 'black' | null = null;
    let checkerCount = 0;
    if (count > 0) {
      checkerColor = 'white';
      checkerCount = count;
    } else if (count < 0) {
      checkerColor = 'black';
      checkerCount = -count;
    }

    return (
      <button
        onClick={() => {
          if (isTarget) handleTargetClick(pointNum);
          else handleSourceClick(pointNum);
        }}
        disabled={!isSource && !isTarget && !checkerColor}
        className={`relative h-24 rounded-lg border-2 flex flex-col items-center justify-between py-1 transition-all ${
          isTopRow ? 'bg-amber-900/40' : 'bg-amber-800/40'
        } ${
          isTarget
            ? 'border-green-400 ring-2 ring-green-400 scale-105'
            : isSelected
            ? 'border-cyan-400 ring-2 ring-cyan-400'
            : isSource
            ? 'border-yellow-400'
            : 'border-amber-700/50'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span className="text-[10px] text-amber-200/70">{displayNum}</span>
        {checkerColor && (
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full border-4 shadow-lg ${
                checkerColor === 'white'
                  ? 'bg-gray-100 border-gray-800'
                  : 'bg-gray-900 border-gray-100'
              }`}
            />
            {checkerCount > 1 && (
              <span className="text-xs font-bold text-white mt-1">{checkerCount}</span>
            )}
          </div>
        )}
        <span />
      </button>
    );
  };

  const BarStack = ({ player }: { player: 'player' | 'ai' }) => {
    const count = player === 'player' ? bar.player : bar.ai;
    const canSelectSource = player === 'player' && sourceSet.has('bar');
    return (
      <button
        onClick={() => handleSourceClick('bar')}
        disabled={!canSelectSource}
        className={`flex flex-col items-center justify-center h-40 w-16 rounded-xl border-2 ${
          canSelectSource ? 'border-cyan-400 bg-amber-900/50' : 'border-amber-700/50 bg-amber-950/30'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span className="text-xs text-amber-200/70 mb-2">{player === 'player' ? 'YOU' : 'AI'}</span>
        {count > 0 && (
          <div
            className={`w-10 h-10 rounded-full border-4 shadow-lg ${
              player === 'player'
                ? 'bg-gray-100 border-gray-800'
                : 'bg-gray-900 border-gray-100'
            }`}
          />
        )}
        {count > 0 && <span className="text-sm font-bold text-white mt-1">{count}</span>}
      </button>
    );
  };

  if (isGameOver) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-amber-900 to-yellow-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-2xl w-full">
          <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-4xl font-bold text-white mb-4">Game Over</h2>
          <p className="text-3xl text-yellow-400 mb-2">
            {winner === 'player' ? 'You Win!' : winner === 'ai' ? 'AI Wins' : 'Draw'}
          </p>
          <p className="text-xl text-amber-300">{off.player} off vs {off.ai} off</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent mb-1">
            BACKGAMMON
          </h1>
          <p className="text-amber-200/70 text-sm">Practice — first to bear off 15 checkers wins</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-3 border-2 border-gray-600 text-center">
            <div className="text-gray-300 text-xs uppercase">Last Roll</div>
            <div className="text-3xl font-bold text-white">{lastRoll ?? '-'}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-700 to-cyan-700 rounded-xl p-3 border-2 border-blue-400 text-center">
            <div className="text-blue-100 text-xs uppercase">Borne Off</div>
            <div className="text-3xl font-bold text-white">{off.player}</div>
          </div>
          <div className="bg-gradient-to-br from-red-700 to-pink-700 rounded-xl p-3 border-2 border-red-400 text-center">
            <div className="text-red-100 text-xs uppercase">AI Off</div>
            <div className="text-3xl font-bold text-white">{off.ai}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <BarStack player="ai" />
          <div className="flex-1">
            <div className="grid grid-cols-12 gap-1 mb-1">
              {[24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13].map((p) => (
                <Point key={`top-${p}`} pointNum={p} />
              ))}
            </div>
            <div className="grid grid-cols-12 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                <Point key={`bottom-${p}`} pointNum={p} />
              ))}
            </div>
          </div>
          <BarStack player="player" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {canRoll ? (
            <button
              onClick={rollDie}
              className="px-8 py-4 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold text-xl rounded-xl border-2 border-yellow-400 hover:scale-105 transition-transform flex items-center gap-2"
            >
              <Dice5 className="w-6 h-6" /> Roll Die
            </button>
          ) : (
            <div className="px-6 py-3 bg-gray-800 rounded-xl text-white font-bold text-xl border-2 border-gray-600">
              Rolled: {currentDie}
            </div>
          )}

          {currentDie !== null && legalMoves.length === 0 && (
            <button
              onClick={passTurn}
              disabled={makingMove || aiThinking}
              className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-xl border-2 border-gray-500 hover:scale-105 transition-transform disabled:opacity-50"
            >
              No legal move — Pass
            </button>
          )}

          {selectedSource !== null && (
            <div className="text-amber-200 text-sm flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Select a highlighted target point
            </div>
          )}

          {!isPlayerTurn && !isGameOver && (
            <div className="text-amber-200 animate-pulse font-semibold">
              {aiThinking ? 'AI is thinking...' : 'AI turn'}
            </div>
          )}
        </div>

        {playerCheckersOnBoard === 0 && bar.player === 0 && off.player < 15 && (
          <p className="text-center text-red-400 mt-4">Waiting for game state...</p>
        )}
      </div>
    </div>
  );
}
