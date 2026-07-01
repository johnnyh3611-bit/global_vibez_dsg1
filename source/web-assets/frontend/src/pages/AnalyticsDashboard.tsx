import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/stats/analytics/${userData.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center"><div className="text-cyan-400 text-xl">Loading Analytics...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-8">
          📊 Analytics Dashboard
        </h1>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Games</span>
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-3xl font-black text-white">{analytics?.total_games || 0}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Win Rate</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-black text-white">{analytics?.win_rate || 0}%</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Earnings</span>
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-black text-white">${analytics?.total_earnings || 0}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Active Streak</span>
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-black text-white">{analytics?.streak || 0} days</p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Games Played (Last 7 Days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.games_history || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                <Line type="monotone" dataKey="games" stroke="#06B6D4" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Earnings by Game Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.earnings_by_game || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="game" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }} />
                <Bar dataKey="earnings" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
