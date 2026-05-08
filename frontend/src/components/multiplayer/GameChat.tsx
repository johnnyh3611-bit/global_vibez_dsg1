import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { useVoiceMirrorTarget } from '@/contexts/VoiceMirrorContext';
import TranslatedSubtitle from '@/components/common/TranslatedSubtitle';
import QuickEmojiButton from '@/components/chat/QuickEmojiButton';

export function GameChat({ multiplayerManager, currentPlayerName }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Voice Mirror: translated voice notes flow into the game chat.
  useVoiceMirrorTarget({
    id: 'multiplayer-game-chat',
    label: 'Game Chat',
    onTranslated: ({ translated, original }) => {
      const text = translated || original;
      if (!text || !text.trim() || !multiplayerManager) return;
      setMessages((prev) => [...prev, {
        id: Date.now(),
        sender: currentPlayerName || 'You',
        message: text.trim(),
        timestamp: new Date().toISOString(),
        isMe: true,
      }]);
      multiplayerManager.sendChatMessage(text.trim());
    },
  });

  useEffect(() => {
    // Listen for chat messages
    const handleChatMessage = (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        sender: data.player_name,
        message: data.message,
        timestamp: data.timestamp,
        isMe: false
      }]);
    };

    multiplayerManager.on('chat_message', handleChatMessage);

    return () => {
      multiplayerManager.off('chat_message', handleChatMessage);
    };
  }, [multiplayerManager]);

  useEffect(() => {
    // Auto-scroll to bottom
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (inputMessage.trim()) {
      // Add to local messages immediately
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: currentPlayerName || 'You',
        message: inputMessage,
        timestamp: new Date().toISOString(),
        isMe: true
      }]);

      // Send via multiplayer manager
      multiplayerManager.sendChatMessage(inputMessage);
      
      setInputMessage('');
      inputRef.current?.focus();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <motion.div
      layout
      className={`relative bg-black/90 backdrop-blur-xl border-2 border-purple-500 rounded-2xl overflow-hidden flex flex-col ${
        isMinimized ? 'h-16' : 'h-96'
      }`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/80 to-fuchsia-900/80 border-b border-purple-500/50 cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-fuchsia-400" />
          <h3 className="font-black text-white">Game Chat</h3>
          {messages.length > 0 && (
            <span className="bg-fuchsia-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <motion.button
          animate={{ rotate: isMinimized ? 0 : 180 }}
          className="text-white/60 hover:text-white transition-colors"
        >
          ▼
        </motion.button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
          >
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/40 text-sm">
                <p>No messages yet. Say hi! 👋</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: msg.isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${msg.isMe ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-4 py-2 rounded-2xl ${
                        msg.isMe
                          ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white'
                          : 'bg-white/10 backdrop-blur-sm text-white'
                      }`}>
                        {!msg.isMe && (
                          <p className="text-xs font-bold text-cyan-400 mb-1">
                            {msg.sender}
                          </p>
                        )}
                        <p className="text-sm break-words">{msg.message}</p>
                        {!msg.isMe && <TranslatedSubtitle text={msg.message} />}
                      </div>
                      <p className="text-xs text-white/40 mt-1 px-2">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onSubmit={handleSendMessage}
            className="p-4 border-t border-purple-500/50 bg-black/40"
          >
            <div className="flex items-center gap-2">
              <QuickEmojiButton
                onPick={(e) => setInputMessage((m) => m + e)}
                className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-purple-500/30 text-white/80 hover:text-white hover:bg-white/15 transition"
                testIdPrefix="multiplayer-chat-emoji"
              />
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 backdrop-blur-sm border border-purple-500/30 rounded-xl px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-fuchsia-500 transition-colors"
                maxLength={200}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!inputMessage.trim()}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${
                  inputMessage.trim()
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white hover:shadow-lg hover:shadow-fuchsia-500/50'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
            <p className="text-xs text-white/30 mt-2">
              {inputMessage.length}/200 characters
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.8);
        }
      `}</style>
    </motion.div>
  );
}
