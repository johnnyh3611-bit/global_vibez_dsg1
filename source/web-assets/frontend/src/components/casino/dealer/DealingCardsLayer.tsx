import { AnimatePresence, motion } from 'framer-motion';

interface DealingCard {
  id: string;
  rotation?: number;
}

interface DealingCardsLayerProps {
  dealingCards: DealingCard[];
}

export const DealingCardsLayer = ({ dealingCards }: DealingCardsLayerProps) => (
  <AnimatePresence>
    {dealingCards.map((card) => (
      <motion.div
        key={card.id}
        initial={{ x: 0, y: 0, scale: 0.5, opacity: 1, rotate: 0 }}
        animate={{
          x: 200 + Math.random() * 100,
          y: 150 + Math.random() * 50,
          scale: 1,
          opacity: 0,
          rotate: card.rotation,
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="absolute top-1/2 left-1/2 w-16 h-24 bg-white rounded-lg shadow-lg border-2 border-cyan-400/50"
        style={{
          transformOrigin: 'center',
          filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.6))',
        }}
      >
        <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center">
          <span className="text-white text-3xl">🂠</span>
        </div>
      </motion.div>
    ))}
  </AnimatePresence>
);

export default DealingCardsLayer;
