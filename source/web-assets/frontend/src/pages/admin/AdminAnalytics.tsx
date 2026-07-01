import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, TrendingUp, MessageCircle, DollarSign } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminAnalytics() {
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setErrorMessage('');
    try {
      const [userRes, engageRes] = await Promise.all([
        authFetch(`${API}/admin/analytics/users`),
        authFetch(`${API}/admin/analytics/engagement`),
      ]);

      if (userRes.ok) setUserAnalytics(await userRes.json());
      if (engageRes.ok) setEngagement(await engageRes.json());

      if (!userRes.ok && !engageRes.ok) {
        setErrorMessage(
          userRes.status === 403
            ? 'Admin access required.'
            : `Request failed (${userRes.status})`
        );
      }
    } catch (error) {
      setErrorMessage('Network error — could not reach the analytics API.');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">📈 Analytics Dashboard</h1>
        <p className="text-gray-400">Platform performance and metrics</p>
      </div>

      {errorMessage && (
        <Card className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6" data-testid="admin-analytics-error">
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Users</p>
              <h3 className="text-3xl font-bold text-white">{userAnalytics?.total_users?.toLocaleString() || 0}</h3>
            </div>
            <Users className="w-10 h-10 text-cyan-400" />
          </div>
        </Card>

        <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Users (7d)</p>
              <h3 className="text-3xl font-bold text-white">{userAnalytics?.active_users_7d?.toLocaleString() || 0}</h3>
            </div>
            <TrendingUp className="w-10 h-10 text-green-400" />
          </div>
        </Card>

        <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Messages Today</p>
              <h3 className="text-3xl font-bold text-white">{engagement?.messages?.today?.toLocaleString() || 0}</h3>
            </div>
            <MessageCircle className="w-10 h-10 text-purple-400" />
          </div>
        </Card>

        <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Matches Today</p>
              <h3 className="text-3xl font-bold text-white">{engagement?.matches?.today?.toLocaleString() || 0}</h3>
            </div>
            <DollarSign className="w-10 h-10 text-yellow-400" />
          </div>
        </Card>
      </div>

      <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Platform Metrics</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Messages</span>
              <span className="text-white font-bold">{engagement?.messages?.total?.toLocaleString() || 0}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: '75%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Total Matches</span>
              <span className="text-white font-bold">{engagement?.matches?.total?.toLocaleString() || 0}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
