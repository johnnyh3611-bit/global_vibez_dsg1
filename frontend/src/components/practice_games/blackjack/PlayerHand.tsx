import Card from './Card';
import { parseCard } from './utils';

interface PlayerHandProps {
  hand?: string[];
}

export const PlayerHand = ({ hand = [] }: PlayerHandProps) => (
  <div className="flex gap-3 sm:gap-6 scale-100 sm:scale-110" data-testid="player-hand">
    {hand.map((card, i) => {
      const parsed = parseCard(card);
      if (!parsed) return null;
      return (
        <Card
          key={`player-${i}-${card}`}
          suit={parsed.suit}
          value={parsed.val}
          isFlipped={false}
        />
      );
    })}
  </div>
);

export default PlayerHand;
