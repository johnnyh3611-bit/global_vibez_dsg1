import React from 'react';

const PokerTableWrapper = ({ children }) => {
  return (
    <div className="relative w-full h-0 pb-[56.25%] bg-slate-900 rounded-[200px] border-[12px] border-amber-900 shadow-2xl overflow-hidden">
      {/* Table Felt with a subtle radial gradient for atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-emerald-900 to-slate-950 opacity-80" />
      
      {/* Game Content Layer */}
      <div className="absolute inset-0 p-4 sm:p-8">
        {children}
      </div>
    </div>
  );
};

export default PokerTableWrapper;
