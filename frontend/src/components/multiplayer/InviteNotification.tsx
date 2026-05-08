import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Trophy, Users, Coins, Target } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * InviteNotification - Popup for game invites
 * Shows when another player invites you to a game
 */

export default function InviteNotification({ invite, onAccept, onReject, onClose }) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    if (!invite) return;

    // Calculate time left
    const expiresAt = new Date(invite.expires_at).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(left);

      if (left === 0) {
        toast.error('Invite expired');
        onClose();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [invite, onClose]);

  if (!invite) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGameIcon = () => {
    switch (invite.game_type) {
      case 'bid_whist':
        return '🎴';
      case 'spades':
        return '♠️';
      case 'hearts':
        return '♥️';
      case 'poker':
        return '🃏';
      default:
        return '🎮';
    }
  };

  const getGameName = () => {
    return invite.game_type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-md w-full mx-4"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-blue-500/30 blur-3xl rounded-3xl" />

          {/* Main card */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border-2 border-amber-500/50 shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors z-10"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600/20 to-purple-600/20 p-6 text-center border-b border-amber-500/30">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                className="text-6xl mb-3"
              >
                {getGameIcon()}
              </motion.div>
              <h2 className="text-2xl font-['Cinzel'] text-amber-400 mb-2">
                Game Invite
              </h2>
              <div className="flex items-center justify-center gap-2 text-amber-200/70 text-sm">
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  timeLeft > 60 ? 'bg-green-400' : 'bg-red-400'
                }`} />
                Expires in {formatTime(timeLeft)}
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Invite message */}
              <div className="text-center mb-6">
                <p className="text-white text-lg mb-2">
                  <span className="font-bold text-amber-400">{invite.host_name}</span>
                  {' '}invited you to
                </p>
                <p className="text-2xl font-['Cinzel'] text-purple-400 mb-4">
                  {getGameName()}
                </p>
              </div>

              {/* Game details */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Players</span>
                  </div>
                  <span className="text-white font-bold">4 Players</span>
                </div>

                {invite.wager > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Coins className="w-4 h-4" />
                      <span className="text-sm">Bet</span>
                    </div>
                    <span className="text-amber-400 font-bold">{invite.wager} credits</span>
                  </div>
                )}

                {invite.winning_score && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Target className="w-4 h-4" />
                      <span className="text-sm">Win at</span>
                    </div>
                    <span className="text-purple-400 font-bold">{invite.winning_score} points</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => onAccept(invite)}
                  className="flex-1 py-6 text-lg font-['Cinzel'] font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  Accept
                </Button>

                <Button
                  onClick={() => onReject(invite)}
                  variant="outline"
                  className="flex-1 py-6 text-lg font-['Cinzel'] font-bold border-2 border-red-500/50 text-red-400 hover:bg-red-900/20 hover:border-red-500 transition-all"
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
