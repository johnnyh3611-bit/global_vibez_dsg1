import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, Users, MessageCircle, X, Send, Heart } from 'lucide-react';
import Peer from 'simple-peer';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveStreamPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('user_name') || 'Streamer';

  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('gaming');
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const peersRef = useRef([]);

  useEffect(() => {
    return () => {
      // Cleanup
      if (isLive) {
        endStream();
      }
    };
  }, [isLive]);

  const startStream = async () => {
    if (!title.trim()) {
      alert('Please enter a stream title!');
      return;
    }

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Create stream on backend
      const response = await fetch(`${API}/api/live-streaming/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          title,
          description: '',
          category,
          tags: [category, 'live']
        })
      });

      const data = await response.json();

      if (data.success) {
        setStreamId(data.stream_id);
        setIsLive(true);
        
        // Connect to signaling server
        connectWebSocket(data.stream_id);
      }
    } catch (error) {
      // console.error('Error starting stream:', error);
      alert('Failed to start stream. Please check camera/mic permissions.');
    }
  };

  const endStream = async () => {
    try {
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close all peer connections
      peersRef.current.forEach(peer => {
        try {
          peer.destroy();
        } catch (e) {}
      });
      peersRef.current = [];

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }

      // End stream on backend
      if (streamId) {
        await fetch(`${API}/api/live-streaming/stream/end/${streamId}?user_id=${userId}`, {
          method: 'POST'
        });
      }

      setIsLive(false);
      setStreamId(null);
      setViewerCount(0);
      setChatMessages([]);
    } catch (error) {
      // console.error('Error ending stream:', error);
    }
  };

  const connectWebSocket = (sid) => {
    const wsUrl = API.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/api/live-streaming/ws/${sid}/${userId}`);

    ws.onopen = () => {
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'viewer-joined':
          setViewerCount(message.viewer_count);
          // Create peer connection for new viewer
          createPeerConnection(message.user_id, true);
          break;

        case 'viewer-left':
          setViewerCount(message.viewer_count);
          break;

        case 'answer':
          // Handle answer from viewer
          const peer = peersRef.current.find(p => p.userId === message.from);
          if (peer) {
            peer.signal(message.signal);
          }
          break;

        case 'chat-message':
          setChatMessages(prev => [...prev, {
            username: message.username,
            message: message.message,
            timestamp: message.timestamp
          }]);
          break;

        default:
          break;
      }
    };

    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  };

  const createPeerConnection = (viewerId, initiator) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: streamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.userId = viewerId;

    peer.on('signal', (signal) => {
      // Send offer to viewer
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          signal,
          target: viewerId
        }));
      }
    });

    peer.on('error', (err) => {
      // console.error('Peer error:', err);
    });

    peersRef.current.push(peer);
    return peer;
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !streamId) return;

    try {
      await fetch(`${API}/api/live-streaming/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: streamId,
          user_id: userId,
          username: userName,
          message: chatInput
        })
      });

      setChatInput('');
    } catch (error) {
      // console.error('Error sending message:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <motion.button
          onClick={() => navigate('/my-vibez')}
          className="px-4 py-2 bg-purple-600/20 border border-purple-500/50 rounded-lg text-white hover:bg-purple-600/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ← Back to MY VIBEZ
        </motion.button>
      </div>

      <div className="max-w-7xl mx-auto">
        {!isLive ? (
          // Stream Setup
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-8"
          >
            <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              🔴 Start Live Stream
            </h1>

            <div className="space-y-4">
              <div>
                <label className="block text-cyan-300 mb-2">Stream Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Epic Gaming Session 🎮"
                  className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-cyan-300 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="gaming">🎮 Gaming</option>
                  <option value="dating">💕 Dating</option>
                  <option value="casual">💬 Casual Chat</option>
                  <option value="music">🎵 Music</option>
                  <option value="art">🎨 Art</option>
                </select>
              </div>

              <motion.button
                onClick={startStream}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl font-bold text-white text-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(239, 68, 68, 0.5)',
                    '0 0 40px rgba(239, 68, 68, 0.8)',
                    '0 0 20px rgba(239, 68, 68, 0.5)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🔴 GO LIVE
              </motion.button>
            </div>
          </motion.div>
        ) : (
          // Live Stream View
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Stream */}
            <div className="lg:col-span-3">
              <div className="relative bg-black rounded-2xl overflow-hidden border-2 border-red-500">
                {/* Live Badge */}
                <motion.div
                  className="absolute top-4 left-4 z-10 px-4 py-2 bg-red-600 rounded-full font-bold text-white flex items-center gap-2"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                  LIVE
                </motion.div>

                {/* Viewer Count */}
                <div className="absolute top-4 right-4 z-10 px-4 py-2 bg-black/70 backdrop-blur rounded-full text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span className="font-bold">{viewerCount}</span>
                </div>

                {/* Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video object-cover"
                />

                {/* Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-4">
                  <motion.button
                    onClick={toggleVideo}
                    className={`p-4 rounded-full ${isVideoEnabled ? 'bg-purple-600' : 'bg-red-600'}`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
                  </motion.button>

                  <motion.button
                    onClick={toggleAudio}
                    className={`p-4 rounded-full ${isAudioEnabled ? 'bg-purple-600' : 'bg-red-600'}`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isAudioEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
                  </motion.button>

                  <motion.button
                    onClick={endStream}
                    className="px-6 py-4 bg-red-600 rounded-full font-bold text-white"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    End Stream
                  </motion.button>
                </div>
              </div>

              {/* Stream Info */}
              <div className="mt-4 p-4 bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-xl">
                <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/50 rounded-full text-purple-300">
                    {category}
                  </span>
                  <span>Stream ID: {streamId}</span>
                </div>
              </div>
            </div>

            {/* Chat Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl overflow-hidden h-[600px] flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-cyan-500/30">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Live Chat
                  </h3>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={msg.id || `chatMessages-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm"
                    >
                      <span className="font-bold text-cyan-400">{msg.username}:</span>
                      <span className="text-gray-300 ml-2">{msg.message}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-cyan-500/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Say something..."
                      className="flex-1 px-3 py-2 bg-black/50 border border-cyan-500/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                    />
                    <motion.button
                      onClick={sendChatMessage}
                      className="p-2 bg-purple-600 rounded-lg"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Send className="w-5 h-5 text-white" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}