import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, X, Users } from 'lucide-react';

/**
 * Split-Screen Video Component
 * Side-by-side layout - perfect for tablets and PC
 */
export default function VideoSplitScreen({ 
  localStream, 
  remoteStreams,
  onToggleVideo,
  onToggleAudio,
  onClose,
  children
}) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [layout, setLayout] = useState('side'); // 'side' or 'overlay'
  
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
    <div className="fixed inset-0 z-40 bg-black/90">
      <div className="h-full flex flex-col lg:flex-row">
        {/* Game Content Area */}
        <div className={`flex-1 relative ${layout === 'side' ? 'lg:w-[70%]' : 'w-full'}`}>
          {children}

          {/* Overlay Mode - Floating Video */}
          {layout === 'overlay' && (
            <div className="absolute top-4 right-4 w-64 space-y-2">
              {/* Remote Videos */}
              {remoteUserIds.map((userId, idx) => (
                <motion.div
                  key={userId}
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-purple-500/50"
                >
                  <div className="aspect-video relative">
                    <video
                      ref={(el) => { remoteVideoRefs.current[userId] = el; }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 text-white text-sm font-semibold bg-black/50 px-2 py-1 rounded">
                      Player {idx + 1}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Local Video */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: remoteUserIds.length * 0.1 }}
                className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-blue-500/50"
              >
                <div className="aspect-video relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute bottom-2 left-2 text-white text-sm font-semibold bg-black/50 px-2 py-1 rounded">
                    You
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <VideoOff className="text-white" size={32} />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Video Panel (Side Mode) */}
        {layout === 'side' && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="w-full lg:w-[30%] bg-gray-900 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-purple-400" size={20} />
                <h3 className="text-white font-semibold">
                  Video Chat ({remoteUserIds.length + 1})
                </h3>
              </div>
              <button
                onClick={() => setLayout(layout === 'side' ? 'overlay' : 'side')}
                className="text-gray-400 hover:text-white text-sm"
              >
                {layout === 'side' ? 'Overlay' : 'Side'}
              </button>
            </div>

            {/* Video Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Remote Videos */}
              {remoteUserIds.map((userId, idx) => (
                <div key={userId} className="bg-gray-800 rounded-xl overflow-hidden border border-purple-500/30">
                  <div className="aspect-video relative">
                    <video
                      ref={(el) => { remoteVideoRefs.current[userId] = el; }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 text-white text-sm font-semibold bg-black/50 px-2 py-1 rounded">
                      Player {idx + 1}
                    </div>
                  </div>
                </div>
              ))}

              {/* Local Video */}
              <div className="bg-gray-800 rounded-xl overflow-hidden border border-blue-500/30">
                <div className="aspect-video relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute bottom-2 left-2 text-white text-sm font-semibold bg-black/50 px-2 py-1 rounded">
                    You
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <VideoOff className="text-white" size={48} />
                      <p className="text-white/70 text-sm mt-2">Camera Off</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Waiting Message */}
              {remoteUserIds.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Users size={48} className="mx-auto mb-2 opacity-30" />
                  <p>Waiting for other players...</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleToggleVideo}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    isVideoEnabled
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  <span className="hidden sm:inline">{isVideoEnabled ? 'Camera' : 'Camera Off'}</span>
                </button>

                <button
                  onClick={handleToggleAudio}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    isAudioEnabled
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  <span className="hidden sm:inline">{isAudioEnabled ? 'Mic' : 'Muted'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <X size={20} />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Close Button (Overlay Mode) */}
        {layout === 'overlay' && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            <X size={20} />
            Leave Call
          </button>
        )}
      </div>
    </div>
  );
}
