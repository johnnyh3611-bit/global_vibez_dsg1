import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function CyberBlackjack() {
  const [playerHand, setPlayerHand] = useState([10, 7]);
  const [dealerHand, setDealerHand] = useState([8, 5]);
  const [status, setStatus] = useState('YOUR MOVE: HIT OR STAND');
  const [gameOver, setGameOver] = useState(false);

  const calculateSum = (hand) => hand.reduce((a, b) => a + b, 0);

  const hit = () => {
    if (gameOver) return;
    const newCard = Math.floor(Math.random() * 10) + 1;
    const updated = [...playerHand, newCard];
    setPlayerHand(updated);
    if (calculateSum(updated) > 21) {
      setStatus('💥 BUST! DEALER WINS');
      setGameOver(true);
    }
  };

  const stand = () => {
    if (gameOver) return;
    let dSum = calculateSum(dealerHand);
    while (dSum < 17) {
      dSum += Math.floor(Math.random() * 10) + 1;
    }
    const pSum = calculateSum(playerHand);
    if (dSum > 21 || pSum > dSum) {
      setStatus(`🎉 YOU WIN! (${pSum} vs Dealer ${dSum})`);
    } else if (pSum === dSum) {
      setStatus(`🤝 PUSH! (${pSum} tie)`);
    } else {
      setStatus(`💀 DEALER WINS! (${dSum} vs Your ${pSum})`);
    }
    setGameOver(true);
  };

  const resetGame = () => {
    setPlayerHand([Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1]);
    setDealerHand([Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1]);
    setStatus('YOUR MOVE: HIT OR STAND');
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-indigo-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent mb-1">
        Cyber Blackjack
      </h2>
      <p className="text-xs text-white/50 mb-6">Behind-the-Chair Multiplayer Lounge</p>

      <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-5 mb-6 space-y-4">
        <div>
          <span className="text-xs font-mono uppercase text-white/50">Dealer Hand</span>
          <div className="flex gap-2 mt-1">
            {dealerHand.map((c, i) => (
              <div key={i} className="w-12 h-16 bg-slate-800 border border-white/20 rounded-xl flex items-center justify-center font-black text-lg text-indigo-300">
                {c}
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-mono uppercase text-white/50">Your Hand (Sum: {calculateSum(playerHand)})</span>
          <div className="flex gap-2 mt-1">
            {playerHand.map((c, i) => (
              <div key={i} className="w-12 h-16 bg-slate-800 border border-cyan-400/40 rounded-xl flex items-center justify-center font-black text-lg text-cyan-300">
                {c}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs font-bold text-center tracking-widest text-cyan-300 uppercase pt-2">
          {status}
        </div>
      </div>

      <div className="w-full flex gap-3">
        {!gameOver ? (
          <>
            <button onClick={hit} className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 font-black rounded-xl text-sm uppercase">Hit</button>
            <button onClick={stand} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 font-black rounded-xl text-sm uppercase">Stand</button>
          </>
        ) : (
          <button onClick={resetGame} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl text-sm uppercase">Play Again</button>
        )}
      </div>
    </div>
  );
}
