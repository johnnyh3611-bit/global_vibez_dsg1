/**
 * FloatingFoodMenu — in-room HungryVibes overlay.
 * Roadmap PDF §3: "A floating 3D menu icon that triggers an overlay
 * for food selection without pausing the game."
 *
 * Self-mounting from App.js — auto-shows on every protected route
 * EXCEPT routes already inside HungryVibes (so we don't overlap
 * the native menu) and the marketing/login pages.
 */
import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UtensilsCrossed, X, Pizza, Coffee, IceCream } from 'lucide-react';

const HIDE_PATTERNS = [
  /^\/$/,
  /^\/login/,
  /^\/signup/,
  /^\/streamer\/overlay/,        // OBS scene — must stay clean
  /^\/streamer\/setup-guide/,
  /^\/hungry-?vibes/,            // already in HV
  /^\/restaurants?\//,
];

const QUICK_CATS = [
  { id: 'pizza',  label: 'Pizza Now',     Icon: Pizza,  href: '/hungryvibes?cat=pizza'  },
  { id: 'coffee', label: 'Coffee + Snack', Icon: Coffee, href: '/hungryvibes?cat=coffee' },
  { id: 'sweet',  label: 'Late-Night Sweet', Icon: IceCream, href: '/hungryvibes?cat=desserts' },
];

export default function FloatingFoodMenu() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // Hide on routes that don't make sense for the floater
  if (HIDE_PATTERNS.some((re) => re.test(loc.pathname))) return null;
  // Hide if user is unauthenticated
  if (typeof window !== 'undefined' && !window.localStorage?.getItem('auth_token')) return null;

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.08, rotate: -6 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        data-testid="floating-food-menu-trigger"
        title="Order food without pausing"
        className="fixed bottom-20 right-4 z-[9997] w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-orange-500/40 flex items-center justify-center text-white hover:shadow-orange-500/70 transition-shadow"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
      >
        <UtensilsCrossed className="w-6 h-6 drop-shadow" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            data-testid="floating-food-menu-panel"
            className="fixed bottom-36 right-4 z-[9996] w-72 rounded-2xl border border-amber-400/40 bg-black/90 backdrop-blur-xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.4em] font-black text-amber-300">
                HungryVibes · No Pause
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {QUICK_CATS.map((c) => {
                const Icon = c.Icon;
                return (
                  <Link
                    key={c.id}
                    to={c.href}
                    onClick={() => setOpen(false)}
                    data-testid={`floating-food-menu-${c.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/30 transition"
                  >
                    <Icon className="w-5 h-5 text-amber-300" />
                    <span className="font-bold text-white">{c.label}</span>
                  </Link>
                );
              })}
            </div>
            <Link
              to="/hungryvibes"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center text-xs text-amber-200 underline"
            >
              Browse all restaurants →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
