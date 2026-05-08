import { useState, useEffect } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * ViewModeSelector - Lets users choose between Classic and Responsive views
 * Classic: Original desktop-optimized view (perfect view)
 * Responsive: Scales for all devices
 */
export default function ViewModeSelector({ currentMode, onModeChange }: { currentMode?: any, onModeChange?: any }) {
  return (
    <div className="fixed top-20 right-4 z-50 bg-slate-900/90 backdrop-blur-md rounded-xl border border-amber-500/30 p-3 shadow-2xl">
      <div className="text-xs text-amber-300 font-['Cinzel'] mb-2 text-center">View Mode</div>
      
      <div className="flex gap-2">
        {/* Classic View */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onModeChange('classic')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
            currentMode === 'classic'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <Monitor className="w-5 h-5" />
          <span className="text-[10px] font-bold">Classic</span>
        </motion.button>

        {/* Responsive View */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onModeChange('responsive')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
            currentMode === 'responsive'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <Smartphone className="w-5 h-5" />
          <span className="text-[10px] font-bold">Mobile</span>
        </motion.button>
      </div>
    </div>
  );
}
