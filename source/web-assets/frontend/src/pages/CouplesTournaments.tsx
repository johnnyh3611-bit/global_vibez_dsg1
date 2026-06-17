import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Users, Heart, Plus, Coins, ArrowLeft, MessageCircle, Sparkles } from 'lucide-react';
import AppFooter from '@/components/AppFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CouplesTournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newTournament, setNewTournament] = useState({
    name: '',
    game_type: 'partner_quiz',
    tournament_type: 'couples',
    max_teams: 2,
    team_size: 2,
    entry_fee: 0,
    prize: '',
    allow_chat: true,
    show_opponent_answers: false
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tournaments/list?status=registration`, {
      });
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments);
      }
    } catch (error) {
      // console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTournament = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tournaments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(newTournament)
      });

      if (response.ok) {
        alert('Tournament created successfully!');
        setShowCreate(false);
        fetchTournaments();
        setNewTournament({
          name: '',
          game_type: 'partner_quiz',
          tournament_type: 'couples',
          max_teams: 2,
          team_size: 2,
          entry_fee: 0,
          prize: '',
          allow_chat: true,
          show_opponent_answers: false
        });
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create tournament');
      }
    } catch (error) {
      // console.error('Error creating tournament:', error);
      alert('Failed to create tournament');
    }
  };

  const datingShowGames = [
    { value: 'partner_quiz', label: '💕 Partner Quiz', description: 'Newlywed Game style' },
    { value: 'icebreaker', label: '💬 Icebreaker Questions', description: 'Get to know each other' },
    { value: 'compatibility', label: '❤️ Compatibility Challenge', description: 'See if you think alike' },
    { value: 'couples_trivia', label: '🎯 Couples Trivia', description: 'Dating & relationship trivia' },
    { value: 'would_you_rather', label: '🤔 Would You Rather', description: 'Fun couple choices' }
  ];

  const classicGames = [
    { value: 'tictactoe', label: '⭕ Tic-Tac-Toe' },
    { value: 'connect4', label: '🔴 Connect 4' },
    { value: 'uno', label: '🎴 UNO' },
    { value: 'chess', label: '♟️ Chess' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/tournaments')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tournaments
          </Button>
          <h1 className="text-5xl font-bold text-white mb-2">💕 Couples Tournaments</h1>
          <p className="text-white/80 text-xl">Dating show-style games where couples compete and connect</p>
        </div>

        {/* Tournament Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-8 bg-gradient-to-br from-pink-500/20 to-red-500/20 backdrop-blur-lg border-2 border-pink-300/30">
            <div className="text-center">
              <div className="text-7xl mb-4">💕</div>
              <h3 className="text-3xl font-bold text-white mb-3">Dating Show Games</h3>
              <p className="text-white/90 mb-4">Get to know your match while competing</p>
              <div className="space-y-2 text-left">
                {datingShowGames.map(game => (
                  <div key={game.value} className="bg-white/10 rounded-lg p-3">
                    <p className="text-white font-semibold">{game.label}</p>
                    <p className="text-white/70 text-sm">{game.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-8 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-lg border-2 border-purple-300/30">
            <div className="text-center">
              <div className="text-7xl mb-4">🎮</div>
              <h3 className="text-3xl font-bold text-white mb-3">Classic Games</h3>
              <p className="text-white/90 mb-4">Compete in traditional games</p>
              <div className="space-y-2 text-left">
                {classicGames.map(game => (
                  <div key={game.value} className="bg-white/10 rounded-lg p-3">
                    <p className="text-white font-semibold">{game.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Create Tournament Button */}
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full mb-8 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white py-8 text-xl"
        >
          <Plus className="w-6 h-6 mr-2" />
          Create Couples Tournament
        </Button>

        {/* Create Tournament Form */}
        {showCreate && (
          <Card className="p-8 mb-8 bg-white/10 backdrop-blur-lg border border-white/20">
            <h2 className="text-3xl font-bold text-white mb-6">🎬 Create Your Dating Show Tournament</h2>
            
            <div className="space-y-6">
              {/* Tournament Name */}
              <div>
                <label className="block text-white font-semibold mb-2 text-lg">Tournament Name</label>
                <input
                  type="text"
                  value={newTournament.name}
                  onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                  placeholder="Love & Games: Summer Edition"
                  className="w-full px-4 py-3 border-2 border-white/20 rounded-lg bg-white/10 text-white placeholder-white/50 focus:border-pink-400 focus:outline-none"
                />
              </div>

              {/* Game Type */}
              <div>
                <label className="block text-white font-semibold mb-2 text-lg">Game Type</label>
                <select
                  value={newTournament.game_type}
                  onChange={(e) => setNewTournament({...newTournament, game_type: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-white/20 rounded-lg bg-white/10 text-white focus:border-pink-400 focus:outline-none"
                >
                  <optgroup label="💕 Dating Show Games">
                    {datingShowGames.map(game => (
                      <option key={game.value} value={game.value}>{game.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🎮 Classic Games">
                    {classicGames.map(game => (
                      <option key={game.value} value={game.value}>{game.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Tournament Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Number of Couples</label>
                  <select
                    value={newTournament.max_teams}
                    onChange={(e) => setNewTournament({...newTournament, max_teams: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 border-2 border-white/20 rounded-lg bg-white/10 text-white focus:border-pink-400 focus:outline-none"
                  >
                    <option value={2}>2 Couples (4 people)</option>
                    <option value={4}>4 Couples (8 people)</option>
                    <option value={8}>8 Couples (16 people)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Entry Fee (Credits)</label>
                  <input
                    type="number"
                    value={newTournament.entry_fee}
                    onChange={(e) => setNewTournament({...newTournament, entry_fee: parseInt(e.target.value)})}
                    placeholder="0"
                    className="w-full px-4 py-3 border-2 border-white/20 rounded-lg bg-white/10 text-white placeholder-white/50 focus:border-pink-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Prize */}
              <div>
                <label className="block text-white font-semibold mb-2 text-lg">Prize (Optional)</label>
                <input
                  type="text"
                  value={newTournament.prize}
                  onChange={(e) => setNewTournament({...newTournament, prize: e.target.value})}
                  placeholder="Dinner for two, Bragging rights, etc."
                  className="w-full px-4 py-3 border-2 border-white/20 rounded-lg bg-white/10 text-white placeholder-white/50 focus:border-pink-400 focus:outline-none"
                />
              </div>

              {/* Features */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTournament.allow_chat}
                    onChange={(e) => setNewTournament({...newTournament, allow_chat: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <span className="text-white font-semibold">
                    <MessageCircle className="w-5 h-5 inline mr-2" />
                    Enable Live Chat
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTournament.show_opponent_answers}
                    onChange={(e) => setNewTournament({...newTournament, show_opponent_answers: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <span className="text-white font-semibold">
                    <Sparkles className="w-5 h-5 inline mr-2" />
                    Show Opponent Answers (More Competitive)
                  </span>
                </label>
              </div>

              {/* Create Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => setShowCreate(false)}
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createTournament}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                >
                  Create Tournament
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Active Tournaments */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-6">Active Tournaments</h2>
          {loading ? (
            <p className="text-white text-center">Loading tournaments...</p>
          ) : tournaments.length === 0 ? (
            <Card className="p-12 bg-white/10 backdrop-blur-lg border border-white/20 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-white/50" />
              <p className="text-white text-xl">No active tournaments yet</p>
              <p className="text-white/70 mt-2">Be the first to create one!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map((tournament) => (
                <Card
                  key={tournament.tournament_id}
                  className="p-6 bg-white/10 backdrop-blur-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer"
                  onClick={() => navigate(`/tournament/${tournament.tournament_id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{tournament.name}</h3>
                      <p className="text-white/70 capitalize">{tournament.game_type?.replace('_', ' ') || 'Unknown Game'}</p>
                    </div>
                    <div className="text-right">
                      <Users className="w-6 h-6 text-white inline" />
                      <span className="text-white font-bold ml-2">
                        {tournament.teams.length}/{tournament.max_teams}
                      </span>
                    </div>
                  </div>

                  {tournament.prize && (
                    <div className="bg-yellow-500/20 rounded-lg p-3 mb-3">
                      <p className="text-yellow-200 font-semibold">🏆 Prize: {tournament.prize}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tournament.entry_fee > 0 ? (
                        <span className="flex items-center text-yellow-300 font-bold">
                          <Coins className="w-4 h-4 mr-1" />
                          {tournament.entry_fee} credits
                        </span>
                      ) : (
                        <span className="text-green-300 font-bold">FREE</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
