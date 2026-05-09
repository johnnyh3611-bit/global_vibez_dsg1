/**
 * SoundCheckGauntlet — 15-second flip + Vibe / No-Vibe swipe vote.
 * Music Arena Blueprint §1.
 *
 * Tracks with cumulative hype ≥ HYPE_MIN_TO_SURVIVE auto-graduate to
 * a 5-minute Live Pilot Slot on Vibe TV (per PDF §Winner's Reward).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ThumbsUp, ThumbsDown, Music2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const TRACKS = [
  { id: 't1', title: 'Power Hour Anthem',     artist: 'NeonNomad',  cover: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=600' },
  { id: 't2', title: '70/30 Vibe',            artist: 'GildedFox',  cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600' },
  { id: 't3', title: "Hangin' At The Vault",  artist: 'PixelHeart', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600' },
  { id: 't4', title: 'Frost Filter Drip',     artist: 'MoonRover',  cover: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=600' },
];

export default function SoundCheckGauntlet() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [secs, setSecs] = useState(15);
  const [graduated, setGraduated] = useState<string | null>(null);
  const startRef = useRef(Date.now());

  const track = TRACKS[idx];

  useEffect(() => {
    setSecs(15); startRef.current = Date.now();
    const t = setInterval(() => {
      const remain = Math.max(0, 15 - Math.round((Date.now() - startRef.current) / 1000));
      setSecs(remain);
    }, 200);
    return () => clearInterval(t);
  }, [idx]);

  const vote = async (kind: 'VIBE' | 'NO_VIBE') => {
    const listened = 15 - secs;
    try {
      const t = localStorage.getItem('auth_token');
      const r = await fetch(`${API}/api/totem-pole/sound-check/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ track_id: track.id, vote: kind, seconds_listened: listened }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.qualifies_for_live_pilot) setGraduated(track.title);
      }
    } catch {}
    toast.success(kind === 'VIBE' ? `Vibe ✓ on "${track.title}"` : `No vibe — flagged "${track.title}"`);
    setTimeout(() => setIdx((i) => (i + 1) % TRACKS.length), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-fuchsia-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-fuchsia-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="sc-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300">Music Arena · Sound-Check Gauntlet</div>
          <div className="text-lg font-black bg-gradient-to-r from-fuchsia-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            15-Second Flip
          </div>
        </div>
        <div className="font-mono font-black text-fuchsia-300 text-2xl" data-testid="sc-timer">{secs}s</div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={track.id}
            initial={{ opacity: 0, y: 30, rotate: 5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -200, rotate: -10 }}
            data-testid={`sc-card-${track.id}`}
            className="rounded-3xl overflow-hidden border-2 border-fuchsia-500/40 shadow-[0_0_60px_rgba(217,70,239,0.4)]"
          >
            <img src={track.cover} alt={track.title} className="w-full aspect-square object-cover" />
            <div className="p-5 bg-stone-900/90 border-t border-fuchsia-500/30">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-fuchsia-300/80 mb-1">
                <Music2 className="w-3 h-3" /> New Drop
              </div>
              <div className="text-xl font-black">{track.title}</div>
              <div className="text-sm text-white/60">{track.artist}</div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <motion.button
            data-testid="sc-vote-novibe"
            whileTap={{ scale: 0.92 }}
            onClick={() => vote('NO_VIBE')}
            className="rounded-2xl bg-zinc-900 border-2 border-rose-500/40 hover:border-rose-400 p-4 flex flex-col items-center gap-2 transition"
          >
            <ThumbsDown className="w-8 h-8 text-rose-400" />
            <div className="text-xs uppercase tracking-widest font-bold text-rose-200">No Vibe</div>
          </motion.button>
          <motion.button
            data-testid="sc-vote-vibe"
            whileTap={{ scale: 0.92 }}
            onClick={() => vote('VIBE')}
            className="rounded-2xl bg-gradient-to-r from-fuchsia-500/20 to-amber-500/20 border-2 border-fuchsia-400 hover:from-fuchsia-500/40 hover:to-amber-500/40 p-4 flex flex-col items-center gap-2 transition"
          >
            <ThumbsUp className="w-8 h-8 text-fuchsia-300" />
            <div className="text-xs uppercase tracking-widest font-bold text-fuchsia-200">Vibe</div>
          </motion.button>
        </div>

        {graduated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="sc-graduated"
            className="mt-5 rounded-2xl bg-amber-500/15 border-2 border-amber-400 p-4 text-center"
          >
            <Trophy className="w-8 h-8 text-amber-300 mx-auto mb-2" />
            <div className="font-black text-amber-200">"{graduated}" earned a Live Pilot Slot!</div>
            <div className="text-xs text-amber-100/70 mt-1">5 minutes on Vibe TV — automatic.</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
