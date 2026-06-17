import { LOUNGE } from './loungeTheme';

type BlackjackResult = 'player' | 'dealer' | 'push' | null;

const resultLabel = (result: BlackjackResult): string => {
  if (result === 'player') return 'YOU WIN';
  if (result === 'dealer') return 'DEALER WINS';
  return 'PUSH';
};

interface Palette {
  bg: string;
  border: string;
  color: string;
  glow: string;
}

const resultPalette = (result: BlackjackResult): Palette => {
  if (result === 'player') {
    return {
      bg: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(140, 109, 24, 0.35) 100%)',
      border: LOUNGE.gold,
      color: LOUNGE.goldLight,
      glow: LOUNGE.shadow.glow,
    };
  }
  if (result === 'dealer') {
    return {
      bg: 'linear-gradient(135deg, rgba(107, 26, 26, 0.35) 0%, rgba(58, 13, 13, 0.5) 100%)',
      border: '#a1634a',
      color: '#e8c1a6',
      glow: '0 0 25px rgba(107, 26, 26, 0.45)',
    };
  }
  return {
    bg: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(140, 109, 24, 0.1) 100%)',
    border: '#8c6d18',
    color: '#e6dfc7',
    glow: '0 0 15px rgba(140, 109, 24, 0.2)',
  };
};

interface ResultPanelProps {
  result?: BlackjackResult;
  playerScore: number;
  dealerScore: number;
  onNewRound: () => void;
}

export const ResultPanel = ({
  result = null,
  playerScore,
  dealerScore,
  onNewRound,
}: ResultPanelProps) => {
  const p = resultPalette(result);
  return (
    <div className="flex flex-col items-center gap-4" data-testid="result-panel">
      <div
        className="px-10 py-5 rounded-2xl backdrop-blur-md text-center"
        style={{
          background: p.bg,
          border: `1.5px solid ${p.border}`,
          boxShadow: `${p.glow}, ${LOUNGE.shadow.soft}`,
        }}
      >
        <div
          className="text-3xl font-black tracking-[0.08em]"
          style={{ color: p.color, fontFamily: LOUNGE.fontDisplay }}
        >
          {resultLabel(result)}
        </div>
        <div
          className="text-xs mt-2 opacity-80 tracking-widest"
          style={{ color: p.color, fontFamily: LOUNGE.fontBody }}
        >
          Player: {playerScore} &middot; Dealer: {dealerScore}
        </div>
      </div>

      <button
        data-testid="new-round-btn"
        onClick={onNewRound}
        className="px-10 py-2.5 rounded-full uppercase tracking-[0.25em] text-xs font-black transition-all active:scale-95 hover:brightness-110"
        style={{
          background: LOUNGE.goldGradient,
          color: '#1a0f08',
          border: 'none',
          fontFamily: LOUNGE.fontBody,
          boxShadow: `${LOUNGE.shadow.glow}, ${LOUNGE.shadow.soft}`,
        }}
      >
        New Round
      </button>
    </div>
  );
};

export default ResultPanel;
