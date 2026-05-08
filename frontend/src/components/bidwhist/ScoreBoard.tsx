const IMPERIAL_PALETTE = {
  gold: '#d4af37',
  mahogany: '#420d09'
};

export default function ScoreBoard({ scores, booksThisHand, currentBid }: { scores?: any, booksThisHand?: any, currentBid?: any }) {
  return (
    <div className="bg-gradient-to-br from-slate-900/90 to-black/90 backdrop-blur-xl
      rounded-lg p-2 border shadow-lg"
      style={{ borderColor: IMPERIAL_PALETTE.gold + '40' }}
    >
      <h3 className="text-[10px] font-['Cinzel'] text-amber-400 mb-1.5 text-center border-b pb-1"
        style={{ borderColor: IMPERIAL_PALETTE.gold + '30' }}
      >
        Score
      </h3>

      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <div className="text-center p-1.5 bg-blue-900/20 rounded border border-blue-500/30">
          <div className="text-[8px] text-blue-300 mb-0.5">T1</div>
          <div className="text-base font-['Cinzel'] font-bold text-blue-400">{scores.team1}</div>
          <div className="text-[8px] text-blue-300/60">B: {booksThisHand.team1}</div>
        </div>

        <div className="text-center p-1.5 bg-orange-900/20 rounded border border-orange-500/30">
          <div className="text-[8px] text-orange-300 mb-0.5">T2</div>
          <div className="text-base font-['Cinzel'] font-bold text-orange-400">{scores.team2}</div>
          <div className="text-[8px] text-orange-300/60">B: {booksThisHand.team2}</div>
        </div>
      </div>

      {currentBid && (
        <div className="mt-1.5 p-1.5 bg-amber-900/20 rounded border border-amber-500/30">
          <div className="text-[8px] text-amber-300 mb-0.5">Bid:</div>
          <div className="text-[10px] font-bold text-amber-400">
            {currentBid.amount} - {currentBid.type}
          </div>
          {currentBid.trump && (
            <div className="text-[8px] text-amber-300/70">Trump: {currentBid.trump}</div>
          )}
        </div>
      )}
    </div>
  );
}
