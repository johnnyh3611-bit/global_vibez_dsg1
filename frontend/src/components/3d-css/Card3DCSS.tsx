import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function Card3DCSS({ 
  card, 
  position3D = { x: 0, y: 0, z: 0 }, 
  rotation3D = { x: 0, y: 0, z: 0 },
  faceUp = true,
  onClick = undefined as any,
  disabled = false,
  size = 'md'
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const sizes = {
    sm: { width: 60, height: 90 },
    md: { width: 80, height: 120 },
    lg: { width: 100, height: 150 },
  };
  
  const cardSize = sizes[size];
  
  // Parse card value and suit
  const suit = card?.slice(-1);
  const rank = card?.slice(0, -1);
  
  const suitEmojis = {
    'H': '♥️',
    'D': '♦️',
    'C': '♣️',
    'S': '♠️',
  };
  
  const isRed = suit === 'H' || suit === 'D';
  
  return (
    <motion.div
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ 
        scale: 1, 
        rotateY: faceUp ? 0 : 180,
        ...(isHovered && !disabled ? { scale: 1.1, z: position3D.z + 30 } : {}),
      }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      whileHover={!disabled ? { scale: 1.1, z: position3D.z + 30 } : {}}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute ${!disabled ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        left: `calc(50% + ${position3D.x}px)`,
        top: `calc(50% + ${position3D.y}px)`,
        transform: `translate(-50%, -50%) rotateX(${rotation3D.x}deg) rotateY(${rotation3D.y}deg) rotateZ(${rotation3D.z}deg) translateZ(${position3D.z}px)`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Card Front */}
      <div
        className="absolute inset-0 rounded-xl flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5)',
          border: '2px solid rgba(0,0,0,0.1)',
          backfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d',
        }}
      >
        {faceUp && card ? (
          <>
            {/* Rank at corners */}
            <div className="absolute top-1 left-1 text-left font-black leading-tight" style={{ color: isRed ? '#dc2626' : '#1f2937' }}>
              <div className="text-xs">{rank}</div>
              <div className="text-xs">{suitEmojis[suit]}</div>
            </div>
            <div className="absolute bottom-1 right-1 text-right font-black leading-tight rotate-180" style={{ color: isRed ? '#dc2626' : '#1f2937' }}>
              <div className="text-xs">{rank}</div>
              <div className="text-xs">{suitEmojis[suit]}</div>
            </div>
            
            {/* Center */}
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: isRed ? '#dc2626' : '#1f2937' }}>
                {rank}
              </div>
              <div className="text-2xl">{suitEmojis[suit]}</div>
            </div>
          </>
        ) : null}
      </div>
      
      {/* Card Back */}
      <div
        className="absolute inset-0 rounded-xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(244, 114, 182, 0.3)',
          border: '2px solid #F472B6',
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="text-center">
          <div className="text-xs text-[#F472B6] font-black">GLOBAL</div>
          <div className="text-xs text-[#22D3EE] font-black">VIBEZ</div>
        </div>
      </div>
    </motion.div>
  );
}