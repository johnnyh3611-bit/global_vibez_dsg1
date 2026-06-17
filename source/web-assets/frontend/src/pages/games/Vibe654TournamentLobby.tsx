
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.REACT_APP_BACKEND_URL;

const Vibe654TournamentLobby = () => {
  const navigate = useNavigate();
  const [activeTables, setActiveTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    tableName: '',
    buyIn: 100000,
    maxPlayers: 20
  });

  useEffect(() => {
    fetchActiveTables();
    const interval = setInterval(fetchActiveTables, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchActiveTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/vibe654/tournament/tables/active?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActiveTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const userEmail = localStorage.getItem('userEmail') || 'demo@globalvibez.com';
      const userName = userEmail.split('@')[0];
      const userId = localStorage.getItem('userId') || 'demo_b88a4250';

      const response = await fetch(`${API}/api/vibe654/tournament/create-table`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host_user_id: userId,
          host_name: userName,
          buy_in: typeof createForm.buyIn === 'string' ? parseFloat(createForm.buyIn) : createForm.buyIn,
          max_players: typeof createForm.maxPlayers === 'string' ? parseInt(createForm.maxPlayers as unknown as string) : createForm.maxPlayers,
          table_name: createForm.tableName || `${userName}'s Table`
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        navigate(`/games/vibe654/tournament/table/${data.table_id}`);
      } else {
        alert('Failed to create table: ' + (data.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating table:', error);
      alert('Error creating table');
    }
  };

  const handleJoinTable = async (tableId) => {
    try {
      const token = localStorage.getItem('token');
      const userEmail = localStorage.getItem('userEmail') || 'demo@globalvibez.com';
      const userName = userEmail.split('@')[0];
      const userId = localStorage.getItem('userId') || 'demo_b88a4250';

      const response = await fetch(`${API}/api/vibe654/tournament/join-table`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          player_name: userName,
          table_id: tableId
        })
      });

      const data = await response.json();
      if (data.success) {
        navigate(`/games/vibe654/tournament/table/${tableId}`);
      } else {
        alert(data.detail || 'Failed to join table');
      }
    } catch (error) {
      console.error('Error joining table:', error);
      alert('Error joining table');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white p-3 sm:p-6 lg:p-8 overflow-x-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Vibe 654 Tournament
            </h1>
            <p className="text-gray-400 mt-2">20-Player Tables • Sequential 6-5-4 • 12.5% House Rake</p>
          </div>
          <button
            onClick={() => navigate('/games')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            ← Back to Games
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg font-bold text-xl shadow-lg transition transform hover:scale-105"
          >
            🎲 Create New Table
          </button>
          <button
            onClick={fetchActiveTables}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition"
          >
            🔄 Refresh Tables
          </button>
          <button
            onClick={() => navigate('/vibe-654/solo')}
            data-testid="vibe654-lobby-enter-solo"
            className="px-6 py-4 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-500 hover:brightness-110 rounded-lg font-bold transition text-black shadow-[0_0_40px_-10px_rgba(251,191,36,0.7)]"
          >
            🧠 1vAI Solo Vault
          </button>
        </div>
      </motion.div>

      {/* Active Tables */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Active Tables ({activeTables.length})</h2>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500"></div>
            <p className="mt-4 text-gray-400">Loading tables...</p>
          </div>
        ) : activeTables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-700"
          >
            <p className="text-2xl text-gray-400 mb-4">No active tables</p>
            <p className="text-gray-500">Create a new table to get started!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTables.map((table, index) => (
              <motion.div
                key={table.table_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-cyan-500/30 hover:border-cyan-400 transition shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-cyan-400">{table.table_name}</h3>
                    <p className="text-sm text-gray-400">Host: {table.host_name}</p>
                  </div>
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-bold">
                    OPEN
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Buy-in:</span>
                    <span className="font-bold text-yellow-400" data-testid="vibe654-lobby-buyin">₵{Number(table.buy_in || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Players:</span>
                    <span className="font-bold">
                      {table.current_players?.length || 0} / {table.max_players}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Pot:</span>
                    <span className="font-bold text-green-400" data-testid="vibe654-lobby-pot">₵{Number(table.total_pot || 0).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinTable(table.table_id)}
                  disabled={table.current_players?.length >= table.max_players}
                  className={`w-full py-3 rounded-lg font-bold transition ${
                    table.current_players?.length >= table.max_players
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700'
                  }`}
                >
                  {table.current_players?.length >= table.max_players ? 'Table Full' : 'Join Table'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Table Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-cyan-500/50 shadow-2xl"
            >
              <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Create Tournament Table
              </h2>

              <form onSubmit={handleCreateTable} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Table Name</label>
                  <input
                    type="text"
                    value={createForm.tableName}
                    onChange={(e) => setCreateForm({ ...createForm, tableName: e.target.value })}
                    placeholder="High Rollers Vibe 654"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Buy-in Amount</label>
                  <select
                    value={String(createForm.buyIn)}
                    onChange={(e) => setCreateForm({ ...createForm, buyIn: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="20000">₵20,000</option>
                    <option value="50000">₵50,000</option>
                    <option value="100000">₵100,000</option>
                    <option value="250000">₵250,000</option>
                    <option value="500000">₵500,000</option>
                    <option value="1000000">₵1,000,000</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Players</label>
                  <select
                    value={String(createForm.maxPlayers)}
                    onChange={(e) => setCreateForm({ ...createForm, maxPlayers: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="4">4 Players</option>
                    <option value="8">8 Players</option>
                    <option value="10">10 Players</option>
                    <option value="20">20 Players</option>
                  </select>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300">
                    <strong>Game Rules:</strong> Sequential 6→5→4 qualification, 3 rolls max, 12.5% house rake
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg font-bold transition"
                  >
                    Create Table
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Vibe654TournamentLobby;
