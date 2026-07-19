
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
      const token = (localStorage.getItem('auth_token') || localStorage.getItem('token'));
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
      const token = (localStorage.getItem('auth_token') || localStorage.getItem('token'));
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
      const token = (localStorage.getItem('auth_token') || localStorage.getItem('token'));
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
    <div className="min-h-screen bg-[#06080f] text-slate-100 p-3 sm:p-6 lg:p-8 overflow-x-hidden" data-testid="vibe654-tournament-lobby">
      {/* Header — matches Vibez 654 Hall visual language */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300 mb-1">Vibez 654</p>
            <h1 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-amber-200 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
              Tournament Lobby
            </h1>
            <p className="text-white/55 mt-2 text-sm sm:text-base">
              20-player tables · Sequential 6→5→4 · 12.5% house rake
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate('/vibe-654-hall')}
              className="px-4 py-2.5 rounded-full border border-white/15 bg-black/40 text-sm font-semibold text-white/80 hover:border-amber-400/40 hover:text-amber-100 transition"
              data-testid="vibe654-lobby-back-hall"
            >
              ← 654 Hall
            </button>
            <button
              onClick={() => navigate('/games')}
              className="px-4 py-2.5 rounded-full border border-white/15 bg-black/40 text-sm font-semibold text-white/80 hover:border-cyan-400/40 transition"
            >
              Games
            </button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            data-testid="vibe654-lobby-create-open"
            className="px-6 py-3 rounded-full bg-amber-400 text-black font-black text-sm uppercase tracking-widest hover:bg-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.35)] transition"
          >
            Create New Table
          </button>
          <button
            onClick={fetchActiveTables}
            className="px-5 py-3 rounded-full border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 font-bold text-sm uppercase tracking-wider hover:bg-cyan-500/20 transition"
          >
            Refresh Tables
          </button>
          <button
            onClick={() => navigate('/vibe-654/solo')}
            data-testid="vibe654-lobby-enter-solo"
            className="px-5 py-3 rounded-full bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-500 font-black text-sm uppercase tracking-wider text-black hover:brightness-110 shadow-[0_0_40px_-10px_rgba(251,191,36,0.7)] transition"
          >
            1vAI Solo Vault
          </button>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-amber-200/90 mb-6">
          Active Tables ({activeTables.length})
        </h2>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-amber-400" />
            <p className="mt-4 text-white/50 text-sm">Loading tables…</p>
          </div>
        ) : activeTables.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-2xl border border-dashed border-white/15 bg-black/40"
          >
            <p className="text-xl text-white/70 mb-2 font-semibold">No active tables</p>
            <p className="text-white/45 text-sm">Create a new table to get started.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTables.map((table, index) => (
              <motion.div
                key={table.table_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 hover:border-amber-400/40 transition shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-cyan-300">{table.table_name}</h3>
                    <p className="text-sm text-white/45 mt-0.5">Host: {table.host_name}</p>
                  </div>
                  <div className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Open
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/45">Buy-in</span>
                    <span className="font-mono font-bold text-amber-300" data-testid="vibe654-lobby-buyin">
                      ₵{Number(table.buy_in || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Players</span>
                    <span className="font-semibold">
                      {table.current_players?.length || 0} / {table.max_players}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Total Pot</span>
                    <span className="font-mono font-bold text-emerald-300" data-testid="vibe654-lobby-pot">
                      ₵{Number(table.total_pot || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinTable(table.table_id)}
                  disabled={table.current_players?.length >= table.max_players}
                  className={`w-full py-2.5 rounded-full text-sm font-black uppercase tracking-widest transition ${
                    table.current_players?.length >= table.max_players
                      ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                      : 'bg-cyan-400 text-black hover:bg-cyan-300'
                  }`}
                >
                  {table.current_players?.length >= table.max_players ? 'Table Full' : 'Join Table'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Table Modal — glass form matching Hall / Premium controls */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0b0f1a]/95 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-amber-400/40 shadow-[0_0_48px_rgba(251,191,36,0.18)]"
              data-testid="vibe654-create-table-modal"
            >
              <h2 className="text-2xl font-black mb-1 text-amber-200">
                Create Tournament Table
              </h2>
              <p className="text-sm text-white/50 mb-6">
                Sequential 6→5→4 · 3 rolls max · 12.5% rake
              </p>

              <form onSubmit={handleCreateTable} className="space-y-5" data-testid="vibe654-create-table-form">
                <div>
                  <label htmlFor="vibe654-table-name" className="block text-sm font-semibold text-white mb-2">
                    Table Name
                  </label>
                  <input
                    id="vibe654-table-name"
                    type="text"
                    value={createForm.tableName}
                    onChange={(e) => setCreateForm({ ...createForm, tableName: e.target.value })}
                    placeholder="High Rollers Vibez 654"
                    data-testid="vibe654-create-table-name"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white text-sm placeholder:text-white/30 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  />
                </div>

                <div>
                  <label htmlFor="vibe654-buyin" className="block text-sm font-semibold text-white mb-2">
                    Buy-in Amount
                  </label>
                  <select
                    id="vibe654-buyin"
                    value={String(createForm.buyIn)}
                    onChange={(e) => setCreateForm({ ...createForm, buyIn: Number(e.target.value) })}
                    data-testid="vibe654-create-buyin"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
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
                  <label htmlFor="vibe654-max-players" className="block text-sm font-semibold text-white mb-2">
                    Max Players
                  </label>
                  <select
                    id="vibe654-max-players"
                    value={String(createForm.maxPlayers)}
                    onChange={(e) => setCreateForm({ ...createForm, maxPlayers: Number(e.target.value) })}
                    data-testid="vibe654-create-max-players"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/15 text-white text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                  >
                    <option value="4">4 Players</option>
                    <option value="8">8 Players</option>
                    <option value="10">10 Players</option>
                    <option value="20">20 Players</option>
                  </select>
                </div>

                <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3">
                  <p className="text-sm text-cyan-100/90 leading-relaxed">
                    <strong className="text-cyan-200">Rules:</strong> Qualify 6→5→4, then score with point dice. House takes 12.5% of the pot.
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 rounded-full border border-white/15 bg-white/5 text-sm font-bold uppercase tracking-wider text-white/80 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="vibe654-create-table-submit"
                    className="flex-1 px-4 py-3 rounded-full bg-amber-400 text-black text-sm font-black uppercase tracking-wider hover:bg-amber-300 transition"
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
