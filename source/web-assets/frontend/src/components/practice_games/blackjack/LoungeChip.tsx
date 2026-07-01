import { motion } from 'framer-motion';
import { LOUNGE } from './loungeTheme';

interface LoungeChipProps {
  amount: number;
  selected?: boolean;
  onClick: () => void;
  size?: number;
}

interface ChipPalette {
  base: string;
  rim: string;
  spoke: string;
  face: string;
  label: string;
}

const CHIP_PALETTES: Record<number, ChipPalette> = {
  25: { base: '#1d5a2a', rim: '#0f3315', spoke: '#e8c671', face: '#fef3c7', label: '#1d5a2a' },
  50: { base: '#1e3a8a', rim: '#0f1f4a', spoke: '#e8c671', face: '#e0e7ff', label: '#1e3a8a' },
  100: { base: '#6b1a1a', rim: '#3a0d0d', spoke: '#f4d77a', face: '#fef2f2', label: '#6b1a1a' },
  500: { base: '#3b1361', rim: '#1e0a35', spoke: '#f4d77a', face: '#ede9fe', label: '#3b1361' },
};

export const LoungeChip = ({ amount, selected = false, onClick, size = 56 }: LoungeChipProps) => {
  const p = CHIP_PALETTES[amount] || CHIP_PALETTES[25];
  const cx = size / 2;
  const r = size / 2 - 2;
  const faceR = r * 0.55;
  const spokeCount = 8;

  return (
    <motion.button
      data-testid={`chip-${amount}`}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="relative flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
      style={{
        width: size,
        height: size,
        filter: selected
          ? `drop-shadow(0 0 14px ${LOUNGE.gold}) drop-shadow(0 6px 10px rgba(0,0,0,0.5))`
          : 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill={p.rim} />
        <circle cx={cx} cy={cx} r={r - 2} fill={p.base} />
        {Array.from({ length: spokeCount }).map((_, i) => {
          const a = (i / spokeCount) * Math.PI * 2;
          const x1 = cx + Math.cos(a) * (r - 2);
          const y1 = cx + Math.sin(a) * (r - 2);
          const x2 = cx + Math.cos(a) * (r - 10);
          const y2 = cx + Math.sin(a) * (r - 10);
          return (
            <line
              key={`spoke-${amount}-${i}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={p.spoke} strokeWidth="6" strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cx} r={faceR + 3} fill={p.rim} />
        <circle cx={cx} cy={cx} r={faceR} fill={p.face} />
        <text
          x={cx}
          y={cx + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.28}
          fontWeight="900"
          fontFamily={LOUNGE.fontBody}
          fill={p.label}
        >
          {amount >= 1000 ? `${amount / 1000}K` : amount}
        </text>
        {selected && (
          <circle
            cx={cx} cy={cx} r={r - 0.5}
            fill="none"
            stroke={LOUNGE.goldLight}
            strokeWidth="2"
            strokeDasharray="4 3"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${cx} ${cx}`}
              to={`360 ${cx} ${cx}`}
              dur="12s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
    </motion.button>
  );
};

export default LoungeChip;
