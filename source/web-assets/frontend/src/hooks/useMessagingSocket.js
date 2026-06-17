import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const useMessagingSocket = (userId) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!userId) return;

    // Initialize Socket.IO connection to /messaging namespace
    // The path must be /api/socket.io to route through Kubernetes ingress to backend
    const socket = io(`${BACKEND_URL}/messaging`, {
      path: '/api/socket.io',
      auth: {
        user_id: userId
      },
      transports: ['polling', 'websocket'],  // Start with polling for better compatibility
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
      // console.error('Socket.IO connection error:', error);
    });

    // Typing indicators
    socket.on('user_typing', (data) => {
      if (data.is_typing) {
        setTypingUsers(prev => new Set([...prev, data.user_id]));
        
        // Auto-clear after 5 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.user_id);
            return newSet;
          });
        }, 5000);
      } else {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.user_id);
          return newSet;
        });
      }
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // Send message via Socket.IO
  const sendMessage = (receiverId, content, messageType = 'text') => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      socketRef.current.emit('send_message', {
        receiver_id: receiverId,
        content,
        message_type: messageType
      }, (response) => {
        if (response?.success) {
          resolve(response.message);
        } else {
          reject(new Error(response?.error || 'Failed to send message'));
        }
      });
    });
  };

  // Mark message as read
  const markAsRead = (messageId) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('mark_message_read', { message_id: messageId });
  };

  // Typing indicators
  const startTyping = (receiverId) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('typing_start', { receiver_id: receiverId });
  };

  const stopTyping = (receiverId) => {
    if (!socketRef.current) return;
    
    socketRef.current.emit('typing_stop', { receiver_id: receiverId });
  };

  // Subscribe to events
  const onNewMessage = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('new_message', callback);
    return () => socketRef.current.off('new_message', callback);
  };

  const onMessageSent = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('message_sent', callback);
    return () => socketRef.current.off('message_sent', callback);
  };

  const onMessageRead = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('message_read', callback);
    return () => socketRef.current.off('message_read', callback);
  };

  const onUserStatusChanged = (callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on('user_status_changed', callback);
    return () => socketRef.current.off('user_status_changed', callback);
  };

  return {
    socket: socketRef.current,
    isConnected,
    typingUsers,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    onNewMessage,
    onMessageSent,
    onMessageRead,
    onUserStatusChanged
  };
};
