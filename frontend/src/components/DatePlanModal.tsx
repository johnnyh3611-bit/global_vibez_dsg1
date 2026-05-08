import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Utensils, Sparkles, Gamepad2, Clock, DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { GlassCard } from './GlassCard';

const API = process.env.REACT_APP_BACKEND_URL;

export function DatePlanModal({ isOpen, onClose, match }) {
  const [datePlan, setDatePlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generatePlan = async () => {
    if (!match?.match_id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API}/api/ai-date-planner/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          match_id: match.match_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate date plan');
      }

      const data = await response.json();
      setDatePlan(data);
    } catch (err) {
      // console.error('Error generating date plan:', err);
      setError(err.message || 'Failed to generate date plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-4xl w-full my-8"
        >
          <GlassCard variant="gaming" className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                  🤖 AI Date Planner
                </h2>
                <p className="text-white/70">
                  Powered by GPT-5.2 • Personalized for you and {match?.username || 'your match'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            {/* Empty State / Loading / Error */}
            {!datePlan && !loading && !error && (
              <div className="text-center py-16">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-8xl mb-6"
                >
                  🤖
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Let AI Plan Your Perfect Date
                </h3>
                <p className="text-white/70 mb-8 max-w-md mx-auto">
                  Our AI will analyze both your profiles and create a personalized date plan including restaurant, activity, and game suggestions!
                </p>
                <button
                  onClick={generatePlan}
                  className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_30px_rgba(232,121,249,0.6)] flex items-center gap-2 mx-auto"
                >
                  <Sparkles size={24} />
                  Generate AI Date Plan
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-16">
                <Loader2 className="w-16 h-16 text-fuchsia-400 animate-spin mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-3">
                  AI is planning your date...
                </h3>
                <p className="text-white/70">
                  Analyzing profiles, interests, and preferences 🤖✨
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-white mb-3">Oops!</h3>
                <p className="text-red-300 mb-6">{error}</p>
                <button
                  onClick={generatePlan}
                  className="px-6 py-3 bg-fuchsia-600 text-white font-bold rounded-xl hover:bg-fuchsia-500 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Date Plan Display */}
            {datePlan && !loading && (
              <div className="space-y-6">
                {/* Restaurant Suggestion */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    delay: 0.1,
                    type: 'spring',
                    stiffness: 200
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <GlassCard className="p-6 bg-gradient-to-br from-orange-900/20 to-red-900/10 border-2 border-orange-400/40">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                        <Utensils className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">
                          {datePlan.restaurant?.name || 'Restaurant'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm text-white/70">
                          <div className="flex items-center gap-1">
                            <Utensils size={14} />
                            {datePlan.restaurant?.cuisine}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign size={14} />
                            {datePlan.restaurant?.price_range}
                          </div>
                        </div>
                        <p className="text-white/80 mb-2">
                          <strong className="text-orange-300">Vibe:</strong> {datePlan.restaurant?.vibe}
                        </p>
                        <p className="text-white/70 text-sm">
                          💡 {datePlan.restaurant?.reason}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Activity Suggestion */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    delay: 0.3,
                    type: 'spring',
                    stiffness: 200
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <GlassCard className="p-6 bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border-2 border-cyan-400/40">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">
                          {datePlan.activity?.name || 'Activity'}
                        </h3>
                        <div className="flex items-center gap-2 mb-3 text-sm text-white/70">
                          <Clock size={14} />
                          {datePlan.activity?.duration}
                        </div>
                        <p className="text-white/80 mb-2">
                          {datePlan.activity?.description}
                        </p>
                        <p className="text-white/70 text-sm">
                          💡 {datePlan.activity?.reason}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Game Suggestion */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    delay: 0.5,
                    type: 'spring',
                    stiffness: 200
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <GlassCard className="p-6 bg-gradient-to-br from-fuchsia-900/20 to-purple-900/10 border-2 border-fuchsia-400/40">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">
                          {datePlan.game?.name || 'Game'}
                        </h3>
                        <div className="flex items-center gap-2 mb-3 text-sm text-white/70">
                          <Clock size={14} />
                          {datePlan.game?.when}
                        </div>
                        <p className="text-white/70 text-sm">
                          💡 {datePlan.game?.reason}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Full Itinerary */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    delay: 0.7,
                    type: 'spring',
                    stiffness: 200
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <GlassCard className="p-6 bg-gradient-to-br from-green-900/20 to-emerald-900/10 border-2 border-green-400/40">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Complete Itinerary
                    </h3>
                    <div className="text-white/80 whitespace-pre-line">
                      {datePlan.itinerary}
                    </div>
                  </GlassCard>
                </motion.div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={generatePlan}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-white/10 border-2 border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={18} />
                    Regenerate Plan
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_20px_rgba(232,121,249,0.5)]"
                  >
                    Let's Do This! 🚀
                  </button>
                </div>

                {/* Info Footer */}
                <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-lg text-center">
                  <p className="text-cyan-200 text-sm">
                    ✨ This plan was personalized using AI based on both your profiles
                  </p>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
