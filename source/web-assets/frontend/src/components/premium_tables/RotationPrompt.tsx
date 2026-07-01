import React from 'react';
import { motion } from 'framer-motion';

/**
 * Rotation Prompt Component
 * Shows when user is in portrait mode, suggests rotating to landscape
 */
export function RotationPrompt({ show = true, gameName = "this game" }: { show?: any, gameName?: any }) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-8"
    >
      <div className="text-center max-w-sm">
        {/* Animated Phone Icon */}
        <motion.div
          animate={{ 
            rotateZ: [0, -90, -90, 0],
            scale: [1, 1.1, 1.1, 1],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          className="text-9xl mb-6"
        >
          📱
        </motion.div>
        
        <h2 className="text-3xl font-black text-white mb-4">
          Rotate Your Device
        </h2>
        
        <p className="text-white/60 text-lg mb-2">
          For the best {gameName} experience
        </p>
        
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mt-6"
        >
          <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-3 px-6 rounded-full inline-block">
            Turn to Landscape 🔄
          </div>
        </motion.div>
        
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="text-6xl opacity-30">📱</div>
          <div className="text-white text-2xl">→</div>
          <div className="text-6xl">🔄</div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Portrait Mode Blocker
 * Prevents gameplay in portrait, forces landscape
 */
export function PortraitBlocker({ gameName, allowPortrait = false, children }: { gameName?: any, allowPortrait?: any, children?: any }) {
  const [isPortrait, setIsPortrait] = React.useState(false);

  React.useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // If portrait mode is allowed or device is in landscape, show game
  if (allowPortrait || !isPortrait) {
    return children;
  }

  // Otherwise show rotation prompt
  return <RotationPrompt show={isPortrait} gameName={gameName} />;
}
