import { formatCurrency } from './utils';
import { LOUNGE } from './loungeTheme';

interface HudCardProps {
  label: string;
  value: string;
  testid: string;
  accent: string;
}

const HudCard = ({ label, value, testid, accent }: HudCardProps) => (
  <div
    className="px-5 py-3 rounded-xl text-center min-w-[120px] backdrop-blur-md"
    style={{
      background: 'linear-gradient(135deg, rgba(26, 15, 8, 0.82) 0%, rgba(10, 5, 4, 0.78) 100%)',
      border: `1px solid ${accent}40`,
      boxShadow: `${LOUNGE.shadow.soft}, inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}
  >
    <div
      className="text-[9px] uppercase tracking-[0.3em] font-bold"
      style={{ color: accent, fontFamily: LOUNGE.fontBody }}
    >
      {label}
    </div>
    <div
      className="text-xl font-black tabular-nums mt-1"
      style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontDisplay }}
      data-testid={testid}
    >
      {value}
    </div>
  </div>
);

interface HUDPanelProps {
  credits: number;
  currentBet: number;
}

export const HUDPanel = ({ credits, currentBet }: HUDPanelProps) => (
  <div
    className="absolute top-6 left-28 sm:left-32 flex gap-3 z-30"
    data-testid="blackjack-hud"
  >
    <HudCard
      label="Balance"
      value={formatCurrency(credits)}
      testid="balance-display"
      accent={LOUNGE.goldLight}
    />
    <HudCard
      label="Bet"
      value={formatCurrency(currentBet)}
      testid="bet-display"
      accent="#c97a5a"
    />
  </div>
);

export default HUDPanel;
