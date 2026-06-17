/**
 * useSocketMultiplayer Hook
 * 
 * Shared Socket.IO multiplayer logic for real-time games
 * Extracts common patterns from UNO, Poker, Blackjack
 * 
 * This hook eliminates ~600 lines of duplicate code across 3 games
 * 
 * Usage:
 * const { socket, connected, table, mySessionId, emit, isMyTurn } = useSocketMultiplayer({
 *   gameType: 'uno',
 *   roomCode,
 *   playerName,
 *   onTableCreated: (data) => setTable(data.table),
 *   onStateUpdate: (data) => setTable(data.table),
 *   customEvents: {
 *     'uno_called': (data) => handleUnoCalled(data),
 *     'game_won': (data) => handleWin(data)
 *   }
 * });
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Event configuration for each game type
const GAME_EVENTS = {
  uno: {
    create: 'create_uno_room',
    join: 'join_uno_room',
    created: 'uno_table_created',
    update: 'uno_state_update',
    basePath: '/multiplayer-uno'
  },
  poker: {
    create: 'create_poker_room',
    join: 'join_poker_room',
    created: 'poker_table_created',
    update: 'poker_state_update',
    basePath: '/multiplayer-poker'
  },
  blackjack: {
    create: 'create_blackjack_table',
    join: 'join_blackjack_table',
    created: 'blackjack_table_created',
    update: 'blackjack_state_update',
    basePath: '/multiplayer-blackjack'
  }
};

export const useSocketMultiplayer = ({
  gameType = 'uno',
  roomCode = null,
  playerName = 'Player',
  onTableCreated = null,
  onStateUpdate = null,
  customEvents = {}
}) => {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
  // State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState(null);
  const [mySessionId, setMySessionId] = useState(null);
  const [error, setError] = useState('');

  const events = GAME_EVENTS[gameType] || GAME_EVENTS.uno;

  useEffect(() => {
    console.log(`🎮 Initializing ${gameType.toUpperCase()} Socket.IO connection...`);

    // Create Socket.IO connection
    const newSocket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // === CONNECTION HANDLERS ===
    newSocket.on('connect', () => {
      console.log(`✅ ${gameType.toUpperCase()} connected - Session ID: ${newSocket.id}`);
      setConnected(true);
      setMySessionId(newSocket.id);

      // Auto join or create room
      if (roomCode) {
        console.log(`📥 Joining room: ${roomCode}`);
        newSocket.emit(events.join, { 
          room_code: roomCode, 
          player_name: playerName 
        });
      } else {
        console.log(`📤 Creating new room`);
        newSocket.emit(events.create, { 
          player_name: playerName 
        });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`❌ ${gameType.toUpperCase()} disconnected:`, reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error(`🔴 ${gameType.toUpperCase()} connection error:`, error);
      setError('Connection failed. Please refresh.');
    });

    // === ROOM HANDLERS ===
    newSocket.on(events.created, (data) => {
      console.log(`🎲 ${gameType.toUpperCase()} Table created:`, data);
      
      if (data.success) {
        const tableData = data.table || data.room;
        setTable(tableData);
        
        // Navigate to room URL if provided
        if (data.room_code) {
          navigate(`${events.basePath}/${data.room_code}`, { replace: true });
        }
        
        // Call custom handler
        if (onTableCreated) {
          onTableCreated(data);
        }
      }
    });

    newSocket.on(events.update, (data) => {
      console.log(`🔄 ${gameType.toUpperCase()} State update received`);
      
      const tableData = data.table || data.room;
      setTable(tableData);
      
      // Call custom handler
      if (onStateUpdate) {
        onStateUpdate(data);
      }
    });

    // === ERROR HANDLER ===
    newSocket.on('error', (data) => {
      console.error(`❌ ${gameType.toUpperCase()} Error:`, data.message);
      setError(data.message);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(''), 5000);
    });

    // === CUSTOM EVENTS ===
    Object.entries(customEvents).forEach(([eventName, handler]) => {
      newSocket.on(eventName, handler);
    });

    // === CLEANUP ===
    return () => {
      console.log(`🧹 Cleaning up ${gameType.toUpperCase()} socket connection`);
      
      // Remove custom event listeners
      Object.entries(customEvents).forEach(([eventName, handler]) => {
        newSocket.off(eventName, handler);
      });
      
      // Disconnect socket
      newSocket.disconnect();
    };
  }, [gameType, roomCode, playerName]); // Reconnect if these change

  // === HELPER FUNCTIONS ===

  /**
   * Emit event to server
   */
  const emit = (eventName, data) => {
    if (socket && connected) {
      console.log(`📤 Emitting ${eventName}:`, data);
      socket.emit(eventName, data);
    } else {
      console.warn(`⚠️ Cannot emit ${eventName} - socket not connected`);
    }
  };

  /**
   * Get current player from table
   */
  const getCurrentPlayer = () => {
    if (!table || !mySessionId) return null;
    
    // Try different player data structures
    if (table.players) {
      return table.players.find(p => 
        p.socket_id === mySessionId || 
        p.session_id === mySessionId
      );
    }
    
    if (table.seats) {
      return table.seats.find(s => 
        s.socket_id === mySessionId || 
        s.session_id === mySessionId
      );
    }
    
    return null;
  };

  /**
   * Check if it's current player's turn
   */
  const isMyTurn = () => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return false;
    
    // Different turn tracking methods
    return (
      table?.current_turn === mySessionId || 
      table?.current_player_socket_id === mySessionId ||
      table?.active_player_id === mySessionId ||
      (table?.current_player_index !== undefined && 
       table?.current_player_index === currentPlayer?.seat_index)
    );
  };

  /**
   * Get all active players
   */
  const getActivePlayers = () => {
    if (!table) return [];
    
    const playerList = table.players || table.seats || [];
    return playerList.filter(p => p && p.is_active);
  };

  /**
   * Copy room code to clipboard
   */
  const copyRoomCode = () => {
    if (table?.room_code) {
      navigator.clipboard.writeText(table.room_code);
      console.log(`📋 Copied room code: ${table.room_code}`);
      return true;
    }
    return false;
  };

  return {
    // Socket connection
    socket,
    socketRef,
    connected,
    
    // Table/Room state
    table,
    mySessionId,
    
    // Error handling
    error,
    setError,
    
    // Helper methods
    emit,
    getCurrentPlayer,
    isMyTurn,
    getActivePlayers,
    copyRoomCode
  };
};

export default useSocketMultiplayer;
