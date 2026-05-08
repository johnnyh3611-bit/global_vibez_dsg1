
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Crown, Zap } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { GameEngine } from '@/game-engine';
import { Toaster, toast } from 'react-hot-toast';
import GlassSlate from '@/components/chat/GlassSlate';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sound effect helper
const playSound = (soundType) => {
  // Sound effects disabled for now
};

// Tower Stack Component - Physical stacking with CSS
const TowerStack = ({ stack, isKing, onClick, disabled, isSelected, animate = true }) => {
  if (!stack || stack.length === 0) return null;
  
  const topColor = stack[stack.length - 1];
  const stackHeight = stack.length;
  
  return (
    <motion.div
      initial={animate ? { scale: 0, rotate: -180, opacity: 0 } : {}}
      animate={animate ? { scale: 1, rotate: 0, opacity: 1 } : {}}
      whileHover={!disabled ? { scale: 1.15, y: -10 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`relative ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Render each piece in the stack */}
      {stack.map((color, index) => {
        const isTop = index === stack.length - 1;
        const zOffset = index * 3; // Stack offset
        const yOffset = -index * 4; // Vertical offset
        
        return (
          <motion.div
            key={`stack-${index}`}
            initial={animate && index > 0 ? { y: -50, opacity: 0 } : {}}
            animate={{ y: yOffset, opacity: isTop ? 1 : 0.4 }}
            transition={{ delay: index * 0.1 }}
            className={`absolute inset-0 flex items-center justify-center`}
            style={{ 
              zIndex: 10 + zOffset,
              transform: `translateY(${yOffset}px)`
            }}
          >
            <div
              className={`w-[70%] h-[70%] rounded-full flex items-center justify-center shadow-2xl border-4 ${
                color === 'red' 
                  ? 'bg-gradient-to-br from-red-600 to-red-800 border-red-400' 
                  : 'bg-gradient-to-br from-gray-800 to-black border-gray-600'
              } ${isSelected && isTop ? 'ring-4 ring-yellow-400' : ''}`}
            >
              {isKing && isTop && (
                <Crown className="w-6 h-6 text-yellow-400 drop-shadow-lg" />
              )}
            </div>
          </motion.div>
        );
      })}
      
      {/* Stack count badge */}
      {stackHeight > 1 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-black z-50 border-2 border-yellow-300 shadow-lg"
        >
          {stackHeight}
        </motion.div>
      )}
      
      {/* Selection glow */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0px rgba(250, 204, 21, 0)',
              '0 0 30px rgba(250, 204, 21, 0.8)',
              '0 0 0px rgba(250, 204, 21, 0)'
            ]
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

// Valid Move Indicator
const MoveIndicator = ({ onClick }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    whileHover={{ scale: 1.2 }}
    onClick={onClick}
    className="w-8 h-8 rounded-full bg-green-400/50 border-2 border-green-300 cursor-pointer flex items-center justify-center"
  >
    <motion.div
      className="w-4 h-4 rounded-full bg-green-500"
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
    />
  </motion.div>
);

export default function HttpMultiplayerCheckers() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [selectedPiece, setSelectedPiece] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [lastMoveAnimation, setLastMoveAnimation] = useState(null);
  const [captureAnimation, setCaptureAnimation] = useState(null);

  const myRole = gameState?.my_role;
  const board = gameState?.game_state?.board || Array(8).fill(null).map(() => Array(8).fill(null));
  const myColor = myRole === 'player1' ? 'red' : 'black';
  const opponentColor = myColor === 'red' ? 'black' : 'red';

  useEffect(() => {
    if (gameState?.status === 'completed') {
      if (gameState.winner === myRole) {
        setLocalGameStatus('won');
        setShowConfetti(true);
        playSound('game-win');
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        setLocalGameStatus('lost');
        playSound('game-lose');
      }
    }
  }, [gameState, myRole]);

  // Calculate valid moves for selected piece
  const calculateValidMoves = (row, col) => {
    if (!isMyTurn || localGameStatus !== 'playing') return [];
    
    const piece = board[row]?.[col];
    if (!piece || piece.owner !== myRole) return [];

    const moves = [];
    const directions = piece.isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]  // Kings move all directions
      : piece.owner === 'player1' 
        ? [[1, -1], [1, 1]]  // Red moves down
        : [[-1, -1], [-1, 1]];  // Black moves up

    // Check regular moves
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const destPiece = board[newRow]?.[newCol];
        if (!destPiece) {
          moves.push({ row: newRow, col: newCol, type: 'move' });
        }
      }
    }

    // Check jump moves
    const jumpDirections = piece.isKing
      ? [[-2, -2], [-2, 2], [2, -2], [2, 2]]
      : piece.owner === 'player1'
        ? [[2, -2], [2, 2]]
        : [[-2, -2], [-2, 2]];

    for (const [dRow, dCol] of jumpDirections) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      const midRow = row + dRow / 2;
      const midCol = col + dCol / 2;

      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const destPiece = board[newRow]?.[newCol];
        const midPiece = board[midRow]?.[midCol];

        if (!destPiece && midPiece && midPiece.owner !== piece.owner) {
          moves.push({ 
            row: newRow, 
            col: newCol, 
            type: 'jump',
            capturedRow: midRow,
            capturedCol: midCol 
          });
        }
      }
    }

    return moves;
  };

  const handleCellClick = async (row, col) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;

    const piece = board[row]?.[col];
    
    // If no piece selected, select this piece
    if (selectedPiece === null) {
      if (piece && piece.owner === myRole) {
        setSelectedPiece({ row, col });
        const moves = calculateValidMoves(row, col);
        setValidMoves(moves);
        playSound('piece-select');
      }
      return;
    }

    // If clicking the same piece, deselect
    if (selectedPiece.row === row && selectedPiece.col === col) {
      setSelectedPiece(null);
      setValidMoves([]);
      return;
    }

    // If clicking another piece of yours, switch selection
    if (piece && piece.owner === myRole) {
      setSelectedPiece({ row, col });
      const moves = calculateValidMoves(row, col);
      setValidMoves(moves);
      playSound('piece-select');
      return;
    }

    // Check if this is a valid move
    const validMove = validMoves.find(m => m.row === row && m.col === col);
    if (!validMove) {
      toast.error('Invalid move!', {
        icon: '❌',
        duration: 1500,
        style: { background: '#ef4444', color: 'white', fontWeight: 'bold' }
      });
      playSound('invalid-move');
      return;
    }

    // Execute the move
    await executeMove(selectedPiece.row, selectedPiece.col, row, col, validMove);
  };

  const executeMove = async (fromRow, fromCol, toRow, toCol, moveData) => {
    const newBoard = board.map(row => row.map(cell => cell ? { ...cell } : null));
    const piece = { ...newBoard[fromRow][fromCol] };

    // Handle jump (capture)
    if (moveData.type === 'jump') {
      const capturedPiece = newBoard[moveData.capturedRow][moveData.capturedCol];
      
      // TOWER STACKING: Add captured piece to bottom of stack
      piece.stack = [capturedPiece.color, ...(piece.stack || [piece.color])];
      
      // Remove captured piece
      newBoard[moveData.capturedRow][moveData.capturedCol] = null;
      
      // Trigger capture animation
      setCaptureAnimation({ row: moveData.capturedRow, col: moveData.capturedCol });
      setTimeout(() => setCaptureAnimation(null), 500);
      
      playSound('piece-capture');
      toast.success('Captured!', {
        icon: '💥',
        duration: 1500,
        style: { background: '#f59e0b', color: 'white', fontWeight: 'bold' }
      });
    } else {
      playSound('piece-move');
    }

    // Move piece
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = null;

    // Check for king promotion
    if (!piece.isKing) {
      if ((piece.owner === 'player1' && toRow === 7) ||
          (piece.owner === 'player2' && toRow === 0)) {
        piece.isKing = true;
        playSound('king-promotion');
        toast.success('King Promoted! 👑', {
          icon: '⚡',
          duration: 2000,
          style: { 
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: 'white', 
            fontWeight: 'bold' 
          }
        });
      }
    }

    // Set last move animation
    setLastMoveAnimation({ fromRow, fromCol, toRow, toCol });
    setTimeout(() => setLastMoveAnimation(null), 1000);

    // Convert to position strings for backend
    const fromPos = String.fromCharCode(65 + fromCol) + (fromRow + 1);
    const toPos = String.fromCharCode(65 + toCol) + (toRow + 1);

    // Send to backend
    await makeMove({ from: fromPos, to: toPos }, { board: newBoard });

    // Clear selection
    setSelectedPiece(null);
    setValidMoves([]);

    // Check win condition
    const opponentPieces = newBoard.flat().filter(p => p && p.owner !== myRole);
    if (opponentPieces.length === 0) {
      await endGame(myRole);
    }
  };

  const renderCell = (row, col) => {
    const isDark = (row + col) % 2 === 1;
    const piece = board[row]?.[col];
    const isSelected = selectedPiece?.row === row && selectedPiece?.col === col;
    const isValidMove = validMoves.some(m => m.row === row && m.col === col);
    const isLastMove = lastMoveAnimation && (
      (lastMoveAnimation.fromRow === row && lastMoveAnimation.fromCol === col) ||
      (lastMoveAnimation.toRow === row && lastMoveAnimation.toCol === col)
    );
    const isCaptured = captureAnimation?.row === row && captureAnimation?.col === col;

    return (
      <motion.div
        key={`cell-${row}-${col}`}
        onClick={() => handleCellClick(row, col)}
        animate={isLastMove ? {
          backgroundColor: ['#f59e0b', isDark ? '#92400e' : '#fef3c7', isDark ? '#92400e' : '#fef3c7']
        } : {}}
        transition={{ duration: 0.5 }}
        className={`aspect-square flex items-center justify-center cursor-pointer relative ${
          isDark ? 'bg-amber-800' : 'bg-amber-100'
        } ${isSelected ? 'ring-4 ring-inset ring-yellow-400' : ''}`}
      >
        {/* Valid move indicator */}
        {isValidMove && !piece && (
          <MoveIndicator onClick={() => handleCellClick(row, col)} />
        )}

        {/* Piece with tower stacking */}
        {piece && !isCaptured && (
          <TowerStack
            stack={piece.stack || [piece.color]}
            isKing={piece.isKing}
            onClick={() => handleCellClick(row, col)}
            disabled={!isMyTurn || piece.owner !== myRole}
            isSelected={isSelected}
          />
        )}

        {/* Capture explosion effect */}
        {isCaptured && (
          <motion.div
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-4xl">💥</div>
          </motion.div>
        )}

        {/* Cell coordinates (for debugging) */}
        {/* <div className="absolute top-0 left-0 text-[8px] text-gray-500">
          {String.fromCharCode(65 + col)}{row + 1}
        </div> */}
      </motion.div>
    );
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h2 className="text-2xl font-bold mb-4">Finding opponent...</h2>
          <p className="text-gray-300 mb-4">Waiting for player 2</p>
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
        gameLabel="Checkers"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="checkers-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  // Count pieces
  const player1Pieces = board.flat().filter(p => p && p.owner === 'player1').length;
  const player2Pieces = board.flat().filter(p => p && p.owner === 'player2').length;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 text-white p-4 relative overflow-hidden">
      <Toaster />
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px)'
        }} />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
          <p className="text-xs text-green-400">{connected ? '✅ Connected' : '❌ Disconnected'}</p>
        </motion.div>

        {/* Player Info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <motion.div
            animate={myRole === 'player1' && isMyTurn ? {
              boxShadow: [
                '0 0 0px rgba(220, 38, 38, 0)',
                '0 0 30px rgba(220, 38, 38, 0.8)',
                '0 0 0px rgba(220, 38, 38, 0)'
              ]
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Card className={`p-4 ${myRole === 'player1' ? 'bg-red-600/30 border-red-400 border-2' : 'bg-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-full border-4 border-red-400 shadow-lg" />
                <div>
                  <p className="font-bold text-sm">{player1Name}</p>
                  <p className="text-xs text-gray-300">🔴 Red • {player1Pieces} pieces</p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            animate={myRole === 'player2' && isMyTurn ? {
              boxShadow: [
                '0 0 0px rgba(31, 41, 55, 0)',
                '0 0 30px rgba(100, 116, 139, 0.8)',
                '0 0 0px rgba(31, 41, 55, 0)'
              ]
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Card className={`p-4 ${myRole === 'player2' ? 'bg-gray-800/30 border-gray-600 border-2' : 'bg-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-full border-4 border-gray-600 shadow-lg" />
                <div>
                  <p className="font-bold text-sm">{player2Name}</p>
                  <p className="text-xs text-gray-300">⚫ Black • {player2Pieces} pieces</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Turn Indicator */}
        {localGameStatus === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`p-3 mb-4 relative ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
              {isMyTurn && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-green-400/30 to-emerald-400/30 rounded-lg pointer-events-none"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              <p className="text-center font-bold relative z-10">
                {isMyTurn ? (
                  <motion.span
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    🎮 YOUR TURN! Select a piece to move
                  </motion.span>
                ) : (
                  `⏳ ${gameState.current_turn === 'player1' ? player1Name : player2Name}'s Turn`
                )}
              </p>
            </Card>
          </motion.div>
        )}

        {/* Game Board */}
        <Card className="bg-amber-50 p-2 sm:p-4 mb-6 mx-auto shadow-2xl" style={{ maxWidth: '600px' }}>
          <div className="grid grid-cols-8 gap-0 border-8 border-amber-900 rounded-lg overflow-hidden shadow-inner">
            {Array.from({ length: 64 }).map((_, index) => {
              const row = Math.floor(index / 8);
              const col = index % 8;
              return renderCell(row, col);
            })}
          </div>
        </Card>

        {/* Game Legend */}
        <Card className="bg-white/10 p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-400/50 border-2 border-green-300 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span>Valid Move</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-8 h-8 text-yellow-400" />
              <span>King</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-red-600 rounded-full opacity-40" />
                <div className="absolute inset-0 bg-red-600 rounded-full transform -translate-y-1" />
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-black rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black border border-yellow-300">2</div>
              </div>
              <span>Tower Stack</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl">💥</div>
              <span>Capture</span>
            </div>
          </div>
        </Card>

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="text-center mb-6"
            >
              <Card className={`inline-block px-8 py-6 ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
                <motion.div 
                  className="text-6xl mb-4"
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  {localGameStatus === 'won' ? '🏆' : '😢'}
                </motion.div>
                <h2 className="text-3xl font-black mb-2">
                  {localGameStatus === 'won' ? 'VICTORY!' : 'DEFEAT!'}
                </h2>
                <p className="text-lg">
                  {localGameStatus === 'won' 
                    ? `You captured all opponent pieces!` 
                    : `Better luck next time!`
                  }
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex gap-4 justify-center">
          <Button 
            onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} 
            className="bg-gray-700 hover:bg-gray-600"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave Game
          </Button>
          {localGameStatus !== 'playing' && (
            <Button 
              onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} 
              className="bg-orange-600 hover:bg-orange-500"
            >
              🔄 Play Again
            </Button>
          )}
        </div>
      </div>

      {/* Global Chat - Glass Slate */}
      <GlassSlate 
        userId={userId} 
        userName={userName}
        initialRoom={gameId ? `game_checkers_${gameId}` : 'game_central'}
      />
    </div>
  );
}
