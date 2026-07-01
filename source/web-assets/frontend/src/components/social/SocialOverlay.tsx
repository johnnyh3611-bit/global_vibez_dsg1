
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Send, Star } from 'lucide-react';

interface SocialOverlayProps {
  visible?: boolean;
  onClose?: () => void;
  nearbyPlayers?: any[];
  onSendVibe?: (player: any) => void;
  onInviteToTable?: (player: any) => void;
}

const SocialOverlay = ({ visible, onClose, nearbyPlayers = [], onSendVibe, onInviteToTable = () => {} }: SocialOverlayProps) => {
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0A0A0A]/95 backdrop-blur-2xl border-2 border-white/20 rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-b border-white/10 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-2xl">Players at this Table</h2>
              <p className="text-white/60 text-sm">{nearbyPlayers.length} nearby</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>
          </div>

          {/* Players List */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {nearbyPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/60 text-sm">No other players at this table yet.</p>
                <p className="text-white/40 text-xs mt-2">Invite your vibes to join!</p>
              </div>
            ) : (
              nearbyPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-2xl">
                        {player.image || '👤'}
                      </div>
                      {player.online && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#0A0A0A] rounded-full" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold">{player.name}</h3>
                        {player.compatibility && (
                          <div className="flex items-center gap-1 bg-pink-500/20 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 text-pink-400" />
                            <span className="text-pink-400 text-xs font-bold">{player.compatibility}%</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white/60 text-sm">{player.status || 'Playing'}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSendVibe && onSendVibe(player)}
                        className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 rounded-full flex items-center justify-center shadow-lg transition-all"
                        title="Send Vibe"
                      >
                        <Heart className="w-5 h-5 text-white" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onInviteToTable && onInviteToTable(player)}
                        className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-full flex items-center justify-center shadow-lg transition-all"
                        title="Invite"
                      >
                        <Send className="w-5 h-5 text-white" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SocialOverlay;
