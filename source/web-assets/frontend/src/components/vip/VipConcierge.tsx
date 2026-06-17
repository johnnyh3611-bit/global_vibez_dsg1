/**
 * VIP Concierge — direct-line bubble for Genesis/Apex VIP members.
 *
 * Renders next to the VipCrownBadge when the active tier is Genesis or
 * Apex (not Genius — that's the entry tier). Tap opens an inline panel
 * with two quick actions:
 *   1. "Message the founder" — opens mailto: with prefilled subject
 *   2. "Priority support" — opens a contextual issue form
 *
 * Per the Master Blueprint vision: high-touch concierge is the #1
 * driver of VIP renewal. Genesis ($99) gets standard concierge; Apex
 * ($249) gets a personalised greeting line + faster SLA messaging.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, MessageCircle, Mail, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

type Eligibility = { is_vip: boolean; tier: string | null };

const TIER_GREETING: Record<string, { line: string; sla: string }> = {
  genesis: {
    line: 'Welcome to Genesis Concierge. How can we make tonight a great one?',
    sla: 'Average response · under 2 hours.',
  },
  apex: {
    line: 'Apex Concierge here. You have priority on every channel.',
    sla: 'Average response · under 15 minutes.',
  },
};

export default function VipConcierge() {
  const [el, setEl] = useState<Eligibility | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    async function check() {
      const token = localStorage.getItem('auth_token');
      if (!token) { if (!cancelled) setEl(null); return; }
      try {
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) { if (!cancelled) setEl(null); return; }
        const me = await meRes.json();
        const uid = me.user_id || me.id || me._id;
        if (!uid) return;
        const r = await fetch(`${API_URL}/api/high-roller/eligibility/${uid}`);
        const data = await r.json();
        if (!cancelled) setEl(data);
      } catch { /* silent */ }
    }
    void check();
    interval = setInterval(check, POLL_MS);
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, []);

  // Only Genesis + Apex see the concierge bubble.
  if (!el?.is_vip) return null;
  if (el.tier !== 'genesis' && el.tier !== 'apex') return null;

  const greeting = TIER_GREETING[el.tier] || TIER_GREETING.genesis;

  return (
    <div
      data-testid="vip-concierge-bubble"
      className="fixed bottom-24 right-24 z-[60] sm:bottom-6 sm:right-24"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="vip-concierge-panel"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full right-0 mb-3 w-80 rounded-2xl bg-[#0a0710] ring-1 ring-amber-300/40 shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-br from-amber-300/15 to-emerald-300/15 px-5 py-4 border-b border-amber-300/20 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-200/80 mb-1">
                  {el.tier === 'apex' ? 'APEX' : 'GENESIS'} CONCIERGE
                </div>
                <div className="text-white text-sm leading-snug">{greeting.line}</div>
              </div>
              <button
                data-testid="vip-concierge-close"
                onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white"
                aria-label="Close concierge"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 text-xs text-amber-200/70">{greeting.sla}</div>
            <div className="px-3 pb-4 space-y-2">
              <a
                data-testid="vip-concierge-founder-btn"
                href="mailto:customerservice@globalvibezdsg.com?subject=VIP%20Concierge%20Request&body=Tier%3A%20"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 text-white/90 text-sm"
              >
                <Mail className="w-4 h-4 text-amber-300" />
                Email the founder team
              </a>
              <a
                data-testid="vip-concierge-priority-btn"
                href="mailto:customerservice@globalvibezdsg.com?subject=VIP%20Priority%20Support&body=Tier%3A%20"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 text-white/90 text-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-300" />
                Open a priority ticket
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        data-testid="vip-concierge-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="VIP Concierge"
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-emerald-500 ring-2 ring-amber-200/60 shadow-[0_0_30px_rgba(251,191,36,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Headphones className="w-6 h-6 text-black/85" />
      </button>
    </div>
  );
}
