
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    filter: 'blur(10px)'
  }
};

const pageTransition: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1] as any // circOut easing cubic-bezier
};

export const PageTransition = ({ children }: { children?: React.ReactNode }) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
