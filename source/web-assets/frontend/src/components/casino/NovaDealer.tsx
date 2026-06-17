import React, { useState, useEffect } from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// AI Holographic Dealer - Fully Animated (Option B)
// No video files needed - uses animated gradients, particles, and effects

const DEALER_PHRASES = {
  welcome: [
    "Welcome to Vibes Casino! I'm Nova, your dealer.",
    "Ready to test your luck? Let's play!",
    "Good vibes only at this table!"
  ],
  placeBets: [
    "Place your bets, please!",
    "Time to make your move!",
    "Feeling lucky? Place your bets!"
  ],
  noMoreBets: [
    "No more bets!",
    "Bets are closed!",
    "Here we go!"
  ],
  dealing: [
    "Dealing the cards now...",
    "And here we go!",
    "Let's see what you get!"
  ],
  shuffle: [
    "Shuffling the deck...",
    "Let me shuffle these cards for you.",
    "Fresh shuffle coming up!"
  ],
  playerWins: [
    "Congratulations! You win! 🎉",
    "Amazing! Winner winner!",
    "The vibes are with you today!",
    "What a win! Incredible!"
  ],
  playerLoses: [
    "Better luck next time!",
    "The house wins this round.",
    "Don't give up, keep playing!",
    "Next hand could be yours!"
  ],
  bigWin: [
    "🚨 JACKPOT! INCREDIBLE WIN! 🚨",
    "WOW! What a massive win!",
    "You just hit it BIG!"
  ],
  playerTurn: [
    "Your turn! What will you do?",
    "It's all you now!",
    "Make your move!"
  ],
  goodMove: [
    "Nice play!",
    "Smart move!",
    "I like your style!"
  ],
  riskyMove: [
    "Ooh, risky! I like it!",
    "Bold choice!",
    "Let's see if it pays off!"
  ],
  bust: [
    "Oh no, bust!",
    "Too many points!",
    "Over the limit!"
  ]
};

