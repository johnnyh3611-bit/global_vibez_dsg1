
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, X, Check, CheckCheck } from 'lucide-react';
import { io } from 'socket.io-client';
import QuickEmojiButton from '@/components/chat/QuickEmojiButton';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RideChat({ rideId, userId, role }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io(API, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      setIsConnected(true);

      // Join ride room
      newSocket.emit('vibe_ridez_join_ride', {
        ride_id: rideId,
        user_id: userId,
        role: role
      });

      // Request message history
      newSocket.emit('vibe_ridez_get_messages', {
        ride_id: rideId
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('joined_ride', (data) => {
    });

    newSocket.on('ride_messages_history', (data) => {
      if (data.ride_id === rideId) {
        const formattedMessages = data.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp.$date || msg.timestamp)
        }));
        setMessages(formattedMessages);
        
        // Count unread messages (messages from others sent while chat was closed)
        if (!isOpen) {
          const unread = formattedMessages.filter(msg => msg.user_id !== userId).length;
          setUnreadCount(unread);
        }
      }
    });

    newSocket.on('ride_message', (data) => {
      const newMsg = {
        ...data,
        timestamp: new Date(data.timestamp)
      };
      
      setMessages(prev => [...prev, newMsg]);

      // Update unread count if chat is closed and message is from someone else
      if (!isOpen && data.user_id !== userId) {
        setUnreadCount(prev => prev + 1);
      }

      // Play notification sound (optional)
      if (data.user_id !== userId) {
        playNotificationSound();
      }
    });

    newSocket.on('user_joined_ride', (data) => {
      // Add system message
      setMessages(prev => [...prev, {
        user_id: 'system',
        role: 'system',
        message: `${data.role === 'driver' ? 'Driver' : 'Passenger'} joined the ride`,
        timestamp: new Date(data.timestamp),
        isSystem: true
      }]);
    });

    newSocket.on('user_left_ride', (data) => {
      setMessages(prev => [...prev, {
        user_id: 'system',
        role: 'system',
        message: `${data.role === 'driver' ? 'Driver' : 'Passenger'} left the ride`,
        timestamp: new Date(data.timestamp),
        isSystem: true
      }]);
    });

    newSocket.on('error', (error) => {
      // console.error('Socket.IO error:', error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('vibe_ridez_leave_ride', {
          ride_id: rideId
        });
        newSocket.disconnect();
      }
    };
  }, [rideId, userId, role]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear unread count when chat is opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playNotificationSound = () => {
    // Simple beep sound (you can replace with actual audio file)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket) return;

    socket.emit('vibe_ridez_send_message', {
      ride_id: rideId,
      message: newMessage.trim()
    });

    setNewMessage('');
    
    // Focus back on input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const grouped = {};
    messages.forEach(msg => {
      const dateKey = formatDate(msg.timestamp);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(msg);
    });
    return grouped;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-2xl"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: isConnected
            ? '0 0 20px rgba(6, 182, 212, 0.6)'
            : '0 0 20px rgba(239, 68, 68, 0.6)'
        }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </div>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 w-96 h-[500px] bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, rgba(0, 0, 0, 0.95) 100%)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 backdrop-blur-xl border-b border-cyan-500/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                  <div>
                    <h3 className="text-white font-bold">Ride Chat</h3>
                    <p className="text-xs text-gray-400">
                      {isConnected ? 'Connected' : 'Connecting...'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-cyan-400 font-semibold uppercase">
                  {role === 'driver' ? '🚗 Driver' : '🧑 Passenger'}
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(Object.entries(groupedMessages) as Array<[string, any[]]>).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date Separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-black/40 text-gray-400 text-xs px-3 py-1 rounded-full">
                      {date}
                    </div>
                  </div>

                  {/* Messages for this date */}
                  {msgs.map((msg, idx) => {
                    const isMine = msg.user_id === userId;
                    const isSystem = msg.isSystem;

                    if (isSystem) {
                      return (
                        <div key={`item-${idx}`} className="flex justify-center my-2">
                          <div className="bg-black/40 text-gray-400 text-xs px-3 py-1 rounded-full">
                            {msg.message}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={`item-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl p-3 ${
                            isMine
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                              : 'bg-white/10 text-white backdrop-blur-xl'
                          }`}
                        >
                          {!isMine && (
                            <div className="text-xs font-semibold mb-1 text-cyan-400">
                              {msg.role === 'driver' ? '🚗 Driver' : '🧑 Passenger'}
                            </div>
                          )}
                          <p className="text-sm break-words">{msg.message}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] opacity-70">
                              {formatTime(msg.timestamp)}
                            </span>
                            {isMine && (
                              <CheckCheck className="w-3 h-3 opacity-70" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={sendMessage}
              className="border-t border-cyan-500/30 p-4 bg-black/40 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                <QuickEmojiButton
                  onPick={(e) => setNewMessage((m) => m + e)}
                  className="p-2 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white transition disabled:opacity-30"
                  testIdPrefix="ride-chat-emoji"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-all"
                  disabled={!isConnected}
                />
                <motion.button
                  type="submit"
                  disabled={!newMessage.trim() || !isConnected}
                  className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
                  whileHover={newMessage.trim() && isConnected ? { scale: 1.1 } : {}}
                  whileTap={newMessage.trim() && isConnected ? { scale: 0.9 } : {}}
                >
                  <Send className="w-5 h-5 text-white" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
