import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Circle, Crown, Trophy, Users, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import TurnIndicator from '@/components/games/TurnIndicator';

export default function MultiplayerTicTacToe() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  // Get user info from auth (you'll need to adapt this to your auth system)
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);
  const userName = 'Player'; // Get from auth context
  
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
  } = useHttpMultiplayer(userId, userName);

  const [board, setBoard] = useState(Array(144).fill(null));
  const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost, draw
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // AAA Card Juice
  const [particleTrigger, setParticleTrigger] = useState(null);
  const [winningLine, setWinningLine] = useState(null);

  // Determine player symbols based on game state
  const myRole = gameState?.my_role;
  const mySymbol = myRole === 'player1' ? 'X' : 'O';
  const opponentSymbol = myRole === 'player1' ? 'O' : 'X';
  const isHost = myRole === 'player1';
  const room = gameId || urlGameId;

  // Locked rule constants — keep in sync with backend services/games/tictactoe.py
  const BOARD_SIZE = 12;
  const WIN_LENGTH = 5;
  const idx = (r, c) => r * BOARD_SIZE + c;

  // Scan from the last placed cell for a 5-in-a-row in 4 directions.
  const checkWinAt = (currentBoard, r, c) => {
    const mark = currentBoard[idx(r, c)];
    if (!mark) return null;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [idx(r, c)];
      for (let k = 1; k < WIN_LENGTH; k++) {
        const nr = r + dr * k, nc = c + dc * k;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (currentBoard[idx(nr, nc)] !== mark) break;
        line.push(idx(nr, nc));
      }
      for (let k = 1; k < WIN_LENGTH; k++) {
        const nr = r - dr * k, nc = c - dc * k;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (currentBoard[idx(nr, nc)] !== mark) break;
        line.unshift(idx(nr, nc));
      }
      if (line.length >= WIN_LENGTH) return { winner: mark, line: line.slice(0, WIN_LENGTH) };
    }
    return null;
  };

  // Check for winner — scans the whole board for any 5-in-a-row.
  // Used when reconciling board state from the server.
  const checkWinner = (currentBoard) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const w = checkWinAt(currentBoard, r, c);
        if (w) return w;
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: 'draw', line: null };
    }
    return null;
  };

  // Handle cell click
  const handleCellClick = (index) => {
    if (!isMyTurn || board[index] !== null || gameStatus !== 'playing') {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = mySymbol;
    setBoard(newBoard);

    // AAA Card Juice - Sound + particles on move
    cardSoundManager.playCardSlam();
    setParticleTrigger({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: mySymbol === 'X' ? '#3b82f6' : '#ef4444'
    });
    setTimeout(() => setParticleTrigger(null), 100);

    // Check for winner from the freshly-placed cell (5-in-a-row scan)
    const r = Math.floor(index / BOARD_SIZE);
    const c = index % BOARD_SIZE;
    const win = checkWinAt(newBoard, r, c);
    const isDraw = !win && newBoard.every(cell => cell !== null);
    const result = win || (isDraw ? { winner: 'draw', line: null } : null);

    if (result) {
      handleGameEnd(result, newBoard);
    } else {
      // Send move to opponent
      makeMove(
        { index, row: r, col: c, symbol: mySymbol },
        { board: newBoard, status: 'playing' }
      );
    }
  };

  // Handle game end
  const handleGameEnd = (result, finalBoard) => {
    const isHost = myRole === 'player1';
    if (result.winner === 'draw') {
      setGameStatus('draw');
      setWinningLine(null);
      endGame('draw');
    } else if (result.winner === mySymbol) {
      setGameStatus('won');
      setWinner(mySymbol);
      setWinningLine(result.line);
      setShowConfetti(true);
      if (typeof cardSoundManager?.playWinSound === 'function') {
        cardSoundManager.playWinSound();
      }
      endGame(isHost ? 'host' : 'guest');
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setGameStatus('lost');
      setWinner(result.winner);
      setWinningLine(result.line);
      endGame(isHost ? 'guest' : 'host');
    }
  };

  // Listen for opponent's move
  useEffect(() => {
    if (gameState?.game_state?.board) {
      const newBoard = gameState.game_state.board;
      setBoard(newBoard);

      // Check if game ended
      if (gameState.status === 'completed') {
        const result = checkWinner(newBoard);
        if (result) {
          handleGameEnd(result, newBoard);
        }
      }
    }
  }, [gameState?.game_state, gameState?.status]);

  // Handle room not found
  useEffect(() => {
    if (!gameState && connected) {
      // Room doesn't exist, redirect to lobby
      setTimeout(() => navigate('/multiplayer'), 2000);
    }
  }, [gameState, connected, navigate]);

  // Leave room on unmount
  useEffect(() => {
    return () => {
      if (gameState) {
        leaveGame();
      }
    };
  }, []);

  const handleLeaveGame = () => {
    leaveGame();
    navigate('/multiplayer');
  };

  const getCellContent = (value) => {
    if (value === 'X') {
      return <X className="w-full h-full text-cyan-400" strokeWidth={4} />;
    }
    if (value === 'O') {
      return <Circle className="w-full h-full text-pink-400" strokeWidth={4} />;
    }
    return null;
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h2 className="text-2xl font-bold">Connecting to server...</h2>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-4">Room not found</h2>
          <p className="text-gray-300 mb-6">Redirecting to lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) */}
        {gameStatus === 'playing' && (
          <TurnIndicator role={isMyTurn ? 'me' : 'opponent'} name={isMyTurn ? undefined : 'Opponent'} />
        )}
        {/* Header */}
        <div className="text-center mb-6">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text mb-2"
          >
            ⭕ TIC-TAC-TOE ❌
          </motion.h1>
          <p className="text-sm text-gray-300">Room: {room.room_code}</p>
        </div>

        {/* Players Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Host Player */}
          <Card className={`p-4 ${room.current_turn === 'host' ? 'bg-cyan-600/30 border-cyan-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{room.host.name}</p>
                <p className="text-xs text-gray-300">Player X</p>
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

          {/* Guest Player */}
          <Card className={`p-4 ${room.current_turn === 'guest' ? 'bg-pink-600/30 border-pink-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
                <Circle className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{room.guest?.name || 'Waiting...'}</p>
                <p className="text-xs text-gray-300">Player O</p>
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

        {/* Game Board — 12×12 / 5-in-a-row (LOCKED 2026-02-16) */}
        <Card className="bg-white/10 backdrop-blur-xl border-2 border-cyan-500/30 p-3 sm:p-5 mb-6">
          <div
            data-testid="ttt-5row-board"
            className="grid gap-[2px] sm:gap-1 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              maxWidth: 'min(640px, 95vw)',
            }}
          >
            {board.map((cell, index) => (
              <motion.button
                key={`board-${index}`}
                whileHover={isMyTurn && !cell && gameStatus === 'playing' ? { scale: 1.08 } : {}}
                whileTap={isMyTurn && !cell && gameStatus === 'playing' ? { scale: 0.92 } : {}}
                onClick={() => handleCellClick(index)}
                disabled={!isMyTurn || cell !== null || gameStatus !== 'playing'}
                data-testid={`ttt-cell-${index}`}
                className={`
                  aspect-square rounded-md sm:rounded-lg border flex items-center justify-center
                  transition-all duration-150 relative overflow-hidden
                  ${winningLine?.includes(index)
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-400 animate-pulse'
                      : 'bg-white/10 border-white/20'}
                  ${isMyTurn && !cell && gameStatus === 'playing' ? 'hover:bg-white/25 hover:border-cyan-400 cursor-pointer' : ''}
                  ${(!isMyTurn || cell !== null || gameStatus !== 'playing') && !winningLine?.includes(index) ? 'cursor-not-allowed opacity-80' : ''}
                `}
              >
                <AnimatePresence>
                  {cell && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      className="w-3/4 h-3/4"
                    >
                      {getCellContent(cell)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-white/50 uppercase tracking-widest">
            12×12 Board · Get 5 in a row to win
          </p>
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
              onClick={() => {
                setBoard(Array(144).fill(null));
                setGameStatus('playing');
                setWinner(null);
                setWinningLine(null);
              }}
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
