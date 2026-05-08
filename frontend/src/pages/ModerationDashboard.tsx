/**
 * ModerationDashboard - AI-powered content moderation interface
 * Real-time queue for flagged content with quick action buttons
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Ban, MessageSquare, User, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

const ModerationDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, high, critical
  const [stats, setStats] = useState({
    total_flagged: 0,
    high_severity: 0,
    critical_severity: 0,
    auto_actions: 0
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchModerationQueue();
    // Refresh every 30 seconds
    const interval = setInterval(fetchModerationQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchModerationQueue = async () => {
    try {
      const response = await fetch(`${API_URL}/api/moderation/ai/moderation-queue`, {
      });

      if (!response.ok) throw new Error('Failed to fetch queue');

      const data = await response.json();
      setQueue(data.queue || []);
      
      // Calculate stats
      const high = data.queue.filter(item => item.result.severity === 'HIGH').length;
      const critical = data.queue.filter(item => item.result.severity === 'CRITICAL').length;
      
      setStats({
        total_flagged: data.total || 0,
        high_severity: high,
        critical_severity: critical,
        auto_actions: data.queue.filter(item => item.result.recommended_action !== 'ALLOW').length
      });
      
      setLoading(false);
    } catch (err) {
      // console.error('Failed to fetch moderation queue:', err);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      LOW: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
      MEDIUM: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
      HIGH: 'text-red-400 bg-red-400/10 border-red-400/30',
      CRITICAL: 'text-red-600 bg-red-600/20 border-red-600/50'
    };
    return colors[severity] || colors.LOW;
  };

  const getActionColor = (action) => {
    const colors = {
      ALLOW: 'text-green-400',
      WARN: 'text-yellow-400',
      MUTE: 'text-orange-400',
      BAN: 'text-red-400'
    };
    return colors[action] || 'text-white/60';
  };

  const filteredQueue = queue.filter(item => {
    if (filter === 'high') return item.result.severity === 'HIGH';
    if (filter === 'critical') return item.result.severity === 'CRITICAL';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-black text-white">AI Moderation Dashboard</h1>
          </div>
          <p className="text-white/60 text-sm">
            Claude Sonnet 4 powered content filtering • Auto-actions enabled
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <span className="text-3xl font-black text-white">{stats.total_flagged}</span>
            </div>
            <p className="text-white/60 text-sm">Total Flagged</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-red-400" />
              <span className="text-3xl font-black text-white">{stats.high_severity}</span>
            </div>
            <p className="text-white/60 text-sm">High Severity</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <Ban className="w-6 h-6 text-red-600" />
              <span className="text-3xl font-black text-white">{stats.critical_severity}</span>
            </div>
            <p className="text-white/60 text-sm">Critical</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <span className="text-3xl font-black text-white">{stats.auto_actions}</span>
            </div>
            <p className="text-white/60 text-sm">Auto-Actions</p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'high', 'critical'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Queue */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-white/60 py-12">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading moderation queue...</p>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center text-white/60 py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-bold text-white mb-2">All Clear!</p>
              <p>No flagged content in the queue.</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredQueue.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {item.type === 'ai_message_check' ? (
                        <MessageSquare className="w-6 h-6 text-cyan-400" />
                      ) : (
                        <User className="w-6 h-6 text-purple-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getSeverityColor(item.result.severity)}`}>
                              {item.result.severity}
                            </span>
                            <span className={`text-xs font-bold ${getActionColor(item.result.recommended_action)}`}>
                              {item.result.recommended_action}
                            </span>
                          </div>
                          <p className="text-white/60 text-xs">
                            User: {item.user_id} • {new Date(item.checked_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Flagged Content */}
                      <div className="bg-black/40 rounded-lg p-4 mb-3">
                        <p className="text-white text-sm mb-2 line-clamp-3">
                          "{item.content || item.display_name}"
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.result.categories.map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-1 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg text-xs"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* AI Explanation */}
                      <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 mb-3">
                        <p className="text-purple-300 text-xs italic">
                          "{item.result.explanation}"
                        </p>
                        <p className="text-purple-400/60 text-xs mt-1">
                          Confidence: {Math.round(item.result.confidence * 100)}%
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button className="flex-1 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 py-2 px-4 rounded-lg text-xs font-bold transition-all">
                          Approve
                        </button>
                        <button className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 py-2 px-4 rounded-lg text-xs font-bold transition-all">
                          Warn
                        </button>
                        <button className="flex-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 py-2 px-4 rounded-lg text-xs font-bold transition-all">
                          Ban
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModerationDashboard;
