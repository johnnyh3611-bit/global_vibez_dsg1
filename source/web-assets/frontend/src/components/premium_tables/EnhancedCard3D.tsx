import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function EnhancedCard3D({ 
  card, 
  position3D, 
  rotation3D = { x: 0, y: 0, z: 0 },
  faceUp = true,
  onClick,
  disabled = false,
  size = 'md',
  theme = 'emerald',
}: {
  card: any;
  position3D: any;
  rotation3D?: { x: number; y: number; z: number };
  faceUp?: boolean;
  onClick?: any;
  disabled?: boolean;
  size?: string;
  theme?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const sizeMap: Record<string, { width: number; height: number }> = {
    sm: { width: 80, height: 112 },
    md: { width: 100, height: 150 },
    lg: { width: 120, height: 180 },
  };
  
  const { width, height } = sizeMap[size] || sizeMap.md;
  
  // Card color
  const isRed = card.includes('H') || card.includes('D');
  const suitSymbol = card.includes('H') ? '♥' : 
                     card.includes('D') ? '♦' : 
                     card.includes('S') ? '♠' : '♣';
  const rank = card.replace(/[HDSC]/g, '');

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left: `calc(50% + ${position3D.x}px)`,
        top: `calc(50% + ${position3D.y}px)`,
        transform: `
          translate(-50%, -50%) 
          translateZ(${position3D.z}px)
          rotateX(${rotation3D.x}deg) 
          rotateY(${rotation3D.y}deg) 
          rotateZ(${rotation3D.z}deg)
        `,
        width: `${width}px`,
        height: `${height}px`,
        transformStyle: 'preserve-3d',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      animate={{
        translateZ: isHovered && !disabled ? position3D.z + 20 : position3D.z,
        scale: isHovered && !disabled ? 1.05 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Card Container with Spring Animation */}
      <motion.div
        className="relative w-full h-full"
        animate={{
          rotateY: faceUp ? 0 : 180,
        }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Card Front */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
            border: '3px solid #E2E8F0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3), 0 0 15px rgba(255,255,255,0.1)',
          }}
        >
          {/* Oval Center Design */}
          <div className="absolute inset-2 flex items-center justify-center">
            <div 
              className="flex flex-col items-center justify-center px-3 py-4"
              style={{
                border: `2px solid ${isRed ? '#DC2626' : '#1F2937'}`,
                borderRadius: '50%',
                width: '80%',
                height: '90%',
              }}
            >
              <div 
                className="text-3xl font-black mb-1"
                style={{ color: isRed ? '#DC2626' : '#1F2937' }}
              >
                {rank}
              </div>
              <div 
                className="text-4xl"
                style={{ color: isRed ? '#DC2626' : '#1F2937' }}
              >
                {suitSymbol}
              </div>
            </div>
          </div>
          
          {/* Corner Pips */}
          <div className="absolute top-2 left-2 text-sm font-bold" style={{ color: isRed ? '#DC2626' : '#1F2937' }}>
            {rank}
          </div>
          <div className="absolute bottom-2 right-2 text-sm font-bold rotate-180" style={{ color: isRed ? '#DC2626' : '#1F2937' }}>
            {rank}
          </div>
        </div>
        
        {/* Card Back */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
            border: '3px solid #F472B6',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4), 0 0 20px rgba(244, 114, 182, 0.3)',
          }}
        >
          {/* Pattern */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
            }}
          />
          
          {/* Global Vibez Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-pink-400 text-xl font-black mb-1">GLOBAL</div>
              <div className="text-pink-400 text-xl font-black">VIBEZ</div>
              <div className="text-pink-400 text-xs mt-1">PREMIUM</div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Hover Glow */}
      {isHovered && !disabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.8)',
            border: '2px solid #D4AF37',
          }}
        />
      )}
    </motion.div>
  );
}
