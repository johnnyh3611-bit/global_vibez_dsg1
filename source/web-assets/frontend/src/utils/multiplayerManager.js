// Multiplayer Manager - WebSocket & WebRTC Integration
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';

const API_URL = process.env.REACT_APP_BACKEND_URL;

class MultiplayerManager {
  constructor() {
    this.socket = null;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.roomId = null;
    this.isConnected = false;
    this.callbacks = {};
  }

  // ==================== SOCKET CONNECTION ====================

  connect(userId, userName) {
    if (this.socket && this.isConnected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io(API_URL, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        
        // Authenticate
        this.socket.emit('authenticate', {
          user_id: userId,
          user_name: userName
        });

        resolve();
      });

      this.socket.on('authenticated', (data) => {
      });

      this.socket.on('connect_error', (error) => {
        // console.error('❌ Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.triggerCallback('disconnected');
      });

      // Setup event listeners
      this.setupEventListeners();
    });
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
  }

  setupEventListeners() {
    // Matchmaking events
    this.socket.on('matchmaking_started', (data) => {
      this.triggerCallback('matchmaking_started', data);
    });

    this.socket.on('match_found', (data) => {
      this.roomId = data.room_id;
      this.triggerCallback('match_found', data);
    });

    // Game events
    this.socket.on('opponent_move', (data) => {
      this.triggerCallback('opponent_move', data);
    });

    this.socket.on('player_left', (data) => {
      this.triggerCallback('player_left', data);
    });

    // Chat events
    this.socket.on('chat_message', (data) => {
      this.triggerCallback('chat_message', data);
    });

    // WebRTC signaling events
    this.socket.on('webrtc_offer', async (data) => {
      await this.handleWebRTCOffer(data);
    });

    this.socket.on('webrtc_answer', async (data) => {
      await this.handleWebRTCAnswer(data);
    });

    this.socket.on('webrtc_ice_candidate', (data) => {
      this.handleICECandidate(data);
    });
  }

  // ==================== MATCHMAKING ====================

  findMatch(gameType, difficulty = 'medium') {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('find_match', {
      game_type: gameType,
      difficulty: difficulty
    });
  }

  cancelMatchmaking() {
    if (this.socket && this.isConnected) {
      this.socket.emit('cancel_matchmaking', {});
    }
  }

  // ==================== GAME ACTIONS ====================

  sendMove(move, gameState) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('game_move', {
      move: move,
      game_state: gameState
    });
  }

  sendChatMessage(message) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('chat_message', {
      message: message
    });
  }

  // ==================== VIDEO CHAT (WebRTC) ====================

  async startVideoChat(remotePlayerSid) {
    try {
      // Get user media (camera + audio)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: true
      });

      this.triggerCallback('local_stream', this.localStream);

      // Create peer connection
      this.peer = new SimplePeer({
        initiator: true,
        trickle: true,
        stream: this.localStream
      });

      // Handle peer events
      this.peer.on('signal', (data) => {
        // Send offer to remote peer
        this.socket.emit('webrtc_offer', {
          target_sid: remotePlayerSid,
          offer: data
        });
      });

      this.peer.on('stream', (stream) => {
        // Received remote stream
        this.remoteStream = stream;
        this.triggerCallback('remote_stream', stream);
      });

      this.peer.on('error', (err) => {
        // console.error('Peer error:', err);
      });

      this.peer.on('close', () => {
      });

    } catch (error) {
      // console.error('Error starting video chat:', error);
      throw error;
    }
  }

  async handleWebRTCOffer(data) {
    try {
      // Get user media
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });

        this.triggerCallback('local_stream', this.localStream);
      }

      // Create peer connection as answerer
      this.peer = new SimplePeer({
        initiator: false,
        trickle: true,
        stream: this.localStream
      });

      this.peer.on('signal', (answerData) => {
        // Send answer back
        this.socket.emit('webrtc_answer', {
          target_sid: data.from_sid,
          answer: answerData
        });
      });

      this.peer.on('stream', (stream) => {
        this.remoteStream = stream;
        this.triggerCallback('remote_stream', stream);
      });

      this.peer.on('error', (err) => {
        // console.error('Peer error:', err);
      });

      // Signal the offer
      this.peer.signal(data.offer);

    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  }

  async handleWebRTCAnswer(data) {
    if (this.peer) {
      this.peer.signal(data.answer);
    }
  }

  handleICECandidate(data) {
    if (this.peer) {
      this.peer.signal(data.candidate);
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // ==================== CALLBACKS ====================

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  triggerCallback(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
}

// Export singleton instance
export const multiplayerManager = new MultiplayerManager();
export default multiplayerManager;
