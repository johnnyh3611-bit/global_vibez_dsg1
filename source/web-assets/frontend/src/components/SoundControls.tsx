import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import soundManager from '@/utils/soundManager';

export default function SoundControls({ className = '' }) {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    // Load saved preferences
    const savedEnabled = localStorage.getItem('soundEnabled');
    const savedVolume = localStorage.getItem('soundVolume');
    
    if (savedEnabled !== null) {
      setEnabled(savedEnabled === 'true');
    }
    
    if (savedVolume !== null) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  const toggleSound = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    soundManager.setEnabled(newEnabled);
    
    if (newEnabled) {
      soundManager.notification();
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    soundManager.setVolume(newVolume);
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Sound Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleSound}
        onMouseEnter={() => setShowSlider(true)}
        onMouseLeave={() => setTimeout(() => setShowSlider(false), 2000)}
        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-colors"
        title={enabled ? 'Mute sounds' : 'Enable sounds'}
      >
        {enabled ? (
          <Volume2 className="w-5 h-5 text-cyan-400" />
        ) : (
          <VolumeX className="w-5 h-5 text-slate-400" />
        )}
      </motion.button>

      {/* Volume Slider */}
      {showSlider && enabled && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="absolute left-full ml-2 bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl z-50"
          onMouseEnter={() => setShowSlider(true)}
          onMouseLeave={() => setShowSlider(false)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-medium whitespace-nowrap">
              Volume
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-cyan-400
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
            />
            <span className="text-xs text-cyan-400 font-bold w-8">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
