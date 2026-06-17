
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { motion, AnimatePresence } from 'framer-motion';
import { SuitConfetti } from './ParticleSystem';

export function PremiumCheckersTable({ game, 
  onMove, 
  makingMove, 
  aiThinking,
  theme = 'midnight', }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [aiAvatar] = useState(() => getRandomAvatar());
  const [selectedPiece, setSelectedPiece] = useState(null);
  
  // 8x8 board
  const board = game?.game_state?.board || Array(64).fill(null);
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';
  const playerPieces = game?.game_state?.player_pieces || 12;
  const aiPieces = game?.game_state?.ai_pieces || 12;

  const handleCellClick = (index) => {
    if (makingMove || aiThinking || gameOver || currentPlayer !== 'player') return;
    
    const piece = board[index];
    if (piece && piece.startsWith('player')) {
      setSelectedPiece(index);
    } else if (selectedPiece !== null) {
      onMove({ from: selectedPiece, to: index });
      setSelectedPiece(null);
    }
  };

  const getCell = (row, col) => board[row * 8 + col];
  const isBlackSquare = (row, col) => (row + col) % 2 === 1;

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
            className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-red-500/50"
          >
            <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-red-400 via-red-500 to-orange-500 bg-clip-text text-center">
              ⚫ Checkers ⚪
            </h2>
            <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Classic Games</p>
          </motion.div>
        </div>

        {/* Game Board */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Gold frame */}
            <div className="p-4 bg-gradient-to-br from-yellow-700 to-yellow-900 rounded-2xl shadow-2xl">
              <div className="grid grid-cols-8 gap-0">
                {Array(8).fill(0).map((_, row) => (
                  Array(8).fill(0).map((_, col) => {
                    const index = row * 8 + col;
                    const piece = getCell(row, col);
                    const isBlack = isBlackSquare(row, col);
                    const isSelected = selectedPiece === index;
                    
                    return (
                      <motion.button
                        key={`checkers-${index}`}
                        whileHover={{ scale: isBlack ? 1.05 : 1 }}
                        whileTap={{ scale: isBlack ? 0.95 : 1 }}
                        onClick={() => handleCellClick(index)}
                        disabled={!isBlack || gameOver}
                        className={`w-16 h-16 flex items-center justify-center ${
                          isBlack 
                            ? isSelected 
                              ? 'bg-green-600' 
                              : 'bg-gray-800 hover:bg-gray-700' 
                            : 'bg-red-100'
                        } transition-colors`}
                      >
                        {piece === 'player' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-300 shadow-lg"
                          />
                        )}
                        {piece === 'player_king' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-4 border-yellow-400 shadow-lg flex items-center justify-center text-xl"
                          >
                            👑
                          </motion.div>
                        )}
                        {piece === 'ai' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 border-2 border-gray-100 shadow-lg"
                          />
                        )}
                        {piece === 'ai_king' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 border-4 border-yellow-400 shadow-lg flex items-center justify-center text-xl"
                          >
                            👑
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Player Stats */}
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
              <p className="text-red-400 font-bold">You (Red)</p>
              <p className="text-white/60 text-xs">{playerPieces} pieces</p>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-8 right-8 z-20">
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-black/70 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-gray-500/50"
          >
            <div>
              <p className="text-gray-300 font-bold">AI (White)</p>
              <p className="text-white/60 text-xs">{aiPieces} pieces</p>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center text-2xl">
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
                  {playerWon ? '🏆' : '😔'}
                </motion.div>
                <h3 className={`text-6xl font-black mb-4 ${
                  playerWon
                    ? 'text-transparent bg-gradient-to-r from-red-400 via-red-500 to-red-400 bg-clip-text' 
                    : 'text-transparent bg-gradient-to-r from-gray-400 to-gray-600 bg-clip-text'
                }`}>
                  {playerWon ? 'YOU WIN!' : 'AI WINS!'}
                </h3>
                <button
                  onClick={() => onMove({ action: 'new_game' })}
                  className="mt-6 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black px-8 py-4 rounded-xl text-lg"
                >
                  🎮 PLAY AGAIN
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <SuitConfetti active={playerWon} colors={['#EF4444', '#F97316', '#FCD34D']} />
      </div>
    );
  }

  // 3D View
  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#EF4444', '#F97316', '#FCD34D']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        {/* 3D Board */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) translateZ(50px) rotateX(20deg)',
          }}
        >
          <div className="p-4 bg-gradient-to-br from-yellow-700 to-yellow-900 rounded-2xl shadow-2xl">
            <div className="grid grid-cols-8 gap-0">
              {Array(8).fill(0).map((_, row) => (
                Array(8).fill(0).map((_, col) => {
                  const index = row * 8 + col;
                  const piece = getCell(row, col);
                  const isBlack = isBlackSquare(row, col);
                  const isSelected = selectedPiece === index;
                  
                  return (
                    <motion.button
                      key={`checkers-${index}`}
                      whileHover={{ scale: isBlack ? 1.05 : 1, translateZ: 10 }}
                      whileTap={{ scale: isBlack ? 0.95 : 1 }}
                      onClick={() => handleCellClick(index)}
                      disabled={!isBlack || gameOver}
                      className={`w-14 h-14 flex items-center justify-center ${
                        isBlack 
                          ? isSelected 
                            ? 'bg-green-600' 
                            : 'bg-gray-800' 
                          : 'bg-red-100'
                      }`}
                    >
                      {piece === 'player' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-300 shadow-lg" />
                      )}
                      {piece === 'player_king' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-4 border-yellow-400 shadow-lg flex items-center justify-center text-sm">
                          👑
                        </div>
                      )}
                      {piece === 'ai' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 border-2 border-gray-100 shadow-lg" />
                      )}
                      {piece === 'ai_king' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 border-4 border-yellow-400 shadow-lg flex items-center justify-center text-sm">
                          👑
                        </div>
                      )}
                    </motion.button>
                  );
                })
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
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-red-500/30"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-red-400 via-red-500 to-orange-500 bg-clip-text text-center">
            ⚫ Checkers ⚪
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
                {playerWon ? '🏆' : '😔'}
              </motion.div>
              <h3 className={`text-6xl font-black mb-4 ${
                playerWon
                  ? 'text-transparent bg-gradient-to-r from-red-400 via-red-500 to-red-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-gray-400 to-gray-600 bg-clip-text'
              }`}>
                {playerWon ? 'YOU WIN!' : 'AI WINS!'}
              </h3>
              <button
                onClick={() => onMove({ action: 'new_game' })}
                className="mt-6 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black px-8 py-4 rounded-xl text-lg"
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
