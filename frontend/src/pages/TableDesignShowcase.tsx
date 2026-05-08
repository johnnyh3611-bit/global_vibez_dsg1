import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Eye, Lock, Crown, Star, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HumanHolographicDealer from '../components/casino/HumanHolographicDealer';

/**
 * Table Design Showcase - 6 Premium Casino Table Designs
 * Research-based designs inspired by Evolution Gaming, PokerStars, and modern casino trends
 */
export default function TableDesignShowcase() {
  const navigate = useNavigate();
  const [selectedDesign, setSelectedDesign] = useState('classic-vegas');
  const [favorites, setFavorites] = useState([]);
  
  // Mock user data - replace with actual user context
  const userLevel = 5; // User's current level
  const isPremium = false; // Premium membership status
  const unlockedDesigns = ['classic-vegas', 'minimalist-dark']; // User's unlocked designs

  const toggleFavorite = (id) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(f => f !== id));
    } else if (favorites.length < 3) {
      setFavorites([...favorites, id]);
    }
  };

  const designs = [
    {
      id: 'classic-vegas',
      name: 'Classic Vegas Luxury',
      description: 'Traditional high-roller experience with rich burgundy felt, gold trim, and warm ambient lighting',
      inspiration: 'Bellagio, MGM Grand',
      colors: { primary: '#8B0000', secondary: '#FFD700', accent: '#2C1810', felt: '#1a4d2e' },
      theme: 'luxury',
      features: ['Gold metallic borders', 'Rich burgundy/green felt', 'Warm lighting', 'Traditional elegance']
    },
    {
      id: 'cyberpunk-neon',
      name: 'Cyberpunk Neon Matrix',
      description: 'Futuristic holographic table with electric neon colors, glowing grid patterns, and sci-fi atmosphere',
      inspiration: 'Blade Runner, Tron',
      colors: { primary: '#00ffff', secondary: '#ff00ff', accent: '#0a0e27', felt: '#0d1117' },
      theme: 'futuristic',
      features: ['Neon blue/pink accents', 'Holographic overlays', 'Glowing grid lines', 'Digital aesthetic']
    },
    {
      id: 'minimalist-dark',
      name: 'Minimalist Dark Premium',
      description: 'Apple-inspired ultra-clean design with matte black felt, subtle grey accents, and sophisticated simplicity',
      inspiration: 'Apple Design, Scandinavian Minimalism',
      colors: { primary: '#1a1a1a', secondary: '#ffffff', accent: '#404040', felt: '#0a0a0a' },
      theme: 'minimal',
      features: ['Matte black surface', 'Clean white lines', 'Soft spotlighting', 'Premium simplicity']
    },
    {
      id: 'art-deco-gatsby',
      name: 'Art Deco Gatsby Era',
      description: '1920s Great Gatsby luxury with emerald green felt, gold geometric patterns, and vintage glamour',
      inspiration: 'Great Gatsby, Roaring Twenties',
      colors: { primary: '#0C5C3F', secondary: '#D4AF37', accent: '#2C1810', felt: '#1a472a' },
      theme: 'vintage',
      features: ['Emerald green felt', 'Gold geometric patterns', 'Art Deco borders', 'Vintage elegance']
    },
    {
      id: 'modern-glass',
      name: 'Modern Glass Luxury',
      description: 'Contemporary transparent glass table with LED underglow, frosted surfaces, and ultra-modern aesthetic',
      inspiration: 'Modern Architecture, High-end Casinos',
      colors: { primary: '#1e40af', secondary: '#60a5fa', accent: '#0f172a', felt: 'rgba(30, 64, 175, 0.1)' },
      theme: 'modern',
      features: ['Glass/acrylic look', 'LED underglow effects', 'Frosted surfaces', 'Contemporary design']
    },
    {
      id: 'vip-lounge',
      name: 'VIP Lounge Velvet',
      description: 'Exclusive high-roller room with deep purple velvet, platinum accents, and luxurious sophistication',
      inspiration: 'Evolution Gaming VIP Tables, Monaco Casinos',
      colors: { primary: '#4C1D95', secondary: '#C0C0C0', accent: '#1e1b4b', felt: '#2e1065' },
      theme: 'exclusive',
      features: ['Deep purple velvet', 'Platinum metallic trim', 'Exclusive ambiance', 'Ultra-premium feel']
    }
  ];

  const currentDesign = designs.find(d => d.id === selectedDesign);

  // Unlock logic
  const isUnlocked = (designId) => {
    const design = designs.find(d => d.id === designId);
    // Default designs (first 2)
    if (designId === 'classic-vegas' || designId === 'minimalist-dark') return true;
    // Premium designs
    if ((designId === 'cyberpunk-neon' || designId === 'vip-lounge') && isPremium) return true;
    // Level-based unlock
    if (designId === 'modern-glass' && userLevel >= 15) return true;
    // Achievement-based unlock
    if (designId === 'art-deco-gatsby' && unlockedDesigns.includes(designId)) return true;
    return false;
  };

  const getUnlockBadge = (designId) => {
    if (designId === 'classic-vegas' || designId === 'minimalist-dark') {
      return { icon: null, text: 'FREE', color: 'text-green-400' };
    }
    if (designId === 'cyberpunk-neon' || designId === 'vip-lounge') {
      return { icon: Crown, text: 'PREMIUM', color: 'text-yellow-400' };
    }
    if (designId === 'art-deco-gatsby') {
      return { icon: Star, text: 'Win 50 Games', color: 'text-purple-400' };
    }
    if (designId === 'modern-glass') {
      return { icon: TrendingUp, text: 'Level 15', color: 'text-blue-400' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => navigate('/games')}
          className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-600 mb-2">
              Casino Table Design Showcase
            </h1>
            <p className="text-gray-400 text-lg">
              6 Premium Designs • Research-Based • Select Your Top 3 Favorites
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">Favorites Selected</p>
            <p className="text-3xl font-bold text-cyan-400">{favorites.length}/3</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Left: Design Preview */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDesign}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${currentDesign.colors.accent} 0%, ${currentDesign.colors.primary} 100%)`
              }}
            >
              {/* Table Preview */}
              <div className="p-8 min-h-[700px]">
                {/* Dealer Area */}
                <div className="flex justify-center mb-8">
                  <HumanHolographicDealer
                    dealerType="nova"
                    phrase={`Welcome to ${currentDesign.name}`}
                    size="normal"
                  />
                </div>

                {/* Casino Table */}
                <div 
                  className="relative rounded-[3rem] p-8 shadow-2xl"
                  style={{
                    background: currentDesign.theme === 'modern' 
                      ? `linear-gradient(135deg, ${currentDesign.colors.felt}, ${currentDesign.colors.primary}40)`
                      : currentDesign.colors.felt,
                    border: `4px solid ${currentDesign.colors.secondary}`,
                    boxShadow: `0 0 40px ${currentDesign.colors.secondary}40, inset 0 0 60px ${currentDesign.colors.accent}60`
                  }}
                >
                  {/* Theme-specific patterns */}
                  {currentDesign.theme === 'futuristic' && (
                    <div className="absolute inset-0 opacity-20">
                      <div className="grid grid-cols-12 grid-rows-12 h-full">
                        {[...Array(144)].map((_, i) => (
                          <div key={_.id || _.name || `item-${i}`} className="border border-cyan-400/30" />
                        ))}
                      </div>
                    </div>
                  )}

                  {currentDesign.theme === 'vintage' && (
                    <div className="absolute inset-0 opacity-10">
                      {[...Array(6)].map((_, i) => (
                        <div 
                          key={_.id || _.name || `item-${i}`}
                          className="absolute border-4"
                          style={{
                            borderColor: currentDesign.colors.secondary,
                            width: `${80 - i * 15}%`,
                            height: `${80 - i * 15}%`,
                            top: `${10 + i * 7.5}%`,
                            left: `${10 + i * 7.5}%`
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Dealer Score Badge */}
                  <div className="flex justify-center mb-6">
                    <div 
                      className="px-8 py-3 rounded-full font-bold shadow-xl backdrop-blur-sm"
                      style={{
                        background: `${currentDesign.colors.primary}cc`,
                        border: `2px solid ${currentDesign.colors.secondary}`,
                        color: currentDesign.colors.secondary
                      }}
                    >
                      Dealer: 18
                    </div>
                  </div>

                  {/* Sample Cards */}
                  <div className="flex justify-center gap-4 mb-8">
                    {['A♠', 'K♦', '7♣'].map((card, i) => (
                      <motion.div
                        key={`item-${i}`}
                        initial={{ y: -50, opacity: 0, rotate: -10 }}
                        animate={{ y: 0, opacity: 1, rotate: i === 1 ? 0 : (i === 0 ? -8 : 8) }}
                        transition={{ delay: i * 0.1 }}
                        className="w-20 h-28 bg-white rounded-lg shadow-xl flex items-center justify-center text-4xl font-bold"
                        style={{
                          boxShadow: `0 0 20px ${currentDesign.colors.secondary}60`
                        }}
                      >
                        {card}
                      </motion.div>
                    ))}
                  </div>

                  {/* Betting Area */}
                  <div className="grid grid-cols-3 gap-4 mt-12">
                    {['Hit', 'Stand', 'Double'].map((action, i) => (
                      <motion.button
                        key={action}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="py-4 rounded-xl font-bold text-lg shadow-lg transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${currentDesign.colors.primary}, ${currentDesign.colors.accent})`,
                          border: `2px solid ${currentDesign.colors.secondary}`,
                          color: currentDesign.colors.secondary
                        }}
                      >
                        {action}
                      </motion.button>
                    ))}
                  </div>

                  {/* Player Score */}
                  <div className="flex justify-center mt-8">
                    <div 
                      className="px-6 py-2 rounded-full font-bold"
                      style={{
                        background: `${currentDesign.colors.accent}dd`,
                        border: `2px solid ${currentDesign.colors.secondary}`,
                        color: currentDesign.colors.secondary
                      }}
                    >
                      Your Hand: 21
                    </div>
                  </div>
                </div>
              </div>

              {/* Favorite Badge */}
              {favorites.includes(selectedDesign) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-4 w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center shadow-xl"
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
              )}
            </motion.div>

            {/* Design Info Card */}
            <div className="mt-6 bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 border-2 border-gray-600">
              <h3 className="text-2xl font-bold text-white mb-2">{currentDesign.name}</h3>
              <p className="text-gray-300 mb-4">{currentDesign.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Inspiration</p>
                  <p className="text-white font-semibold">{currentDesign.inspiration}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Color Palette</p>
                  <div className="flex gap-2">
                    {Object.values(currentDesign.colors).slice(0, 3).map((color, i) => (
                      <div 
                        key={`item-${i}`}
                        className="w-8 h-8 rounded-full border-2 border-white/30"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Key Features</p>
                <div className="flex flex-wrap gap-2">
                  {currentDesign.features.map((feature, i) => (
                    <span 
                      key={`item-${i}`}
                      className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </AnimatePresence>
        </div>

        {/* Right: Design Selection */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white mb-4">Select Design to Preview</h3>
          
          {designs.map((design) => {
            const unlocked = isUnlocked(design.id);
            const badge = getUnlockBadge(design.id);
            const BadgeIcon = badge?.icon;
            
            return (
            <motion.button
              key={design.id}
              onClick={() => unlocked && setSelectedDesign(design.id)}
              whileHover={unlocked ? { scale: 1.02 } : {}}
              whileTap={unlocked ? { scale: 0.98 } : {}}
              disabled={!unlocked}
              className={`relative w-full text-left p-4 rounded-xl border-2 transition-all ${
                selectedDesign === design.id
                  ? 'border-yellow-400 bg-gradient-to-r from-yellow-900/40 to-amber-900/40'
                  : unlocked
                  ? 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  : 'border-gray-700 bg-gray-800/20 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Lock Overlay for Locked Designs */}
              {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl backdrop-blur-sm z-20">
                  <div className="text-center">
                    <Lock className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-300">{badge?.text}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-lg font-bold text-white">{design.name}</h4>
                <div className="flex items-center gap-2">
                  {selectedDesign === design.id && unlocked && (
                    <Eye className="w-5 h-5 text-yellow-400" />
                  )}
                  {/* Unlock Badge */}
                  <div className={`flex items-center gap-1 ${badge?.color} text-xs font-bold`}>
                    {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                    <span>{badge?.text.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-400 mb-3">{design.description}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {Object.values(design.colors).slice(0, 4).map((color, i) => (
                    <div 
                      key={`item-${i}`}
                      className="w-6 h-6 rounded border border-white/20"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(design.id);
                  }}
                  disabled={favorites.length >= 3 && !favorites.includes(design.id)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    favorites.includes(design.id)
                      ? 'bg-yellow-500 text-black'
                      : favorites.length >= 3
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {favorites.includes(design.id) ? '★ Favorite' : '☆ Add'}
                </button>
              </div>
            </motion.button>
          );
          })}

          {/* User Progress Info */}
          <div className="mt-6 p-4 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border-2 border-cyan-500/30 rounded-xl">
            <h4 className="text-sm font-bold text-cyan-400 mb-2">Unlock Progress</h4>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Your Level:</span>
                <span className="font-bold text-white">{userLevel} / 15</span>
              </div>
              <div className="flex justify-between">
                <span>Premium Status:</span>
                <span className={`font-bold ${isPremium ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {isPremium ? '✓ Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Unlocked Designs:</span>
                <span className="font-bold text-white">{unlockedDesigns.length} / 6</span>
              </div>
            </div>
            {!isPremium && (
              <button className="mt-3 w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold py-2 rounded-lg hover:from-yellow-600 hover:to-amber-700 transition-all">
                <Crown className="w-4 h-4 inline mr-2" />
                Upgrade to Premium
              </button>
            )}
          </div>

          {/* Selection Summary */}
          <div className="mt-6 p-6 bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border-2 border-yellow-500/30 rounded-xl">
            <h4 className="text-lg font-bold text-yellow-400 mb-3">
              Your Top 3 Favorites
            </h4>
            {favorites.length === 0 ? (
              <p className="text-gray-400 text-sm">Select up to 3 designs to mark as favorites</p>
            ) : (
              <ul className="space-y-2">
                {favorites.map((fav, i) => {
                  const design = designs.find(d => d.id === fav);
                  return (
                    <li key={fav} className="flex items-center gap-2 text-white">
                      <span className="text-yellow-400 font-bold">{i + 1}.</span>
                      {design.name}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
