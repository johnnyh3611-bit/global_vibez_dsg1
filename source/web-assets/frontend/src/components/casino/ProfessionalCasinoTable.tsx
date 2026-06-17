import React, { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Professional Casino Table - Evolution Gaming Style (Complete System)
 * 4 Dealer Styles + Luxury Casino Room + Accurate Table Layout
 */

// Dealer Profiles
const DEALERS = {
  classic_male: {
    name: "JAMES",
    image: "https://images.unsplash.com/photo-1616015478992-e9412edbdb5d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBjYXNpbm8lMjBkZWFsZXIlMjBwb3J0cmFpdCUyMG1hbGUlMjBmZW1hbGUlMjBzdWl0JTIwdW5pZm9ybSUyMGRpZmZlcmVudCUyMHN0eWxlc3xlbnwwfHx8fDE3NzUzNDk0MDZ8MA&ixlib=rb-4.1.0&q=85",
    style: "Classic Professional"
  },
  elegant_female: {
    name: "SOPHIA",
    image: "https://images.unsplash.com/photo-1604904612715-47bf9d9bc670?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBjYXNpbm8lMjBkZWFsZXIlMjBwb3J0cmFpdCUyMG1hbGUlMjBmZW1hbGUlMjBzdWl0JTIwdW5pZm9ybSUyMGRpZmZlcmVudCUyMHN0eWxlc3xlbnwwfHx8fDE3NzUzNDk0MDZ8MA&ixlib=rb-4.1.0&q=85",
    style: "Elegant Premium"
  },
  modern_female: {
    name: "AURORA",
    image: "https://images.unsplash.com/photo-1676694047699-22a84420e566?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBjYXNpbm8lMjBkZWFsZXIlMjBwb3J0cmFpdCUyMG1hbGUlMjBmZW1hbGUlMjBzdWl0JTIwdW5pZm9ybSUyMGRpZmZlcmVudCUyMHN0eWxlc3xlbnwwfHx8fDE3NzUzNDk0MDZ8MA&ixlib=rb-4.1.0&q=85",
    style: "Modern Contemporary"
  },
  executive_male: {
    name: "ALEXANDER",
    image: "https://images.unsplash.com/photo-1655333879254-1fb721db743c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBjYXNpbm8lMjBkZWFsZXIlMjBwb3J0cmFpdCUyMG1hbGUlMjBmZW1hbGUlMjBzdWl0JTIwdW5pZm9ybSUyMGRpZmZlcmVudCUyMHN0eWxlc3xlbnwwfHx8fDE3NzUzNDk0MDZ8MA&ixlib=rb-4.1.0&q=85",
    style: "Executive VIP"
  }
};

export default function ProfessionalCasinoTable({
  onBet,
  onHit,
  onStand,
  onInsurance,
  playerChips = 25480,
  handTotal = 18,
  dealerStyle = "classic_male",
  gameType = "blackjack"
}) {
  const [hoveredButton, setHoveredButton] = useState(null);
  const dealer = DEALERS[dealerStyle] || DEALERS.classic_male;

  // Casino table background
  const tableBackground = "https://images.unsplash.com/photo-1642953088847-b31bc9424060?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBjYXNpbm8lMjBibGFja2phY2slMjBkZWFsZXIlMjB0YWJsZSUyMGdyZWVuJTIwZmVsdCUyMHJlYWxpc3RpY3xlbnwwfHx8fDE3NzUzNDg2NzZ8MA&ixlib=rb-4.1.0&q=85";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0604]">
      
      {/* Luxury Casino Room Background - FILLED IN */}
      <div className="absolute inset-0">
        {/* Rich Wood Paneling */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to bottom, #2d1810 0%, #1a0f0a 50%, #2d1810 100%)',
            backgroundSize: 'cover'
          }}
        />
        
        {/* Wood texture overlay */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='wood'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.03' numOctaves='8' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23wood)' fill='%238B4513'/%3E%3C/svg%3E")`,
            backgroundSize: '400px 400px'
          }}
        />
        
        {/* Decorative Wood Molding - Top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#654321] via-[#4a2f1a] to-transparent opacity-60" />
        
        {/* Decorative Wood Molding - Sides */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#654321] via-[#4a2f1a] to-transparent opacity-40" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#654321] via-[#4a2f1a] to-transparent opacity-40" />
      </div>

      {/* Chandelier Lighting Effects - Multiple Sources */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-orange-300/20 via-yellow-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-gradient-radial from-amber-400/15 via-yellow-500/8 to-transparent blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-gradient-radial from-amber-400/15 via-yellow-500/8 to-transparent blur-2xl pointer-events-none" />

      {/* Chandelier Visual (Ornate) */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="relative w-32 h-24">
          {/* Chandelier center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-b from-yellow-200/30 to-orange-300/20 blur-xl" />
          </div>
          {/* Chandelier lights */}
          {[...Array(5)].map((_, i) => (
            <div
              key={_.id || _.name || `item-${i}`}
              className="absolute w-3 h-3 rounded-full bg-gradient-to-b from-yellow-300 to-orange-400 shadow-[0_0_20px_rgba(251,191,36,0.8)]"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + Math.sin(i) * 20}%`,
                opacity: 0.6 + Math.random() * 0.4
              }}
            />
          ))}
        </div>
      </div>

      {/* Professional Dealer Section */}
      <div className="absolute top-0 left-0 right-0 h-[38%] flex items-end justify-center overflow-hidden z-20">
        <div className="relative w-full h-full flex items-end justify-center">
          {/* Dealer Image with Professional Framing */}
          <div className="relative">
            <div 
              className="w-[420px] h-[480px] bg-cover bg-center bg-no-repeat rounded-b-[220px] shadow-2xl border-4 border-yellow-900/40"
              style={{
                backgroundImage: `url(${dealer.image})`,
                backgroundPosition: 'center 20%',
                filter: 'brightness(1.05) contrast(1.15) saturate(1.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.3)'
              }}
            >
              {/* Vignette effect */}
              <div className="absolute inset-0 rounded-b-[220px] bg-gradient-to-t from-black/40 via-transparent to-black/20" />
            </div>
            
            {/* Dealer Name Tag - Premium Design */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/50 via-yellow-500/60 to-yellow-600/50 blur-xl" />
                <div className="relative bg-gradient-to-br from-black via-gray-900 to-black backdrop-blur-md border-2 border-yellow-500/70 px-10 py-3.5 rounded-full shadow-2xl">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-yellow-600/10 to-transparent" />
                  <span className="relative text-yellow-400 font-black text-xl tracking-[0.4em] drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
                    {dealer.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Casino Table - 7-Seat Semi-Circular Evolution Gaming Layout */}
      <div className="absolute top-[33%] left-1/2 -translate-x-1/2 w-[92%] max-w-[1600px] h-[52%] z-10">
        
        {/* Mahogany Wood Rim (Rich & Realistic) */}
        <div 
          className="relative w-full h-full rounded-t-[650px] p-5 shadow-2xl"
          style={{
            background: 'linear-gradient(145deg, #5a3825 0%, #8B4513 30%, #A0522D 50%, #8B4513 70%, #5a3825 100%)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.9), inset 0 5px 25px rgba(0,0,0,0.6), inset 0 -2px 15px rgba(139,69,19,0.4)'
          }}
        >
          {/* Wood grain effect */}
          <div className="absolute inset-0 rounded-t-[650px] opacity-30 mix-blend-multiply"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence baseFrequency='0.05,0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23grain)' fill='%238B4513'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Green Felt Surface with Real Casino Photo */}
          <div 
            className="relative w-full h-full rounded-t-[630px] overflow-hidden"
            style={{
              backgroundImage: `url(${tableBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5), inset 0 10px 40px rgba(0,0,0,0.3)'
            }}
          >
            {/* Dark overlay for better label contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/25" />

            {/* Betting Positions - Evolution Gaming 7-Seat Layout */}
            <div className="absolute inset-0">
              
              {/* Top Row - 3 Positions */}
              <div className="absolute top-[8%] left-1/2 -translate-x-1/2 flex gap-16">
                <BettingCircle label="PLAYER 3" size="medium" />
                <BettingCircle label="TIE" highlight size="medium" />
                <BettingCircle label="BANKER" size="medium" />
              </div>

              {/* Center Main Betting Area - PLAYER 4 (Primary Position) */}
              <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[680px] h-[220px]">
                <div 
                  className="w-full h-full rounded-[140px] border-[5px] border-yellow-500/90 backdrop-blur-sm flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.15) 100%)',
                    boxShadow: '0 0 40px rgba(234, 179, 8, 0.5), inset 0 0 50px rgba(0,0,0,0.4), inset 0 5px 30px rgba(234,179,8,0.1)'
                  }}
                >
                  <div className="absolute inset-0 rounded-[140px] bg-gradient-to-b from-yellow-500/5 to-transparent" />
                  <span className="relative text-yellow-400 text-5xl font-black tracking-[0.5em] drop-shadow-[0_0_15px_rgba(234,179,8,1)] text-shadow-lg">
                    [ PLAYER 4 ]
                  </span>
                </div>
              </div>

              {/* Side Positions */}
              <div className="absolute top-[32%] left-[6%]">
                <BettingCircle label="BANKER 3" size="small" />
              </div>
              <div className="absolute top-[32%] right-[6%]">
                <BettingCircle label="PLAYER 5" size="small" />
              </div>

              {/* Bottom Commission Area */}
              <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2">
                <div 
                  className="px-20 py-5 rounded-full border-4 border-yellow-500/80 backdrop-blur-sm relative"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    boxShadow: '0 0 25px rgba(234,179,8,0.4), inset 0 0 30px rgba(0,0,0,0.3)'
                  }}
                >
                  <span className="text-yellow-400 text-3xl font-black tracking-[0.4em] drop-shadow-lg">
                    COMMISSION
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Professional Action Buttons - Curved Layout */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-7 items-center z-30">
        <ProfessionalButton label="BET" color="green" onClick={onBet} onHover={setHoveredButton} isHovered={hoveredButton === 'bet'} />
        <ProfessionalButton label="HIT" color="blue" onClick={onHit} onHover={setHoveredButton} isHovered={hoveredButton === 'hit'} />
        <ProfessionalButton label="STAND" color="burgundy" onClick={onStand} onHover={setHoveredButton} isHovered={hoveredButton === 'stand'} />
        <ProfessionalButton label="INSURANCE" color="gold" onClick={onInsurance} onHover={setHoveredButton} isHovered={hoveredButton === 'insurance'} />
      </div>

      {/* Premium Chip Counter - Bottom Left */}
      <div className="absolute bottom-12 left-12 z-30">
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-600/20 blur-2xl" />
          <div className="relative bg-gradient-to-br from-black/95 via-gray-900/95 to-black/95 backdrop-blur-xl border-3 border-yellow-600/70 rounded-2xl p-6 shadow-2xl min-w-[240px]">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-yellow-600/5 to-transparent" />
            <div className="relative flex items-center gap-5">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 border-[5px] border-yellow-500 flex items-center justify-center shadow-xl">
                <span className="text-yellow-400 font-black text-base">10K</span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/20" />
              </div>
              <div>
                <div className="text-5xl font-black text-white drop-shadow-lg">
                  ${playerChips.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">
                  Total Chips: {(playerChips / 1000).toFixed(0)}k
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Hand Total - Bottom Right */}
      {handTotal > 0 && (
        <div className="absolute bottom-12 right-12 z-30">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-600/20 blur-2xl" />
            <div className="relative bg-gradient-to-br from-black/95 via-gray-900/95 to-black/95 backdrop-blur-xl border-3 border-yellow-600/70 rounded-2xl p-6 shadow-2xl min-w-[180px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-yellow-600/5 to-transparent" />
              <div className="relative">
                <div className="text-sm text-gray-400 uppercase tracking-widest mb-3 font-bold">Hand Total:</div>
                <div className="text-7xl font-black text-white drop-shadow-lg text-center">{handTotal}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dealer Style Selector (for preview) */}
      <div className="absolute top-6 right-6 z-40">
        <div className="text-xs text-yellow-400/60 uppercase tracking-wider">
          {dealer.style}
        </div>
      </div>

    </div>
  );
}

