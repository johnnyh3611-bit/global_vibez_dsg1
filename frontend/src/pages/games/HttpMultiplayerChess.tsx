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
import HoloPiece from '@/components/games/HoloBoard/HoloPiece';
import { useWindowSize } from 'react-use';

export default function HttpMultiplayerChess() {
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

  const [board, setBoard] = useState(initializeChessBoard());
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'white' : 'black';

  // Initialize chess board
  function initializeChessBoard() {
    return [
      ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'], // Black back row
      ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'], // Black pawns
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'], // White pawns
      ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']  // White back row
    ];
  }

  // Piece color detection
  function getPieceColor(piece) {
    if (!piece) return null;
    // White pieces: ♔♕♖♗♘♙
    // Black pieces: ♚♛♜♝♞♟
    return ['♔','♕','♖','♗','♘','♙'].includes(piece) ? 'white' : 'black';
  }

  // Simplified move validation (basic rules)
  function getValidMoves(piece, row, col, currentBoard) {
    const moves = [];
    const pieceColor = getPieceColor(piece);
    
    // Simplified validation - just show adjacent squares for demo
    // In production, implement full chess rules
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const targetPiece = currentBoard[newRow][newCol];
        if (!targetPiece || getPieceColor(targetPiece) !== pieceColor) {
          moves.push([newRow, newCol]);
        }
      }
    }
    
    return moves;
  }

  // Check for checkmate (simplified)
  function checkGameEnd(currentBoard) {
    let whiteKing = false;
    let blackKing = false;
    
    for (let row of currentBoard) {
      for (let piece of row) {
        if (piece === '♔') whiteKing = true;
        if (piece === '♚') blackKing = true;
      }
    }
    
    if (!whiteKing) return { winner: 'black' };
    if (!blackKing) return { winner: 'white' };
    return null;
  }

  // Update board from game state
  useEffect(() => {
    if (gameState?.game_state?.board) {
      setBoard(gameState.game_state.board);
      setMoveHistory(gameState.game_state.moveHistory || []);
      setCapturedPieces(gameState.game_state.capturedPieces || { white: [], black: [] });
      
      if (gameState.status === 'completed' && gameState.winner) {
        const result = checkGameEnd(gameState.game_state.board);
        if (result) handleGameEnd(result);
      }
    }
  }, [gameState]);

  // Handle piece selection
  const handleSquareClick = async (row, col) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;

    const clickedPiece = board[row][col];
    
    // If a piece is already selected
    if (selectedPiece) {
      const [selectedRow, selectedCol] = selectedPiece;
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col);
      
      if (isValidMove) {
        // Make the move
        const newBoard = board.map(r => [...r]);
        const movingPiece = newBoard[selectedRow][selectedCol];
        const capturedPiece = newBoard[row][col];
        
        newBoard[row][col] = movingPiece;
        newBoard[selectedRow][selectedCol] = null;
        
        // Track captured pieces
        const newCaptured = { ...capturedPieces };
        if (capturedPiece) {
          const capturedColor = getPieceColor(capturedPiece);
          newCaptured[capturedColor === 'white' ? 'white' : 'black'].push(capturedPiece);
        }
        
        const newMoveHistory = [...moveHistory, `${movingPiece} ${String.fromCharCode(97 + selectedCol)}${8-selectedRow} → ${String.fromCharCode(97 + col)}${8-row}`];
        
        setBoard(newBoard);
        setSelectedPiece(null);
        setValidMoves([]);
        setMoveHistory(newMoveHistory);
        setCapturedPieces(newCaptured);
        
        // Check game end
        const result = checkGameEnd(newBoard);
        if (result) {
          const winnerRole = result.winner === myColor ? myRole : (myRole === 'player1' ? 'player2' : 'player1');
          await makeMove({ from: [selectedRow, selectedCol], to: [row, col] }, { 
            board: newBoard, 
            moveHistory: newMoveHistory,
            capturedPieces: newCaptured
          });
          await endGame(winnerRole);
          handleGameEnd(result);
        } else {
          await makeMove({ from: [selectedRow, selectedCol], to: [row, col] }, { 
            board: newBoard,
            moveHistory: newMoveHistory,
            capturedPieces: newCaptured
          });
        }
      } else {
        // Deselect or select new piece
        if (clickedPiece && getPieceColor(clickedPiece) === myColor) {
          setSelectedPiece([row, col]);
          setValidMoves(getValidMoves(clickedPiece, row, col, board));
        } else {
          setSelectedPiece(null);
          setValidMoves([]);
        }
      }
    } else {
      // First selection
      if (clickedPiece && getPieceColor(clickedPiece) === myColor) {
        setSelectedPiece([row, col]);
        setValidMoves(getValidMoves(clickedPiece, row, col, board));
      }
    }
  };

  const handleGameEnd = (result) => {
    if (result.winner === myColor) {
      setLocalGameStatus('won');
      setWinner(myColor);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setLocalGameStatus('lost');
      setWinner(result.winner);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white flex items-center justify-center">
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
        gameLabel="Chess"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="chess-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Player Info & Captured */}
          <div className="space-y-4">
            {/* Player Cards */}
            <Card className={`p-4 ${gameState.current_turn === 'player1' ? 'bg-amber-600/30 border-amber-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-2xl">♔</div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{player1Name}</p>
                  <p className="text-xs text-gray-300">White Pieces</p>
                </div>
                {gameState.current_turn === 'player1' && <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />}
              </div>
            </Card>

            <Card className={`p-4 ${gameState.current_turn === 'player2' ? 'bg-slate-600/30 border-slate-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-2xl">♚</div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{player2Name}</p>
                  <p className="text-xs text-gray-300">Black Pieces</p>
                </div>
                {gameState.current_turn === 'player2' && <Crown className="w-6 h-6 text-yellow-400 animate-pulse" />}
              </div>
            </Card>

            {/* Captured Pieces */}
            <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
              <h3 className="font-bold mb-2 text-sm">Captured Pieces</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-400">White:</p>
                  <div className="flex flex-wrap gap-1 text-xl">
                    {(capturedPieces?.white || []).map((piece, i) => <span key={`white-${i}-${piece || 'empty'}`}>{piece}</span>)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Black:</p>
                  <div className="flex flex-wrap gap-1 text-xl">
                    {(capturedPieces?.black || []).map((piece, i) => <span key={`black-${i}-${piece || 'empty'}`}>{piece}</span>)}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Center: Chess Board */}
          <div>
            {/* Turn Indicator */}
            {localGameStatus === 'playing' && (
              <Card className={`inline-block px-6 py-3 mb-4 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'} backdrop-blur-xl`}>
                <p className="font-black">{isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}</p>
              </Card>
            )}

            {/* Cyber-Casino multiplayer chess board (Revolutionary
                Games Blueprint v1) — anti-gravity glass shell, cyan
                glow ring, Solid-Light Holo pieces. */}
            <Card
              className="backdrop-blur-xl p-2 sm:p-4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(40, 50, 90, 0.85) 0%, rgba(15, 20, 40, 0.95) 100%)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow:
                  '0 0 60px rgba(34, 211, 238, 0.25), inset 0 0 24px rgba(34, 211, 238, 0.15)',
              }}
            >
              <div className="grid grid-cols-8 gap-0 max-w-xl mx-auto rounded-xl overflow-hidden">
                {board.map((row, rowIdx) =>
                  row.map((piece, colIdx) => {
                    const isLight = (rowIdx + colIdx) % 2 === 0;
                    const isSelected = selectedPiece && selectedPiece[0] === rowIdx && selectedPiece[1] === colIdx;
                    const isValidMove = validMoves.some(([r, c]) => r === rowIdx && c === colIdx);
                    const pieceColor = piece ? getPieceColor(piece) : null;
                    return (
                      <motion.button
                        key={`${rowIdx}-${colIdx}`}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleSquareClick(rowIdx, colIdx)}
                        className={`aspect-square flex items-center justify-center transition-all relative
                          ${isSelected ? 'shadow-[inset_0_0_18px_rgba(255,215,0,0.6)]' : ''}
                          ${isValidMove ? 'shadow-[inset_0_0_16px_rgba(34,211,238,0.55)]' : ''}
                        `}
                        style={{
                          background: isLight
                            ? 'linear-gradient(135deg, rgba(220, 228, 255, 0.18) 0%, rgba(180, 200, 240, 0.10) 100%)'
                            : 'linear-gradient(135deg, rgba(20, 30, 60, 0.92) 0%, rgba(40, 50, 90, 0.82) 100%)',
                          boxShadow: isSelected
                            ? 'inset 0 0 18px rgba(255,215,0,0.6), 0 0 12px rgba(255,215,0,0.4)'
                            : isValidMove
                              ? 'inset 0 0 16px rgba(34,211,238,0.55), 0 0 10px rgba(34,211,238,0.4)'
                              : 'inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        {/* Legal-move dot when square is empty */}
                        {!piece && isValidMove && (
                          <span
                            aria-hidden="true"
                            className="absolute w-3 h-3 rounded-full bg-cyan-300 animate-pulse"
                            style={{ boxShadow: '0 0 12px rgba(34, 211, 238, 0.9)' }}
                          />
                        )}
                        {piece && (
                          <HoloPiece
                            color={pieceColor === 'white' ? 'white' : 'black'}
                            glyph={piece}
                            selected={isSelected}
                            size={42}
                          />
                        )}
                      </motion.button>
                    );
                  }),
                )}
              </div>
            </Card>

            {/* Game Result */}
            <AnimatePresence>
              {localGameStatus !== 'playing' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-4">
                  <Card className={`inline-block px-8 py-6 backdrop-blur-xl border-4 ${localGameStatus === 'won' ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'}`}>
                    <div className="text-6xl mb-4">{localGameStatus === 'won' ? '🏆' : '😢'}</div>
                    <h2 className="text-3xl font-black">{localGameStatus === 'won' ? 'CHECKMATE! YOU WIN!' : 'CHECKMATE! YOU LOSE!'}</h2>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Move History */}
          <div>
            <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 h-96 overflow-y-auto">
              <h3 className="font-bold mb-3 text-sm sticky top-0 bg-gray-900/80 py-2">Move History</h3>
              <div className="space-y-1 text-xs">
                {moveHistory.map((move, idx) => (
                  <div key={`moveHistory-${idx}`} className="text-gray-300">
                    {idx + 1}. {move}
                  </div>
                ))}
              </div>
            </Card>

            <div className="mt-4 space-y-2">
              <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="w-full bg-gray-600 hover:bg-gray-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Leave Game
              </Button>
              {localGameStatus !== 'playing' && (
                <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="w-full bg-blue-600 hover:bg-blue-700">
                  🔄 Play Again
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 max-w-md mx-auto bg-red-600 text-white px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
