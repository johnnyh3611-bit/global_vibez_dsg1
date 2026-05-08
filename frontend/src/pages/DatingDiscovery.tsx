import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Gamepad2, Sparkles, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function DatingDiscovery() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [contentMatches, setContentMatches] = useState({});

  useEffect(() => {
    fetchProfiles();
    fetchContentMatches();
  }, []);

  const fetchContentMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-content-matching/find-matches`, {
        method: 'POST',
        
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 20  // Backend will get user from session
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const matchMap = {};
          data.matches.forEach(match => {
            matchMap[match.user_id] = match;
          });
          setContentMatches(matchMap);
        }
      }
    } catch (error) {
      // console.error('Failed to fetch content matches:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dating/discover?limit=20`, {
      });

      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles);
      }
    } catch (error) {
      // console.error('Failed to fetch profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (currentIndex >= profiles.length) return;

    const currentProfile = profiles[currentIndex];

    try {
      const response = await fetch(`${API_URL}/api/dating/like/${currentProfile.user_id}`, {
        method: 'POST',
        
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.is_match) {
          setMatchedUser(currentProfile);
          setShowMatch(true);
        } else {
          setCurrentIndex(currentIndex + 1);
        }
      }
    } catch (error) {
      // console.error('Failed to like profile:', error);
    }
  };

  const handlePass = () => {
    setCurrentIndex(currentIndex + 1);
  };

  const handlePlayGame = () => {
    navigate(`/dating/matches`);
  };

  const currentProfile = profiles[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-4">😢</div>
          <h2 className="text-3xl font-black text-white mb-4">No More Profiles</h2>
          <p className="text-white/60 mb-6">Check back later for more matches!</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold rounded-xl"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const profile = currentProfile.dating_profile || {};
  const avatar = currentProfile.avatar || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4 flex items-center justify-center">
      {/* Header */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-6 py-3 rounded-2xl border-2 border-fuchsia-500/50"
        >
          <h1 className="text-2xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text">
            💕 Discover & Play
          </h1>
        </motion.div>

        <motion.button
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => navigate('/dating/profile/setup')}
          className="bg-black/70 backdrop-blur-xl px-4 py-2 rounded-xl border-2 border-purple-500/50 text-purple-400 font-bold text-sm hover:border-purple-500 transition-all"
        >
          Edit Profile
        </motion.button>
      </div>

      {/* Profile Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0.8, opacity: 0, rotateY: 90 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="relative w-full max-w-md"
        >
          {/* Card */}
          <div className="relative bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-2xl rounded-3xl border-2 border-fuchsia-500 overflow-hidden shadow-2xl shadow-fuchsia-500/30">
            {/* Avatar/Photo Section */}
            <div className="relative h-96 bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30 flex items-center justify-center">
              {profile.photos && profile.photos[0] ? (
                <img src={profile.photos[0]} alt={currentProfile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-9xl">
                  {avatar.emoji || '🎮'}
                </div>
              )}
              
              {/* Content Match Badge */}
              {contentMatches[currentProfile.user_id] && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 left-4 bg-gradient-to-r from-cyan-600 to-blue-600 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-cyan-400/50 shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span className="text-white font-bold text-sm">
                      {contentMatches[currentProfile.user_id].compatibility_score}% Content Match
                    </span>
                  </div>
                </motion.div>
              )}
              
              {/* Online Indicator */}
              <div className="absolute top-4 right-4 bg-green-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Online
              </div>
            </div>

            {/* Profile Info */}
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-3xl font-black text-white mb-1">
                  {currentProfile.name}{profile.age && `, ${profile.age}`}
                </h2>
                {profile.location && (
                  <p className="text-white/60">📍 {profile.location}</p>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-white/80 mb-4 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* AI Match Insight */}
              {contentMatches[currentProfile.user_id]?.match_insight && (
                <div className="mb-4 p-4 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 backdrop-blur-sm border border-cyan-500/30 rounded-xl">
                  <p className="text-sm font-bold text-cyan-300 mb-2">✨ AI Match Insight</p>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {contentMatches[currentProfile.user_id].match_insight}
                  </p>
                  {contentMatches[currentProfile.user_id].shared_interests?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {contentMatches[currentProfile.user_id].shared_interests.map((interest, idx) => (
                        <span key={`shared_interests-${idx}`} className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full">
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Interests */}
              {profile.interests && profile.interests.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold text-fuchsia-400 mb-2">💫 Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, idx) => (
                      <span
                        key={`interests-${idx}`}
                        className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs text-white border border-white/20"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorite Games */}
              {profile.favorite_games && profile.favorite_games.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Favorite Games
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.favorite_games.map((game, idx) => (
                      <span
                        key={game.id || `favorite_games-${idx}`}
                        className="px-3 py-1 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-sm rounded-full text-xs text-cyan-300 border border-cyan-500/30"
                      >
                        {game}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {/* Pass Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePass}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/50 border-2 border-white/20"
            >
              <X className="w-8 h-8 text-white" />
            </motion.button>

            {/* Super Like (Play Game) */}
            <motion.button
              whileHover={{ scale: 1.15, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                handleLike();
                // Could also immediately launch game invite
              }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/50 border-4 border-white/30"
            >
              <Gamepad2 className="w-10 h-10 text-white" />
            </motion.button>

            {/* Like Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center justify-center shadow-xl shadow-fuchsia-500/50 border-2 border-white/20"
            >
              <Heart className="w-8 h-8 text-white fill-white" />
            </motion.button>
          </div>

          {/* Button Labels */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <p className="text-xs text-white/40 w-16 text-center">Pass</p>
            <p className="text-xs text-white/60 w-20 text-center font-bold">Play Game!</p>
            <p className="text-xs text-white/40 w-16 text-center">Like</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Match Modal */}
      <AnimatePresence>
        {showMatch && matchedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="relative max-w-md w-full p-8 text-center"
            >
              {/* Celebration Effect */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-9xl mb-6"
              >
                🎉
              </motion.div>

              <h2 className="text-5xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text mb-4">
                It's a Match!
              </h2>
              <p className="text-2xl text-white mb-8">
                You and {matchedUser.name} liked each other!
              </p>

              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayGame}
                  className="w-full px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-lg font-black rounded-xl flex items-center justify-center gap-3 shadow-2xl shadow-cyan-500/50"
                >
                  <Gamepad2 className="w-6 h-6" />
                  Play Game Together
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowMatch(false);
                    setCurrentIndex(currentIndex + 1);
                  }}
                  className="w-full px-8 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/20"
                >
                  Keep Swiping
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
