import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicCelebration } from '@/components/CinematicCelebration';
import { useWindowSize } from 'react-use';
import { BoardGameLayout, BoardStatBadge } from './BoardGameLayout';
import { TableSelectorButton } from './TableSelectorButton';
import { AIOpponentCard } from '@/components/AIOpponentCard';
import { getRandomOpponent } from '@/data/aiOpponents';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
export function PracticeCheckers({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  // Build the classic 8x8 Checkers starting position on dark squares:
  //   rows 0-2 = AI (black) pieces, row 3-4 empty, rows 5-7 = player (red) pieces.
  // Only dark squares (where (row + col) % 2 === 1) hold pieces.
  const buildInitialBoard = () => {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        if (!isDark) continue;
        if (r < 3) b[r][c] = 'ai';
        else if (r > 4) b[r][c] = 'player';
      }
    }
    return b;
  };
  const initialBoard = React.useMemo(buildInitialBoard, []);
  const board = game.game_state?.board || initialBoard;
  const playerPieces = game.game_state?.player_pieces || 12;
  const aiPieces = game.game_state?.ai_pieces || 12;
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [selectedTable, setSelectedTable] = useState('simple_clean');
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

  const handleCellClick = (row, col) => {
    if (gameOver || makingMove || aiThinking || game.current_turn !== 'player') return;

    const piece = board[row][col];
    
    if (selectedPiece) {
      // Try to move
      onMove({ 
        from: selectedPiece, 
        to: { row, col } 
      });
      setSelectedPiece(null);
    } else if (piece && piece.startsWith('player')) {
      // Select piece
      setSelectedPiece({ row, col });
    }
  };

  const getPieceColor = (piece) => {
    if (!piece) return null;
    // Handle both string and object piece formats
    if (typeof piece === 'string') {
      if (piece.startsWith('player')) return 'red';
      if (piece.startsWith('ai')) return 'black';
    } else if (typeof piece === 'object') {
      // Handle object format like {color: 'player', king: false}
      if (piece.color === 'player' || piece.player) return 'red';
      if (piece.color === 'ai' || piece.ai) return 'black';
    }
    return null;
  };

  const isKing = (piece) => {
    if (!piece) return false;
    if (typeof piece === 'string') return piece.includes('king');
    if (typeof piece === 'object') return piece.king || piece.isKing;
    return false;
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
            playerScore={playerPieces}
            opponentScore={aiPieces}
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
            label="Your Pieces" 
            value={playerPieces}
            icon="🔴"
            color="red"
          />
        }
        
        topRightStat={
          <AIOpponentCard opponent={aiOpponent} compact={true} />
        }
        
        gameTitle={
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border-4 border-red-500"
            style={{ boxShadow: '0 0 40px rgba(220, 38, 38, 0.8)' }}
          >
            <p className="text-3xl font-black text-transparent bg-gradient-to-r from-red-300 via-gray-300 to-purple-300 bg-clip-text">
              CHECKERS
            </p>
          </motion.div>
        }
        
        gameBoard={
          <div className="inline-block rounded-2xl overflow-hidden border-8 border-amber-800 shadow-2xl">
            <div className="grid grid-cols-8 gap-0">
              {board.map((row, rowIndex) => (
                row.map((cell, colIndex) => {
                  const isDark = (rowIndex + colIndex) % 2 === 1;
                  const piece = cell;
                  const pieceColor = getPieceColor(piece);
                  const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex;
                  
                  return (
                    <motion.button
                      key={`${rowIndex}-${colIndex}`}
                      data-testid={`checkers-cell-${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      disabled={gameOver || makingMove || aiThinking || game.current_turn !== 'player'}
                      whileHover={isDark ? { scale: 1.02 } : {}}
                      className={`w-16 h-16 flex items-center justify-center transition-all ${
                        isDark ? 'bg-amber-900' : 'bg-amber-100'
                      } ${
                        isSelected ? 'ring-4 ring-cyan-400' : ''
                      }`}
                    >
                      {piece && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`w-12 h-12 rounded-full flex items-center justify-center border-4 ${
                            pieceColor === 'red' 
                              ? 'bg-gradient-to-br from-red-500 to-red-700 border-red-300' 
                              : 'bg-gradient-to-br from-gray-800 to-black border-gray-600'
                          }`}
                          style={{
                            boxShadow: `0 4px 12px ${
                              pieceColor === 'red' ? 'rgba(220, 38, 38, 0.6)' : 'rgba(0, 0, 0, 0.8)'
                            }`
                          }}
                        >
                          {isKing(piece) && (
                            <span className="text-yellow-400 text-2xl font-black">👑</span>
                          )}
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })
              ))}
            </div>
          </div>
        }
        
        bottomActions={
          !gameOver && (
            <div className="text-center">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-red-400 font-bold text-lg"
              >
                {game.current_turn === 'player' 
                  ? selectedPiece 
                    ? '🎯 Select Destination' 
                    : '🎯 Select Your Piece' 
                  : '⏳ AI Moving...'}
              </motion.p>
            </div>
          )
        }
      />

      {/* Table Selector Button */}
      <TableSelectorButton onTableChange={setSelectedTable} />
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
