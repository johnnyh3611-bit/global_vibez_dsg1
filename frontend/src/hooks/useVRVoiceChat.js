import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for WebRTC voice chat in VR Dating
 * Handles peer-to-peer audio connection with spatial audio support
 */
export function useVRVoiceChat(roomId, userId, onError) {
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const peerConnection = useRef(null);
  const audioContext = useRef(null);
  const panner = useRef(null);
  const analyser = useRef(null);
  const remoteAnalyser = useRef(null);
  const wsRef = useRef(null);

  // WebRTC configuration with STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    initVoiceChat();
    
    return () => {
      cleanup();
    };
  }, [roomId, userId]);

  const initVoiceChat = async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      localStream.current = stream;
      
      // Setup audio context for spatial audio
      setupAudioContext();
      
      // Setup voice activity detection
      setupVoiceActivityDetection(stream);
      
      // Setup WebRTC peer connection
      setupPeerConnection();
      
    } catch (err) {
      // console.error('Error accessing microphone:', err);
      if (onError) onError('Microphone access denied. Please allow microphone access for voice chat.');
    }
  };

  const setupAudioContext = () => {
    try {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      panner.current = audioContext.current.createPanner();
      
      // Configure spatial audio
      panner.current.panningModel = 'HRTF';
      panner.current.distanceModel = 'inverse';
      panner.current.refDistance = 1;
      panner.current.maxDistance = 10;
      panner.current.rolloffFactor = 1;
      panner.current.coneInnerAngle = 360;
      panner.current.coneOuterAngle = 360;
      panner.current.coneOuterGain = 0;
      
      panner.current.connect(audioContext.current.destination);
    } catch (err) {
      // console.error('Error setting up audio context:', err);
    }
  };

  const setupVoiceActivityDetection = (stream) => {
    try {
      if (!audioContext.current) return;
      
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      
      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(analyser.current);
      
      // Monitor voice activity
      const checkVoiceActivity = () => {
        if (!analyser.current) return;
        
        const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setSpeaking(average > 20 && !muted); // Threshold for speaking
        
        requestAnimationFrame(checkVoiceActivity);
      };
      
      checkVoiceActivity();
    } catch (err) {
      // console.error('Error setting up voice activity detection:', err);
    }
  };

  const setupPeerConnection = () => {
    try {
      peerConnection.current = new RTCPeerConnection(rtcConfig);
      
      // Add local stream tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, localStream.current);
        });
      }
      
      // Handle remote stream
      peerConnection.current.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStream.current = event.streams[0];
          
          // Connect remote stream to spatial audio
          if (audioContext.current && panner.current) {
            const source = audioContext.current.createMediaStreamSource(event.streams[0]);
            source.connect(panner.current);
            
            // Setup remote voice activity detection
            remoteAnalyser.current = audioContext.current.createAnalyser();
            source.connect(remoteAnalyser.current);
            
            const checkRemoteVoice = () => {
              if (!remoteAnalyser.current) return;
              const dataArray = new Uint8Array(remoteAnalyser.current.frequencyBinCount);
              remoteAnalyser.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
              setRemoteSpeaking(average > 20);
              requestAnimationFrame(checkRemoteVoice);
            };
            checkRemoteVoice();
          }
          
          setConnected(true);
        }
      };
      
      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: event.candidate,
            userId: userId
          }));
        }
      };
      
      // Handle connection state
      peerConnection.current.onconnectionstatechange = () => {
        setConnected(peerConnection.current.connectionState === 'connected');
      };
      
    } catch (err) {
      // console.error('Error setting up peer connection:', err);
    }
  };

  const updateSpatialAudio = (remotePosition, localPosition) => {
    if (!panner.current || !audioContext.current) return;
    
    try {
      // Calculate relative position
      const dx = remotePosition[0] - localPosition[0];
      const dy = remotePosition[1] - localPosition[1];
      const dz = remotePosition[2] - localPosition[2];
      
      // Update panner position
      panner.current.positionX.setValueAtTime(dx, audioContext.current.currentTime);
      panner.current.positionY.setValueAtTime(dy, audioContext.current.currentTime);
      panner.current.positionZ.setValueAtTime(dz, audioContext.current.currentTime);
    } catch (err) {
      // console.error('Error updating spatial audio:', err);
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = muted;
        setMuted(!muted);
      }
    }
  };

  const createOffer = async () => {
    if (!peerConnection.current) return;
    
    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      
      return offer;
    } catch (err) {
      // console.error('Error creating offer:', err);
    }
  };

  const handleOffer = async (offer) => {
    if (!peerConnection.current) return;
    
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      return answer;
    } catch (err) {
      // console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (answer) => {
    if (!peerConnection.current) return;
    
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      // console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (candidate) => {
    if (!peerConnection.current) return;
    
    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // console.error('Error handling ICE candidate:', err);
    }
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    
    // Close audio context
    if (audioContext.current) {
      audioContext.current.close();
    }
  };

  return {
    muted,
    connected,
    speaking,
    remoteSpeaking,
    toggleMute,
    updateSpatialAudio,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    setWebSocket: (ws) => { wsRef.current = ws; }
  };
}
