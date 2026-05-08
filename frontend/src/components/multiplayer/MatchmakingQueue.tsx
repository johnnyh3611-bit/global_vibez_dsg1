import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Users, Zap, Loader2, Clock, TrendingUp } from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * MatchmakingQueue - Quick Match system
 * Auto-finds 3 other players for 4-player games
 */

export default function MatchmakingQueue({ 
  gameName = 'Bid Whist',
  gameType = 'bid_whist',
  onCancel 
}) {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [queueStatus, setQueueStatus] = useState('idle'); // idle, searching, matched
  const [position, setPosition] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(null);
  const [matchedPlayers, setMatchedPlayers] = useState([]);

  useEffect(() => {
    const newSocket = io(API, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket']
    });

    newSocket.on('connect', () => {
      console.log('Matchmaking socket connected');
      setSocket(newSocket);
      
      // Join queue automatically
      joinQueue(newSocket);
    });

    newSocket.on('queue_joined', (data) => {
      setQueueStatus('searching');
      setPosition(data.position);
      setEstimatedWait(data.estimated_wait);
    });

    newSocket.on('match_found', (data) => {
      setQueueStatus('matched');
      setMatchedPlayers(data.players);
      
      // Navigate to game directly (for quick testing)
      setTimeout(() => {
        const gameId = `match_${data.room_code}`;
        navigate(`/bid-whist/${gameId}`);
      }, 2000);
    });

    newSocket.on('matchmaking_error', (data) => {
      console.error('Matchmaking error:', data.message);
      setQueueStatus('error');
    });

    return () => {
      if (newSocket) {
        newSocket.emit('leave_queue', {});
        newSocket.disconnect();
      }
    };
  }, []);

  const joinQueue = (sock) => {
    const userId = localStorage.getItem('user_id') || 'demo_user';
    const playerName = localStorage.getItem('username') || 'Player';

    sock.emit('join_queue', {
      user_id: userId,
      player_name: playerName,
      game_type: gameType,
      mode: 'quick_match',
      elo_rating: 1000,
      wager: 0
    });
  };

  const handleCancel = () => {
    if (socket) {
      socket.emit('leave_queue', {});
      socket.disconnect();
    }
    onCancel();
  };

  const formatTime = (seconds) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" data-testid="matchmaking-modal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-md w-full mx-4"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 blur-3xl rounded-3xl" />

        {/* Main card */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border-2 border-blue-500/50 shadow-2xl p-8">
          
          {queueStatus === 'searching' && (
            <>
              {/* Searching Animation */}
              <div className="text-center mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                >
                  <Users className="w-12 h-12 text-white" />
                </motion.div>
                
                <h2 className="text-3xl font-['Cinzel'] text-blue-400 mb-2" data-testid="finding-players-text">
                  Finding Players...
                </h2>
                <p className="text-slate-400 text-sm">
                  Looking for 3 other {gameName} players
                </p>
              </div>

              {/* Queue Info */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6 space-y-3" data-testid="queue-info">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Position in Queue</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-400" data-testid="queue-position">#{position}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Estimated Wait</span>
                  </div>
                  <span className="text-xl font-bold text-purple-400" data-testid="estimated-wait">{formatTime(estimatedWait)}</span>
                </div>
              </div>

              {/* Loading dots */}
              <div className="flex justify-center gap-2 mb-6">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    className="w-3 h-3 bg-blue-400 rounded-full"
                  />
                ))}
              </div>

              {/* Cancel Button */}
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-900/20"
                data-testid="cancel-search-button"
              >
                Cancel Search
              </Button>
            </>
          )}

          {queueStatus === 'matched' && (
            <>
              {/* Match Found */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center"
                >
                  <Zap className="w-12 h-12 text-white" />
                </motion.div>
                
                <h2 className="text-3xl font-['Cinzel'] text-green-400 mb-2">
                  Match Found!
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  Entering game room...
                </p>

                {/* Matched Players */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                  <div className="text-sm text-slate-400 mb-2">Players:</div>
                  <div className="space-y-2">
                    {matchedPlayers.map((player, idx) => (
                      <div key={`player-${player}-${idx}`} className="flex items-center gap-2 text-white">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <span>{player}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-400" />
              </div>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}
