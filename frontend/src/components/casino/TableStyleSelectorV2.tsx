import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, Star, TrendingUp, Crown, Zap } from 'lucide-react';

/**
 * Table Style Selector with Unlock System
 * - 2 Default designs (Classic Vegas, Minimalist Dark)
 * - 4 Unlockable designs (Premium or Achievement-based)
 */
export default function TableStyleSelectorV2({ 
  currentStyle = 'classic-vegas',
  onStyleChange,
  userLevel = 1,
  userUnlockedDesigns = [],
  isPremium = false
}) {
  const [selectedStyle, setSelectedStyle] = useState(currentStyle);

  const designs = [
    {
      id: 'classic-vegas',
      name: 'Classic Vegas',
      isDefault: true,
      unlockMethod: 'default',
      unlockLevel: 0,
      icon: '🎰',
      description: 'Traditional luxury casino experience'
    },
    {
      id: 'minimalist-dark',
      name: 'Dark Premium',
      isDefault: true,
      unlockMethod: 'default',
      unlockLevel: 0,
      icon: '⚫',
      description: 'Modern minimalist design'
    },
    {
      id: 'cyberpunk-neon',
      name: 'Cyberpunk Neon',
      isDefault: false,
      unlockMethod: 'premium',
      unlockLevel: null,
      icon: '🌃',
      description: 'Futuristic holographic style',
      premiumRequired: true
    },
    {
      id: 'art-deco-gatsby',
      name: 'Art Deco',
      isDefault: false,
      unlockMethod: 'achievement',
      unlockLevel: 10,
      icon: '🎩',
      description: '1920s Gatsby glamour',
      unlockRequirement: 'Win 50 games'
    },
    {
      id: 'modern-glass',
      name: 'Glass Luxury',
      isDefault: false,
      unlockMethod: 'level',
      unlockLevel: 15,
      icon: '💎',
      description: 'Contemporary glass design'
    },
    {
      id: 'vip-lounge',
      name: 'VIP Lounge',
      isDefault: false,
      unlockMethod: 'premium',
      unlockLevel: null,
      icon: '👑',
      description: 'Exclusive high-roller style',
      premiumRequired: true
    }
  ];

  const isUnlocked = (design) => {
    if (design.isDefault) return true;
    if (design.premiumRequired && isPremium) return true;
    if (userUnlockedDesigns.includes(design.id)) return true;
    if (design.unlockMethod === 'level' && userLevel >= design.unlockLevel) return true;
    return false;
  };

  const handleStyleSelect = (design) => {
    if (isUnlocked(design)) {
      setSelectedStyle(design.id);
      if (onStyleChange) onStyleChange(design.id);
    }
  };

  const getUnlockBadge = (design) => {
    if (design.isDefault) {
      return <span className="text-green-400 text-xs font-bold">FREE</span>;
    }
    if (design.premiumRequired) {
      return (
        <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
          <Crown className="w-3 h-3" />
          PREMIUM
        </span>
      );
    }
    if (design.unlockMethod === 'achievement') {
      return (
        <span className="flex items-center gap-1 text-purple-400 text-xs font-bold">
          <Star className="w-3 h-3" />
          ACHIEVEMENT
        </span>
      );
    }
    if (design.unlockMethod === 'level') {
      return (
        <span className="flex items-center gap-1 text-blue-400 text-xs font-bold">
          <TrendingUp className="w-3 h-3" />
          LVL {design.unlockLevel}
        </span>
      );
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
        Table Style
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {designs.map((design) => {
          const unlocked = isUnlocked(design);
          const isSelected = selectedStyle === design.id;
          
          return (
            <motion.button
              key={design.id}
              onClick={() => handleStyleSelect(design)}
              disabled={!unlocked}
              whileHover={unlocked ? { scale: 1.02 } : {}}
              whileTap={unlocked ? { scale: 0.98 } : {}}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-yellow-400 bg-gradient-to-br from-yellow-900/40 to-amber-900/40'
                  : unlocked
                  ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                  : 'border-gray-700 bg-gray-800/30 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Lock Overlay */}
              {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl backdrop-blur-sm z-10">
                  <Lock className="w-8 h-8 text-gray-400" />
                </div>
              )}

              {/* Selected Indicator */}
              {isSelected && unlocked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center z-20"
                >
                  <Zap className="w-4 h-4 text-black" />
                </motion.div>
              )}

              {/* Design Info */}
              <div className="flex items-start gap-3 mb-2">
                <span className="text-3xl">{design.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">
                    {design.name}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-2">
                    {design.description}
                  </p>
                </div>
              </div>

              {/* Unlock Badge */}
              <div className="mt-2 flex items-center justify-between">
                {getUnlockBadge(design)}
                
                {!unlocked && design.unlockRequirement && (
                  <span className="text-xs text-gray-500">
                    {design.unlockRequirement}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Unlock Info */}
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600">
        <div className="flex items-start gap-2 text-xs text-gray-300">
          <Unlock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p>
            Unlock premium styles through gameplay achievements, leveling up, or VIP membership.
            {!isPremium && ' Upgrade to Premium to unlock all exclusive designs instantly.'}
          </p>
        </div>
      </div>
    </div>
  );
}
