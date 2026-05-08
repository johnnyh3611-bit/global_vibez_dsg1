/**
 * useChat - Custom hook for Global Vibez WebSocket Chat
 * Translates UE5 "Glass Slate" concept to React hooks
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function useChat(userId, userName) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState({});  // room_id -> messages[]
  const [currentRoom, setCurrentRoom] = useState('global_lobby');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});  // room_id -> Set of user_ids
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const ws = new WebSocket(`${wsUrl}/api/ws/chat?token=${userId}`);

    ws.onopen = () => {
      // setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          setMessages(prev => ({
            ...prev,
            [data.room]: [...(prev[data.room] || []), data]
          }));
          break;
        
        case 'room_history':
          setMessages(prev => ({
            ...prev,
            [data.room]: data.messages
          }));
          break;
        
        case 'user_joined':
        case 'user_left':
          setMessages(prev => ({
            ...prev,
            [data.room]: [...(prev[data.room] || []), data]
          }));
          break;
        
        case 'typing':
          setTypingUsers(prev => {
            const roomTyping = new Set(prev[data.room] || []);
            if (data.is_typing) {
              roomTyping.add(data.user_id);
            } else {
              roomTyping.delete(data.user_id);
            }
            return { ...prev, [data.room]: roomTyping };
          });
          break;
        
        case 'online_users':
          setOnlineUsers(data.users);
          break;
        
        case 'system':
        case 'error':
          setMessages(prev => ({
            ...prev,
            [currentRoom]: [...(prev[currentRoom] || []), data]
          }));
          break;
        
        default:
          break;
      }
    };

    ws.onclose = () => {
      // setConnected(false);
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [userId, currentRoom, API_URL]);

  // Send message
  const sendMessage = useCallback((room, message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'send_message',
        room,
        message
      }));
    }
  }, []);

  // Join room
  const joinRoom = useCallback((room) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'join_room',
        room
      }));
      setCurrentRoom(room);
    }
  }, []);

  // Leave room
  const leaveRoom = useCallback((room) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'leave_room',
        room
      }));
    }
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((room, isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'typing',
        room,
        is_typing: isTyping
      }));
    }
  }, []);

  // Get online users
  const getOnlineUsers = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'get_online_users'
      }));
    }
  }, []);

  // Connect on mount
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

  return {
    connected,
    messages,
    currentRoom,
    onlineUsers,
    typingUsers,
    sendMessage,
    joinRoom,
    leaveRoom,
    sendTyping,
    getOnlineUsers,
  };
}
