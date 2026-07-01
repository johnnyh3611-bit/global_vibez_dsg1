
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { SuitConfetti } from './ParticleSystem';

export function PremiumReversiTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'royal', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [aiAvatar] = useState(() => getRandomAvatar());
  
  // 8x8 board
  const board = game?.game_state?.board || Array(64).fill('');
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const playerScore = game?.game_state?.player_score || 2;
  const aiScore = game?.game_state?.ai_score || 2;

  const handleCellClick = (index) => {
    if (makingMove || aiThinking || gameOver || currentPlayer !== 'player') return;
    onMove({ position: index });
  };

  const getCell = (row, col) => board[row * 8 + col];

  // 2D Top-Down View
  if (view === '2d') {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <ViewToggle view={view} onToggle={setView} />
        <UserAvatarManager />
        
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-green-500/50"
          >
            <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 bg-clip-text text-center">
              ⚫ Reversi / Othello ⚪
            </h2>
            <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Strategy Games</p>
          </motion.div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="p-4 bg-gradient-to-br from-green-800 to-green-950 rounded-2xl shadow-2xl">
              <div className="grid grid-cols-8 gap-1">
                {Array(8).fill(0).map((_, row) => (
                  Array(8).fill(0).map((_, col) => {
                    const index = row * 8 + col;
                    const piece = getCell(row, col);
                    
                    return (
                      <motion.button
                        key={`reversi-${index}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCellClick(index)}
                        disabled={gameOver || currentPlayer !== 'player'}
                        className="w-16 h-16 bg-green-700 hover:bg-green-600 rounded-sm flex items-center justify-center transition-colors"
                      >
                        {piece === 'black' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-900 to-black border-2 border-gray-700 shadow-lg"
                          />
                        )}
                        {piece === 'white' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-white to-gray-200 border-2 border-gray-300 shadow-lg"
                          />
                        )}
                      </motion.button>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-24 left-8 z-20">
          <motion.div className="bg-black/70 backdrop-blur-xl px-6 py-4 rounded-xl border-2 border-gray-900/50">
            <p className="text-gray-200 font-bold mb-2">⚫ You: {playerScore}</p>
            <p className="text-gray-400 font-bold">⚪ AI: {aiScore}</p>
          </motion.div>
        </div>

        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="text-9xl mb-4">{playerWon ? '🏆' : '😔'}</div>
                <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-green-400' : 'text-red-400'}`}>
                  {playerWon ? 'YOU WIN!' : 'AI WINS!'}
                </h3>
                <p className="text-white text-2xl mb-6">Final Score: {playerScore} - {aiScore}</p>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black px-8 py-4 rounded-xl text-lg"
                >
                  🎮 PLAY AGAIN
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <SuitConfetti active={playerWon} colors={['#10B981', '#059669', '#047857']} />
      </div>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#10B981', '#059669', '#047857']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) translateZ(50px) rotateX(20deg)',
          }}
        >
          <div className="p-4 bg-gradient-to-br from-green-800 to-green-950 rounded-2xl shadow-2xl">
            <div className="grid grid-cols-8 gap-1">
              {Array(8).fill(0).map((_, row) => (
                Array(8).fill(0).map((_, col) => {
                  const index = row * 8 + col;
                  const piece = getCell(row, col);
                  
                  return (
                    <motion.button
                      key={`reversi-${index}`}
                      whileHover={{ scale: 1.05, translateZ: 10 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCellClick(index)}
                      disabled={gameOver}
                      className="w-14 h-14 bg-green-700 rounded-sm flex items-center justify-center"
                    >
                      {piece === 'black' && (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-900 to-black border-2 border-gray-700 shadow-lg" />
                      )}
                      {piece === 'white' && (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white to-gray-200 border-2 border-gray-300 shadow-lg" />
                      )}
                    </motion.button>
                  );
                })
              ))}
            </div>
          </div>
        </div>
      </PremiumGameTable>

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-green-500/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 bg-clip-text text-center">
            ⚫ Reversi / Othello ⚪
          </h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Strategy Games</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <div className="text-9xl mb-4">{playerWon ? '🏆' : '😔'}</div>
              <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-green-400' : 'text-red-400'}`}>
                {playerWon ? 'YOU WIN!' : 'AI WINS!'}
              </h3>
              <p className="text-white text-2xl mb-6">Final Score: {playerScore} - {aiScore}</p>
              <button
                onClick={() => onMove({ action: 'new_game' })}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black px-8 py-4 rounded-xl text-lg"
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
