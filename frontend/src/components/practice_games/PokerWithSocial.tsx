
import React, { useState } from 'react';
import { Users, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import PokerAAAResponsive from './PokerAAAResponsive';
import SocialOverlay from '../social/SocialOverlay';
import VibeNotification from '../social/VibeNotification';

// Example: Poker with Social Layer Integration
export default function PokerWithSocial() {
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [notification, setNotification] = useState(null);
  const [nearbyPlayers] = useState([
    { id: 1, name: 'Alex', image: '👩', compatibility: 94, status: 'All In!', online: true },
    { id: 2, name: 'Jordan', image: '🧑', compatibility: 89, status: 'Thinking...', online: true },
    { id: 3, name: 'Sam', image: '👨', compatibility: 87, status: 'Folded', online: false },
  ]);

  const handleSendVibe = (player) => {
    setNotification({
      type: 'vibe',
      title: 'Vibe Sent!',
      message: `You sent a vibe to ${player.name} 🍹`
    });
    setShowSocialOverlay(false);
  };

  const handleInviteToTable = (player) => {
    setNotification({
      type: 'invite',
      title: 'Invite Sent!',
      message: `${player.name} has been invited to your table`
    });
  };

  return (
    <div className="relative">
      {/* Main Game */}
      <PokerAAAResponsive />

      {/* Social Toggle Button - Floating */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowSocialOverlay(true)}
        className="fixed top-24 right-4 z-30 bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 p-4 rounded-full shadow-2xl transition-all"
      >
        <div className="relative">
          <Users className="w-6 h-6 text-white" />
          {nearbyPlayers.filter(p => p.online).length > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{nearbyPlayers.filter(p => p.online).length}</span>
            </div>
          )}
        </div>
      </motion.button>

      {/* Mini Vibe Matches - Floating Sidebar (Desktop Only) */}
      <div className="hidden lg:block fixed top-24 left-4 z-30 w-64 space-y-3">
        <div className="bg-black/60 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-pink-400" />
            <h3 className="text-white font-bold text-sm">Nearby Vibes</h3>
          </div>
          
          <div className="space-y-2">
            {nearbyPlayers.slice(0, 2).map(player => (
              <div key={player.id} className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-sm">
                  {player.image}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{player.name}</p>
                  <p className="text-white/60 text-xs truncate">{player.status}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSendVibe(player)}
                  className="flex-shrink-0 w-6 h-6 bg-pink-500 hover:bg-pink-600 rounded-full flex items-center justify-center transition-all"
                >
                  <Heart className="w-3 h-3 text-white" />
                </motion.button>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => setShowSocialOverlay(true)}
            className="w-full mt-3 text-pink-400 hover:text-pink-300 text-xs font-bold transition-colors"
          >
            View All →
          </button>
        </div>
      </div>

      {/* Social Overlay */}
      <SocialOverlay
        visible={showSocialOverlay}
        onClose={() => setShowSocialOverlay(false)}
        nearbyPlayers={nearbyPlayers}
        onSendVibe={handleSendVibe}
        onInviteToTable={handleInviteToTable}
      />

      {/* Notifications */}
      <VibeNotification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}
