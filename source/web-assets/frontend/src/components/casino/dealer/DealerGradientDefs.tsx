interface DealerConfig {
  skinTone: string[];
  hairColor: string[];
  hairStyle: string;
  eyeColor: string;
  name: string;
}

interface DealerGradientDefsProps {
  dealerType: string;
  config: DealerConfig;
}

/**
 * SVG <defs> block with all gradients used by the holographic dealer.
 * Kept in its own component so the orchestrator stays readable.
 */
export const DealerGradientDefs = ({ dealerType, config }: DealerGradientDefsProps) => (
  <defs>
    <radialGradient id={`skinTone-${dealerType}`} cx="50%" cy="40%">
      <stop offset="0%" stopColor={config.skinTone[0]} stopOpacity="0.9" />
      <stop offset="50%" stopColor={config.skinTone[1]} stopOpacity="0.9" />
      <stop offset="100%" stopColor={config.skinTone[2]} stopOpacity="0.8" />
    </radialGradient>

    <linearGradient id={`hairColor-${dealerType}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={config.hairColor[0]} />
      <stop offset="100%" stopColor={config.hairColor[1]} />
    </linearGradient>

    <radialGradient id="shirtWhite" cx="50%" cy="20%">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
      <stop offset="100%" stopColor="#f0f0f0" stopOpacity="0.9" />
    </radialGradient>

    <linearGradient id="vestBlack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#1a1a1a" stopOpacity="0.95" />
      <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0.9" />
    </linearGradient>

    <linearGradient id="holoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
      <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.2" />
      <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
    </linearGradient>

    <pattern id="scanlines" x="0" y="0" width="100%" height="4" patternUnits="userSpaceOnUse">
      <rect width="100%" height="2" fill="rgba(6, 182, 212, 0.1)" />
      <rect y="2" width="100%" height="2" fill="transparent" />
    </pattern>
  </defs>
);

export default DealerGradientDefs;
