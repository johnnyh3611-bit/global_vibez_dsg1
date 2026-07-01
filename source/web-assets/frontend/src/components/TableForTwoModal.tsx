import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gamepad2, Clock, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from './ToastNotification';

const API = process.env.REACT_APP_BACKEND_URL;

export function TableForTwoModal({ isOpen, onClose, match, onInviteSent }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const { toasts, removeToast, game: showGameToast } = useToast();

  const icebreaker_games = {
    uno: {
      name: "UNO",
      emoji: "🎴",
      duration: "5-10 mins",
      description: "Fast-paced card game - perfect icebreaker!",
      color: "from-red-500 to-yellow-500"
    },
    connect4: {
      name: "Connect 4",
      emoji: "🔴",
      duration: "3-5 mins",
      description: "Classic strategy game",
      color: "from-blue-500 to-cyan-500"
    },
    tictactoe: {
      name: "Tic-Tac-Toe",
      emoji: "⭕",
      duration: "1-2 mins",
      description: "Quick and fun",
      color: "from-green-500 to-emerald-500"
    },
    checkers: {
      name: "Checkers",
      emoji: "⚫",
      duration: "5-10 mins",
      description: "Strategic board game",
      color: "from-purple-500 to-pink-500"
    }
  };

  const sendInvite = async () => {
    if (!selectedGame) return;

    setSending(true);
    try {
      const response = await fetch(`${API}/api/table-for-two/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          match_id: match.match_id,
          game_type: selectedGame,
          message: message || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send invite');
      }

      const data = await response.json();
      
      // Show success toast
      showGameToast(
        `🎮 ${icebreaker_games[selectedGame].name} invite sent to ${match.username || 'your match'}!`,
        'Game Invite Sent'
      );
      
      if (onInviteSent) {
        onInviteSent(data);
      }

      // Close modal and reset
      onClose();
      setSelectedGame(null);
      setMessage('');
    } catch (error) {
      // console.error('Error sending invite:', error);
      alert(error.message || 'Failed to send game invite. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <GlassCard variant="gaming" className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="text-4xl">🎮❤️</div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Table for Two</h2>
                  <p className="text-fuchsia-300 text-sm">Break the ice with {match.username || 'your match'}!</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Games Grid */}
            <div className="mb-6">
              <p className="text-white/80 text-sm mb-4 flex items-center gap-2">
                <Gamepad2 size={16} />
                Choose a quick game to play together:
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(icebreaker_games).map(([gameType, game], idx) => (
                  <motion.button
                    key={gameType}
                    onClick={() => setSelectedGame(gameType)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      backdrop-blur-xl rounded-xl p-4 text-left transition-all duration-300 relative overflow-hidden
                      ${selectedGame === gameType
                        ? `bg-gradient-to-br ${game.color} border-2 border-white shadow-[0_0_30px_rgba(232,121,249,0.6)]`
                        : 'bg-white/5 border-2 border-white/20 hover:border-white/40 hover:shadow-[0_0_20px_rgba(232,121,249,0.3)]'
                      }
                    `}
                  >
                    {/* Glow effect on hover */}
                    {selectedGame !== gameType && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 opacity-0 hover:opacity-100 transition-opacity"
                      />
                    )}
                    
                    {/* Pulsing border for selected */}
                    {selectedGame === gameType && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 border-2 border-white/40 rounded-xl"
                      />
                    )}
                    
                    <div className="relative z-10">
                      <motion.div 
                        className="text-4xl mb-2"
                        animate={selectedGame === gameType ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        {game.emoji}
                      </motion.div>
                      <div className="text-white font-bold text-lg mb-1">{game.name}</div>
                      <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                        <Clock size={12} />
                        {game.duration}
                      </div>
                      <div className="text-white/70 text-sm">{game.description}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Optional Message */}
            {selectedGame && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6"
              >
                <label className="text-white/80 text-sm mb-2 block flex items-center gap-2">
                  <Sparkles size={14} />
                  Add a message (optional):
                </label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Let's play! 🎮"
                  maxLength={100}
                  className="w-full bg-white/5 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:border-fuchsia-400 focus:outline-none transition-all"
                />
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-white/5 border-2 border-white/20 text-white py-3 rounded-xl hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={!selectedGame || sending}
                className={`
                  flex-1 py-3 rounded-xl font-bold transition-all
                  ${selectedGame && !sending
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white hover:from-fuchsia-500 hover:to-pink-500 shadow-[0_0_30px_rgba(232,121,249,0.6)]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }
                `}
              >
                {sending ? 'Sending...' : selectedGame ? `Send ${icebreaker_games[selectedGame].name} Invite` : 'Select a Game'}
              </button>
            </div>

            {/* Info */}
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-lg">
              <p className="text-cyan-200 text-xs text-center">
                💡 Your match will have 15 minutes to accept the invite
              </p>
            </div>
          </GlassCard>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
