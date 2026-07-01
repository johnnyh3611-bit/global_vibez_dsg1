/**
 * TotemPoleQueue — TV broadcast survival queue (TV Totem Pole §1-§3).
 *
 * Shows the live PG-13 queue with each pilot's hype meter. Users can
 * Tip-to-Shield ($2 / 5-min block) to extend a show, or trigger the
 * survival algorithm to cut/promote everything below/above threshold.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Tv, Shield, Scissors, TrendingUp, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface Pilot {
  pilot_id: string;
  title: string;
  creator: string;
  tier: 'PG-13' | '18+';
  hype_meter_cents: number;
}

interface Constants {
  hype_min_to_survive: number;
  tip_shield_block_cents: number;
  tip_shield_block_secs: number;
}

const SAMPLE_PILOTS: Pilot[] = [
  { pilot_id: 'pl1', title: 'Late-Night Vibe Talks',  creator: 'Casino Coach',  tier: 'PG-13', hype_meter_cents: 480 },
  { pilot_id: 'pl2', title: 'Hungry Vibez Cookoff',   creator: 'Chef Marisol',  tier: 'PG-13', hype_meter_cents: 920 },
  { pilot_id: 'pl3', title: 'After 9 — JFTN Live',    creator: 'NeonNomad',     tier: '18+',   hype_meter_cents: 110 },
  { pilot_id: 'pl4', title: 'VibeRidez Reroute Fails', creator: 'GildedFox',    tier: 'PG-13', hype_meter_cents: 345 },
  { pilot_id: 'pl5', title: 'Beat Vault Battles',     creator: 'PixelHeart',    tier: 'PG-13', hype_meter_cents: 720 },
];

export default function TotemPoleQueue() {
  const navigate = useNavigate();
  const [constants, setConstants] = useState<Constants | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>(SAMPLE_PILOTS);
  const [ageVerified, setAgeVerified] = useState<'PG-13' | '18+'>('PG-13');
  const [dob, setDob] = useState('');

  useEffect(() => {
    fetch(`${API}/api/totem-pole/constants`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setConstants({
        hype_min_to_survive:    d.hype_min_to_survive,
        tip_shield_block_cents: d.tip_shield_block_cents,
        tip_shield_block_secs:  d.tip_shield_block_secs,
      }))
      .catch(() => {});
  }, []);

  const ageVerify = async () => {
    if (!dob) { toast.error('Enter your date of birth'); return; }
    try {
      const t = localStorage.getItem('auth_token');
      const r = await fetch(`${API}/api/totem-pole/tv/age-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ date_of_birth: dob, requested_tier: '18+' }),
      });
      if (r.ok) {
        const d = await r.json();
        setAgeVerified(d.tier_unlocked);
        toast.success(`Verified — ${d.tier_unlocked} unlocked (age ${d.age})`);
      } else {
        toast.error('Verification failed — sign in first');
      }
    } catch {
      toast.error('Verification service unavailable');
    }
  };

  const tipShield = async (pilot: Pilot) => {
    if (!constants) return;
    setPilots((arr) => arr.map((p) => (p.pilot_id === pilot.pilot_id
      ? { ...p, hype_meter_cents: p.hype_meter_cents + constants.tip_shield_block_cents }
      : p)));
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/totem-pole/tv/tip-shield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({ pilot_id: pilot.pilot_id, blocks: 1 }),
      });
      toast.success(`Shielded "${pilot.title}" for 5 minutes ($${(constants.tip_shield_block_cents / 100).toFixed(2)})`);
    } catch {}
  };

  const visiblePilots = pilots.filter((p) => p.tier === 'PG-13' || ageVerified === '18+');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-purple-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="tv-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-purple-300">Vibe TV · Totem Pole</div>
          <div className="text-lg font-black bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            Audience Survival Queue
          </div>
        </div>
        {ageVerified === '18+' ? (
          <div className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1" data-testid="tv-age-badge">
            <ShieldCheck className="w-3 h-3" /> 18+
          </div>
        ) : null}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {ageVerified === 'PG-13' && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-400/40 p-4 mb-5" data-testid="tv-age-gate">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-amber-300" />
              <div className="font-bold">Unlock 18+ Tier</div>
            </div>
            <div className="text-xs text-amber-200/80 mb-2">
              Just-For-The-Night & Mature Dating Universe rooms require Global Vibez Guard age verification.
            </div>
            <div className="flex gap-2">
              <input
                data-testid="tv-dob-input"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
              <button data-testid="tv-age-verify" onClick={ageVerify} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold">
                Verify
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2" data-testid="tv-pilot-list">
          {visiblePilots.map((p) => {
            const safe = constants ? p.hype_meter_cents >= constants.hype_min_to_survive : true;
            return (
              <motion.div
                key={p.pilot_id}
                whileHover={{ x: 2 }}
                data-testid={`tv-pilot-${p.pilot_id}`}
                className={`rounded-xl p-4 flex items-center gap-4 border-2 ${safe ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}`}
              >
                <Tv className={`w-6 h-6 ${safe ? 'text-emerald-300' : 'text-rose-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold truncate">{p.title}</div>
                    {p.tier === '18+' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-200">18+</span>
                    )}
                  </div>
                  <div className="text-xs text-white/60">{p.creator}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className={`h-full ${safe ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(100, (p.hype_meter_cents / 1000) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-sm">${(p.hype_meter_cents / 100).toFixed(2)}</div>
                  <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 justify-end mt-0.5 ${safe ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {safe ? <><TrendingUp className="w-3 h-3" /> SAFE</> : <><Scissors className="w-3 h-3" /> AT RISK</>}
                  </div>
                </div>
                <button
                  onClick={() => tipShield(p)}
                  data-testid={`tv-shield-${p.pilot_id}`}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 text-xs font-bold flex items-center gap-1"
                  title="Tip-to-Shield · $2.00 / 5 min"
                >
                  <Shield className="w-3 h-3" /> +5m
                </button>
              </motion.div>
            );
          })}
        </div>

        {constants && (
          <div className="mt-5 text-center text-xs text-white/50">
            Survival threshold: ${(constants.hype_min_to_survive / 100).toFixed(2)} · Tip-to-Shield: ${(constants.tip_shield_block_cents / 100).toFixed(2)} per 5-min block
          </div>
        )}
      </div>
    </div>
  );
}
