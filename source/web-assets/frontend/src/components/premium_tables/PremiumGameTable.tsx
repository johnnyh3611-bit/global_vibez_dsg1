import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DynamicSpotlight } from './ParticleSystem';
import { getTheme } from './themes';
import { getTableScale } from './responsiveLayout';

// Premium 3D Game Table with Dynamic Lighting + RESPONSIVE
export function PremiumGameTable({ 
  children, 
  theme = 'emerald',
  activePlayerPosition = { x: 50, y: 80 },
  potAmount = 0,
  layout, // Passed from parent (useResponsiveGameLayout)
}: {
  children?: any;
  theme?: string;
  activePlayerPosition?: { x: number; y: number };
  potAmount?: number;
  layout?: any;
}) {
  const currentTheme = getTheme(theme);
  const [feltHue, setFeltHue] = useState(0);
  
  // Get responsive table dimensions
  const tableSize = layout ? getTableScale(layout) : { width: 1200, height: 800 };
  const { isPortrait, isMobile } = layout || {};

  // Dynamic felt color based on pot size
  useEffect(() => {
    if (potAmount < 100) setFeltHue(0);
    else if (potAmount < 500) setFeltHue(10);
    else if (potAmount < 1000) setFeltHue(20);
    else setFeltHue(30);
  }, [potAmount]);

  return (
    <div 
      className="relative w-full h-screen overflow-hidden"
      style={{ 
        background: '#000000',
      }}
    >
      {/* Purple Grid Background (matching landing page) */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'center top',
        }}
      />
      
      {/* Purple Glow Spots */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600 rounded-full blur-[120px] pointer-events-none"
      />
      
      {/* Dynamic Spotlight */}
      <DynamicSpotlight activePosition={activePlayerPosition} />
      
      {/* 3D Perspective Container - RESPONSIVE */}
      <div 
        className="absolute inset-0"
        style={{
          perspective: isMobile ? '800px' : isPortrait ? '1000px' : '1200px',
          perspectiveOrigin: '50% 60%',
        }}
      >
        {/* Table - Responsive rotation */}
        <motion.div
          initial={{ rotateX: isPortrait ? 50 : 60, z: -200 }}
          animate={{ rotateX: isPortrait ? 45 : 55, z: -200 }}
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: `${tableSize.width}px`,
            height: `${tableSize.height}px`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Table Surface with Dynamic Hue */}
          <motion.div
            className="absolute inset-0 rounded-[80px] shadow-2xl"
            animate={{
              filter: `hue-rotate(${feltHue}deg) brightness(${1 + potAmount / 5000})`,
            }}
            transition={{ duration: 0.5 }}
            style={{
              background: currentTheme.feltGradient,
              border: `${isMobile ? '16px' : '24px'} solid ${currentTheme.border}`,
              boxShadow: `0 40px 100px rgba(0,0,0,0.8), 
                          inset 0 4px 20px rgba(0,0,0,0.3),
                          0 0 60px ${currentTheme.glow}`,
            }}
          >
            {/* Felt texture */}
            <div 
              className="absolute inset-0 rounded-[60px] opacity-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
              }}
            />
            
            {/* Center Logo - Responsive size */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <motion.div 
                className={`${isMobile ? 'w-20 h-20' : 'w-32 h-32'} rounded-full flex items-center justify-center`}
                animate={{
                  boxShadow: [
                    `0 0 30px ${currentTheme.glow}`,
                    `0 0 50px ${currentTheme.glow}`,
                    `0 0 30px ${currentTheme.glow}`,
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{
                  background: 'radial-gradient(circle, #1F2937 0%, #111827 100%)',
                  border: `${isMobile ? '2px' : '4px'} solid ${currentTheme.accentPrimary}`,
                }}
              >
                <div className="text-center">
                  <div className={`${isMobile ? 'text-xl' : 'text-3xl'} mb-1`}>{currentTheme.icon}</div>
                  <span 
                    className={`${isMobile ? 'text-xs' : 'text-xs'} font-black tracking-wider`}
                    style={{ color: currentTheme.accentPrimary }}
                  >
                    {isMobile ? 'GV' : 'PREMIUM'}
                  </span>
                </div>
              </motion.div>
            </div>
            
            {/* Neon Underglow */}
            <div 
              className="absolute inset-0 rounded-[60px] opacity-30 blur-xl"
              style={{
                background: `radial-gradient(ellipse at bottom, ${currentTheme.accentSecondary}40 0%, transparent 70%)`,
              }}
            />
            
            {/* Suit Markers - Hide on mobile portrait to reduce clutter */}
            {!(isMobile && isPortrait) && (
              <>
                <SuitMarker 
                  symbol="♠️" 
                  position="top" 
                  color={currentTheme.accentPrimary}
                  glow={currentTheme.glow}
                  isMobile={isMobile}
                />
                <SuitMarker 
                  symbol="♥️" 
                  position="right" 
                  color={currentTheme.accentPrimary}
                  glow={currentTheme.glow}
                  isMobile={isMobile}
                />
                <SuitMarker 
                  symbol="♦️" 
                  position="left" 
                  color={currentTheme.accentPrimary}
                  glow={currentTheme.glow}
                  isMobile={isMobile}
                />
                <SuitMarker 
                  symbol="♣️" 
                  position="bottom" 
                  color={currentTheme.accentPrimary}
                  glow={currentTheme.glow}
                  isMobile={isMobile}
                />
              </>
            )}
          </motion.div>
          
          {/* Game Content (cards, chips, etc) */}
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SuitMarker({ symbol, position, color, glow, isMobile }: { symbol?: any, position?: any, color?: any, glow?: any, isMobile?: any }) {
  const positions = {
    top: { top: '10%', left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: '10%', left: '50%', transform: 'translateX(-50%)' },
    left: { top: '50%', left: '10%', transform: 'translateY(-50%)' },
    right: { top: '50%', right: '10%', transform: 'translateY(-50%)' },
  };

  const size = isMobile ? 'w-10 h-10 text-lg' : 'w-16 h-16 text-3xl';

  return (
    <motion.div
      className={`absolute ${size} rounded-full flex items-center justify-center`}
      animate={{
        boxShadow: [
          `0 0 20px ${glow}`,
          `0 0 35px ${glow}`,
          `0 0 20px ${glow}`,
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      style={{
        ...positions[position],
        background: `radial-gradient(circle, ${color} 0%, ${color}CC 100%)`,
        border: `${isMobile ? '2px' : '3px'} solid ${color}80`,
      }}
    >
      {symbol}
    </motion.div>
  );
}
