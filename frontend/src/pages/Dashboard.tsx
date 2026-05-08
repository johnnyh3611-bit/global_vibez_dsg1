import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Heart, Radio, TrendingUp, Users, Zap, Star, Trophy, Crown, Sparkles } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import MetaHumanDealer from '../components/MetaHumanDealer';
import ChairHolderVoteBanner from '../components/dashboard/ChairHolderVoteBanner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [onlineUsers] = useState(12847);
  const [activeMatches] = useState(342);
  const [liveStreams] = useState(24);

  const featuredGames = [
    { id: 'vibez654', name: 'Vibez 654', image: '🎲', route: '/dice', players: 2891, hot: true, new: true },
    { id: 'blackjack', name: 'Blackjack AAA', image: '🃏', route: '/practice/blackjack', players: 2143, hot: true },
    { id: 'poker', name: 'VIP Poker', image: '🎴', route: '/practice/poker', players: 1876, hot: true },
    { id: 'roulette', name: 'Roulette Royale', image: '🎡', route: '/practice/roulette', players: 1523, hot: false },
  ];

  const vibeMatches = [
    { id: 1, name: 'Alex', age: 26, compatibility: 94, image: '👩', status: 'At Poker Table', online: true },
    { id: 2, name: 'Jordan', age: 28, compatibility: 89, image: '🧑', status: 'Playing Craps', online: true },
    { id: 3, name: 'Sam', age: 25, compatibility: 87, image: '👨', status: 'In Lounge', online: true },
  ];

  const liveFeeds = [
    { id: 1, title: 'DJ Set: Neon Nights', host: 'DJ Vibez', viewers: 847, image: '🎧' },
    { id: 2, title: 'High Stakes Poker', host: 'ProGamer', viewers: 1243, image: '🎮' },
    { id: 3, title: 'Craps Championship', host: 'LuckyDice', viewers: 621, image: '🏆' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <UnifiedNavigation />

      {/* Chair-holder votes (only visible to chair holders with open polls) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <ChairHolderVoteBanner />
      </div>

      {/* MetaHuman Dealer Hero Section */}
      <div className="pt-8 pb-4">
        <MetaHumanDealer 
          dealerType="nova" 
          gameType="default"
          gameState={{ isDealing: false }}
          size="large"
        />
      </div>

      {/* Hero Section */}
      <div className="pt-12 pb-12 px-4 sm:px-6"
        style={{
          background: 'linear-gradient(180deg, rgba(107, 33, 168, 0.1) 0%, #0A0A0A 100%)'
        }}
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Choose Your Game
            </h2>
            <p className="text-white/60 text-lg">
              Premium AAA casino experience awaits
            </p>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-12"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 text-center">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-white font-black text-xl sm:text-3xl">{onlineUsers.toLocaleString()}</p>
              <p className="text-white/60 text-xs sm:text-sm">Online Now</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 text-center">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-pink-400 mx-auto mb-2" />
              <p className="text-white font-black text-xl sm:text-3xl">{activeMatches}</p>
              <p className="text-white/60 text-xs sm:text-sm">Active Matches</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 text-center">
              <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-white font-black text-xl sm:text-3xl">{liveStreams}</p>
              <p className="text-white/60 text-xs sm:text-sm">Live Streams</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Gaming Lounge - Main Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                Gaming Lounge
              </h2>
              <button className="text-cyan-400 hover:text-cyan-300 font-bold text-sm transition-colors">
                View All →
              </button>
            </div>

            {/* MetaHuman Dealer Featured Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              onClick={() => navigate('/metahuman-dealer')}
              className="relative bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-6 cursor-pointer group overflow-hidden mb-6"
            >
              <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Sparkles className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-bold">NEW</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-2xl mb-1 flex items-center gap-2">
                    MetaHuman Dealer Tables
                    <Crown className="w-5 h-5 text-amber-400" />
                  </h3>
                  <p className="text-cyan-300 text-sm mb-2">Experience next-gen AI dealers with spatial awareness</p>
                  <div className="flex items-center gap-4 text-white/80 text-xs">
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Premium Tables
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> Poker • Bid Whist • Baccarat
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 rounded-full blur-3xl" />
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-4">
              {featuredGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(game.route)}
                  className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6 cursor-pointer group overflow-hidden"
                >
                  {game.hot && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-bold">HOT</span>
                    </div>
                  )}
                  
                  <div className="text-6xl mb-4">{game.image}</div>
                  <h3 className="text-white font-black text-xl mb-2">{game.name}</h3>
                  <div className="flex items-center gap-2 text-white/60">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{game.players.toLocaleString()} playing</span>
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-purple-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              ))}
            </div>

            {/* Live Streams */}
            <div className="mt-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2 mb-4">
                <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                Live Now
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {liveFeeds.map((feed) => (
                  <motion.div
                    key={feed.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 cursor-pointer group"
                  >
                    <div className="text-4xl mb-3">{feed.image}</div>
                    <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{feed.title}</h4>
                    <p className="text-white/60 text-xs mb-2">{feed.host}</p>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-white/80 text-xs font-bold">{feed.viewers.toLocaleString()} viewers</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Vibe Matches - Sidebar */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-pink-400" />
                Vibe Matches
              </h2>
              <button 
                onClick={() => navigate('/discover')}
                className="text-pink-400 hover:text-pink-300 font-bold text-sm transition-colors"
              >
                Discover →
              </button>
            </div>

            {vibeMatches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 backdrop-blur-xl border border-pink-500/20 rounded-2xl p-4 cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-3xl">
                      {match.image}
                    </div>
                    {match.online && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#0A0A0A] rounded-full" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold">{match.name}, {match.age}</h3>
                      <div className="flex items-center gap-1 bg-pink-500/20 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 text-pink-400" />
                        <span className="text-pink-400 text-xs font-bold">{match.compatibility}%</span>
                      </div>
                    </div>
                    <p className="text-white/60 text-sm mb-2">{match.status}</p>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold py-2 rounded-lg transition-all">
                        Send Vibe
                      </button>
                      <button className="px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all">
                        🍹
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/discover')}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-black py-4 rounded-xl shadow-lg transition-all"
            >
              Discover More Matches
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
