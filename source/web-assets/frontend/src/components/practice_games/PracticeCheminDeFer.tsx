import React, { useState } from 'react';
import { motion } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import CasinoCard from '@/components/casino/CasinoCard';

const GameState = {
  AUCTION_BANK: 'AUCTION_BANK',
  BETTING: 'BETTING',
  PLAYER_DECISION: 'PLAYER_DECISION',
  RESULT: 'RESULT'
};

const CheminDeFer = () => {
  const [bankerId] = useState('VIBEZ_PLAYER_01');
  const [bankerTotal] = useState(10000);
  const [currentState, setCurrentState] = useState(GameState.BETTING);
  const [playerHand, setPlayerHand] = useState([]);
  const [bankerHand, setBankerHand] = useState([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [bankerScore, setBankerScore] = useState(0);
  const [betOn, setBetOn] = useState('player');
  const [betAmount, setBetAmount] = useState(0);
  const [credits, setCredits] = useState(5000);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const createDeck = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    return suits.flatMap(suit => values.map(value => ({ suit, value })));
  };

  const shuffle = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const getCardValue = (card) => {
    if (['J', 'Q', 'K'].includes(card.value)) return 0;
    if (card.value === 'A') return 1;
    return parseInt(card.value);
  };

  const calculateScore = (hand) => {
    return hand.reduce((sum, card) => sum + getCardValue(card), 0) % 10;
  };

  const handleDeal = () => {
    if (betAmount === 0) return;

    cardSoundManager.playCardShuffle();
    const deck = shuffle(createDeck());
    const pHand = [deck[0], deck[2]];
    const bHand = [deck[1], deck[3]];

    setPlayerHand(pHand);
    setBankerHand(bHand);
    setPlayerScore(calculateScore(pHand));
    setBankerScore(calculateScore(bHand));

    const pScore = calculateScore(pHand);
    
    // Key Rule: Player has choice on 5
    if (pScore === 5) {
      setCurrentState(GameState.PLAYER_DECISION);
    } else {
      setTimeout(() => {
        setCurrentState(GameState.RESULT);
      }, 2000);
    }
  };

  const handleDecision = (choice) => {
    cardSoundManager.playCardFlip();
    
    if (choice === 'DRAW') {
      const deck = shuffle(createDeck());
      const newCard = deck[0];
      const newPHand = [...playerHand, newCard];
      setPlayerHand(newPHand);
      setPlayerScore(calculateScore(newPHand));
    }
    
    setTimeout(() => {
      setCurrentState(GameState.RESULT);
    }, 1500);
  };

  const placeBet = (side) => {
    if (currentState !== GameState.BETTING) return;
    setBetOn(side);
    setBetAmount(100);
    setCredits(credits - 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" 
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <div className="w-[900px]">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
            CHEMIN DE FER
          </h1>
          <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Player Choice on 5</p>
        </motion.div>

        <div className={`w-full h-[400px] ${glassEffect} rounded-full relative flex flex-col items-center justify-center mb-8`}>
          {/* Social Feature: Banker Display */}
          <div className="absolute -top-12 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-2 border-[#00F0FF] bg-slate-900 mb-2 overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-500 opacity-50" />
            </div>
            <p className="text-[10px] text-white font-bold uppercase">Current Banker</p>
            <p className="text-[#00F0FF] font-black italic">{bankerId}</p>
            <p className="text-[#D4AF37] text-sm font-bold">${bankerTotal}</p>
          </div>

          {/* Game Display */}
          <div className="flex gap-16 items-center">
            {/* Banker Hand */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Banker</p>
              <div className="flex gap-2 mb-2">
                {bankerHand.map((card, idx) => (
                  <CasinoCard
                    key={`banker-${card.suit}-${card.value}-${idx}`}
                    value={card.value}
                    suit={card.suit}
                    isFaceUp={true}
                    animate={true}
                  />
                ))}
              </div>
              <p className="text-[#D4AF37] text-3xl font-black">{bankerScore}</p>
            </div>

            {/* Player Hand */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Player</p>
              <div className="flex gap-2 mb-2">
                {playerHand.map((card, idx) => (
                  <CasinoCard
                    key={`player-${card.suit}-${card.value}-${idx}`}
                    value={card.value}
                    suit={card.suit}
                    isFaceUp={true}
                    animate={true}
                  />
                ))}
              </div>
              <p className="text-[#00F0FF] text-3xl font-black">{playerScore}</p>
            </div>
          </div>

          {/* Action Buttons */}
          {currentState === GameState.PLAYER_DECISION && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex gap-4 mt-8"
            >
              <button 
                onClick={() => handleDecision('STAND')} 
                className="px-8 py-3 bg-white/10 text-white font-bold uppercase border border-white/20 hover:bg-white/20 transition-all"
              >
                Stand
              </button>
              <button 
                onClick={() => handleDecision('DRAW')} 
                className="px-8 py-3 bg-[#00F0FF] text-black font-bold uppercase hover:bg-[#00F0FF]/80 transition-all"
              >
                Draw Card
              </button>
            </motion.div>
          )}
        </div>

        {/* Betting Area */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.button
            onClick={() => placeBet('player')}
            disabled={currentState !== GameState.BETTING}
            whileHover={{ scale: 1.05 }}
            className={`p-6 rounded-xl border-2 transition-all disabled:opacity-30 ${betOn === 'player' ? 'border-[#457B9D] bg-[#457B9D]/20' : 'border-white/20'}`}
          >
            <p className="text-white font-bold mb-2">PLAYER</p>
            <p className="text-[#D4AF37] text-sm">1:1</p>
          </motion.button>

          <motion.button
            onClick={() => placeBet('tie')}
            disabled={currentState !== GameState.BETTING}
            whileHover={{ scale: 1.05 }}
            className={`p-6 rounded-xl border-2 transition-all disabled:opacity-30 ${betOn === 'tie' ? 'border-[#D4AF37] bg-[#D4AF37]/20' : 'border-white/20'}`}
          >
            <p className="text-white font-bold mb-2">TIE</p>
            <p className="text-[#D4AF37] text-sm">8:1</p>
          </motion.button>

          <motion.button
            onClick={() => placeBet('banker')}
            disabled={currentState !== GameState.BETTING}
            whileHover={{ scale: 1.05 }}
            className={`p-6 rounded-xl border-2 transition-all disabled:opacity-30 ${betOn === 'banker' ? 'border-[#E63946] bg-[#E63946]/20' : 'border-white/20'}`}
          >
            <p className="text-white font-bold mb-2">BANKER</p>
            <p className="text-[#D4AF37] text-sm">0.95:1</p>
          </motion.button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleDeal}
            disabled={currentState !== GameState.BETTING || betAmount === 0}
            className="px-12 py-4 bg-[#00F0FF] text-black font-black uppercase disabled:opacity-30 disabled:bg-gray-600 transition-all hover:scale-105"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            Deal Cards
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheminDeFer;
