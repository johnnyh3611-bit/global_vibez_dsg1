import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Copy, Check, Crown, ArrowLeft, LogOut, Play } from 'lucide-react';
import multiplayerClient from '@/lib/multiplayerClient';

/**
 * Multiplayer Game Room - Waiting room before game starts
 */
export default function MultiplayerRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const userId = localStorage.getItem('user_id') || 'demo_user';

  useEffect(() => {
    if (!multiplayerClient.isConnected()) {
      navigate('/multiplayer');
      return;
    }

    // Event listeners
    const handleRoomJoined = (data) => {
      setRoom(data.room);
      setPlayers(data.room.players);
    };

    const handlePlayerJoined = (data) => {
      setRoom(data.room);
      setPlayers(data.room.players);
      setChatMessages(prev => [...prev, {
        type: 'system',
        message: `${data.player.username} joined the room`,
        timestamp: new Date().toISOString()
      }]);
    };

    const handlePlayerLeft = (data) => {
      setRoom(data.room);
      setPlayers(data.room.players);
      setChatMessages(prev => [...prev, {
        type: 'system',
        message: `${data.player.username} left the room`,
        timestamp: new Date().toISOString()
      }]);
    };

    const handlePlayerReady = (data) => {
      setRoom(data.room);
      setPlayers(data.room.players);
    };

    const handleGameStarted = (data) => {
      // Navigate to actual game
      navigate(`/practice/play/${room.game_type}?multiplayer=true&room=${roomCode}`);
    };

    const handleChatMessage = (data) => {
      setChatMessages(prev => [...prev, data]);
    };

    const handleRoomClosed = () => {
      navigate('/multiplayer');
    };

    multiplayerClient.on('room_joined', handleRoomJoined);
    multiplayerClient.on('player_joined', handlePlayerJoined);
    multiplayerClient.on('player_left', handlePlayerLeft);
    multiplayerClient.on('player_ready', handlePlayerReady);
    multiplayerClient.on('game_started', handleGameStarted);
    multiplayerClient.on('chat_message', handleChatMessage);
    multiplayerClient.on('room_closed', handleRoomClosed);

    return () => {
      multiplayerClient.off('room_joined', handleRoomJoined);
      multiplayerClient.off('player_joined', handlePlayerJoined);
      multiplayerClient.off('player_left', handlePlayerLeft);
      multiplayerClient.off('player_ready', handlePlayerReady);
      multiplayerClient.off('game_started', handleGameStarted);
      multiplayerClient.off('chat_message', handleChatMessage);
      multiplayerClient.off('room_closed', handleRoomClosed);
    };
  }, [navigate, roomCode, room]);

  const handleReady = async () => {
    try {
      await multiplayerClient.setReady();
      setIsReady(true);
    } catch (err) {
      // console.error('Failed to set ready:', err);
    }
  };

  const handleLeave = async () => {
    try {
      await multiplayerClient.leaveRoom();
      navigate('/multiplayer');
    } catch (err) {
      // console.error('Failed to leave room:', err);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    try {
      await multiplayerClient.sendChatMessage(chatInput);
      setChatInput('');
    } catch (err) {
      // console.error('Failed to send message:', err);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading room...</div>
      </div>
    );
  }

  const allReady = players.every(p => p.ready);
  const minPlayers = 2;
  const canStart = allReady && players.length >= minPlayers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Leave Room
          </button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={copyRoomCode}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border-2 border-cyan-500/30 text-cyan-400 hover:bg-gray-700 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="font-mono font-bold">{roomCode}</span>
          </motion.button>
        </div>

        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-2">
          {room.game_type.toUpperCase()} Room
        </h1>
        <p className="text-gray-400 text-lg">Waiting for players...</p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6">
        {/* Players List */}
        <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Players ({players.length}/{room.max_players})
          </h2>
          
          <div className="space-y-3">
            {players.map((player, index) => (
              <motion.div
                key={player.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border-2 ${
                  player.ready 
                    ? 'bg-green-500/20 border-green-500' 
                    : 'bg-gray-700/50 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {player.user_id === room.host_user_id && (
                      <Crown className="w-5 h-5 text-yellow-400" />
                    )}
                    <span className="text-lg font-bold text-white">
                      {player.username}
                      {player.user_id === userId && ' (You)'}
                    </span>
                  </div>
                  
                  {player.ready ? (
                    <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-bold">
                      ✓ READY
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-gray-600 text-gray-300 text-sm">
                      Waiting...
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Ready Button */}
          {!isReady && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReady}
              className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg shadow-xl hover:shadow-green-500/50 transition-all"
            >
              <Play className="w-5 h-5 inline mr-2" />
              I'm Ready!
            </motion.button>
          )}

          {/* Game Starting */}
          {canStart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-center"
            >
              <div className="text-2xl font-bold mb-2">🎮 Game Starting!</div>
              <p>All players ready. Launching game...</p>
            </motion.div>
          )}
        </div>

        {/* Chat */}
        <div className="bg-gray-800/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-2xl p-6 flex flex-col h-[600px]">
          <h2 className="text-xl font-bold text-white mb-4">Chat</h2>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {chatMessages.map((msg, i) => (
              <div key={msg.id || `chatMessages-${i}`} className={`p-2 rounded ${
                msg.type === 'system' 
                  ? 'bg-gray-700/50 text-gray-400 text-sm text-center' 
                  : 'bg-gray-700 text-white'
              }`}>
                {msg.type === 'system' ? (
                  msg.message
                ) : (
                  <>
                    <div className="font-bold text-cyan-400 text-sm">{msg.username}</div>
                    <div>{msg.message}</div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Input */}
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
