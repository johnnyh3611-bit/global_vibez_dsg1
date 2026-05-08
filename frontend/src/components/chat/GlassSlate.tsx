/**
 * GlassSlate - Translucent "Celestial Glass" Chat UI
 * Web translation of UE5 Ray-Traced Glass concept
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Users, Minimize2, Maximize2 } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useVoiceMirrorTarget } from '@/contexts/VoiceMirrorContext';
import TranslatedSubtitle from '@/components/common/TranslatedSubtitle';

export default function GlassSlate({ userId, userName, initialRoom = 'global_lobby' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    connected,
    messages,
    currentRoom,
    onlineUsers,
    typingUsers,
    sendMessage,
    joinRoom,
    sendTyping,
    getOnlineUsers,
  } = useChat(userId, userName);

  // Voice Mirror wire-up: when this chat is open, let the global voice
  // dock send translated transcripts straight into the conversation.
  useVoiceMirrorTarget(
    isOpen
      ? {
          id: `glass-slate-${currentRoom || 'lobby'}`,
          label: `Chat · ${currentRoom || 'Lobby'}`,
          onTranslated: ({ translated, original }) => {
            if (!connected || !currentRoom) return;
            const text = translated || original;
            if (text && text.trim()) sendMessage(currentRoom, text.trim());
          },
        }
      : null
  );

  const currentMessages = messages[currentRoom] || [];
  const currentTypingUsers = Array.from(typingUsers[currentRoom] || []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTyping(currentRoom, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTyping(currentRoom, false);
    }, 2000);
  };

  // Send message
  const handleSendMessage = () => {
    if (inputMessage.trim() && connected) {
      sendMessage(currentRoom, inputMessage.trim());
      setInputMessage('');
      setIsTyping(false);
      sendTyping(currentRoom, false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Render message
  const renderMessage = (msg, index) => {
    const msgKey = `${msg.type}-${msg.timestamp || index}-${msg.sender_id || 'system'}`;
    
    if (msg.type === 'system') {
      return (
        <motion.div
          key={msgKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs text-purple-300 my-2"
        >
          {msg.message}
        </motion.div>
      );
    }

    if (msg.type === 'user_joined' || msg.type === 'user_left') {
      return (
        <motion.div
          key={msgKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs text-gray-400 my-1"
        >
          {msg.user_name} {msg.type === 'user_joined' ? 'joined' : 'left'} the room
        </motion.div>
      );
    }

    if (msg.type === 'message') {
      const isMe = msg.sender_id === userId;
      return (
        <motion.div
          key={msgKey}
          initial={{ opacity: 0, x: isMe ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}
        >
          <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
            <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
            <div
              className={`px-4 py-2 rounded-2xl ${
                isMe
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-white backdrop-blur-sm'
              }`}
            >
              <p className="text-sm break-words">{msg.message}</p>
              {!isMe && <TranslatedSubtitle text={msg.message} />}
            </div>
            <span className="text-xs text-gray-500 mt-1">{formatTime(msg.timestamp)}</span>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  // Floating chat button
  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 p-4 rounded-full shadow-2xl transition-all"
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {onlineUsers.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white"
          >
            {onlineUsers.length}
          </motion.div>
        )}
      </motion.button>
    );
  }

  // Glass Slate Chat Window
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        height: isMinimized ? 'auto' : '600px'
      }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-6 right-6 z-50 w-96 bg-black/40 backdrop-blur-2xl border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden"
      style={{
        boxShadow: '0 0 40px rgba(168, 85, 247, 0.4), inset 0 0 60px rgba(168, 85, 247, 0.1)'
      }}
    >
      {/* Header - "Celestial Glass" effect */}
      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-b border-purple-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <MessageCircle className="w-6 h-6 text-purple-300" />
              {connected && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-black"
                />
              )}
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Global Vibez Chat</h3>
              <p className="text-purple-300 text-xs">
                {currentRoom.replace('_', ' ').toUpperCase()} • {onlineUsers.length} online
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4 text-purple-300" />
              ) : (
                <Minimize2 className="w-4 h-4 text-purple-300" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-purple-300" />
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Container */}
          <div className="h-[440px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-16 h-16 text-purple-300/30 mb-4" />
                <p className="text-gray-400 text-sm">No messages yet</p>
                <p className="text-gray-500 text-xs">Start a conversation!</p>
              </div>
            ) : (
              <>
                {currentMessages.map((msg, index) => renderMessage(msg, index))}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* Typing indicator */}
            {currentTypingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-gray-400 text-xs"
              >
                <div className="flex gap-1">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-purple-400 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-purple-400 rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-purple-400 rounded-full"
                  />
                </div>
                <span>Someone is typing...</span>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-purple-500/30 p-4 bg-black/20 backdrop-blur-xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Send a vibe..."
                disabled={!connected}
                className="flex-1 bg-white/5 border border-purple-500/30 rounded-full px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!connected || !inputMessage.trim()}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 p-3 rounded-full transition-all disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #a855f7, #ec4899);
          border-radius: 10px;
        }
      `}</style>
    </motion.div>
  );
}
