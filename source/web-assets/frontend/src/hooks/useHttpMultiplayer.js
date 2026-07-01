/**
 * useHttpMultiplayer Hook
 * Pure HTTP polling-based multiplayer (NO Socket.IO, NO WebSocket!)
 * Works with Emergent's infrastructure without any special configuration!
 */
import { useEffect, useState, useCallback, useRef } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useHttpMultiplayer = (userId, userName, initialGameId = null) => {
  const [connected, setConnected] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [gameId, setGameId] = useState(initialGameId);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponent, setOpponent] = useState(null);
  
  const pollingIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const currentGameTypeRef = useRef(null);

  // Debug: Log gameId changes
  useEffect(() => {
  }, [gameId]);

  // Start game polling when gameId is set (from URL or matchmaking)
  useEffect(() => {
    if (gameId && userId) {
      startGamePolling(gameId);
      
      // Cleanup on unmount or gameId change
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [gameId, userId]);

  // Heartbeat to keep session alive
  useEffect(() => {
    if (!userId) {
      return;
    }


    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`${API_URL}/api/http-multiplayer/heartbeat?user_id=${userId}`, {
          method: 'POST',
        });
        
        if (response.ok) {
          setConnected(true);
          setError(null);
        } else {
          // console.error('❌ Heartbeat failed with status:', response.status);
          setConnected(false);
          setError(`Connection error: ${response.status}`);
        }
      } catch (err) {
        // console.error('❌ Heartbeat failed:', err);
        setConnected(false);
        setError('Connection lost');
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [userId]);

  // Join matchmaking
  const joinMatchmaking = useCallback(async (gameType) => {
    if (!userId || !userName) {
      setError('User ID and name required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/http-multiplayer/join-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_type: gameType,
          user_id: userId,
          user_name: userName
        })
      });

      const data = await response.json();

      if (data.success) {
        setMatchmaking(true);
        currentGameTypeRef.current = gameType;
        setError(null);

        // If match found immediately
        if (data.match_found) {
          setGameId(data.game_id);
          setMatchmaking(false);
        } else {
          // Start polling for match
          startMatchPolling(gameType);
        }
      }
    } catch (err) {
      // console.error('Join matchmaking error:', err);
      setError('Failed to join matchmaking');
    }
  }, [userId, userName]);

  // Poll for match
  const startMatchPolling = (gameType) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/http-multiplayer/check-match/${userId}?game_type=${gameType}`,
          { }
        );
        const data = await response.json();

        if (data.match_found) {
          setGameId(data.game_id);
          setOpponent({ name: data.opponent_name });
          setMatchmaking(false);
          
          // Stop polling for match
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Start polling for game state
          startGamePolling(data.game_id);
        }
      } catch (err) {
        // console.error('Match polling error:', err);
      }
    }, 2000); // Poll every 2 seconds
  };

  // Poll for game state
  const startGamePolling = (gid) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const pollGameState = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/http-multiplayer/game/${gid}?user_id=${userId}`,
          { }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Game no longer exists
            setGameId(null);
            setGameState(null);
            setError('Game ended');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            return;
          }
          throw new Error('Failed to fetch game state');
        }

        const data = await response.json();
        setGameState(data);
        setIsMyTurn(data.is_my_turn);

        if (!opponent && data.player2) {
          const opponentData = data.my_role === 'player1' ? data.player2 : data.player1;
          setOpponent({ name: opponentData.name });
        }

        // Stop polling if game is completed
        if (data.status === 'completed' || data.status === 'abandoned') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        // console.error('Game state polling error:', err);
      }
    };

    // Initial fetch
    pollGameState();

    // Poll every 1.5 seconds during game
    pollingIntervalRef.current = setInterval(pollGameState, 1500);
  };

  // Leave matchmaking
  const leaveMatchmaking = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/http-multiplayer/leave-queue?user_id=${userId}`, {
        method: 'POST',
      });

      setMatchmaking(false);
      currentGameTypeRef.current = null;

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    } catch (err) {
      // console.error('Leave matchmaking error:', err);
    }
  }, [userId]);

  // Make move
  const makeMove = useCallback(async (move, newGameState) => {
    if (!gameId) {
      setError('No active game');
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/http-multiplayer/make-move?user_id=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          move,
          new_game_state: newGameState
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update will come through polling
        return true;
      } else {
        setError('Failed to make move');
        return false;
      }
    } catch (err) {
      // console.error('Make move error:', err);
      setError('Failed to make move');
      return false;
    }
  }, [gameId, userId]);

  // End game
  const endGame = useCallback(async (winner) => {
    if (!gameId) return;

    try {
      await fetch(`${API_URL}/api/http-multiplayer/end-game?game_id=${gameId}&user_id=${userId}&winner=${winner}`, {
        method: 'POST',
      });

      // Stop polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    } catch (err) {
      // console.error('End game error:', err);
    }
  }, [gameId, userId]);

  // Leave game
  const leaveGame = useCallback(() => {
    setGameId(null);
    setGameState(null);
    setOpponent(null);
    setMatchmaking(false);
    setIsMyTurn(false);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  return {
    connected,
    matchmaking,
    gameId,
    gameState,
    isMyTurn,
    opponent,
    error,
    joinMatchmaking,
    leaveMatchmaking,
    makeMove,
    endGame,
    leaveGame,
    clearError: () => setError(null)
  };
};
