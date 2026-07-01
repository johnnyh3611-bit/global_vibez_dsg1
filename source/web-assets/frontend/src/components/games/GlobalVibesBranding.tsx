import { motion } from 'framer-motion';
import { Heart, Sparkles } from 'lucide-react';

/**
 * Global Vibez DSG™ Branding Component
 * Adds trademark branding to all games
 */
export const GlobalVibesLogo = ({ size = 'md', variant = 'full' }) => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl'
  };

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2">
        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
        <span className="font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          GVDSG
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <Heart className="w-8 h-8 text-pink-400 fill-pink-400" />
      </motion.div>
      <div className="flex flex-col">
        <span className={`${sizes[size]} font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent leading-none`}>
          Global Vibez DSG
        </span>
        <span className="text-xs text-white/40 tracking-wider">™ GAMES</span>
      </div>
    </div>
  );
};

/**
 * Watermark for game boards
 */
export const GameWatermark = ({ position = 'bottom-right' }) => {
  const positions = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
  };

  return (
    <div className={`fixed ${positions[position]} z-10 pointer-events-none opacity-30 hover:opacity-70 transition-opacity`}>
      <GlobalVibesLogo size="sm" variant="minimal" />
    </div>
  );
};

/**
 * Copyright footer for games
 */
export const CopyrightFooter = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-4 text-white/40 text-xs"
    >
      <p className="flex items-center justify-center gap-2">
        <Heart className="w-3 h-3 fill-pink-400 text-pink-400" />
        <span>© {new Date().getFullYear()} <strong className="text-white/60">Global Vibez DSG™</strong></span>
        <span className="mx-2">•</span>
        <span>All Games & Content Exclusively Owned by Global Vibez DSG</span>
      </p>
      <p className="mt-1 text-white/30">Powered by H&S Solutions Group LLC</p>
    </motion.div>
  );
};

/**
 * Branded card back design
 */
export const GlobalVibesCardBack = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 ${className}`}>
      {/* Animated Background Pattern */}
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '20px 20px']
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Central Logo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Heart className="w-12 h-12 text-white/80 fill-white/80 mb-2" />
        <span className="text-white font-black text-lg tracking-wider">GLOBAL VIBEZ</span>
        <span className="text-white font-black text-lg tracking-wider">DSG</span>
        <Sparkles className="w-4 h-4 text-yellow-300 mt-1" />
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-2 left-2 text-white/40 text-xs">™</div>
      <div className="absolute top-2 right-2 text-white/40 text-xs">™</div>
      <div className="absolute bottom-2 left-2 text-white/40 text-xs">GV</div>
      <div className="absolute bottom-2 right-2 text-white/40 text-xs">GV</div>
    </div>
  );
};

export default GlobalVibesLogo;
