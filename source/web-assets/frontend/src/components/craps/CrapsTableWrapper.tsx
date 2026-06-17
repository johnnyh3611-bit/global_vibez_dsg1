import React from 'react';

const CrapsTableWrapper = ({ children }) => {
  return (
    <div className="relative w-full h-0 pb-[45%] bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950 rounded-[100px] border-[16px] border-amber-900 shadow-2xl overflow-hidden">
      {/* Authentic Casino Felt Texture */}
      <div 
        className="absolute inset-0 opacity-90"
        style={{
          background: 'radial-gradient(circle at 30% 40%, rgba(16, 185, 129, 0.3) 0%, transparent 60%), url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.05" /%3E%3C/svg%3E")',
          backgroundBlendMode: 'overlay'
        }}
      />
      
      {/* Table Layout Lines */}
      <div className="absolute inset-0 border-[4px] border-white/10 rounded-[90px] m-4" />
      
      {/* Game Content */}
      <div className="absolute inset-0 p-4 sm:p-8">
        {children}
      </div>
    </div>
  );
};

export default CrapsTableWrapper;
