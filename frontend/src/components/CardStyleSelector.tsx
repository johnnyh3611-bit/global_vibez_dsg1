import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check, Sparkles, TrendingUp } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { UnlockCelebration } from './UnlockCelebration';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from './ToastNotification';

const API = process.env.REACT_APP_BACKEND_URL;

export function CardStyleSelector({ isOpen, onClose, onStyleChanged }) {
  const [styles, setStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [currentVibeScore, setCurrentVibeScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);
  const [newlyUnlockedStyle, setNewlyUnlockedStyle] = useState(null);
  const { toasts, removeToast, success } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchStyles();
    }
  }, [isOpen]);

  const fetchStyles = async () => {
    try {
      const response = await fetch(`${API}/api/card-styles/available`, {
      });
      
      if (!response.ok) throw new Error('Failed to fetch styles');
      
      const data = await response.json();
      setStyles(data.styles || []);
      setCurrentVibeScore(data.current_vibe_score || 0);
      setSelectedStyle(data.selected_style || 'classic');
    } catch (error) {
      // console.error('Error fetching card styles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStyle = async (styleId) => {
    if (selecting) return;

    const style = styles.find(s => s.style_id === styleId);
    if (!style || !style.is_unlocked) return;

    setSelecting(true);
    try {
      const response = await fetch(`${API}/api/card-styles/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ style_id: styleId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to select style');
      }

      const data = await response.json();
      setSelectedStyle(styleId);
      
      // Check if this is a newly unlocked style (first time selecting)
      const style = styles.find(s => s.style_id === styleId);
      if (style && style.is_premium && style.unlock_requirement > 0) {
        setNewlyUnlockedStyle(style);
        setShowUnlockCelebration(true);
      } else {
        // Show success toast for non-premium styles
        success(`Card style changed to ${data.style_data?.name || 'new style'}!`, '✨ Style Updated');
      }
      
      if (onStyleChanged) {
        onStyleChanged(styleId);
      }
    } catch (error) {
      // console.error('Error selecting style:', error);
      alert(error.message || 'Failed to change card style');
    } finally {
      setSelecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Unlock Celebration */}
      <UnlockCelebration 
        isOpen={showUnlockCelebration}
        onClose={() => {
          setShowUnlockCelebration(false);
          setNewlyUnlockedStyle(null);
        }}
        unlockedStyle={newlyUnlockedStyle}
      />
      
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
          className="max-w-4xl w-full"
        >
          <GlassCard variant="gaming" className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-black text-white mb-2">Card Styles</h2>
                <p className="text-white/70">Customize your cards • Unlock with Vibe Score</p>
                <div className="mt-2 text-fuchsia-300 font-bold">
                  ⭐ Your Vibe Score: {currentVibeScore.toLocaleString()}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            {/* Styles Grid */}
            {loading ? (
              <div className="text-center py-12 text-white">
                <div className="text-6xl mb-4">🎴</div>
                <div>Loading styles...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {styles.map((style) => (
                  <motion.div
                    key={style.style_id}
                    whileHover={style.is_unlocked ? { scale: 1.02 } : {}}
                    className={`relative ${style.is_unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    onClick={() => style.is_unlocked && handleSelectStyle(style.style_id)}
                  >
                    <div
                      className={`
                        backdrop-blur-xl rounded-xl p-6 border-2 transition-all duration-300
                        ${style.is_selected
                          ? `bg-gradient-to-br ${style.preview_gradient} ${style.border_color} ${style.glow_effect} border-4`
                          : style.is_unlocked
                          ? `bg-gradient-to-br ${style.preview_gradient} ${style.border_color} hover:${style.glow_effect} opacity-80 hover:opacity-100`
                          : 'bg-black/40 border-white/10 opacity-40'
                        }
                      `}
                    >
                      {/* Lock Overlay */}
                      {!style.is_unlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                          <Lock className="w-12 h-12 text-white/60 mb-3" />
                          <div className="text-white font-bold text-lg mb-1">Locked</div>
                          <div className="text-white/70 text-sm mb-3">
                            {style.unlock_requirement.toLocaleString()} Vibe Score Required
                          </div>
                          <div className="w-48 bg-white/20 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, style.unlock_progress)}%` }}
                              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                              className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 shadow-[0_0_10px_rgba(232,121,249,0.8)]"
                            />
                          </div>
                          <div className="text-white/60 text-xs mt-1">
                            {Math.round(style.unlock_progress)}% unlocked
                          </div>
                        </div>
                      )}

                      {/* Selected Badge */}
                      {style.is_selected && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-lg">
                          <Check size={16} />
                          ACTIVE
                        </div>
                      )}

                      {/* Style Info */}
                      <div className="text-center mb-4">
                        <div className="text-6xl mb-3">{style.emoji}</div>
                        <h3 className="text-2xl font-black text-white mb-2">{style.name}</h3>
                        <p className="text-white/80 text-sm">{style.description}</p>
                      </div>

                      {/* Preview Cards */}
                      <div className="flex justify-center gap-2">
                        {['♥', '♠', '♦', '♣'].map((suit, idx) => (
                          <div
                            key={`item-${idx}`}
                            className={`
                              w-12 h-16 rounded flex items-center justify-center text-2xl font-bold
                              ${style.is_unlocked ? 'bg-white text-black' : 'bg-white/20 text-white/40'}
                            `}
                          >
                            {suit}
                          </div>
                        ))}
                      </div>

                      {/* Unlock Info */}
                      {style.is_unlocked && !style.is_selected && (
                        <div className="mt-4 text-center">
                          <button
                            disabled={selecting}
                            className="px-6 py-2 bg-white/20 hover:bg-white/30 border border-white/40 rounded-lg text-white font-bold transition-all"
                          >
                            {selecting ? 'Selecting...' : 'Select This Style'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-400/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-400 mt-0.5" />
                <div>
                  <div className="text-cyan-200 font-bold mb-1">How to Unlock</div>
                  <div className="text-cyan-300/80 text-sm">
                    Play games, make matches, and use Table for Two to increase your Vibe Score and unlock exclusive card styles!
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
