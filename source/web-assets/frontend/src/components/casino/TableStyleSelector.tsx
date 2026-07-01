import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Crown, Zap, Minimize2 } from 'lucide-react';

/**
 * Table Style Selector
 * Allows players to choose their preferred table style
 */

const TABLE_STYLES = [
  {
    id: 'classic',
    name: 'Classic Casino',
    description: 'Traditional green felt',
    icon: '🎲',
    color: 'from-green-600 to-emerald-700',
    Icon: Sparkles
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Futuristic holographic',
    icon: '⚡',
    color: 'from-cyan-500 to-pink-500',
    Icon: Zap
  },
  {
    id: 'vip',
    name: 'VIP Luxury',
    description: 'Premium black & gold',
    icon: '👑',
    color: 'from-yellow-600 to-amber-700',
    Icon: Crown
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean & simple',
    icon: '▫️',
    color: 'from-gray-600 to-gray-800',
    Icon: Minimize2
  }
];

const CARD_STYLES = [
  { id: 'realistic', name: 'Realistic', preview: '🂡' },
  { id: 'modern', name: 'Modern', preview: '🎴' },
  { id: 'cyberpunk', name: 'Cyberpunk', preview: '✨' },
  { id: 'luxury', name: 'Luxury', preview: '👑' }
];

export default function TableStyleSelector({
  currentTable = 'classic',
  currentCardStyle = 'realistic',
  onTableChange,
  onCardStyleChange,
  isOpen = false,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-3xl p-8 max-w-4xl w-full border-2 border-purple-500/50 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 mb-2">
            Customize Your Experience
          </h2>
          <p className="text-purple-200">Choose your table style and card design</p>
        </div>

        {/* Table Styles */}
        <div className="mb-8">
          <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Table Style
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TABLE_STYLES.map((style) => {
              const Icon = style.Icon;
              const isSelected = currentTable === style.id;
              
              return (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onTableChange(style.id)}
                  className={`relative p-6 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 shadow-xl shadow-cyan-500/50'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-white/10'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 bg-cyan-400 text-black text-xs font-bold px-2 py-1 rounded-full"
                    >
                      ACTIVE
                    </motion.div>
                  )}
                  
                  <div className="text-5xl mb-3">{style.icon}</div>
                  <Icon className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
                  
                  <p className="text-white font-bold text-base mb-1">{style.name}</p>
                  <p className="text-white/60 text-xs">{style.description}</p>
                  
                  <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${style.color}`} />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Card Styles */}
        <div>
          <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            Card Design
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CARD_STYLES.map((style) => {
              const isSelected = currentCardStyle === style.id;
              
              return (
                <motion.button
                  key={style.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onCardStyleChange(style.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-pink-400 bg-gradient-to-br from-pink-500/20 to-purple-500/20 shadow-lg shadow-pink-500/50'
                      : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-white/10'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 bg-pink-400 text-black text-xs font-bold px-2 py-1 rounded-full"
                    >
                      ✓
                    </motion.div>
                  )}
                  <div className="text-4xl mb-2">{style.preview}</div>
                  <p className="text-white font-semibold text-sm">{style.name}</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-8 text-center">
          <button
            onClick={onClose}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-8 py-3 rounded-xl shadow-xl transition-all"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
