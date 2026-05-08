import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const moodClass = (mood) => {
  if (mood === 'celebrating') return 'dealer-celebrating';
  if (mood === 'sympathetic') return 'dealer-sympathetic';
  return 'dealer-professional';
};

/**
 * Nova dealer broadcast banner.
 *
 * Inline (in-flow) component so the parent can stack it under the
 * room menu bar without the old absolute-positioning that clipped on
 * mobile viewports.
 */
export const NovaDealerHeader = ({ dealerMessage, dealerMood }) => (
  <motion.div
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="w-full max-w-3xl mx-auto px-3 sm:px-4 mt-3"
    data-testid="nova-dealer-header"
  >
    <div className="glass-panel rounded-2xl px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-5 border border-amber-500/30 bg-black/55 backdrop-blur-md">
      <div className={`dealer-avatar-circle shrink-0 ${moodClass(dealerMood)}`}>
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-2xl sm:text-4xl font-black">
          N
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="text-nova font-bold tracking-widest text-[10px] sm:text-sm flex items-center gap-1 sm:gap-2">
          <Star className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" />
          NOVA · LEAD DEALER
        </h3>
        <p
          className="text-white italic text-sm sm:text-base lg:text-lg leading-snug"
          data-testid="dealer-message"
        >
          {dealerMessage}
        </p>
      </div>
    </div>
  </motion.div>
);

export default NovaDealerHeader;
