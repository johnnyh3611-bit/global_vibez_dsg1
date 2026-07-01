// Enhanced Animation Variants for Game Components
export const gameAnimations = {
  // Card/Tile animations
  card: {
    initial: { opacity: 0, scale: 0.8, rotateY: -90 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      rotateY: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    hover: { 
      scale: 1.05, 
      y: -8,
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.95 },
    exit: { opacity: 0, scale: 0.8, rotateY: 90 }
  },

  // Game piece animations
  piece: {
    initial: { scale: 0, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 200, damping: 15 }
    },
    hover: { 
      scale: 1.2, 
      zIndex: 10,
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.9 },
    move: {
      x: 0,
      y: 0,
      transition: { type: 'spring', stiffness: 150, damping: 20 }
    }
  },

  // Dice roll animation
  dice: {
    initial: { scale: 1, rotate: 0 },
    rolling: {
      rotate: [0, 360, 720, 1080],
      scale: [1, 1.2, 1, 1.2, 1],
      transition: { duration: 0.8, ease: 'easeInOut' }
    },
    result: {
      scale: [1, 1.3, 1],
      transition: { duration: 0.3 }
    }
  },

  // Board square animations
  square: {
    initial: { opacity: 0.7 },
    hover: { 
      opacity: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      transition: { duration: 0.15 }
    },
    selected: {
      backgroundColor: 'rgba(255, 215, 0, 0.3)',
      scale: 1.05,
      boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)'
    },
    valid: {
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      boxShadow: '0 0 15px rgba(0, 255, 0, 0.4)',
      scale: [1, 1.05, 1],
      transition: { repeat: Infinity, duration: 1 }
    }
  },

  // Turn indicator
  turnIndicator: {
    myTurn: {
      scale: [1, 1.1, 1],
      boxShadow: [
        '0 0 20px rgba(34, 197, 94, 0.5)',
        '0 0 30px rgba(34, 197, 94, 0.8)',
        '0 0 20px rgba(34, 197, 94, 0.5)'
      ],
      transition: { repeat: Infinity, duration: 1.5 }
    },
    waiting: {
      opacity: 0.6
    }
  },

  // Win/Lose screen
  gameOver: {
    initial: { scale: 0, opacity: 0, rotate: -180 },
    animate: { 
      scale: 1, 
      opacity: 1, 
      rotate: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  },

  // Score counter
  scoreUpdate: {
    increase: {
      scale: [1, 1.5, 1],
      color: ['#ffffff', '#10b981', '#ffffff'],
      transition: { duration: 0.5 }
    },
    decrease: {
      scale: [1, 0.8, 1],
      color: ['#ffffff', '#ef4444', '#ffffff'],
      transition: { duration: 0.5 }
    }
  },

  // Notification badge
  notification: {
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: [0, 1.2, 1],
      opacity: 1,
      transition: { duration: 0.3 }
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: { repeat: Infinity, duration: 2 }
    }
  },

  // Modal/Dialog
  modal: {
    overlay: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    },
    content: {
      initial: { scale: 0.9, opacity: 0, y: 50 },
      animate: { 
        scale: 1, 
        opacity: 1, 
        y: 0,
        transition: { type: 'spring', damping: 25, stiffness: 300 }
      },
      exit: { scale: 0.9, opacity: 0, y: 50 }
    }
  },

  // Page transitions
  page: {
    initial: { opacity: 0, x: -20 },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3 }
    },
    exit: { opacity: 0, x: 20 }
  },

  // Stagger children
  stagger: {
    container: {
      animate: {
        transition: {
          staggerChildren: 0.1
        }
      }
    },
    item: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 }
    }
  }
};

// Utility function to create move animations
export const createMoveAnimation = (from, to) => {
  return {
    x: [from.x, to.x],
    y: [from.y, to.y],
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20
    }
  };
};

// Utility function for path animations (for piece movement along a path)
export const createPathAnimation = (points, duration = 1) => {
  const keyframes = points.map(point => ({ x: point.x, y: point.y }));
  
  return {
    ...keyframes,
    transition: {
      duration,
      ease: 'easeInOut'
    }
  };
};
