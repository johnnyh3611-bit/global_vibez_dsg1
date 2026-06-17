/**
 * SocialTicker - Live feed of bids, plays, and spectator comments
 * WebSocket-powered real-time updates for tournament tables
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, TrendingUp, Heart, Gift, Zap } from 'lucide-react';

const SocialTicker = ({ 
  tableId,
  isVisible = true,
  maxMessages = 50,
  position = "bottom" // bottom, top, left, right
}) => {
  const [messages, setMessages] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

  // Connect to tournament WebSocket
  useEffect(() => {
    if (!tableId) return;

    const wsUrl = `${WS_URL}/api/ws/tournament/${tableId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        // console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      // console.error('❌ Social ticker WebSocket error:', error);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [tableId, WS_URL]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (message) => {
    const messageTypes = {
      'DEALER_EVENT': handleDealerEvent,
      'PLAYER_ACTION': handlePlayerAction,
      'TABLE_STATE': handleTableState,
      'GIFT_SENT': handleGiftSent
    };

    const handler = messageTypes[message.type];
    if (handler) {
      handler(message.data);
    }
  };

  const handleDealerEvent = (data) => {
    addMessage({
      id: Date.now(),
      type: 'dealer',
      icon: '🎩',
      text: data.speech,
      metadata: {
        animation: data.animation,
        vibe: data.vibe
      },
      color: 'text-amber-400'
    });
  };

  const handlePlayerAction = (data) => {
    if (data.action_type === 'BID') {
      addMessage({
        id: Date.now(),
        type: 'bid',
        icon: <TrendingUp className="w-4 h-4" />,
        text: `${data.player_name} bids ${data.value} ${data.value === 1 ? 'trick' : 'tricks'}`,
        color: 'text-cyan-400'
      });
    } else if (data.action_type === 'PLAY_CARD') {
      addMessage({
        id: Date.now(),
        type: 'play',
        icon: '🃏',
        text: `${data.player_name} plays ${data.card}`,
        color: 'text-purple-400'
      });
    } else if (data.action_type === 'CHAT') {
      addMessage({
        id: Date.now(),
        type: 'chat',
        icon: <MessageCircle className="w-4 h-4" />,
        text: `${data.player_name}: ${data.metadata.message}`,
        color: 'text-white'
      });
    }
  };

  const handleTableState = (data) => {
    if (data.game_state?.phase === 'SCORING') {
      addMessage({
        id: Date.now(),
        type: 'system',
        icon: <Zap className="w-4 h-4" />,
        text: `Hand complete! Calculating scores...`,
        color: 'text-green-400'
      });
    }
  };

  const handleGiftSent = (data) => {
    addMessage({
      id: Date.now(),
      type: 'gift',
      icon: <Gift className="w-4 h-4" />,
      text: `${data.sender} sent ${data.gift_name} to ${data.recipient}`,
      color: 'text-pink-400'
    });
  };

  const addMessage = (message) => {
    setMessages((prev) => {
      const newMessages = [message, ...prev];
      return newMessages.slice(0, maxMessages);
    });
  };

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isVisible) return null;

  const positionClasses = {
    'bottom': 'bottom-0 left-0 right-0 h-32',
    'top': 'top-0 left-0 right-0 h-32',
    'left': 'left-0 top-0 bottom-0 w-80',
    'right': 'right-0 top-0 bottom-0 w-80'
  };

  const isHorizontal = position === 'bottom' || position === 'top';

  return (
    <div className={`fixed ${positionClasses[position]} z-40 pointer-events-none`}>
      {/* Background Gradient */}
      <div className={`absolute inset-0 ${
        position === 'bottom' ? 'bg-gradient-to-t' : 
        position === 'top' ? 'bg-gradient-to-b' : 
        position === 'left' ? 'bg-gradient-to-r' : 
        'bg-gradient-to-l'
      } from-black/80 via-black/50 to-transparent backdrop-blur-sm`} />

      {/* Connection Status Badge */}
      <div className="absolute top-2 right-2 pointer-events-auto">
        <div className={`flex items-center gap-2 ${wsConnected ? 'bg-green-600/20' : 'bg-red-600/20'} backdrop-blur-md px-3 py-1.5 rounded-full border ${wsConnected ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} ${wsConnected ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Message Feed */}
      <div className={`relative h-full ${isHorizontal ? 'px-6 py-4' : 'px-4 py-6'} overflow-hidden`}>
        <div className={`${isHorizontal ? 'flex flex-row-reverse gap-4 overflow-x-auto' : 'flex flex-col gap-2 overflow-y-auto'} h-full scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`}>
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ 
                  opacity: 0, 
                  x: isHorizontal ? 50 : 0,
                  y: isHorizontal ? 0 : 20
                }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`${isHorizontal ? 'flex-shrink-0' : 'w-full'} pointer-events-auto`}
              >
                <div className={`bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-3 ${isHorizontal ? 'w-64' : 'w-full'} hover:bg-black/90 transition-all`}>
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                      {typeof message.icon === 'string' ? (
                        <span className="text-lg">{message.icon}</span>
                      ) : (
                        <div className="text-white/80">{message.icon}</div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`${message.color} text-sm font-medium leading-tight`}>
                        {message.text}
                      </p>
                      {message.metadata && (
                        <p className="text-white/40 text-xs mt-1">
                          {message.metadata.vibe && `Vibe: ${message.metadata.vibe}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            animate={{
              x: [Math.random() * 100, Math.random() * 100],
              y: [Math.random() * 100, Math.random() * 100],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SocialTicker;
