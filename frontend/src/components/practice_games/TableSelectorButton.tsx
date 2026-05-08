import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { TableSelector } from './TableSelector';

const API = process.env.REACT_APP_BACKEND_URL;

export function TableSelectorButton({ onTableChange }: { onTableChange?: any }) {
  const [showSelector, setShowSelector] = useState(false);
  const [selectedTable, setSelectedTable] = useState('simple_clean');
  const [userCoins, setUserCoins] = useState(2500);
  const [userLevel, setUserLevel] = useState(1);

  useEffect(() => {
    // Try to fetch user data, but don't fail if API doesn't exist
    fetchUserData();
    fetchSelectedTable();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`${API}/api/profile`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setUserCoins(data.coins || 2500);
        setUserLevel(data.level || 1);
      }
    } catch (error) {
      // Silent fail - use default values
    }
  };

  const fetchSelectedTable = async () => {
    try {
      const response = await fetch(`${API}/api/tables/selected`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedTable(data.selected_table);
        if (onTableChange) {
          onTableChange(data.selected_table);
        }
      }
    } catch (error) {
      // Silent fail - use default table
    }
  };

  const handleTableSelect = async (tableId) => {
    try {
      const response = await fetch(`${API}/api/tables/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ table_id: tableId }),
      });
      
      if (response.ok) {
        setSelectedTable(tableId);
        if (onTableChange) {
          onTableChange(tableId);
        }
        // Refresh user data after selection
        fetchUserData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to select table');
      }
    } catch (error) {
      // console.error('Failed to select table:', error);
      alert('Failed to select table');
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setShowSelector(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-4 right-4 z-40 w-12 h-12 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-full flex items-center justify-center border-2 border-cyan-400 shadow-xl"
        style={{ boxShadow: '0 0 30px rgba(217, 70, 239, 0.6)' }}
      >
        <Settings className="w-6 h-6 text-white" />
      </motion.button>

      {showSelector && (
        <TableSelector
          onSelect={handleTableSelect}
          onClose={() => setShowSelector(false)}
          currentTable={selectedTable}
          userCoins={userCoins}
          userLevel={userLevel}
        />
      )}
    </>
  );
}
