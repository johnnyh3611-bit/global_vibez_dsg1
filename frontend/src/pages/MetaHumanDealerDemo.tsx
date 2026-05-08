import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Users, Coins, Sparkles, Crown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function MetaHumanDealerDemo() {
  const [tables, setTables] = useState([]);
  const [balance, setBalance] = useState(10000);
  const [dealerMessage, setDealerMessage] = useState(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tables/list`);
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      // console.error('Failed to fetch tables:', error);
    }
  };

  const createTable = async (gameType) => {
    const configs = {
      'Poker_Holdem': {
        table_name: 'Executive Poker Table',
        game_type: 'Poker_Holdem',
        max_players: 9,
        assets: {},
        spatial_data: {}
      },
      'Bid_Whist': {
        table_name: 'Bid Whist Lounge',
        game_type: 'Bid_Whist',
        max_players: 4,
        assets: {},
        spatial_data: {}
      },
      'Baccarat': {
        table_name: 'Baccarat Salon',
        game_type: 'Baccarat',
        max_players: 14,
        assets: {},
        spatial_data: {}
      }
    };

    try {
      const response = await fetch(`${API_URL}/api/tables/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs[gameType])
      });
      const data = await response.json();
      if (data.success) {
        fetchTables();
        showDealer(`Welcome to ${configs[gameType].table_name}!`);
      }
    } catch (error) {
      // console.error('Failed to create table:', error);
    }
  };

  const placeBet = async (tableId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/verify-bet?player_id=demo_user&amount=500&table_id=${tableId}&game_type=Poker_Holdem`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.status === 'APPROVED') {
        setBalance(data.new_pending_balance);
        showDealer('Bet secured. Good luck!');
      }
    } catch (error) {
      // console.error('Bet failed:', error);
    }
  };

  const showDealer = (message) => {
    setDealerMessage(message);
    setTimeout(() => setDealerMessage(null), 3000);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #1e1b4b, #000, #164e63)', color: 'white', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(147, 51, 234, 0.2)', border: '1px solid rgba(147, 51, 234, 0.3)', padding: '0.5rem 1rem', borderRadius: '9999px', marginBottom: '1rem' }}>
            <Sparkles size={16} style={{ color: '#a78bfa' }} />
            <span style={{ color: '#a78bfa', fontSize: '0.875rem', fontWeight: 'bold' }}>METAHUMAN DEALER SYSTEM</span>
          </div>
          
          <h1 style={{ fontSize: '4rem', fontWeight: 'black', marginBottom: '1rem' }}>
            Smart Table <span style={{ background: 'linear-gradient(to right, #22d3ee, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Demo</span>
          </h1>
          
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.125rem', maxWidth: '700px', margin: '0 auto 2rem' }}>
            Experience MetaHuman dealers with spatial table awareness
          </p>

          <div data-testid="balance-display" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '0.75rem 1.5rem', borderRadius: '0.75rem' }}>
            <Coins size={20} style={{ color: '#facc15' }} />
            <span data-testid="balance-amount" style={{ color: '#facc15', fontWeight: 'bold', fontSize: '1.25rem' }}>{balance.toLocaleString()}</span>
            <span style={{ color: 'rgba(250, 204, 21, 0.6)', fontSize: '0.875rem' }}>GV Coins</span>
          </div>
        </div>

        {/* Dealer Message */}
        {dealerMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ background: 'rgba(147, 51, 234, 0.9)', backdropFilter: 'blur(20px)', border: '2px solid rgba(34, 211, 238, 0.5)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(to bottom right, #0891b2, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Crown size={30} style={{ color: 'white' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '0.875rem' }}>DEALER</span>
                </div>
                <p style={{ fontSize: '1.125rem', fontWeight: '500', fontStyle: 'italic' }}>
                  "{dealerMessage}"
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Create Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
          <button
            data-testid="create-poker-btn"
            onClick={() => createTable('Poker_Holdem')}
            style={{ background: 'linear-gradient(to right, #059669, #16a34a)', color: 'white', padding: '1.25rem', borderRadius: '0.5rem', border: 'none', fontSize: '1.125rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Play size={20} />
            Create Poker
          </button>
          <button
            data-testid="create-bid-whist-btn"
            onClick={() => createTable('Bid_Whist')}
            style={{ background: 'linear-gradient(to right, #7c3aed, #8b5cf6)', color: 'white', padding: '1.25rem', borderRadius: '0.5rem', border: 'none', fontSize: '1.125rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Play size={20} />
            Create Bid Whist
          </button>
          <button
            data-testid="create-baccarat-btn"
            onClick={() => createTable('Baccarat')}
            style={{ background: 'linear-gradient(to right, #0284c7, #0891b2)', color: 'white', padding: '1.25rem', borderRadius: '0.5rem', border: 'none', fontSize: '1.125rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Play size={20} />
            Create Baccarat
          </button>
        </div>

        {/* Tables */}
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={24} style={{ color: '#22d3ee' }} />
          Active Tables ({tables.length})
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {tables.map((table) => (
            <div
              key={table.table_id}
              data-testid={`table-card-${table.table_id}`}
              style={{ background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(34, 211, 238, 0.3)', padding: '1.5rem', borderRadius: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                    {table.game_type.replace('_', ' ')}
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                    {table.seated_players}/{table.max_players} Players
                  </p>
                </div>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold', background: table.status === 'WAITING' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)', color: table.status === 'WAITING' ? '#facc15' : '#22c55e' }}>
                  {table.status}
                </span>
              </div>
              
              <button
                data-testid={`place-bet-${table.table_id}`}
                onClick={() => placeBet(table.table_id)}
                style={{ width: '100%', background: '#0891b2', color: 'white', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Coins size={16} />
                Place Bet (500)
              </button>
            </div>
          ))}
        </div>

        {tables.length === 0 && (
          <div style={{ background: 'rgba(31, 41, 55, 0.5)', border: '1px solid rgba(55, 65, 81, 1)', padding: '3rem', borderRadius: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>No active tables. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MetaHumanDealerDemo;
