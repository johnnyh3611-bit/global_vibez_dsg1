import React, { useState } from 'react';
import { motion } from 'framer-motion';

const ROWS = 6;
const COLS = 7;

export default function NeoGridDrop() {
  const [board, setBoard] = useState(Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
  const [currentPlayer, setCurrentPlayer] = useState(1); // 1: Cyan, 2: Magenta
  const [winner, setWinner] = useState(null);
  const [status, setStatus] = useState('PLAYER 1 (CYAN) TURN');

  const checkWin = (b) => {
    // Horizontal, Vertical, Diagonal checks simplified for brevity
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p !== 0) {
          if (c + 3 < COLS && p === b[r][c+1] && p === b[r][c+2] && p === b[r][c+3]) return p;
          if (r + 3 < ROWS && p === b[r+1][c] && p === b[r+2][c] && p === b[r+3][c]) return p;
          if (r + 3 < ROWS && c + 3 < COLS && p === b[r+1][c+1] && p === b[r+2][c+2] && p === b[r+3][c+3]) return p;
          if (r + 3 < ROWS && c - 3 >= 0 && p === b[r+1][c-1] && p === b[r+2][c-2] && p === b[r+3][c-3]) return p;
        }
      }
    }
    return null;
  };

  const dropToken = (col) => {
    if (winner) return;
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return;

    const newBoard = board.map(row => [...row]);
    newBoard[targetRow][col] = currentPlayer;
    setBoard(newBoard);

    const win = checkWin(newBoard);
    if (win) {
      setWinner(win);
      setStatus(win === 1 ? '🎉 PLAYER 1 (CYAN) WINS!' : '🎉 PLAYER 2 (MAGENTA) WINS!');
    } else {
      const next = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(next);
      setStatus(next === 1 ? 'PLAYER 1 (CYAN) TURN' : 'PLAYER 2 (MAGENTA) TURN');
    }
  };

  const resetGame = () => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(0)));
    setCurrentPlayer(1);
    setWinner(null);
    setStatus('PLAYER 1 (CYAN) TURN');
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-cyan-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-1">
        Neo-Grid Drop
      </h2>
      <p className="text-xs text-white/50 mb-6">High-Stakes Vertical Connect Four</p>

      <div className="bg-slate-900/90 border border-cyan-500/30 p-3 rounded-2xl shadow-inner mb-6 grid grid-cols-7 gap-2">
        {board.map((row, rIdx) =>
          row.map((cell, cIdx) => (
            <motion.button
              key={`${rIdx}-${cIdx}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => dropToken(cIdx)}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all ${
                cell === 1
                  ? 'bg-cyan-400 border-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                  : cell === 2
                  ? 'bg-rose-500 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                  : 'bg-slate-800 border-white/10 hover:border-cyan-400/50'
              }`}
            />
          ))
        )}
      </div>

      <div className="text-xs font-black tracking-widest uppercase text-cyan-300 mb-6 h-6 flex items-center">
        {status}
      </div>

      <button onClick={resetGame} className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg">
        New Game
      </button>
    </div>
  );
}
