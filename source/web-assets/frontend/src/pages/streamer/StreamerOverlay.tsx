/**
 * StreamerOverlay — OBS-friendly polling overlay for the Streamer
 * Action Hub (Streamer Revenue Blueprint, May 2026 PDF).
 *
 * Streamer drops this URL into an OBS Browser Source:
 *   /streamer/overlay/{streamer_id}
 *
 * The page polls `/api/streamer-actions/recent/{id}` every 2s and
 * `/api/streamer-actions/hype-meter/{id}` every 3s, then animates:
 *   - HECKLE  → frost-filter overlay across the whole canvas
 *   - BUFF    → golden glow burst from corners
 *   - ROUTE_TIP / DJ_INTERCEPT / VOICE_INTERCEPT / etc → toast
 *   - Hype Meter bar at the top fills cyan → fuchsia
 *
 * Transparent background by design — drop on top of game/cam capture.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Mic, Music, MapPin, Gift } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

interface ActionRow {
  action_id: string;
  kind: string;
  amount_cents: number;
  metadata: Record<string, any>;
  status: string;
  created_at: string;
}

interface HypeMeter {
  cumulative_cents: number;
  peak_threshold: number;
  fill_pct: number;
  peak_reached: boolean;
}

const KIND_ICON: Record<string, any> = {
  HECKLE: Zap, BUFF: Flame, ROUTE_TIP: MapPin,
  DJ_INTERCEPT: Music, VOICE_INTERCEPT: Mic,
  INSTRUMENT_GIFT: Gift, HECKLE_GALLERY: Zap,
};
const KIND_COLOR: Record<string, string> = {
  HECKLE: 'from-cyan-400 to-blue-500',
  BUFF: 'from-amber-400 to-orange-500',
  ROUTE_TIP: 'from-emerald-400 to-teal-500',
  DJ_INTERCEPT: 'from-fuchsia-500 to-pink-600',
  VOICE_INTERCEPT: 'from-violet-500 to-purple-600',
  INSTRUMENT_GIFT: 'from-yellow-300 to-amber-500',
  HECKLE_GALLERY: 'from-rose-500 to-red-600',
};

export default function StreamerOverlay() {
  const { streamerId = 'demo' } = useParams();
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [meter, setMeter] = useState<HypeMeter | null>(null);
  const [frost, setFrost] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const fetchActions = async () => {
      try {
        const t = localStorage.getItem('auth_token');
        const r = await fetch(
          `${API}/api/streamer-actions/recent/${streamerId}?limit=10`,
          { headers: t ? { Authorization: `Bearer ${t}` } : {} }
        );
        if (!alive || !r.ok) return;
        const d = await r.json();
        const newActions = (d.actions || []).filter(
          (a: ActionRow) => !seenIds.current.has(a.action_id)
        );
        newActions.forEach((a: ActionRow) => seenIds.current.add(a.action_id));
        if (newActions.length) {
          setActions((prev) => [...newActions, ...prev].slice(0, 6));
          // Trigger frost effect for HECKLE actions
          if (newActions.some((a: ActionRow) => a.kind === 'HECKLE')) {
            setFrost(true);
            setTimeout(() => setFrost(false), 2500);
          }
        }
      } catch {}
    };
    const fetchMeter = async () => {
      try {
        const r = await fetch(`${API}/api/streamer-actions/hype-meter/${streamerId}`);
        if (!alive || !r.ok) return;
        setMeter(await r.json());
      } catch {}
    };
    fetchActions(); fetchMeter();
    const a = setInterval(fetchActions, 2000);
    const m = setInterval(fetchMeter, 3000);
    return () => { alive = false; clearInterval(a); clearInterval(m); };
  }, [streamerId]);

  return (
    <div
      data-testid="streamer-overlay"
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ background: 'transparent' }}
    >
      {/* Frost filter — fires when HECKLE lands */}
      <AnimatePresence>
        {frost && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-cyan-400/15"
            style={{ backdropFilter: 'blur(8px)' }}
          />
        )}
      </AnimatePresence>

      {/* Hype Meter — top bar */}
      {meter && (
        <div data-testid="hype-meter" className="absolute top-4 left-4 right-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] uppercase tracking-[0.4em] font-black text-white/80 drop-shadow-lg">
              HYPE
            </span>
            <span className="text-xs font-bold text-white/70">
              ${(meter.cumulative_cents / 100).toFixed(2)} / ${(meter.peak_threshold / 100).toFixed(2)}
            </span>
            {meter.peak_reached && (
              <span className="text-xs font-black text-amber-300 animate-pulse">⚡ POWER HOUR</span>
            )}
          </div>
          <div className="h-2 rounded-full bg-black/40 border border-white/20 overflow-hidden">
            <motion.div
              data-testid="hype-meter-fill"
              animate={{ width: `${Math.round(meter.fill_pct * 100)}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 shadow-lg shadow-fuchsia-500/50"
            />
          </div>
        </div>
      )}

      {/* Action toast stack — bottom right */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3 max-w-xs">
        <AnimatePresence>
          {actions.map((a) => {
            const Icon = KIND_ICON[a.kind] || Gift;
            const grad = KIND_COLOR[a.kind] || 'from-slate-400 to-slate-600';
            return (
              <motion.div
                key={a.action_id}
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r ${grad} shadow-2xl border border-white/20 backdrop-blur-md`}
                data-testid={`action-toast-${a.kind.toLowerCase()}`}
              >
                <Icon className="w-6 h-6 text-white drop-shadow" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/80 font-bold">
                    {a.kind.replace('_', ' ')}
                  </div>
                  <div className="text-sm font-black text-white">
                    +${(a.amount_cents / 100).toFixed(2)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
