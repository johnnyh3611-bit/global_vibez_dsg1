import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Heart, Radio, User, Wallet, Crown } from 'lucide-react';

const UnifiedNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [vibeCredits, setVibeCredits] = useState(1250);

  const navItems = [
    { id: 'lounge', label: 'Lounge', icon: Gamepad2, path: '/lounge', color: 'from-purple-500 to-pink-500' },
    { id: 'matchmaking', label: 'Match', icon: Heart, path: '/matchmaking', color: 'from-pink-500 to-rose-500', badge: '🔥' },
    { id: 'metahuman', label: 'MetaHuman', icon: Crown, path: '/metahuman-dealer', color: 'from-cyan-500 to-purple-500', badge: 'NEW' },
    { id: 'suites', label: 'Private Suites', icon: Heart, path: '/private-suites', color: 'from-pink-500 to-rose-500', badge: 'HOT' },
    { id: 'discover', label: 'Discover', icon: Heart, path: '/discover', color: 'from-pink-500 to-rose-500' },
    { id: 'live', label: 'Live', icon: Radio, path: '/live', color: 'from-cyan-500 to-blue-500' },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg sm:text-xl">GV</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-black text-lg leading-none tracking-tight">Global Vibez</h1>
              <p className="text-cyan-400 text-xs font-semibold">Social Gaming Hub</p>
            </div>
          </motion.div>

          {/* Main Navigation */}
          <div className="flex items-center gap-2 sm:gap-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <motion.button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative px-3 sm:px-6 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm transition-all ${
                    active 
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg` 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{item.label}</span>
                    {item.badge && (
                      <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Vibe Credits */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 sm:px-4 py-2 rounded-full cursor-pointer shadow-lg"
              onClick={() => navigate('/wallet')}
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white" />
                <span className="text-white font-black text-xs sm:text-sm">${vibeCredits}</span>
              </div>
            </motion.div>

            {/* Profile */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/profile')}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedNavigation;
