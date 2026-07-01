import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, MapPin, Star, Gamepad2, Send } from 'lucide-react';

const VibeMatchCard = ({ match, onAccept, onReject, onSendVibe }) => {
  if (!match) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateY: -10 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        exit={{ scale: 0.8, opacity: 0, x: 300 }}
        className="relative w-full max-w-sm"
        style={{ perspective: '1000px' }}
      >
        {/* Card */}
        <div className="bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 backdrop-blur-2xl border-2 border-white/20 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Profile Image */}
          <div className="relative h-80 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <div className="text-9xl">{match.image}</div>
            
            {/* Online Status */}
            {match.online && (
              <div className="absolute top-4 right-4 bg-green-500 border-2 border-white px-3 py-1 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-bold">ONLINE</span>
              </div>
            )}

            {/* Compatibility Badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-black text-sm">{match.compatibility}% Match</span>
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-white font-black text-3xl mb-2">
                {match.name}, {match.age}
              </h3>
              {match.location && (
                <div className="flex items-center gap-2 text-white/60">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{match.location}</span>
                </div>
              )}
            </div>

            {/* Status */}
            {match.status && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-cyan-400" />
                <span className="text-white text-sm font-semibold">{match.status}</span>
              </div>
            )}

            {/* Bio */}
            {match.bio && (
              <p className="text-white/80 text-sm leading-relaxed">{match.bio}</p>
            )}

            {/* Interests */}
            {match.interests && match.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {match.interests.map((interest, i) => (
                  <span 
                    key={`interests-${i}`}
                    className="bg-white/10 border border-white/20 px-3 py-1 rounded-full text-white/80 text-xs font-semibold"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              {/* Reject */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onReject}
                className="w-full aspect-square bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-full flex items-center justify-center shadow-lg transition-all"
              >
                <X className="w-8 h-8 text-white" />
              </motion.button>

              {/* Send Virtual Drink */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onSendVibe}
                className="w-full aspect-square bg-gradient-to-br from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 rounded-full flex items-center justify-center shadow-lg transition-all"
              >
                <span className="text-3xl">🍹</span>
              </motion.button>

              {/* Accept */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onAccept}
                className="w-full aspect-square bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full flex items-center justify-center shadow-lg transition-all"
              >
                <Heart className="w-8 h-8 text-white fill-white" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VibeMatchCard;
