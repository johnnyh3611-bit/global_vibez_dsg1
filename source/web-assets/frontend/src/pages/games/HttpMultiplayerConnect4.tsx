import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const ROWS = 19;
const COLS = 18;
const WIN_COUNT = 4; // 4 in a row to win

export default function HttpMultiplayerConnect4() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const {
    connected,
    gameId,
    gameState,
    isMyTurn,
    opponent,
    error,
    makeMove,
    endGame,
    leaveGame,
    clearError
  } = useHttpMultiplayer(userId, userName, urlGameId);

  const [board, setBoard] = useState(Array(ROWS * COLS).fill(null));
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winningCells, setWinningCells] = useState([]);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [droppingPiece, setDroppingPiece] = useState(null);

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'red' : 'yellow';
  const opponentColor = myRole === 'player1' ? 'yellow' : 'red';

  // Get lowest available row in a column
  const getLowestRow = (col, currentBoard) => {
    for (let row = ROWS - 1; row >= 0; row--) {
      const index = row * COLS + col;
      if (!currentBoard[index]) return row;
    }
    return -1;
  };

  // Check for winner (4 in a row on 18x19 grid)
  const checkWinner = (currentBoard) => {
    // Helper to check line
    const checkLine = (indices) => {
      const first = currentBoard[indices[0]];
      if (!first) return null;
      if (indices.every(i => currentBoard[i] === first)) {
        return { winner: first, cells: indices };
      }
      return null;
    };

    // Horizontal
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col <= COLS - WIN_COUNT; col++) {
        const indices = [];
        for (let i = 0; i < WIN_COUNT; i++) {
          indices.push(row * COLS + col + i);
        }
        const result = checkLine(indices);
        if (result) return result;
      }
    }

    // Vertical
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row <= ROWS - WIN_COUNT; row++) {
        const indices = [];
        for (let i = 0; i < WIN_COUNT; i++) {
          indices.push((row + i) * COLS + col);
        }
        const result = checkLine(indices);
        if (result) return result;
      }
    }

    // Diagonal (down-right)
    for (let row = 0; row <= ROWS - WIN_COUNT; row++) {
      for (let col = 0; col <= COLS - WIN_COUNT; col++) {
        const indices = [];
        for (let i = 0; i < WIN_COUNT; i++) {
          indices.push((row + i) * COLS + (col + i));
        }
        const result = checkLine(indices);
        if (result) return result;
      }
    }

    // Diagonal (down-left)
    for (let row = 0; row <= ROWS - WIN_COUNT; row++) {
      for (let col = WIN_COUNT - 1; col < COLS; col++) {
        const indices = [];
        for (let i = 0; i < WIN_COUNT; i++) {
          indices.push((row + i) * COLS + (col - i));
        }
        const result = checkLine(indices);
        if (result) return result;
      }
    }

    // Check for draw
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', cells: [] };
    }

    return null;
  };

  // Update board from game state
  useEffect(() => {
    if (gameState?.game_state?.board) {
      setBoard(gameState.game_state.board);
      if (gameState.status === 'completed' && gameState.winner) {
        const result = checkWinner(gameState.game_state.board);
        if (result) handleGameEnd(result);
      }
    }
  }, [gameState]);

  // Handle column click
  const handleColumnClick = async (col) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;

    const lowestRow = getLowestRow(col, board);
    if (lowestRow === -1) return;

    const index = lowestRow * COLS + col;
    const newBoard = [...board];
    newBoard[index] = myColor;

    setDroppingPiece({ col, row: lowestRow, color: myColor });
    setTimeout(() => setDroppingPiece(null), 500);
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result) {
      const winnerRole = result.winner === myColor ? myRole : (myRole === 'player1' ? 'player2' : 'player1');
      await makeMove({ col, row: lowestRow, color: myColor }, { board: newBoard });
      if (result.winner !== 'draw') await endGame(winnerRole);
      handleGameEnd(result);
    } else {
      await makeMove({ col, row: lowestRow, color: myColor }, { board: newBoard });
    }
  };

  const handleGameEnd = (result) => {
    if (result.winner === 'draw') {
      setLocalGameStatus('draw');
      setWinningCells([]);
    } else if (result.winner === myColor) {
      setLocalGameStatus('won');
      setWinner(myColor);
      setWinningCells(result.cells);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setLocalGameStatus('lost');
      setWinner(result.winner);
      setWinningCells(result.cells);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'completed') {
    const serverWinner = gameState.winner;
    const iWon = serverWinner ? serverWinner === myRole : false;
    return (
      <WinCelebration
        won={iWon}
        gameId={gameId}
        userId={userId}
        gameLabel="Connect 4"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="connect4-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        

        {/* Players Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${gameState.current_turn === 'player1' ? 'bg-red-600/30 border-red-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500 rounded-full border-4 border-red-700 shadow-lg" />
              <div className="flex-1">
                <p className="font-bold text-lg">{player1Name}</p>
                <p className="text-xs text-gray-300">Red Player</p>
              </div>
              {gameState.current_turn === 'player1' && <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />}
            </div>
          </Card>

          <Card className={`p-4 ${gameState.current_turn === 'player2' ? 'bg-yellow-600/30 border-yellow-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-400 rounded-full border-4 border-yellow-600 shadow-lg" />
              <div className="flex-1">
                <p className="font-bold text-lg">{player2Name}</p>
                <p className="text-xs text-gray-300">Yellow Player</p>
              </div>
              {gameState.current_turn === 'player2' && <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />}
            </div>
          </Card>
        </div>

        {/* Turn Indicator */}
        <AnimatePresence mode="wait">
          {localGameStatus === 'playing' && (
            <motion.div key="turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-4 ${isMyTurn ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gray-700'} backdrop-blur-xl border-2 ${isMyTurn ? 'border-green-400' : 'border-gray-500'}`}>
                <p className="text-xl sm:text-2xl font-black">{isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Board */}
        <Card className="bg-blue-800/50 backdrop-blur-xl border-4 border-blue-600 p-2 sm:p-4 mb-6 shadow-2xl">
          <div className="w-full mx-auto" style={{ maxWidth: '95vmin' }}>
            {/* Column hover preview */}
            <div 
              className="grid gap-0.5 sm:gap-1 mb-1 sm:mb-2"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: COLS }).map((_, col) => (
                <div 
                  key={col} 
                  className="aspect-square flex items-center justify-center" 
                  onMouseEnter={() => setHoveredColumn(col)} 
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  {isMyTurn && localGameStatus === 'playing' && hoveredColumn === col && getLowestRow(col, board) !== -1 && (
                    <motion.div 
                      initial={{ y: -20, opacity: 0 }} 
                      animate={{ y: 0, opacity: 0.5 }} 
                      className={`w-3/4 h-3/4 rounded-full ${myColor === 'red' ? 'bg-red-500' : 'bg-yellow-400'}`} 
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Board */}
            <div 
              className="grid gap-0.5 sm:gap-1 bg-blue-700 p-1 sm:p-2 rounded-xl"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: ROWS }).map((_, row) => (
                Array.from({ length: COLS }).map((_, col) => {
                  const index = row * COLS + col;
                  const cell = board[index];
                  const isWinning = winningCells.includes(index);

                  return (
                    <motion.button
                      key={`item-${index}`}
                      whileHover={isMyTurn && localGameStatus === 'playing' && getLowestRow(col, board) !== -1 ? { scale: 1.05 } : {}}
                      onClick={() => handleColumnClick(col)}
                      disabled={!isMyTurn || localGameStatus !== 'playing'}
                      className="aspect-square rounded-full flex items-center justify-center relative transition-all"
                      style={{ 
                        background: cell 
                          ? (cell === 'red' ? 'linear-gradient(145deg, #ef4444, #dc2626)' : 'linear-gradient(145deg, #fbbf24, #f59e0b)') 
                          : '#1e3a8a',
                        minWidth: 0,
                        minHeight: 0
                      }}
                    >
                      {!cell && <div className="absolute inset-1 rounded-full bg-blue-900/50" />}
                      <AnimatePresence>
                        {cell && (
                          <motion.div
                            initial={{ y: -300, scale: 0.8 }}
                            animate={{ y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className={`absolute inset-0.5 sm:inset-1 rounded-full border-2 ${cell === 'red' ? 'border-red-700' : 'border-yellow-600'} ${isWinning ? 'animate-pulse shadow-2xl ring-2 ring-white' : ''}`}
                          />
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })
              ))}
            </div>
          </div>
        </Card>

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-6 backdrop-blur-xl border-4 ${localGameStatus === 'won' ? 'bg-gradient-to-br from-green-600 to-emerald-600 border-green-400' : localGameStatus === 'lost' ? 'bg-gradient-to-br from-red-600 to-rose-600 border-red-400' : 'bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400'}`}>
                <div className="text-6xl mb-4">{localGameStatus === 'won' ? '🏆' : localGameStatus === 'lost' ? '😢' : '🤝'}</div>
                <h2 className="text-3xl sm:text-4xl font-black mb-2">{localGameStatus === 'won' ? 'YOU WIN!' : localGameStatus === 'lost' ? 'YOU LOSE!' : 'DRAW!'}</h2>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 font-bold text-lg py-6 px-8 rounded-xl">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave Game
          </Button>
          {localGameStatus !== 'playing' && (
            <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 font-bold text-lg py-6 px-8 rounded-xl">
              🔄 Play Again
            </Button>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-6 max-w-md mx-auto bg-red-600 text-white px-4 py-3 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
