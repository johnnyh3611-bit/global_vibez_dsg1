import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Crown, Sparkles, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const ACCESS_LEVELS = [
  { value: 'public', label: 'Public', description: 'Anyone can join' },
  { value: 'token_gated', label: 'Vibez Coin Gated', description: 'Requires X Vibez Coins' },
  { value: 'nft_gated', label: 'NFT Gated', description: 'Requires specific NFT' },
  { value: 'invite_only', label: 'Invite Only', description: 'Owner approval required' },
  { value: 'whitelist', label: 'Whitelist', description: 'Pre-approved addresses' }
];

const THEMES = [
  { value: 'neon_palace', label: 'Neon Palace', gradient: 'from-purple-600 to-pink-600' },
  { value: 'gold_rush', label: 'Gold Rush', gradient: 'from-amber-600 to-yellow-600' },
  { value: 'cyber_lounge', label: 'Cyber Lounge', gradient: 'from-cyan-600 to-blue-600' },
  { value: 'ethereal_garden', label: 'Ethereal Garden', gradient: 'from-emerald-600 to-teal-600' },
  { value: 'midnight_club', label: 'Midnight Club', gradient: 'from-slate-700 to-gray-700' }
];

const GAMES = [
  { id: 'blackjack', name: 'Blackjack' },
  { id: 'baccarat', name: 'Baccarat' },
  { id: 'poker', name: 'Poker' },
  { id: 'bid_whist', name: 'Bid Whist' },
  { id: 'roulette', name: 'Roulette' },
  { id: 'slots', name: 'Slots' }
];

export default function CreateVibeSuite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    access_level: 'token_gated',
    entry_requirement: 500,
    theme: 'cyber_lounge',
    max_players: 8,
    available_games: ['blackjack', 'baccarat'],
    enable_voice_chat: true,
    enable_video_chat: false,
    is_permanent: false
  });

  const handleGameToggle = (gameId) => {
    if (formData.available_games.includes(gameId)) {
      setFormData({
        ...formData,
        available_games: formData.available_games.filter(g => g !== gameId)
      });
    } else {
      setFormData({
        ...formData,
        available_games: [...formData.available_games, gameId]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Please enter a suite name');
      return;
    }
    
    if (formData.available_games.length === 0) {
      toast.error('Please select at least one game');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/vibe-suites/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create suite');
      }

      const data = await response.json();
      toast.success(data.message);
      navigate(`/vibe-suites/${data.suite_id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/vibe-suites')}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Discovery
          </Button>
          <h1 className="text-5xl font-['Cinzel'] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-purple-400 to-pink-400 mb-2">
            Create Vibe Suite
          </h1>
          <p className="text-slate-300">
            Design your exclusive gaming room with custom access rules
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-['Cinzel'] text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400" />
              Basic Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2">Suite Name *</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Diamond VIP Lounge"
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>

              <div>
                <Label className="text-white mb-2">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your suite..."
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Access Control */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-['Cinzel'] text-white mb-4 flex items-center gap-2">
              <Crown className="w-6 h-6 text-purple-400" />
              Access Control
            </h2>

            <div className="space-y-4">
              <div>
                <Label className="text-white mb-3">Access Level</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ACCESS_LEVELS.map((level) => (
                    <motion.button
                      key={level.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, access_level: level.value })}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        formData.access_level === level.value
                          ? 'border-purple-500 bg-purple-900/30'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-bold mb-1">{level.label}</div>
                          <div className="text-xs text-slate-400">{level.description}</div>
                        </div>
                        {formData.access_level === level.value && (
                          <Check className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {(formData.access_level === 'token_gated' || formData.access_level === 'nft_gated') && (
                <div>
                  <Label className="text-white mb-2">
                    {formData.access_level === 'token_gated' ? 'Required Vibez Coins' : 'NFT ID'}
                  </Label>
                  <Input
                    type="number"
                    value={formData.entry_requirement}
                    onChange={(e) => setFormData({ ...formData, entry_requirement: parseInt(e.target.value) || 0 })}
                    placeholder={formData.access_level === 'token_gated' ? '500' : 'NFT ID'}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Theme and Settings */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-['Cinzel'] text-white mb-4">Theme & Settings</h2>

            <div className="space-y-4">
              <div>
                <Label className="text-white mb-3">Suite Theme</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {THEMES.map((theme) => (
                    <motion.button
                      key={theme.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, theme: theme.value })}
                      whileHover={{ scale: 1.05 }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.theme === theme.value
                          ? 'border-amber-500'
                          : 'border-slate-700'
                      }`}
                    >
                      <div className={`h-16 rounded-lg bg-gradient-to-br ${theme.gradient} mb-2`} />
                      <div className="text-white text-sm font-bold">{theme.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-white mb-2">Max Players</Label>
                <Input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.max_players}
                  onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) || 8 })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Available Games */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-['Cinzel'] text-white mb-4">Available Games *</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GAMES.map((game) => (
                <motion.button
                  key={game.id}
                  type="button"
                  onClick={() => handleGameToggle(game.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.available_games.includes(game.id)
                      ? 'border-green-500 bg-green-900/30'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-white font-bold">{game.name}</div>
                    {formData.available_games.includes(game.id) && (
                      <Check className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-['Cinzel'] text-white mb-4">Features</h2>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_voice_chat}
                  onChange={(e) => setFormData({ ...formData, enable_voice_chat: e.target.checked })}
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-white font-bold">Enable Voice Chat</div>
                  <div className="text-xs text-slate-400">Players can communicate via voice</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_video_chat}
                  onChange={(e) => setFormData({ ...formData, enable_video_chat: e.target.checked })}
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-white font-bold">Enable Video Chat</div>
                  <div className="text-xs text-slate-400">Players can see each other via webcam</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_permanent}
                  onChange={(e) => setFormData({ ...formData, is_permanent: e.target.checked })}
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-white font-bold">Permanent Suite</div>
                  <div className="text-xs text-slate-400">Keep suite active indefinitely (default: 24 hours)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 py-6 text-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              {loading ? 'Creating Suite...' : 'Create Vibe Suite'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
