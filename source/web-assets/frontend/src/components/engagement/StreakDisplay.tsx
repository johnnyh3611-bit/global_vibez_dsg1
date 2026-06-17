import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function StreakDisplay() {
  const [streak, setStreak] = useState(0);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetchStreak();
  }, []);

  const fetchStreak = async () => {
    try {
      const response = await fetch(`${API}/api/engagement/profile/stats/${userId}`);
      const data = await response.json();
      if (data.success) {
        setStreak(data.stats.login_streak || 0);
      }
    } catch (error) {
      // console.error('Error fetching streak:', error);
    }
  };

  return (
    <motion.div
      className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/50 cursor-pointer"
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
          <div className="text-xs text-orange-300 font-semibold">STREAK</div>
          <div className="text-xl font-bold text-white whitespace-nowrap">
            {streak} {streak === 1 ? 'Day' : 'Days'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
