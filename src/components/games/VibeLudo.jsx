import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function VibeLudo() {
  const [turn, setTurn] = useState(0); // 0 to 3 (Strict 4-player max)
  const [dice, setDice] = useState(6);
  const [positions, setPositions] = useState([0, 0, 0, 0]);
  const [message, setMessage] = useState('PLAYER 1 (CYAN) TURN TO ROLL');

  const playerNames = ['Player 1 (Cyan)', 'Player 2 (Emerald)', 'Player 3 (Amber)', 'Player 4 (Rose)'];
  const playerColors = ['text-cyan-400', 'text-emerald-400', 'text-amber-400', 'text-rose-400'];

  const rollAndMove = () => {
    const rolled = Math.floor(Math.random() * 6) + 1;
    setDice(rolled);

    const newPos = [...positions];
    newPos[turn] = Math.min(50, newPos[turn] + rolled);
    setPositions(newPos);

    if (newPos[turn] >= 50) {
      setMessage(`🎉 ${playerNames[turn]} WINS THE ROYAL RACE!`);
      return;
    }

    const nextTurn = (turn + 1) % 4;
    setTurn(nextTurn);
    setMessage(`${playerNames[nextTurn]}'s Turn (Rolled ${rolled})`);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-emerald-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-1">
        Vibe Ludo: Royal Race
      </h2>
      <p className="text-xs text-white/50 mb-6">Strict 4-Player Max Capacity Board Room</p>

      <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-5 mb-6 space-y-3">
        {playerNames.map((name, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-white/5">
            <span className={`text-xs font-bold uppercase ${playerColors[i]}`}>{name} {turn === i && '👑'}</span>
            <span className="text-xs font-mono font-black">Tile: {positions[i]} / 50</span>
          </div>
        ))}
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-6 h-6 flex items-center">
        {message}
      </div>

      <motion.button whileTap={{ scale: 0.95 }} onClick={rollAndMove} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-600 font-black rounded-2xl text-sm uppercase tracking-wider shadow-lg">
        Roll Dice ({dice} 🎲)
      </motion.button>
    </div>
  );
}
