// Multiplayer Game Hook - Reusable logic for all games
import { useEffect, useState, useCallback } from 'react';

export function useMultiplayerGame({ 
  isMultiplayer, 
  multiplayerManager, 
  currentPlayer,
  remotePlayer,
  gameType,
  onOpponentMove 
}) {
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [turnIndicator, setTurnIndicator] = useState('');

  useEffect(() => {
    if (!isMultiplayer || !multiplayerManager) return;

    // Listen for opponent moves
    const handleOpponentMove = (data) => {
      
      // Call the game-specific handler
      if (onOpponentMove) {
        onOpponentMove(data);
      }

      // Switch turn
      setIsMyTurn(true);
      setTurnIndicator("Your Turn");
    };

    multiplayerManager.on('opponent_move', handleOpponentMove);

    return () => {
      multiplayerManager.off('opponent_move', handleOpponentMove);
    };
  }, [isMultiplayer, multiplayerManager, onOpponentMove]);

  // Send move to opponent
  const sendMove = useCallback((move, gameState) => {
    if (!isMultiplayer || !multiplayerManager) return;

    
    multiplayerManager.sendMove(move, gameState);
    
    // Switch turn
    setIsMyTurn(false);
    setTurnIndicator("Opponent's Turn");
  }, [isMultiplayer, multiplayerManager]);

  // Check if it's player's turn
  const canMakeMove = useCallback(() => {
    if (!isMultiplayer) return true; // Always allow in single player
    return isMyTurn;
  }, [isMultiplayer, isMyTurn]);

  return {
    isMyTurn,
    turnIndicator,
    sendMove,
    canMakeMove,
    isMultiplayerMode: isMultiplayer && multiplayerManager
  };
}

// Turn Indicator Component
export function TurnIndicator({ isMultiplayer, isMyTurn, playerName, opponentName }) {
  if (!isMultiplayer) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`px-6 py-3 rounded-full font-black text-lg border-2 backdrop-blur-xl transition-all ${
        isMyTurn 
          ? 'bg-green-600/90 border-green-400 text-white shadow-lg shadow-green-500/50'
          : 'bg-orange-600/90 border-orange-400 text-white shadow-lg shadow-orange-500/50'
      }`}>
        {isMyTurn ? `🎮 Your Turn` : `⏳ ${opponentName || "Opponent"}'s Turn`}
      </div>
    </div>
  );
}
