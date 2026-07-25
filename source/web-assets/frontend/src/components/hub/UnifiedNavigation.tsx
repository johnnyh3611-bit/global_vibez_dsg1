import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Heart, Radio, User, Wallet, Crown, DollarSign, Phone } from 'lucide-react';
import { formatCoins } from '@/utils/currency';
import { triggerHaptic } from '@/hooks/useGestures';
import VibezTabStyle from '@/components/ui/VibezTabStyle';

const NAV_ITEMS = [
  { id: 'lounge', label: 'Lounge', icon: Gamepad2, path: '/lounge' },
  { id: 'matchmaking', label: 'Match', icon: Heart, path: '/matchmaking', badge: '🔥' },
  { id: 'metahuman', label: 'MetaHuman', icon: Crown, path: '/metahuman-dealer', badge: 'NEW' },
  { id: 'suites', label: 'Private Suites', icon: Heart, path: '/private-suites', badge: 'HOT' },
  { id: 'discover', label: 'Discover', icon: Heart, path: '/discover' },
  { id: 'live', label: 'Live', icon: Radio, path: '/live' },
  { id: 'earn', label: 'Earn', icon: DollarSign, path: '/earn', tone: 'earn' as const },
];

const UnifiedNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [vibeCredits, setVibeCredits] = useState<number | null>(null);

  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL;
    const token = localStorage.getItem('auth_token');
    if (!API || !token) return;
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.credits_balance != null) {
          setVibeCredits(Number(data.credits_balance));
        }
      })
      .catch(() => { /* leave fallback hidden */ });
  }, []);

  const activeId = useMemo(() => {
    const hit = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
    return hit?.id ?? '';
  }, [location.pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-fuchsia-500 via-pink-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
              <span className="text-white font-black text-lg sm:text-xl">GV</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-black text-lg leading-none tracking-tight">Global Vibez</h1>
              <p className="text-fuchsia-300 text-xs font-semibold">Social Gaming Hub</p>
            </div>
          </motion.div>

          {/* Main Navigation — My Vibez tray */}
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            <VibezTabStyle
              ariaLabel="Hub navigation"
              variant="pills"
              testId="unified-nav-tabs"
              value={activeId}
              onChange={(id) => {
                const item = NAV_ITEMS.find((n) => n.id === id);
                if (!item) return;
                triggerHaptic(item.tone === 'earn' ? 'medium' : 'light');
                navigate(item.path);
              }}
              options={NAV_ITEMS.map((item) => ({
                value: item.id,
                label: item.label,
                icon: item.icon,
                badge: item.badge,
                tone: item.tone,
                testId: `unified-nav-${item.id}`,
              }))}
            />
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <motion.button
              title="Vibe Phone"
              data-testid="unified-nav-vibe-phone"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                triggerHaptic('light');
                navigate('/vibe-phone');
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </motion.button>

            {/* Vibe Credits */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              title="Wallet"
              className="bg-gradient-to-r from-amber-500 to-yellow-500 px-3 sm:px-4 py-2 rounded-full cursor-pointer shadow-lg"
              onClick={() => navigate('/wallet')}
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white" />
                <span className="text-white font-black text-xs sm:text-sm">
                  {vibeCredits != null ? formatCoins(vibeCredits, { compact: true }) : '₵—'}
                </span>
              </div>
            </motion.div>

            {/* Profile */}
            <motion.button
              title="Profile"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/me')}
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
