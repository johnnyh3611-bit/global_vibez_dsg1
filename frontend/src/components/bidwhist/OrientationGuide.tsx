import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw } from 'lucide-react';

/**
 * OrientationGuide - Shows helpful message for mobile users in portrait mode
 * Suggests rotating device for better experience
 */
export default function OrientationGuide() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const mobile = window.innerWidth < 768; // md breakpoint
      
      setIsPortrait(portrait);
      setIsMobile(mobile);
    };

    // Check on mount
    checkOrientation();

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Only show on mobile in portrait mode
  const shouldShow = isMobile && isPortrait;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] px-4 py-3 bg-amber-600 rounded-xl border-2 border-amber-400 shadow-2xl max-w-sm"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <RotateCw className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1">
              <p className="text-white font-['Cinzel'] font-bold text-sm">
                Rotate for Better Experience
              </p>
              <p className="text-amber-100 text-xs">
                Landscape mode recommended
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
