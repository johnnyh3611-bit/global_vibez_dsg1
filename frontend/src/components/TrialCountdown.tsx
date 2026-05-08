
import React, { useState, useEffect } from 'react';
import { Clock, Zap } from 'lucide-react';

const TrialCountdown = ({ trialExpiresAt, onExpired }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (!trialExpiresAt) return null;

      const expiryDate = new Date(trialExpiresAt);
      const now = new Date();
      const diff = expiryDate.getTime() - now.getTime();

      if (diff <= 0) {
        if (onExpired) onExpired();
        return { expired: true };
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { hours, minutes, seconds, expired: false };
    };

    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [trialExpiresAt, onExpired]);

  if (!timeRemaining) return null;

  if (timeRemaining.expired) {
    return (
      <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-center">
        <p className="text-red-400 font-bold text-lg">⏰ Trial Expired</p>
        <p className="text-red-300 text-sm mt-1">Unlock full access to continue</p>
      </div>
    );
  }

  const { hours, minutes, seconds } = timeRemaining;
  const isUrgent = hours < 6;

  return (
    <div className={`bg-gradient-to-r ${isUrgent ? 'from-red-900/30 to-orange-900/30 border-red-500' : 'from-blue-900/30 to-cyan-900/30 border-cyan-500'} border rounded-lg p-6 backdrop-blur-sm`}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <Clock className={`w-5 h-5 ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`} />
        <h3 className={`text-lg font-bold ${isUrgent ? 'text-red-300' : 'text-cyan-300'} uppercase tracking-wide`}>
          {isUrgent ? '⚠️ Trial Ending Soon' : 'Free Trial Active'}
        </h3>
      </div>

      <div className="flex justify-center gap-4 text-center">
        <div className="bg-black/40 rounded-lg px-4 py-3 min-w-[80px]">
          <div className={`text-3xl font-bold ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`}>
            {String(hours).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-400 mt-1">Hours</div>
        </div>

        <div className="flex items-center">
          <span className={`text-2xl ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`}>:</span>
        </div>

        <div className="bg-black/40 rounded-lg px-4 py-3 min-w-[80px]">
          <div className={`text-3xl font-bold ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`}>
            {String(minutes).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-400 mt-1">Minutes</div>
        </div>

        <div className="flex items-center">
          <span className={`text-2xl ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`}>:</span>
        </div>

        <div className="bg-black/40 rounded-lg px-4 py-3 min-w-[80px]">
          <div className={`text-3xl font-bold ${isUrgent ? 'text-red-400' : 'text-cyan-400'}`}>
            {String(seconds).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-400 mt-1">Seconds</div>
        </div>
      </div>

      {isUrgent && (
        <div className="mt-4 flex items-center justify-center gap-2 text-yellow-400 text-sm animate-pulse">
          <Zap className="w-4 h-4" />
          <span className="font-semibold">Unlock now to keep your progress!</span>
        </div>
      )}
    </div>
  );
};

export default TrialCountdown;
