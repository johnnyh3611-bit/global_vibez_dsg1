import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Users, Play, DollarSign, MapPin, Gamepad2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SmartTables() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, poker, bidwhist, baccarat

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/api/smart-tables/`);
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      // console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTable = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const newTable = {
        table_name: `Table ${tables.length + 1}`,
        game_type: 'Poker_Holdem',
        max_players: 6,
        assets: {
          dealer_metahuman: '/Game/MetaHumans/Dealers/Dealer_01',
          table_mesh: '/Game/Casino/Tables/PokerTable_01'
        },
        spatial_data: {
          card_placement: [0, 0, 100],
          chip_tray: [50, 50, 90],
          dealer_position: [0, -200, 100]
        }
      };

      const response = await fetch(`${API_URL}/api/smart-tables/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTable)
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ Table created: ${data.table_id}`);
        fetchTables();
      }
    } catch (error) {
      // console.error('Error creating table:', error);
      alert('Failed to create table');
    }
  };

  const joinTable = async (tableId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      // Find first available seat
      const tableDetails = await fetch(`${API_URL}/api/smart-tables/${tableId}`);
      const tableData = await tableDetails.json();

      const availableSeat = tableData.seats.findIndex(seat => seat === null);
      if (availableSeat === -1) {
        alert('Table is full!');
        return;
      }

      const response = await fetch(`${API_URL}/api/smart-tables/${tableId}/sit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: userData.user_id,
          player_name: userData.name || 'Player',
          table_id: tableId,
          seat_index: availableSeat
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ Joined table at seat ${availableSeat + 1}`);
        // Navigate to game room
        navigate(`/table/${tableId}`);
      }
    } catch (error) {
      // console.error('Error joining table:', error);
      alert('Failed to join table');
    }
  };

  const getGameTypeIcon = (gameType) => {
    if (gameType.includes('Poker')) return '♠️';
    if (gameType.includes('Bid_Whist')) return '♦️';
    if (gameType.includes('Baccarat')) return '♣️';
    return '🎴';
  };

  const filteredTables = tables.filter(table => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'poker') return table.game_type.includes('Poker');
    if (activeFilter === 'bidwhist') return table.game_type.includes('Bid_Whist');
    if (activeFilter === 'baccarat') return table.game_type.includes('Baccarat');
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Smart Tables...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/games" label="Back to Games" variant="default" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Table className="w-12 h-12 text-cyan-400" />
            <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Smart Tables
            </h1>
          </div>
          <p className="text-gray-300 text-lg">MetaHuman-Powered Gaming Tables</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          {/* Filters */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All Tables
            </button>
            <button
              onClick={() => setActiveFilter('poker')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeFilter === 'poker'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ♠️ Poker
            </button>
            <button
              onClick={() => setActiveFilter('bidwhist')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeFilter === 'bidwhist'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ♦️ Bid Whist
            </button>
            <button
              onClick={() => setActiveFilter('baccarat')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                activeFilter === 'baccarat'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ♣️ Baccarat
            </button>
          </div>

          {/* Create Table */}
          <Button
            onClick={createTable}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
          >
            <Table className="w-5 h-5 mr-2" />
            Create New Table
          </Button>
        </div>

        {/* Tables Grid */}
        {filteredTables.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-600 p-12 text-center">
            <Gamepad2 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300 mb-2">No Tables Available</h3>
            <p className="text-gray-400 mb-6">Be the first to create a table!</p>
            <Button onClick={createTable} className="bg-cyan-500 hover:bg-cyan-600">
              Create Table
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTables.map((table) => {
              const occupiedSeats = table.seats?.filter(seat => seat !== null).length || 0;
              const maxSeats = table.max_players || 6;
              const isAvailable = occupiedSeats < maxSeats;

              return (
                <Card
                  key={table.table_id}
                  className={`bg-gradient-to-br ${
                    isAvailable
                      ? 'from-gray-800 to-gray-900 border-cyan-600/50'
                      : 'from-gray-900 to-black border-gray-700'
                  } p-6 hover:shadow-xl hover:shadow-cyan-500/20 transition-all`}
                >
                  {/* Table Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        {getGameTypeIcon(table.game_type)} {table.table_name}
                      </h3>
                      <p className="text-gray-400 text-sm">{table.game_type.replace(/_/g, ' ')}</p>
                    </div>
                    {isAvailable ? (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        OPEN
                      </span>
                    ) : (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        FULL
                      </span>
                    )}
                  </div>

                  {/* Table Stats */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Users className="w-5 h-5 text-cyan-400" />
                      <span>
                        {occupiedSeats}/{maxSeats} Players
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <DollarSign className="w-5 h-5 text-yellow-400" />
                      <span>Pot: ${table.game_state?.pot?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Play className="w-5 h-5 text-green-400" />
                      <span>{table.game_state?.phase || 'WAITING'}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => joinTable(table.table_id)}
                    disabled={!isAvailable}
                    className={`w-full ${
                      isAvailable
                        ? 'bg-cyan-500 hover:bg-cyan-600'
                        : 'bg-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {isAvailable ? 'Join Table' : 'Table Full'}
                  </Button>

                  {/* MetaHuman Dealer Badge */}
                  {table.assets?.dealer_metahuman && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-purple-400">
                      <MapPin className="w-4 h-4" />
                      <span>MetaHuman Dealer Enabled</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-gray-800/50 backdrop-blur-xl border border-gray-600 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">What are Smart Tables?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="bg-cyan-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Table className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Spatial Gaming</h3>
              <p className="text-gray-400 text-sm">
                Tables with real 3D coordinates for UE5 MetaHuman dealer integration
              </p>
            </div>
            <div>
              <div className="bg-purple-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Multiplayer</h3>
              <p className="text-gray-400 text-sm">
                Play with other users in real-time with automated dealer interactions
              </p>
            </div>
            <div>
              <div className="bg-yellow-500/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Secure Betting</h3>
              <p className="text-gray-400 text-sm">
                Locked fund verification and automated payout distribution
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
