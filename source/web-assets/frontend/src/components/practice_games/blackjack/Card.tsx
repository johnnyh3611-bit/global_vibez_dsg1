import { motion } from 'framer-motion';
import type { Suit } from './utils';

interface CardProps {
  suit?: Suit | string;
  value?: string;
  isFlipped?: boolean;
}

const SUIT_ICONS: Record<string, string> = {
  Spades: '♠', Hearts: '♥', Diamonds: '♦', Clubs: '♣',
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

const SUIT_COLORS: Record<string, string> = {
  Spades: '#000', Hearts: '#DC2626', Diamonds: '#DC2626', Clubs: '#000',
  spades: '#000', hearts: '#DC2626', diamonds: '#DC2626', clubs: '#000',
};

export const Card = ({ suit = 'Spades', value = '?', isFlipped = false }: CardProps) => (
  <motion.div
    initial={{ y: -200, opacity: 0, rotateY: 0 }}
    animate={{ y: 0, opacity: 1, rotateY: isFlipped ? 180 : 0 }}
    transition={{ type: 'spring', stiffness: 80, damping: 15 }}
    className="relative w-[12vw] h-[18vw] max-w-[80px] max-h-[112px] min-w-[60px] min-h-[84px]"
    style={{ transformStyle: 'preserve-3d' }}
    data-testid={`card-${value}-${suit}`}
  >
    <div
      className="absolute inset-0 bg-white border-2 border-gray-400 rounded-lg flex flex-col justify-between p-2"
      style={{ backfaceVisibility: 'hidden' }}
    >
      <span className="text-[1.2rem] font-bold" style={{ color: SUIT_COLORS[suit] }}>
        {value}
      </span>
      <div className="self-center text-[2rem]" style={{ color: SUIT_COLORS[suit] }}>
        {SUIT_ICONS[suit]}
      </div>
      <span
        className="text-[1.2rem] font-bold self-end"
        style={{ color: SUIT_COLORS[suit], transform: 'rotate(180deg)' }}
      >
        {value}
      </span>
    </div>
    <div
      className="absolute inset-0 bg-blue-800 border-4 border-white rounded-lg"
      style={{
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e3a8a 100%)',
      }}
    >
      <div className="w-full h-full flex items-center justify-center text-white text-xs opacity-30">
        <div className="border-2 border-white/40 w-3/4 h-3/4 rounded" />
      </div>
    </div>
  </motion.div>
);

export default Card;
