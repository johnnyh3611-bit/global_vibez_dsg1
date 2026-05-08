import ImperialCard from './ImperialCard';

export default function PlayerHand({ hand, 
  selectedCards, 
  onCardClick, 
  disabled = false }: { hand?: any, selectedCards?: any, onCardClick?: any, disabled?: any }) {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {hand.map((card, i) => (
        <ImperialCard
          key={`card-${i}`}
          card={card}
          onClick={() => onCardClick(card)}
          selected={selectedCards.includes(card)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
