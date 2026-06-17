import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff } from 'lucide-react';
import Peer from 'simple-peer';

const API = process.env.REACT_APP_BACKEND_URL;

export default function VideoCallPage() {
  const { callId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('user_name') || 'User';

  const [callStatus, setCallStatus] = useState('connecting'); // connecting, active, ended
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [otherUserName, setOtherUserName] = useState('Other User');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const wsRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const otherUserId = searchParams.get('other_user');
  const isCaller = searchParams.get('caller') === 'true';

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Connect to WebSocket for signaling
      const wsUrl = API.replace('http', 'ws');
      wsRef.current = new WebSocket(`${wsUrl}/api/video-call/ws/${userId}`);

      wsRef.current.onopen = () => {
        if (isCaller) {
          createPeerConnection(true);
        }
      };

      wsRef.current.onmessage = (event) => {
        handleSignaling(JSON.parse(event.data));
      };

      wsRef.current.onerror = (error) => {
        // console.error('WebSocket error:', error);
      };

      // Start call timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setCallDuration(elapsed);
      }, 1000);

    } catch (error) {
      // console.error('Error initializing call:', error);
      alert('Failed to access camera/microphone');
      navigate(-1);
    }
  };

  const createPeerConnection = (initiator) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: localStreamRef.current
    });

    peer.on('signal', (signal) => {
      // Send signaling data to other peer via WebSocket
      if (signal.type === 'offer') {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          call_id: callId,
          offer: signal
        }));
      } else if (signal.type === 'answer') {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          call_id: callId,
          answer: signal
        }));
      } else if (signal.candidate) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          call_id: callId,
          candidate: signal
        }));
      }
    });

    peer.on('stream', (remoteStream) => {
      // Received remote stream
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setCallStatus('active');
      }
    });

    peer.on('error', (error) => {
      // console.error('Peer error:', error);
    });

    peerRef.current = peer;
  };

  const handleSignaling = (message) => {
    const { type, offer, answer, candidate } = message;

    if (type === 'offer' && !isCaller) {
      // Callee received offer from caller
      if (!peerRef.current) {
        createPeerConnection(false);
      }
      peerRef.current.signal(offer);
    } else if (type === 'answer' && isCaller) {
      // Caller received answer from callee
      peerRef.current.signal(answer);
    } else if (type === 'ice-candidate') {
      // Received ICE candidate
      if (peerRef.current) {
        peerRef.current.signal(candidate);
      }
    } else if (type === 'call_ended') {
      endCall();
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });

        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        videoTrack.onended = () => {
          // Screen sharing stopped
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (error) {
      // console.error('Screen share error:', error);
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peerRef.current._pc.getSenders().find(s => s.track?.kind === 'video');

      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }

      setIsScreenSharing(false);
    }
  };

  const endCall = async () => {
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      await fetch(`${API}/api/video-call/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          user_id: userId,
          duration_seconds: duration
        })
      });
    } catch (error) {
      // console.error('Error ending call:', error);
    }

    setCallStatus('ended');
    cleanup();
    setTimeout(() => navigate(-1), 2000);
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-white">
            <h1 className="text-2xl font-bold">{otherUserName}</h1>
            <p className="text-gray-400">
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'active' && `Call Duration: ${formatDuration(callDuration)}`}
              {callStatus === 'ended' && 'Call Ended'}
            </p>
          </div>
        </div>

        {/* Video Grid */}
        <div className="relative aspect-video bg-black rounded-3xl overflow-hidden mb-6">
          {/* Remote Video (Full Screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local Video (Picture-in-Picture) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 w-48 h-36 bg-black rounded-xl overflow-hidden border-2 border-cyan-500/50"
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </motion.div>

          {/* Call Status Overlay */}
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-xl">Connecting...</p>
              </div>
            </div>
          )}

          {callStatus === 'ended' && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center">
                <PhoneOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <p className="text-white text-xl">Call Ended</p>
                <p className="text-gray-400">Duration: {formatDuration(callDuration)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-4" data-testid="video-call-controls">
          {/* Toggle Video */}
          <motion.button
            onClick={toggleVideo}
            data-testid="toggle-video-btn"
            className={`w-16 h-16 rounded-full flex items-center justify-center ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isVideoEnabled ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
          </motion.button>

          {/* Toggle Audio */}
          <motion.button
            onClick={toggleAudio}
            data-testid="toggle-audio-btn"
            className={`w-16 h-16 rounded-full flex items-center justify-center ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
          </motion.button>

          {/* Toggle Screen Share */}
          <motion.button
            onClick={toggleScreenShare}
            data-testid="toggle-screen-share-btn"
            className={`w-16 h-16 rounded-full flex items-center justify-center ${isScreenSharing ? 'bg-cyan-600' : 'bg-gray-700'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
          </motion.button>

          {/* End Call */}
          <motion.button
            onClick={endCall}
            data-testid="end-call-btn"
            className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
