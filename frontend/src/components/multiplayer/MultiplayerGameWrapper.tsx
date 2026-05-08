import React, { useState, useEffect, useCallback } from 'react';
import { useMultiplayerGame, TurnIndicator } from '@/hooks/useMultiplayerGame';

/**
 * Multiplayer Wrapper for Games
 * Wraps any game component and adds multiplayer sync
 */
export function MultiplayerGameWrapper({ 
  GameComponent,
  isMultiplayer,
  multiplayerManager,
  currentPlayer,
  remotePlayer,
  gameType,
  ...gameProps 
}) {
  const [game, setGame] = useState(gameProps.game || null);
  const [makingMove, setMakingMove] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // Handle opponent moves
  const handleOpponentMove = useCallback((data) => {
    
    // Update game state with opponent's move
    if (data.game_state) {
      setGame(data.game_state);
    }

    // Trigger the move on the game component
    if (data.move) {
      // Game-specific move handling
      handleRemoteMove(data.move);
    }
  }, [gameType]);

  const { isMyTurn, turnIndicator, sendMove, canMakeMove } = useMultiplayerGame({
    isMultiplayer,
    multiplayerManager,
    currentPlayer,
    remotePlayer,
    gameType,
    onOpponentMove: handleOpponentMove
  });

  // Intercept local moves and sync to opponent
  const handleMove = useCallback(async (moveData) => {
    if (!canMakeMove()) {
      return;
    }

    setMakingMove(true);

    try {
      // Call original onMove if it exists
      if (gameProps.onMove) {
        await gameProps.onMove(moveData);
      }

      // Send move to opponent in multiplayer mode
      if (isMultiplayer && multiplayerManager) {
        sendMove(moveData, game);
      }
    } catch (error) {
      // console.error('Move error:', error);
    } finally {
      setMakingMove(false);
    }
  }, [canMakeMove, gameProps.onMove, isMultiplayer, multiplayerManager, sendMove, game]);

  // Handle remote moves from opponent
  const handleRemoteMove = useCallback((moveData) => {
    
    // Apply the move locally
    // This is game-specific and needs to update the board
    // For now, we'll rely on the game_state sync
  }, []);

  // If single player, render normally
  if (!isMultiplayer) {
    return <GameComponent {...gameProps} />;
  }

  // Multiplayer mode
  return (
    <div className="relative">
      {/* Turn Indicator */}
      <TurnIndicator 
        isMultiplayer={isMultiplayer}
        isMyTurn={isMyTurn}
        playerName={currentPlayer?.name}
        opponentName={remotePlayer?.user_name}
      />

      {/* Game Component */}
      <GameComponent
        {...gameProps}
        game={game}
        onMove={handleMove}
        makingMove={makingMove || !isMyTurn}
        aiThinking={!isMyTurn}
      />

      {/* Waiting Overlay */}
      {!isMyTurn && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 pointer-events-none flex items-center justify-center">
          <div className="bg-orange-600/90 backdrop-blur-xl px-8 py-4 rounded-2xl border-2 border-orange-400 shadow-2xl">
            <p className="text-xl font-black text-white flex items-center gap-3">
              <span className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
              Waiting for {remotePlayer?.user_name || 'opponent'}...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Quick helper to make a game multiplayer-ready
 * Usage in MultiplayerGameRoom:
 *   <MultiplayerGameWrapper 
 *     GameComponent={PremiumTicTacToeTable}
 *     isMultiplayer={true}
 *     multiplayerManager={multiplayerManager}
 *     currentPlayer={currentPlayer}
 *     remotePlayer={remotePlayer}
 *     gameType="tictactoe"
 *     game={gameState}
 *     onMove={handleMove}
 *   />
 */
