import React, { useState } from 'react';
import { motion } from 'framer-motion';
import HumanHolographicDealer from '../components/casino/HumanHolographicDealer';
import { ArrowLeft, Shuffle, Play, PartyPopper } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Showcase page for all 4 diverse holographic dealers
 */
export default function DealerShowcase() {
  const navigate = useNavigate();
  const [activeDealer, setActiveDealer] = useState('nova');
  const [isDealing, setIsDealing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);

  const dealers = [
    { 
      id: 'nova', 
      name: 'NOVA', 
      description: 'Professional African dealer with expertise in high-stakes games',
      specialty: 'Blackjack & Poker',
      gradient: 'from-amber-600 to-yellow-700'
    },
    { 
      id: 'ace', 
      name: 'ACE', 
      description: 'Friendly Asian dealer known for creating welcoming atmospheres',
      specialty: 'Roulette & Baccarat',
      gradient: 'from-blue-600 to-cyan-700'
    },
    { 
      id: 'ruby', 
      name: 'RUBY', 
      description: 'Elegant Latina dealer specializing in premium table games',
      specialty: 'Poker & Casino War',
      gradient: 'from-red-600 to-pink-700'
    },
    { 
      id: 'jade', 
      name: 'JADE', 
      description: 'Modern mixed-heritage dealer with tournament experience',
      specialty: 'All Games',
      gradient: 'from-green-600 to-emerald-700'
    }
  ];

  const currentDealer = dealers.find(d => d.id === activeDealer);

  const triggerAnimation = (type) => {
    if (type === 'deal') {
      setIsDealing(true);
      setTimeout(() => setIsDealing(false), 3000);
    } else if (type === 'shuffle') {
      setIsShuffling(true);
      setTimeout(() => setIsShuffling(false), 4000);
    } else if (type === 'celebrate') {
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => navigate('/games')}
          className="mb-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>
        
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-2">
          Meet Your Holographic Dealers
        </h1>
        <p className="text-gray-400 text-lg">
          Choose from our diverse team of professional AI dealers
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8">
        {/* Left: Dealer Display */}
        <div className="relative">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border-2 border-cyan-500/30 rounded-3xl p-8 min-h-[600px] flex flex-col items-center justify-center">
            {/* Dealer Name Badge */}
            <motion.div
              key={activeDealer}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`mb-6 px-8 py-3 rounded-full bg-gradient-to-r ${currentDealer.gradient} border-2 border-white/20 shadow-xl`}
            >
              <h2 className="text-white text-2xl font-black">{currentDealer.name}</h2>
            </motion.div>

            {/* Dealer Component */}
            <motion.div
              key={activeDealer}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <HumanHolographicDealer
                dealerType={activeDealer}
                phrase={
                  isCelebrating ? "🎉 Winner! Congratulations!" :
                  isDealing ? "Dealing cards..." :
                  isShuffling ? "Shuffling the deck..." :
                  `Welcome! I'm ${currentDealer.name}`
                }
                isDealing={isDealing}
                isShuffling={isShuffling}
                isCelebrating={isCelebrating}
                size="large"
              />
            </motion.div>

            {/* Animation Controls */}
            <div className="mt-8 flex gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => triggerAnimation('shuffle')}
                disabled={isShuffling || isDealing || isCelebrating}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold rounded-xl border-2 border-purple-400/50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Shuffle className="w-5 h-5" />
                Shuffle
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => triggerAnimation('deal')}
                disabled={isShuffling || isDealing || isCelebrating}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl border-2 border-blue-400/50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Deal
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => triggerAnimation('celebrate')}
                disabled={isShuffling || isDealing || isCelebrating}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white font-bold rounded-xl border-2 border-yellow-400/50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <PartyPopper className="w-5 h-5" />
                Celebrate
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right: Dealer Selection */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white mb-4">Select Your Dealer</h3>
          
          {dealers.map((dealer) => (
            <motion.button
              key={dealer.id}
              onClick={() => setActiveDealer(dealer.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full text-left p-6 rounded-2xl border-2 transition-all ${
                activeDealer === dealer.id
                  ? `bg-gradient-to-r ${dealer.gradient} border-white/50 shadow-2xl`
                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className={`text-2xl font-black mb-2 ${
                    activeDealer === dealer.id ? 'text-white' : 'text-gray-300'
                  }`}>
                    {dealer.name}
                  </h4>
                  <p className={`text-sm mb-3 ${
                    activeDealer === dealer.id ? 'text-white/90' : 'text-gray-400'
                  }`}>
                    {dealer.description}
                  </p>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    activeDealer === dealer.id 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {dealer.specialty}
                  </div>
                </div>
                
                {activeDealer === dealer.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </motion.div>
                )}
              </div>
            </motion.button>
          ))}

          {/* Info Box */}
          <div className="mt-8 p-6 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 backdrop-blur-sm border-2 border-cyan-500/30 rounded-2xl">
            <h4 className="text-cyan-400 font-bold mb-2 flex items-center gap-2">
              <span className="text-2xl">✨</span>
              Holographic Technology
            </h4>
            <p className="text-gray-300 text-sm">
              Our AI dealers are rendered using pure CSS/SVG with holographic overlays. 
              Each dealer has unique animations, diverse appearances, and professional personalities 
              to enhance your gaming experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
