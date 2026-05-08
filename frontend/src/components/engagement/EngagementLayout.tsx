
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import NotificationBell from '@/components/engagement/NotificationBell';
import LevelDisplay from '@/components/engagement/LevelDisplay';
import StreakDisplay from '@/components/engagement/StreakDisplay';
import DailyRewardsModal from '@/components/engagement/DailyRewardsModal';

export default function EngagementLayout({ children }) {
  const location = useLocation();
  const [showEngagement, setShowEngagement] = useState(false);
  
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('token');

  useEffect(() => {
    // Show engagement UI only on protected routes (when user is logged in)
    const publicRoutes = ['/', '/signup', '/login', '/demo', '/modern-games', '/rides', '/game-demo', '/engagement-preview'];
    const isPublicRoute = publicRoutes.includes(location.pathname);
    
    setShowEngagement(Boolean(!isPublicRoute && userId && token));
  }, [location.pathname, userId, token]);

  if (!showEngagement) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Engagement Navbar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Global Vibez DSG
            </div>

            {/* Engagement Components */}
            <div className="flex items-center gap-4">
              <LevelDisplay />
              <NotificationBell />
              <StreakDisplay />
            </div>
          </div>
        </div>
      </div>

      {/* Content with padding for fixed navbar */}
      <div className="pt-20">
        {children}
      </div>

      {/* Daily Rewards Modal (Auto-popup) */}
      <DailyRewardsModal />
    </>
  );
}
