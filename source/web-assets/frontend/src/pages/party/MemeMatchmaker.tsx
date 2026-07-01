/**
 * MemeMatchmaker — Underground Club room (Party Hub Blueprint §2).
 *
 * Players see a meme on the central wall, vote with 3D Glass Emojis,
 * and the winning meme distributes the reward pool (winner_share=0.865
 * after the 13.5% sovereign tax). Tips post through the existing
 * Streamer Action Hub as `HECKLE_GALLERY` actions so the same payout
 * + hype-meter rails apply.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Flame, Skull, Laugh, Sparkles, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const EMOJI_VOTES = [
  { id: 'fire',  Icon: Flame,    label: '🔥', color: 'from-orange-400 to-red-500',  cents: 100 },
  { id: 'love',  Icon: Heart,    label: '❤',  color: 'from-pink-500 to-rose-600',   cents: 50  },
  { id: 'lol',   Icon: Laugh,    label: '😂', color: 'from-amber-300 to-yellow-500',cents: 25  },
  { id: 'magic', Icon: Sparkles, label: '✨', color: 'from-violet-400 to-fuchsia-600', cents: 250 },
  { id: 'rip',   Icon: Skull,    label: '💀', color: 'from-slate-400 to-zinc-600',  cents: 10  },
  { id: 'meh',   Icon: ThumbsDown, label: '👎', color: 'from-stone-500 to-stone-700', cents: 5 },
];

const SAMPLE_MEMES = [
  { id: 'm1', src: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600', caption: 'When the dealer hits 21' },
  { id: 'm2', src: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600', caption: "Me explaining 70/30 to my non-crypto friends" },
  { id: 'm3', src: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600', caption: 'POV: you finally hit a Power Hour' },
];

export default function MemeMatchmaker() {
  const navigate = useNavigate();
  const [memeIdx, setMemeIdx] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [pool, setPool] = useState(0); // cents
  const meme = SAMPLE_MEMES[memeIdx];

  useEffect(() => {
    setTally({}); setPool(0);
  }, [memeIdx]);

  const cast = async (vote: typeof EMOJI_VOTES[0]) => {
    setTally((p) => ({ ...p, [vote.id]: (p[vote.id] || 0) + 1 }));
    setPool((p) => p + vote.cents);
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/streamer-actions/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({
          streamer_id: `meme_${meme.id}`,
          action_kind: 'HECKLE_GALLERY',
          amount_cents: vote.cents,
          metadata: { vote_id: vote.id, meme_id: meme.id, emoji: vote.label },
        }),
      });
      toast.success(`${vote.label} +$${(vote.cents / 100).toFixed(2)}`, { duration: 1500 });
    } catch {
      // Silent fail — voting still works locally
    }
  };

  const winnerShare = Math.round(pool * 0.865); // 13.5% sovereign tax adjusted

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-fuchsia-950/30 to-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-fuchsia-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="meme-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300">Party Hub · Underground Club</div>
          <div className="text-lg font-black bg-gradient-to-r from-fuchsia-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            Meme Matchmaker
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-fuchsia-200/70">Pool</div>
          <div className="text-amber-300 font-mono font-black" data-testid="meme-pool">${(pool / 100).toFixed(2)}</div>
        </div>
      </div>

      {/* Meme stage — leather-booth feel */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="rounded-3xl border-4 border-amber-700/40 bg-stone-900/80 shadow-[0_0_60px_rgba(217,70,239,0.3)] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={meme.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              data-testid="meme-stage"
            >
              <img src={meme.src} alt="meme" className="w-full aspect-video object-cover" />
              <div className="px-6 py-4 bg-black/60 border-t border-fuchsia-500/30 text-center">
                <div className="text-xl font-black">{meme.caption}</div>
                <div className="text-xs text-fuchsia-300/70 mt-1">Meme #{meme.id}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3D Glass Emoji vote bank */}
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-3" data-testid="emoji-vote-bank">
          {EMOJI_VOTES.map((v) => (
            <motion.button
              key={v.id}
              data-testid={`emoji-vote-${v.id}`}
              onClick={() => cast(v)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ y: -4 }}
              className={`group relative rounded-2xl bg-gradient-to-br ${v.color} p-4 shadow-2xl border border-white/20 backdrop-blur-md`}
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' }}
            >
              <div className="text-4xl drop-shadow-lg">{v.label}</div>
              <div className="text-[10px] font-mono mt-1 text-white/90">${(v.cents / 100).toFixed(2)}</div>
              <div className="absolute top-1 right-2 text-xs font-black text-white/90" data-testid={`tally-${v.id}`}>
                {tally[v.id] || 0}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Winner card */}
        <div className="mt-6 p-5 rounded-2xl bg-black/60 border border-fuchsia-500/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-fuchsia-300">Winner Share</div>
            <div className="text-[10px] text-fuchsia-200/70">86.5% (after 13.5% sovereign tax)</div>
          </div>
          <div className="text-3xl font-black text-amber-300" data-testid="meme-winner-share">
            ${(winnerShare / 100).toFixed(2)}
          </div>
          <button
            onClick={() => setMemeIdx((i) => (i + 1) % SAMPLE_MEMES.length)}
            data-testid="next-meme"
            className="mt-4 w-full px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 font-bold hover:scale-[1.02] transition"
          >
            Next Meme →
          </button>
        </div>
      </div>
    </div>
  );
}
