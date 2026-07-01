/**
 * BeatVaultDLC — finished-track minting flow (Streamer Revenue PDF §3
 * + Master Tech Blueprint §1).
 *
 * Lets an artist take a finished Beat Vault session and "mint" it as
 * a Vibe DLC that listeners can unlock with credits. Until mainnet
 * launch, mints land in SIMULATED mode — the UI shows the deterministic
 * tx_hash so the artist can see the flow end-to-end.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Disc3, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface DLC {
  dlc_id: string;
  tx_hash: string;
  mint_status: string;
  track_title: string;
  unlock_price_cents: number;
  share_split: { artist: number; sovereign_tax: number; liquidity_pool: number };
}

export default function BeatVaultDLC() {
  const navigate = useNavigate();
  const [mintMode, setMintMode] = useState<'SIMULATED' | 'PRODUCTION'>('SIMULATED');
  const [title, setTitle] = useState('Power Hour Anthem');
  const [price, setPrice] = useState(199);  // cents
  const [recent, setRecent] = useState<DLC[]>([]);

  useEffect(() => {
    fetch(`${API}/api/beat-dlc/mint-mode`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setMintMode(d.mint_mode))
      .catch(() => {});
    const uid = localStorage.getItem('user_id') || 'demo_artist';
    fetch(`${API}/api/beat-dlc/list/${uid}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRecent(d.dlcs || []))
      .catch(() => {});
  }, []);

  const mint = async () => {
    const t = localStorage.getItem('auth_token');
    if (!t) { toast.error('Sign in to mint'); return; }
    try {
      const r = await fetch(`${API}/api/beat-dlc/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          track_title: title,
          artist_id:   localStorage.getItem('user_id') || 'demo_artist',
          unlock_price_cents: price,
          stems: ['drums', 'bass', 'vox', 'lead'],
        }),
      });
      if (!r.ok) throw new Error('Mint failed');
      const dlc: DLC = await r.json();
      setRecent((arr) => [dlc, ...arr]);
      toast.success(`Minted "${dlc.track_title}" — tx ${dlc.tx_hash.slice(0, 10)}…`);
    } catch (e: any) {
      toast.error(e.message || 'Mint failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-amber-950/20 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-amber-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="dlc-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">Beat Vault · 70/30 Revolution</div>
          <div className="text-lg font-black bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 bg-clip-text text-transparent">
            Mint as Vibe DLC
          </div>
        </div>
      </div>

      {mintMode === 'SIMULATED' && (
        <div className="bg-amber-500/15 border-b border-amber-400/30 text-amber-200 text-xs px-4 py-2 text-center" data-testid="mint-mode-banner">
          ⚠ Simulated mint — Mainnet TGE locked behind founder safe phrase. Flow is end-to-end testable.
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-stone-900/70 border border-amber-500/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Disc3 className="w-5 h-5 text-amber-300" />
            <div className="font-black">Finished Track Details</div>
          </div>
          <label className="block mb-3">
            <span className="text-[10px] uppercase tracking-widest text-amber-200/70">Track Title</span>
            <input data-testid="dlc-title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400" />
          </label>
          <label className="block mb-4">
            <span className="text-[10px] uppercase tracking-widest text-amber-200/70">Unlock Price (cents)</span>
            <input data-testid="dlc-price" type="number" min={1} value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 1)}
              className="mt-1 w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 font-mono" />
          </label>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-[10px]">
            <div className="rounded-lg p-2 bg-emerald-500/15 border border-emerald-400/30">
              <div className="text-emerald-300 font-mono font-black">70%</div>
              <div className="text-white/60 uppercase tracking-wider">Artist</div>
            </div>
            <div className="rounded-lg p-2 bg-fuchsia-500/15 border border-fuchsia-400/30">
              <div className="text-fuchsia-300 font-mono font-black">13.5%</div>
              <div className="text-white/60 uppercase tracking-wider">Sov. Tax</div>
            </div>
            <div className="rounded-lg p-2 bg-cyan-500/15 border border-cyan-400/30">
              <div className="text-cyan-300 font-mono font-black">10%</div>
              <div className="text-white/60 uppercase tracking-wider">Liquidity</div>
            </div>
          </div>
          <button data-testid="dlc-mint" onClick={mint}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-black text-black hover:scale-[1.01] transition flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" /> Mint Vibe DLC
          </button>
        </motion.div>

        {recent.length > 0 && (
          <div className="rounded-2xl bg-stone-900/60 border border-white/10 p-5" data-testid="dlc-recent">
            <div className="font-black mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" /> Your Mints
            </div>
            <AnimatePresence>
              {recent.map((d) => (
                <motion.div key={d.dlc_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-2 p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between" data-testid={`dlc-row-${d.dlc_id}`}>
                  <div>
                    <div className="font-bold">{d.track_title}</div>
                    <div className="text-xs text-white/50 font-mono">{d.tx_hash.slice(0, 18)}…</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-amber-300">${(d.unlock_price_cents / 100).toFixed(2)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">{d.mint_status}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="text-xs text-white/40 text-center flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> Mainnet on-chain mint unlocks after founder safe-phrase acknowledgment.
        </div>
      </div>
    </div>
  );
}
