import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check, Sparkles, Trophy } from 'lucide-react';

const TABLE_OPTIONS = [
  {
    id: 'simple_clean',
    name: 'Classic Table',
    description: 'Simple, clean design',
    cost: 0,
    unlockLevel: 1,
    thumbnail: '🎴',
    emoji: '🟢',
    isDefault: true
  },
  {
    id: 'glowing_perspective',
    name: 'Neon Perspective',
    description: 'Glowing cards + 3D depth',
    cost: 5000,
    unlockLevel: 5,
    thumbnail: '✨',
    emoji: '💎',
    isDefault: false
  },
  {
    id: 'large_player_zone',
    name: 'Player Focus',
    description: 'Large prominent player zone',
    cost: 3500,
    unlockLevel: 3,
    thumbnail: '👤',
    emoji: '🎯',
    isDefault: false
  },
  {
    id: 'marked_zones',
    name: 'Pro Grid',
    description: 'Organized zones with labels',
    cost: 4000,
    unlockLevel: 4,
    thumbnail: '📐',
    emoji: '🎲',
    isDefault: false
  },
  {
    id: 'extreme_3d',
    name: 'Immersive 3D',
    description: 'Dramatic perspective depth',
    cost: 6000,
    unlockLevel: 7,
    thumbnail: '🎬',
    emoji: '🌟',
    isDefault: false
  }
];

export function TableSelector({ onSelect, onClose, currentTable, userCoins = 2500, userLevel = 1 }: { onSelect?: any, onClose?: any, currentTable?: any, userCoins?: any, userLevel?: any }) {
  const [selectedTable, setSelectedTable] = useState(currentTable || 'simple_clean');
  const [hoveredTable, setHoveredTable] = useState(null);

  const canUnlock = (table) => {
    if (table.isDefault) return true;
    return userLevel >= table.unlockLevel || userCoins >= table.cost;
  };

  const getUnlockText = (table) => {
    if (table.isDefault) return 'FREE';
    if (userLevel >= table.unlockLevel) return `✓ LEVEL ${table.unlockLevel}`;
    return `🪙 ${table.cost}`;
  };

  const handleSelect = (table) => {
    if (!canUnlock(table)) return;
    setSelectedTable(table.id);
  };

  const handleConfirm = () => {
    const table = TABLE_OPTIONS.find(t => t.id === selectedTable);
    if (canUnlock(table)) {
      onSelect(selectedTable);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
    >
      {/* Neon glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600 rounded-full blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative bg-black/80 backdrop-blur-xl rounded-3xl border-2 border-fuchsia-500/50 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 0 60px rgba(217, 70, 239, 0.4), inset 0 0 30px rgba(168, 85, 247, 0.1)' }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-900/50 via-fuchsia-900/50 to-purple-900/50 p-6 rounded-t-3xl border-b-2 border-fuchsia-500/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-fuchsia-400" />
                Choose Your Table
              </h2>
              <p className="text-purple-300 text-sm mt-1">Select a style for your game</p>
            </div>
            
            <div className="text-right">
              <div className="bg-black/60 px-4 py-2 rounded-xl border-2 border-purple-500/50 backdrop-blur-sm" style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)' }}>
                <p className="text-cyan-400 text-xs font-bold">Your Coins</p>
                <p className="text-white text-2xl font-black">🪙 {userCoins.toLocaleString()}</p>
              </div>
              <div className="bg-black/60 px-4 py-1 rounded-lg border border-fuchsia-500/50 mt-2">
                <p className="text-purple-300 text-sm font-bold">Level {userLevel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TABLE_OPTIONS.map((table) => {
              const isSelected = selectedTable === table.id;
              const isUnlocked = canUnlock(table);
              const isHovered = hoveredTable === table.id;

              return (
                <motion.button
                  key={table.id}
                  onClick={() => handleSelect(table)}
                  onHoverStart={() => setHoveredTable(table.id)}
                  onHoverEnd={() => setHoveredTable(null)}
                  whileHover={{ scale: isUnlocked ? 1.05 : 1 }}
                  whileTap={{ scale: isUnlocked ? 0.98 : 1 }}
                  disabled={!isUnlocked}
                  className={`relative p-6 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-fuchsia-900/60 to-purple-900/60 border-fuchsia-400 shadow-2xl'
                      : isUnlocked
                      ? 'bg-gradient-to-br from-gray-900/80 to-black/80 border-purple-600/50 hover:border-cyan-500'
                      : 'bg-gradient-to-br from-gray-900/40 to-black/40 border-gray-700 opacity-50'
                  }`}
                  style={isSelected ? { boxShadow: '0 0 40px rgba(217, 70, 239, 0.6)' } : {}}
                >
                  {/* Selected Badge */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-cyan-400 shadow-lg z-10"
                      style={{ boxShadow: '0 0 20px rgba(217, 70, 239, 0.8)' }}
                    >
                      <Check className="w-6 h-6 text-white" />
                    </motion.div>
                  )}

                  {/* Lock Badge */}
                  {!isUnlocked && (
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center border-4 border-gray-500 shadow-lg z-10">
                      <Lock className="w-5 h-5 text-gray-300" />
                    </div>
                  )}

                  {/* Table Preview */}
                  <div className="text-6xl mb-4 text-center">
                    {table.emoji}
                  </div>

                  {/* Table Info */}
                  <div className="text-center">
                    <h3 className="text-xl font-black text-white mb-1">{table.name}</h3>
                    <p className="text-gray-300 text-sm mb-3">{table.description}</p>
                    
                    {/* Unlock Status */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      table.isDefault
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : isUnlocked
                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {getUnlockText(table)}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Footer - Confirm Button */}
        <div className="bg-gradient-to-r from-purple-900/30 via-black/50 to-fuchsia-900/30 p-6 rounded-b-3xl border-t-2 border-purple-600/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-800/80 hover:bg-gray-700 border border-gray-600 hover:border-purple-500 text-white font-bold rounded-xl transition-all"
          >
            Cancel
          </button>

          <div className="text-center">
            {selectedTable && (
              <p className="text-purple-400 text-sm mb-2">
                Selected: <span className="text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text font-bold">
                  {TABLE_OPTIONS.find(t => t.id === selectedTable)?.name}
                </span>
              </p>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!canUnlock(TABLE_OPTIONS.find(t => t.id === selectedTable))}
            className="px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-xl transition-all flex items-center gap-2"
            style={{ boxShadow: '0 0 30px rgba(217, 70, 239, 0.5)' }}
          >
            <Check className="w-5 h-5" />
            Confirm Selection
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
