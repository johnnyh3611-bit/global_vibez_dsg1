
/**
 * Spatial Video Table Component
 * WebRTC video chat positioned "across the table" from player
 * Uses Simple-Peer for peer-to-peer connections
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SpatialVideoTable({ 
  enabled = true,
  position = 'opposite', // opposite, left, right
  onConnectionChange,
  muted = false
}) {
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  // Initialize local media stream
  useEffect(() => {
    if (!enabled) return;

    const initMediaStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
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

        setStream(mediaStream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        setConnectionStatus('connecting');
        onConnectionChange && onConnectionChange('ready');
      } catch (error) {
        // console.error('❌ Error accessing media devices:', error);
        setConnectionStatus('error');
        onConnectionChange && onConnectionChange('error', error);
      }
    };

    initMediaStream();

    return () => {
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [enabled, onConnectionChange]);

  // Toggle video
  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Position styles based on table position
  const getPositionStyles = () => {
    const baseStyles = {
      perspective: '1000px',
      transformStyle: 'preserve-3d'
    };

    switch (position) {
      case 'opposite':
        return {
          ...baseStyles,
          transform: 'rotateX(-15deg) translateZ(20px)',
          top: '10%',
          left: '50%',
          translateX: '-50%'
        };
      case 'left':
        return {
          ...baseStyles,
          transform: 'rotateY(20deg) rotateX(-10deg) translateZ(20px)',
          top: '40%',
          left: '10%'
        };
      case 'right':
        return {
          ...baseStyles,
          transform: 'rotateY(-20deg) rotateX(-10deg) translateZ(20px)',
          top: '40%',
          right: '10%'
        };
      default:
        return baseStyles;
    }
  };

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Remote player video (across the table) */}
      <AnimatePresence>
        {remoteStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="absolute"
            style={{
              ...getPositionStyles(),
              pointerEvents: 'auto'
            } as any}
          >
            <div className="relative">
              {/* Video frame - looks like it's sitting on the table */}
              <div 
                className="rounded-2xl overflow-hidden border-4 border-amber-900/60 shadow-2xl"
                style={{
                  width: '320px',
                  height: '240px',
                  backgroundColor: '#1a1a1a',
                  boxShadow: `
                    0 20px 60px rgba(0,0,0,0.8),
                    0 0 20px rgba(212,175,55,0.3),
                    inset 0 2px 10px rgba(255,255,255,0.1)
                  `
                }}
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={muted}
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'scaleX(-1)' // Mirror for natural viewing
                  }}
                />

                {/* Connection indicator */}
                <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 rounded-lg
                  bg-black/60 backdrop-blur-sm">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' :
                      connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                      'bg-red-500'
                    }`}
                  />
                  <span className="text-white text-xs font-semibold">
                    {connectionStatus === 'connected' ? 'LIVE' : 
                     connectionStatus === 'connecting' ? 'Connecting...' : 
                     'Offline'}
                  </span>
                </div>
              </div>

              {/* Table surface shadow/reflection */}
              <div 
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-full h-8 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse, rgba(0,0,0,0.4), transparent)',
                  filter: 'blur(10px)'
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local player preview (small, bottom corner) */}
      <AnimatePresence>
        {stream && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute bottom-6 right-6 pointer-events-auto"
          >
            <div className="relative">
              {/* Video preview */}
              <div 
                className="rounded-xl overflow-hidden border-2 border-amber-600/40 shadow-lg"
                style={{
                  width: '160px',
                  height: '120px',
                  backgroundColor: '#1a1a1a'
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted={true}
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'scaleX(-1)',
                    display: isVideoEnabled ? 'block' : 'none'
                  }}
                />

                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-white text-4xl">👤</div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-2">
                <button
                  onClick={toggleVideo}
                  className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all ${
                    isVideoEnabled 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isVideoEnabled ? '📹 On' : '📹 Off'}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all ${
                    isAudioEnabled 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isAudioEnabled ? '🎤 On' : '🎤 Off'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook: Use Spatial Video with Socket.IO signaling
 */
export function useSpatialVideo(socketRef, roomCode) {
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);

  useEffect(() => {
    if (!socketRef.current || !roomCode) return;

    const socket = socketRef.current;

    // Listen for video call requests
    socket.on('video_call_request', (data) => {
      // Auto-accept for now (could add UI prompt)
      socket.emit('video_call_accept', {
        room_code: roomCode,
        to: data.from
      });
      setRemoteConnected(true);
    });

    // Listen for video call accepted
    socket.on('video_call_accepted', (data) => {
      setRemoteConnected(true);
    });

    // Listen for video call ended
    socket.on('video_call_ended', () => {
      setRemoteConnected(false);
    });

    return () => {
      socket.off('video_call_request');
      socket.off('video_call_accepted');
      socket.off('video_call_ended');
    };
  }, [socketRef, roomCode]);

  const startVideo = () => {
    setVideoEnabled(true);
    
    // Request video call
    if (socketRef.current && roomCode) {
      socketRef.current.emit('video_call_request', {
        room_code: roomCode
      });
    }
  };

  const stopVideo = () => {
    setVideoEnabled(false);
    
    // End video call
    if (socketRef.current && roomCode) {
      socketRef.current.emit('video_call_end', {
        room_code: roomCode
      });
    }
  };

  return {
    videoEnabled,
    remoteConnected,
    startVideo,
    stopVideo
  };
}
