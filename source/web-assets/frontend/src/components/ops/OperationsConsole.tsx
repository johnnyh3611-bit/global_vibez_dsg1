import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  Database,
  Users,
  Wallet,
  Gamepad2,
  Brain,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
} from 'lucide-react';
import { getBackendUrl } from '@/config/backendUrl';
import { GlobalCard } from '@/components/ui/GlobalCard';

const API = getBackendUrl();

interface SystemStatusReport {
  timestamp: string;
  response_time_ms: number;
  environment: string;
  services: Record<string, Record<string, unknown>>;
  integrity_check: Record<string, string>;
  overall_health: 'GOOD' | 'DEGRADED' | 'CRITICAL' | string;
}

const SERVICE_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  database: {
    label: 'Database',
    icon: <Database className="w-5 h-5" />,
    color: 'text-cyan-400',
  },
  auth_service: {
    label: 'Authentication',
    icon: <Users className="w-5 h-5" />,
    color: 'text-emerald-400',
  },
  wallet_stripe: {
    label: 'Wallet & Stripe',
    icon: <Wallet className="w-5 h-5" />,
    color: 'text-amber-400',
  },
  game_services: {
    label: 'Game Services',
    icon: <Gamepad2 className="w-5 h-5" />,
    color: 'text-fuchsia-400',
  },
  ai_services: {
    label: 'AI / LLM',
    icon: <Brain className="w-5 h-5" />,
    color: 'text-violet-400',
  },
};

function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'online' || s === 'healthy' || s === 'good' || s === 'active' || s === 'verified' || s === 'configured') {
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  }
  if (s === 'degraded' || s === 'not_configured' || s === 'missing') {
    return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  }
  if (s === 'offline' || s === 'critical' || s === 'error' || s === 'failed') {
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  }
  return 'text-white/60 bg-white/5 border-white/10';
}

function overallIcon(health: string) {
  const h = (health || '').toLowerCase();
  if (h === 'good') return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
  if (h === 'degraded') return <AlertCircle className="w-6 h-6 text-amber-400" />;
  if (h === 'critical') return <AlertCircle className="w-6 h-6 text-rose-400" />;
  return <MinusCircle className="w-6 h-6 text-white/60" />;
}

export function OperationsConsole() {
  const [report, setReport] = useState<SystemStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authFailedRef = useRef(false);

  const load = useCallback(async () => {
    if (authFailedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/system-status`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status === 401) {
        authFailedRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        throw new Error('Please sign in to view the operations dashboard.');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SystemStatusReport = await res.json();
      setReport(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Platform Health</h2>
          <p className="text-sm text-white/60">
            Live view of backend services, refreshed every 10 seconds.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Overall status */}
          <GlobalCard className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white/5 p-3">{overallIcon(report.overall_health)}</div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/60">Overall Health</p>
                <p className="text-2xl font-black text-white">{report.overall_health}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-white/60">Response Time</p>
                <p className="font-mono font-semibold text-white">{report.response_time_ms} ms</p>
              </div>
              <div>
                <p className="text-white/60">Environment</p>
                <p className="font-semibold text-white">{report.environment}</p>
              </div>
              <div>
                <p className="text-white/60">Last Check</p>
                <p className="font-semibold text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
                </p>
              </div>
            </div>
          </GlobalCard>

          {/* Service cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(report.services).map(([key, service]) => {
              const meta = SERVICE_META[key] || {
                label: key.replace(/_/g, ' '),
                icon: <Activity className="w-5 h-5" />,
                color: 'text-white',
              };
              const status = String(service.status || 'unknown');
              return (
                <GlobalCard key={key} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 ${meta.color}`}>
                      {meta.icon}
                      <span className="font-semibold text-white">{meta.label}</span>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusColor(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {Object.entries(service).map(([k, v]) => {
                      if (k === 'status' || typeof v === 'object') return null;
                      return (
                        <div key={k} className="flex justify-between">
                          <span className="text-white/60 capitalize">{k.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-white/90">{String(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlobalCard>
              );
            })}
          </div>

          {/* Integrity checks */}
          <GlobalCard>
            <h3 className="text-lg font-semibold text-white mb-4">Integrity Checks</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(report.integrity_check).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <span className="text-sm text-white/70 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 border ${statusColor(String(value))}`}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </GlobalCard>

          {/* Raw timestamp */}
          <p className="text-xs text-white/40 text-right">Reported at {report.timestamp}</p>
        </>
      )}
    </div>
  );
}
