import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Gift, Users, Trophy, X } from 'lucide-react';

const VibeNotification = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const icons = {
    match: <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />,
    vibe: <Gift className="w-6 h-6 text-amber-400" />,
    invite: <Users className="w-6 h-6 text-cyan-400" />,
    win: <Trophy className="w-6 h-6 text-yellow-400" />,
  };

  const gradients = {
    match: 'from-pink-500 to-rose-500',
    vibe: 'from-amber-500 to-yellow-500',
    invite: 'from-cyan-500 to-blue-500',
    win: 'from-yellow-500 to-orange-500',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: -100, x: '-50%' }}
        className="fixed top-24 left-1/2 z-50 w-full max-w-md px-4"
      >
        <div className={`bg-gradient-to-r ${gradients[notification.type] || gradients.vibe} p-1 rounded-2xl shadow-2xl`}>
          <div className="bg-[#0A0A0A] rounded-2xl p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {icons[notification.type] || icons.vibe}
              </div>
              
              <div className="flex-1">
                <h4 className="text-white font-bold text-sm mb-1">{notification.title}</h4>
                <p className="text-white/80 text-xs">{notification.message}</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="flex-shrink-0 w-6 h-6 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VibeNotification;
