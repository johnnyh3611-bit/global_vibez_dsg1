import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableSelector } from '@/components/practice_games/TableSelector';
import { Settings } from 'lucide-react';

export default function ModernGamesShowcase() {
  const navigate = useNavigate();
  const [showTableSelector, setShowTableSelector] = useState(true);
  const [selectedTable, setSelectedTable] = useState('simple_clean');

  const handleTableSelect = (tableId) => {
    setSelectedTable(tableId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative">
      {/* Demo Controls */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between">
        <button
          onClick={() => navigate('/demo')}
          className="px-4 py-2 bg-gray-800 text-white rounded-xl border-2 border-gray-600 hover:border-gray-400 transition-colors"
        >
          ← Back
        </button>
        
        <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-2xl border-2 border-yellow-500">
          <p className="text-white font-bold">🎨 Table Selector Demo</p>
        </div>
        
        <button
          onClick={() => setShowTableSelector(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl border-2 border-blue-400 hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Settings className="w-5 h-5" />
          Tables
        </button>
      </div>

      {/* Table Selector */}
      {showTableSelector && (
        <TableSelector
          onSelect={handleTableSelect}
          onClose={() => setShowTableSelector(false)}
          currentTable={selectedTable}
          userCoins={2500}
          userLevel={5}
        />
      )}
    </div>
  );
}
