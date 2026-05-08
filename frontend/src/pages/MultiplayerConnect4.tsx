import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const ROWS = 6;
const COLS = 7;

export default function MultiplayerConnect4() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const { width, height } = useWindowSize();
  
  const {
    connected,
    room,
    error,
    makeMove,
    endGame,
    leaveRoom,
    clearError
  } = useMultiplayer();

  const [board, setBoard] = useState(Array(ROWS * COLS).fill(null));
  const [gameStatus, setGameStatus] = useState('playing');
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [winningCells, setWinningCells] = useState([]);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [droppingPiece, setDroppingPiece] = useState(null);

  // AAA Card Juice - Particle effects
  const [particleTrigger, setParticleTrigger] = useState(null);

  // Get user session ID
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    if (connected && !sessionId) {
      setSessionId('mock_session_' + Math.random().toString(36).substr(2, 9));
    }
  }, [connected]);

  // Determine player role
  const isHost = room?.host?.session_id === sessionId;
  const myRole = isHost ? 'host' : 'guest';
  const myColor = isHost ? 'red' : 'yellow';
  const opponentColor = isHost ? 'yellow' : 'red';
  const isMyTurn = room?.current_turn === myRole;

  // Get lowest available row in a column
  const getLowestRow = (col, currentBoard) => {
    for (let row = ROWS - 1; row >= 0; row--) {
      const index = row * COLS + col;
      if (!currentBoard[index]) {
        return row;
      }
    }
    return -1; // Column full
  };

  // Check for winner
  const checkWinner = (currentBoard) => {
    // Horizontal
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS - 3; col++) {
        const idx = row * COLS + col;
        const cells = [idx, idx + 1, idx + 2, idx + 3];
        if (
          currentBoard[cells[0]] &&
          currentBoard[cells[0]] === currentBoard[cells[1]] &&
          currentBoard[cells[0]] === currentBoard[cells[2]] &&
          currentBoard[cells[0]] === currentBoard[cells[3]]
        ) {
          return { winner: currentBoard[cells[0]], cells };
        }
      }
    }

    // Vertical
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS - 3; row++) {
        const idx = row * COLS + col;
        const cells = [idx, idx + COLS, idx + COLS * 2, idx + COLS * 3];
        if (
          currentBoard[cells[0]] &&
          currentBoard[cells[0]] === currentBoard[cells[1]] &&
          currentBoard[cells[0]] === currentBoard[cells[2]] &&
          currentBoard[cells[0]] === currentBoard[cells[3]]
        ) {
          return { winner: currentBoard[cells[0]], cells };
        }
      }
    }

    // Diagonal (down-right)
    for (let row = 0; row < ROWS - 3; row++) {
      for (let col = 0; col < COLS - 3; col++) {
        const idx = row * COLS + col;
        const cells = [idx, idx + COLS + 1, idx + COLS * 2 + 2, idx + COLS * 3 + 3];
        if (
          currentBoard[cells[0]] &&
          currentBoard[cells[0]] === currentBoard[cells[1]] &&
          currentBoard[cells[0]] === currentBoard[cells[2]] &&
          currentBoard[cells[0]] === currentBoard[cells[3]]
        ) {
          return { winner: currentBoard[cells[0]], cells };
        }
      }
    }

    // Diagonal (down-left)
    for (let row = 0; row < ROWS - 3; row++) {
      for (let col = 3; col < COLS; col++) {
        const idx = row * COLS + col;
        const cells = [idx, idx + COLS - 1, idx + COLS * 2 - 2, idx + COLS * 3 - 3];
        if (
          currentBoard[cells[0]] &&
          currentBoard[cells[0]] === currentBoard[cells[1]] &&
          currentBoard[cells[0]] === currentBoard[cells[2]] &&
          currentBoard[cells[0]] === currentBoard[cells[3]]
        ) {
          return { winner: currentBoard[cells[0]], cells };
        }
      }
    }

    // Check for draw
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', cells: [] };
    }

    return null;
  };

  // Handle column click
  const handleColumnClick = (col) => {
    if (!isMyTurn || gameStatus !== 'playing') {
      return;
    }

    const lowestRow = getLowestRow(col, board);
    if (lowestRow === -1) return; // Column full

    const index = lowestRow * COLS + col;
    const newBoard = [...board];
    newBoard[index] = myColor;

    // Animate piece drop
    setDroppingPiece({ col, row: lowestRow, color: myColor });
    setTimeout(() => setDroppingPiece(null), 500);

    setBoard(newBoard);

    // AAA Card Juice - Particle burst + sound on drop
    cardSoundManager.playCardSlam();
    setParticleTrigger({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: myColor === 'red' ? '#ef4444' : '#eab308'
    });
    setTimeout(() => setParticleTrigger(null), 100);

    // Check for winner
    const result = checkWinner(newBoard);
    
    if (result) {
      handleGameEnd(result, newBoard);
    } else {
      // Send move to opponent
      makeMove(
        { col, row: lowestRow, color: myColor },
        { board: newBoard, status: 'playing' }
      );
    }
  };

  // Handle game end
  const handleGameEnd = (result, finalBoard) => {
    if (result.winner === 'draw') {
      setGameStatus('draw');
      setWinningCells([]);
      endGame('draw');
    } else if (result.winner === myColor) {
      setGameStatus('won');
      setWinner(myColor);
      setWinningCells(result.cells);
      setShowConfetti(true);
      cardSoundManager.playWinSound(); // AAA Card Juice
      endGame(myRole);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setGameStatus('lost');
      setWinner(result.winner);
      setWinningCells(result.cells);
      endGame(isHost ? 'guest' : 'host');
    }
  };

  // Listen for opponent's move
  useEffect(() => {
    if (room?.game_state?.board) {
      const newBoard = room.game_state.board;
      setBoard(newBoard);

      if (room.status === 'completed') {
        const result = checkWinner(newBoard);
        if (result) {
          handleGameEnd(result, newBoard);
        }
      }
    }
  }, [room?.game_state, room?.status]);

  // Handle room not found
  useEffect(() => {
    if (!room && connected) {
      setTimeout(() => navigate('/multiplayer'), 2000);
    }
  }, [room, connected, navigate]);

  // Leave room on unmount
  useEffect(() => {
    return () => {
      if (room) {
        leaveRoom();
      }
    };
  }, []);

  const handleLeaveGame = () => {
    leaveRoom();
    navigate('/multiplayer');
  };

  const handlePlayAgain = () => {
    setBoard(Array(ROWS * COLS).fill(null));
    setGameStatus('playing');
    setWinner(null);
    setWinningCells([]);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h2 className="text-2xl font-bold">Connecting to server...</h2>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-4">Room not found</h2>
          <p className="text-gray-300 mb-6">Redirecting to lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white p-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-gradient-to-r from-red-400 to-yellow-400 bg-clip-text mb-2"
          >
            🔴 CONNECT 4 🟡
          </motion.h1>
          <p className="text-sm text-gray-300">Room: {room.room_code}</p>
        </div>

        {/* Players Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Host Player (Red) */}
          <Card className={`p-4 ${room.current_turn === 'host' ? 'bg-red-600/30 border-red-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500 rounded-full border-4 border-red-700 shadow-lg" />
              <div className="flex-1">
                <p className="font-bold text-lg">{room.host.name}</p>
                <p className="text-xs text-gray-300">Red Player</p>
              </div>
              {room.current_turn === 'host' && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-yellow-400"
                >
                  <Crown className="w-6 h-6" />
                </motion.div>
              )}
            </div>
          </Card>

          {/* Guest Player (Yellow) */}
          <Card className={`p-4 ${room.current_turn === 'guest' ? 'bg-yellow-600/30 border-yellow-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-400 rounded-full border-4 border-yellow-600 shadow-lg" />
              <div className="flex-1">
                <p className="font-bold text-lg">{room.guest?.name || 'Waiting...'}</p>
                <p className="text-xs text-gray-300">Yellow Player</p>
              </div>
              {room.current_turn === 'guest' && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-yellow-400"
                >
                  <Crown className="w-6 h-6" />
                </motion.div>
              )}
            </div>
          </Card>
        </div>

        {/* Turn Indicator */}
        <AnimatePresence mode="wait">
          {gameStatus === 'playing' && (
            <motion.div
              key="turn-indicator"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center mb-6"
            >
              <Card className={`inline-block px-8 py-4 ${isMyTurn ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gray-700'} backdrop-blur-xl border-2 ${isMyTurn ? 'border-green-400' : 'border-gray-500'}`}>
                <p className="text-xl sm:text-2xl font-black">
                  {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Board */}
        <Card className="bg-blue-800/50 backdrop-blur-xl border-4 border-blue-600 p-4 sm:p-6 mb-6 shadow-2xl">
          <div className="max-w-2xl mx-auto">
            {/* Column indicators (hover preview) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {Array.from({ length: COLS }).map((_, col) => (
                <div
                  key={col}
                  className="aspect-square flex items-center justify-center"
                  onMouseEnter={() => setHoveredColumn(col)}
                  onMouseLeave={() => setHoveredColumn(null)}
                >
                  {isMyTurn && gameStatus === 'playing' && hoveredColumn === col && getLowestRow(col, board) !== -1 && (
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 0.5 }}
                      exit={{ y: -20, opacity: 0 }}
                      className={`w-3/4 h-3/4 rounded-full ${myColor === 'red' ? 'bg-red-500' : 'bg-yellow-400'}`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Board grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 bg-blue-700 p-2 sm:p-3 rounded-2xl">
              {Array.from({ length: ROWS }).map((_, row) => (
                Array.from({ length: COLS }).map((_, col) => {
                  const index = row * COLS + col;
                  const cell = board[index];
                  const isWinning = winningCells.includes(index);
                  const isDroppingHere = droppingPiece?.col === col && droppingPiece?.row === row;

                  return (
                    <motion.button
                      key={`item-${index}`}
                      whileHover={isMyTurn && gameStatus === 'playing' && getLowestRow(col, board) !== -1 ? { scale: 1.05 } : {}}
                      onClick={() => handleColumnClick(col)}
                      disabled={!isMyTurn || gameStatus !== 'playing'}
                      className={`
                        aspect-square rounded-full flex items-center justify-center relative
                        transition-all duration-200
                        ${!isMyTurn || gameStatus !== 'playing' ? 'cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      style={{
                        background: cell 
                          ? cell === 'red' 
                            ? 'linear-gradient(145deg, #ef4444, #dc2626)'
                            : 'linear-gradient(145deg, #fbbf24, #f59e0b)'
                          : '#1e3a8a'
                      }}
                    >
                      {/* Empty slot shadow */}
                      {!cell && (
                        <div className="absolute inset-2 rounded-full bg-blue-900/50" />
                      )}

                      {/* Piece */}
                      <AnimatePresence>
                        {cell && (
                          <motion.div
                            initial={isDroppingHere ? { y: -300, scale: 0.8 } : { scale: 0 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ 
                              type: 'spring',
                              stiffness: 300,
                              damping: 20
                            }}
                            className={`
                              absolute inset-1 rounded-full border-4
                              ${cell === 'red' ? 'border-red-700' : 'border-yellow-600'}
                              ${isWinning ? 'animate-pulse shadow-2xl ring-4 ring-white' : ''}
                            `}
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
          {gameStatus !== 'playing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center mb-6"
            >
              <Card className={`inline-block px-8 py-6 backdrop-blur-xl border-4 ${
                gameStatus === 'won' ? 'bg-gradient-to-br from-green-600 to-emerald-600 border-green-400' :
                gameStatus === 'lost' ? 'bg-gradient-to-br from-red-600 to-rose-600 border-red-400' :
                'bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400'
              }`}>
                <div className="text-6xl mb-4">
                  {gameStatus === 'won' ? '🏆' : gameStatus === 'lost' ? '😢' : '🤝'}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black mb-2">
                  {gameStatus === 'won' ? 'YOU WIN!' : gameStatus === 'lost' ? 'YOU LOSE!' : 'DRAW!'}
                </h2>
                <p className="text-lg text-white/90">
                  {gameStatus === 'won' ? 'Congratulations! 🎉' : 
                   gameStatus === 'lost' ? 'Better luck next time!' : 
                   'Well played by both!'}
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleLeaveGame}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 font-bold text-lg py-6 px-8 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave Game
          </Button>
          
          {gameStatus !== 'playing' && (
            <Button
              onClick={handlePlayAgain}
              className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 font-bold text-lg py-6 px-8 rounded-xl"
            >
              🔄 Play Again
            </Button>
          )}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 max-w-md mx-auto bg-red-600 text-white px-4 py-3 rounded-lg flex justify-between items-center"
            >
              <span>{error}</span>
              <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AAA Card Juice - Particle Effects */}
        <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
      </div>
    </div>
  );
}
