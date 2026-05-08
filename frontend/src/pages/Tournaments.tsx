import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Users, Calendar, DollarSign, Plus, ArrowRight, Coins, AlertCircle } from 'lucide-react';
import AppFooter from '@/components/AppFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Tournaments() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [newTournament, setNewTournament] = useState({
    name: '',
    game_type: 'partner_quiz',
    tournament_type: 'couples',  // 'couples' or 'friends'
    max_teams: 2,  // For couples: 2 teams = 4 people
    team_size: 2,
    entry_fee: 0,
    prize: '',
    allow_chat: true,
    show_opponent_answers: false
  });

  useEffect(() => {
    fetchTournaments();
    fetchUserCredits();
  }, []);

  const fetchUserCredits = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
      });
      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits_balance || 0);
      }
    } catch (error) {
      // console.error('Error fetching user credits:', error);
    }
  };

  const handleJoinClick = (tournament, e) => {
    e.stopPropagation(); // Prevent card click navigation
    setSelectedTournament(tournament);
    setShowJoinModal(true);
  };

  const confirmJoin = async () => {
    if (!selectedTournament) return;

    // Check if user has enough credits
    if (selectedTournament.entry_fee > userCredits) {
      alert('Insufficient credits! Please purchase more credits.');
      navigate('/pricing');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tournaments/${selectedTournament.tournament_id}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Successfully joined tournament!');
        setShowJoinModal(false);
        setUserCredits(prev => prev - selectedTournament.entry_fee);
        fetchTournaments(); // Refresh list
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to join tournament');
      }
    } catch (error) {
      // console.error('Error joining tournament:', error);
      alert('Failed to join tournament');
    }
  };

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
        const data = await response.json();
        alert('Tournament created!');
        navigate(`/tournament/${data.tournament_id}`);
      }
    } catch (error) {
      // console.error('Error creating tournament:', error);
    }
  };

  const gameTypes = [
    { value: 'tictactoe', label: 'Tic-Tac-Toe' },
    { value: 'connect4', label: 'Connect 4' },
    { value: 'uno', label: 'UNO' },
    { value: 'chess', label: 'Chess' },
    { value: 'checkers', label: 'Checkers' },
    { value: 'poker', label: 'Poker' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 pb-20">
      {/* Join Confirmation Modal */}
      {showJoinModal && selectedTournament && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6 bg-white">
            <h2 className="text-2xl font-bold mb-4">Confirm Tournament Entry</h2>
            
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-lg mb-2">{selectedTournament.name}</h3>
              <p className="text-sm text-gray-600 mb-3 capitalize">{selectedTournament.game_type}</p>
              
              <div className="space-y-2">
                {selectedTournament.entry_fee > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Entry Fee:</span>
                      <span className="font-bold text-orange-600 flex items-center">
                        <Coins className="w-4 h-4 mr-1" />
                        {selectedTournament.entry_fee} credits
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Your Balance:</span>
                      <span className={`font-bold ${userCredits >= selectedTournament.entry_fee ? 'text-green-600' : 'text-red-600'}`}>
                        <Coins className="w-4 h-4 mr-1 inline" />
                        {userCredits} credits
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="font-semibold">After Entry:</span>
                      <span className="font-bold text-gray-900">
                        <Coins className="w-4 h-4 mr-1 inline" />
                        {userCredits - selectedTournament.entry_fee} credits
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-green-600 font-semibold">Free Entry!</p>
                  </div>
                )}
              </div>
            </div>

            {userCredits < selectedTournament.entry_fee && selectedTournament.entry_fee > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 font-semibold">Insufficient Credits</p>
                  <p className="text-xs text-red-600">You need {selectedTournament.entry_fee - userCredits} more credits to join.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => setShowJoinModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              {userCredits >= selectedTournament.entry_fee || selectedTournament.entry_fee === 0 ? (
                <Button
                  onClick={confirmJoin}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700"
                >
                  Confirm & Join
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowJoinModal(false);
                    navigate('/pricing');
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                >
                  Buy Credits
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8" />
              <div>
                <h1 className="text-3xl font-bold">Tournaments</h1>
                <p className="text-amber-100">Choose your tournament type</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Tournament Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Card
            className="p-12 bg-gradient-to-br from-pink-500/20 to-red-500/20 backdrop-blur-lg border-2 border-pink-300/30 cursor-pointer hover:scale-105 transition-all"
            onClick={() => navigate('/couples-tournaments')}
          >
            <div className="text-center">
              <div className="text-8xl mb-6">💕</div>
              <h2 className="text-4xl font-bold text-white mb-4">Couples Tournaments</h2>
              <p className="text-white/90 text-xl mb-6">Dating show-style games where couples compete and connect</p>
              <div className="space-y-3 mb-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">💕 Partner Quiz</p>
                  <p className="text-white/70 text-sm">How well do you know each other?</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">❤️ Compatibility Challenge</p>
                  <p className="text-white/70 text-sm">See if you think alike</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">🎯 Couples Trivia</p>
                  <p className="text-white/70 text-sm">Dating & relationship trivia</p>
                </div>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-lg py-6"
              >
                Enter Couples Tournaments →
              </Button>
            </div>
          </Card>

          <Card
            className="p-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg border-2 border-blue-300/30 cursor-pointer hover:scale-105 transition-all"
            onClick={() => navigate('/friends-tournaments')}
          >
            <div className="text-center">
              <div className="text-8xl mb-6">👥</div>
              <h2 className="text-4xl font-bold text-white mb-4">Friends Tournaments</h2>
              <p className="text-white/90 text-xl mb-6">Team up with friends for epic competitions</p>
              <div className="space-y-3 mb-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">🎮 Classic Games</p>
                  <p className="text-white/70 text-sm">Chess, UNO, Connect 4, and more</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">⚡ Team Challenges</p>
                  <p className="text-white/70 text-sm">Collaborate and compete</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold">🧠 Trivia Battles</p>
                  <p className="text-white/70 text-sm">Test your knowledge</p>
                </div>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg py-6"
              >
                Enter Friends Tournaments →
              </Button>
            </div>
          </Card>
        </div>

        {/* Create Tournament Button */}
        <div className="mb-8">
          <Button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-gradient-to-r from-amber-600 to-orange-600 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Tournament
          </Button>
        </div>

        {/* Create Tournament Form */}
        {showCreate && (
          <Card className="p-6 mb-8 border-amber-200">
            <h2 className="text-2xl font-bold mb-4">Create New Tournament</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={newTournament.name}
                  onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                  placeholder="Summer Champions 2026"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Game Type</label>
                <select
                  value={newTournament.game_type}
                  onChange={(e) => setNewTournament({...newTournament, game_type: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {gameTypes.map(game => (
                    <option key={game.value} value={game.value}>{game.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Teams</label>
                <select
                  value={newTournament.max_teams}
                  onChange={(e) => setNewTournament({...newTournament, max_teams: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value={4}>4 Teams</option>
                  <option value={8}>8 Teams</option>
                  <option value={16}>16 Teams</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Entry Fee (Credits)</label>
                <input
                  type="number"
                  value={newTournament.entry_fee}
                  onChange={(e) => setNewTournament({...newTournament, entry_fee: parseInt(e.target.value)})}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Prize Description</label>
                <input
                  type="text"
                  value={newTournament.prize}
                  onChange={(e) => setNewTournament({...newTournament, prize: e.target.value})}
                  placeholder="Winners get 100 credits!"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex space-x-2 mt-4">
              <Button onClick={createTournament} className="bg-amber-600 text-white">
                Create Tournament
              </Button>
              <Button onClick={() => setShowCreate(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Tournaments List */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Open Tournaments</h2>
          {loading ? (
            <div className="text-center py-12">Loading tournaments...</div>
          ) : tournaments.length === 0 ? (
            <Card className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
              <p className="text-gray-600 mb-6">Be the first to create a tournament!</p>
              <Button onClick={() => setShowCreate(true)} className="bg-amber-600 text-white">
                Create Tournament
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {tournaments.map(tournament => (
                <Card key={tournament.tournament_id} className="p-6 hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => navigate(`/tournament/${tournament.tournament_id}`)}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
                      <p className="text-sm text-gray-600 capitalize">{tournament.game_type}</p>
                    </div>
                    <Trophy className="w-8 h-8 text-amber-600" />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {tournament.teams.length} / {tournament.max_teams} teams registered
                    </div>
                    
                    {tournament.entry_fee > 0 && (
                      <div className="flex items-center text-sm font-bold text-orange-600">
                        <Coins className="w-5 h-5 mr-2" />
                        Entry Fee: {tournament.entry_fee} credits
                      </div>
                    )}

                    {tournament.prize && (
                      <div className="flex items-center text-sm font-semibold text-amber-600">
                        <Trophy className="w-4 h-4 mr-2" />
                        {tournament.prize}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Created {new Date(tournament.created_at).toLocaleDateString()}
                    </span>
                    <Button 
                      size="sm" 
                      className="bg-amber-600 text-white hover:bg-amber-700"
                      onClick={(e) => handleJoinClick(tournament, e)}
                    >
                      Join <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <AppFooter />
    </div>
  );
}
