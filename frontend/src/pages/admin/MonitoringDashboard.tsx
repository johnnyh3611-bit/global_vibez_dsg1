
import React, { useState, useEffect } from 'react';
import { Activity, Users, TrendingUp, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      
      const [metricsRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/api/monitoring/system-health`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/monitoring/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const metricsData = await metricsRes.json();
      const alertsData = await alertsRes.json();

      setMetrics(metricsData);
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      // // console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Monitoring Dashboard...</div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    if (status === 'healthy') return 'text-green-400';
    if (status === 'warning') return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    return <AlertTriangle className="w-5 h-5 text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              System Monitoring
            </h1>
            <p className="text-gray-300">Real-time platform health & performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-400 animate-pulse" />
            <span className="text-green-400 font-bold">LIVE</span>
          </div>
        </div>

        {/* System Health Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">System Status</span>
              {getStatusIcon(metrics?.overall_status)}
            </div>
            <p className={`text-2xl font-bold ${getStatusColor(metrics?.overall_status)}`}>
              {metrics?.overall_status?.toUpperCase() || 'UNKNOWN'}
            </p>
          </Card>

          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Active Users</span>
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white">{metrics?.active_users || 0}</p>
            <p className="text-xs text-gray-400">Last 15 min</p>
          </Card>

          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Response Time</span>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-white">{metrics?.avg_response_time || 0}ms</p>
            <p className="text-xs text-gray-400">Average</p>
          </Card>

          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Error Rate</span>
              <TrendingUp className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-white">{metrics?.error_rate || 0}%</p>
            <p className="text-xs text-gray-400">Last hour</p>
          </Card>
        </div>

        {/* Performance Metrics */}
        <Card className="bg-gray-800/50 border-gray-600 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Performance Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics?.performance_history || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Line type="monotone" dataKey="response_time" stroke="#06B6D4" strokeWidth={2} />
              <Line type="monotone" dataKey="active_users" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Service Status */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Service Status</h2>
            <div className="space-y-3">
              {(metrics?.services || []).map((service, idx) => (
                <div key={`admin-${idx}-${service?.name || idx}`} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <span className="text-white font-semibold">{service.name}</span>
                  </div>
                  <span className={`text-sm ${getStatusColor(service.status)}`}>
                    {service.uptime || '0%'} uptime
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Database Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Connection Pool</span>
                <span className="text-white font-semibold">{metrics?.db_connections || 0}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Query Time (avg)</span>
                <span className="text-white font-semibold">{metrics?.db_query_time || 0}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Storage Used</span>
                <span className="text-white font-semibold">{metrics?.db_storage_used || 0}GB</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-cyan-500 h-2 rounded-full transition-all"
                  style={{ width: `${metrics?.db_storage_percent || 0}%` }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Active Alerts */}
        <Card className="bg-gray-800/50 border-gray-600 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Active Alerts</h2>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-400">No active alerts - All systems operational</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div 
                  key={`alert-${idx}-${alert?.id || idx}`}
                  className={`flex items-start gap-4 p-4 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-red-500/20 border border-red-500' :
                    alert.severity === 'warning' ? 'bg-yellow-500/20 border border-yellow-500' :
                    'bg-blue-500/20 border border-blue-500'
                  }`}
                >
                  <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${
                    alert.severity === 'critical' ? 'text-red-400' :
                    alert.severity === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`} />
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-1">{alert.message}</p>
                    <p className="text-gray-400 text-sm">{alert.details}</p>
                    <p className="text-gray-500 text-xs mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
