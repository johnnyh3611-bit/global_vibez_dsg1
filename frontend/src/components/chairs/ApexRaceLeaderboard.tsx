/**
 * ApexRaceLeaderboard — anonymized top-100 referrer board for the Apex
 * Race. Shown on `/chair-vault` (read-only view for everyone) and again
 * on the God-Mode dashboard with extra columns.
 */
import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Leader = {
  rank: number;
  anon_id: string;
  race_invites: number;
  qualifies_for_bonus: boolean;
};

export default function ApexRaceLeaderboard({
  limit = 25,
  showBanner = true,
}: {
  limit?: number;
  showBanner?: boolean;
}) {
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [raceStartedAt, setRaceStartedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/apex/race/leaders?limit=${limit}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        setLeaders(d.leaders || []);
        setRaceStartedAt(d.race_started_at || null);
      } catch {
        /* silent */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [limit]);

  return (
    <div
      className="rounded-xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/[0.04] to-rose-900/[0.06] backdrop-blur-md p-5"
      data-testid="apex-race-leaderboard"
    >
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4 text-yellow-300" />
        <h3 className="text-sm font-black uppercase tracking-widest text-yellow-200">
          Apex Race Leaderboard
        </h3>
      </div>

      {showBanner && (
        <p className="text-[11px] text-white/65 leading-relaxed mb-3">
          Top 100 referrers when Apex unlocks each receive a{" "}
          <span className="text-yellow-300 font-black">free Apex chair</span>.
          Race tracks invite redemptions
          {raceStartedAt && (
            <>
              {" "}since{" "}
              <span className="text-yellow-200">
                {new Date(raceStartedAt).toLocaleString()}
              </span>
            </>
          )}
          .
        </p>
      )}

      {leaders === null ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : leaders.length === 0 ? (
        <p className="text-slate-400 text-sm">
          No invites redeemed yet. The first founder to convert an invite takes
          rank #1.
        </p>
      ) : (
        <div className="space-y-1.5">
          {leaders.map((l) => (
            <div
              key={`${l.rank}-${l.anon_id}`}
              data-testid={`apex-race-row-${l.rank}`}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-[12px] ${
                l.qualifies_for_bonus
                  ? "bg-yellow-400/[0.07] border border-yellow-300/30"
                  : "bg-slate-800/40 border border-slate-700/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                    l.rank === 1
                      ? "bg-yellow-300 text-black"
                      : l.rank <= 3
                      ? "bg-yellow-500/30 text-yellow-200"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {l.rank === 1 ? <Crown className="w-3.5 h-3.5" /> : l.rank}
                </span>
                <span className="font-mono text-slate-200">{l.anon_id}</span>
                {l.qualifies_for_bonus && (
                  <span className="text-[9px] uppercase tracking-widest text-yellow-300 font-black">
                    Apex bonus
                  </span>
                )}
              </div>
              <span className="font-black text-yellow-200">
                {l.race_invites}
                <span className="text-[10px] text-slate-400 ml-1 font-normal">
                  invite{l.race_invites === 1 ? "" : "s"}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
