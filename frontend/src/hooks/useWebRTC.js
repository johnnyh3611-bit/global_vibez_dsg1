import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * WebRTC Hook for Peer-to-Peer Video Chat
 * Handles connection setup, signaling, and media streams
 */
export function useWebRTC(roomId, userId, username) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingCandidatesRef = useRef({});

  // ICE servers (STUN/TURN) - memoized to prevent recreating on every render
  const iceServers = useMemo(() => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }), []);

  /**
   * Get local camera/microphone stream
   */
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setLocalStream(stream);
      return stream;
    } catch (err) {
      // console.error('Failed to get local stream:', err);
      setError('Camera/microphone access denied');
      throw err;
    }
  }, []);

  /**
   * Create peer connection for a remote user
   */
  const createPeerConnection = useCallback((remoteUserId, stream) => {
    if (peerConnectionsRef.current[remoteUserId]) {
      return peerConnectionsRef.current[remoteUserId];
    }

    const peerConnection = new RTCPeerConnection(iceServers);

    // Add local stream tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [remoteUserId]: event.streams[0]
      }));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          to_user: remoteUserId,
          candidate: event.candidate
        }));
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'failed') {
        // Attempt to restart ICE
        peerConnection.restartIce();
      }
    };

    peerConnectionsRef.current[remoteUserId] = peerConnection;
    return peerConnection;
  }, [iceServers]);

  /**
   * Send WebRTC offer to remote user
   */
  const sendOffer = useCallback(async (remoteUserId, stream) => {
    try {
      const peerConnection = createPeerConnection(remoteUserId, stream);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          to_user: remoteUserId,
          offer: offer
        }));
      }
    } catch (err) {
      // console.error('Failed to send offer:', err);
    }
  }, [createPeerConnection]);

  /**
   * Handle incoming WebRTC offer
   */
  const handleOffer = useCallback(async (fromUser, offer, stream) => {
    try {
      const peerConnection = createPeerConnection(fromUser, stream);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Process pending ICE candidates
      if (pendingCandidatesRef.current[fromUser]) {
        for (const candidate of pendingCandidatesRef.current[fromUser]) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        delete pendingCandidatesRef.current[fromUser];
      }

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          to_user: fromUser,
          answer: answer
        }));
      }
    } catch (err) {
      // console.error('Failed to handle offer:', err);
    }
  }, [createPeerConnection]);

  /**
   * Handle incoming WebRTC answer
   */
  const handleAnswer = useCallback(async (fromUser, answer) => {
    try {
      const peerConnection = peerConnectionsRef.current[fromUser];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        // Process pending ICE candidates
        if (pendingCandidatesRef.current[fromUser]) {
          for (const candidate of pendingCandidatesRef.current[fromUser]) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
          delete pendingCandidatesRef.current[fromUser];
        }
      }
    } catch (err) {
      // console.error('Failed to handle answer:', err);
    }
  }, []);

  /**
   * Handle incoming ICE candidate
   */
  const handleIceCandidate = useCallback(async (fromUser, candidate) => {
    try {
      const peerConnection = peerConnectionsRef.current[fromUser];
      
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue candidate if remote description not set yet
        if (!pendingCandidatesRef.current[fromUser]) {
          pendingCandidatesRef.current[fromUser] = [];
        }
        pendingCandidatesRef.current[fromUser].push(candidate);
      }
    } catch (err) {
      // console.error('Failed to handle ICE candidate:', err);
    }
  }, []);

  /**
   * Connect to signaling server and join room
   */
  const connect = useCallback(async () => {
    try {
      // Get local stream first
      const stream = await startLocalStream();

      // Connect to signaling WebSocket
      const wsUrl = `${API_URL.replace('http', 'ws')}/api/ws/video-chat/${roomId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'join',
          user_id: userId,
          username: username
        }));
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'joined':
            setIsConnected(true);
            setParticipants(message.participants || []);
            break;

          case 'user-joined':
            setParticipants(prev => {
              if (!prev.includes(message.user_id)) {
                return [...prev, message.user_id];
              }
              return prev;
            });
            // Send offer to new user
            if (message.user_id !== userId) {
              setTimeout(() => sendOffer(message.user_id, stream), 1000);
            }
            break;

          case 'user-left':
            setParticipants(prev => prev.filter(id => id !== message.user_id));
            setRemoteStreams(prev => {
              const newStreams = { ...prev };
              delete newStreams[message.user_id];
              return newStreams;
            });
            // Close peer connection
            if (peerConnectionsRef.current[message.user_id]) {
              peerConnectionsRef.current[message.user_id].close();
              delete peerConnectionsRef.current[message.user_id];
            }
            break;

          case 'offer':
            await handleOffer(message.from_user, message.offer, stream);
            break;

          case 'answer':
            await handleAnswer(message.from_user, message.answer);
            break;

          case 'ice-candidate':
            await handleIceCandidate(message.from_user, message.candidate);
            break;

          default:
            break;
        }
      };

      ws.onerror = (err) => {
        // console.error('WebSocket error:', err);
        setError('Connection error');
      };

      ws.onclose = () => {
        // setIsConnected(false);
      };

    } catch (err) {
      // console.error('Failed to connect:', err);
      setError(err.message);
    }
  }, [roomId, userId, username, startLocalStream, sendOffer, handleOffer, handleAnswer, handleIceCandidate]);

  /**
   * Disconnect from video chat
   */
  const disconnect = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setRemoteStreams({});
    setIsConnected(false);
    setParticipants([]);
  }, [localStream]);

  /**
   * Toggle video track
   */
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  /**
   * Toggle audio track
   */
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    localStream,
    remoteStreams,
    isConnected,
    participants,
    error,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio
  };
}
