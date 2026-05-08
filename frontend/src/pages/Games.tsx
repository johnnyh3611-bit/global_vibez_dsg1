
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import AppFooter from '../components/AppFooter';

const API = process.env.REACT_APP_BACKEND_URL;

const GamesLobby = () => {
  const [games, setGames] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load available games
      const gamesRes = await fetch(`${API}/api/games/list`);
      if (gamesRes.ok) {
        const data = await gamesRes.json();
        setGames((Object.entries(data.games) as Array<[string, Record<string, any>]>).map(([key, value]) => ({
          id: key,
          ...value
        })));
      }

      // Load matches
      const matchesRes = await fetch(`${API}/api/matches`, {
        
      });
      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.matches || []);
      }

      // Load active games
      const activeRes = await fetch(`${API}/api/games/my-games/active`, {
        
      });
      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveGames(data.games || []);
      }
    } catch (error) {
      // console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async (matchId, gameType) => {
    try {
      const response = await fetch(`${API}/api/games/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ match_id: matchId, game_type: gameType }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/gameplay?id=${data.game_id}`);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to start game');
      }
    } catch (error) {
      // console.error('Error starting game:', error);
      alert('Failed to start game');
    }
  };

  const handleGameSelect = (game) => {
    if (!game.implemented) {
      alert('This game is coming soon! 🎮');
      return;
    }
    setSelectedGame(game);
  };

  const handleMatchSelect = (match) => {
    if (!selectedGame) {
      alert('Please select a game first');
      return;
    }
    setSelectedMatch(match);
    startGame(match.match_id, selectedGame.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
        <div className="text-2xl text-white">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4" style={{
            textShadow: '0 0 30px rgba(255,255,255,0.5)',
          }}>
            🎮 Game Center
          </h1>
          <p className="text-xl text-purple-200">
            Play with your match! Choose a game and challenge them.
          </p>
        </div>

        {/* Active Games */}
        {activeGames.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">🎯 Active Games</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGames.map((game) => (
                <Card
                  key={game.game_id}
                  className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer hover:scale-105"
                  style={{
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}
                  onClick={() => navigate(`/gameplay?id=${game.game_id}`)}
                >
                  <div className="p-6">
                    <div className="text-4xl mb-3">
                      {games.find(g => g.id === game.game_type)?.emoji || '🎮'}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {games.find(g => g.id === game.game_type)?.name || game.game_type}
                    </h3>
                    <p className="text-purple-200 mb-3">
                      vs {game.players.find(p => p.user_id !== game.current_turn)?.name}
                    </p>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      game.current_turn === game.players[0].user_id 
                        ? 'bg-green-500/30 text-green-200'
                        : 'bg-orange-500/30 text-orange-200'
                    }`}>
                      {game.current_turn === game.players[0].user_id ? 'Your Turn' : 'Their Turn'}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Social Games (Solo Play) */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">🤔 Social Games (Play Solo)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {games.filter(g => g.implemented && g.type === 'social').map((game) => (
              <Card
                key={game.id}
                className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-md border-yellow-400/30 hover:border-yellow-400/60 transition-all duration-300 cursor-pointer hover:scale-105"
                style={{
                  boxShadow: '0 8px 32px rgba(255, 200, 0, 0.3)',
                }}
                onClick={() => navigate(`/games/${game.id}`)}
              >
                <div className="p-6 text-center">
                  <div className="text-6xl mb-3 animate-bounce-slow">
                    {game.emoji}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {game.name}
                  </h3>
                  <p className="text-sm text-yellow-200 mb-3">
                    {game.description}
                  </p>
                  <Button
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold"
                  >
                    Play Now!
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Multiplayer Games */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">🎲 Multiplayer Games</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {games.filter(g => g.implemented && g.type !== 'social').map((game) => (
              <Card
                key={game.id}
                className={`bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer hover:scale-110 ${
                  selectedGame?.id === game.id ? 'ring-4 ring-purple-400 bg-white/30' : ''
                }`}
                style={{
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  perspective: '1000px',
                  transform: selectedGame?.id === game.id ? 'translateY(-10px)' : 'translateY(0)',
                }}
                onClick={() => handleGameSelect(game)}
              >
                <div className="p-6 text-center">
                  <div className="text-5xl mb-3 transition-transform duration-300 hover:scale-125">
                    {game.emoji}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {game.name}
                  </h3>
                  <p className="text-sm text-purple-200">
                    {game.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Select Match */}
        {selectedGame && (
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">
              👥 Play {selectedGame.name} with...
            </h2>
            {matches.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-md border-white/20 p-8 text-center">
                <p className="text-xl text-purple-200 mb-4">
                  No matches yet! 😔
                </p>
                <p className="text-purple-300 mb-6">
                  Go to Discover and start swiping to find your match
                </p>
                <Button
                  onClick={() => navigate('/discover')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Start Swiping
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => {
                  const opponent = match.user1 || match.user2;
                  return (
                    <Card
                      key={match.match_id}
                      className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer hover:scale-105"
                      style={{
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                      }}
                      onClick={() => handleMatchSelect(match)}
                    >
                      <div className="p-6 flex items-center space-x-4">
                        <img
                          src={opponent?.picture || '/default-avatar.png'}
                          alt={opponent?.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
                        />
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white">
                            {opponent?.name || 'Match'}
                          </h3>
                          <p className="text-purple-200 text-sm">
                            Click to start game
                          </p>
                        </div>
                        <div className="text-3xl">
                          {selectedGame.emoji}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Coming Soon Games */}
        {games.filter(g => !g.implemented).length > 0 && (
          <div className="mt-12 opacity-50">
            <h2 className="text-2xl font-bold text-white mb-6">🔜 Coming Soon</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {games.filter(g => !g.implemented).map((game) => (
                <div
                  key={game.id}
                  className="bg-white/5 backdrop-blur-md border-white/10 rounded-xl p-4 text-center"
                >
                  <div className="text-3xl mb-2">{game.emoji}</div>
                  <p className="text-sm text-purple-200">{game.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
      
      {/* Footer */}
      <AppFooter />
    </div>
  );
};

export default GamesLobby;