// Betting Circle Component
function BettingCircle({ label, size = "medium", highlight = false }) {
  const sizeClasses = {
    small: "w-32 h-32 text-sm border-3",
    medium: "w-40 h-40 text-base border-4",
    large: "w-48 h-48 text-lg border-4"
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} rounded-full ${highlight ? 'border-yellow-400' : 'border-yellow-500/90'} backdrop-blur-sm flex items-center justify-center relative`}
      style={{
        background: 'rgba(0, 0, 0, 0.25)',
        boxShadow: `0 0 ${highlight ? '35px' : '25px'} rgba(234, 179, 8, ${highlight ? '0.6' : '0.4'}), inset 0 0 30px rgba(0,0,0,0.5)`
      }}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-500/10 to-transparent" />
      <span className="relative text-yellow-400 font-bold tracking-widest text-center px-3 drop-shadow-lg">
        {label}
      </span>
    </div>
  );
}

// Professional Button Component
function ProfessionalButton({ label, color, onClick, onHover, isHovered }) {
  const colorStyles = {
    green: {
      bg: 'linear-gradient(145deg, #15803d 0%, #16a34a 40%, #22c55e 50%, #16a34a 60%, #15803d 100%)',
      border: '#fbbf24',
      text: '#fef3c7',
      shadow: 'rgba(34, 197, 94, 0.7)',
      hoverGlow: 'rgba(34, 197, 94, 0.5)'
    },
    blue: {
      bg: 'linear-gradient(145deg, #1e40af 0%, #2563eb 40%, #3b82f6 50%, #2563eb 60%, #1e40af 100%)',
      border: '#e5e7eb',
      text: '#ffffff',
      shadow: 'rgba(59, 130, 246, 0.7)',
      hoverGlow: 'rgba(59, 130, 246, 0.5)'
    },
    burgundy: {
      bg: 'linear-gradient(145deg, #991b1b 0%, #b91c1c 40%, #dc2626 50%, #b91c1c 60%, #991b1b 100%)',
      border: '#e5e7eb',
      text: '#ffffff',
      shadow: 'rgba(220, 38, 38, 0.7)',
      hoverGlow: 'rgba(220, 38, 38, 0.5)'
    },
    gold: {
      bg: 'linear-gradient(145deg, #d97706 0%, #f59e0b 40%, #fbbf24 50%, #f59e0b 60%, #d97706 100%)',
      border: '#18181b',
      text: '#18181b',
      shadow: 'rgba(245, 158, 11, 0.7)',
      hoverGlow: 'rgba(245, 158, 11, 0.5)'
    }
  };

  const style = colorStyles[color];

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => onHover(label.toLowerCase())}
      onMouseLeave={() => onHover(null)}
      whileHover={{ scale: 1.1, y: -10 }}
      whileTap={{ scale: 0.9 }}
      className="relative w-48 h-[88px] rounded-3xl font-black text-2xl tracking-wider cursor-pointer overflow-hidden"
      style={{
        background: style.bg,
        border: `5px solid ${style.border}`,
        color: style.text,
        boxShadow: `0 12px 50px ${style.shadow}, inset 0 4px 20px rgba(255,255,255,0.3), inset 0 -2px 15px rgba(0,0,0,0.3)`,
        textShadow: '0 4px 10px rgba(0,0,0,0.7)'
      }}
    >
      {/* Button Label */}
      <span className="relative z-10 drop-shadow-lg">{label}</span>
      
      {/* Glossy Highlight */}
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none transition-all duration-300"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
          opacity: isHovered ? 0.8 : 0.5
        }}
      />

      {/* Hover Glow */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            boxShadow: `0 0 50px ${style.hoverGlow}, inset 0 0 30px ${style.hoverGlow}`
          }}
        />
      )}
    </motion.button>
  );
}
