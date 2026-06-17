import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useBlackjackSocket = (roomId, sessionId, username) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [spectators, setSpectators] = useState(0);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Only connect if we have essential data
    if (!roomId) {
      return;
    }


    // Initialize Socket.IO connection
    const socket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setConnected(true);

      // Join Blackjack room
      socket.emit('join_blackjack_room', {
        room_id: roomId,
        session_id: sessionId || socket.id,
        username: username || 'Player',
        mode: 'player'
      }, (response) => {
      });
    });

    socket.on('connect_error', (error) => {
      // console.error('❌ Socket.IO connection error:', error.message);
      setConnected(false);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
    });

    // Blackjack events
    socket.on('player_joined', (data) => {
      setPlayers(prev => [...prev, data.username]);
      setSpectators(data.spectator_count);
    });

    socket.on('player_left', (data) => {
      setPlayers(prev => prev.filter(p => p !== data.username));
    });

    socket.on('game_state_sync', (state) => {
      setGameState(state);
    });

    socket.on('blackjack_action_update', (data) => {
      setGameState(data.game_state);
    });

    socket.on('blackjack_game_update', (data) => {
      setGameState(data.game_state);
    });

    // Cleanup on unmount
    return () => {
      if (socket.connected) {
        socket.emit('leave_blackjack_room', { session_id: sessionId || socket.id });
        socket.disconnect();
      }
    };
  }, [roomId, username]); // Removed sessionId from deps so it connects immediately

  // Helper functions
  const broadcastAction = (action, handIndex, gameState) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('blackjack_action', {
        room_id: roomId,
        session_id: sessionId,
        action,
        hand_index: handIndex,
        game_state: gameState
      });
    }
  };

  const broadcastGameUpdate = (eventType, gameState) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('blackjack_game_update', {
        room_id: roomId,
        event_type: eventType,
        game_state: gameState
      });
    }
  };

  return {
    connected,
    players,
    spectators,
    gameState,
    broadcastAction,
    broadcastGameUpdate,
    socket: socketRef.current
  };
};

export default useBlackjackSocket;
