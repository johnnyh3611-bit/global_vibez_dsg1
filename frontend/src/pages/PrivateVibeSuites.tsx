
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Users, Sparkles, Crown, MessageSquare, X, Check,
  MapPin, Clock, Star, Gift, Camera, Music, Coffee, Flame
} from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import VibeCallRoom from '@/components/voice/VibeCallRoom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Suite type configurations
const SUITE_TYPES = {
  glass: {
    name: 'Glass Suite',
    emoji: '🏙️',
    description: 'Modern glass walls with breathtaking city views',
    color: 'from-cyan-500 to-blue-500',
    features: ['360° City View', 'Modern Furniture', 'Ambient Lighting']
  },
  penthouse: {
    name: 'Penthouse',
    emoji: '👑',
    description: 'Luxury high-rise with premium amenities',
    color: 'from-purple-500 to-pink-500',
    features: ['Luxury Interior', 'Private Bar', 'Premium Sound']
  },
  beach: {
    name: 'Beach Suite',
    emoji: '🏖️',
    description: 'Oceanfront paradise with sunset views',
    color: 'from-yellow-500 to-orange-500',
    features: ['Ocean View', 'Beach Access', 'Tropical Vibes']
  },
  skyline: {
    name: 'Skyline Suite',
    emoji: '✨',
    description: 'Rooftop retreat under the stars',
    color: 'from-indigo-500 to-purple-500',
    features: ['Starry Sky', 'Rooftop Lounge', 'Panoramic View']
  }
};

