import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';

export function VideoChat({ multiplayerManager, remotePlayerSid, remotePlayerName }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    // Listen for stream events
    const handleLocalStream = (stream) => {
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsConnecting(false);
    };

    const handleRemoteStream = (stream) => {
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    multiplayerManager.on('local_stream', handleLocalStream);
    multiplayerManager.on('remote_stream', handleRemoteStream);

    // Start video chat
    if (remotePlayerSid) {
      multiplayerManager.startVideoChat(remotePlayerSid).catch(err => {
        // console.error('Failed to start video chat:', err);
        setIsConnecting(false);
      });
    }

    return () => {
      multiplayerManager.off('local_stream', handleLocalStream);
      multiplayerManager.off('remote_stream', handleRemoteStream);
    };
  }, [multiplayerManager, remotePlayerSid]);

  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    multiplayerManager.toggleVideo(newState);
  };

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    multiplayerManager.toggleAudio(newState);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      layout
      className={`relative bg-black/90 backdrop-blur-xl border-2 border-purple-500 rounded-2xl overflow-hidden ${
        isExpanded ? 'h-full' : 'h-80'
      }`}
    >
      {/* Remote Video (Main) */}
      <div className="relative w-full h-full">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-black">
            {isConnecting ? (
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60">Connecting to video...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-4xl mb-4 mx-auto">
                  🎮
                </div>
                <p className="text-xl font-bold text-white">{remotePlayerName}</p>
                <p className="text-sm text-white/60 mt-2">Video disabled</p>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        <motion.div
          drag
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          className="absolute top-4 right-4 w-32 h-24 bg-black rounded-xl overflow-hidden border-2 border-cyan-500 shadow-2xl cursor-move"
        >
          {localStream && isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-900/50 to-black">
              <span className="text-3xl">😎</span>
            </div>
          )}
          <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-bold">
            You
          </div>
        </motion.div>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-black/80 backdrop-blur-xl rounded-full px-4 py-3 border border-white/20">
          {/* Video Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isVideoEnabled
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5 text-white" />
            ) : (
              <VideoOff className="w-5 h-5 text-white" />
            )}
          </motion.button>

          {/* Audio Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isAudioEnabled
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white" />
            )}
          </motion.button>

          {/* Expand/Minimize */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleExpand}
            className="w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-700 flex items-center justify-center transition-all"
          >
            {isExpanded ? (
              <Minimize2 className="w-5 h-5 text-white" />
            ) : (
              <Maximize2 className="w-5 h-5 text-white" />
            )}
          </motion.button>
        </div>

        {/* Connection Status */}
        {remoteStream && (
          <div className="absolute top-4 left-4 bg-green-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Connected
          </div>
        )}
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </motion.div>
  );
}
