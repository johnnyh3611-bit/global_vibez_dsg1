import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Heart, MessageCircle, Sparkles, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MatchmakingModal } from '@/components/multiplayer/MatchmakingModal';
import { TableForTwoModal } from '@/components/TableForTwoModal';
import { DatePlanModal } from '@/components/DatePlanModal';
import { VibeScoreCompact } from '@/components/VibeScoreBadge';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GAME_OPTIONS = [
  { id: 'uno', name: 'UNO', emoji: '🎴', vibe: 'Fun & Casual' },
  { id: 'poker', name: 'Poker', emoji: '♠️', vibe: 'Strategic' },
  { id: 'chess', name: 'Chess', emoji: '♟️', vibe: 'Intelligent' },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '❌', vibe: 'Quick & Easy' },
  { id: 'hearts', name: 'Hearts', emoji: '♥️', vibe: 'Romantic' },
  { id: 'checkers', name: 'Checkers', emoji: '🟤', vibe: 'Classic' }
];

export function DatingMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showGameSelect, setShowGameSelect] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showTableForTwo, setShowTableForTwo] = useState(false);
  const [tableForTwoMatch, setTableForTwoMatch] = useState(null);
  const [showDatePlanner, setShowDatePlanner] = useState(false);
  const [datePlannerMatch, setDatePlannerMatch] = useState(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dating/matches`, {
      });

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches);
      }
    } catch (error) {
      // console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendGameInvite = async (match, gameType) => {
    try {
      const response = await fetch(`${API_URL}/api/dating/invite/game`, {
        method: 'POST',
        
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to_user_id: match.user.user_id,
          game_type: gameType,
          message: `Hey! Let's play ${GAME_OPTIONS.find(g => g.id === gameType)?.name} together! 🎮`
        })
      });

      if (response.ok) {
        setInviteSent(true);
        setTimeout(() => {
          setShowGameSelect(false);
          setInviteSent(false);
          setSelectedMatch(null);
        }, 2000);
      }
    } catch (error) {
      // console.error('Failed to send invite:', error);
    }
  };

  const handleVideoCall = async (match) => {
    try {
      const response = await fetch(`${API_URL}/api/video-call/initiate`, {
        method: 'POST',
        
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: match.user.user_id,  // Backend can get user from session
          callee_id: match.user.user_id,
          call_type: 'video'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Navigate to video call page
        navigate(`/video-call/${data.call_id}?other_user=${match.user.user_id}&caller=true`);
      } else {
        alert(data.message || 'Failed to initiate call');
      }
    } catch (error) {
      // console.error('Failed to initiate call:', error);
      alert('Failed to initiate call');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text mb-4">
            💕 Your Matches
          </h1>
          <p className="text-xl text-white/60">
            {matches.length} people ready to play with you!
          </p>
        </motion.div>
      </div>

      {/* Matches Grid */}
      <div className="max-w-6xl mx-auto">
        {matches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-2xl font-bold text-white mb-4">No matches yet</h2>
            <p className="text-white/60 mb-6">Start swiping to find gaming partners!</p>
            <button
              onClick={() => navigate('/dating/discover')}
              className="px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold rounded-xl"
            >
              Discover People
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match, idx) => {
              const user = match.user;
              const profile = user.dating_profile || {};
              const avatar = user.avatar || {};
              const chemistryScore = match.chemistry_score || 0;

              return (
                <motion.div
                  key={match.match_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-fuchsia-500/30 overflow-hidden hover:border-fuchsia-500 transition-all group"
                >
                  {/* Avatar/Photo */}
                  <div className="relative h-64 bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30 flex items-center justify-center">
                    {profile.photos && profile.photos[0] ? (
                      <img src={profile.photos[0]} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-7xl">
                        {avatar.emoji || '🎮'}
                      </div>
                    )}

                    {/* Chemistry Badge */}
                    {chemistryScore > 0 && (
                      <div className="absolute top-4 right-4 bg-gradient-to-r from-pink-600 to-fuchsia-600 backdrop-blur-sm px-3 py-2 rounded-xl text-sm font-black text-white border-2 border-white/30 shadow-lg">
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          {chemistryScore}% Match
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <h3 className="text-2xl font-black text-white mb-1">
                      {user.name}{profile.age && `, ${profile.age}`}
                    </h3>
                    {profile.location && (
                      <p className="text-sm text-white/60 mb-3">📍 {profile.location}</p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-1 text-cyan-400">
                        <Gamepad2 className="w-4 h-4" />
                        <span>{match.games_played || 0} games</span>
                      </div>
                      {profile.favorite_games && profile.favorite_games.length > 0 && (
                        <div className="text-white/60">
                          🎮 {profile.favorite_games[0]}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTableForTwoMatch(match);
                          setShowTableForTwo(true);
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-fuchsia-500/50 transition-all"
                      >
                        <Gamepad2 className="w-5 h-5" />
                        🎮 Play a Game
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setDatePlannerMatch(match);
                          setShowDatePlanner(true);
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/50 transition-all"
                      >
                        🤖 AI Date Planner
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleVideoCall(match)}
                        data-testid="video-call-btn"
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/50 transition-all"
                      >
                        <Video className="w-5 h-5" />
                        Video Call
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl flex items-center justify-center gap-2 border border-white/20"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Message
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table for Two Modal */}
      <TableForTwoModal
        isOpen={showTableForTwo}
        onClose={() => {
          setShowTableForTwo(false);
          setTableForTwoMatch(null);
        }}
        match={tableForTwoMatch}
        onInviteSent={(data) => {
          alert(`🎮 Game invite sent! ${tableForTwoMatch?.username || 'Your match'} has 15 minutes to accept.`);
        }}
      />

      {/* AI Date Planner Modal */}
      <DatePlanModal
        isOpen={showDatePlanner}
        onClose={() => {
          setShowDatePlanner(false);
          setDatePlannerMatch(null);
        }}
        match={datePlannerMatch}
      />

      {/* Game Selection Modal */}
      {showGameSelect && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-2xl bg-gradient-to-br from-purple-900/90 to-black/90 backdrop-blur-xl border-2 border-fuchsia-500 rounded-3xl p-8"
          >
            {inviteSent ? (
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-7xl mb-4"
                >
                  ✅
                </motion.div>
                <h3 className="text-3xl font-black text-white mb-2">Invite Sent!</h3>
                <p className="text-white/60">They'll be notified soon 🎮</p>
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-black text-white mb-2 text-center">
                  Choose a Game
                </h3>
                <p className="text-white/60 text-center mb-6">
                  Pick a game to play with {selectedMatch.user.name}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {GAME_OPTIONS.map((game) => (
                    <motion.button
                      key={game.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSendGameInvite(selectedMatch, game.id)}
                      className="relative bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-purple-500/30 hover:border-fuchsia-500 p-6 transition-all group"
                    >
                      <div className="text-5xl mb-3">{game.emoji}</div>
                      <h4 className="text-lg font-black text-white mb-1">{game.name}</h4>
                      <p className="text-xs text-white/40">{game.vibe}</p>
                    </motion.button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowGameSelect(false);
                    setSelectedMatch(null);
                  }}
                  className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border border-white/20"
                >
                  Cancel
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
