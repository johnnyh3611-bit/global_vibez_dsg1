import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Crown,
  Lock,
  Users,
  Sparkles,
  Plus,
  Search,
  Filter,
  Trophy,
  Zap,
  Globe,
  Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCESS_LEVELS = {
  public: { label: 'Public', icon: Globe, color: 'from-blue-500 to-cyan-500' },
  token_gated: { label: 'Vibez Coin Gated', icon: Lock, color: 'from-amber-500 to-yellow-500' },
  nft_gated: { label: 'NFT Gated', icon: Shield, color: 'from-purple-500 to-pink-500' },
  invite_only: { label: 'Invite Only', icon: Crown, color: 'from-red-500 to-orange-500' },
  whitelist: { label: 'Whitelist', icon: Sparkles, color: 'from-emerald-500 to-teal-500' }
};

const THEMES = {
  neon_palace: { name: 'Neon Palace', bg: 'from-purple-900/30 to-pink-900/30' },
  gold_rush: { name: 'Gold Rush', bg: 'from-amber-900/30 to-yellow-900/30' },
  cyber_lounge: { name: 'Cyber Lounge', bg: 'from-cyan-900/30 to-blue-900/30' },
  ethereal_garden: { name: 'Ethereal Garden', bg: 'from-emerald-900/30 to-green-900/30' },
  midnight_club: { name: 'Midnight Club', bg: 'from-slate-900/30 to-gray-900/30' }
};

