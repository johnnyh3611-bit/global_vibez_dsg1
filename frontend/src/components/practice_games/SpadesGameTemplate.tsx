import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerCardHand } from './PlayerCardHand';
import { MessageCircle, Menu, Coins, Trophy, Users } from 'lucide-react';

// Large Playing Card for Table (played cards)
const TableCard = ({ card, position = 'center' }) => {
  if (!card) return null;
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const suitColors = { H: '#dc2626', D: '#dc2626', C: '#1f2937', S: '#1f2937' };
  
  const displayRank = rank === '10' ? '10' : rank;
  const suitSymbol = suitSymbols[suit];
  const suitColor = suitColors[suit];
  
  return (
    <motion.div
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ type: 'spring', duration: 0.6 }}
      className="absolute"
      style={{
        width: '80px',
        height: '112px',
        ...position === 'top' && { top: '10px', left: '50%', marginLeft: '-40px' },
        ...position === 'left' && { left: '10px', top: '50%', marginTop: '-56px' },
        ...position === 'right' && { right: '10px', top: '50%', marginTop: '-56px' },
        ...position === 'bottom' && { bottom: '10px', left: '50%', marginLeft: '-40px' }
      }}
    >
      <div 
        className="w-full h-full rounded-xl shadow-2xl relative"
        style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9e7 100%)',
          border: '3px solid #d4d4d4',
          boxShadow: '0 12px 35px rgba(0,0,0,0.6)'
        }}
      >
        {/* Top left */}
        <div className="absolute top-2 left-2 flex flex-col items-center leading-none" style={{ color: suitColor }}>
          <span className="text-2xl font-black">{displayRank}</span>
          <span className="text-lg">{suitSymbol}</span>
        </div>
        
        {/* Center suit */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
          <span className="text-7xl" style={{ color: suitColor }}>{suitSymbol}</span>
        </div>
        
        {/* Bottom right */}
        <div className="absolute bottom-2 right-2 flex flex-col items-center leading-none rotate-180" style={{ color: suitColor }}>
          <span className="text-2xl font-black">{displayRank}</span>
          <span className="text-lg">{suitSymbol}</span>
        </div>
      </div>
    </motion.div>
  );
};

// Player Avatar Component
const PlayerAvatar = ({ name, cardCount, isActive, color = 'blue', score }) => {
  const colorMap = {
    blue: { bg: 'from-blue-500 to-blue-700', border: 'border-blue-400' },
    red: { bg: 'from-red-500 to-red-700', border: 'border-red-400' },
    green: { bg: 'from-green-500 to-green-700', border: 'border-green-400' }
  };
  
  const colors = colorMap[color];
  
  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colors.bg} border-4 ${colors.border} shadow-2xl flex items-center justify-center relative`}>
        <span className="text-white text-xl font-black">{name}</span>
        {isActive && (
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 border-4 border-yellow-400 rounded-full"
          />
        )}
      </div>
      
      <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white/30">
        {cardCount} cards
      </div>
      
      {score !== undefined && (
        <div className="bg-black/70 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded shadow">
          {score}
        </div>
      )}
    </motion.div>
  );
};

// Complete Game Template (Layout 1 - Traditional Casino)
export function SpadesGameTemplate({ game, onMove, makingMove }: { game?: any, onMove?: any, makingMove?: any }) {
  
  return (
    <div 
      className="w-full h-screen relative overflow-hidden flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #2d1f12 0%, #1a120c 50%, #2d1f12 100%)',
      }}
    >
      <h1 className="text-white text-6xl font-black">SPADES TEMPLATE RENDERING!</h1>
    </div>
  );
}
