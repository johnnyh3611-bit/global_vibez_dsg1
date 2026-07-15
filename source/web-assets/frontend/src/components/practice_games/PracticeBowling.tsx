import React, { useState } from 'react';
import { RotateCcw, Zap, Trophy } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import GameShell from '@/components/games/GameShell';

const PIN_COUNT = 10;
const PIN_ROWS = 4;
const FRAMES = 10;
const ALL_UP = Array(PIN_COUNT).fill(true);

function calculateScore(rolls: number[]) {
  let score = 0;
  let rollIndex = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    if (rollIndex >= rolls.length) break;
    if (rolls[rollIndex] === 10) {
      score += 10 + (rolls[rollIndex + 1] ?? 0) + (rolls[rollIndex + 2] ?? 0);
      rollIndex += 1;
    } else if ((rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0) === 10) {
      score += 10 + (rolls[rollIndex + 2] ?? 0);
      rollIndex += 2;
    } else {
      score += (rolls[rollIndex] ?? 0) + (rolls[rollIndex + 1] ?? 0);
      rollIndex += 2;
    }
  }
  return score;
}

export default function PracticeBowling({ gameState, onMove }: { gameState?: any; onMove?: any }) {
  const [rolls, setRolls] = useState<number[]>([]);
  const [pins, setPins] = useState<boolean[]>(ALL_UP);
  const [frame, setFrame] = useState(0);
  const [rollInFrame, setRollInFrame] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [ballLaneProgress, setBallLaneProgress] = useState(0);
  const [message, setMessage] = useState('Roll to start!');
  const [gameOver, setGameOver] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const score = calculateScore(rolls);
  const remainingPins = pins.filter(Boolean).length;

  const shuffleAndKnock = (standingIndexes: number[], down: number, currentPins: boolean[]) => {
    const next = [...currentPins];
    const shuffled = [...standingIndexes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.slice(0, down).forEach((i) => (next[i] = false));
    return next;
  };

  const determineDown = (remaining: number, currentRollInFrame: number) => {
    if (remaining === 0) return 0;
    const base = Math.floor(Math.random() * (remaining + 1));
    if (currentRollInFrame === 0 && Math.random() > 0.92) return 10;
    if (currentRollInFrame === 1 && remaining > 0 && Math.random() > 0.65) return remaining;
    return base;
  };

  const resolveRoll = () => {
    const currentFrame = frame;
    const currentRollInFrame = rollInFrame;
    const down = determineDown(remainingPins, currentRollInFrame);
    const standingIndexes = pins.map((up, i) => (up ? i : -1)).filter((i) => i !== -1);
    const nextPins = shuffleAndKnock(standingIndexes, down, pins);
    const newRolls = [...rolls, down];
    const newScore = calculateScore(newRolls);

    let nextFrame = currentFrame;
    let nextRollInFrame = currentRollInFrame;
    let nextPinsState = nextPins;
    let nextGameOver = false;

    if (currentFrame < 9) {
      if (down === 10) {
        nextFrame += 1;
        nextRollInFrame = 0;
        nextPinsState = ALL_UP;
      } else if (currentRollInFrame === 1) {
        nextFrame += 1;
        nextRollInFrame = 0;
        nextPinsState = ALL_UP;
      } else {
        nextRollInFrame = 1;
      }
    } else {
      const previousRoll = currentRollInFrame >= 1 ? newRolls[newRolls.length - 2] ?? 0 : null;
      if (currentRollInFrame === 0) {
        if (down === 10) {
          nextPinsState = ALL_UP;
        }
        nextRollInFrame = 1;
      } else if (currentRollInFrame === 1) {
        const clearedInTwo = (previousRoll ?? 0) + down >= 10 || down === 10;
        if (clearedInTwo) {
          nextPinsState = ALL_UP;
          nextRollInFrame = 2;
        } else {
          nextGameOver = true;
        }
      } else if (currentRollInFrame === 2) {
        nextGameOver = true;
      }
    }

    if (down === 10 && !gameOver) {
      setMessage('STRIKE!');
      cardSoundManager.playWinSound?.();
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1200);
    } else if (down === remainingPins && currentRollInFrame === 1 && !gameOver) {
      setMessage('SPARE!');
      cardSoundManager.playWinSound?.();
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1200);
    } else {
      setMessage(down === 0 ? 'Gutter ball!' : `${down} pins down!`);
    }

    if (nextGameOver) {
      setMessage(`Game over! Final score: ${newScore}`);
      if (newScore >= 200) {
        cardSoundManager.playWinSound?.();
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1500);
      }
    }

    setRolls(newRolls);
    setFrame(nextFrame);
    setRollInFrame(nextRollInFrame);
    setPins(nextPinsState);
    setGameOver(nextGameOver);
  };

  const rollBall = () => {
    if (gameOver || rolling) return;
    setRolling(true);
    setBallLaneProgress(0);
    setMessage('Rolling...');
    cardSoundManager.playCardSlam();

    let progress = 0;
    const rollInterval = setInterval(() => {
      progress += 8;
      setBallLaneProgress(progress);
      if (progress >= 100) {
        clearInterval(rollInterval);
        resolveRoll();
        setRolling(false);
        setBallLaneProgress(0);
      }
    }, 50);
  };

  const resetGame = () => {
    setRolls([]);
    setPins(ALL_UP);
    setFrame(0);
    setRollInFrame(0);
    setRolling(false);
    setBallLaneProgress(0);
    setMessage('Roll to start!');
    setGameOver(false);
    setCelebrate(false);
  };

  const pinIndexInRow = (row: number, indexInRow: number) => {
    let base = 0;
    for (let r = 0; r < row; r++) base += r + 1;
    return base + indexInRow;
  };

  const renderFrameBox = (frameIndex: number) => {
    let rollIdx = 0;
    let f = 0;
    let r0 = '';
    let r1 = '';
    let r2 = '';
    while (f <= frameIndex && rollIdx < rolls.length) {
      if (f !== frameIndex) {
        if (rolls[rollIdx] === 10) rollIdx += 1;
        else rollIdx += 2;
        f++;
        continue;
      }
      if (frameIndex < 9) {
        if (rolls[rollIdx] === 10) {
          r0 = 'X';
          r1 = '';
        } else {
          r0 = String(rolls[rollIdx] ?? '');
          if (rolls.length > rollIdx + 1) {
            r1 = rolls[rollIdx] + rolls[rollIdx + 1] === 10 ? '/' : String(rolls[rollIdx + 1]);
          }
        }
      } else {
        const a = rolls[rollIdx];
        const b = rolls[rollIdx + 1];
        const c = rolls[rollIdx + 2];
        if (a === 10) r0 = 'X';
        else r0 = a !== undefined ? String(a) : '';

        if (b !== undefined) {
          if (a === 10) r1 = b === 10 ? 'X' : String(b);
          else if (a + b === 10) r1 = '/';
          else r1 = String(b);
        }

        if (c !== undefined) {
          if (a === 10 && b === 10) r2 = c === 10 ? 'X' : String(c);
          else if ((a === 10 && b !== 10 && b + c === 10) || (a !== 10 && a + b === 10)) {
            r2 = c === 10 ? 'X' : String(c);
          } else {
            r2 = String(c);
          }
        }
      }
      break;
    }

    return (
      <div key={frameIndex} className="bg-white/10 border border-white/20 rounded-lg p-2 text-center min-w-[56px]">
        <div className="text-white/50 text-xs mb-1">{frameIndex + 1}</div>
        <div className="flex justify-center gap-1 text-white font-bold text-xs h-4">
          <span>{r0}</span>
          <span>{r1}</span>
          {frameIndex === 9 && <span>{r2}</span>}
        </div>
      </div>
    );
  };

  const status = gameOver ? 'Game Over' : rolling ? 'Rolling...' : 'Frame ' + (frame + 1);

  return (
    <GameShell
      title="10-Pin Bowling"
      emoji="🎳"
      subtitle={message}
      bgGradient="from-amber-900 via-orange-900 to-black"
      onBack={() => window.history.back()}
      onRestart={resetGame}
      status={status}
      stats={[
        { label: 'Score', value: score, color: 'cyan' },
        { label: 'Frame', value: Math.min(frame + 1, 10), color: 'purple' },
        { label: 'Pins Left', value: remainingPins, color: 'yellow' },
      ]}
      controls={
        <div className="flex gap-3">
          <button
            onClick={rollBall}
            disabled={rolling || gameOver}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-base rounded-xl border-2 border-cyan-400 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            {rolling ? 'Rolling...' : 'ROLL'}
          </button>
          <button
            onClick={resetGame}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl border-2 border-purple-400 hover:scale-[1.02] transition-transform flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            New Game
          </button>
        </div>
      }
      modal={
        gameOver && (
          <div className="bg-gradient-to-br from-amber-900 to-orange-900 rounded-3xl p-6 sm:p-8 border-4 border-yellow-400 text-center max-w-sm mx-auto">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Game Over</h2>
            <p className="text-2xl text-yellow-400 mb-6">Final Score: {score}</p>
            <button
              onClick={resetGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
            >
              Play Again
            </button>
          </div>
        )
      }
    >
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-gradient-to-br from-slate-800 to-black rounded-2xl p-4 border border-white/10 flex items-center justify-center min-h-[240px] sm:min-h-[320px] relative overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-amber-900/30 to-transparent" />

            <div className="relative z-10 flex flex-col items-center gap-2">
              {Array.from({ length: PIN_ROWS }).map((_, row) => (
                <div key={row} className="flex gap-2 justify-center">
                  {Array.from({ length: row + 1 }).map((_, idx) => {
                    const pinIdx = pinIndexInRow(row, idx);
                    const up = pins[pinIdx];
                    return (
                      <div
                        key={pinIdx}
                        className={`w-6 h-6 sm:w-9 sm:h-9 rounded-full shadow-lg transition-all duration-300 ${
                          up
                            ? 'bg-gradient-to-br from-white to-gray-300 border-2 border-gray-400'
                            : 'bg-transparent border-2 border-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {rolling && (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(34,211,238,0.6)] z-20 transition-all"
                style={{ top: `${ballLaneProgress}%` }}
              />
            )}

            {celebrate && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <Trophy className="w-14 h-14 text-yellow-400 drop-shadow-lg animate-bounce" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: FRAMES }).map((_, i) => renderFrameBox(i))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