export default function NovaDealer({ 
  phrase = 'welcome', 
  isAnimating = false,
  mood = 'neutral', // neutral, happy, excited, professional
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  size = 'normal' // small, normal, large
}) {
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [dealingCards, setDealingCards] = useState([]);

  useEffect(() => {
    const phrases = DEALER_PHRASES[phrase] || DEALER_PHRASES.welcome;
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    setCurrentPhrase(randomPhrase);
    setShowBubble(true);

    const timer = setTimeout(() => setShowBubble(false), 4000);
    return () => clearTimeout(timer);
  }, [phrase]);

  // Handle card dealing animation
  useEffect(() => {
    if (isDealing) {
      // Create card dealing effect
      const cards = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        delay: i * 0.2
      }));
      setDealingCards(cards);
      
      setTimeout(() => setDealingCards([]), 2000);
    }
  }, [isDealing]);

  const getMoodGradient = () => {
    switch(mood) {
      case 'happy': return 'from-green-400 to-cyan-400';
      case 'excited': return 'from-yellow-400 to-pink-500';
      case 'professional': return 'from-blue-400 to-indigo-500';
      default: return 'from-purple-400 to-pink-500';
    }
  };

  const getStatusText = () => {
    if (isCelebrating) return '🎉 Celebrating!';
    if (isShuffling) return '🎴 Shuffling...';
    if (isDealing) return '🃏 Dealing...';
    return '✨ Ready';
  };

  const sizeClasses = {
    small: 'w-32 h-32',
    normal: 'w-48 h-48',
    large: 'w-64 h-64'
  };

  return (
    <div className="relative">
      {/* Speech Bubble */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute -top-20 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl px-6 py-3 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/50 max-w-md backdrop-blur-sm">
              <p className="text-white text-center font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                {currentPhrase}
              </p>
            </div>
            {/* Bubble pointer */}
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-pink-900 mx-auto" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dealing Card Animation */}
      <AnimatePresence>
        {dealingCards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{ 
              x: [0, 100 + card.id * 50, 200 + card.id * 50],
              y: [0, -50, 100],
              opacity: [1, 1, 0],
              scale: [0.5, 1, 0.8],
              rotate: [0, 360, 720]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, delay: card.delay }}
            className="absolute top-1/2 left-1/2 w-12 h-16 bg-red-600 rounded-md shadow-xl border-2 border-white pointer-events-none"
            style={{ zIndex: 1000 + card.id }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-white text-2xl">
              🃏
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Dealer Avatar */}
      <div className={`relative ${sizeClasses[size]} mx-auto`}>
        {/* Holographic glow effect */}
        <motion.div 
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${getMoodGradient()} opacity-30 blur-2xl`}
          animate={isAnimating ? { opacity: [0.3, 0.6, 0.3] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Outer ring */}
        <motion.div 
          className={`absolute inset-0 rounded-full border-4 border-cyan-400`}
          animate={isAnimating || isShuffling ? { rotate: 360 } : {}}
          transition={{ duration: 2, repeat: isAnimating ? Infinity : 0, ease: 'linear' }}
        >
          <div className="absolute inset-2 rounded-full border-2 border-pink-400" />
        </motion.div>

        {/* Avatar container with VIDEO */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900 border-4 border-white/20 overflow-hidden flex items-center justify-center">
          {/* Holographic scanlines effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-scan" />
          
          {/* Pulse effect during actions */}
          {(isShuffling || isDealing || isCelebrating) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-pink-400/20"
            />
          )}
          
          {/* Dealer AVATAR - Realistic Casino Dealer */}
          <motion.div 
            className="relative z-10 w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-gray-800 via-gray-900 to-black shadow-2xl"
            animate={isShuffling ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 0.5, repeat: isShuffling ? Infinity : 0 }}
          >
            {/* Casino background ambiance */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-green-900/30" />
            
            {/* Realistic AI Dealer Figure */}
            <div className="w-full h-full relative flex flex-col items-center justify-end pb-4">
              {/* Dealer Head/Face */}
              <div className="relative mb-3">
                {/* Head shape with skin tone */}
                <div className="w-20 h-24 bg-gradient-to-b from-amber-100 to-amber-200 rounded-[40%_40%_45%_45%] relative shadow-lg">
                  {/* Hair */}
                  <div className="absolute -top-3 -left-2 w-24 h-16 bg-gradient-to-b from-gray-800 to-gray-900 rounded-t-full" />
                  
                  {/* Eyes */}
                  <div className="absolute top-10 left-4 flex gap-6">
                    <motion.div 
                      className="w-2 h-2 bg-gray-900 rounded-full"
                      animate={{ scaleY: [1, 0.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.div 
                      className="w-2 h-2 bg-gray-900 rounded-full"
                      animate={{ scaleY: [1, 0.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                  </div>
                  
                  {/* Smile */}
                  <motion.div 
                    className="absolute top-16 left-6 w-8 h-3 border-b-2 border-gray-800 rounded-b-full"
                    animate={isCelebrating ? { scaleX: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, repeat: isCelebrating ? Infinity : 0 }}
                  />
                </div>
              </div>
              
              {/* Dealer Body - Professional Attire */}
              <div className="relative">
                {/* Vest/Uniform Top */}
                <div className="w-32 h-20 bg-gradient-to-b from-red-900 via-red-950 to-black rounded-t-3xl relative">
                  {/* White shirt collar */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-8 bg-white rounded-t-lg border-2 border-gray-300" />
                  
                  {/* Bow tie */}
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-8 h-3 bg-black rounded flex items-center justify-center">
                      <div className="w-2 h-3 bg-black" />
                    </div>
                  </div>
                  
                  {/* Gold buttons */}
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-md" />
                    <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-md" />
                  </div>
                </div>
                
                {/* Hands dealing cards */}
                <motion.div 
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2"
                  animate={isDealing ? { 
                    y: [0, -10, 0],
                    rotate: [0, -5, 0]
                  } : {}}
                  transition={{ duration: 0.6, repeat: isDealing ? Infinity : 0 }}
                >
                  {/* Left hand */}
                  <div className="w-6 h-8 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg relative">
                    <div className="absolute bottom-0 w-full h-2 bg-amber-200/50 rounded-b-lg" />
                  </div>
                  
                  {/* Card in hand */}
                  {isDealing && (
                    <motion.div
                      initial={{ scale: 0, rotate: 0 }}
                      animate={{ 
                        scale: [0, 1, 1],
                        rotate: [0, 10, 5],
                        y: [0, -15, -10]
                      }}
                      transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.8 }}
                      className="w-5 h-7 bg-white border-2 border-red-600 rounded shadow-xl"
                    >
                      <div className="text-red-600 text-xs text-center mt-1">A♥</div>
                    </motion.div>
                  )}
                  
                  {/* Right hand */}
                  <div className="w-6 h-8 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg relative">
                    <div className="absolute bottom-0 w-full h-2 bg-amber-200/50 rounded-b-lg" />
                  </div>
                </motion.div>
              </div>
              
              {/* Shuffle animation - cards flying */}
              {isShuffling && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={_.id || _.name || `item-${i}`}
                      className="absolute w-4 h-6 bg-white border border-gray-300 rounded shadow-lg"
                      style={{
                        left: `${30 + i * 10}%`,
                        top: `${40 + (i % 2) * 10}%`
                      }}
                      animate={{
                        y: [0, -20, -10, -30, 0],
                        x: [0, 10, -5, 15, 0],
                        rotate: [0, 45, -30, 60, 0],
                        opacity: [0.8, 1, 0.9, 1, 0.8]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    >
                      <div className="text-[6px] text-center mt-1 text-red-600">🂡</div>
                    </motion.div>
                  ))}
                </>
              )}
              
              {/* Celebration confetti */}
              {isCelebrating && (
                <>
                  {[...Array(10)].map((_, i) => (
                    <motion.div
                      key={_.id || _.name || `item-${i}`}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 60}%`,
                        backgroundColor: ['#FFD700', '#FF1493', '#00CED1', '#FF4500'][i % 4]
                      }}
                      animate={{
                        y: [0, -50, -100],
                        x: [0, (Math.random() - 0.5) * 40],
                        rotate: [0, 360],
                        opacity: [1, 1, 0],
                        scale: [1, 1.5, 0]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.15
                      }}
                    />
                  ))}
                </>
              )}
            </div>
            
            {/* Professional lighting effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
          </motion.div>
          
          {/* Cyberpunk elements overlay */}
          <motion.div 
            className="absolute -top-2 -right-2 z-20"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          </motion.div>
          <motion.div 
            className="absolute -bottom-2 -left-2 z-20"
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-6 h-6 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
          </motion.div>

          {/* Name badge */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-1 rounded-full border border-cyan-400 backdrop-blur-sm">
            <p className="text-cyan-400 font-bold text-sm">NOVA</p>
          </div>
        </div>
      </div>

      {/* Dealer info */}
      <div className="text-center mt-4">
        <p className="text-pink-300 text-sm">AI Holographic Dealer</p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-cyan-400 text-xs mt-1 font-semibold"
        >
          {getStatusText()}
        </motion.p>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }}
          />
        ))}
      </div>
    </div>
  );
}