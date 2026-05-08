import { motion, AnimatePresence } from 'framer-motion';

export interface GameLog {
  timestamp: string;
  action: string;
  details: string;
}

interface GameLogPanelProps {
  open: boolean;
  logs?: GameLog[];
  onClose: () => void;
}

export const GameLogPanel = ({ open, logs = [], onClose }: GameLogPanelProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="fixed top-52 right-5 w-96 max-h-96 bg-black/90 backdrop-blur-md p-4 text-xs text-green-400 overflow-y-auto font-mono border-2 border-green-500/50 rounded-lg shadow-2xl z-50"
        style={{ fontFamily: 'monospace' }}
        data-testid="game-log-panel"
      >
        <div className="flex justify-between items-center mb-3 border-b border-green-900 pb-2">
          <div className="text-green-400 font-bold text-sm">GAME LOG</div>
          <button
            data-testid="close-log-btn"
            onClick={onClose}
            className="text-red-400 hover:text-red-300 font-bold text-lg"
          >
            ✕
          </button>
        </div>
        {logs.length > 0 ? (
          logs.map((log, i) => (
            <motion.div
              key={`log-${log.timestamp}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="mb-2 text-[11px] leading-relaxed"
            >
              <span className="text-green-600">[{log.timestamp}]</span>{' '}
              <span className="text-yellow-400 font-semibold">{log.action}:</span>{' '}
              <span className="text-green-300">{log.details}</span>
            </motion.div>
          ))
        ) : (
          <div className="text-green-700 italic text-center py-4">No logs yet...</div>
        )}
      </motion.div>
    )}
  </AnimatePresence>
);

export default GameLogPanel;