function PrivateVibeSuites() {
  const [view, setView] = useState('lobby'); // lobby, suite, invitations
  const [activeSuites, setActiveSuites] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState({ id: 'demo_user', name: 'You' });
  const [showInviteModal, setShowInviteModal] = useState<string | false>(false);
  const [inviteRecipient, setInviteRecipient] = useState('');

  useEffect(() => {
    fetchActiveSuites();
    fetchPendingInvitations();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchActiveSuites();
      fetchPendingInvitations();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSuites = async () => {
    try {
      const response = await fetch(`${API_URL}/api/private-suites/list?player_id=${currentPlayer.id}`);
      const data = await response.json();
      setActiveSuites(data.suites || []);
    } catch (error) {
      // console.error('Failed to fetch suites:', error);
    }
  };

  const fetchPendingInvitations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/private-suites/invitations/${currentPlayer.id}`);
      const data = await response.json();
      setPendingInvitations(data.invitations || []);
    } catch (error) {
      // console.error('Failed to fetch invitations:', error);
    }
  };

  const createSuite = async (suiteType, recipientId) => {
    try {
      const response = await fetch(`${API_URL}/api/private-suites/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_id: currentPlayer.id,
          player2_id: recipientId,
          suite_type: suiteType,
          theme: 'romantic',
          privacy_level: 'private'
        })
      });
      const data = await response.json();
      if (data.success) {
        setSelectedSuite(data);
        setView('suite');
        fetchActiveSuites();
      }
    } catch (error) {
      // console.error('Failed to create suite:', error);
    }
  };

  const sendInvitation = async (recipientId, suiteType) => {
    try {
      const response = await fetch(
        `${API_URL}/api/private-suites/invite?from_player_id=${currentPlayer.id}&to_player_id=${recipientId}&message=Join me in a ${SUITE_TYPES[suiteType].name}!`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        setShowInviteModal(false);
        alert('Invitation sent! 💌');
      }
    } catch (error) {
      // console.error('Failed to send invitation:', error);
    }
  };

  const respondToInvitation = async (invitationId, accept) => {
    try {
      const response = await fetch(
        `${API_URL}/api/private-suites/invite/${invitationId}/respond?accept=${accept}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success && accept) {
        setSelectedSuite(data.suite);
        setView('suite');
      }
      fetchPendingInvitations();
      fetchActiveSuites();
    } catch (error) {
      // console.error('Failed to respond to invitation:', error);
    }
  };

  const leaveSuite = async (suiteId) => {
    try {
      await fetch(`${API_URL}/api/private-suites/${suiteId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: currentPlayer.id })
      });
      setView('lobby');
      setSelectedSuite(null);
      fetchActiveSuites();
    } catch (error) {
      // console.error('Failed to leave suite:', error);
    }
  };

  // Render Lobby
  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-900 via-purple-900 to-indigo-900 text-white">
        <UnifiedNavigation />
        <div className="pt-20 p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-pink-500/20 border border-pink-500/30 px-4 py-2 rounded-full mb-4"
              >
                <Heart className="w-5 h-5 text-pink-400" />
                <span className="text-pink-400 text-sm font-bold">PRIVATE VIBE SUITES</span>
              </motion.div>
              
              <h1 className="text-6xl font-black mb-4">
                Your Private <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Escape</span>
              </h1>
              
              <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
                Create intimate moments in beautifully designed private suites. Perfect for dates, deep conversations, or just vibing together.
              </p>

              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-2 border-pink-400/50 rounded-2xl p-6 mb-8 max-w-md mx-auto"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-6 h-6 text-pink-400" />
                    <h3 className="text-xl font-bold">Pending Invitations ({pendingInvitations.length})</h3>
                  </div>
                  {pendingInvitations.map(inv => (
                    <div key={inv.invitation_id} className="bg-black/30 rounded-xl p-4 mb-3">
                      <p className="text-sm text-white/80 mb-3">{inv.message}</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => respondToInvitation(inv.invitation_id, true)}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => respondToInvitation(inv.invitation_id, false)}
                          className="flex-1 bg-white/10 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Suite Types */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {Object.entries(SUITE_TYPES).map(([key, suite]) => (
                <motion.div
                  key={key}
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowInviteModal(key)}
                  className={`bg-gradient-to-br ${suite.color} p-6 rounded-2xl cursor-pointer border-2 border-white/20 hover:border-white/40 transition-all`}
                >
                  <div className="text-5xl mb-3">{suite.emoji}</div>
                  <h3 className="text-2xl font-bold mb-2">{suite.name}</h3>
                  <p className="text-white/80 text-sm mb-4">{suite.description}</p>
                  <div className="space-y-1">
                    {suite.features.map((feature, idx) => (
                      <div key={`feature-${suite.name}-${feature.slice(0, 15)}-${idx}`} className="flex items-center gap-2 text-xs text-white/70">
                        <Star className="w-3 h-3" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Active Suites */}
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Users className="text-pink-400" />
                Your Active Suites ({activeSuites.length})
              </h2>
              
              {activeSuites.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                  <Heart className="w-16 h-16 text-white/30 mx-auto mb-4" />
                  <p className="text-white/50 text-lg">No active suites. Create one to start vibing!</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeSuites.map(suite => (
                    <motion.div
                      key={suite.suite_id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => { setSelectedSuite(suite); setView('suite'); }}
                      className="bg-white/10 border border-white/20 rounded-2xl p-6 cursor-pointer hover:border-pink-400/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-3xl">{SUITE_TYPES[suite.suite_type]?.emoji || '🏠'}</div>
                        <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          ACTIVE
                        </span>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{SUITE_TYPES[suite.suite_type]?.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
                        <Users className="w-4 h-4" />
                        <span>2 Players</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <Clock className="w-4 h-4" />
                        <span>Active for {Math.round((Date.now() - new Date(suite.created_at).getTime()) / 60000)} min</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 max-w-md w-full border-2 border-pink-400/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Invite to {(SUITE_TYPES as Record<string, any>)[String(showInviteModal)]?.name || 'Suite'}</h2>
                <button onClick={() => setShowInviteModal(false)} className="text-white/70 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-white/70 mb-4">Enter the player ID you want to invite:</p>
              
              <input
                type="text"
                value={inviteRecipient}
                onChange={(e) => setInviteRecipient(e.target.value)}
                placeholder="player_id or username"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:border-pink-400"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => sendInvitation(inviteRecipient, showInviteModal)}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 rounded-lg font-bold hover:scale-105 transition-transform"
                >
                  Send Invitation 💌
                </button>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="bg-white/10 px-6 py-3 rounded-lg font-bold hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // Render Suite View
  if (view === 'suite' && selectedSuite) {
    const suiteConfig = SUITE_TYPES[selectedSuite.suite_type || 'glass'];
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-pink-900 to-indigo-900 text-white">
        <UnifiedNavigation />
        <div className="pt-20 p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Suite Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-5xl">{suiteConfig.emoji}</span>
                  <h1 className="text-4xl font-black">{suiteConfig.name}</h1>
                </div>
                <p className="text-white/70">{suiteConfig.description}</p>
              </div>
              <button
                onClick={() => leaveSuite(selectedSuite.suite_id)}
                className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-bold transition-all"
              >
                Leave Suite
              </button>
            </div>

            {/* Suite Experience */}
            <div className="grid lg:grid-cols-3 gap-6">
              
              {/* Main Area */}
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-center">
                    <div className="text-6xl mb-4">{suiteConfig.emoji}</div>
                    <p className="text-2xl font-bold mb-2">Welcome to Your Private Suite</p>
                    <p className="text-white/70">Enjoy your time together in this exclusive space</p>
                  </div>
                </div>

                {/* Vibe Call — voice chat scoped to this suite */}
                <div className="mb-6 flex justify-center">
                  <VibeCallRoom channel={`vibesuite-${selectedSuite.suite_id}`} />
                </div>

                {/* Interactive Activities */}
                <div className="grid grid-cols-3 gap-4">
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <Coffee className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Drinks</span>
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <Music className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Music</span>
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <Camera className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Photos</span>
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <Gift className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Gifts</span>
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">View</span>
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all text-center">
                    <Flame className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm font-bold">Vibe</span>
                  </button>
                </div>
              </div>

              {/* Chat Sidebar */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="text-pink-400" />
                  <h3 className="font-bold text-lg">Private Chat</h3>
                </div>
                
                <div className="space-y-3 mb-4 h-96 overflow-y-auto">
                  <div className="bg-white/5 p-3 rounded-lg">
                    <div className="text-xs text-pink-400 font-bold mb-1">You</div>
                    <div className="text-sm">Hey! This suite is amazing! 💕</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-400"
                  />
                  <button className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-lg transition-all">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default PrivateVibeSuites;
