
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import GameTable from '../components/GameTable';
import { BrandedGameLayout } from '../components/games/BrandedGameLayout';
import { ModernCard } from '../components/games/ModernCard';
import { VictoryAnimation } from '../components/games/VictoryAnimation';
import { GameParticles } from '../components/games/GameParticles';
import { motion } from 'framer-motion';

// Lazy load 3D components to avoid React 19 compatibility issues at initial load
const Connect4_3D = lazy(() => import('../components/games/Connect4_3D'));
const Chess_3D = lazy(() => import('../components/games/Chess_3D'));

const API = process.env.REACT_APP_BACKEND_URL;

// ==================== TIC TAC TOE ====================
const TicTacToeBoard = ({ gameState, onMove, currentUserId }) => {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;

  // Prepare players for GameTable with scores
  const tablePlayers = gameState.players.map(p => ({
    ...p,
    score: p.role === 'X' ? 
      (gameState.state.scores?.X || 0) : 
      (gameState.state.scores?.O || 0),
    status: gameState.current_turn === p.user_id ? 'Thinking...' : 'Waiting'
  }));

  return (
    <GameTable 
      players={tablePlayers}
      currentTurn={gameState.current_turn}
      currentUserId={currentUserId}
      gameType="board"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center"
      >
        {/* Game Title with Vibez Branding */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 text-center"
        >
          <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text mb-2">
            Tic Tac Toe
          </h2>
          <p className="text-white/60 text-sm">Global Vibez DSG™ Multiplayer</p>
        </motion.div>

        {/* Game Board with enhanced styling */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 p-6 bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-3xl backdrop-blur-md border-2 border-purple-500/30 shadow-2xl"
        >
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <motion.button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => isMyTurn && cell === '' && onMove({ row: rowIndex, col: colIndex })}
                disabled={!isMyTurn || cell !== ''}
                whileHover={cell === '' && isMyTurn ? { scale: 1.1, rotate: 5 } : {}}
                whileTap={cell === '' && isMyTurn ? { scale: 0.95 } : {}}
                className={`w-20 h-20 text-5xl font-bold rounded-xl transition-all duration-300
                  ${cell === '' ? 'bg-slate-800 hover:bg-slate-700 hover:shadow-lg' : 'bg-slate-700'}
                  ${cell === 'X' ? 'text-blue-400' : 'text-pink-400'}
                  border-2 ${cell ? 'border-white/30' : 'border-slate-600'} shadow-lg`}
                style={{
                  textShadow: cell !== '' ? '0 0 20px currentColor, 0 0 40px currentColor' : '',
                }}
              >
                {cell && (
                  <motion.span
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    {cell}
                  </motion.span>
                )}
              </motion.button>
            ))
          )}
        </motion.div>

        {/* Game Result with Victory Animation */}
        {gameState.status === 'completed' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-600 px-8 py-4 rounded-full shadow-2xl"
          >
            {gameState.winner === 'draw' ? '🤝 Draw!' : 
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </motion.div>
        )}
      </motion.div>
    </GameTable>
  );
};

