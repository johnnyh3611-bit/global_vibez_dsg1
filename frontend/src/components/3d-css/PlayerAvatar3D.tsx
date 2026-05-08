import React from 'react';
import { motion } from 'framer-motion';

export function PlayerAvatar3D({ 
  name, 
  suit, 
  chips = 1000,
  position3D = { x: 0, y: 0, z: 0 },
  isPlayer = false,
  isActive = false
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, type: 'spring' }}
      className="absolute"
      style={{
        left: `calc(50% + ${position3D.x}px)`,
        top: `calc(50% + ${position3D.y}px)`,
        transform: `translate(-50%, -50%) translateZ(${position3D.z}px)`,
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
        className="relative"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(20px)',
          border: isActive ? '3px solid #22D3EE' : '2px solid rgba(255,255,255,0.1)',
          boxShadow: isActive 
            ? '0 0 30px rgba(34, 211, 238, 0.6)' 
            : isPlayer 
            ? '0 0 20px rgba(244, 114, 182, 0.4)'
            : '0 0 15px rgba(0,0,0,0.5)',
          borderRadius: '16px',
          padding: '12px 16px',
          minWidth: '120px',
        }}
      >
        <div className="text-center">
          {/* Suit */}
          <div className="text-4xl mb-2">{suit}</div>
          
          {/* Name */}
          <div className="text-white text-sm font-bold mb-1">{name}</div>
          
          {/* Chips */}
          <div className="text-[#D4AF37] text-xs font-bold">
            ${chips}
          </div>
          
          {/* Active indicator */}
          {isActive && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#22D3EE]"
              style={{ boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)' }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}