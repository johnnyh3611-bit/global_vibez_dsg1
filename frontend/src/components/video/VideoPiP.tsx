

import React, { useRef, useEffect, useState } from 'react';
// @ts-expect-error — useDrag is not exported by framer-motion v11; component uses legacy drag API.
import { motion, useDrag } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, X, Maximize2, Minimize2 } from 'lucide-react';

/**
 * Picture-in-Picture Video Component
 * Floating, draggable video bubble - perfect for mobile gaming
 */
export default function VideoPiP({ 
  localStream, 
  remoteStreams, 
  onToggleVideo, 
  onToggleAudio,
  onClose,
  onMaximize 
}) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  // Set up local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote videos
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      if (remoteVideoRefs.current[userId] && stream) {
        remoteVideoRefs.current[userId].srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const handleToggleVideo = () => {
    const enabled = onToggleVideo();
    setIsVideoEnabled(enabled);
  };

  const handleToggleAudio = () => {
    const enabled = onToggleAudio();
    setIsAudioEnabled(enabled);
  };

  const remoteUserIds = Object.keys(remoteStreams);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{
        top: 80,
        left: 10,
        right: window.innerWidth - 170,
        bottom: window.innerHeight - 230
      }}
      initial={{ x: window.innerWidth - 180, y: 100 }}
      className="fixed z-50 touch-none"
      style={{ width: isMinimized ? '80px' : '160px' }}
    >
      <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-purple-500/50 overflow-hidden">
        {/* Main Video (Remote or Local) */}
        <div className="relative aspect-[3/4]">
          {remoteUserIds.length > 0 ? (
            // Show remote user's video
            <video
              ref={(el) => { remoteVideoRefs.current[remoteUserIds[0]] = el; }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // Show local video if no remote
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {/* Minimized overlay */}
          {isMinimized && (
            <div className="absolute inset-0 bg-purple-900/80 flex items-center justify-center">
              <Video className="text-white" size={32} />
            </div>
          )}

          {/* Status Indicators */}
          <div className="absolute top-2 left-2 flex gap-1">
            {!isVideoEnabled && (
              <div className="bg-red-500 rounded-full p-1">
                <VideoOff size={12} className="text-white" />
              </div>
            )}
            {!isAudioEnabled && (
              <div className="bg-red-500 rounded-full p-1">
                <MicOff size={12} className="text-white" />
              </div>
            )}
          </div>

          {/* Small Local Preview (when showing remote) */}
          {remoteUserIds.length > 0 && !isMinimized && (
            <div className="absolute bottom-2 right-2 w-12 h-16 rounded-lg overflow-hidden border border-white/30">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          )}
        </div>

        {/* Controls */}
        {!isMinimized && (
          <div className="p-2 bg-black/40 flex items-center justify-between gap-1">
            <button
              onClick={handleToggleVideo}
              className={`p-1.5 rounded-lg transition-colors ${
                isVideoEnabled 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
            </button>

            <button
              onClick={handleToggleAudio}
              className={`p-1.5 rounded-lg transition-colors ${
                isAudioEnabled 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {isAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>

            {onMaximize && (
              <button
                onClick={onMaximize}
                className="p-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 transition-colors"
              >
                <Maximize2 size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Minimized Click Handler */}
        {isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full p-2 hover:bg-white/10 transition-colors"
          >
            <Maximize2 size={16} className="mx-auto" />
          </button>
        )}
      </div>

      {/* Drag Handle Indicator */}
      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-purple-400 rounded-full opacity-50" />
    </motion.div>
  );
}