// ==================== CONNECT 4 ====================
const Connect4Board = ({ gameState, onMove, currentUserId }) => {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;
  const [hoveredCol, setHoveredCol] = useState(null);

  // Prepare players for GameTable
  const tablePlayers = gameState.players.map(p => ({
    ...p,
    score: gameState.state.scores?.[p.role] || 0,
    status: gameState.current_turn === p.user_id ? 'Dropping...' : 'Waiting'
  }));

  return (
    <GameTable 
      players={tablePlayers}
      currentTurn={gameState.current_turn}
      currentUserId={currentUserId}
      gameType="board"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center"
      >
        {/* Game Title with Vibez Branding */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 text-center"
        >
          <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-red-400 via-yellow-400 to-orange-400 bg-clip-text mb-2">
            Connect 4
          </h2>
          <p className="text-white/60 text-sm">Global Vibez DSG™ Multiplayer</p>
        </motion.div>

        {/* Game Board */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative p-6 bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-3xl backdrop-blur-md border-2 border-yellow-500/30 shadow-2xl"
        >
          {/* Column indicators */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {[...Array(7)].map((_, col) => (
              <div key={col} className={`h-12 flex items-center justify-center transition-all ${
                isMyTurn && hoveredCol === col ? 'scale-110' : ''
              }`}>
                {isMyTurn && hoveredCol === col && (
                  <div className={`w-8 h-8 rounded-full animate-bounce ${
                    currentPlayer.role === 'red' ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)]'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Board Grid */}
          <div className="grid grid-cols-7 gap-2">
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => isMyTurn && onMove({ column: colIndex })}
                  onMouseEnter={() => setHoveredCol(colIndex)}
                  onMouseLeave={() => setHoveredCol(null)}
                  disabled={!isMyTurn}
                  className={`w-14 h-14 rounded-full transition-all duration-300 border-2 ${
                    cell === '' 
                      ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' 
                      : cell === 'red'
                        ? 'bg-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                        : 'bg-yellow-400 border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.6)]'
                  } ${isMyTurn && cell === '' ? 'hover:scale-110' : ''}`}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Game Result with Victory Animation */}
        {gameState.status === 'completed' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-red-500 to-yellow-500 px-8 py-4 rounded-full shadow-2xl"
          >
            {gameState.winner === 'draw' ? '🤝 Draw!' : 
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </motion.div>
        )}
      </motion.div>
    </GameTable>
  );
};

// ==================== UNO ====================
const UNOGame = ({ gameState, onMove, currentUserId }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [wildColor, setWildColor] = useState(null);
  const state = gameState.state;
  const myHand = state.players[currentUserId]?.hand || [];
  const topCard = state.discard[state.discard.length - 1];
  const isMyTurn = gameState.current_turn === currentUserId;

  // Prepare players for GameTable
  const tablePlayers = gameState.players.map(p => ({
    ...p,
    score: state.players[p.user_id]?.hand?.length || 0,
    status: gameState.current_turn === p.user_id ? 'Playing...' : `${state.players[p.user_id]?.hand?.length || 0} cards`
  }));

  const cardColor = (card) => {
    if (card.startsWith('R')) return 'bg-red-500';
    if (card.startsWith('B')) return 'bg-blue-500';
    if (card.startsWith('G')) return 'bg-green-500';
    if (card.startsWith('Y')) return 'bg-yellow-400';
    return 'bg-gray-800';
  };

  const playCard = (card) => {
    if (!isMyTurn) return;
    
    if (card.startsWith('W') && !wildColor) {
      setSelectedCard(card);
      return;
    }

    onMove({ action: 'play', card, wild_color: wildColor });
    setSelectedCard(null);
    setWildColor(null);
  };

  const drawCard = () => {
    if (!isMyTurn) return;
    onMove({ action: 'draw' });
  };

  return (
    <GameTable 
      players={tablePlayers}
      currentTurn={gameState.current_turn}
      currentUserId={currentUserId}
      gameType="card"
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center"
      >
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-4 text-center"
      >
        <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-red-500 via-blue-500 to-green-500 bg-clip-text mb-2">
          UNO
        </h2>
        <p className="text-white/60 text-sm">Global Vibez DSG™ Multiplayer</p>
      </motion.div>

      {/* Discard pile */}
      <div className="mb-6">
        <div className={`w-28 h-40 rounded-2xl flex items-center justify-center text-2xl font-bold text-white ${cardColor(topCard)} shadow-2xl border-2 border-white/20`}
          style={{ transform: 'rotateY(-5deg)' }}>
          {topCard}
        </div>
        {state.current_color && (
          <div className="text-center mt-2 text-white text-sm bg-slate-800 px-3 py-1 rounded-full inline-block">
            Color: {state.current_color}
          </div>
        )}
      </div>

      {/* Draw pile */}
      <Button 
        onClick={drawCard} 
        disabled={!isMyTurn} 
        className="mb-6 bg-slate-700 hover:bg-slate-600"
      >
        🎴 Draw Card
      </Button>

      {/* Player's hand */}
      <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
        {myHand.map((card, idx) => (
          <button
            key={`myHand-${idx}`}
            onClick={() => playCard(card)}
            disabled={!isMyTurn}
            className={`w-20 h-32 rounded-xl flex items-center justify-center text-base font-bold text-white ${cardColor(card)} 
              transition-all duration-300 hover:scale-110 hover:-translate-y-3 border-2 border-white/30 shadow-lg`}
            style={{
              transform: `translateY(${idx % 2 === 0 ? '0' : '8px'}) rotateZ(${(idx - myHand.length / 2) * 2}deg)`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            {card}
          </button>
        ))}
      </div>

      {/* Wild color selector */}
      {selectedCard?.startsWith('W') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-4">Choose Color</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { color: 'R', bg: 'bg-red-500', name: 'Red' },
                { color: 'B', bg: 'bg-blue-500', name: 'Blue' },
                { color: 'G', bg: 'bg-green-500', name: 'Green' },
                { color: 'Y', bg: 'bg-yellow-400', name: 'Yellow' },
              ].map(({ color, bg, name }) => (
                <button
                  key={color}
                  onClick={() => {
                    setWildColor(color);
                    playCard(selectedCard);
                  }}
                  className={`${bg} text-white font-bold py-4 px-8 rounded-xl hover:scale-110 transition-transform`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameState.status === 'completed' && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full shadow-2xl"
        >
          {gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
        </motion.div>
      )}
      </motion.div>
    </GameTable>
  );
};

// ==================== CARD GAMES (Simplified) ====================
const CardGame = ({ gameState, onMove, currentUserId, gameName }) => {
  const isMyTurn = gameState.current_turn === currentUserId;

  // Prepare players for GameTable
  const tablePlayers = gameState.players.map(p => ({
    ...p,
    score: gameState.state.scores?.[p.user_id] || 0,
    status: gameState.current_turn === p.user_id ? 'Playing...' : 'Waiting'
  }));

  return (
    <GameTable 
      players={tablePlayers}
      currentTurn={gameState.current_turn}
      currentUserId={currentUserId}
      gameType="card"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center"
      >
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text mb-2">
            {gameName}
          </h2>
          <p className="text-white/60 text-sm">Global Vibez DSG™ Multiplayer</p>
        </motion.div>

        <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-10 text-center border-2 border-slate-700 shadow-2xl">
          <div className="text-6xl mb-4">🎴</div>
          <p className="text-xl text-white mb-3">Game in Progress</p>
          <p className="text-sm text-slate-400 mb-6">
            Full UI coming soon!
          </p>
          
          {isMyTurn && (
            <Button
              onClick={() => onMove({ action: 'play' })}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3"
            >
              Make Move
            </Button>
          )}
        </div>

        {gameState.status === 'completed' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full shadow-2xl"
          >
            {gameState.winner === 'draw' ? '🤝 Draw!' :
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </motion.div>
        )}
      </motion.div>
    </GameTable>
  );
};

// ==================== BOARD GAMES (Simplified) ====================
const BoardGame = ({ gameState, onMove, currentUserId, gameName, emoji }) => {
  const isMyTurn = gameState.current_turn === currentUserId;

  // Prepare players for GameTable
  const tablePlayers = gameState.players.map(p => ({
    ...p,
    score: gameState.state.scores?.[p.user_id] || 0,
    status: gameState.current_turn === p.user_id ? 'Playing...' : 'Waiting'
  }));

  return (
    <GameTable 
      players={tablePlayers}
      currentTurn={gameState.current_turn}
      currentUserId={currentUserId}
      gameType="board"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center"
      >
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text mb-2">
            {emoji} {gameName}
          </h2>
          <p className="text-white/60 text-sm">Global Vibez DSG™ Multiplayer</p>
        </motion.div>

        <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-10 text-center border-2 border-slate-700 shadow-2xl">
          <div className="text-8xl mb-4">{emoji}</div>
          <p className="text-xl text-white mb-3">Game in Progress</p>
          <p className="text-sm text-slate-400 mb-6">
            Advanced 3D board coming soon!
          </p>
          
          {isMyTurn && (
            <Button
              onClick={() => onMove({ action: 'move' })}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3"
            >
              Make Move
            </Button>
          )}
        </div>

        {gameState.status === 'completed' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full shadow-2xl"
          >
            {gameState.winner === 'draw' ? '🤝 Draw!' :
             gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
          </motion.div>
        )}
      </motion.div>
    </GameTable>
  );
};

// ==================== MAIN COMPONENT ====================
const GamePlayComplete = () => {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [mode3D, setMode3D] = useState(true); // Default to 3D mode for supported games
  const navigate = useNavigate();
  
  const gameId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    loadGameState();
    const interval = setInterval(loadGameState, 2000);
    return () => clearInterval(interval);
  }, [gameId]);

  const loadGameState = async () => {
    try {
      const response = await fetch(`${API}/api/games/${gameId}`, { });
      if (response.ok) {
        const data = await response.json();
        setGameState(data);
        
        const userRes = await fetch(`${API}/api/users/me`, { });
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
      // console.error('Error:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 text-white text-2xl">Loading...</div>;
  if (!gameState) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 text-white text-2xl">Game not found</div>;

  // Check if 3D mode is available for this game
  const has3DMode = ['connect4', 'chess'].includes(gameState.game_type);

  const renderGame = () => {
    const { game_type } = gameState;
    
    switch (game_type) {
      case 'tictactoe':
        return <TicTacToeBoard gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />;
      case 'connect4':
        return mode3D ? (
          <Suspense fallback={<div className="text-white text-center p-8">Loading 3D view...</div>}>
            <Connect4_3D gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />
          </Suspense>
        ) : (
          <Connect4Board gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />
        );
      case 'uno':
        return <UNOGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />;
      case 'go_fish':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Go Fish" />;
      case 'crazy_eights':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Crazy Eights" />;
      case 'blackjack':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Blackjack" />;
      case 'poker':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Poker" />;
      case 'hearts':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Hearts" />;
      case 'spades':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Spades" />;
      case 'rummy':
        return <CardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Rummy" />;
      case 'chess':
        return mode3D ? (
          <Suspense fallback={<div className="text-white text-center p-8">Loading 3D view...</div>}>
            <Chess_3D gameState={gameState} onMove={makeMove} currentUserId={currentUserId} />
          </Suspense>
        ) : (
          <BoardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Chess" emoji="♟️" />
        );
      case 'checkers':
        return <BoardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Checkers" emoji="🟤" />;
      case 'reversi':
        return <BoardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Reversi" emoji="⚫" />;
      case 'ludo':
        return <BoardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Ludo" emoji="🎲" />;
      case 'backgammon':
        return <BoardGame gameState={gameState} onMove={makeMove} currentUserId={currentUserId} gameName="Backgammon" emoji="🎲" />;
      default:
        return <div className="text-center p-8 text-white">Game type not supported</div>;
    }
  };

  return (
    <BrandedGameLayout
      gameType={gameState?.game_type || 'multiplayer'}
      gameName={gameState?.game_type?.replace('_', ' ').toUpperCase() || 'Game'}
      onBack={() => navigate('/games')}
      showParticles={gameState?.status === 'completed'}
    >
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-4">
          {has3DMode && (
            <Button
              onClick={() => setMode3D(!mode3D)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {mode3D ? '🎮 Switch to 2D' : '🎮 Switch to 3D'}
            </Button>
          )}
        </div>
        
        {gameState?.status === 'completed' && <VictoryAnimation />}
        
        {renderGame()}
      </div>
    </BrandedGameLayout>
  );
};

export default GamePlayComplete;
