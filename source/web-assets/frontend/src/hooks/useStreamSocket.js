import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useStreamSocket = (userId, username) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    // Initialize Socket.IO connection
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
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      // console.error('Streaming Socket connection error:', error);
    });

    // Viewer count updates
    socket.on('viewer_joined', (data) => {
      setViewerCount(data.viewer_count || 0);
    });

    socket.on('viewer_left', (data) => {
      setViewerCount(data.viewer_count || 0);
    });

    // Cleanup
    return () => {
      // Leave current stream if watching
      if (currentStreamId) {
        socket.emit('stream_leave', { stream_id: currentStreamId });
      }
      socket.disconnect();
    };
  }, [userId, username, currentStreamId]);

  // ==================== STREAM ACTIONS ====================

  const joinStream = (streamId) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      socketRef.current.emit('stream_join', {
        stream_id: streamId,
        user_id: userId,
        username: username || 'Anonymous'
      }, (response) => {
        if (response?.success) {
          setCurrentStreamId(streamId);
          setViewerCount(response.viewer_count || 0);
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to join stream'));
        }
      });
    });
  };

  const leaveStream = (streamId) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        resolve();
        return;
      }

      socketRef.current.emit('stream_leave', {
        stream_id: streamId
      }, (response) => {
        setCurrentStreamId(null);
        setViewerCount(0);
        resolve(response);
      });
    });
  };

  // ==================== EVENT SUBSCRIPTIONS ====================

  const onViewerJoined = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('viewer_joined', callback);
    return () => socketRef.current.off('viewer_joined', callback);
  };

  const onViewerLeft = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('viewer_left', callback);
    return () => socketRef.current.off('viewer_left', callback);
  };

  const onNewGiftEffect = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('new_gift_effect', callback);
    return () => socketRef.current.off('new_gift_effect', callback);
  };

  const onStreamEnded = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('stream_ended', callback);
    return () => socketRef.current.off('stream_ended', callback);
  };

  return {
    socket: socketRef.current,
    isConnected,
    currentStreamId,
    viewerCount,
    joinStream,
    leaveStream,
    onViewerJoined,
    onViewerLeft,
    onNewGiftEffect,
    onStreamEnded
  };
};
