
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicCelebration } from '@/components/CinematicCelebration';
import { useWindowSize } from 'react-use';
import { BoardGameLayout, BoardStatBadge } from './BoardGameLayout';
import { AIOpponentCard } from '@/components/AIOpponentCard';
import { getRandomOpponent } from '@/data/aiOpponents';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
// Professional Reversi Disc Component
const ReversiDisc = ({ color, flipping = false }) => {
  return (
    <motion.div
      initial={flipping ? { rotateY: 0 } : {}}
      animate={flipping ? { rotateY: 180 } : {}}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="w-full h-full rounded-full relative"
      style={{
        background: color === 'player' 
          ? 'radial-gradient(circle at 35% 35%, #ffffff, #f3f4f6, #d1d5db)'
          : 'radial-gradient(circle at 35% 35%, #4b5563, #1f2937, #111827)',
        boxShadow: `0 4px 12px ${color === 'player' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.7)'}, inset 0 2px 6px rgba(255, 255, 255, 0.2)`,
        border: '2px solid rgba(255, 255, 255, 0.2)',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Shine effect */}
      <div 
        className="absolute top-2 left-2 w-6 h-6 rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.9), transparent)'
        }}
      />
      
      {/* Inner ring */}
      <div 
        className="absolute inset-2 rounded-full"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      />
    </motion.div>
  );
};

