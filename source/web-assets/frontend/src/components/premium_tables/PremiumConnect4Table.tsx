
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { SuitConfetti } from './ParticleSystem';

export function PremiumConnect4Table({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'rose', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [aiAvatar] = useState(() => getRandomAvatar());
  
  // 6 rows x 7 columns
  const board = game?.game_state?.board || Array(42).fill('');
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const isDraw = gameOver && game?.winner === 'draw';

  const handleColumnClick = (col) => {
    if (makingMove || aiThinking || gameOver || currentPlayer !== 'player') return;
    onMove({ column: col });
  };

  const getCell = (row, col) => board[row * 7 + col];

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
            className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-yellow-500/50"
          >
            <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-center">
              🔴 Connect 4 🔵
            </h2>
            <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Classic Games</p>
          </motion.div>
        </div>

        {/* Game Board */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Blue frame */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl shadow-2xl">
              <div className="grid grid-cols-7 gap-3">
                {Array(6).fill(0).map((_, row) => (
                  Array(7).fill(0).map((_, col) => {
                    const cell = getCell(row, col);
                    return (
                      <motion.div
                        key={`${row}-${col}`}
                        className="w-16 h-16 rounded-full bg-gray-900 shadow-inner flex items-center justify-center overflow-hidden"
                        whileHover={{ scale: !gameOver && row === 0 ? 1.1 : 1 }}
                      >
                        {cell === 'red' && (
                          <motion.div
                            initial={{ scale: 0, y: -100 }}
                            animate={{ scale: 1, y: 0 }}
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg"
                          />
                        )}
                        {cell === 'yellow' && (
                          <motion.div
                            initial={{ scale: 0, y: -100 }}
                            animate={{ scale: 1, y: 0 }}
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg"
                          />
                        )}
                      </motion.div>
                    );
                  })
                ))}
              </div>
              
              {/* Column click areas (top row) */}
              <div className="absolute top-0 left-6 right-6 h-20 flex gap-3">
                {Array(7).fill(0).map((_, col) => (
                  <motion.button
                    key={col}
                    whileHover={{ y: -5 }}
                    whileTap={{ y: 0 }}
                    onClick={() => handleColumnClick(col)}
                    disabled={gameOver || currentPlayer !== 'player'}
                    className="flex-1 h-full flex items-center justify-center text-3xl cursor-pointer hover:bg-yellow-400/20 rounded-t-xl transition-colors disabled:opacity-50"
                  >
                    <span className="text-yellow-400">⬇️</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Player Avatars */}
        <div className="absolute bottom-8 left-8 z-20">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-red-500/50"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-2xl">
              {userAvatar?.emoji || '👤'}
            </div>
            <div>
              <p className="text-red-400 font-bold">You (🔴)</p>
              <p className="text-white/60 text-xs">{currentPlayer === 'player' ? 'Your Turn' : 'Waiting...'}</p>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 right-8 z-20">
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-yellow-500/50"
          >
            <div>
              <p className="text-yellow-400 font-bold">AI (🔵)</p>
              <p className="text-white/60 text-xs">{currentPlayer === 'ai' ? 'Thinking...' : 'Waiting...'}</p>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-2xl">
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
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-9xl mb-4"
                >
                  {playerWon ? '🏆' : isDraw ? '🤝' : '😔'}
                </motion.div>
                <h3 className={`text-6xl font-black mb-4 ${
                  playerWon
                    ? 'text-transparent bg-gradient-to-r from-red-400 via-red-500 to-red-400 bg-clip-text' 
                    : isDraw
                    ? 'text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text'
                    : 'text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text'
                }`}>
                  {playerWon ? 'YOU WIN!' : isDraw ? "IT'S A DRAW!" : 'AI WINS!'}
                </h3>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="mt-6 bg-gradient-to-r from-red-600 to-yellow-600 text-white font-black px-8 py-4 rounded-xl text-lg"
                >
                  🎮 PLAY AGAIN
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <SuitConfetti active={playerWon} colors={['#EF4444', '#F59E0B', '#FBBF24']} />
      </div>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#EF4444', '#F59E0B', '#FBBF24']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        {/* 3D Board */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) translateZ(50px) rotateX(15deg)',
          }}
        >
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-3xl shadow-2xl">
            <div className="grid grid-cols-7 gap-3">
              {Array(6).fill(0).map((_, row) => (
                Array(7).fill(0).map((_, col) => {
                  const cell = getCell(row, col);
                  return (
                    <motion.div
                      key={`${row}-${col}`}
                      className="w-14 h-14 rounded-full bg-gray-900 shadow-inner flex items-center justify-center"
                    >
                      {cell === 'red' && (
                        <motion.div
                          initial={{ scale: 0, y: -100 }}
                          animate={{ scale: 1, y: 0 }}
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg"
                        />
                      )}
                      {cell === 'yellow' && (
                        <motion.div
                          initial={{ scale: 0, y: -100 }}
                          animate={{ scale: 1, y: 0 }}
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg"
                        />
                      )}
                    </motion.div>
                  );
                })
              ))}
            </div>
            
            {/* Column buttons */}
            <div className="flex gap-3 mt-4">
              {Array(7).fill(0).map((_, col) => (
                <motion.button
                  key={col}
                  whileHover={{ scale: 1.1, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleColumnClick(col)}
                  disabled={gameOver || currentPlayer !== 'player'}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-2 rounded-xl disabled:opacity-50 transition-all"
                >
                  ⬇️
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </PremiumGameTable>

      {/* Header */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-yellow-500/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-center">
            🔴 Connect 4 🔵
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
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-9xl mb-4"
              >
                {playerWon ? '🏆' : isDraw ? '🤝' : '😔'}
              </motion.div>
              <h3 className={`text-6xl font-black mb-4 ${
                playerWon
                  ? 'text-transparent bg-gradient-to-r from-red-400 via-red-500 to-red-400 bg-clip-text' 
                  : isDraw
                  ? 'text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text'
                  : 'text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text'
              }`}>
                {playerWon ? 'YOU WIN!' : isDraw ? "IT'S A DRAW!" : 'AI WINS!'}
              </h3>
              <button
                onClick={() => onMove({ action: 'new_game' })}
                className="mt-6 bg-gradient-to-r from-red-600 to-yellow-600 text-white font-black px-8 py-4 rounded-xl text-lg"
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
