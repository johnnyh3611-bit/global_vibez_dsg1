import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ModalWrapper({ isOpen, onClose, title, emoji, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl border-4 border-cyan-500 shadow-2xl shadow-cyan-500/50"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors z-10"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-purple-600 p-6 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="text-6xl">{emoji}</div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">{title}</h2>
              <p className="text-cyan-200 text-lg">Learn how to play and win!</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