export function PracticeReversi({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const board = game.game_state?.board || Array(8).fill(null).map(() => Array(8).fill(""));
  const [validMoves, setValidMoves] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [flippingCells, setFlippingCells] = useState([]);
  const [scores, setScores] = useState({ player: 2, ai: 2 });
  const [gameResult, setGameResult] = useState(null);
  const [aiOpponent, setAiOpponent] = useState(null);
  const { width, height } = useWindowSize();
  
  const gameOver = game.status === 'completed';
  const playerWon = gameOver && game.winner === 'player';

  useEffect(() => {
    if (!aiOpponent) {
      setAiOpponent(getRandomOpponent());
    }
  }, []);

  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        cardSoundManager.playWinSound(); // AAA Card Juice
        setGameResult({ type: 'win', message: 'You Win! 🎉' });
      } else if (game.winner === 'ai') {
        cardSoundManager.playLoseSound(); // AAA Card Juice
        setGameResult({ type: 'lose', message: `${aiOpponent?.name || 'AI'} Wins! 😔` });
      } else {
        setGameResult({ type: 'draw', message: "It's a Draw! 🤝" });
      }
    }
  }, [gameOver, game.winner, aiOpponent]);

  // Calculate scores
  useEffect(() => {
    let playerCount = 0;
    let aiCount = 0;
    board.forEach(row => {
      row.forEach(cell => {
        if (cell === 'player') playerCount++;
        if (cell === 'ai') aiCount++;
      });
    });
    setScores({ player: playerCount, ai: aiCount });
  }, [board]);

  // Calculate valid moves (simplified - actual validation happens in backend)
  useEffect(() => {
    if (game.current_turn === 'player' && !gameOver) {
      const valid = [];
      board.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell === "") {
            // Simplified check - just mark empty cells as potentially valid
            valid.push([i, j]);
          }
        });
      });
      setValidMoves(valid);
    } else {
      setValidMoves([]);
    }
  }, [game.current_turn, board, gameOver]);

  const handleCellClick = (row, col) => {
    if (board[row][col] === "" && !gameOver && !makingMove && !aiThinking) {
      onMove({ row, col });
    }
  };

  const isValidMove = (row, col) => {
    return validMoves.some(([r, c]) => r === row && c === col);
  };

  return (
    <>
      {/* Cinematic Celebration */}
      <AnimatePresence>
        {gameResult && (
          <CinematicCelebration
            result={gameResult.type}
            message={gameResult.message}
            opponentName={aiOpponent?.name || 'AI'}
            playerScore={scores.player}
            opponentScore={scores.ai}
            coinsEarned={gameResult.type === 'win' ? 100 : 0}
            onRestart={() => window.location.reload()}
            onContinue={() => window.history.back()}
          />
        )}
      </AnimatePresence>

      {/* BOARD GAME LAYOUT */}
      <BoardGameLayout
        topLeftStat={
          <BoardStatBadge 
            label="Your Discs" 
            value={scores.player}
            icon="⚪"
            color="green"
          />
        }
        
        topRightStat={
          <AIOpponentCard opponent={aiOpponent} compact={true} />
        }
        
        gameTitle={
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border-4 border-gray-500"
            style={{ boxShadow: '0 0 40px rgba(156, 163, 175, 0.8)' }}
          >
            <p className="text-3xl font-black text-transparent bg-gradient-to-r from-gray-100 via-gray-400 to-gray-900 bg-clip-text">
              ⚫ REVERSI ⚪
            </p>
          </motion.div>
        }
        
        gameBoard={
          /* Wooden Frame */
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #78350f 100%)',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {/* Wood texture */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)`
              }}
            />

            {/* Felt Board */}
            <div 
              className="relative rounded-2xl overflow-hidden border-4 border-amber-950"
              style={{
                background: 'linear-gradient(135deg, #15803d 0%, #166534 50%, #15803d 100%)',
                padding: '12px',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Felt texture */}
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
                }}
              />

              {/* Grid */}
              <div className="relative grid grid-cols-8 gap-1">
                {board.map((row, i) =>
                  row.map((cell, j) => {
                    const isHovered = hoveredCell && hoveredCell[0] === i && hoveredCell[1] === j;
                    const isValid = isValidMove(i, j);
                    const canPlay = cell === "" && !gameOver && !makingMove && !aiThinking;
                    
                    return (
                      <motion.button
                        key={`${i}-${j}`}
                        onClick={() => handleCellClick(i, j)}
                        onMouseEnter={() => canPlay && setHoveredCell([i, j])}
                        onMouseLeave={() => setHoveredCell(null)}
                        disabled={!canPlay}
                        whileHover={canPlay ? { scale: 1.05 } : {}}
                        whileTap={canPlay ? { scale: 0.95 } : {}}
                        className="aspect-square rounded-sm flex items-center justify-center p-1 transition-all relative"
                        style={{
                          background: isHovered && isValid 
                            ? 'rgba(34, 197, 94, 0.2)' 
                            : 'rgba(21, 128, 61, 0.3)',
                          border: isHovered && isValid ? '2px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(0, 0, 0, 0.2)',
                          boxShadow: isHovered && isValid ? 'inset 0 0 15px rgba(34, 197, 94, 0.3)' : 'none',
                          cursor: canPlay ? 'pointer' : 'default'
                        }}
                      >
                        {/* Valid move indicator */}
                        {isValid && !cell && !isHovered && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0.8, 1, 0.8] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{
                                background: 'radial-gradient(circle, rgba(34, 197, 94, 0.6), rgba(34, 197, 94, 0.2))',
                                boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                              }}
                            />
                          </motion.div>
                        )}

                        {/* Hover preview */}
                        {isHovered && !cell && isValid && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 0.9, opacity: 0.5 }}
                            className="absolute inset-0 p-1"
                          >
                            <ReversiDisc color="player" />
                          </motion.div>
                        )}

                        {/* Actual disc */}
                        {cell && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-full h-full"
                          >
                            <ReversiDisc 
                              color={cell} 
                              flipping={flippingCells.some(([r, c]) => r === i && c === j)}
                            />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        }
        
        bottomActions={
          !gameOver && (
            <div className="text-center space-y-2">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-green-400 font-bold text-lg"
              >
                {game.current_turn === 'player' 
                  ? '⚪ Your Turn - Place Disc' 
                  : '⏳ AI Thinking...'}
              </motion.p>
              <p className="text-white/60 text-sm">
                🎯 Flip opponent pieces to your color!
              </p>
            </div>
          )
        }
      />
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
