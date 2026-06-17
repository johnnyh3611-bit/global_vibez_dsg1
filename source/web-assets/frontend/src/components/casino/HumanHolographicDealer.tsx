import { motion } from 'framer-motion';
import useHolographicDealer from '@/hooks/useHolographicDealer';
import { getDealerConfig, SIZE_CLASSES } from './dealer/dealerConfigs';
import DealerGradientDefs from './dealer/DealerGradientDefs';
import DealerBody from './dealer/DealerBody';
import DealerHead from './dealer/DealerHead';
import DealerStatusIndicator from './dealer/DealerStatusIndicator';
import DealerSpeechBubble from './dealer/DealerSpeechBubble';
import DealingCardsLayer from './dealer/DealingCardsLayer';

/**
 * Professional Human-Looking Holographic AI Dealer.
 * Types: "nova" (African male), "ace" (Asian male),
 *        "ruby" (Latina female), "jade" (Mixed female).
 */
interface HumanHolographicDealerProps {
  dealerType?: string;
  phrase?: string;
  mood?: string;
  isAnimating?: boolean;
  isDealing?: boolean;
  isShuffling?: boolean;
  isCelebrating?: boolean;
  onTipDealer?: (() => void) | null;
  size?: string;
  gameType?: string;
  gameState?: Record<string, unknown>;
  className?: string;
}

export default function HumanHolographicDealer({
  dealerType = 'nova',
  phrase = 'Welcome to the table',
  // eslint-disable-next-line no-unused-vars -- kept for API compatibility
  mood = 'professional',
  // eslint-disable-next-line no-unused-vars -- kept for API compatibility
  isAnimating = false,
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  // eslint-disable-next-line no-unused-vars -- kept for API compatibility
  onTipDealer = null,
  size = 'normal',
}: HumanHolographicDealerProps) {
  const config = getDealerConfig(dealerType);
  const { dealingCards } = useHolographicDealer({ isDealing });

  return (
    <div className={`relative ${SIZE_CLASSES[size]} mx-auto`} data-testid={`holo-dealer-${dealerType}`}>
      <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d', transform: 'rotateY(0deg)' }}
          animate={{
            transform: isShuffling
              ? ['rotateY(0deg)', 'rotateY(5deg)', 'rotateY(-5deg)', 'rotateY(0deg)']
              : 'rotateY(0deg)',
            y: [0, -5, 0],
          }}
          transition={{
            transform: { duration: 2, repeat: isShuffling ? Infinity : 0 },
            y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-transparent to-transparent blur-2xl" />

          <svg
            className="w-full h-full relative z-10"
            viewBox="0 0 300 400"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.6))' }}
          >
            <DealerGradientDefs dealerType={dealerType} config={config} />
            <DealerBody dealerType={dealerType} isDealing={isDealing} />
            <DealerHead dealerType={dealerType} config={config} isCelebrating={isCelebrating} />

            {/* Holographic scanlines overlay */}
            <rect x="0" y="0" width="300" height="400" fill="url(#scanlines)" opacity="0.3">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="0 4"
                dur="0.1s"
                repeatCount="indefinite"
              />
            </rect>

            {/* Holographic shimmer overlay */}
            <rect x="0" y="0" width="300" height="400" fill="url(#holoGradient)" opacity="0.2">
              <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
            </rect>

            {/* Name tag */}
            <g transform="translate(125, 220)">
              <rect
                width="50" height="18" rx="4"
                fill="rgba(255, 215, 0, 0.9)"
                stroke="rgba(6, 182, 212, 0.5)" strokeWidth="1"
              />
              <text x="25" y="13" fontSize="10" textAnchor="middle" fill="#000" fontWeight="bold" opacity="0.9">
                {config.name}
              </text>
            </g>
          </svg>

          <DealingCardsLayer dealingCards={dealingCards} />
        </motion.div>

        <DealerStatusIndicator
          isCelebrating={isCelebrating}
          isDealing={isDealing}
          isShuffling={isShuffling}
        />

        <DealerSpeechBubble phrase={phrase} />
      </div>
    </div>
  );
}
