import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Sparkles, Zap, Shield, Activity } from 'lucide-react';
import { useDealerGreeting, useDealerVibe, useDealerReaction, useProvablyFairDeck } from '../../hooks/useDealerAPI';
import { useDealerWebSocket } from '../../hooks/useDealerWebSocket';

const AIDealerHero = ({ userName = "Player", userId = "demo_user" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [currentMessage, setCurrentMessage] = useState("");
  const [dealerAnimation, setDealerAnimation] = useState("neutral");
  const [dealerMood, setDealerMood] = useState("Neutral");
  const [showFairnessHash, setShowFairnessHash] = useState(false);

  // Backend integration hooks
  const { greeting, loading: greetingLoading } = useDealerGreeting(userId, userName);
  const { vibe, personality, fetchVibe } = useDealerVibe();
  const { reaction, getReaction } = useDealerReaction();
  const { deckData, generateFairDeck } = useProvablyFairDeck();

  // WebSocket connection for real-time dealer updates - use useMemo to prevent gameId regeneration
  const gameId = useMemo(() => `hero_${userId}_${Date.now()}`, [userId]);
  
  const handleDealerReaction = useCallback((reactionData) => {
    setDealerAnimation(reactionData.animation || 'neutral');
    if (reactionData.voice_line) {
      setCurrentMessage(reactionData.voice_line);
      setIsPlaying(true);
    }
  }, []);

  const handleDealerCommentary = useCallback((commentaryData) => {
    if (commentaryData.voice_line) {
      setCurrentMessage(commentaryData.voice_line);
      setIsPlaying(true);
    }
  }, []);

  const { isConnected, sendGameEvent } = useDealerWebSocket(
    gameId,
    handleDealerReaction,
    handleDealerCommentary
  );

  // Initialize dealer greeting and vibe
  useEffect(() => {
    if (greeting && !greetingLoading) {
      setCurrentMessage(greeting.greeting);
      setDealerAnimation(greeting.animation || 'welcoming_gesture');
      setIsPlaying(true);
    }
  }, [greeting, greetingLoading]);

  // Fetch dealer vibe based on mock player stats
  useEffect(() => {
    const playerStats = {
      player_id: userId,
      session_net: 0,
      win_rate: 0.5,
      high_stakes: false,
      games_played: 0
    };
    fetchVibe(playerStats);
  }, [userId, fetchVibe]);

  // Update mood when vibe changes
  useEffect(() => {
    if (vibe) {
      setDealerMood(vibe);
    }
  }, [vibe]);

  // Generate provably fair deck on mount
  useEffect(() => {
    const initFairDeck = async () => {
      await generateFairDeck();
    };
    initFairDeck();
  }, [generateFairDeck]);

  const handlePlayAudio = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Trigger a dealer reaction via WebSocket
      sendGameEvent('idle_short', { player_name: userName });
    }
  };

  const handleShowFairnessProof = () => {
    setShowFairnessHash(true);
    setTimeout(() => setShowFairnessHash(false), 5000);
  };

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-purple-950/40 via-[#0A0A0A] to-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left: AI Dealer 3D/Video Section */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative order-2 lg:order-1"
          >
            {/* MetaHuman Container */}
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/20 to-cyan-900/20 backdrop-blur-xl border-2 border-white/10">
              
              {/* Placeholder for MetaHuman/Video */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* TODO: Replace with actual MetaHuman embed or video */}
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-br from-cyan-500/30 via-purple-500/30 to-pink-500/30 rounded-full blur-3xl"
                />
                
                {/* Dealer Avatar Placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="text-9xl sm:text-[12rem] filter drop-shadow-2xl"
                  >
                    🎩
                  </motion.div>
                </div>
              </div>

              {/* Holographic Effect */}
              <motion.div
                animate={{
                  backgroundPosition: ['0% 0%', '100% 100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                  backgroundSize: '200% 200%'
                }}
              />

              {/* Live Indicator with WebSocket Status */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className={`${isConnected ? 'bg-green-600/90' : 'bg-red-600/90'} backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-white/20`}>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-bold">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
                
                {/* Dealer Mood Badge */}
                <div className="bg-purple-600/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-white/20">
                  <Activity className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-semibold">{dealerMood}</span>
                </div>
              </div>

              {/* Provably Fair Badge */}
              {deckData && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={handleShowFairnessProof}
                  className="absolute top-4 right-4 bg-emerald-600/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 hover:bg-emerald-500/90 transition-all"
                  title="Click to view Provably Fair hash"
                >
                  <Shield className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-bold">PROVABLY FAIR</span>
                </motion.button>
              )}

              {/* Fairness Hash Overlay */}
              <AnimatePresence>
                {showFairnessHash && deckData && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-20 left-4 right-4 bg-black/95 backdrop-blur-xl border border-emerald-500/50 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-emerald-400 font-bold text-sm mb-2">Provably Fair Verification</p>
                        <p className="text-white/70 text-xs mb-2 break-all font-mono">
                          {deckData.verification_hash}
                        </p>
                        <p className="text-white/50 text-xs italic">{deckData.message}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Audio Controls */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-full flex items-center justify-center border border-white/20 transition-all"
                  title="Toggle Subtitles"
                >
                  <span className="text-white text-xs font-bold">CC</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAudioMuted(!audioMuted)}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md hover:bg-black/80 rounded-full flex items-center justify-center border border-white/20 transition-all"
                >
                  {audioMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </motion.button>
              </div>

              {/* Subtitles - Dynamic from Backend */}
              <AnimatePresence mode="wait">
                {showSubtitles && isPlaying && currentMessage && (
                  <motion.div
                    key={currentMessage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute bottom-16 left-4 right-4"
                  >
                    <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                      <p className="text-white text-center font-semibold text-base sm:text-lg">
                        "{currentMessage}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl -z-10" />
          </motion.div>

          {/* Right: Welcome Message & CTA */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            className="order-1 lg:order-2 space-y-6 sm:space-y-8"
          >
            {/* Welcome Badge */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-4 py-2 rounded-full"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-bold">VIP Member</span>
            </motion.div>

            {/* Main Headline */}
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight"
              >
                Welcome Back,{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {userName}
                </span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-white/70 text-lg sm:text-xl max-w-xl leading-relaxed"
              >
                Your personal AI dealer is ready at the Celestial Lounge. 
                The cards are shuffled, the dice are warm, and the tables are waiting.
              </motion.p>
            </div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-3 gap-4"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                <p className="text-cyan-400 font-black text-2xl sm:text-3xl mb-1">12</p>
                <p className="text-white/60 text-xs sm:text-sm">Games Won</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                <p className="text-purple-400 font-black text-2xl sm:text-3xl mb-1">5</p>
                <p className="text-white/60 text-xs sm:text-sm">New Vibes</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                <p className="text-pink-400 font-black text-2xl sm:text-3xl mb-1">94%</p>
                <p className="text-white/60 text-xs sm:text-sm">Match Rate</p>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlayAudio}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-black py-4 px-8 rounded-xl shadow-2xl flex items-center justify-center gap-3 transition-all"
              >
                {isPlaying ? (
                  <>
                    <Zap className="w-5 h-5" />
                    Listening...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Hear My Voice
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-2 border-white/20 text-white font-bold py-4 px-8 rounded-xl transition-all"
              >
                View Profile
              </motion.button>
            </motion.div>

            {/* Quote - Dynamic Personality */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="border-l-4 border-amber-500 pl-4"
            >
              <p className="text-white/80 italic text-sm sm:text-base">
                {personality?.name === "The Professional" 
                  ? `"The house always wins... unless you're playing with me. I'm here to make sure you have the best experience, win or lose."`
                  : `"Every hand tells a story. Let's see what yours says tonight."`
                }
              </p>
              <p className="text-amber-400 font-bold text-sm mt-2">
                — Your AI Dealer {personality && `(${personality.name})`}
              </p>
              
              {/* Dealer Personality Stats */}
              {personality && (
                <div className="mt-3 flex gap-3 text-xs">
                  <span className="text-cyan-400">
                    Strictness: {Math.round(personality.strictness * 100)}%
                  </span>
                  <span className="text-purple-400">
                    Social: {Math.round(personality.social_index * 100)}%
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Ambient Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AIDealerHero;
