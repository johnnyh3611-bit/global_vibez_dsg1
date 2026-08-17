import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const POINT_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const PointPredictionModal = ({ open, onClose, onSelect }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
        onClick={onClose}
        data-testid="point-prediction-modal"
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card p-6 max-w-md w-full mx-4"
        >
          <h3 className="text-2xl font-black text-amber-400 mb-4">Predict the Point</h3>
          <p className="text-sm text-neutral-300 mb-4">
            Select what you think the final point will be (2-12):
          </p>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {POINT_VALUES.map((point) => (
              <button
                key={`point-${point}`}
                data-testid={`point-option-${point}`}
                onClick={() => onSelect(point)}
                className="metal-button hover:border-amber-500 hover:bg-amber-500/10 p-3 text-lg font-bold"
              >
                {point}
              </button>
            ))}
          </div>
          <Button onClick={onClose} className="w-full metal-button border-red-500 text-red-400">
            Cancel
          </Button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default PointPredictionModal;
