import Card from './Card';
import { parseCard } from './utils';
import { LOUNGE } from './loungeTheme';

interface DealerSectionProps {
  dealerHand?: string[];
}

export const DealerSection = ({ dealerHand = [] }: DealerSectionProps) => (
  <div className="flex flex-col items-center gap-3" data-testid="dealer-section">
    <div
      className="px-6 py-2 rounded-full mb-1 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.14) 0%, rgba(140, 109, 24, 0.18) 100%)',
        border: `1px solid ${LOUNGE.gold}`,
        boxShadow: `inset 0 0 12px rgba(212, 175, 55, 0.15), ${LOUNGE.shadow.soft}`,
      }}
    >
      <span
        className="text-xs sm:text-sm font-black uppercase tracking-[0.3em]"
        style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontBody }}
      >
        Dealer Nova
      </span>
    </div>

    <div
      className="uppercase tracking-[0.3em] text-[10px] font-bold"
      style={{ color: '#c8a875', fontFamily: LOUNGE.fontBody }}
    >
      Dealer Hand
    </div>

    <div className="flex gap-2 sm:gap-4">
      {dealerHand.map((card, index) => {
        const parsed = parseCard(card);
        return (
          <Card
            key={`dealer-${index}-${card}`}
            suit={parsed?.suit || 'Spades'}
            value={parsed?.val || '?'}
            isFlipped={card === 'BACK'}
          />
        );
      })}
    </div>
  </div>
);

export default DealerSection;
