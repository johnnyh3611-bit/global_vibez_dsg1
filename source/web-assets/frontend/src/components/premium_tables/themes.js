// Premium Table Themes

export const PREMIUM_THEMES = {
  neon: {
    name: 'Neon Cyberpunk 2026',
    feltGradient: 'linear-gradient(135deg, #000000 0%, #1a0033 50%, #000000 100%)',
    border: '#d946ef',
    accentPrimary: '#d946ef',
    accentSecondary: '#a855f7',
    textPrimary: '#FFFFFF',
    textSecondary: '#c084fc',
    chipColors: ['#d946ef', '#a855f7', '#ec4899', '#8b5cf6'],
    glow: 'rgba(217, 70, 239, 0.6)',
    icon: '⚡',
  },
  
  emerald: {
    name: 'Emerald Classic',
    feltGradient: 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #065F46 100%)',
    border: '#78350f',
    accentPrimary: '#D4AF37',
    accentSecondary: '#22D3EE',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    chipColors: ['#D4AF37', '#E5E7EB', '#EF4444', '#3B82F6'],
    glow: 'rgba(212, 175, 55, 0.4)',
    icon: '🌿',
  },
  
  midnight: {
    name: 'Midnight Noir',
    feltGradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
    border: '#1F2937',
    accentPrimary: '#818CF8',
    accentSecondary: '#C084FC',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    chipColors: ['#818CF8', '#F1F5F9', '#F87171', '#34D399'],
    glow: 'rgba(129, 140, 248, 0.4)',
    icon: '🌙',
  },
  
  royal: {
    name: 'Royal Purple',
    feltGradient: 'linear-gradient(135deg, #4C1D95 0%, #6B21A8 50%, #581C87 100%)',
    border: '#92400E',
    accentPrimary: '#FCD34D',
    accentSecondary: '#F472B6',
    textPrimary: '#FEF3C7',
    textSecondary: '#DDD6FE',
    chipColors: ['#FCD34D', '#FBBF24', '#DC2626', '#2563EB'],
    glow: 'rgba(252, 211, 77, 0.5)',
    icon: '👑',
  },
  
  rose: {
    name: 'Rose Gold',
    feltGradient: 'linear-gradient(135deg, #881337 0%, #9F1239 50%, #881337 100%)',
    border: '#713F12',
    accentPrimary: '#F9A8D4',
    accentSecondary: '#FBBF24',
    textPrimary: '#FFF7ED',
    textSecondary: '#FECDD3',
    chipColors: ['#F9A8D4', '#FCD34D', '#DC2626', '#3B82F6'],
    glow: 'rgba(249, 168, 212, 0.5)',
    icon: '🌹',
  },
};

export function getTheme(themeName = 'neon') {
  return PREMIUM_THEMES[themeName] || PREMIUM_THEMES.neon;
}
