/**
 * useMultiplayer Hook
 * Custom React hook for real-time multiplayer functionality
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const useMultiplayer = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchProposal, setMatchProposal] = useState(null);
  
  const socketRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      // CRITICAL: Try polling FIRST, then upgrade to WebSocket if available
      // This allows multiplayer to work even without WebSocket ingress support!
      transports: ['polling', 'websocket'],
      withCredentials: true,
      // Increase timeout for polling connections
      timeout: 10000,
      // Force new connection (helps with testing)
      forceNew: false,
      // Reconnection settings
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      // console.error('Connection error:', err);
      setError('Failed to connect to server');
    });

    // Online count
    newSocket.on('online_count', (data) => {
      setOnlinePlayers(data.count);
    });

    // Error handling
    newSocket.on('error', (data) => {
      setError(data.message);
      // console.error('Socket error:', data.message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Create room
  const createRoom = useCallback((gameType, userId, userName, isPrivate = true) => {
    if (!socket) return;

    socket.emit('create_room_event', {
      game_type: gameType,
      user_id: userId,
      user_name: userName,
      is_private: isPrivate
    });

    socket.once('room_created', (data) => {
      if (data.success) {
        setRoom(data.room);
      }
    });
  }, [socket]);

  // Join room
  const joinRoom = useCallback((roomCode, userId, userName) => {
    if (!socket) return;

    socket.emit('join_room_event', {
      room_code: roomCode,
      user_id: userId,
      user_name: userName
    });

    socket.once('player_joined', (data) => {
      setRoom(data.room);
    });

    socket.once('join_failed', (data) => {
      setError(data.message);
    });
  }, [socket]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (!socket) return;

    socket.emit('leave_room_event', {});
    setRoom(null);
    setChatMessages([]);
  }, [socket]);

  // Mark player as ready
  const markReady = useCallback(() => {
    if (!socket) return;

    socket.emit('player_ready', {});
  }, [socket]);

  // Make move
  const makeMove = useCallback((move, gameState) => {
    if (!socket) return;

    socket.emit('make_move', {
      move,
      game_state: gameState
    });
  }, [socket]);

  // End game
  const endGame = useCallback((winner) => {
    if (!socket) return;

    socket.emit('game_over', {
      winner
    });
  }, [socket]);

  // Send chat message
  const sendChat = useCallback((message, senderName) => {
    if (!socket) return;

    socket.emit('send_chat', {
      message,
      sender_name: senderName
    });
  }, [socket]);

  // Get public rooms
  const getPublicRooms = useCallback((gameType = null) => {
    if (!socket) return;

    socket.emit('get_public_rooms_event', {
      game_type: gameType
    });
  }, [socket]);

  // Join matchmaking
  const joinMatchmaking = useCallback((gameType, userId, userName) => {
    if (!socket) return;

    socket.emit('join_matchmaking_event', {
      game_type: gameType,
      user_id: userId,
      user_name: userName
    });

    setMatchmaking(true);
  }, [socket]);

  // Leave matchmaking
  const leaveMatchmaking = useCallback(() => {
    if (!socket) return;

    socket.emit('leave_matchmaking_event', {});
    setMatchmaking(false);
    setMatchProposal(null);
  }, [socket]);

  // Accept match
  const acceptMatch = useCallback(() => {
    if (!socket || !matchProposal) return;

    socket.emit('accept_match_event', {});
    setMatchProposal(null);
    setMatchmaking(false);
  }, [socket, matchProposal]);

  // Reject match
  const rejectMatch = useCallback(() => {
    if (!socket || !matchProposal) return;

    socket.emit('reject_match_event', {});
    setMatchProposal(null);
  }, [socket, matchProposal]);

  // Listen for room updates
  useEffect(() => {
    if (!socket) return;

    const handlers = {
      'player_joined': (data) => {
        setRoom(data.room);
      },
      
      'player_left': (data) => {
        setRoom(null);
      },
      
      'player_ready_update': (data) => {
        setRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            host: { ...prev.host, ready: data.host_ready },
            guest: prev.guest ? { ...prev.guest, ready: data.guest_ready } : null
          };
        });
      },
      
      'game_started': (data) => {
        setRoom(data.room);
      },
      
      'move_made': (data) => {
        setRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            game_state: data.game_state,
            current_turn: data.current_turn
          };
        });
      },
      
      'game_completed': (data) => {
        setRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            status: 'completed',
            game_state: data.final_state
          };
        });
      },
      
      'chat_message': (data) => {
        setChatMessages(prev => [...prev, data]);
      },
      
      'public_rooms': (data) => {
        // This will be handled by the component using the hook
      },

      'matchmaking_joined': (data) => {
        setMatchmaking(true);
      },

      'match_found': (data) => {
        setMatchProposal(data);
      },

      'match_pending': (data) => {
      },

      'match_accepted': (data) => {
        setRoom(data.room);
        setMatchProposal(null);
        setMatchmaking(false);
      },

      'match_rejected': (data) => {
        setError(data.message);
        setMatchProposal(null);
        setTimeout(() => setError(null), 3000);
      },

      'matchmaking_left': (data) => {
        setMatchmaking(false);
        setMatchProposal(null);
      }
    };

    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      Object.keys(handlers).forEach(event => {
        socket.off(event);
      });
    };
  }, [socket]);

  return {
    connected,
    room,
    onlinePlayers,
    error,
    chatMessages,
    matchmaking,
    matchProposal,
    createRoom,
    joinRoom,
    leaveRoom,
    markReady,
    makeMove,
    endGame,
    sendChat,
    getPublicRooms,
    joinMatchmaking,
    leaveMatchmaking,
    acceptMatch,
    rejectMatch,
    clearError: () => setError(null)
  };
};
