
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { SuitConfetti } from './ParticleSystem';

const PIECES = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

export function PremiumChessTable({ game, onMove, makingMove, aiThinking, theme = 'emerald' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [aiAvatar] = useState(() => getRandomAvatar());
  const [selectedPiece, setSelectedPiece] = useState(null);
  
  const board = game?.game_state?.board || Array(64).fill('');
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';

  const handleCellClick = (index) => {
    if (makingMove || aiThinking || gameOver || currentPlayer !== 'player') return;
    const piece = board[index];
    if (piece && piece === piece.toUpperCase()) {
      setSelectedPiece(index);
    } else if (selectedPiece !== null) {
      onMove({ from: selectedPiece, to: index });
      setSelectedPiece(null);
    }
  };

  const getCell = (row, col) => board[row * 8 + col];
  const isLight = (row, col) => (row + col) % 2 === 0;

  if (view === '2d') {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <ViewToggle view={view} onToggle={setView} />
        <UserAvatarManager />
        
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30">
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-purple-500/50">
            <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-500 to-purple-400 bg-clip-text text-center">♔ Chess ♚</h2>
            <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Strategy Games</p>
          </motion.div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-6 bg-gradient-to-br from-yellow-800 to-yellow-950 rounded-2xl shadow-2xl">
            <div className="grid grid-cols-8 gap-0">
              {Array(8).fill(0).map((_, row) => (
                Array(8).fill(0).map((_, col) => {
                  const index = row * 8 + col;
                  const piece = getCell(row, col);
                  const light = isLight(row, col);
                  const selected = selectedPiece === index;
                  
                  return (
                    <motion.button key={`chess-cell-${index}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleCellClick(index)} disabled={gameOver} className={`w-16 h-16 flex items-center justify-center text-5xl ${light ? selected ? 'bg-green-400' : 'bg-yellow-100' : selected ? 'bg-green-600' : 'bg-yellow-800'}`}>
                      {piece && PIECES[piece]}
                    </motion.button>
                  );
                })
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {gameOver && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                <div className="text-9xl mb-4">{playerWon ? '🏆' : '😔'}</div>
                <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-purple-400' : 'text-red-400'}`}>{playerWon ? 'CHECKMATE! YOU WIN!' : 'CHECKMATE! AI WINS!'}</h3>
                <button onClick={() => onMove({ action: 'new_game' })} className="mt-6 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black px-8 py-4 rounded-xl text-lg">🎮 PLAY AGAIN</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <SuitConfetti active={playerWon} colors={['#A855F7', '#D946EF', '#EC4899']} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#A855F7', '#D946EF', '#EC4899']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%) translateZ(50px) rotateX(20deg)' }}>
          <div className="p-6 bg-gradient-to-br from-yellow-800 to-yellow-950 rounded-2xl shadow-2xl">
            <div className="grid grid-cols-8 gap-0">
              {Array(8).fill(0).map((_, row) => (
                Array(8).fill(0).map((_, col) => {
                  const index = row * 8 + col;
                  const piece = getCell(row, col);
                  const light = isLight(row, col);
                  const selected = selectedPiece === index;
                  
                  return (
                    <motion.button key={`item-${index}`} whileHover={{ scale: 1.05, translateZ: 10 }} whileTap={{ scale: 0.95 }} onClick={() => handleCellClick(index)} disabled={gameOver} className={`w-14 h-14 flex items-center justify-center text-4xl ${light ? selected ? 'bg-green-400' : 'bg-yellow-100' : selected ? 'bg-green-600' : 'bg-yellow-800'}`}>
                      {piece && PIECES[piece]}
                    </motion.button>
                  );
                })
              ))}
            </div>
          </div>
        </div>
      </PremiumGameTable>

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-purple-500/30">
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-500 to-purple-400 bg-clip-text text-center">♔ Chess ♚</h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Strategy Games</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {gameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
              <div className="text-9xl mb-4">{playerWon ? '🏆' : '😔'}</div>
              <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-purple-400' : 'text-red-400'}`}>{playerWon ? 'CHECKMATE! YOU WIN!' : 'CHECKMATE! AI WINS!'}</h3>
              <button onClick={() => onMove({ action: 'new_game' })} className="mt-6 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black px-8 py-4 rounded-xl text-lg">🎮 PLAY AGAIN</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
