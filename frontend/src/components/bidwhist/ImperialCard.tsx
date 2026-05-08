import { motion } from 'framer-motion';

const IMPERIAL_PALETTE = {
  mahogany: '#420d09',
  gold: '#d4af37',
  cream: '#f5f5dc',
  ivory: '#fffff0',
  burgundy: '#800020'
};

const IMPERIAL_SUITS = {
  'spades': { symbol: '♠', color: '#000000', name: 'Spades' },
  'hearts': { symbol: '♥', color: '#dc2626', name: 'Hearts' },
  'diamonds': { symbol: '♦', color: '#2563eb', name: 'Diamonds' },
  'clubs': { symbol: '♣', color: '#15803d', name: 'Clubs' },
  'joker': { symbol: '🃏', color: '#7c2d12', name: 'Joker' }
};

export default function ImperialCard({ card, onClick, disabled, selected, isInKitty = false, showBack = false, size }: { card?: any, onClick?: any, disabled?: any, selected?: any, isInKitty?: any, showBack?: any, size?: string }) {
  if (!card || showBack) {
    // ============================================
    // CARD BACK DESIGNS - 4 OPTIONS
    // Choose ONE by uncommenting the return statement
    // ============================================

    /* DESIGN 1: DIAGONAL STRIPES (Bold & Modern)
    return (
      <motion.div
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative w-20 h-32 rounded-lg overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${IMPERIAL_PALETTE.burgundy} 0%, ${IMPERIAL_PALETTE.mahogany} 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
        }}
      >
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(212,175,55,0.1) 0px, rgba(212,175,55,0.1) 10px, transparent 10px, transparent 20px)'
        }} />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-['Cinzel'] font-bold text-center" style={{ color: IMPERIAL_PALETTE.gold }}>
            <div className="text-xs tracking-wider mb-1">VIBEZ</div>
            <div className="text-2xl mb-1">🎴</div>
            <div className="text-[8px] tracking-widest">DSG</div>
          </div>
        </div>
        
        <div className="absolute top-1 left-1 text-xs opacity-40" style={{ color: IMPERIAL_PALETTE.gold }}>♠</div>
        <div className="absolute top-1 right-1 text-xs opacity-40" style={{ color: IMPERIAL_PALETTE.gold }}>♥</div>
        <div className="absolute bottom-1 left-1 text-xs opacity-40" style={{ color: IMPERIAL_PALETTE.gold }}>♦</div>
        <div className="absolute bottom-1 right-1 text-xs opacity-40" style={{ color: IMPERIAL_PALETTE.gold }}>♣</div>
      </motion.div>
    ); */

    /* DESIGN 2: ORNATE BORDER (Classic & Elegant)
    return (
      <motion.div
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative w-20 h-32 rounded-lg overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #1a0505 0%, ${IMPERIAL_PALETTE.mahogany} 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
        }}
      >
        <div className="absolute inset-1 border-2 rounded-md" style={{ borderColor: IMPERIAL_PALETTE.gold, opacity: 0.6 }}>
          <div className="absolute inset-1 border border-dashed rounded-sm" style={{ borderColor: IMPERIAL_PALETTE.gold, opacity: 0.3 }} />
        </div>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-['Cinzel'] font-bold text-center" style={{ color: IMPERIAL_PALETTE.gold }}>
            <div className="text-[10px] tracking-widest opacity-80">GLOBAL</div>
            <div className="text-lg font-black my-1">VIBEZ</div>
            <div className="text-[8px] tracking-[0.3em] opacity-80">DSG</div>
          </div>
          
          <div className="mt-2 flex gap-1 text-xs" style={{ color: IMPERIAL_PALETTE.gold }}>
            <span className="opacity-60">♠</span>
            <span className="opacity-60">♥</span>
            <span className="opacity-60">♦</span>
            <span className="opacity-60">♣</span>
          </div>
        </div>
        
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full border-2 opacity-30" style={{ borderColor: IMPERIAL_PALETTE.gold }} />
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full border-2 opacity-30" style={{ borderColor: IMPERIAL_PALETTE.gold }} />
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full border-2 opacity-30" style={{ borderColor: IMPERIAL_PALETTE.gold }} />
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full border-2 opacity-30" style={{ borderColor: IMPERIAL_PALETTE.gold }} />
      </motion.div>
    ); */

    /* DESIGN 3: CENTERED LOGO (Bold & Simple)
    return (
      <motion.div
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative w-20 h-32 rounded-lg overflow-hidden"
        style={{
          background: `radial-gradient(circle at center, ${IMPERIAL_PALETTE.mahogany} 0%, #1a0000 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
        }}
      >
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0iI2Q0YWYzNyIvPjwvc3ZnPg==')] bg-repeat" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center bg-black/40 backdrop-blur-sm px-3 py-4 rounded-lg border border-amber-500/30">
            <div className="font-['Cinzel'] font-black text-center" style={{ color: IMPERIAL_PALETTE.gold }}>
              <div className="text-2xl tracking-wider leading-tight">GLOBAL</div>
              <div className="text-3xl font-black tracking-wide my-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                VIBEZ
              </div>
              <div className="text-sm tracking-[0.4em]">DSG</div>
            </div>
          </div>
        </div>
      </motion.div>
    ); */

    // DESIGN 4: DIAMOND PATTERN (Geometric & Luxe) ✅ ACTIVE
    return (
      <motion.div
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative w-20 h-32 rounded-lg overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #000000 0%, ${IMPERIAL_PALETTE.burgundy} 50%, #000000 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
        }}
      >
        {/* Crosshatch Diamond Pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(212,175,55,0.05) 0px, rgba(212,175,55,0.05) 5px, transparent 5px, transparent 10px), repeating-linear-gradient(-45deg, rgba(212,175,55,0.05) 0px, rgba(212,175,55,0.05) 5px, transparent 5px, transparent 10px)'
        }} />
        
        {/* Rotated Border Accent */}
        <div className="absolute inset-4 border-2 rotate-45 opacity-20" style={{ borderColor: IMPERIAL_PALETTE.gold }} />
        
        {/* Center Logo */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-['Cinzel'] font-bold text-center transform -rotate-0" style={{ color: IMPERIAL_PALETTE.gold }}>
            <div className="text-lg tracking-[0.3em] opacity-70">VIBEZ</div>
            <div className="text-3xl my-1.5">♦</div>
            <div className="text-[8px] tracking-[0.4em] opacity-70">WHIST</div>
          </div>
        </div>
      </motion.div>
    );
  }

  const suit = IMPERIAL_SUITS[card.suit];
  const isJoker = card.suit === 'joker';

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { y: -20, scale: 1.08 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={selected ? { y: -10, boxShadow: `0 0 30px ${IMPERIAL_PALETTE.gold}80` } : {}}
      className={`relative w-20 h-32 rounded-lg overflow-hidden transition-all duration-300
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${isInKitty ? 'ring-2 ring-amber-500/50' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${IMPERIAL_PALETTE.ivory} 0%, ${IMPERIAL_PALETTE.cream} 100%)`,
        boxShadow: selected ? `0 0 20px ${IMPERIAL_PALETTE.gold}` : '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      <div className="absolute inset-0 p-2 flex flex-col justify-between">
        {/* Global Vibez DSG Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
          <div className="font-['Cinzel'] font-bold text-center leading-tight text-gray-800">
            <div className="text-[10px] tracking-wider">GLOBAL VIBEZ</div>
            <div className="text-[8px] tracking-widest">DSG</div>
          </div>
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="text-left">
            <div className="text-sm font-bold leading-tight" style={{ color: suit.color }}>
              {isJoker ? '' : card.rank}
            </div>
            <div className="text-xl leading-none" style={{ color: suit.color }}>
              {suit.symbol}
            </div>
          </div>
        </div>
        
        <div className="text-center relative z-10">
          <div className="text-4xl" style={{ color: suit.color }}>
            {suit.symbol}
          </div>
          {isJoker && <div className="text-xs font-bold text-amber-900">JOKER</div>}
        </div>
        
        <div className="flex justify-between items-end transform rotate-180 relative z-10">
          <div className="text-left">
            <div className="text-sm font-bold leading-tight" style={{ color: suit.color }}>
              {isJoker ? '' : card.rank}
            </div>
            <div className="text-xl leading-none" style={{ color: suit.color }}>
              {suit.symbol}
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
