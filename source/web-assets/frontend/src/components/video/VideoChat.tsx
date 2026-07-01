import React, { useState, useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import VideoPiP from './VideoPiP';
import VideoSplitScreen from './VideoSplitScreen';

/**
 * Main Video Chat Manager Component
 * Handles PiP vs Split-Screen mode based on device
 */
export default function VideoChat({ 
  roomId, 
  userId, 
  username,
  mode = 'auto', // 'auto', 'pip', 'split'
  children,
  onClose
}) {
  const [videoMode, setVideoMode] = useState(mode);
  
  const {
    localStream,
    remoteStreams,
    isConnected,
    participants,
    error,
    connect,
    disconnect,
    toggleVideo,
    toggleAudio
  } = useWebRTC(roomId, userId, username);

  // Auto-detect mode based on screen size
  useEffect(() => {
    if (mode === 'auto') {
      const handleResize = () => {
        // Mobile: PiP, Tablet/PC: Split-Screen
        setVideoMode(window.innerWidth < 768 ? 'pip' : 'split');
      };

      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } else {
      setVideoMode(mode);
    }
  }, [mode]);

  // Auto-connect on mount
  useEffect(() => {
    if (roomId && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [roomId, userId, connect, disconnect]);

  const handleClose = () => {
    disconnect();
    if (onClose) onClose();
  };

  const handleMaximize = () => {
    setVideoMode('split');
  };

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
        Error: {error}
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="fixed bottom-4 right-4 bg-purple-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        Connecting...
      </div>
    );
  }

  // Picture-in-Picture Mode
  if (videoMode === 'pip') {
    return (
      <>
        {children}
        <VideoPiP
          localStream={localStream}
          remoteStreams={remoteStreams}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onClose={handleClose}
          onMaximize={handleMaximize}
        />
      </>
    );
  }

  // Split-Screen Mode
  return (
    <VideoSplitScreen
      localStream={localStream}
      remoteStreams={remoteStreams}
      onToggleVideo={toggleVideo}
      onToggleAudio={toggleAudio}
      onClose={handleClose}
    >
      {children}
    </VideoSplitScreen>
  );
}
