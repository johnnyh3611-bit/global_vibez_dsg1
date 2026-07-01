/**
 * CollabMatchmaker — 98% Synergy Logic producer↔vocalist pairing.
 * Music Arena Blueprint §2.
 *
 * Producer enters a beat → backend returns 5 candidate vocalists
 * with 98-100% synergy scores. Click one to enter a Vibe Suite
 * (Live Studio Room) — for now a placeholder that posts an
 * `INSTRUMENT_GIFT` action so the existing Streamer Action Hub
 * routes the tip-to-suggest payouts.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic2, Sparkles, Music2 } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface Match {
  vocalist_id: string;
  vocalist_name: string;
  synergy_pct: number;
}

export default function CollabMatchmaker() {
  const navigate = useNavigate();
  const [beatId, setBeatId] = useState('demo_beat_001');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  const find = async () => {
    setLoading(true);
    try {
      const t = localStorage.getItem('auth_token');
      const uid = localStorage.getItem('user_id') || 'demo_producer';
      const r = await fetch(`${API}/api/totem-pole/collab/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ producer_id: uid, beat_id: beatId }),
      });
      if (r.ok) {
        const d = await r.json();
        setMatches(d.matches || []);
      } else {
        toast.error('Sign in to find matches');
      }
    } catch {
      toast.error('Match service unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { find(); /* eslint-disable-next-line */ }, []);

  const enterVibeSuite = async (m: Match) => {
    toast.success(`Entering Vibe Suite with ${m.vocalist_name}`);
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/streamer-actions/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({
          streamer_id: m.vocalist_id,
          action_kind: 'INSTRUMENT_GIFT',
          amount_cents: 0,    // free entry — pay-to-suggest happens inside the suite
          metadata: { game: 'collab_matchmaker', synergy_pct: m.synergy_pct, beat_id: beatId },
        }),
      });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-cyan-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="cm-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300">Music Arena · Beat-Maker</div>
          <div className="text-lg font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
            Collab Matchmaker · 98% Synergy
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="rounded-2xl bg-cyan-500/10 border border-cyan-400/40 p-4 mb-5">
          <label className="block text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">Beat ID</label>
          <div className="flex gap-2">
            <input
              data-testid="cm-beat-input"
              value={beatId}
              onChange={(e) => setBeatId(e.target.value)}
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            />
            <button data-testid="cm-find" onClick={find} disabled={loading} className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold disabled:opacity-30">
              {loading ? '…' : 'Find Match'}
            </button>
          </div>
        </div>

        <div className="space-y-3" data-testid="cm-match-list">
          {matches.map((m) => (
            <motion.div
              key={m.vocalist_id}
              whileHover={{ y: -2 }}
              data-testid={`cm-match-${m.vocalist_id}`}
              className="rounded-2xl bg-stone-900/60 border-2 border-cyan-500/30 p-4 flex items-center gap-4 hover:border-cyan-400/70 transition"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center">
                <Mic2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-black text-lg">{m.vocalist_name}</div>
                <div className="text-xs text-cyan-300/80">vocalist</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Synergy</div>
                <div className="font-mono font-black text-amber-300 text-2xl">{m.synergy_pct}%</div>
              </div>
              <button
                data-testid={`cm-enter-${m.vocalist_id}`}
                onClick={() => enterVibeSuite(m)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 font-bold flex items-center gap-1"
              >
                <Sparkles className="w-4 h-4" /> Vibe Suite
              </button>
            </motion.div>
          ))}
          {!matches.length && !loading && (
            <div className="text-center text-white/50 py-10">
              <Music2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              No matches yet — try a different beat ID.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-center text-xs text-amber-200/80">
          70% revenue split between producer & vocalist · 30% house · pay-to-suggest available inside Vibe Suites.
        </div>
      </div>
    </div>
  );
}
