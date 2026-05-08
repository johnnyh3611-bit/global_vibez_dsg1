import React from 'react';
import { TrendingUp, TrendingDown, Circle } from 'lucide-react';

const BID_TYPES = {
  UPTOWN: { name: 'Uptown', icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-400' },
  DOWNTOWN: { name: 'Downtown', icon: <TrendingDown className="w-4 h-4" />, color: 'text-orange-400' },
  NO_TRUMP: { name: 'No Trump', icon: <Circle className="w-4 h-4" />, color: 'text-purple-400' },
  NULLO: { name: 'Nullo', icon: '⊘', color: 'text-red-400' }
};

const IMPERIAL_SUITS = {
  'spades': { symbol: '♠', color: '#000000', name: 'Spades' },
  'hearts': { symbol: '♥', color: '#dc2626', name: 'Hearts' },
  'diamonds': { symbol: '♦', color: '#2563eb', name: 'Diamonds' },
  'clubs': { symbol: '♣', color: '#15803d', name: 'Clubs' }
};

const IMPERIAL_PALETTE = {
  gold: '#d4af37',
  cream: '#f5f5dc'
};

export default function BiddingPanel({ currentBid, 
  onBid, 
  onPass, 
  enableNullo = false }: { currentBid?: any, onBid?: any, onPass?: any, enableNullo?: any }) {
  const [bidAmount, setBidAmount] = React.useState(4);
  const [bidType, setBidType] = React.useState('UPTOWN');
  const [trumpSuit, setTrumpSuit] = React.useState('spades');

  const handlePlaceBid = () => {
    onBid({
      amount: bidAmount,
      type: bidType,
      trump: bidType !== 'NO_TRUMP' && bidType !== 'NULLO' ? trumpSuit : null
    });
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 border-2 border-amber-600/30 shadow-2xl">
      <h3 className="text-2xl font-['Cinzel'] text-amber-400 mb-4 text-center">Place Your Bid</h3>
      
      {currentBid && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="text-xs text-blue-300 mb-1">Current High Bid:</div>
          <div className="text-lg font-bold text-blue-400">
            {currentBid.amount} books - {BID_TYPES[currentBid.type]?.name}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="text-xs text-amber-200/70 mb-2">Books (4-13):</div>
        <input
          type="range"
          min="4"
          max="13"
          value={bidAmount}
          onChange={(e) => setBidAmount(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-3xl font-['Cinzel'] font-bold text-amber-400 mt-2">
          {bidAmount}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-amber-200/70 mb-2">Bid Type:</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BID_TYPES).map(([key, type]) => {
            if (key === 'NULLO' && !enableNullo) return null;
            return (
              <button
                key={key}
                onClick={() => setBidType(key)}
                className={`py-2 px-3 rounded-lg text-xs font-['Crimson_Text'] transition-all flex items-center justify-center gap-2 ${
                  bidType === key
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                    : 'bg-slate-700/50 text-amber-200/60 hover:bg-slate-700'
                }`}
              >
                {typeof type.icon === 'string' ? <span>{type.icon}</span> : type.icon}
                {type.name}
              </button>
            );
          })}
        </div>
      </div>

      {bidType !== 'NO_TRUMP' && bidType !== 'NULLO' && (
        <div className="mb-4">
          <div className="text-xs text-amber-200/70 mb-2">Trump Suit:</div>
          <div className="grid grid-cols-4 gap-2">
            {['spades', 'hearts', 'diamonds', 'clubs'].map((suit) => {
              const suitData = IMPERIAL_SUITS[suit];
              return (
                <button
                  key={suit}
                  onClick={() => setTrumpSuit(suit)}
                  className={`py-3 rounded-lg transition-all ${
                    trumpSuit === suit
                      ? 'bg-white shadow-lg scale-105'
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                  style={{ color: trumpSuit === suit ? suitData.color : IMPERIAL_PALETTE.cream }}
                >
                  <div className="text-3xl">{suitData.symbol}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handlePlaceBid}
          className="flex-1 py-3 rounded-lg font-['Cinzel'] font-bold text-lg
            bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600
            text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          style={{ boxShadow: `0 10px 30px ${IMPERIAL_PALETTE.gold}40` }}
        >
          Place Bid
        </button>
        <button
          onClick={onPass}
          className="px-6 py-3 rounded-lg font-['Cinzel'] font-bold
            bg-slate-700 text-amber-200 hover:bg-slate-600 transition-all"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
