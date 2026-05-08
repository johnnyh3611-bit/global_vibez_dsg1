import React from 'react';
import { motion } from 'framer-motion';

// 3D Game Table Container using CSS 3D transforms
export function GameTable3D({ children, tableFelt = "emerald" }) {
  const feltColors = {
    emerald: 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #064E3B 100%)',
    crimson: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)',
  };

  return (
    <div className="relative w-full h-screen bg-[#080C16] overflow-hidden">
      {/* 3D Perspective Container */}
      <div 
        className="absolute inset-0"
        style={{
          perspective: '1200px',
          perspectiveOrigin: '50% 60%',
        }}
      >
        {/* Table - Rotated to show depth */}
        <motion.div
          initial={{ rotateX: 60, z: -200 }}
          animate={{ rotateX: 55, z: -200 }}
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '1200px',
            height: '800px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Table Surface */}
          <div
            className="absolute inset-0 rounded-[80px] shadow-2xl"
            style={{
              background: feltColors[tableFelt],
              border: '24px solid #78350f',
              boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            {/* Felt texture */}
            <div 
              className="absolute inset-0 rounded-[60px] opacity-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
              }}
            />
            
            {/* Center Logo */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle, #1F2937 0%, #111827 100%)',
                  boxShadow: '0 0 30px rgba(244, 114, 182, 0.4)',
                  border: '4px solid #F472B6',
                }}
              >
                <span className="text-white text-xl font-black">GLOBAL<br/>VIBEZ</span>
              </div>
            </div>
            
            {/* Suit Markers */}
            <SuitMarker symbol="♠️" position="top" />
            <SuitMarker symbol="♥️" position="right" />
            <SuitMarker symbol="♦️" position="left" />
            <SuitMarker symbol="♣️" position="bottom" />
          </div>
          
          {/* Game Content (cards, chips, etc) */}
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SuitMarker({ symbol, position }) {
  const positions = {
    top: { top: '10%', left: '50%', transform: 'translateX(-50%)' },
    bottom: { bottom: '10%', left: '50%', transform: 'translateX(-50%)' },
    left: { top: '50%', left: '10%', transform: 'translateY(-50%)' },
    right: { top: '50%', right: '10%', transform: 'translateY(-50%)' },
  };

  return (
    <div
      className="absolute w-16 h-16 rounded-full flex items-center justify-center text-3xl"
      style={{
        ...positions[position],
        background: 'radial-gradient(circle, #D4AF37 0%, #B8860B 100%)',
        boxShadow: '0 0 20px rgba(34, 211, 238, 0.5)',
        border: '3px solid rgba(34, 211, 238, 0.3)',
      }}
    >
      {symbol}
    </div>
  );
}