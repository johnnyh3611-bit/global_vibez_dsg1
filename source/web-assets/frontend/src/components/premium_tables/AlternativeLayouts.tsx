import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Layout 1: Hexagonal Premium Table
export function HexagonalTable({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const colors = {
    emerald: 'from-emerald-700 to-emerald-900',
    purple: 'from-purple-700 to-purple-900',
    blue: 'from-blue-700 to-blue-900',
    red: 'from-red-700 to-red-900',
    gold: 'from-yellow-700 to-yellow-900',
  };

  return (
    <div className={`relative w-full h-screen bg-gradient-to-br ${colors[theme]} overflow-hidden`}>
      {/* Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <div className="text-9xl font-black text-white transform rotate-12">
          GLOBAL<br/>VIBEZ<br/>DSG
        </div>
      </div>

      {/* Hexagonal Table */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div 
          className="relative"
          style={{
            width: '800px',
            height: '700px',
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
            background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
            backdropFilter: 'blur(10px)',
            border: '8px solid rgba(255,215,0,0.6)',
            boxShadow: '0 0 60px rgba(255,215,0,0.3), inset 0 0 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Center Logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/40">
              <div className="text-6xl font-black mb-2">GV</div>
              <div className="text-sm font-bold">GLOBAL VIBEZ</div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Cards - Bottom Arc */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3">
        {playerHand.map((card, i) => (
          <motion.div
            key={card.id || `playerHand-${i}`}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="w-20 h-28 bg-white rounded-lg shadow-2xl flex flex-col items-center justify-center border-4 border-purple-500"
          >
            <p className="text-4xl">{card.suit}</p>
            <p className="text-2xl font-black">{card.rank}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Layout 2: Circular Rotating Table
export function CircularTable({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const colors = {
    emerald: { bg: 'from-green-950 to-black', table: 'from-green-800 to-green-900' },
    purple: { bg: 'from-purple-950 to-black', table: 'from-purple-800 to-purple-900' },
    blue: { bg: 'from-blue-950 to-black', table: 'from-blue-800 to-blue-900' },
    red: { bg: 'from-red-950 to-black', table: 'from-red-800 to-red-900' },
    gold: { bg: 'from-yellow-950 to-black', table: 'from-yellow-800 to-yellow-900' },
  };

  return (
    <div className={`relative w-full h-screen bg-gradient-to-br ${colors[theme].bg} overflow-hidden`}>
      {/* Circular Table */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={`relative w-[600px] h-[600px] rounded-full bg-gradient-to-br ${colors[theme].table} shadow-2xl`}
          style={{
            border: '20px solid rgba(139, 69, 19, 0.8)',
            boxShadow: '0 0 80px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.3)',
          }}
        >
          {/* Logo in Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-7xl font-black text-white/30 mb-2">GV</div>
              <div className="text-lg font-bold text-white/30">GLOBAL VIBEZ DSG</div>
              <div className="text-xs text-white/20 mt-1">PREMIUM TABLES</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards in Circle Around Table */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[700px] h-[700px]">
          {playerHand.map((card, i) => {
            const angle = (i * (360 / playerHand.length)) - 90;
            const radius = 350;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;

            return (
              <motion.div
                key={`item-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="absolute w-20 h-28 bg-white rounded-lg shadow-2xl flex flex-col items-center justify-center border-4 border-cyan-500"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle + 90}deg)`,
                }}
              >
                <p className="text-4xl">{card.suit}</p>
                <p className="text-2xl font-black">{card.rank}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Layout 3: Split-Screen Modern
export function SplitScreenTable({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const colors = {
    emerald: 'from-emerald-600 to-teal-800',
    purple: 'from-purple-600 to-pink-800',
    blue: 'from-blue-600 to-cyan-800',
    red: 'from-red-600 to-orange-800',
    gold: 'from-yellow-600 to-amber-800',
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Split Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[theme]} opacity-90`} />
      
      {/* Logo Bar */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-black/50 backdrop-blur-xl flex items-center justify-center z-50 border-b-4 border-yellow-500">
        <div className="text-3xl font-black text-transparent bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text">
          GLOBAL VIBEZ DSG ™
        </div>
      </div>

      {/* Main Playing Area */}
      <div className="absolute inset-0 top-20 bottom-32 flex items-center justify-center">
        <div className="relative w-[90%] h-[90%] bg-black/40 rounded-3xl backdrop-blur-sm border-4 border-white/20 shadow-2xl overflow-hidden">
          {/* Logo Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5">
            <div className="text-[200px] font-black text-white">GV</div>
          </div>
        </div>
      </div>

      {/* Cards Row */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 z-30">
        {playerHand.map((card, i) => (
          <motion.div
            key={card.id || `playerHand-${i}`}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileHover={{ y: -20, scale: 1.1 }}
            transition={{ delay: i * 0.08 }}
            className="w-24 h-36 bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-fuchsia-500 cursor-pointer"
          >
            <p className="text-5xl mb-1">{card.suit}</p>
            <p className="text-3xl font-black">{card.rank}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Layout 4: Diamond Elite Table
export function DiamondTable({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  const colors = {
    emerald: { outer: 'from-emerald-950 via-black to-emerald-950', diamond: 'from-emerald-700 to-emerald-900' },
    purple: { outer: 'from-purple-950 via-black to-purple-950', diamond: 'from-purple-700 to-purple-900' },
    blue: { outer: 'from-blue-950 via-black to-blue-950', diamond: 'from-blue-700 to-blue-900' },
    red: { outer: 'from-red-950 via-black to-red-950', diamond: 'from-red-700 to-red-900' },
    gold: { outer: 'from-yellow-950 via-black to-yellow-950', diamond: 'from-yellow-700 to-yellow-900' },
  };

  return (
    <div className={`relative w-full h-screen bg-gradient-to-br ${colors[theme].outer} overflow-hidden`}>
      {/* Diamond Table */}
      <div className="absolute inset-0 flex items-center justify-center p-12">
        <div
          className={`relative bg-gradient-to-br ${colors[theme].diamond}`}
          style={{
            width: '700px',
            height: '700px',
            transform: 'rotate(45deg)',
            borderRadius: '60px',
            border: '12px solid rgba(255, 215, 0, 0.7)',
            boxShadow: '0 0 100px rgba(255, 215, 0, 0.3), inset 0 0 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Logo */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'rotate(-45deg)' }}>
            <div className="text-center text-white/30">
              <div className="text-8xl font-black mb-3">GV</div>
              <div className="text-2xl font-bold">GLOBAL VIBEZ</div>
              <div className="text-sm mt-1">DSG PREMIUM</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 flex gap-3">
        {playerHand.map((card, i) => (
          <motion.div
            key={card.id || `playerHand-${i}`}
            initial={{ y: 80, rotate: -180, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            whileHover={{ y: -25, scale: 1.15 }}
            transition={{ delay: i * 0.1, type: 'spring' }}
            className="w-20 h-28 bg-white rounded-lg shadow-2xl flex flex-col items-center justify-center border-4 border-yellow-500 cursor-pointer"
          >
            <p className="text-4xl">{card.suit}</p>
            <p className="text-2xl font-black">{card.rank}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Layout 5: Neon Grid Cyber Table
export function NeonGridTable({ playerHand, theme }: { playerHand?: any, theme?: any }) {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Animated Grid Background */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />

      {/* Neon Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/50 via-purple-950/50 to-fuchsia-950/50" />

      {/* Logo Header */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="text-center">
          <div className="text-5xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500 bg-clip-text mb-2">
            GLOBAL VIBEZ DSG
          </div>
          <div className="text-sm text-cyan-400/70 tracking-widest">━━━ PREMIUM CYBER TABLES ━━━</div>
        </div>
      </div>

      {/* Holographic Table */}
      <div className="absolute inset-0 flex items-center justify-center p-16">
        <div 
          className="relative w-full max-w-5xl aspect-video bg-gradient-to-br from-purple-900/30 to-cyan-900/30 rounded-3xl backdrop-blur-sm"
          style={{
            border: '3px solid rgba(0, 255, 255, 0.3)',
            boxShadow: '0 0 60px rgba(0, 255, 255, 0.2), inset 0 0 60px rgba(139, 92, 246, 0.1)',
          }}
        >
          {/* Holographic Logo */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="text-9xl font-black text-transparent bg-gradient-to-br from-cyan-400 to-fuchsia-500 bg-clip-text">
              GV
            </div>
          </div>
        </div>
      </div>

      {/* Floating Cards */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-4">
        {playerHand.map((card, i) => (
          <motion.div
            key={`item-${i}`}
            initial={{ y: 100, opacity: 0, rotateX: -90 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            whileHover={{ y: -30, scale: 1.2, rotateX: 10 }}
            transition={{ delay: i * 0.1, type: 'spring' }}
            className="relative w-24 h-36 bg-gradient-to-br from-purple-900 to-cyan-900 rounded-xl shadow-2xl flex flex-col items-center justify-center cursor-pointer"
            style={{
              border: '2px solid rgba(0, 255, 255, 0.5)',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
            }}
          >
            <p className="text-5xl mb-2">{card.suit}</p>
            <p className="text-3xl font-black text-cyan-400">{card.rank}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
