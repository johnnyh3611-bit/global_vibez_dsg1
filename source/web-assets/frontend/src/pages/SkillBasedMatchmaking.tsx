import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Gamepad2, Trophy, Star, Send, Check, X, Zap, Target } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function SkillBasedMatchmaking() {
  const [currentUser, setCurrentUser] = useState({ id: 'demo_user', name: 'You' });
  const [matches, setMatches] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(true);

  useEffect(() => {
    fetchUserProfile();
    fetchMatches();
    fetchPendingRequests();
    fetchActiveMatches();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/profile/${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setUserProfile(data.profile);
        setShowProfileSetup(false);
      }
    } catch (error) {

    }
  };

  const createProfile = async (profileData) => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          name: currentUser.name,
          ...profileData
        })
      });
      const data = await response.json();
      if (data.success) {
        setUserProfile(data.profile);
        setShowProfileSetup(false);
        fetchMatches();
      }
    } catch (error) {
      // console.error('Failed to create profile:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/find-matches/${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setMatches(data.matches);
      }
    } catch (error) {
      // console.error('Failed to fetch matches:', error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/requests/${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setPendingRequests(data.requests);
      }
    } catch (error) {
      // console.error('Failed to fetch requests:', error);
    }
  };

  const fetchActiveMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/matches/${currentUser.id}`);
      const data = await response.json();
      if (data.success) {
        setActiveMatches(data.matches);
      }
    } catch (error) {
      // console.error('Failed to fetch active matches:', error);
    }
  };

  const sendMatchRequest = async (toUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/send-request?from_user_id=${currentUser.id}&to_user_id=${toUserId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert('Match request sent! 💌');
      }
    } catch (error) {
      // console.error('Failed to send request:', error);
    }
  };

  const respondToRequest = async (requestId, accept) => {
    try {
      const response = await fetch(`${API_URL}/api/matchmaking/respond-request/${requestId}?accept=${accept}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        fetchPendingRequests();
        if (accept) {
          fetchActiveMatches();
          alert('Match accepted! 🎉');
        }
      }
    } catch (error) {
      // console.error('Failed to respond:', error);
    }
  };

  if (showProfileSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-900 via-purple-900 to-indigo-900 text-white">
        <UnifiedNavigation />
        <div className="pt-20 p-8">
          <div className="max-w-2xl mx-auto">
            <ProfileSetup onComplete={createProfile} />
          </div>
        </div>
      </div>
    );
  }

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
              <span className="text-pink-400 text-sm font-bold">SKILL-BASED MATCHMAKING</span>
            </motion.div>
            
            <h1 className="text-6xl font-black mb-4">
              Find Your <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Perfect Match</span>
            </h1>
            
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Connect with players who match your skill level and gaming preferences
            </p>
          </div>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50 rounded-2xl p-6 mb-8"
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Zap className="text-amber-400" />
                Pending Requests ({pendingRequests.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {pendingRequests.map(request => (
                  <div key={request.request_id} className="bg-black/30 rounded-xl p-4">
                    <p className="text-sm text-white/80 mb-3">{request.message}</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => respondToRequest(request.request_id, true)}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(request.request_id, false)}
                        className="flex-1 bg-white/10 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Suggested Matches */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Target className="text-purple-400" />
              Your Best Matches ({matches.length})
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map(({ user, match_score }) => (
                <MatchCard
                  key={user.user_id}
                  user={user}
                  matchScore={match_score}
                  onSendRequest={() => sendMatchRequest(user.user_id)}
                />
              ))}
            </div>

            {matches.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <Heart className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/50 text-lg">No matches found yet. Play more games to find compatible players!</p>
              </div>
            )}
          </div>

          {/* Active Matches */}
          {activeMatches.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Star className="text-cyan-400" />
                Your Connections ({activeMatches.length})
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeMatches.map(match => (
                  <div key={match.request_id} className="bg-white/10 border border-cyan-400/50 rounded-2xl p-6">
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">💚</div>
                      <h3 className="text-xl font-bold">Matched!</h3>
                    </div>
                    <button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 rounded-lg font-bold">
                      Play Together
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ user, matchScore, onSendRequest }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      className="bg-white/10 border border-white/20 rounded-2xl p-6 hover:border-pink-400/50 transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold">{user.name}</h3>
          <p className="text-sm text-white/70">{user.age} years old</p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-black text-pink-400">
            {Math.round(matchScore.compatibility_score)}%
          </div>
          <div className="text-xs text-white/60">Match</div>
        </div>
      </div>

      <p className="text-sm text-white/80 mb-4">{user.bio || "Gamer looking for connections"}</p>

      <div className="mb-4">
        <div className="text-xs text-white/60 mb-2">Favorite Games:</div>
        <div className="flex flex-wrap gap-2">
          {user.favorite_games?.slice(0, 3).map((game, idx) => (
            <span key={`game-${user.id}-${game}-${idx}`} className="bg-purple-500/30 px-2 py-1 rounded text-xs">
              {game}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="text-center bg-blue-500/20 rounded p-2">
          <div className="text-white/60">Game</div>
          <div className="font-bold text-blue-400">{Math.round(matchScore.game_compatibility)}%</div>
        </div>
        <div className="text-center bg-green-500/20 rounded p-2">
          <div className="text-white/60">Skill</div>
          <div className="font-bold text-green-400">{Math.round(matchScore.skill_compatibility)}%</div>
        </div>
        <div className="text-center bg-purple-500/20 rounded p-2">
          <div className="text-white/60">Prefs</div>
          <div className="font-bold text-purple-400">{Math.round(matchScore.preference_match)}%</div>
        </div>
      </div>

      <button
        onClick={onSendRequest}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform"
      >
        <Send className="w-4 h-4" />
        Send Match Request
      </button>
    </motion.div>
  );
}

function ProfileSetup({ onComplete }) {
  const [age, setAge] = useState(25);
  const [bio, setBio] = useState('');
  const [favoriteGames, setFavoriteGames] = useState([]);
  const [lookingFor, setLookingFor] = useState('dating');

  const gameOptions = ['blackjack', 'poker', 'bid_whist', 'baccarat', 'roulette'];

  const handleSubmit = () => {
    onComplete({
      age,
      bio,
      favorite_games: favoriteGames,
      skill_scores: {},
      total_games_played: 0,
      win_rate: 0,
      preferences: {
        age_min: 18,
        age_max: 99,
        preferred_games: favoriteGames,
        skill_level_min: 1,
        skill_level_max: 10,
        looking_for: lookingFor
      }
    });
  };

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-8">
      <h2 className="text-3xl font-bold mb-6 text-center">Complete Your Profile</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold mb-2">Age: {age}</label>
          <input
            type="range"
            min="18"
            max="99"
            value={age}
            onChange={(e) => setAge(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:border-pink-400"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Favorite Games</label>
          <div className="grid grid-cols-2 gap-3">
            {gameOptions.map(game => (
              <button
                key={game}
                onClick={() => setFavoriteGames(prev => 
                  prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
                )}
                className={`py-2 px-4 rounded-lg font-bold transition-all ${
                  favoriteGames.includes(game)
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {game}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">Looking For</label>
          <div className="grid grid-cols-3 gap-3">
            {['friendship', 'dating', 'gaming_partner'].map(option => (
              <button
                key={option}
                onClick={() => setLookingFor(option)}
                className={`py-2 px-4 rounded-lg font-bold transition-all ${
                  lookingFor === option
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {option.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={favoriteGames.length === 0}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 px-8 py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Matching! 💕
        </button>
      </div>
    </div>
  );
}

export default SkillBasedMatchmaking;
