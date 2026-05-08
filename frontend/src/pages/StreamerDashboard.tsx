import React, { useState, useEffect } from 'react';
import { Play, Square, DollarSign, Gift, Eye, TrendingUp, Users, Calendar } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StreamerDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingStream, setStartingStream] = useState(false);
  const [streamForm, setStreamForm] = useState({
    title: '',
    description: '',
    category: 'gaming'
  });

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000); // Refresh every 5s when live
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/streaming/dashboard`, {
      });

      const data = await response.json();
      setDashboard(data);
      setIsStreaming(data.is_streaming || false);
    } catch (error) {
      // console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStream = async () => {
    if (!streamForm.title.trim()) {
      alert('Please enter a stream title');
      return;
    }

    setStartingStream(true);

    try {
      const response = await fetch(`${API_URL}/api/streaming/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(streamForm)
      });

      const data = await response.json();

      if (data.success) {
        alert('🎬 Stream started! You are now live!');
        setIsStreaming(true);
        fetchDashboard();
      } else {
        throw new Error(data.message || 'Failed to start stream');
      }
    } catch (error) {
      alert('Failed to start stream: ' + error.message);
    } finally {
      setStartingStream(false);
    }
  };

  const handleEndStream = async () => {
    if (!dashboard?.current_stream_id) return;

    try {
      const response = await fetch(`${API_URL}/api/streaming/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ stream_id: dashboard.current_stream_id })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Stream ended!\n\nDuration: ${Math.round(data.stats.duration_seconds / 60)} minutes\nViewers: ${data.stats.viewers}\nGifts: ${data.stats.gifts_received}\nEarnings: $${data.stats.earnings.toFixed(2)}`);
        setIsStreaming(false);
        fetchDashboard();
      } else {
        throw new Error(data.message || 'Failed to end stream');
      }
    } catch (error) {
      alert('Failed to end stream: ' + error.message);
    }
  };

  const handleRequestPayout = async () => {
    if (!dashboard || dashboard.streamer_earnings < 100) {
      alert('Minimum payout is $100 USD');
      return;
    }

    if (!window.confirm(`Request payout of $${dashboard.streamer_earnings.toFixed(2)}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/streaming/payout/request`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Payout requested!\n\nAmount: $${data.amount.toFixed(2)}\nProcessing time: 3-5 business days`);
        fetchDashboard();
      } else {
        throw new Error(data.message || 'Failed to request payout');
      }
    } catch (error) {
      alert('Failed to request payout: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-cyan-400" />
            <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              Streamer Dashboard
            </h1>
          </div>
          <p className="text-gray-300">Manage your streams & track earnings</p>
        </div>

        {/* Streaming Status */}
        {isStreaming ? (
          <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 border-2 border-red-500 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-3xl font-black text-white">YOU ARE LIVE!</h2>
                </div>
                <p className="text-gray-300">Your stream is currently broadcasting</p>
              </div>

              <button
                onClick={handleEndStream}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-4 rounded-xl transition-all flex items-center gap-2"
              >
                <Square className="w-5 h-5" />
                End Stream
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-600 rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Start New Stream</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-gray-300 text-sm font-semibold mb-2 block">Stream Title *</label>
                <input
                  type="text"
                  value={streamForm.title}
                  onChange={(e) => setStreamForm({ ...streamForm, title: e.target.value })}
                  placeholder="e.g., High Stakes Poker Night 🎰"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm font-semibold mb-2 block">Description (optional)</label>
                <textarea
                  value={streamForm.description}
                  onChange={(e) => setStreamForm({ ...streamForm, description: e.target.value })}
                  placeholder="Tell viewers what you're streaming..."
                  rows={3}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm font-semibold mb-2 block">Category</label>
                <select
                  value={streamForm.category}
                  onChange={(e) => setStreamForm({ ...streamForm, category: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="gaming">🎮 Gaming</option>
                  <option value="dating">💙 Dating</option>
                  <option value="social">👥 Social</option>
                  <option value="tournaments">🏆 Tournaments</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleStartStream}
              disabled={startingStream || !streamForm.title}
              className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {startingStream ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  Go Live
                </>
              )}
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-900/30 border border-green-500 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-green-400" />
              <span className="text-gray-400 text-sm font-semibold">Total Earnings</span>
            </div>
            <div className="text-4xl font-black text-white">
              ${dashboard?.streamer_earnings?.toFixed(2) || '0.00'}
            </div>
            <div className="text-green-400 text-xs mt-1">
              70% of gifts received
            </div>
          </div>

          <div className="bg-purple-900/30 border border-purple-500 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-8 h-8 text-purple-400" />
              <span className="text-gray-400 text-sm font-semibold">Gifts Received</span>
            </div>
            <div className="text-4xl font-black text-white">
              {dashboard?.total_gifts_received || 0}
            </div>
            <div className="text-purple-400 text-xs mt-1">
              All-time total
            </div>
          </div>

          <div className="bg-cyan-900/30 border border-cyan-500 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-8 h-8 text-cyan-400" />
              <span className="text-gray-400 text-sm font-semibold">Total Viewers</span>
            </div>
            <div className="text-4xl font-black text-white">
              {dashboard?.total_viewers || 0}
            </div>
            <div className="text-cyan-400 text-xs mt-1">
              Across all streams
            </div>
          </div>

          <div className="bg-orange-900/30 border border-orange-500 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-orange-400" />
              <span className="text-gray-400 text-sm font-semibold">Total Streams</span>
            </div>
            <div className="text-4xl font-black text-white">
              {dashboard?.total_streams || 0}
            </div>
            <div className="text-orange-400 text-xs mt-1">
              Lifetime count
            </div>
          </div>
        </div>

        {/* Payout Section */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-green-900/30 border border-yellow-500 rounded-2xl p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-yellow-400" />
                Payout Center
              </h3>
              <p className="text-gray-300 mb-4">
                Minimum withdrawal: <span className="font-bold text-yellow-400">$100.00 USD</span>
              </p>
              <div className="text-sm text-gray-400">
                <p>• Platform commission: 30% (already deducted)</p>
                <p>• Processing time: 3-5 business days</p>
                <p>• Current balance: <span className="text-white font-bold">${dashboard?.streamer_earnings?.toFixed(2) || '0.00'}</span></p>
              </div>
            </div>

            <button
              onClick={handleRequestPayout}
              disabled={!dashboard?.can_withdraw}
              className={`px-8 py-4 rounded-xl font-bold transition-all ${
                dashboard?.can_withdraw
                  ? 'bg-gradient-to-r from-yellow-500 to-green-500 hover:from-yellow-400 hover:to-green-400 text-black'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {dashboard?.can_withdraw ? 'Request Payout' : 'Insufficient Balance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamerDashboard;
