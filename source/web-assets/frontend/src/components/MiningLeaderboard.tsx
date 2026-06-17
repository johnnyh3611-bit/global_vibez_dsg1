import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = process.env.REACT_APP_BACKEND_URL;

type Row = {
  rank: number;
  user_id: string;
  username: string;
  mined: number;
  events: number;
  is_leader: boolean;
};

/**
 * 24-hour rolling $DSG mining leaderboard.
 * Drop into any page: <MiningLeaderboard limit={10} />
 */
export default function MiningLeaderboard({ limit = 10 }: { limit?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/mining/leaderboard?window_hours=24&limit=${limit}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setRows(data.rows || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  return (
    <div
      data-testid="mining-leaderboard"
      className="bg-black/60 backdrop-blur border border-purple-500/30 rounded-2xl p-4 text-white"
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm uppercase tracking-widest text-purple-300 font-bold">
          $DSG Leaderboard · 24h Rolling
        </h3>
      </div>
      {loading ? (
        <div className="text-xs text-slate-400 p-3">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-slate-500 p-3">
          No mining activity in the last 24h. Premium players will appear here.
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.user_id}
              data-testid={`leaderboard-row-${r.rank}`}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                r.is_leader
                  ? 'bg-gradient-to-r from-amber-500/20 to-purple-500/10 border border-amber-400/40'
                  : 'bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono w-6 text-center ${
                    r.is_leader ? 'text-amber-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  #{r.rank}
                </span>
                <span className="truncate max-w-[120px]">
                  {r.is_leader && <span title=":vibez_crown:" className="mr-1">👑</span>}
                  {r.username}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">{r.events} ev</span>
                <span className="text-emerald-400 font-bold">{r.mined.toFixed(2)} $DSG</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
