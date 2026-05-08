import React from 'react';
import { motion } from 'framer-motion';

const CHIP_COLORS = {
  5: { bg: '#E63946', border: '#C5303E', value: 5, label: '$5' },
  25: { bg: '#457B9D', border: '#3A6882', value: 25, label: '$25' },
  100: { bg: '#1D3557', border: '#162841', value: 100, label: '$100' },
  500: { bg: '#D4AF37', border: '#B8982F', value: 500, label: '$500' },
  1000: { bg: '#8B5CF6', border: '#7C3AED', value: 1000, label: '$1K' }
};

interface CasinoChipProps {
  value?: number;
  count?: number;
  className?: string;
  onClick?: () => void;
  [k: string]: any;
}

export default function CasinoChip({
  value = 25,
  count = 1,
  className = '',
  onClick,
  ...props
}: CasinoChipProps) {
  const chipConfig = CHIP_COLORS[value] || CHIP_COLORS[25];
  
  // Create array for stacked chips
  const chips = Array.from({ length: Math.min(count, 5) }, (_, i) => i);
  
  return (
    <div className={`relative inline-block w-12 h-12 md:w-16 md:h-16 ${className}`} onClick={onClick} {...props}>
      {chips.map((index) => (
        <motion.div
          key={`chip-${index}`}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: -index * 4, opacity: 1 }}
          transition={{ 
            delay: index * 0.05,
            type: 'spring',
            stiffness: 300,
            damping: 20
          }}
          className="absolute"
          style={{
            left: index * 2,
            zIndex: chips.length - index
          }}
        >
          {/* Chip shadow */}
          <div 
            className="absolute inset-0 rounded-full blur-sm opacity-50"
            style={{ 
              backgroundColor: chipConfig.bg,
              transform: 'translateY(8px) scale(0.95)'
            }}
          />
          
          {/* Main chip */}
          <div
            className="relative w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center
              shadow-lg border-4 cursor-pointer transition-transform hover:scale-110"
            style={{
              backgroundColor: chipConfig.bg,
              borderColor: chipConfig.border,
              borderStyle: 'dashed'
            }}
            data-testid={`chip-${value}`}
          >
            {/* Inner ring */}
            <div 
              className="absolute inset-2 rounded-full border-2 opacity-30"
              style={{ borderColor: 'white', borderStyle: 'dotted' }}
            />
            
            {/* Value */}
            <span className="relative z-10 text-white font-bold text-xs md:text-sm tracking-wider drop-shadow-lg">
              {chipConfig.label}
            </span>
            
            {/* Highlight */}
            <div className="absolute top-1 left-1 w-3 h-3 md:w-4 md:h-4 bg-white/40 rounded-full blur-sm" />
          </div>
        </motion.div>
      ))}
      
      {/* Stack count indicator if > 5 */}
      {count > 5 && (
        <div className="absolute -top-2 -right-2 bg-[#D4AF37] text-black text-xs font-bold 
          rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-50">
          {count}
        </div>
      )}
    </div>
  );
}
