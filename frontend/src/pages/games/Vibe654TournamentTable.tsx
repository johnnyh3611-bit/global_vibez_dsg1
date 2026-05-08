import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.REACT_APP_BACKEND_URL;

const Vibe654TournamentTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playingRound, setPlayingRound] = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const userId = localStorage.getItem('userId') || 'demo_b88a4250';

  useEffect(() => {
    fetchTableStatus();
    const interval = setInterval(fetchTableStatus, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, [tableId]);

  const fetchTableStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/vibe654/tournament/table/${tableId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setTable(data.table);
        if (data.table.status === 'COMPLETED' && !showWinner) {
          setShowWinner(true);
        }
      }
    } catch (error) {
      console.error('Error fetching table:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTournament = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API}/api/vibe654/tournament/start-tournament/${tableId}?host_user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        await fetchTableStatus();
      } else {
        alert(data.detail || 'Failed to start tournament');
      }
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert('Error starting tournament');
    }
  };

  const handlePlayRound = async () => {
    setPlayingRound(true);
    setRoundResult(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/vibe654/tournament/play-round/${tableId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRoundResult(data);
        await fetchTableStatus();
        
        if (data.outcome === 'WINNER') {
          setTimeout(() => setShowWinner(true), 2000);
        }
      } else {
        alert(data.detail || 'Failed to play round');
      }
    } catch (error) {
      console.error('Error playing round:', error);
      alert('Error playing round');
    } finally {
      setPlayingRound(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-cyan-500"></div>
          <p className="mt-4 text-white text-xl">Loading table...</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-2xl mb-4">Table not found</p>
          <button
            onClick={() => navigate('/games/vibe654/tournament')}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const isHost = table.host === userId || table.host_user_id === userId;
  const activePlayers = table.players?.filter(p => p.status === 'active') || [];
  const eliminatedPlayers = table.players?.filter(p => p.status === 'eliminated') || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              {table.table_name}
            </h1>
            <p className="text-gray-400 mt-2">
              Host: {table.host} • Buy-in: ₵{Number(table.buy_in || 0).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => navigate('/games/vibe654/tournament')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            ← Back to Lobby
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Table Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Pot Display */}
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-gradient-to-br from-yellow-600 to-orange-700 rounded-xl p-6 shadow-2xl border-4 border-yellow-400"
          >
            <p className="text-sm text-yellow-200 mb-2">TOTAL POT</p>
            <p className="text-5xl font-bold" data-testid="vibe654-total-pot">₵{Number(table.total_pot || 0).toLocaleString()}</p>
            <p className="text-sm text-yellow-200 mt-2">
              House Rake: 12.5% (₵{Math.round((table.total_pot || 0) * 0.125).toLocaleString()})
            </p>
          </motion.div>

          {/* Status */}
          <div className="bg-gray-800/70 rounded-xl p-6 border border-cyan-500/30">
            <h3 className="text-xl font-bold mb-4">Tournament Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-bold ${
                  table.status === 'WAITING' ? 'text-yellow-400' :
                  table.status === 'IN_PROGRESS' ? 'text-green-400' :
                  'text-purple-400'
                }`}>
                  {table.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Round:</span>
                <span className="font-bold">{table.round_number || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Players:</span>
                <span className="font-bold text-cyan-400">{table.active_players}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Players:</span>
                <span className="font-bold">{table.players?.length} / 20</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {table.status === 'WAITING' && isHost && (
              <button
                onClick={handleStartTournament}
                disabled={table.players?.length < 2}
                className={`w-full py-4 rounded-lg font-bold text-xl transition ${
                  table.players?.length < 2
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg'
                }`}
              >
                {table.players?.length < 2 ? 'Need 2+ Players' : '🎲 Start Tournament'}
              </button>
            )}

            {table.status === 'IN_PROGRESS' && (
              <button
                onClick={handlePlayRound}
                disabled={playingRound}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg font-bold text-xl transition shadow-lg disabled:opacity-50"
              >
                {playingRound ? '🎲 Rolling...' : '🎲 Play Round'}
              </button>
            )}

            {table.status === 'WAITING' && !isHost && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 text-center">
                <p className="text-blue-300">Waiting for host to start...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Players & Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Round Result */}
          <AnimatePresence>
            {roundResult && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-xl p-6 border-2 ${
                  roundResult.outcome === 'WINNER' ? 'bg-green-900/50 border-green-500' :
                  roundResult.outcome === 'TIE' ? 'bg-yellow-900/50 border-yellow-500' :
                  'bg-red-900/50 border-red-500'
                }`}
              >
                <h3 className="text-2xl font-bold mb-2">
                  {roundResult.outcome === 'WINNER' ? '🏆 WINNER!' :
                   roundResult.outcome === 'TIE' ? '⚖️ TIE - Shootout!' :
                   '❌ NO QUALIFIERS'}
                </h3>
                <p className="text-lg">{roundResult.message}</p>
                
                {roundResult.outcome === 'WINNER' && roundResult.payout && (
                  <div className="mt-4 bg-black/30 rounded-lg p-4">
                    <p className="text-sm text-gray-300">Winner: {roundResult.winner?.player_name}</p>
                    <p className="text-3xl font-bold text-green-400">₵{Number(roundResult.payout.winner_payout || 0).toLocaleString()}</p>
                    <p className="text-sm text-gray-400">After 12.5% rake (₵{Number(roundResult.payout.house_rake || 0).toLocaleString()})</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Players */}
          {activePlayers.length > 0 && (
            <div className="bg-gray-800/70 rounded-xl p-6 border border-cyan-500/30">
              <h3 className="text-2xl font-bold mb-4">Active Players ({activePlayers.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activePlayers.map((player, idx) => (
                  <motion.div
                    key={player.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border border-cyan-500/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center font-bold">
                          {player.player_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold">{player.player_name}</p>
                          <p className="text-xs text-gray-400">
                            {player.user_id === userId && '(You)'}
                            {player.user_id === table.host_user_id && '👑 Host'}
                          </p>
                        </div>
                      </div>
                      <div className="text-green-400 font-bold">ACTIVE</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Eliminated Players */}
          {eliminatedPlayers.length > 0 && (
            <div className="bg-gray-800/70 rounded-xl p-6 border border-red-500/30">
              <h3 className="text-xl font-bold mb-4 text-red-400">
                Eliminated ({eliminatedPlayers.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {eliminatedPlayers.map((player) => (
                  <div
                    key={player.user_id}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center opacity-50"
                  >
                    <p className="text-sm truncate">{player.player_name}</p>
                    <p className="text-xs text-red-500">OUT</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Round History */}
          {table.round_history && table.round_history.length > 0 && (
            <div className="bg-gray-800/70 rounded-xl p-6 border border-purple-500/30">
              <h3 className="text-xl font-bold mb-4">Round History</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {table.round_history.slice().reverse().map((round, idx) => (
                  <div
                    key={`round-${round.round_number}-${round.timestamp || idx}`}
                    className="bg-gray-900/50 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Round {round.round_number}</span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        round.outcome === 'WINNER' ? 'bg-green-500/20 text-green-400' :
                        round.outcome === 'TIE' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {round.outcome}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      High Score: {round.high_score}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Winner Modal */}
      <AnimatePresence>
        {showWinner && table.winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 rounded-3xl p-12 max-w-2xl w-full text-center border-8 border-yellow-400 shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <p className="text-8xl mb-4">🏆</p>
              </motion.div>
              
              <h2 className="text-6xl font-bold mb-4">WINNER!</h2>
              <p className="text-4xl font-bold mb-8">{table.winner.player_name}</p>
              
              {table.payout_info && (
                <div className="bg-black/30 rounded-2xl p-8 mb-8">
                  <p className="text-2xl mb-2">Prize Winnings</p>
                  <p className="text-7xl font-bold text-green-400 mb-4" data-testid="vibe654-winner-payout">
                    ₵{Number(table.payout_info.winner_payout || 0).toLocaleString()}
                  </p>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>Total Pot: ₵{Number(table.payout_info.total_pot || 0).toLocaleString()}</p>
                    <p>House Rake (12.5%): ₵{Number(table.payout_info.house_rake || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => navigate('/games/vibe654/tournament')}
                  className="flex-1 px-8 py-4 bg-white text-gray-900 hover:bg-gray-200 rounded-lg font-bold text-xl transition"
                >
                  Back to Lobby
                </button>
                <button
                  onClick={() => setShowWinner(false)}
                  className="flex-1 px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-xl transition"
                >
                  View Table
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Vibe654TournamentTable;
