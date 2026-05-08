/**
 * ProgressionBar - XP and Level Display Component
 * Shows current level, XP progress, and level-up animations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, Award } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ProgressionBar({ userId, compact = false }) {
  const [progression, setProgression] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (!userId) return;

    fetchProgression();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProgression, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchProgression = async () => {
    try {
      const response = await fetch(`${API_URL}/api/progression/${userId}`);
      const data = await response.json();
      
      // Check for level up
      if (progression && data.level > progression.level) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 5000);
      }
      
      setProgression(data);
    } catch (error) {
      // console.error('Failed to fetch progression:', error);
    }
  };

  if (!progression) return null;

  const levelProgress = progression.next_level?.progress_percentage || 0;

  // Compact version (for header/navbar)
  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-full px-4 py-2">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold">Lvl {progression.level}</span>
        </div>
        <div className="w-24 h-2 bg-black/40 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${levelProgress}%` }}
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
          />
        </div>
        <span className="text-gray-300 text-xs">{Math.round(levelProgress)}%</span>
      </div>
    );
  }

  // Full version (for dashboard/profile)
  return (
    <div className="relative">
      {showLevelUp && <Confetti width={width} height={height} recycle={false} numberOfPieces={200} />}
      
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white px-12 py-8 rounded-3xl shadow-2xl border-4 border-yellow-300">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <Zap className="w-16 h-16 mx-auto mb-4" />
                <h2 className="text-4xl font-black mb-2">LEVEL UP!</h2>
                <p className="text-6xl font-black">{progression.level}</p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-4 border-yellow-300 shadow-lg">
                <span className="text-2xl font-black text-white">{progression.level}</span>
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-white flex items-center justify-center"
              >
                <TrendingUp className="w-4 h-4 text-white" />
              </motion.div>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Level {progression.level}</h3>
              <p className="text-gray-300 text-sm">{progression.total_xp.toLocaleString()} Total XP</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Next Level</p>
            <p className="text-white font-bold">
              {progression.next_level?.current_level_xp || 0} / {progression.next_level?.xp_needed || 0} XP
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-4 bg-black/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 relative"
            >
              <motion.div
                className="absolute inset-0 bg-white/30"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </motion.div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400 text-xs">{Math.round(levelProgress)}% to Level {progression.level + 1}</span>
            <span className="text-purple-300 text-xs font-bold">
              {progression.next_level?.xp_needed - progression.next_level?.current_level_xp || 0} XP needed
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-black/20 rounded-xl p-3 text-center">
            <Award className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{progression.achievements?.length || 0}</p>
            <p className="text-gray-400 text-xs">Achievements</p>
          </div>
          <div className="bg-black/20 rounded-xl p-3 text-center">
            <Zap className="w-6 h-6 text-orange-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{progression.streak || 0}</p>
            <p className="text-gray-400 text-xs">Win Streak</p>
          </div>
          <div className="bg-black/20 rounded-xl p-3 text-center">
            <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{Object.keys(progression.daily_wins || {}).length}</p>
            <p className="text-gray-400 text-xs">Days Played</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
