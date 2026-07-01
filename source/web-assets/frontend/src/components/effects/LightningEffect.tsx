import React from 'react';
import { motion } from 'framer-motion';

export default function LightningEffect({ multiplier, show }) {
  if (!show || !multiplier || multiplier === 1) return null;

  const getColor = () => {
    if (multiplier >= 20) return '#ff00ea'; // Purple for mega multipliers
    if (multiplier >= 10) return '#00f2ff'; // Cyan for high multipliers
    return '#fbbf24'; // Gold for standard multipliers
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
    >
      {/* Lightning Bolts */}
      <motion.div
        animate={{
          opacity: [0, 1, 0, 1, 0],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ duration: 0.3, times: [0, 0.25, 0.5, 0.75, 1] }}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle, ${getColor()}20 0%, transparent 70%)`
        }}
      />

      {/* Multiplier Badge */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 10 }}
        className="relative"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            boxShadow: [
              `0 0 20px ${getColor()}`,
              `0 0 40px ${getColor()}`,
              `0 0 20px ${getColor()}`
            ]
          }}
          transition={{ duration: 1, repeat: Infinity }}
          className="px-8 py-4 rounded-2xl font-black text-4xl"
          style={{
            background: `linear-gradient(135deg, ${getColor()}, ${getColor()}dd)`,
            color: '#000',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
        >
          ⚡ {multiplier}X ⚡
        </motion.div>
      </motion.div>

      {/* Particle Burst */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            x: Math.cos((i * 30 * Math.PI) / 180) * 200,
            y: Math.sin((i * 30 * Math.PI) / 180) * 200
          }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute w-3 h-3 rounded-full"
          style={{ background: getColor() }}
        />
      ))}
    </motion.div>
  );
}