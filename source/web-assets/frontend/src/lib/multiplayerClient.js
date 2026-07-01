/**
 * WebSocket Client for Real-Time Multiplayer Games
 * Handles connection to Socket.IO server and game room events
 */

import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_BACKEND_URL;

class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentRoom = null;
    this.eventHandlers = {};
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket) {
      return;
    }


    this.socket = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Connection events
    this.socket.on('connect', () => {
      this.connected = true;
      this.trigger('connected', { sid: this.socket.id });
    });

    this.socket.on('connection_established', (data) => {
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.trigger('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      // console.error('❌ Connection error:', error);
      this.trigger('error', { error: error.message });
    });

    // Room events
    this.socket.on('room_created', (data) => {
      this.currentRoom = data.room_code;
      this.trigger('room_created', data);
    });

    this.socket.on('room_joined', (data) => {
      this.currentRoom = data.room_code;
      this.trigger('room_joined', data);
    });

    this.socket.on('player_joined', (data) => {
      this.trigger('player_joined', data);
    });

    this.socket.on('player_left', (data) => {
      this.trigger('player_left', data);
    });

    this.socket.on('player_ready', (data) => {
      this.trigger('player_ready', data);
    });

    this.socket.on('game_started', (data) => {
      this.trigger('game_started', data);
    });

    this.socket.on('move_made', (data) => {
      this.trigger('move_made', data);
    });

    this.socket.on('chat_message', (data) => {
      this.trigger('chat_message', data);
    });

    this.socket.on('public_rooms_list', (data) => {
      this.trigger('public_rooms_list', data);
    });

    this.socket.on('room_closed', (data) => {
      this.currentRoom = null;
      this.trigger('room_closed', data);
    });

    this.socket.on('error', (data) => {
      // console.error('❌ Server error:', data);
      this.trigger('error', data);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentRoom = null;
    }
  }

  /**
   * Create a new game room
   */
  createRoom(gameType, maxPlayers, isPrivate, userId, username) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('create_room', {
        game_type: gameType,
        max_players: maxPlayers,
        is_private: isPrivate,
        user_id: userId,
        username: username
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to create room'));
        }
      });
    });
  }

  /**
   * Join an existing room
   */
  joinRoom(roomCode, userId, username) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('join_room', {
        room_code: roomCode,
        user_id: userId,
        username: username
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to join room'));
        }
      });
    });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('leave_room', {}, (response) => {
        if (response?.success) {
          this.currentRoom = null;
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to leave room'));
        }
      });
    });
  }

  /**
   * Mark player as ready
   */
  setReady() {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('player_ready', {}, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to set ready'));
        }
      });
    });
  }

  /**
   * Make a game move
   */
  makeMove(moveType, moveData) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('make_move', {
        move_type: moveType,
        move_data: moveData
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to make move'));
        }
      });
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('send_chat_message', {
        message: message
      }, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to send message'));
        }
      });
    });
  }

  /**
   * Get list of public rooms
   */
  getPublicRooms(gameType = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('get_public_rooms', {
        game_type: gameType
      }, (response) => {
        if (response?.success) {
          resolve(response.rooms);
        } else {
          reject(new Error(response?.error || 'Failed to get rooms'));
        }
      });
    });
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Unregister event handler
   */
  off(event, handler) {
    if (!this.eventHandlers[event]) return;
    this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
  }

  /**
   * Trigger event handlers
   */
  trigger(event, data) {
    if (!this.eventHandlers[event]) return;
    this.eventHandlers[event].forEach(handler => handler(data));
  }

  /**
   * Get current room code
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const multiplayerClient = new MultiplayerClient();
export default multiplayerClient;
