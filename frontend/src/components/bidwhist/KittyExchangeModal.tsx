
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Clock } from 'lucide-react';
import ImperialCard from '@/components/bidwhist/ImperialCard';

const KITTY_TIMER = 30; // 30 seconds to make decision

export default function KittyExchangeModal({ kittyCards = [], 
  yourHand = [], 
  onSubmit, 
  onClose }: { kittyCards?: any, yourHand?: any, onSubmit?: any, onClose?: any }) {
  const [selectedTrump, setSelectedTrump] = useState(null);
  const [selectedDiscards, setSelectedDiscards] = useState([]);
  const [timeLeft, setTimeLeft] = useState(KITTY_TIMER);
  const [showWarning, setShowWarning] = useState(false);
  
  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      // Auto-submit with first available trump and random discards
      handleAutoSubmit();
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    // Show warning at 10 seconds
    if (timeLeft === 10) {
      setShowWarning(true);
    }
    
    return () => clearInterval(timer);
  }, [timeLeft]);
  
  const handleAutoSubmit = () => {
    // Auto-select first trump option
    const autoTrump = 'spades';
    
    // Auto-select first 6 cards from combined hand
    const combinedHand = [...yourHand, ...kittyCards];
    const autoDiscards = combinedHand.slice(0, 6);
    
    onSubmit(autoTrump, autoDiscards);
  };
  
  const trumpOptions = [
    { suit: 'spades', label: 'Spades', symbol: '♠', color: 'from-slate-700 to-slate-900' },
    { suit: 'hearts', label: 'Hearts', symbol: '♥', color: 'from-red-600 to-red-800' },
    { suit: 'diamonds', label: 'Diamonds', symbol: '♦', color: 'from-red-600 to-red-800' },
    { suit: 'clubs', label: 'Clubs', symbol: '♣', color: 'from-slate-700 to-slate-900' },
    { suit: 'no_trump', label: 'No Trump', symbol: '⊗', color: 'from-purple-600 to-pink-600' }
  ];
  
  const handleTrumpSelect = (suit) => {
    setSelectedTrump(suit);
  };
  
  const handleCardSelect = (card) => {
    if (selectedDiscards.find(c => c.suit === card.suit && c.rank === card.rank)) {
      // Deselect
      setSelectedDiscards(selectedDiscards.filter(c => !(c.suit === card.suit && c.rank === card.rank)));
    } else if (selectedDiscards.length < 6) {
      // Select (max 6)
      setSelectedDiscards([...selectedDiscards, card]);
    }
  };
  
  const handleSubmit = () => {
    if (!selectedTrump) {
      alert('Please select a trump suit!');
      return;
    }
    
    if (selectedDiscards.length !== 6) {
      alert('Please select exactly 6 cards to discard!');
      return;
    }
    
    onSubmit(selectedTrump, selectedDiscards);
  };
  
  const combinedHand = [...yourHand, ...kittyCards];
  const canSubmit = selectedTrump && selectedDiscards.length === 6;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 50 }}
          className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-3xl border-2 border-amber-500 shadow-[0_0_60px_rgba(251,191,36,0.3)] max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 to-yellow-500 p-6 rounded-t-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Crown className="w-12 h-12 text-white drop-shadow-lg animate-pulse" />
                <div>
                  <h2 className="text-3xl font-['Cinzel'] text-white font-black tracking-wide">
                    You Won the Bid!
                  </h2>
                  <p className="text-amber-100 text-sm flex items-center gap-2 mt-1">
                    <Sparkles className="w-4 h-4" />
                    Choose Trump & Discard 6 Cards
                  </p>
                </div>
              </div>
              
              {/* Timer */}
              <div className={`flex items-center gap-3 px-6 py-3 rounded-xl ${
                timeLeft <= 10 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-white/20 backdrop-blur-md'
              }`}>
                <Clock className={`w-6 h-6 ${timeLeft <= 10 ? 'text-white' : 'text-amber-200'}`} />
                <div className="text-center">
                  <div className={`text-3xl font-black ${timeLeft <= 10 ? 'text-white' : 'text-white'}`}>
                    {timeLeft}s
                  </div>
                  <div className="text-xs text-white/80">Remaining</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Warning Message */}
          {showWarning && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border-l-4 border-red-500 p-4 mx-6 mt-4 rounded-lg"
            >
              <p className="text-red-200 font-bold">⚠️ Hurry! Auto-submit in {timeLeft} seconds!</p>
            </motion.div>
          )}
          
          {/* Kitty Cards - Highlighted */}
          <div className="p-6 border-b border-amber-500/30">
            <h3 className="text-xl font-['Cinzel'] text-amber-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              The Kitty (6 New Cards)
            </h3>
            <div className="flex justify-center gap-3 flex-wrap">
              {kittyCards.map((card, idx) => (
                <motion.div
                  key={`kitty-${idx}`}
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: idx * 0.1, type: 'spring' }}
                  className="relative"
                >
                  <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 to-yellow-300 rounded-lg blur opacity-50 animate-pulse"></div>
                  <ImperialCard card={card} size="md" />
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Trump Selection */}
          <div className="p-6 border-b border-purple-500/30">
            <h3 className="text-xl font-['Cinzel'] text-purple-300 mb-4">Select Trump Suit</h3>
            <div className="grid grid-cols-5 gap-3">
              {trumpOptions.map((option) => (
                <motion.button
                  key={option.suit}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTrumpSelect(option.suit)}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all
                    ${selectedTrump === option.suit 
                      ? 'border-amber-400 bg-gradient-to-br ' + option.color + ' shadow-lg shadow-amber-500/50' 
                      : 'border-slate-600 bg-slate-800/50 hover:border-purple-400'
                    }
                  `}
                >
                  {selectedTrump === option.suit && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                      <span className="text-slate-900 font-black text-xs">✓</span>
                    </div>
                  )}
                  <div className="text-4xl mb-2">{option.symbol}</div>
                  <div className="text-xs text-white font-bold">{option.label}</div>
                </motion.button>
              ))}
            </div>
          </div>
          
          {/* Discard Selection */}
          <div className="p-6">
            <h3 className="text-xl font-['Cinzel'] text-blue-300 mb-3">
              Select 6 Cards to Discard ({selectedDiscards.length}/6)
            </h3>
            <div className="flex justify-center gap-2 flex-wrap">
              {combinedHand.map((card, idx) => {
                const isSelected = selectedDiscards.find(c => c.suit === card.suit && c.rank === card.rank);
                const isKittyCard = kittyCards.find(c => c.suit === card.suit && c.rank === card.rank);
                
                return (
                  <motion.div
                    key={`combined-${idx}`}
                    whileHover={{ y: -10 }}
                    onClick={() => handleCardSelect(card)}
                    className={`cursor-pointer relative ${isSelected ? 'ring-4 ring-red-500 rounded-lg' : ''}`}
                  >
                    {isKittyCard && !isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full text-xs flex items-center justify-center text-slate-900 font-black">
                        K
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-black">X</span>
                      </div>
                    )}
                    <ImperialCard card={card} size="sm" selected={isSelected} />
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="p-6 bg-slate-900/50 rounded-b-3xl flex gap-4">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 py-6 text-lg font-bold ${
                canSubmit
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                  : 'bg-slate-700 cursor-not-allowed'
              }`}
            >
              <Crown className="w-5 h-5 mr-2" />
              Confirm Trump & Discards
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
