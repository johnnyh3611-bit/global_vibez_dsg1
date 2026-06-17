/**
 * Cozy Lounge Blackjack — design tokens for the skinned room.
 */

export interface LoungeTheme {
  roomBg: string;
  woodGrain: string;
  feltBg: string;
  spotlightBg: string;
  gold: string;
  goldLight: string;
  goldDark: string;
  goldGradient: string;
  goldBorder: string;
  leatherRail: string;
  bg: {
    burgundy: string;
    amber: string;
    charcoal: string;
    cream: string;
  };
  shadow: {
    soft: string;
    deep: string;
    glow: string;
  };
  fontDisplay: string;
  fontBody: string;
}

export const LOUNGE: LoungeTheme = {
  roomBg:
    'radial-gradient(ellipse 80% 60% at 50% -10%, #3a2817 0%, #1a0f08 60%, #0a0504 100%)',
  woodGrain:
    // eslint-disable-next-line quotes
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.8' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0.15  0 0 0 0 0.09  0 0 0 0 0.05  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>\")",
  feltBg:
    'radial-gradient(ellipse at 50% 20%, #1a1a1a 0%, #0a0a0a 60%, #000000 100%)',
  spotlightBg:
    'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255, 193, 94, 0.18) 0%, transparent 70%)',
  gold: '#d4af37',
  goldLight: '#f4d77a',
  goldDark: '#8c6d18',
  goldGradient: 'linear-gradient(135deg, #f4d77a 0%, #d4af37 50%, #8c6d18 100%)',
  goldBorder: '2px solid #d4af37',
  leatherRail:
    'linear-gradient(135deg, #2a1810 0%, #1a0f08 50%, #2a1810 100%)',
  bg: {
    burgundy: 'linear-gradient(135deg, #6b1a1a 0%, #4a1010 100%)',
    amber: 'linear-gradient(135deg, #b17a2b 0%, #7a5014 100%)',
    charcoal: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    cream: 'linear-gradient(135deg, #d4af37 0%, #a8841f 100%)',
  },
  shadow: {
    soft: '0 4px 20px rgba(0, 0, 0, 0.6)',
    deep: '0 12px 40px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 193, 94, 0.08)',
    glow: '0 0 30px rgba(212, 175, 55, 0.35)',
  },
  fontDisplay: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  fontBody: '"Inter", -apple-system, system-ui, sans-serif',
};

export default LOUNGE;
