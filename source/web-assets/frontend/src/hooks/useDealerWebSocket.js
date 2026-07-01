/**
 * Custom hook for AI Dealer WebSocket real-time connection
 * Handles behavioral packets, reactions, and live commentary
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

/**
 * Hook for managing dealer WebSocket connection
 * @param {string} gameId - Unique game session ID
 * @param {function} onDealerReaction - Callback for dealer reactions
 * @param {function} onDealerCommentary - Callback for dealer commentary
 */
export const useDealerWebSocket = (gameId, onDealerReaction, onDealerCommentary) => {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    if (!gameId) return;

    try {
      const wsUrl = `${WS_URL}/api/dealer-ws/${gameId}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'DEALER_REACTION':
              if (onDealerReaction) {
                onDealerReaction(message.payload);
              }
              break;
              
            case 'DEALER_COMMENTARY':
              if (onDealerCommentary) {
                onDealerCommentary(message.payload);
              }
              break;
              
            case 'DEALER_NUDGE':
              if (onDealerReaction) {
                onDealerReaction(message.payload);
              }
              break;
              
            default:
          }
        } catch (err) {
          // console.error('Error parsing dealer WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        // console.error('❌ Dealer WebSocket error:', error);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      // console.error('Failed to create WebSocket connection:', err);
      setError(err.message);
    }
  }, [gameId, onDealerReaction, onDealerCommentary, reconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * Send game event to dealer for reaction
   */
  const sendGameEvent = useCallback((eventType, context = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_event',
        event_type: eventType,
        context
      }));
    } else {
    }
  }, []);

  /**
   * Request dealer commentary for current game state
   */
  const requestCommentary = useCallback((gameState = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request_commentary',
        game_state: gameState
      }));
    }
  }, []);

  /**
   * Notify dealer of idle player
   */
  const notifyIdlePlayer = useCallback((playerId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'idle_warning',
        player_id: playerId
      }));
    }
  }, []);

  return {
    isConnected,
    error,
    sendGameEvent,
    requestCommentary,
    notifyIdlePlayer
  };
};

export default useDealerWebSocket;
