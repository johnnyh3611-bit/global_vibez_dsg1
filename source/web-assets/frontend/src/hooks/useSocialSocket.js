import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useSocialSocket = (userId, username) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    if (!userId) return;

    // Initialize Socket.IO connection
    // Path must be /api/socket.io to route through Kubernetes ingress
    const socket = io(BACKEND_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      setIsConnected(true);
      
      // Register user for social features
      socket.emit('social_connect', {
        user_id: userId,
        username: username || 'User'
      }, (response) => {
        if (response?.success) {
          setOnlineUsers(response.online_users || 0);
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      // console.error('Social Socket connection error:', error);
    });

    // Cleanup
    return () => {
      if (socket.connected) {
        socket.emit('social_disconnect', { user_id: userId });
      }
      socket.disconnect();
    };
  }, [userId, username]);

  // ==================== EVENT SUBSCRIPTIONS ====================

  const onNewMatch = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('new_match', callback);
    return () => socketRef.current.off('new_match', callback);
  };

  const onVibeReceived = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('vibe_received', callback);
    return () => socketRef.current.off('vibe_received', callback);
  };

  const onSomeoneLikedYou = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('someone_liked_you', callback);
    return () => socketRef.current.off('someone_liked_you', callback);
  };

  const onUserOnline = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('user_online', callback);
    return () => socketRef.current.off('user_online', callback);
  };

  const onUserOffline = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('user_offline', callback);
    return () => socketRef.current.off('user_offline', callback);
  };

  // ==================== IN-GAME SOCIAL ====================

  const joinGameRoom = (gameId, tableId = null) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      socketRef.current.emit('join_game_room', {
        user_id: userId,
        game_id: gameId,
        table_id: tableId
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to join game room'));
        }
      });
    });
  };

  const leaveGameRoom = (gameId, tableId = null) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('leave_game_room', {
      user_id: userId,
      game_id: gameId,
      table_id: tableId
    });
  };

  const onPlayerJoinedGame = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('player_joined_game', callback);
    return () => socketRef.current.off('player_joined_game', callback);
  };

  const onPlayerLeftGame = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('player_left_game', callback);
    return () => socketRef.current.off('player_left_game', callback);
  };

  // ==================== EMIT EVENTS ====================

  const notifyMatch = (user1Id, user2Id, matchData) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('notify_match', {
      user1_id: user1Id,
      user2_id: user2Id,
      match_data: matchData
    });
  };

  const notifyVibeReceived = (toUserId, fromUserId, vibeType, message) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('notify_vibe_received', {
      to_user_id: toUserId,
      from_user_id: fromUserId,
      vibe_type: vibeType,
      message: message
    });
  };

  return {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    onNewMatch,
    onVibeReceived,
    onSomeoneLikedYou,
    onUserOnline,
    onUserOffline,
    joinGameRoom,
    leaveGameRoom,
    onPlayerJoinedGame,
    onPlayerLeftGame,
    notifyMatch,
    notifyVibeReceived
  };
};
