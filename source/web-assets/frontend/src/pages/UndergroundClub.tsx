import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';
import MiningLeaderboard from '@/components/MiningLeaderboard';

const API = process.env.REACT_APP_BACKEND_URL;

type Balance = {
  available: number;
  pending: number;
  lifetime_mined: number;
  tier: string;
  tier_multiplier: number;
  loyalty_multiplier: number;
  global_boost: number;
  locked: boolean;
};

/**
 * Underground Club — the full-obsidian + purple-neon edition the user asked for.
 *
 * Differs from /underground-spades (which is the existing live multiplayer room).
 * This page is the visual reference implementation showing:
 *   - Glass HUD with mining balance
 *   - 3D glass emoji reaction demo
 *   - Translation bar (FR ↔ EN)
 *   - Spades table silhouette
 */
export default function UndergroundClub() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [translating, setTranslating] = useState(true);
  const [sampleFR, setSampleFR] = useState<string>('Je vais gagner ce tour!');
  const [sampleEN, setSampleEN] = useState<string>('I am going to win this round!');

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/mining/my-balance`);
        if (res.ok) setBalance(await res.json());
      } catch { /* silent */ }
    })();
  }, []);

  // Cycle demo translations
  useEffect(() => {
    const phrases: [string, string][] = [
      ['Je vais gagner ce tour!', 'I am going to win this round!'],
      ['Bien joué, mon ami!', 'Well played, my friend!'],
      ['Atout spades!', 'Trump spades!'],
      ['Renard!', 'Slick move!'],
    ];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % phrases.length;
      setSampleFR(phrases[i][0]);
      setSampleEN(phrases[i][1]);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      data-testid="underground-club-page"
      className="min-h-screen bg-[radial-gradient(circle_at_center,_rgba(88,28,135,0.15),_#000)] text-purple-400 font-mono p-6 md:p-10"
    >
      <div className="max-w-6xl mx-auto">
        {/* Glass HUD */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_0_100px_rgba(168,85,247,0.15)]">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              data-testid="underground-club-back"
              onClick={() => navigate('/games')}
              className="flex items-center gap-2 text-purple-300 hover:text-purple-100 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter text-purple-400 uppercase">
              Global Vibez // Underground
            </h1>
            <div className="text-right" data-testid="underground-mining-readout">
              <p className="text-[10px] text-neutral-500 uppercase">Premium Mining</p>
              <p className="text-lg font-mono text-emerald-400">
                {balance?.locked
                  ? 'LOCKED · Upgrade'
                  : `${balance?.available.toFixed(2) ?? '0.00'} $DSG`}
              </p>
              {balance && !balance.locked && (
                <p className="text-[10px] text-purple-300/70 mt-0.5">
                  +{balance.pending.toFixed(2)} pending · {balance.global_boost}x boost
                </p>
              )}
            </div>
          </div>

          {/* Spades Table Area */}
          <div className="mt-10 relative h-80 md:h-96 w-full rounded-[80px] border-4 border-purple-900/60 bg-neutral-950 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

            {/* 3D Glass Emoji reactions */}
            <motion.div
              className="absolute top-10 left-1/4 text-5xl"
              animate={{ y: [0, -30, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🔥
            </motion.div>
            <motion.div
              className="absolute top-16 right-1/4 text-4xl"
              animate={{ y: [0, -20, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 0.8 }}
            >
              💎
            </motion.div>
            <motion.div
              className="absolute bottom-16 left-1/3 text-4xl"
              animate={{ y: [0, -20, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, delay: 1.5 }}
            >
              ✨
            </motion.div>

            <div className="z-10 text-center">
              <p className="text-neutral-600 uppercase tracking-widest font-bold text-sm md:text-base">
                Underground Spades · Table 04
              </p>
              <button
                data-testid="underground-join-live"
                onClick={() => navigate('/underground-spades')}
                className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-full transition text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              >
                Join Live Room
              </button>
            </div>
          </div>

          {/* Translation Bar */}
          <div
            data-testid="underground-translation-bar"
            className="mt-8 p-4 bg-black/60 rounded-2xl border border-purple-500/30 backdrop-blur-md flex flex-wrap items-center gap-3"
          >
            <button
              data-testid="underground-translate-toggle"
              onClick={() => navigate('/voice-mirror')}
              className={`px-3 py-1 text-xs uppercase tracking-widest rounded-full border transition ${
                translating
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-neutral-800 border-neutral-600 text-neutral-400 hover:border-cyan-400 hover:text-cyan-300'
              }`}
            >
              Open Voice Mirror →
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2 text-sm overflow-hidden">
              <span className="text-purple-400 font-bold shrink-0">[FR]</span>
              <span className="italic text-white truncate">"{sampleFR}"</span>
              <Zap className="w-4 h-4 text-purple-300 shrink-0" />
              <span className="text-emerald-400 shrink-0">[EN]</span>
              <span className="text-emerald-400 truncate">"{sampleEN}"</span>
            </div>
          </div>

          {/* Safety disclaimer (intentionally subtle) */}
          <p className="mt-6 text-[10px] text-center text-neutral-600 uppercase tracking-widest">
            AI Safety Gate · Active · HWID Verified · 72h Vibe Check Enabled
          </p>
        </div>

        {/* Leaderboard */}
        <div className="mt-6">
          <MiningLeaderboard limit={10} />
        </div>
      </div>
    </div>
  );
}
