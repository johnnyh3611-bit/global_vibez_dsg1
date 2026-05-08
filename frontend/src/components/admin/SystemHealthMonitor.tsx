// Refactor: full prop-contract typing, removed @ts-nocheck

import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Shield, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface CircuitBreaker {
  state?: string;
  failure_count?: number;
  threshold?: number;
  module?: string;
}

interface ModuleHealth {
  status?: string;
  isolation_level?: number;
  circuit_breaker?: CircuitBreaker;
}

interface RecentError {
  timestamp: string;
  module: string;
  error: string;
  isolation_level: number;
}

interface HealthData {
  system_health?: string;
  uptime_seconds?: number;
  total_errors?: number;
  modules?: Record<string, ModuleHealth>;
  fix_recommendations?: string[];
  recent_errors?: RecentError[];
}

export const SystemHealthMonitor = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchSystemHealth();
    
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(fetchSystemHealth, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/god-mode/full-audit-report`, {});
      
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setLastUpdate(new Date());
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
      setLoading(false);
    }
  };

  const triggerRepair = async (moduleName?: string) => {
    if (!moduleName) return;
    if (!window.confirm(`Trigger manual recovery for ${moduleName}?`)) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/god-mode/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_name: moduleName,
          admin_note: `Manual repair triggered from God-Mode UI at ${new Date().toISOString()}`
        })
      });
      
      if (response.ok) {
        alert(`✅ Recovery initiated for ${moduleName}`);
        fetchSystemHealth(); // Refresh data
      } else {
        alert('❌ Repair failed - check permissions');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      alert(`Error: ${msg}`);
    }
  };

  const getHealthIcon = (health?: string) => {
    switch (health) {
      case 'OPTIMAL':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case 'DEGRADED':
        return <AlertTriangle className="w-6 h-6 text-orange-400" />;
      case 'CRITICAL':
        return <XCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Activity className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'DEGRADED':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'QUARANTINED':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'RECOVERING':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getCircuitBreakerColor = (state?: string) => {
    switch (state) {
      case 'CLOSED':
        return 'text-green-400';
      case 'OPEN':
        return 'text-red-400';
      case 'HALF_OPEN':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading system health...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-green-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400 glow mb-2">
            GLOBAL VIBEZ DSG: GOD-MODE SENTINEL
          </h1>
          <p className="text-gray-400 text-sm">
            Real-time System Health & Circuit Breaker Monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            <Clock className="w-4 h-4 inline mr-1" />
            Last Update: {lastUpdate.toLocaleTimeString()}
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${
              autoRefresh 
                ? 'bg-green-600 hover:bg-green-500' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {autoRefresh ? '🔄 Auto-Refresh ON' : '⏸️ Auto-Refresh OFF'}
          </button>
          <button
            onClick={fetchSystemHealth}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-400 uppercase">System Health</h3>
            {getHealthIcon(healthData?.system_health)}
          </div>
          <div className="text-2xl font-bold">{healthData?.system_health || 'UNKNOWN'}</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-400 uppercase">Uptime</h3>
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold">
            {healthData?.uptime_seconds ? formatUptime(healthData.uptime_seconds) : '0h 0m'}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-400 uppercase">Total Errors</h3>
            <AlertTriangle className="w-6 h-6 text-orange-400" />
          </div>
          <div className="text-2xl font-bold">{healthData?.total_errors || 0}</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-400 uppercase">Active Modules</h3>
            <Zap className="w-6 h-6 text-green-400" />
          </div>
          <div className="text-2xl font-bold">
            {healthData?.modules ? Object.keys(healthData.modules).length : 0}
          </div>
        </div>
      </div>

      {/* Module Status Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-green-400 mb-4">MODULE INTEGRITY STATUS</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {healthData?.modules && Object.entries(healthData.modules).map(([name, data]) => (
            <div
              key={name}
              className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-green-500/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold">{name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(data.status)}`}>
                  {data.status}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Isolation Level:</span>
                  <span className="font-bold">{data.isolation_level}/10</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Circuit Breaker:</span>
                  <span className={`font-bold ${getCircuitBreakerColor(data.circuit_breaker?.state)}`}>
                    {data.circuit_breaker?.state || 'UNKNOWN'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Failures:</span>
                  <span className="font-bold">
                    {data.circuit_breaker?.failure_count || 0}/{data.circuit_breaker?.threshold || 0}
                  </span>
                </div>
              </div>

              {data.status !== 'HEALTHY' && (
                <button
                  onClick={() => triggerRepair(data.circuit_breaker?.module)}
                  className="w-full mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
                >
                  🔧 FORCE REPAIR
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fix Recommendations */}
      {healthData?.fix_recommendations && healthData.fix_recommendations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4">⚡ FIX RECOMMENDATIONS</h2>
          <div className="bg-gray-800/50 rounded-xl p-6 border border-yellow-500/30">
            <ul className="space-y-3">
              {healthData.fix_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3 text-white">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {healthData?.recent_errors && healthData.recent_errors.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">🔴 RECENT ERRORS</h2>
          <div className="bg-gray-800/50 rounded-xl p-6 border border-red-500/30 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left py-2 text-gray-400">Timestamp</th>
                  <th className="text-left py-2 text-gray-400">Module</th>
                  <th className="text-left py-2 text-gray-400">Error</th>
                  <th className="text-left py-2 text-gray-400">Isolation</th>
                </tr>
              </thead>
              <tbody>
                {healthData.recent_errors.map((error, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 text-gray-300 font-mono text-xs">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 text-cyan-400 font-bold">{error.module}</td>
                    <td className="py-2 text-gray-300">{error.error}</td>
                    <td className="py-2 text-orange-400 font-bold">{error.isolation_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .glow {
          text-shadow: 0 0 10px #4ade80;
        }
      `}</style>
    </div>
  );
};

export default SystemHealthMonitor;
