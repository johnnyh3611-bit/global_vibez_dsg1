/**
 * TournamentDemo - Demo page showcasing UE5 MetaHuman integration components
 * Displays IntegrityHUD, SocialTicker, and GiftEffectTrigger overlays
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';
import IntegrityHUD from '../components/tournament/IntegrityHUD';
import SocialTicker from '../components/tournament/SocialTicker';
import GiftEffectTrigger from '../components/tournament/GiftEffectTrigger';

const TournamentDemo = () => {
  const [tableId] = useState('glasshouse_01');
  const [showIntegrity, setShowIntegrity] = useState(true);
  const [showTicker, setShowTicker] = useState(true);
  const [showGifts, setShowGifts] = useState(true);
  const [verificationHash, setVerificationHash] = useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Fetch provably fair hash on mount
  useEffect(() => {
    const fetchHash = async () => {
      try {
        const response = await fetch(`${API_URL}/api/dealer/spades/fair-deck`);
        const data = await response.json();
        setVerificationHash(data.verification_hash);
      } catch (err) {
        // console.error('Failed to fetch hash:', err);
      }
    };

    fetchHash();
  }, [API_URL]);

  const simulatePlayerBid = async (value) => {
    try {
      await fetch(`${API_URL}/api/tournament/${tableId}/trigger-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: value === 10 ? 'TEN_FOR_200' : 'BID',
          player_name: 'Demo Player'
        })
      });
    } catch (err) {
      // console.error('Failed to trigger event:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A0A0A] via-purple-950/20 to-[#0A0A0A] relative overflow-hidden">
      {/* Overlays */}
      {showIntegrity && (
        <IntegrityHUD 
          verificationHash={verificationHash}
          tableName="Glasshouse Table 1"
          position="top-right"
        />
      )}

      {showTicker && (
        <SocialTicker 
          tableId={tableId}
          position="bottom"
        />
      )}

      {showGifts && (
        <GiftEffectTrigger 
          tableId={tableId}
          playerId="demo_player"
        />
      )}

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-full mb-4">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-purple-400 text-sm font-bold">UE5 METAHUMAN INTEGRATION</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4">
            Tournament{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Demo
            </span>
          </h1>
          
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Real-time WebSocket integration between React overlays and Unreal Engine 5.5 MetaHuman AI Dealer
          </p>
        </motion.div>

        {/* MetaHuman Viewport Placeholder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-video bg-gradient-to-br from-purple-900/20 to-cyan-900/20 backdrop-blur-xl border-2 border-white/10 rounded-3xl overflow-hidden mb-8"
        >
          {/* Placeholder for UE5 MetaHuman Stream */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
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
                className="text-9xl mb-4 filter drop-shadow-2xl"
              >
                🎩
              </motion.div>
              <p className="text-white/60 text-sm mb-2">UE5 MetaHuman Viewport</p>
              <p className="text-white/40 text-xs max-w-md mx-auto">
                In production, this would display the real-time MetaHuman dealer stream from Unreal Engine 5.5 via WebRTC
              </p>
            </div>
          </div>

          {/* Holographic Scan Effect */}
          <motion.div
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
              backgroundSize: '200% 200%'
            }}
          />
        </motion.div>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-cyan-400" />
            <h2 className="text-white font-bold text-lg">Overlay Controls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => setShowIntegrity(!showIntegrity)}
              className={`${showIntegrity ? 'bg-emerald-600/20 border-emerald-500/30' : 'bg-white/5 border-white/10'} border-2 rounded-xl p-4 text-left transition-all hover:bg-white/10`}
            >
              <p className="text-white font-bold mb-1">Integrity HUD</p>
              <p className="text-white/60 text-xs">SHA-256 Hash Display</p>
            </button>

            <button
              onClick={() => setShowTicker(!showTicker)}
              className={`${showTicker ? 'bg-cyan-600/20 border-cyan-500/30' : 'bg-white/5 border-white/10'} border-2 rounded-xl p-4 text-left transition-all hover:bg-white/10`}
            >
              <p className="text-white font-bold mb-1">Social Ticker</p>
              <p className="text-white/60 text-xs">Live Bids & Comments</p>
            </button>

            <button
              onClick={() => setShowGifts(!showGifts)}
              className={`${showGifts ? 'bg-pink-600/20 border-pink-500/30' : 'bg-white/5 border-white/10'} border-2 rounded-xl p-4 text-left transition-all hover:bg-white/10`}
            >
              <p className="text-white font-bold mb-1">Gift Effects</p>
              <p className="text-white/60 text-xs">Niagara Particle Sync</p>
            </button>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-white/60 text-sm mb-3">Simulate Dealer Events:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => simulatePlayerBid(5)}
                className="bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                Regular Bid (5)
              </button>
              <button
                onClick={() => simulatePlayerBid(10)}
                className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                10-for-200 Bid
              </button>
              <button
                onClick={async () => {
                  await fetch(`${API_URL}/api/tournament/${tableId}/trigger-event`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      event_type: 'RENEGUE',
                      player_name: 'Demo Player'
                    })
                  });
                }}
                className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                Trigger Renegue
              </button>
              <button
                onClick={async () => {
                  await fetch(`${API_URL}/api/tournament/${tableId}/trigger-event`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      event_type: 'JACKPOT',
                      player_name: 'Demo Player'
                    })
                  });
                }}
                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                Jackpot Celebration
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tech Stack Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Logic', tech: 'FastAPI', desc: 'Tournament WebSocket server' },
            { label: 'Body', tech: 'UE5 MetaHuman', desc: 'Real-time facial animations' },
            { label: 'Audio', tech: 'MetaSounds', desc: 'Spatialized voice delivery' },
            { label: 'Security', tech: 'SHA-256', desc: 'Provably fair verification' }
          ].map((item, i) => (
            <motion.div
              key={`item-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4"
            >
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-white font-bold mb-1">{item.tech}</p>
              <p className="text-white/50 text-xs">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 0.5, 0],
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

export default TournamentDemo;
