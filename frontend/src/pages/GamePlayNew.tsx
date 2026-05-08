import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

// Tic Tac Toe Component with 3D effects
const TicTacToeBoard = ({ gameState, onMove, currentUserId }) => {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;

  const handleCellClick = (row, col) => {
    if (!isMyTurn || board[row][col] !== '') return;
    onMove({ row, col });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold mb-2">Tic Tac Toe</h2>
        <p className="text-lg">
          {isMyTurn ? `Your turn (${currentPlayer.role})` : 'Opponent\'s turn'}
        </p>
      </div>

      {/* 3D Game Board */}
      <div 
        className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl shadow-2xl backdrop-blur-sm"
        style={{
          perspective: '1000px',
          transform: 'rotateX(5deg)',
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              disabled={!isMyTurn || cell !== ''}
              className={`
                w-24 h-24 text-4xl font-bold rounded-xl
                transition-all duration-300 ease-out
                ${cell === '' ? 'bg-white/10 hover:bg-white/20 hover:scale-110' : 'bg-white/30'}
                ${cell === 'X' ? 'text-blue-400' : 'text-pink-400'}
                ${isMyTurn && cell === '' ? 'cursor-pointer hover:shadow-lg hover:shadow-purple-500/50' : 'cursor-not-allowed'}
                backdrop-blur-sm border-2 border-white/20
              `}
              style={{
                transform: cell !== '' ? 'translateZ(20px)' : 'translateZ(0px)',
                boxShadow: cell !== '' ? '0 8px 32px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {cell && (
                <span className="animate-bounce-in" style={{
                  animation: 'bounceIn 0.5s ease-out',
                  textShadow: '0 0 20px currentColor',
                }}>
                  {cell}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {gameState.status === 'completed' && (
        <div className="mt-8 text-center animate-fade-in">
          <div className="text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full shadow-lg">
            {gameState.winner === 'draw' ? '🤝 Draw!' : 
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-bounce-in { display: inline-block; }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
};

// Connect 4 Component with 3D effects
const Connect4Board = ({ gameState, onMove, currentUserId }) => {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;
  const [hoveredCol, setHoveredCol] = useState(null);

  const handleColumnClick = (col) => {
    if (!isMyTurn) return;
    onMove({ col });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold mb-2">Connect 4</h2>
        <p className="text-lg">
          {isMyTurn ? `Your turn (${currentPlayer.role})` : 'Opponent\'s turn'}
        </p>
      </div>

      {/* 3D Game Board */}
      <div 
        className="relative p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl shadow-2xl backdrop-blur-sm"
        style={{
          perspective: '1200px',
          transform: 'rotateX(10deg)',
        }}
      >
        {/* Column hover indicators */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {[...Array(7)].map((_, col) => (
            <div
              key={col}
              className={`h-12 flex items-center justify-center rounded-t-lg transition-all duration-300 ${
                isMyTurn && hoveredCol === col
                  ? 'bg-white/30 scale-110'
                  : 'bg-transparent'
              }`}
            >
              {isMyTurn && hoveredCol === col && (
                <div className={`w-8 h-8 rounded-full ${
                  currentPlayer.role === 'red' ? 'bg-red-500' : 'bg-yellow-400'
                } animate-bounce shadow-lg`} />
              )}
            </div>
          ))}
        </div>

        {/* Board grid */}
        <div className="grid grid-cols-7 gap-2">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleColumnClick(colIndex)}
                onMouseEnter={() => isMyTurn && setHoveredCol(colIndex)}
                onMouseLeave={() => setHoveredCol(null)}
                disabled={!isMyTurn}
                className={`
                  w-16 h-16 rounded-full border-4 border-white/30
                  transition-all duration-300 ease-out
                  ${isMyTurn ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  ${cell === '' ? 'bg-white/10' : ''}
                  ${cell === 'red' ? 'bg-red-500 shadow-lg shadow-red-500/50' : ''}
                  ${cell === 'yellow' ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : ''}
                `}
                style={{
                  transform: cell !== '' ? 'translateZ(15px)' : 'translateZ(0px)',
                  boxShadow: cell !== '' ? '0 8px 32px rgba(0,0,0,0.4)' : 'inset 0 0 20px rgba(255,255,255,0.1)',
                }}
              />
            ))
          )}
        </div>
      </div>

      {gameState.status === 'completed' && (
        <div className="mt-8 text-center animate-fade-in">
          <div className="text-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-4 rounded-full shadow-lg">
            {gameState.winner === 'draw' ? '🤝 Draw!' :
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </div>
        </div>
      )}
    </div>
  );
};

// Main GamePlay Component
const GamePlay = () => {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const gameId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    loadGameState();
    
    // Poll for updates every 2 seconds
    const interval = setInterval(loadGameState, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  const loadGameState = async () => {
    try {
      const response = await fetch(`${API}/api/games/${gameId}`, {
        
      });
      
      if (response.ok) {
        const data = await response.json();
        setGameState(data);
        
        // Get current user
        const userRes = await fetch(`${API}/api/users/me`, {
          
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUserId(userData.user_id);
        }
      }
    } catch (error) {
      // console.error('Error loading game:', error);
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (moveData) => {
    try {
      const response = await fetch(`${API}/api/games/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ move_data: moveData }),
      });

      if (response.ok) {
        const data = await response.json();
        setGameState(data.game);
      } else {
        const error = await response.json();
        alert(error.detail || 'Invalid move');
      }
    } catch (error) {
      // console.error('Error making move:', error);
      alert('Failed to make move');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl">Loading game...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl">Game not found</div>
      </div>
    );
  }

  // Render appropriate game component
  const renderGame = () => {
    switch (gameState.game_type) {
      case 'tictactoe':
        return <TicTacToeBoard gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />;
      case 'connect4':
        return <Connect4Board gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />;
      default:
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">{gameState.game_type}</h2>
            <p className="text-gray-400">Game UI coming soon...</p>
            <p className="text-sm mt-4">Backend is ready, frontend in development</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
      <div className="container mx-auto py-8">
        <Button
          onClick={() => window.history.back()}
          className="mb-4"
        >
          ← Back to Games
        </Button>

        {renderGame()}
      </div>
    </div>
  );
};

export default GamePlay;
