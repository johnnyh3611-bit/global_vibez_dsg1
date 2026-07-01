import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TipExplosionEvent {
  event_id: string;
  to_user_id: string;
  amount: number;
  from_name: string;
}

interface TipExplosionProps {
  events: TipExplosionEvent[];                 // events bound to this specific seat
  anchorRef?: React.RefObject<HTMLDivElement>; // optional container, defaults to seat position
}

/**
 * Swarm of digital ₵ tokens bursting from a player's avatar on tip receipt.
 * Mirrors the Unity ``RpcTriggerTipVisuals`` particle swarm — token count
 * scales with tip amount (capped at 20 particles for perf).
 */
export const TipExplosion: React.FC<TipExplosionProps> = ({ events }) => {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {events.map((ev) => {
          const particles = Math.max(6, Math.min(20, Math.floor(ev.amount / 250) || 6));
          return (
            <React.Fragment key={`tip-fx-${ev.event_id}`}>
              {/* floating label */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: -40, scale: 1.1 }}
                exit={{ opacity: 0, y: -70 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                className="absolute left-1/2 -translate-x-1/2 top-0 text-yellow-300 font-black text-sm bg-black/60 rounded-full px-3 py-1 shadow-lg"
                data-testid={`vibe654-tip-explosion-${ev.event_id}`}
              >
                +₵{ev.amount.toLocaleString()}
              </motion.div>

              {/* radial particle burst */}
              {Array.from({ length: particles }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / particles;
                return (
                  <motion.div
                    key={`tp-${ev.event_id}-${i}`}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                    animate={{
                      x: Math.cos(ang) * 70,
                      y: Math.sin(ang) * 70,
                      opacity: 0,
                      scale: 1.2,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                    className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(253,224,71,0.8)]"
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default TipExplosion;
