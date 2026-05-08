import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Zap, Calendar, Play, ChevronRight, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TournamentDetailsPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadTournament();
    // Auto-refresh every 5 seconds if tournament is live
    const interval = setInterval(() => {
      if (tournament?.status === 'in_progress') {
        loadTournament();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const response = await fetch(`${API}/api/tournaments/details/${tournamentId}`);
      const data = await response.json();

      if (data.success) {
        setTournament(data.tournament);
      }
    } catch (error) {
      // console.error('Error loading tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinTournament = async () => {
    setJoining(true);

    try {
      const response = await fetch(`${API}/api/tournaments/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          user_id: userId,
          skill_level: 50 // Default for now
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Successfully joined tournament!');
        loadTournament();
      } else {
        alert(data.message || 'Failed to join');
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error joining tournament');
    } finally {
      setJoining(false);
    }
  };

  const startTournament = async () => {
    if (!window.confirm('Start tournament and generate bracket?')) return;

    try {
      const response = await fetch(`${API}/api/tournaments/start/${tournamentId}?organizer_id=${userId}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert('Tournament started!');
        loadTournament();
      } else {
        alert(data.message || 'Failed to start');
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error starting tournament');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex items-center justify-center">
        <div className="text-white text-xl">Tournament not found</div>
      </div>
    );
  }

  const isParticipant = tournament.participants?.some(p => p.user_id === userId);
  const isOrganizer = tournament.organizer_id === userId;
  const canJoin = tournament.status === 'registration' && !isParticipant && tournament.current_players < tournament.max_players;
  const canStart = isOrganizer && tournament.status === 'registration' && tournament.current_players >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <motion.button
          onClick={() => navigate('/tournaments')}
          className="mb-6 px-4 py-2 bg-purple-600/20 border border-purple-500/50 rounded-lg text-white hover:bg-purple-600/30 flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Tournaments
        </motion.button>

        {/* Tournament Header */}
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 ${
                tournament.status === 'registration' ? 'bg-green-600 text-white' :
                tournament.status === 'in_progress' ? 'bg-orange-600 text-white' :
                'bg-gray-600 text-white'
              }`}>
                {tournament.status.replace('_', ' ').toUpperCase()}
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
              <p className="text-gray-400">{tournament.tournament_type.replace('_', ' ')}</p>
            </div>

            <div className="flex flex-col gap-2">
              {canJoin && (
                <motion.button
                  onClick={joinTournament}
                  disabled={joining}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-white disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {joining ? 'Joining...' : `Join Tournament (${tournament.entry_fee} XP)`}
                </motion.button>
              )}

              {canStart && (
                <motion.button
                  onClick={startTournament}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="inline w-6 h-6 mr-2" />
                  Start Tournament
                </motion.button>
              )}

              {isParticipant && (
                <div className="px-6 py-3 bg-cyan-600/20 border border-cyan-500/50 rounded-xl text-cyan-300 text-center">
                  ✅ You're registered!
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-purple-600/20 border border-purple-500/50 rounded-xl p-4">
              <Users className="w-6 h-6 text-purple-400 mb-2" />
              <div className="text-2xl font-bold text-white">{tournament.current_players}/{tournament.max_players}</div>
              <div className="text-sm text-gray-400">Players</div>
            </div>

            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-4">
              <Zap className="w-6 h-6 text-yellow-400 mb-2" />
              <div className="text-2xl font-bold text-white">{tournament.prize_pool}</div>
              <div className="text-sm text-gray-400">Prize Pool (XP)</div>
            </div>

            <div className="bg-cyan-600/20 border border-cyan-500/50 rounded-xl p-4">
              <Trophy className="w-6 h-6 text-cyan-400 mb-2" />
              <div className="text-2xl font-bold text-white">{tournament.current_round || 0}/{tournament.total_rounds || 0}</div>
              <div className="text-sm text-gray-400">Round</div>
            </div>

            <div className="bg-orange-600/20 border border-orange-500/50 rounded-xl p-4">
              <Calendar className="w-6 h-6 text-orange-400 mb-2" />
              <div className="text-sm font-bold text-white">
                {tournament.start_time ? new Date(tournament.start_time).toLocaleString() : 'TBD'}
              </div>
              <div className="text-sm text-gray-400">Start Time</div>
            </div>
          </div>
        </div>

        {/* Participants */}
        {tournament.participants && tournament.participants.length > 0 && (
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Participants ({tournament.participants.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tournament.participants.map((participant, idx) => (
                <div key={`participants-${idx}`} className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {participant.seed || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">{participant.username}</div>
                      <div className="text-xs text-gray-400">Skill: {participant.skill_level}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bracket */}
        {tournament.bracket && (
          <TournamentBracket bracket={tournament.bracket} tournamentId={tournamentId} />
        )}

        {/* Winner */}
        {tournament.winner_id && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-2 border-yellow-500 rounded-2xl p-8 text-center"
          >
            <Trophy className="w-20 h-20 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-4xl font-bold text-white mb-2">🏆 CHAMPION 🏆</h2>
            <p className="text-2xl text-yellow-300">{tournament.winner_id}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Bracket Component
function TournamentBracket({ bracket, tournamentId }) {
  if (!bracket || !bracket.matches) return null;

  // Group matches by round
  const matchesByRound = {};
  bracket.matches.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });

  const rounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-400" />
        Tournament Bracket
      </h2>

      <div className="overflow-x-auto">
        <div className="flex gap-8 min-w-max pb-4">
          {rounds.map(round => (
            <div key={round} className="flex-shrink-0">
              <div className="text-center mb-4">
                <div className="text-cyan-400 font-bold">Round {round}</div>
                <div className="text-gray-500 text-sm">{matchesByRound[round].length} matches</div>
              </div>

              <div className="space-y-4">
                {matchesByRound[round].map(match => (
                  <MatchCard key={match.match_id} match={match} tournamentId={tournamentId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Match Card Component
function MatchCard({ match, tournamentId }) {
  const [showReportModal, setShowReportModal] = useState(false);
  const userId = localStorage.getItem('user_id');
  const isParticipant = match.player1 === userId || match.player2 === userId;

  const getStatusColor = (status) => {
    const colors = {
      pending: 'border-gray-500 bg-gray-900/50',
      ready: 'border-yellow-500 bg-yellow-900/20',
      in_progress: 'border-orange-500 bg-orange-900/20',
      completed: 'border-green-500 bg-green-900/20'
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className={`border ${getStatusColor(match.status)} rounded-xl p-3 w-64`}>
      {/* Player 1 */}
      <div className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${
        match.winner === match.player1 ? 'bg-green-600/30 border border-green-500/50' : 'bg-purple-600/10'
      }`}>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500" />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">
            {match.player1 || 'BYE'}
          </div>
        </div>
        {match.winner === match.player1 && <Trophy className="w-4 h-4 text-yellow-400" />}
      </div>

      {/* VS Divider */}
      <div className="text-center text-xs text-gray-500 py-1">
        {match.status === 'completed' ? match.score || 'VS' : 'VS'}
      </div>

      {/* Player 2 */}
      <div className={`flex items-center gap-2 p-2 rounded-lg ${
        match.winner === match.player2 ? 'bg-green-600/30 border border-green-500/50' : 'bg-purple-600/10'
      }`}>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-orange-500" />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">
            {match.player2 || 'BYE'}
          </div>
        </div>
        {match.winner === match.player2 && <Trophy className="w-4 h-4 text-yellow-400" />}
      </div>

      {/* Report Result Button */}
      {isParticipant && match.status !== 'completed' && match.player1 && match.player2 && (
        <button
          onClick={() => setShowReportModal(true)}
          className="w-full mt-2 px-3 py-2 bg-cyan-600 rounded-lg text-white text-sm font-semibold hover:bg-cyan-700"
        >
          Report Result
        </button>
      )}

      {/* Status Badge */}
      <div className="mt-2 text-center">
        <span className={`text-xs px-2 py-1 rounded-full ${
          match.status === 'completed' ? 'bg-green-600 text-white' :
          match.status === 'in_progress' ? 'bg-orange-600 text-white' :
          match.status === 'ready' ? 'bg-yellow-600 text-white' :
          'bg-gray-600 text-white'
        }`}>
          {match.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {showReportModal && (
        <ReportResultModal
          match={match}
          tournamentId={tournamentId}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}

// Report Result Modal
function ReportResultModal({ match, tournamentId, onClose }) {
  const userId = localStorage.getItem('user_id');
  const [winner, setWinner] = useState('');
  const [score, setScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!winner) {
      alert('Please select a winner');
      return;
    }

    setSubmitting(true);

    try {
      const loser = winner === match.player1 ? match.player2 : match.player1;

      const response = await fetch(`${API}/api/tournaments/match/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          match_id: match.match_id,
          winner_id: winner,
          loser_id: loser,
          score: score || null,
          reported_by: userId
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Match result reported!');
        window.location.reload();
      } else {
        alert(data.message || 'Failed to report result');
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error reporting result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black/90 border border-cyan-500 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-4">Report Match Result</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-cyan-300 mb-2">Winner *</label>
            <select
              value={winner}
              onChange={(e) => setWinner(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-cyan-500/50 rounded-lg text-white"
            >
              <option value="">Select winner...</option>
              <option value={match.player1}>{match.player1}</option>
              <option value={match.player2}>{match.player2}</option>
            </select>
          </div>

          <div>
            <label className="block text-cyan-300 mb-2">Score (optional)</label>
            <input
              type="text"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g., 3-1"
              className="w-full px-4 py-2 bg-black border border-cyan-500/50 rounded-lg text-white"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-600 rounded-lg text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 bg-cyan-600 rounded-lg text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
