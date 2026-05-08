// Quick Access Menu for All Game Features
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Gamepad2, 
  Trophy, 
  Bot, 
  Settings, 
  Users, 
  Zap,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickAccessMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: Gamepad2,
      label: 'Play Games',
      description: '24 multiplayer games',
      color: 'from-cyan-600 to-blue-600',
      path: '/http-multiplayer',
      badge: '24'
    },
    {
      icon: Trophy,
      label: 'Tournaments',
      description: 'Compete for prizes',
      color: 'from-yellow-600 to-orange-600',
      path: '/tournament-hub',
      badge: 'New'
    },
    {
      icon: Bot,
      label: 'AI Practice',
      description: 'Practice with AI',
      color: 'from-purple-600 to-indigo-600',
      path: '/ai-practice',
      badge: '4 Levels'
    },
    {
      icon: Users,
      label: 'Cultural Games',
      description: '10 global games',
      color: 'from-green-600 to-emerald-600',
      path: '/http-multiplayer',
      badge: '10'
    },
    {
      icon: Zap,
      label: 'Quick Match',
      description: 'Find game instantly',
      color: 'from-red-600 to-pink-600',
      path: '/http-multiplayer',
      badge: 'Fast'
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Sound & preferences',
      color: 'from-gray-600 to-slate-600',
      path: '/settings',
      badge: null
    }
  ];

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-full p-4 shadow-2xl"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Menu className="w-6 h-6" />
      </motion.button>

      {/* Full Screen Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-6"
            onClick={() => setIsOpen(false)}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-white hover:bg-white/10 p-3 rounded-full"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Menu Grid */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-6xl w-full"
            >
              <div className="text-center mb-12">
                <h2 className="text-6xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text mb-4">
                  Quick Access
                </h2>
                <p className="text-xl text-gray-400">Choose your adventure</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map((item, index) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      navigate(item.path);
                      setIsOpen(false);
                    }}
                    className="relative bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/10 rounded-2xl p-8 text-left overflow-hidden group"
                  >
                    {/* Background Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-20 transition-opacity`} />

                    {/* Badge */}
                    {item.badge && (
                      <div className={`absolute top-4 right-4 bg-gradient-to-r ${item.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                        {item.badge}
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`mb-4 w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {item.label}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {item.description}
                    </p>

                    {/* Hover Arrow */}
                    <div className="mt-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
