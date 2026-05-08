import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, X, Loader } from 'lucide-react';
import multiplayerManager from '@/utils/multiplayerManager';

export function MatchmakingModal({ isOpen, onClose, gameType, gameName }) {
  const [status, setStatus] = useState('idle'); // idle, searching, found
  const [queuePosition, setQueuePosition] = useState(0);
  const [matchData, setMatchData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      startMatchmaking();
    }

    return () => {
      if (status === 'searching') {
        multiplayerManager.cancelMatchmaking();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    // Listen for matchmaking events
    const handleMatchmakingStarted = (data) => {
      setStatus('searching');
      setQueuePosition(data.queue_position);
    };

    const handleMatchFound = (data) => {
      setStatus('found');
      setMatchData(data);
      
      // Redirect to game with room_id after 2 seconds
      setTimeout(() => {
        onClose();
        window.location.href = `/multiplayer/${gameType}?room=${data.room_id}`;
      }, 2000);
    };

    multiplayerManager.on('matchmaking_started', handleMatchmakingStarted);
    multiplayerManager.on('match_found', handleMatchFound);

    return () => {
      multiplayerManager.off('matchmaking_started', handleMatchmakingStarted);
      multiplayerManager.off('match_found', handleMatchFound);
    };
  }, [gameType, onClose]);

  const startMatchmaking = async () => {
    try {
      // Get user info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Connect to multiplayer server
      await multiplayerManager.connect(user.user_id || 'guest', user.name || 'Player');
      
      // Start matchmaking
      multiplayerManager.findMatch(gameType, 'medium');
    } catch (error) {
      // console.error('Matchmaking error:', error);
    }
  };

  const handleCancel = () => {
    multiplayerManager.cancelMatchmaking();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md bg-gradient-to-br from-purple-900/90 to-black/90 backdrop-blur-xl border-2 border-purple-500 rounded-3xl p-8"
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Content based on status */}
          {status === 'idle' && (
            <div className="text-center">
              <Loader className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
              <h3 className="text-2xl font-black text-white mb-2">Connecting...</h3>
              <p className="text-purple-300">Setting up multiplayer</p>
            </div>
          )}

          {status === 'searching' && (
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-24 h-24 mx-auto mb-6"
              >
                <Search className="w-full h-full text-fuchsia-500" />
              </motion.div>
              
              <h3 className="text-3xl font-black text-white mb-2">Finding Opponent...</h3>
              <p className="text-xl text-purple-300 mb-4">{gameName}</p>
              
              <div className="bg-black/40 rounded-xl p-4 mb-4">
                <p className="text-white/60 text-sm mb-2">Queue Position</p>
                <p className="text-4xl font-black text-fuchsia-400">#{queuePosition}</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                <div className="w-2 h-2 bg-fuchsia-500 rounded-full animate-pulse" />
                <span>Searching for players...</span>
              </div>
            </div>
          )}

          {status === 'found' && matchData && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Users className="w-24 h-24 text-green-500 mx-auto mb-4" />
              </motion.div>

              <h3 className="text-3xl font-black text-white mb-2">Match Found!</h3>
              <p className="text-xl text-green-400 mb-6">Starting game...</p>

              <div className="space-y-3">
                {matchData.players.map((player, idx) => (
                  <motion.div
                    key={player.sid}
                    initial={{ x: idx === 0 ? -100 : 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.2 }}
                    className="bg-black/40 rounded-xl p-4 flex items-center gap-3"
                  >
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                      idx === 0 ? 'from-cyan-500 to-blue-500' : 'from-fuchsia-500 to-purple-500'
                    } flex items-center justify-center text-2xl`}>
                      🎮
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-white">{player.user_name}</p>
                      <p className="text-sm text-purple-400">Player {player.player_number}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel button (only show when searching) */}
          {status === 'searching' && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={handleCancel}
              className="w-full mt-6 px-6 py-3 bg-red-600/20 border-2 border-red-500 text-red-400 font-bold rounded-xl hover:bg-red-600/30 transition-all"
            >
              Cancel Search
            </motion.button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
