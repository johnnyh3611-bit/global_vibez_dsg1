import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, X, RefreshCw, Sparkles, Filter, MapPin, Loader, Wifi } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import VibeMatchCard from '../components/social/VibeMatchCard';
import VibeNotification from '../components/social/VibeNotification';
import { useSocialSocket } from '../hooks/useSocialSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DiscoverPage = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);

  // WebSocket for real-time social updates
  const { 
    isConnected, 
    onlineUsers, 
    onNewMatch, 
    onVibeReceived, 
    onSomeoneLikedYou,
    notifyVibeReceived 
  } = useSocialSocket('current_user', 'Demo User');

  // Fetch matches from backend
  useEffect(() => {
    fetchMatches();
  }, []);

  // Real-time match notifications
  useEffect(() => {
    const unsubMatch = onNewMatch((data) => {
      setNotification({
        type: 'match',
        title: '💕 New Match!',
        message: `You matched with someone! Compatibility: ${data.compatibility}%`
      });
      // Refresh matches to show the new match
      fetchMatches();
    });

    const unsubVibe = onVibeReceived((data) => {
      setNotification({
        type: 'vibe',
        title: '✨ Vibe Received!',
        message: data.message || `Someone sent you a ${data.vibe_type}!`
      });
    });

    const unsubLike = onSomeoneLikedYou((data) => {
      setNotification({
        type: 'vibe',
        title: '💝 Someone Liked You!',
        message: 'Keep swiping to find your match!'
      });
    });

    return () => {
      unsubMatch();
      unsubVibe();
      unsubLike();
    };
  }, [onNewMatch, onVibeReceived, onSomeoneLikedYou]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/social/matches?user_id=current_user&limit=10`);
      const data = await response.json();
      
      if (data.matches) {
        setPotentialMatches(data.matches);
      }
    } catch (error) {
      // console.error('Failed to fetch matches:', error);
      setNotification({
        type: 'vibe',
        title: 'Connection Error',
        message: 'Failed to load matches. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const currentMatch = potentialMatches[currentIndex];

  const handleAccept = async () => {
    setSwipeDirection('right');
    
    try {
      // Call backend API
      const response = await fetch(`${API_URL}/api/social/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'current_user',
          target_user_id: currentMatch.id,
          action: 'accept'
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'matched') {
        setNotification({
          type: 'match',
          title: 'It\'s a Match! 💕',
          message: `You and ${currentMatch.name} matched! Start vibing now.`
        });
      } else {
        setNotification({
          type: 'vibe',
          title: 'Liked!',
          message: `${currentMatch.name} will be notified!`
        });
      }
    } catch (error) {
      // console.error('Swipe error:', error);
    }
    
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  };

  const handleReject = () => {
    setSwipeDirection('left');
    
    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  };

  const handleSendVibe = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/send-vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: 'current_user',
          to_user_id: currentMatch.id,
          vibe_type: 'drink',
          message: 'Hey! Let\'s play together!'
        })
      });
      
      const data = await response.json();
      
      // Send real-time notification via WebSocket
      notifyVibeReceived(currentMatch.id, 'current_user', 'drink', 'Hey! Let\'s play together!');
      
      setNotification({
        type: 'vibe',
        title: 'Virtual Drink Sent! 🍹',
        message: data.message || `${currentMatch.name} will be notified of your gesture!`
      });
    } catch (error) {
      // console.error('Send vibe error:', error);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setSwipeDirection(null);
    fetchMatches(); // Reload matches
  };

  // Check if we've gone through all matches
  const noMoreMatches = !loading && currentIndex >= potentialMatches.length;
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        <UnifiedNavigation />
        <div className="pt-20 sm:pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-lg">Finding your perfect vibes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <UnifiedNavigation />

      {/* Main Content */}
      <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
            >
              Discover Your Vibe
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto flex items-center justify-center gap-2"
            >
              Find your match at the tables. Swipe to connect.
              {isConnected && (
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <Wifi className="w-4 h-4" />
                  {onlineUsers} online
                </span>
              )}
            </motion.p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Filters Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sticky top-24"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-purple-400" />
                  <h2 className="text-white font-black text-xl">Filters</h2>
                </div>

                {/* Distance */}
                <div className="mb-6">
                  <label className="text-white/80 text-sm font-bold mb-3 block">
                    Distance: <span className="text-purple-400">10 km</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    defaultValue="10"
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Age Range */}
                <div className="mb-6">
                  <label className="text-white/80 text-sm font-bold mb-3 block">
                    Age: <span className="text-purple-400">21-35</span>
                  </label>
                  <input
                    type="range"
                    min="18"
                    max="60"
                    defaultValue="35"
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Game Preferences */}
                <div className="mb-6">
                  <label className="text-white/80 text-sm font-bold mb-3 block">Game Interests</label>
                  <div className="flex flex-wrap gap-2">
                    {['Poker', 'Blackjack', 'Craps', 'Roulette', 'Slots'].map(game => (
                      <button
                        key={game}
                        className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-3 py-1 rounded-full text-white/80 text-xs font-semibold transition-all"
                      >
                        {game}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Online Only */}
                <div className="flex items-center justify-between">
                  <span className="text-white/80 text-sm font-bold">Show Online Only</span>
                  <div className="w-12 h-6 bg-purple-500 rounded-full flex items-center px-1 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Card Stack - Main */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-center min-h-[600px]">
                
                {noMoreMatches ? (
                  // No More Matches State
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-16 h-16 text-white" />
                    </div>
                    <h2 className="text-white font-black text-3xl mb-4">You've seen everyone!</h2>
                    <p className="text-white/60 text-lg mb-8">Check back later for new vibes.</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleReset}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black px-8 py-4 rounded-full flex items-center gap-2 mx-auto transition-all"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Start Over
                    </motion.button>
                  </motion.div>
                ) : (
                  // Match Card
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentMatch.id}
                      initial={{ scale: 0.9, opacity: 0, rotateY: -10 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1, 
                        rotateY: 0,
                        x: swipeDirection === 'left' ? -500 : swipeDirection === 'right' ? 500 : 0,
                        rotate: swipeDirection === 'left' ? -20 : swipeDirection === 'right' ? 20 : 0
                      }}
                      exit={{ 
                        scale: 0.8, 
                        opacity: 0,
                        x: swipeDirection === 'left' ? -500 : swipeDirection === 'right' ? 500 : 0
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="w-full flex justify-center"
                    >
                      <VibeMatchCard
                        match={currentMatch}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        onSendVibe={handleSendVibe}
                      />
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Progress Indicator */}
              {!noMoreMatches && (
                <div className="mt-8">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-white/60 text-sm">
                      {currentIndex + 1} / {potentialMatches.length}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentIndex + 1) / potentialMatches.length) * 100}%` }}
                      className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                      transition={{ type: 'spring', stiffness: 100 }}
                    />
                  </div>
                </div>
              )}

              {/* Keyboard Shortcuts Hint */}
              {!noMoreMatches && (
                <div className="mt-6 text-center">
                  <p className="text-white/40 text-xs">
                    Tip: Press ← to reject, → to accept, ↑ to send a vibe
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <VibeNotification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
};

export default DiscoverPage;