const SuiteCard = ({ suite, onJoin, userBalance }) => {
  const accessConfig = ACCESS_LEVELS[suite.access_level] || ACCESS_LEVELS.public;
  const AccessIcon = accessConfig.icon;
  const themeConfig = THEMES[suite.theme] || THEMES.cyber_lounge;

  const playerCount = suite.current_players?.length || 0;
  const isFull = playerCount >= suite.max_players;

  // ₵-balance gate (frontend pre-check — backend still re-validates).
  const isTokenGated = suite.access_level === 'token_gated';
  const required = isTokenGated ? Number(suite.entry_requirement || 0) : 0;
  const shortfall = isTokenGated ? Math.max(0, required - (userBalance ?? 0)) : 0;
  const canAfford = !isTokenGated || shortfall === 0;
  const isBlocked = isFull || !canAfford;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`bg-gradient-to-br ${themeConfig.bg} backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-700/50 hover:border-amber-500/50 transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-2xl font-['Cinzel'] text-white mb-2">{suite.name}</h3>
          <p className="text-slate-300 text-sm line-clamp-2">{suite.description || 'No description'}</p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${accessConfig.color}`}>
          <AccessIcon className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Players</div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4" />
            {playerCount}/{suite.max_players}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Entry</div>
          <div className="text-lg font-bold text-amber-400 flex items-center gap-2">
            {suite.access_level === 'public' ? (
              'Free'
            ) : suite.access_level === 'nft_gated' ? (
              `NFT #${suite.entry_requirement}`
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {suite.entry_requirement}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {suite.available_games?.slice(0, 3).map((game) => (
          <span
            key={game}
            className="px-3 py-1 bg-slate-700/50 rounded-full text-xs text-slate-300 capitalize"
          >
            {game}
          </span>
        ))}
        {suite.enable_voice_chat && (
          <span className="px-3 py-1 bg-green-900/30 border border-green-500/30 rounded-full text-xs text-green-400">
            🎙️ Voice
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          by <span className="text-amber-400">{suite.owner_name}</span>
        </div>
        <Button
          onClick={() => onJoin(suite)}
          disabled={isBlocked}
          data-testid={`vibe-suite-join-${suite.suite_id}`}
          className={`${
            isBlocked
              ? !canAfford
                ? 'bg-amber-900/40 text-amber-300 border border-amber-500/40 cursor-not-allowed'
                : 'bg-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500'
          } text-white px-6`}
        >
          {isFull
            ? 'Full'
            : !canAfford
            ? `Need ₵${shortfall.toLocaleString()} more`
            : 'Join Suite'}
        </Button>
      </div>
      {isTokenGated && !canAfford && (
        <p
          className="mt-2 text-[10px] uppercase tracking-widest text-amber-300/80"
          data-testid={`vibe-suite-gate-${suite.suite_id}`}
        >
          Requires ₵{required.toLocaleString()} · You hold ₵
          {(userBalance ?? 0).toLocaleString()}
        </p>
      )}
    </motion.div>
  );
};

export default function VibeSuitesDiscovery() {
  const navigate = useNavigate();
  const [suites, setSuites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccess, setFilterAccess] = useState('');
  const [filterTheme, setFilterTheme] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    fetchSuites();
  }, [filterAccess, filterTheme]);

  // Fetch caller's ₵ balance once so the cards can pre-render their gates.
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${API}/api/vibe-suites/me/balance`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (r.ok) {
          const d = await r.json();
          setUserBalance(Number(d.token_balance || 0));
        }
      } catch {
        /* unauth → leave balance at 0, gates will show */
      }
    };
    fetchBalance();
  }, []);

  const fetchSuites = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAccess) params.append('access_level', filterAccess);
      if (filterTheme) params.append('theme', filterTheme);
      
      const response = await fetch(`${API}/api/vibe-suites/discover?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSuites(data.suites || []);
      }
    } catch (err) {
      console.error('Error fetching suites:', err);
      toast.error('Failed to load suites');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSuite = async (suite) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/vibe-suites/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suite_id: suite.suite_id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to join suite');
      }

      const data = await response.json();
      toast.success(data.message);
      navigate(`/vibe-suites/${suite.suite_id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filteredSuites = suites.filter((suite) =>
    suite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suite.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-['Cinzel'] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-purple-400 to-pink-400">
              Private Vibe Suites
            </h1>
            <Button
              onClick={() => navigate('/vibe-suites/create')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Suite
            </Button>
          </div>
          <p className="text-slate-300 text-lg">
            Exclusive Vibez-Coin-gated gaming rooms with premium features
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search
              </Label>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search suites..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Access Level
              </Label>
              <select
                value={filterAccess}
                onChange={(e) => setFilterAccess(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="">All Access Levels</option>
                {Object.entries(ACCESS_LEVELS).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Theme
              </Label>
              <select
                value={filterTheme}
                onChange={(e) => setFilterTheme(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="">All Themes</option>
                {Object.entries(THEMES).map(([key, config]) => (
                  <option key={key} value={key}>{config.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Suites Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-white text-2xl">Loading suites...</div>
          </div>
        ) : filteredSuites.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-20 h-20 text-slate-600 mx-auto mb-4" />
            <div className="text-white text-2xl mb-2">No suites found</div>
            <p className="text-slate-400 mb-6">Be the first to create a private suite!</p>
            <Button
              onClick={() => navigate('/vibe-suites/create')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3"
            >
              Create Your Suite
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuites.map((suite) => (
              <SuiteCard
                key={suite.suite_id}
                suite={suite}
                onJoin={handleJoinSuite}
                userBalance={userBalance}
              />
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/30">
            <Lock className="w-10 h-10 text-purple-400 mb-4" />
            <h3 className="text-xl font-['Cinzel'] text-white mb-2">Vibez Coin Gated</h3>
            <p className="text-slate-300 text-sm">
              Exclusive access with Vibez Coin requirements. Hold the required ₵ to enter premium suites.
            </p>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-2xl p-6 border border-cyan-500/30">
            <Users className="w-10 h-10 text-cyan-400 mb-4" />
            <h3 className="text-xl font-['Cinzel'] text-white mb-2">Multiplayer</h3>
            <p className="text-slate-300 text-sm">
              Play with up to 8 players simultaneously. Voice chat and video features available.
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-900/30 to-yellow-900/30 rounded-2xl p-6 border border-amber-500/30">
            <Crown className="w-10 h-10 text-amber-400 mb-4" />
            <h3 className="text-xl font-['Cinzel'] text-white mb-2">Your Rules</h3>
            <p className="text-slate-300 text-sm">
              Create custom suites with your own access rules, themes, and available games.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
