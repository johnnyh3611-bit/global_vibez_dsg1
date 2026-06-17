import { parseCard } from './utils';
import { LOUNGE } from './loungeTheme';

const canSplit = (hand: string[]): boolean => {
  if (!hand || hand.length !== 2) return false;
  const a = parseCard(hand[0]);
  const b = parseCard(hand[1]);
  return !!(a?.val && b?.val && a.val === b.val);
};

type BtnStyle = React.CSSProperties;

const baseButtonStyle: BtnStyle = {
  fontFamily: LOUNGE.fontBody,
  fontSize: '12px',
  letterSpacing: '0.25em',
  padding: '12px 28px',
  borderRadius: '9999px',
  fontWeight: 900,
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 150ms',
  border: 'none',
  boxShadow: LOUNGE.shadow.soft,
};

const hitStyle: BtnStyle = {
  ...baseButtonStyle,
  background: LOUNGE.goldGradient,
  color: '#1a0f08',
  boxShadow: `${LOUNGE.shadow.glow}, ${LOUNGE.shadow.soft}`,
};

const standStyle: BtnStyle = {
  ...baseButtonStyle,
  background: LOUNGE.bg.burgundy,
  color: '#f5e6d3',
  border: `1px solid ${LOUNGE.goldDark}`,
};

const doubleStyle: BtnStyle = {
  ...baseButtonStyle,
  background: LOUNGE.bg.amber,
  color: '#fef3c7',
  border: `1px solid ${LOUNGE.goldLight}`,
};

const splitStyle: BtnStyle = {
  ...baseButtonStyle,
  background: LOUNGE.bg.charcoal,
  color: LOUNGE.goldLight,
  border: `1px solid ${LOUNGE.goldDark}`,
};

interface ActionButtonsProps {
  playerHands: string[][];
  currentHandIndex: number;
  credits: number;
  betAmounts: number[];
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}

export const ActionButtons = ({
  playerHands,
  currentHandIndex,
  credits,
  betAmounts,
  onHit,
  onStand,
  onDouble,
  onSplit,
}: ActionButtonsProps) => {
  const hand = playerHands[currentHandIndex] || [];
  const canDouble = hand.length === 2 && credits >= (betAmounts[currentHandIndex] || 0);
  const canSplitHand = canSplit(hand) && credits >= (betAmounts[currentHandIndex] || 0);

  return (
    <div className="flex gap-3 flex-wrap justify-center" data-testid="action-buttons">
      <button data-testid="hit-btn" onClick={onHit} style={hitStyle}>Hit</button>
      <button data-testid="stand-btn" onClick={onStand} style={standStyle}>Stand</button>
      {canDouble && (
        <button data-testid="double-btn" onClick={onDouble} style={doubleStyle}>Double</button>
      )}
      {canSplitHand && (
        <button data-testid="split-btn" onClick={onSplit} style={splitStyle}>Split</button>
      )}
    </div>
  );
};

export default ActionButtons;
