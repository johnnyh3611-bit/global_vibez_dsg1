import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  WAITING: 'WAITING',
  DRAWING: 'DRAWING',
  BINGO: 'BINGO'
};

const Bingo = () => {
  const [currentState, setCurrentState] = useState(GameState.WAITING);
  const [card, setCard] = useState([]);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [marked, setMarked] = useState(new Set());
  const [credits, setCredits] = useState(5000);
  const [jackpot] = useState(50000);
  const [lastWin, setLastWin] = useState(0);
  const [autoDrawing, setAutoDrawing] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const generateCard = () => {
    const card = [];
    const ranges = [
      [1, 15],   // B column
      [16, 30],  // I column
      [31, 45],  // N column
      [46, 60],  // G column
      [61, 75]   // O column
    ];

    ranges.forEach((range, colIdx) => {
      const col = [];
      const available = [];
      for (let i = range[0]; i <= range[1]; i++) available.push(i);
      
      for (let row = 0; row < 5; row++) {
        if (colIdx === 2 && row === 2) {
          col.push('FREE');
        } else {
          const idx = Math.floor(Math.random() * available.length);
          col.push(available.splice(idx, 1)[0]);
        }
      }
      card.push(col);
    });

    return card;
  };

  const startGame = () => {
    if (credits < 10) return;

    setCredits(credits - 10);
    const newCard = generateCard();
    setCard(newCard);
    setMarked(new Set(['2-2'])); // Mark FREE space
    setDrawnNumbers([]);
    setCurrentState(GameState.DRAWING);
    setAutoDrawing(true);
  };

  const drawNumber = async () => {
    if (drawnNumbers.length >= 75) return;

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // Call server for authoritative number draw
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'bingo',
          bet_amount: 10,
          bet_data: {}
        })
      });
      const {game_id} = await betResponse.json();
      
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result} = await spinResponse.json();
      
      const num = result.number;
      
      // Only add if not already drawn
      if (!drawnNumbers.includes(num)) {
        cardSoundManager.playChipClink();
        setDrawnNumbers([...drawnNumbers, num]);

        // Auto-mark if on card
        card.forEach((col, colIdx) => {
          col.forEach((cell, rowIdx) => {
            if (cell === num) {
              setMarked(prev => new Set([...prev, `${rowIdx}-${colIdx}`]));
            }
          });
        });

        checkWin();
      }
      
    } catch (error) {
      // console.error('Server-authoritative draw failed:', error);
      // Fallback to client-side
      let num;
      do {
        num = Math.floor(Math.random() * 75) + 1;
      } while (drawnNumbers.includes(num));

      cardSoundManager.playChipClink();
      setDrawnNumbers([...drawnNumbers, num]);

      // Auto-mark if on card
      card.forEach((col, colIdx) => {
        col.forEach((cell, rowIdx) => {
          if (cell === num) {
            setMarked(prev => new Set([...prev, `${rowIdx}-${colIdx}`]));
          }
        });
      });

      checkWin();
    }
  };

  const checkWin = () => {
    // Check rows
    for (let row = 0; row < 5; row++) {
      let complete = true;
      for (let col = 0; col < 5; col++) {
        if (!marked.has(`${row}-${col}`)) {
          complete = false;
          break;
        }
      }
      if (complete) {
        handleBingo();
        return;
      }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!marked.has(`${row}-${col}`)) {
          complete = false;
          break;
        }
      }
      if (complete) {
        handleBingo();
        return;
      }
    }

    // Check diagonals
    let diag1 = true, diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!marked.has(`${i}-${i}`)) diag1 = false;
      if (!marked.has(`${i}-${4-i}`)) diag2 = false;
    }
    if (diag1 || diag2) {
      handleBingo();
    }
  };

  const handleBingo = () => {
    setAutoDrawing(false);
    setCurrentState(GameState.BINGO);
    cardSoundManager.playWinSound();

    const winAmount = Math.floor(Math.random() * 500) + 100;
    setLastWin(winAmount);
    setCredits(credits + winAmount);

    setTimeout(() => {
      setCurrentState(GameState.WAITING);
      setCard([]);
      setMarked(new Set());
    }, 3000);
  };

  // Auto-draw effect
  React.useEffect(() => {
    if (autoDrawing && currentState === GameState.DRAWING) {
      const timer = setTimeout(() => {
        drawNumber();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoDrawing, drawnNumbers, currentState]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" 
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
          BINGO
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Progressive Jackpot: ${jackpot.toLocaleString()}</p>
      </motion.div>

      {/* Bingo Card */}
      {card.length > 0 && (
        <div className={`${glassEffect} rounded-2xl p-6 mb-8`}>
          <div className="grid grid-cols-5 gap-1 mb-4">
            {['B', 'I', 'N', 'G', 'O'].map(letter => (
              <div key={letter} className="w-16 h-12 flex items-center justify-center text-[#D4AF37] font-black text-2xl">
                {letter}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {card.map((col, colIdx) => (
              <React.Fragment key={colIdx}>
                {col.map((cell, rowIdx) => {
                  const key = `${rowIdx}-${colIdx}`;
                  const isMarked = marked.has(key);
                  const isFree = cell === 'FREE';
                  
                  return (
                    <motion.div
                      key={key}
                      whileHover={{ scale: 1.05 }}
                      className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold transition-all ${
                        isMarked ? 'bg-[#00F0FF] text-black shadow-[0_0_15px_#00F0FF]' : 'bg-white/10 text-white border border-white/20'
                      }`}
                    >
                      {isFree ? <span className="text-xs">FREE</span> : cell}
                    </motion.div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Last Called */}
      {drawnNumbers.length > 0 && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`${glassEffect} rounded-2xl p-6 mb-8 min-w-[400px] text-center`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Last Called</p>
          <p className="text-6xl font-black text-[#00F0FF]">
            {['B', 'I', 'N', 'G', 'O'][Math.floor((drawnNumbers[drawnNumbers.length - 1] - 1) / 15)]}
            {drawnNumbers[drawnNumbers.length - 1]}
          </p>
          <p className="text-sm text-white/60 mt-2">{drawnNumbers.length} / 75 called</p>
        </motion.div>
      )}

      {/* BINGO! */}
      <AnimatePresence>
        {currentState === GameState.BINGO && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            className="text-8xl font-black text-[#00F0FF] mb-8"
          >
            BINGO!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        {currentState === GameState.WAITING && (
          <button 
            onClick={startGame}
            disabled={credits < 10}
            className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            New Card ($10)
          </button>
        )}

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>
    </div>
  );
};

export default Bingo;