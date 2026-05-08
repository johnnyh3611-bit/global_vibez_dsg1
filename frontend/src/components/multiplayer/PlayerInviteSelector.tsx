import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  UserPlus, 
  Check, 
  X,
  Users,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * PlayerInviteSelector - Select and invite players to your game
 * Shows online friends and recent players
 */

export default function PlayerInviteSelector({ 
  roomCode, 
  maxInvites = 3, 
  invitedPlayers = [],
  onInvite,
  onClose 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(null);

  useEffect(() => {
    fetchAvailablePlayers();
  }, []);

  const fetchAvailablePlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch online friends (you can modify this endpoint as needed)
      const response = await fetch(`${API}/api/friends/online`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Fallback: show mock data for demo
        setAvailablePlayers([
          { user_id: 'demo_1', username: 'Alice', is_online: true },
          { user_id: 'demo_2', username: 'Bob', is_online: true },
          { user_id: 'demo_3', username: 'Charlie', is_online: true },
          { user_id: 'demo_4', username: 'Diana', is_online: false },
          { user_id: 'demo_5', username: 'Eve', is_online: true }
        ]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setAvailablePlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast.error('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (player) => {
    if (invitedPlayers.length >= maxInvites) {
      toast.error(`Maximum ${maxInvites} invites allowed`);
      return;
    }

    setSendingInvite(player.user_id);
    
    try {
      await onInvite(player);
      toast.success(`Invited ${player.username}!`);
    } catch (error) {
      toast.error('Failed to send invite');
    } finally {
      setSendingInvite(null);
    }
  };

  const filteredPlayers = availablePlayers.filter(player => 
    player.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !invitedPlayers.includes(player.user_id)
  );

  const invitesLeft = maxInvites - invitedPlayers.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl" />

          {/* Main card */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border-2 border-blue-500/50 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 border-b border-blue-500/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-['Cinzel'] text-blue-400 flex items-center gap-2">
                  <UserPlus className="w-7 h-7" />
                  Invite Players
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-400">
                  {invitesLeft} invite{invitesLeft !== 1 ? 's' : ''} remaining
                </div>
                <div className="flex items-center gap-2 text-blue-300">
                  <Users className="w-4 h-4" />
                  {availablePlayers.filter(p => p.is_online).length} online
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-600 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Player list */}
            <div className="overflow-y-auto max-h-[400px] p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No players found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPlayers.map((player) => (
                    <motion.div
                      key={player.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-semibold flex items-center gap-2">
                            {player.username}
                            {player.is_online && (
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {player.is_online ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleInvite(player)}
                        disabled={!player.is_online || sendingInvite === player.user_id || invitesLeft === 0}
                        size="sm"
                        className={`${
                          player.is_online && invitesLeft > 0
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
                            : 'bg-slate-600'
                        } text-white`}
                      >
                        {sendingInvite === player.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Invite
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-700">
              <Button
                onClick={onClose}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Done
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
