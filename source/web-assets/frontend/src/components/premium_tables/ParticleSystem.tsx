import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Chip Splash Particle System
export function ChipSplash({ trigger, position = { x: '50%', y: '50%' }, amount = 0 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (trigger) {
      const newParticles = Array.from({ length: 15 }, (_, i) => ({
        id: Date.now() + i,
        angle: (Math.PI * 2 * i) / 15,
        distance: Math.random() * 100 + 50,
        duration: Math.random() * 0.5 + 0.5,
        delay: Math.random() * 0.1,
      }));
      setParticles(newParticles);
      
      setTimeout(() => setParticles([]), 1500);
    }
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              left: position.x,
              top: position.y,
              opacity: 1,
              scale: 1,
            }}
            animate={{
              left: `calc(${position.x} + ${Math.cos(particle.angle) * particle.distance}px)`,
              top: `calc(${position.y} + ${Math.sin(particle.angle) * particle.distance}px)`,
              opacity: 0,
              scale: 0.5,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeOut',
            }}
            className="absolute w-6 h-6 rounded-full"
            style={{
              background: 'radial-gradient(circle, #D4AF37 0%, #F59E0B 100%)',
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.8)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              $
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Center burst effect */}
      {trigger && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute rounded-full"
          style={{
            left: position.x,
            top: position.y,
            width: '80px',
            height: '80px',
            transform: 'translate(-50%, -50%)',
            border: '3px solid #D4AF37',
          }}
        />
      )}
    </div>
  );
}

// Card Trail Effect
export function CardTrail({ active, from, to }: { active?: any, from?: any, to?: any }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute pointer-events-none"
          style={{
            left: from.x,
            top: from.y,
            width: '100px',
            height: '140px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            filter: 'blur(8px)',
            transform: `translate(-50%, -50%) rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}

// Spotlight Effect (follows active player)
export function DynamicSpotlight({ activePosition }: { activePosition?: any }) {
  return (
    <motion.div
      animate={{
        background: `radial-gradient(circle at ${activePosition.x}% ${activePosition.y}%, 
          rgba(244, 114, 182, 0.15) 0%, 
          rgba(244, 114, 182, 0.05) 30%, 
          transparent 60%)`,
      }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

// Enhanced Confetti (suit-shaped)
export function SuitConfetti({ active, colors }: { active?: any, colors?: any }) {
  const suits = ['♠', '♥', '♦', '♣'];
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    if (active) {
      const pieces = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        suit: suits[Math.floor(Math.random() * suits.length)],
        x: Math.random() * 100,
        rotation: Math.random() * 360,
        delay: Math.random() * 0.3,
        duration: Math.random() * 2 + 3,
      }));
      setConfettiPieces(pieces);
    }
  }, [active]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 200 }}>
      <AnimatePresence>
        {active && confettiPieces.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{
              left: `${piece.x}%`,
              top: '-10%',
              rotate: piece.rotation,
              opacity: 1,
            }}
            animate={{
              top: '110%',
              rotate: piece.rotation + 720,
              opacity: [1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: 'linear',
            }}
            className="absolute text-4xl font-bold"
            style={{
              color: colors[Math.floor(Math.random() * colors.length)],
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {piece.suit}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Pot Growth Pulse
export function PotPulse({ amount, previousAmount }: { amount?: any, previousAmount?: any }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (amount > previousAmount) {
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }
  }, [amount, previousAmount]);

  return pulse ? (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0"
      style={{
        border: '3px solid #D4AF37',
        borderRadius: '9999px',
        boxShadow: '0 0 30px rgba(212, 175, 55, 0.8)',
      }}
    />
  ) : null;
}
