import { motion } from 'framer-motion';
import DealerHair from './DealerHair';

interface DealerConfig {
  skinTone: string[];
  hairColor: string[];
  eyeColor: string;
}

interface DealerHeadProps {
  dealerType: string;
  config: DealerConfig;
  isCelebrating?: boolean;
}

export const DealerHead = ({ dealerType, config, isCelebrating }: DealerHeadProps) => (
  <g className="dealer-head">
    <ellipse
      cx="150" cy="130" rx="45" ry="55"
      fill={`url(#skinTone-${dealerType})`}
      stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1"
    />

    <DealerHair dealerType={dealerType} config={config} />

    <ellipse cx="103" cy="130" rx="8" ry="12" fill={`url(#skinTone-${dealerType})`} opacity="0.9" />
    <ellipse cx="197" cy="130" rx="8" ry="12" fill={`url(#skinTone-${dealerType})`} opacity="0.9" />

    <g className="left-eye">
      <ellipse cx="130" cy="125" rx="10" ry="12" fill="white" opacity="0.95" />
      <circle cx="130" cy="125" r="6" fill={config.eyeColor} />
      <circle cx="130" cy="125" r="3" fill="#1a1a1a" />
      <circle cx="132" cy="123" r="2" fill="white" opacity="0.8" />
      <circle cx="132" cy="123" r="1" fill="#06b6d4" opacity="0.6" />
    </g>

    <g className="right-eye">
      <ellipse cx="170" cy="125" rx="10" ry="12" fill="white" opacity="0.95" />
      <circle cx="170" cy="125" r="6" fill={config.eyeColor} />
      <circle cx="170" cy="125" r="3" fill="#1a1a1a" />
      <circle cx="172" cy="123" r="2" fill="white" opacity="0.8" />
      <circle cx="172" cy="123" r="1" fill="#06b6d4" opacity="0.6" />
    </g>

    <path
      d="M 120 115 Q 130 112 140 115"
      stroke={config.hairColor[0]} strokeWidth="2.5" fill="none"
      strokeLinecap="round" opacity="0.8"
    />
    <path
      d="M 160 115 Q 170 112 180 115"
      stroke={config.hairColor[0]} strokeWidth="2.5" fill="none"
      strokeLinecap="round" opacity="0.8"
    />

    <path d="M 145 130 L 148 148 L 152 148 L 150 135 Z" fill={`url(#skinTone-${dealerType})`} opacity="0.7" />
    <ellipse cx="145" cy="150" rx="2" ry="3" fill={config.skinTone[2]} opacity="0.6" />
    <ellipse cx="155" cy="150" rx="2" ry="3" fill={config.skinTone[2]} opacity="0.6" />

    <motion.path
      d="M 130 160 Q 150 168 170 160"
      stroke="#8b4513" strokeWidth="2.5" strokeLinecap="round"
      fill="none" opacity="0.8"
      animate={isCelebrating ? { d: 'M 125 160 Q 150 175 175 160' } : {}}
    />
  </g>
);

DealerHead.displayName = 'DealerHead';

export default DealerHead;
