
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Circle, Crown, ArrowLeft, Zap } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import GlassSlate from '@/components/chat/GlassSlate';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MatrixTicTacToe() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [gridSize] = useState(10); // 10x10 Matrix Grid
  const [winTarget, setWinTarget] = useState(5); // 5-in-a-row to win
  const [board, setBoard] = useState<Array<Array<string | null>>>(Array(10).fill(null).map(() => Array(10).fill(null)));
  const [blockers, setBlockers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [userId] = useState(localStorage.getItem('userId') || 'guest');
  const [userName] = useState(localStorage.getItem('username') || 'Player');

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    // Place random blockers (crystalline blocks)
    const newBlockers = [];
    const blockCount = Math.floor(gridSize * gridSize * 0.1); // 10% of grid
    
    for (let i = 0; i < blockCount; i++) {
      const x = Math.floor(Math.random() * gridSize);
      const y = Math.floor(Math.random() * gridSize);
      if (!newBlockers.some(b => b.x === x && b.y === y)) {
        newBlockers.push({ x, y });
      }
    }
    setBlockers(newBlockers);
  };

  const checkWin = (lastX, lastY, playerId) => {
    const directions = [
      [1, 0],   // Horizontal
      [0, 1],   // Vertical
      [1, 1],   // Diagonal \
      [1, -1]   // Anti-Diagonal /
    ];

    for (const [dx, dy] of directions) {
      let count = 1;
      
      // Search forward
      count += searchDirection(lastX, lastY, dx, dy, playerId);
      // Search backward
      count += searchDirection(lastX, lastY, -dx, -dy, playerId);

      if (count >= winTarget) {
        return true;
      }
    }
    return false;
  };

  const searchDirection = (x, y, dx, dy, playerId) => {
    let count = 0;
    let newX = x + dx;
    let newY = y + dy;

    while (
      newX >= 0 && newX < gridSize &&
      newY >= 0 && newY < gridSize &&
      board[newX][newY] === playerId
    ) {
      count++;
      newX += dx;
      newY += dy;
    }

    return count;
  };

  const handleCellClick = (x, y) => {
    if (winner || board[x][y] || isBlocker(x, y)) return;

    const newBoard = board.map(row => [...row]);
    newBoard[x][y] = currentPlayer;
    setBoard(newBoard);

    if (checkWin(x, y, currentPlayer)) {
      setWinner(currentPlayer);
      setShowConfetti(true);
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const isBlocker = (x, y) => {
    return blockers.some(b => b.x === x && b.y === y);
  };

  const resetGame = () => {
    setBoard(Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)));
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine([]);
    setShowConfetti(false);
    initializeGame();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center flex-1">
            <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-full mb-2">
              <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-purple-400 text-sm font-bold">MATRIX TIC-TAC-TOE</span>
            </div>
            <h1 className="text-4xl font-black">
              {winTarget}-in-a-Row Challenge
            </h1>
          </div>

          <div className="w-32" />
        </div>

        {/* Game Info */}
        <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/30 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60 mb-1">Current Turn</p>
              <div className="flex items-center gap-2">
                {currentPlayer === 'X' ? (
                  <X className="w-6 h-6 text-cyan-400" />
                ) : (
                  <Circle className="w-6 h-6 text-pink-400" />
                )}
                <span className="text-xl font-bold">Player {currentPlayer}</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-white/60 mb-1">Win Target</p>
              <div className="flex items-center gap-2">
                <select
                  value={winTarget}
                  onChange={(e) => setWinTarget(Number(e.target.value))}
                  disabled={winner || board.some(row => row.some(cell => cell))}
                  className="bg-purple-600/20 border border-purple-500/30 rounded px-3 py-1 text-white"
                >
                  {[4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-white/60">in-a-row</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-white/60 mb-1">Blockers</p>
              <p className="text-xl font-bold text-amber-400">{blockers.length}</p>
            </div>
          </div>
        </Card>

        {/* Winner Banner */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-cyan-600 to-purple-600 rounded-xl p-6 mb-6 text-center"
          >
            <Crown className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
            <h2 className="text-3xl font-black mb-2">Player {winner} Wins!</h2>
            <p className="text-white/80 mb-4">Achieved {winTarget}-in-a-row!</p>
            <Button onClick={resetGame} className="bg-white text-purple-900 hover:bg-white/90">
              Play Again
            </Button>
          </motion.div>
        )}

        {/* Game Board */}
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-6 border border-cyan-500/30">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gap: '4px',
              maxWidth: '800px',
              margin: '0 auto'
            }}
          >
            {board.map((row, x) =>
              row.map((cell, y) => (
                <motion.button
                  key={`${x}-${y}`}
                  whileHover={{ scale: isBlocker(x, y) || cell || winner ? 1 : 1.1 }}
                  whileTap={{ scale: isBlocker(x, y) || cell || winner ? 1 : 0.95 }}
                  onClick={() => handleCellClick(x, y)}
                  disabled={!!winner || !!cell || isBlocker(x, y)}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-2xl font-bold transition-all
                    ${isBlocker(x, y) ? 'bg-gray-800 cursor-not-allowed' :
                      cell === 'X' ? 'bg-cyan-600/30 border-2 border-cyan-400' :
                      cell === 'O' ? 'bg-pink-600/30 border-2 border-pink-400' :
                      'bg-white/5 hover:bg-white/10 border border-white/10'}
                  `}
                >
                  {isBlocker(x, y) ? (
                    <div className="w-4 h-4 bg-amber-500 rounded-full animate-pulse" />
                  ) : cell === 'X' ? (
                    <X className="w-6 h-6 text-cyan-400" />
                  ) : cell === 'O' ? (
                    <Circle className="w-6 h-6 text-pink-400" />
                  ) : null}
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Chat Integration */}
        <div className="mt-6">
          <GlassSlate 
            userId={userId} 
            userName={userName}
            initialRoom={urlGameId ? `game_matrix_${urlGameId}` : 'game_central'}
          />
        </div>
      </div>
    </div>
  );
}
