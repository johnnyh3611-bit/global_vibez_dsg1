import React from 'react';
import ActionButton from './ActionButton';

export const ActionBar = ({ 
  onFold, 
  onCall, 
  onRaise, 
  raiseAmount, 
  onRaiseChange, 
  disabled = false,
  currentBet = 0,
  minRaise = 50,
  maxRaise = 500
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-30">
      <div className="bg-black/60 backdrop-blur-md border border-white/10 p-3 sm:p-4 rounded-2xl">
        
        {/* Raise Slider - Responsive */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-amber-200 text-xs sm:text-sm font-bold">Raise Amount:</span>
            <span className="text-white text-sm sm:text-lg font-black">₵{raiseAmount}</span>
          </div>
          <input 
            type="range" 
            min={minRaise}
            max={maxRaise}
            step="50"
            value={raiseAmount}
            onChange={(e) => onRaiseChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-amber-900/50 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
        
        {/* Action Buttons - Responsive Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <ActionButton label="Fold" color="red" onClick={onFold} disabled={disabled} />
          <ActionButton label={`Call ${currentBet > 0 ? `$${currentBet}` : ''}`} color="slate" onClick={onCall} disabled={disabled} />
          <ActionButton label="Raise" color="green" onClick={onRaise} disabled={disabled} />
        </div>
      </div>
    </div>
  );
};
