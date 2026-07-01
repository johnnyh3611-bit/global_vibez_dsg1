
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { TopDownGameTable } from './TopDownGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { SuitConfetti } from './ParticleSystem';

export function PremiumTicTacToeTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'emerald', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [aiAvatar] = useState(() => getRandomAvatar());
  
  const board = game?.game_state?.board || ['', '', '', '', '', '', '', '', ''];
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const isDraw = gameOver && game?.winner === 'draw';

  const handleCellClick = (index) => {
    if (makingMove || aiThinking || gameOver || board[index] !== '' || currentPlayer !== 'player') return;
    onMove({ position: index });
  };

  // 2D Top-Down View
  if (view === '2d') {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <ViewToggle view={view} onToggle={setView} />
        <UserAvatarManager />
        
        {/* Header */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-cyan-500/50"
          >
            <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text text-center">
              ⭕ Tic-Tac-Toe ❌
            </h2>
            <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Classic Games</p>
          </motion.div>
        </div>

        {/* Game Board */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-4">
            {board.map((cell, i) => (
              <motion.button
                key={`board-${i}`}
                whileHover={{ scale: cell === '' && !gameOver ? 1.05 : 1 }}
                whileTap={{ scale: cell === '' && !gameOver ? 0.95 : 1 }}
                onClick={() => handleCellClick(i)}
                disabled={cell !== '' || gameOver || currentPlayer !== 'player'}
                className="w-32 h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-cyan-500/50 flex items-center justify-center text-6xl font-black shadow-2xl hover:border-cyan-400 transition-all disabled:opacity-50"
              >
                {cell === 'X' && <span className="text-cyan-400">❌</span>}
                {cell === 'O' && <span className="text-fuchsia-400">⭕</span>}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Player Avatars */}
        <div className="absolute bottom-8 left-8 z-20">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-cyan-500/50"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl">
              {userAvatar?.emoji || '👤'}
            </div>
            <div>
              <p className="text-cyan-400 font-bold">You (❌)</p>
              <p className="text-white/60 text-xs">Your Turn</p>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 right-8 z-20">
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-fuchsia-500/50"
          >
            <div>
              <p className="text-fuchsia-400 font-bold">AI (⭕)</p>
              <p className="text-white/60 text-xs">Thinking...</p>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-fuchsia-500 to-purple-500 flex items-center justify-center text-2xl">
              {aiAvatar?.emoji || '🤖'}
            </div>
          </motion.div>
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-9xl mb-4"
                >
                  {playerWon ? '🏆' : isDraw ? '🤝' : '😔'}
                </motion.div>
                <h3 className={`text-6xl font-black mb-4 ${
                  playerWon
                    ? 'text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text' 
                    : isDraw
                    ? 'text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text'
                    : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
                }`}>
                  {playerWon ? 'YOU WIN!' : isDraw ? "IT'S A DRAW!" : 'AI WINS!'}
                </h3>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="mt-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black px-8 py-4 rounded-xl text-lg"
                >
                  🎮 PLAY AGAIN
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <SuitConfetti active={playerWon} colors={['#22D3EE', '#3B82F6', '#EC4899', '#A855F7']} />
      </div>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#22D3EE', '#3B82F6', '#EC4899', '#A855F7']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        {/* 3D Board */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) translateZ(50px) rotateX(10deg)',
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            {board.map((cell, i) => (
              <motion.button
                key={`board-${i}`}
                whileHover={{ scale: cell === '' && !gameOver ? 1.1 : 1, translateZ: 20 }}
                whileTap={{ scale: cell === '' && !gameOver ? 0.9 : 1 }}
                onClick={() => handleCellClick(i)}
                disabled={cell !== '' || gameOver || currentPlayer !== 'player'}
                className="w-28 h-28 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-4 border-cyan-500/50 flex items-center justify-center text-5xl font-black shadow-2xl hover:border-cyan-400 transition-all disabled:opacity-50"
                style={{
                  boxShadow: '0 10px 30px rgba(34, 211, 238, 0.3)',
                }}
              >
                {cell === 'X' && <span className="text-cyan-400">❌</span>}
                {cell === 'O' && <span className="text-fuchsia-400">⭕</span>}
              </motion.button>
            ))}
          </div>
        </div>
      </PremiumGameTable>

      {/* Header */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-cyan-500/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text text-center">
            ⭕ Tic-Tac-Toe ❌
          </h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Classic Games</p>
        </motion.div>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-9xl mb-4"
              >
                {playerWon ? '🏆' : isDraw ? '🤝' : '😔'}
              </motion.div>
              <h3 className={`text-6xl font-black mb-4 ${
                playerWon
                  ? 'text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text' 
                  : isDraw
                  ? 'text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text'
                  : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
              }`}>
                {playerWon ? 'YOU WIN!' : isDraw ? "IT'S A DRAW!" : 'AI WINS!'}
              </h3>
              <button
                onClick={() => onMove({ action: 'new_game' })}
                className="mt-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black px-8 py-4 rounded-xl text-lg"
              >
                🎮 PLAY AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
