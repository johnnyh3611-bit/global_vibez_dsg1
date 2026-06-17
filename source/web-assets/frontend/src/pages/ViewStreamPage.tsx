import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Heart, Send, Share2, ArrowLeft } from 'lucide-react';
import Peer from 'simple-peer';
import ChairHolderName from '@/components/common/ChairHolderName';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ViewStreamPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');
  const userName = localStorage.getItem('user_name') || 'Viewer';

  const [stream, setStream] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    loadStreamInfo();
    loadChatHistory();
    connectToStream();

    return () => {
      // Cleanup
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [streamId]);

  const loadStreamInfo = async () => {
    try {
      const response = await fetch(`${API}/api/live-streaming/stream/${streamId}`);
      const data = await response.json();

      if (data.success) {
        setStream(data.stream);
        setViewerCount(data.stream.viewer_count || 0);
        setLikes(data.stream.likes || 0);
      } else {
        alert('Stream not found');
        navigate('/my-vibez');
      }
    } catch (error) {
      // console.error('Error loading stream:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${API}/api/live-streaming/chat/${streamId}`);
      const data = await response.json();

      if (data.success) {
        setChatMessages(data.messages);
      }
    } catch (error) {
      // console.error('Error loading chat:', error);
    }
  };

  const connectToStream = () => {
    const wsUrl = API.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/api/live-streaming/ws/${streamId}/${userId}`);

    ws.onopen = () => {
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'viewer-joined':
        case 'viewer-left':
          setViewerCount(message.viewer_count);
          break;

        case 'offer':
          // Receive offer from streamer
          handleOffer(message.signal);
          break;

        case 'chat-message':
          setChatMessages(prev => [...prev, {
            username: message.username,
            message: message.message,
            timestamp: message.timestamp,
            chair_perks: message.chair_perks || null,
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

  const handleOffer = (signal) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (answerSignal) => {
      // Send answer back to streamer
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          signal: answerSignal,
          target: stream.user_id
        }));
      }
    });

    peer.on('stream', (remoteStream) => {
      // Received stream from broadcaster
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('error', (err) => {
      // console.error('Peer error:', err);
    });

    peer.signal(signal);
    peerRef.current = peer;
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

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

  const toggleLike = async () => {
    try {
      await fetch(`${API}/api/my-vibez/interact/vibe_${streamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: hasLiked ? 'unlike' : 'like'
        })
      });

      setHasLiked(!hasLiked);
      setLikes(prev => hasLiked ? prev - 1 : prev + 1);
    } catch (error) {
      // console.error('Error toggling like:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading stream...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <motion.button
          onClick={() => navigate('/my-vibez')}
          className="px-4 py-2 bg-purple-600/20 border border-purple-500/50 rounded-lg text-white hover:bg-purple-600/30 flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </motion.button>
      </div>

      <div className="max-w-7xl mx-auto">
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
                playsInline
                className="w-full aspect-video object-cover"
              />

              {/* Interaction Buttons */}
              <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-4">
                <motion.button
                  onClick={toggleLike}
                  className={`p-4 rounded-full backdrop-blur ${hasLiked ? 'bg-red-600' : 'bg-black/50'}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Heart className={`w-6 h-6 ${hasLiked ? 'text-white fill-white' : 'text-white'}`} />
                </motion.button>

                <div className="text-center">
                  <div className="text-white font-bold">{likes}</div>
                  <div className="text-xs text-gray-400">likes</div>
                </div>
              </div>
            </div>

            {/* Stream Info */}
            <div className="mt-4 p-4 bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{stream?.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500" />
                      <span className="text-white font-semibold">{stream?.streamer_name}</span>
                    </div>
                    <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/50 rounded-full text-purple-300">
                      {stream?.category}
                    </span>
                  </div>
                </div>

                <motion.button
                  className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/50 rounded-lg text-cyan-300 hover:bg-cyan-600/30 flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Share2 className="w-5 h-5" />
                  Share
                </motion.button>
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
                    <ChairHolderName
                      username={msg.username}
                      perks={msg.chair_perks}
                      className="font-bold text-cyan-400"
                    />
                    <span className="text-gray-300 ml-2">: {msg.message}</span>
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
      </div>
    </div>
  );
}