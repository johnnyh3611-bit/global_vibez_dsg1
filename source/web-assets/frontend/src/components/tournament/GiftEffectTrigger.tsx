/**
 * GiftEffectTrigger - Sends gift events to UE5 Niagara particle system
 * When a gift is sent, triggers "Celestial Sparks" effects in Unreal Engine
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gift, Heart, Star, Zap } from 'lucide-react';

const GiftEffectTrigger = ({ 
  tableId,
  playerId,
  isEnabled = true 
}) => {
  const [recentGifts, setRecentGifts] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const wsRef = useRef(null);

  const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001';

  // Gift type to Niagara effect mapping
  const giftEffects = {
    'rose': {
      niagara_tag: 'NS_Rose_Petals',
      color: '#FF1493',
      icon: '🌹',
      intensity: 0.7,
      duration_ms: 3000
    },
    'champagne': {
      niagara_tag: 'NS_Champagne_Bubbles',
      color: '#FFD700',
      icon: '🍾',
      intensity: 0.9,
      duration_ms: 4000
    },
    'diamond': {
      niagara_tag: 'NS_Diamond_Sparkles',
      color: '#00FFFF',
      icon: '💎',
      intensity: 1.0,
      duration_ms: 5000
    },
    'heart': {
      niagara_tag: 'NS_Heart_Burst',
      color: '#FF69B4',
      icon: '❤️',
      intensity: 0.8,
      duration_ms: 3500
    },
    'firework': {
      niagara_tag: 'NS_Celestial_Firework',
      color: '#FF4500',
      icon: '🎆',
      intensity: 1.0,
      duration_ms: 6000
    }
  };

  // Connect to tournament WebSocket
  useEffect(() => {
    if (!tableId || !isEnabled) return;

    const wsUrl = `${WS_URL}/api/ws/tournament/${tableId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'GIFT_SENT') {
          handleGiftReceived(message.data);
        }
      } catch (err) {
        // console.error('Failed to parse gift event:', err);
      }
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [tableId, isEnabled, WS_URL]);

  const handleGiftReceived = (giftData) => {
    const {
      gift_type,
      sender,
      recipient,
      sender_position,
      recipient_position
    } = giftData;

    const effect = giftEffects[gift_type] || giftEffects['heart'];

    // Add to recent gifts
    const newGift = {
      id: Date.now(),
      sender,
      recipient,
      icon: effect.icon,
      color: effect.color,
      timestamp: new Date()
    };

    setRecentGifts((prev) => [newGift, ...prev.slice(0, 4)]);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);

    // Trigger UE5 Niagara effect via WebSocket
    triggerNiagaraEffect({
      niagara_tag: effect.niagara_tag,
      spawn_position: sender_position || { x: 0, y: 0, z: 100 },
      target_position: recipient_position || { x: 200, y: 0, z: 100 },
      color: effect.color,
      intensity: effect.intensity,
      duration_ms: effect.duration_ms,
      metadata: {
        sender,
        recipient,
        gift_type
      }
    });
  };

  const triggerNiagaraEffect = (effectData) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send effect trigger to UE5
      wsRef.current.send(JSON.stringify({
        type: 'TRIGGER_NIAGARA_EFFECT',
        data: effectData
      }));

    }
  };

  // Manual gift sending function (can be called from UI)
  const sendGift = (giftType, recipientId, recipientName) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'SEND_GIFT',
      data: {
        sender_id: playerId,
        recipient_id: recipientId,
        recipient_name: recipientName,
        gift_type: giftType,
        timestamp: new Date().toISOString()
      }
    }));
  };

  if (!isEnabled) return null;

  return (
    <>
      {/* Gift Notification Popup */}
      <AnimatePresence>
        {showNotification && recentGifts[0] && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-20 right-4 z-50 pointer-events-none"
          >
            <div className="bg-gradient-to-r from-purple-900/95 to-pink-900/95 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-4 shadow-2xl min-w-[280px]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                  {recentGifts[0].icon}
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Gift Received!</p>
                  <p className="text-white/80 text-xs">
                    {recentGifts[0].sender} → {recentGifts[0].recipient}
                  </p>
                </div>
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>

              {/* Animated border glow */}
              <div 
                className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 rounded-2xl blur-lg opacity-50 -z-10 animate-pulse"
                style={{ animationDuration: '2s' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Gifts Mini-Feed */}
      <div className="fixed bottom-40 right-4 z-40 space-y-2 pointer-events-none">
        <AnimatePresence>
          {recentGifts.slice(0, 3).map((gift, index) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1 - (index * 0.3), x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2"
            >
              <span className="text-lg">{gift.icon}</span>
              <span className="text-white/70 text-xs">
                {gift.sender} → {gift.recipient}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick Gift Panel (Optional) */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-3"
        >
          <p className="text-white/60 text-xs mb-2 text-center font-bold">Quick Gifts</p>
          <div className="flex gap-2">
            {Object.entries(giftEffects).map(([key, effect]) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  // This would typically open a player selector
                }}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-xl transition-all border border-white/10"
                title={key}
                style={{
                  boxShadow: `0 0 15px ${effect.color}40`
                }}
              >
                {effect.icon}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default GiftEffectTrigger;
