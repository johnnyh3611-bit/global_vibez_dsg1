import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface HypeOverlayEvent {
  event_id: string;
  hype_type: 'fire' | 'cashbag' | 'horn';
  from_name: string;
}

interface HypeEmojiOverlayProps {
  events: HypeOverlayEvent[];
}

const GLYPH: Record<'fire' | 'cashbag' | 'horn', string> = {
  fire: '🔥',
  cashbag: '💰',
  horn: '📯',
};

/**
 * Massive 3D-style emoji bouncing across the glass table on every hype event.
 * Anchored to the enclosing *relative* container.
 */
export const HypeEmojiOverlay: React.FC<HypeEmojiOverlayProps> = ({ events }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      data-testid="vibe654-hype-overlay"
      aria-hidden
    >
      <AnimatePresence>
        {events.map((ev) => {
          const startX = Math.random() * 80 + 10;   // 10%-90%
          const endX = Math.random() * 80 + 10;
          return (
            <motion.div
              key={`hype-${ev.event_id}`}
              initial={{ left: `${startX}%`, top: '110%', rotate: -15, scale: 0.8, opacity: 0 }}
              animate={{
                left: `${endX}%`,
                top: ['110%', '40%', '110%'],
                rotate: [-15, 15, -8, 15],
                scale: [0.8, 1.8, 1.8, 0.8],
                opacity: [0, 1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, ease: 'easeOut' }}
              className="absolute text-7xl md:text-8xl drop-shadow-[0_0_40px_rgba(255,255,255,0.45)]"
              data-testid={`vibe654-hype-overlay-item-${ev.event_id}`}
            >
              {GLYPH[ev.hype_type]}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default HypeEmojiOverlay;
