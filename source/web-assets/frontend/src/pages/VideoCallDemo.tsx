import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, Users, Gamepad2, Heart, ArrowRight } from 'lucide-react';
import VideoChat from '../components/video/VideoChat';
import BackButton from '../components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VideoCallDemo() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [userId] = useState(`user_${Math.random().toString(36).substr(2, 9)}`);
  const [inCall, setInCall] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto', 'pip', 'split'
  const [demoGame, setDemoGame] = useState('spades');

  const handleJoinRoom = async () => {
    if (!roomId.trim() || !username.trim()) {
      alert('Please enter both room ID and username');
      return;
    }

    setInCall(true);
  };

  const handleCreateRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/video-chat/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_type: demoGame })
      });

      const data = await response.json();
      if (data.success) {
        setRoomId(data.room_id);
      }
    } catch (error) {
      // console.error('Failed to create room:', error);
      alert('Failed to create room');
    }
  };

  if (inCall) {
    return (
      <VideoChat
        roomId={roomId}
        userId={userId}
        username={username}
        mode={mode}
        onClose={() => setInCall(false)}
      >
        {/* Demo Game Content */}
        <DemoGameContent game={demoGame} />
      </VideoChat>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <BackButton />

      <div className="max-w-4xl mx-auto pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            🎥 Video Call Demo
          </h1>
          <p className="text-xl text-purple-200">
            Face-to-face gaming with WebRTC video chat
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Lobby Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Video className="text-purple-400" />
              Join Video Call
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-purple-200">
                  Your Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-purple-200">
                  Room ID
                </label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID or create new"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  className="flex-1 py-3 rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                  Create Room
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={!roomId || !username}
                  className="flex-1 py-3 rounded-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  Join <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Settings Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
          >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="text-blue-400" />
              Settings
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3 text-purple-200">
                  Video Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['auto', 'pip', 'split'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-2 px-4 rounded-lg font-semibold capitalize transition-colors ${
                        mode === m
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-purple-300 mt-2">
                  {mode === 'auto' && '📱 Mobile: PiP | 💻 PC: Split-screen'}
                  {mode === 'pip' && '📱 Picture-in-Picture (Floating bubble)'}
                  {mode === 'split' && '💻 Split-Screen (Side panel)'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3 text-purple-200">
                  Demo Game
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'spades', label: 'Spades', icon: Gamepad2 },
                    { id: 'poker', label: 'Poker', icon: Gamepad2 },
                    { id: 'dating', label: 'Dating', icon: Heart },
                    { id: 'slots', label: 'Slots', icon: Gamepad2 }
                  ].map((game) => (
                    <button
                      key={game.id}
                      onClick={() => setDemoGame(game.id)}
                      className={`py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                        demoGame === game.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-blue-200 hover:bg-white/20'
                      }`}
                    >
                      <game.icon size={18} />
                      {game.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Video className="text-purple-400" size={32} />}
            title="WebRTC P2P"
            description="Direct peer-to-peer video connections for low latency"
          />
          <FeatureCard
            icon={<Users className="text-blue-400" size={32} />}
            title="Multi-User"
            description="Support for multiple players in the same video room"
          />
          <FeatureCard
            icon={<Gamepad2 className="text-pink-400" size={32} />}
            title="Game Integration"
            description="Seamless video chat during card games and dating"
          />
        </div>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-purple-200">{description}</p>
    </motion.div>
  );
}

// Demo Game Content Component
function DemoGameContent({ game }) {
  const gameContent = {
    spades: {
      title: '♠️ Spades',
      bg: 'from-green-900 to-green-700',
      description: 'Play Spades with face-to-face video chat!'
    },
    poker: {
      title: '🃏 Poker',
      bg: 'from-red-900 to-red-700',
      description: 'High-stakes poker with live video'
    },
    dating: {
      title: '💕 Dating',
      bg: 'from-pink-900 to-purple-700',
      description: 'Get to know your match face-to-face'
    },
    slots: {
      title: '🎰 Slots',
      bg: 'from-yellow-900 to-orange-700',
      description: 'Spin slots together with friends'
    }
  };

  const content = gameContent[game] || gameContent.spades;

  return (
    <div className={`flex items-center justify-center h-full bg-gradient-to-br ${content.bg} p-8`}>
      <div className="text-center">
        <h2 className="text-6xl font-bold mb-4">{content.title}</h2>
        <p className="text-2xl text-white/80 mb-8">{content.description}</p>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border-2 border-white/30">
          <p className="text-xl text-white/70">
            Game content would appear here
          </p>
          <p className="text-sm text-white/50 mt-4">
            Video chat is active in PiP or split-screen mode
          </p>
        </div>
      </div>
    </div>
  );
}
