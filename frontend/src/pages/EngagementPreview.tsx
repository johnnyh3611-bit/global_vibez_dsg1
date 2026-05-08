import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Trophy, Flame, Star, Zap, Gift, TrendingUp, Award, Target } from 'lucide-react';

export default function EngagementPreview() {
  const [showRewardsModal, setShowRewardsModal] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(3);

  // Demo data
  const notifications = [
    { id: 1, type: 'achievement', title: 'Achievement Unlocked! 🏆', message: "You earned 'First Victory'! +100 XP", time: '2m ago' },
    { id: 2, type: 'friend_request', title: 'New Friend Request', message: 'Alex wants to connect with you', time: '5m ago' },
    { id: 3, type: 'like', title: 'Your vibe is blowing up! 💫', message: 'Your post got 50 likes', time: '10m ago' },
  ];

  const stats = {
    level: 12,
    xp: 2450,
    next_level_xp: 3600,
    progress: 68,
    current_streak: 7,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 relative overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Demo Navbar with Engagement Components */}
      <nav className="relative z-50 bg-black/40 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Global Vibez DSG
          </div>

          {/* Engagement Components */}
          <div className="flex items-center gap-6">
            {/* Level Display */}
            <motion.div
              className="relative px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-cyan-500/50"
              whileHover={{ scale: 1.05 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(6, 182, 212, 0.3)',
                  '0 0 40px rgba(6, 182, 212, 0.6)',
                  '0 0 20px rgba(6, 182, 212, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Star className="w-8 h-8 text-yellow-400" fill="currentColor" />
                  <motion.div
                    className="absolute inset-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  >
                    <Zap className="w-3 h-3 text-cyan-400 absolute -top-1 -right-1" />
                  </motion.div>
                </div>
                <div>
                  <div className="text-xs text-cyan-300 font-semibold">LEVEL</div>
                  <div className="text-2xl font-bold text-white">{stats.level}</div>
                </div>
                <div className="ml-2">
                  <div className="text-xs text-gray-400 mb-1">
                    {stats.xp} / {stats.next_level_xp} XP
                  </div>
                  <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.progress}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-white/30"
                        animate={{ x: [-100, 200] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notification Bell */}
            <motion.button
              className="relative p-3 rounded-xl bg-gradient-to-r from-cyan-600/20 to-purple-600/20 border border-cyan-500/50"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotifications(!showNotifications)}
              animate={{
                boxShadow: unreadCount > 0
                  ? [
                      '0 0 20px rgba(239, 68, 68, 0.5)',
                      '0 0 40px rgba(239, 68, 68, 0.8)',
                      '0 0 20px rgba(239, 68, 68, 0.5)',
                    ]
                  : '0 0 20px rgba(6, 182, 212, 0.3)',
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Bell className="w-6 h-6 text-cyan-400" />
              {unreadCount > 0 && (
                <motion.div
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-black"
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                >
                  {unreadCount}
                </motion.div>
              )}
            </motion.button>

            {/* Streak Counter */}
            <motion.div
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/50"
              whileHover={{ scale: 1.05 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                  '0 0 40px rgba(249, 115, 22, 0.6)',
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-400" />
                <div>
                  <div className="text-xs text-orange-300">STREAK</div>
                  <div className="text-xl font-bold text-white">{stats.current_streak} Days</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Notifications Dropdown */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              className="absolute top-full right-4 mt-2 w-96 bg-black/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
            >
              <div className="p-4 border-b border-cyan-500/30">
                <h3 className="text-lg font-bold text-white">Notifications</h3>
                <p className="text-sm text-gray-400">{unreadCount} unread</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notif, idx) => (
                  <motion.div
                    key={notif.id}
                    className="p-4 border-b border-cyan-500/20 hover:bg-cyan-500/10 cursor-pointer transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        {notif.type === 'achievement' && <Trophy className="w-5 h-5 text-white" />}
                        {notif.type === 'friend_request' && <Star className="w-5 h-5 text-white" />}
                        {notif.type === 'like' && <Zap className="w-5 h-5 text-white" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white">{notif.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                        <p className="text-xs text-cyan-400 mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Daily Rewards Modal */}
      <AnimatePresence>
        {showRewardsModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRewardsModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative max-w-lg w-full bg-gradient-to-br from-purple-900/90 via-black/90 to-cyan-900/90 backdrop-blur-xl rounded-3xl border-2 border-cyan-500/50 shadow-2xl overflow-hidden"
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                {/* Confetti Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(40)].map((_, i) => (
                    <motion.div
                      key={_.id || _.name || `item-${i}`}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: ['#06b6d4', '#a855f7', '#fbbf24', '#f43f5e'][i % 4],
                        left: `${Math.random() * 100}%`,
                        top: '-10%',
                      }}
                      animate={{
                        y: [0, 600],
                        rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                        opacity: [1, 0],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        delay: Math.random() * 0.5,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </div>

                {/* Glow Effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Content */}
                <div className="relative z-10 p-8 text-center">
                  {/* Icon */}
                  <motion.div
                    className="mx-auto w-24 h-24 mb-6 relative"
                    animate={{
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-60" />
                    <div className="relative w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Gift className="w-12 h-12 text-white" />
                    </div>
                  </motion.div>

                  {/* Title */}
                  <motion.h2
                    className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Daily Reward! 🎁
                  </motion.h2>

                  <motion.p
                    className="text-cyan-300 text-lg mb-6"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Welcome back, champion!
                  </motion.p>

                  {/* Streak Display */}
                  <motion.div
                    className="mb-6 p-6 bg-black/40 rounded-2xl border border-orange-500/50"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Flame className="w-8 h-8 text-orange-400" />
                      <span className="text-3xl font-bold text-white">{stats.current_streak}</span>
                      <span className="text-xl text-gray-400">Day Streak!</span>
                    </div>

                    {/* Reward Breakdown */}
                    <div className="space-y-2 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Base Reward:</span>
                        <span className="text-cyan-400 font-bold">+50 XP</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Streak Bonus:</span>
                        <span className="text-purple-400 font-bold">+70 XP</span>
                      </div>
                      <div className="h-px bg-cyan-500/30 my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">Total:</span>
                        <motion.span
                          className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                        >
                          +120 XP
                        </motion.span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Progress Bar */}
                  <motion.div
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>Level {stats.level}</span>
                      <span>Level {stats.level + 1}</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full relative"
                        initial={{ width: `${stats.progress - 10}%` }}
                        animate={{ width: `${stats.progress}%` }}
                        transition={{ duration: 1, delay: 0.6 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{ x: [-100, 300] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Claim Button */}
                  <motion.button
                    className="w-full py-4 px-8 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl font-bold text-white text-lg shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRewardsModal(false)}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                        '0 0 40px rgba(168, 85, 247, 0.8)',
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Trophy className="w-6 h-6" />
                      Claim Reward
                      <Zap className="w-6 h-6" />
                    </span>
                  </motion.button>

                  <motion.p
                    className="mt-4 text-xs text-gray-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    Come back tomorrow to keep your streak going! 🔥
                  </motion.p>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area - Demo Info */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Engagement System Preview
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Maximum Cyberpunk Animations Demo
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {/* Feature Cards */}
            {[
              {
                icon: Bell,
                title: 'Real-Time Notifications',
                description: 'WebSocket-powered alerts with glow effects',
              },
              {
                icon: Gift,
                title: 'Daily Rewards',
                description: 'Auto-popup with confetti & particles',
              },
              {
                icon: TrendingUp,
                title: 'Level Progression',
                description: 'Animated XP bar with shimmer effect',
              },
              {
                icon: Flame,
                title: 'Streak System',
                description: 'Fire animations for daily engagement',
              },
            ].map((feature, idx) => (
              <motion.div
                key={`item-${idx}`}
                className="p-6 bg-gradient-to-br from-purple-900/30 to-cyan-900/30 backdrop-blur-xl rounded-2xl border border-cyan-500/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + idx * 0.1 }}
                whileHover={{ scale: 1.05, borderColor: 'rgba(6, 182, 212, 0.6)' }}
              >
                <feature.icon className="w-12 h-12 text-cyan-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-12 p-6 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <p className="text-cyan-300 text-sm">
              💡 <strong>Interact with the components:</strong> Click the notification bell, close/reopen the daily rewards modal, and observe the animations!
            </p>
          </motion.div>

          <motion.button
            className="mt-8 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowRewardsModal(true)}
          >
            Show Daily Rewards Again
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
