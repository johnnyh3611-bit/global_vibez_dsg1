/**
 * Chat Demo Page - Test Global Vibez Chat System
 */

import React, { useState, useEffect } from 'react';
import GlassSlate from '@/components/chat/GlassSlate';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';

export default function ChatDemo() {
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || `user_${Math.random().toString(36).substr(2, 9)}`);
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || `Player_${userId.substr(-4)}`);

  useEffect(() => {
    localStorage.setItem('mp_user_id', userId);
    localStorage.setItem('mp_user_name', userName);
  }, [userId, userName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <MessageCircle className="w-12 h-12 text-purple-400" />
          <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text">
            Global Vibez Chat
          </h1>
          <Sparkles className="w-12 h-12 text-pink-400" />
        </div>
        <p className="text-gray-300 text-lg">Real-time messaging across Gaming, Dating & Streaming</p>
        <p className="text-purple-300 text-sm mt-2">
          Logged in as: <span className="font-bold">{userName}</span> ({userId.substr(0, 8)}...)
        </p>
      </motion.div>

      {/* Demo Content */}
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Features */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8"
          >
            <h2 className="text-2xl font-bold text-purple-300 mb-6">Features</h2>
            <ul className="space-y-4">
              {[
                { icon: '💬', title: 'Real-time Messaging', desc: 'WebSocket-powered instant chat' },
                { icon: '🎮', title: 'Game Integration', desc: 'Chat while playing multiplayer games' },
                { icon: '💖', title: 'Dating Lounge', desc: 'Connect with matches in real-time' },
                { icon: '✨', title: 'AI Moderation', desc: 'Keep the vibe positive and safe' },
                { icon: '👥', title: 'Online Presence', desc: 'See who\'s active right now' },
                { icon: '⌨️', title: 'Typing Indicators', desc: 'Know when someone is responding' },
              ].map((feature, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <h3 className="font-bold text-white">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Available Rooms */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8"
          >
            <h2 className="text-2xl font-bold text-purple-300 mb-6">Chat Rooms</h2>
            <div className="space-y-4">
              {[
                { id: 'global_lobby', name: 'Global Lobby', icon: '🌍', color: 'from-blue-500 to-cyan-500' },
                { id: 'dating_lounge', name: 'Dating Lounge', icon: '💖', color: 'from-pink-500 to-rose-500' },
                { id: 'game_central', name: 'Game Central', icon: '🎮', color: 'from-purple-500 to-indigo-500' },
              ].map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className={`bg-gradient-to-r ${room.color} p-4 rounded-2xl cursor-pointer hover:scale-105 transition-transform`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{room.icon}</span>
                    <div>
                      <h3 className="font-bold text-white">{room.name}</h3>
                      <p className="text-white/80 text-xs">Click chat icon to join →</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-black/30 rounded-2xl">
              <h3 className="font-bold text-yellow-400 mb-2">🎯 How to Use</h3>
              <ol className="text-sm text-gray-300 space-y-2">
                <li>1. Click the chat button in the bottom-right corner</li>
                <li>2. Type your message and hit Enter or click Send</li>
                <li>3. Open multiple browser tabs to test real-time sync!</li>
                <li>4. Messages are saved in MongoDB (refresh to see history)</li>
              </ol>
            </div>
          </motion.div>
        </div>

        {/* Technical Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8 bg-white/5 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6"
        >
          <h3 className="text-xl font-bold text-green-400 mb-4">⚡ Technical Stack</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-bold text-purple-300">Backend:</span>
              <p className="text-gray-400">FastAPI WebSockets, MongoDB, AI Moderation</p>
            </div>
            <div>
              <span className="font-bold text-pink-300">Frontend:</span>
              <p className="text-gray-400">React hooks, Framer Motion, Glass morphism UI</p>
            </div>
            <div>
              <span className="font-bold text-blue-300">Features:</span>
              <p className="text-gray-400">Real-time sync, Typing indicators, Room management</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Glass Slate Chat Component */}
      <GlassSlate userId={userId} userName={userName} />
    </div>
  );
}
