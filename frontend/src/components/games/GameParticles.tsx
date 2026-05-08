import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Particle effect system for game interactions
 * Creates bursts of particles on moves, wins, etc.
 */
export const GameParticles = ({ trigger, position = { x: 0, y: 0 }, color = 'cyan' }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (trigger) {
      // Generate particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        angle: (360 / 12) * i,
        distance: 100 + Math.random() * 50,
        duration: 0.8 + Math.random() * 0.4
      }));
      setParticles(newParticles);

      // Clear particles after animation
      setTimeout(() => setParticles([]), 1500);
    }
  }, [trigger]);

  const colorClasses = {
    cyan: 'from-cyan-400 to-blue-500',
    purple: 'from-purple-400 to-pink-500',
    green: 'from-green-400 to-emerald-500',
    red: 'from-red-400 to-rose-500',
    yellow: 'from-yellow-400 to-amber-500'
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {particles.map((particle) => {
        const rad = (particle.angle * Math.PI) / 180;
        const endX = Math.cos(rad) * particle.distance;
        const endY = Math.sin(rad) * particle.distance;

        return (
          <motion.div
            key={particle.id}
            className={`absolute w-3 h-3 rounded-full bg-gradient-to-br ${colorClasses[color]} shadow-lg`}
            style={{
              left: position.x,
              top: position.y
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: endX,
              y: endY,
              scale: [1, 1.5, 0],
              opacity: [1, 0.8, 0]
            }}
            transition={{
              duration: particle.duration,
              ease: 'easeOut'
            }}
          />
        );
      })}
    </div>
  );
};

/**
 * Trail effect for card movements
 */
export const CardTrail = ({ show, from, to }) => {
  if (!show) return null;

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <svg className="w-full h-full">
        <motion.path
          d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y - 100} ${to.x} ${to.y}`}
          stroke="url(#trail-gradient)"
          strokeWidth="4"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        <defs>
          <linearGradient id="trail-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};

export default GameParticles;
