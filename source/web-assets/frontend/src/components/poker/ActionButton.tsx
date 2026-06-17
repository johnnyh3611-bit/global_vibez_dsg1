import React from 'react';

const ActionButton = ({ label, onClick, color = "amber", disabled = false }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full font-bold uppercase tracking-widest 
    border-b-4 active:border-b-0 transition-all text-sm sm:text-base
    disabled:opacity-30 disabled:cursor-not-allowed
    ${color === 'amber' ? 'bg-amber-600 border-amber-800 text-amber-100 hover:bg-amber-500' : 
    color === 'green' ? 'bg-green-600 border-green-800 text-green-100 hover:bg-green-500' :
    color === 'red' ? 'bg-red-600 border-red-800 text-red-100 hover:bg-red-500' :
    'bg-slate-700 border-slate-900 text-slate-200 hover:bg-slate-600'}`}
  >
    {label}
  </button>
);

export default ActionButton;
