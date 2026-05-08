// Casino Design Tokens - Industry Standard (Bet365/PokerStars)
// Based on 2025 research and best practices

export const CASINO_THEME = {
  // Color Palette
  colors: {
    felt: {
      primary: '#228B22',
      dark: '#006400',
      light: '#32CD32',
      gradient: 'linear-gradient(145deg, #228B22 0%, #006400 50%, #228B22 100%)'
    },
    neon: {
      cyan: '#00F0FF',
      gold: '#D4AF37',
      pink: '#FF003C',
      purple: '#9D4EDD',
      green: '#00FF88'
    },
    materials: {
      wood: '#8B4513',
      woodDark: '#654321',
      leather: '#5C4033',
      metal: '#C0C0C0',
      gold: '#FFD700'
    },
    atmosphere: {
      background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)',
      glow1: 'rgba(0, 240, 255, 0.1)',
      glow2: 'rgba(212, 175, 55, 0.1)'
    }
  },

  // Glassmorphism & Effects
  glass: {
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    blur: 'blur(24px)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    insetShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)'
  },

  // Neon Glow Effects
  neon: {
    blur: 'blur(40px)',
    textShadow: {
      cyan: '0 0 20px #00F0FF, 0 0 40px #00CCFF',
      gold: '0 0 30px #FFD700, 0 0 60px #D4AF37',
      pink: '0 0 20px #FF003C, 0 0 40px #FF0055'
    },
    boxShadow: {
      cyan: '0 0 30px #00F0FF, 0 0 60px rgba(0, 240, 255, 0.5)',
      gold: '0 0 30px #D4AF37, 0 0 60px rgba(212, 175, 55, 0.5)',
      pink: '0 0 30px #FF003C, 0 0 60px rgba(255, 0, 60, 0.5)'
    }
  },

  // Animation Timing (Industry Standard)
  timing: {
    cardFlip: '0.8s',
    cardDeal: '0.2s',
    cardStagger: 0.1, // seconds between each card
    chipPlace: '0.3s',
    chipClink: '0.15s',
    wheelSpin: '6s',
    buttonPress: '0.2s',
    victory: '2.5s',
    transition: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    easeOut: 'cubic-bezier(0.22, 0.61, 0.36, 1)'
  },

  // Card Dimensions (Standard Poker Size: 2.5" × 3.5")
  card: {
    width: 80, // px
    height: 120, // px (5:7 ratio)
    aspectRatio: 0.6667,
    borderRadius: '8px',
    shadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    hoverScale: 1.05,
    activeScale: 0.95
  },

  // Chip Specifications
  chip: {
    diameter: 40, // px
    thickness: 4, // px
    stackOffset: 3, // px vertical offset for stacking
    values: {
      5: { primary: '#FF4500', secondary: '#FFF', label: '$5' },
      25: { primary: '#32CD32', secondary: '#FFF', label: '$25' },
      100: { primary: '#1E90FF', secondary: '#FFF', label: '$100' },
      500: { primary: '#9D4EDD', secondary: '#FFD700', label: '$500' },
      1000: { primary: '#FFD700', secondary: '#000', label: '$1K' }
    }
  },

  // Table Dimensions
  table: {
    padding: '24px',
    borderRadius: {
      baccarat: '50%', // Oval
      blackjack: '20px', // Rounded rectangle
      poker: '50%', // Oval
      roulette: '12px' // Rectangular
    },
    perspective: '1000px',
    felt: {
      padding: '40px',
      border: '40px solid #8B4513', // Wood rail
      shadow: 'inset 0 0 50px rgba(0,100,0,0.5), 0 20px 60px rgba(0,0,0,0.8)'
    }
  },

  // Player Zone Layout
  playerZone: {
    positions: {
      1: { angle: 270, label: 'You', color: '#00F0FF' }, // Bottom
      2: { angle: 0, label: 'Player 2', color: '#9D4EDD' }, // Right
      3: { angle: 90, label: 'Player 3', color: '#D4AF37' }, // Top
      4: { angle: 180, label: 'Player 4', color: '#FF003C' } // Left
    },
    radius: 300, // Distance from center
    width: 200,
    height: 150
  },

  // Typography
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, sans-serif',
      serif: 'ui-serif, Georgia, serif',
      mono: 'ui-monospace, monospace'
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    },
    fontWeight: {
      normal: 400,
      semibold: 600,
      bold: 700,
      black: 900
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.2em'
    }
  },

  // Z-Index Layers
  zIndex: {
    background: -1,
    table: 1,
    cards: 10,
    chips: 15,
    ui: 20,
    dealer: 25,
    modal: 50,
    overlay: 100
  }
};

// Helper Functions
export const getPlayerPosition = (playerIndex, totalPlayers, centerX = 500, centerY = 300, radius = 300) => {
  const angle = ((playerIndex / totalPlayers) * Math.PI * 2) - (Math.PI / 2); // Start from bottom
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    angle: angle * (180 / Math.PI)
  };
};

export const getChipColor = (value) => {
  if (value >= 1000) return CASINO_THEME.chip.values[1000];
  if (value >= 500) return CASINO_THEME.chip.values[500];
  if (value >= 100) return CASINO_THEME.chip.values[100];
  if (value >= 25) return CASINO_THEME.chip.values[25];
  return CASINO_THEME.chip.values[5];
};

export const formatCurrency = (amount) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount}`;
};

export default CASINO_THEME;
