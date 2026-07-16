import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Trophy, TrendingUp } from "lucide-react";
import { WinnerTicker } from "@/components/common/WinnerTicker";

const API = process.env.REACT_APP_BACKEND_URL;

type LeaderRow = {
  username?: string;
  display_name?: string;
  mined?: number;
  total_mined?: number;
};

/**
 * Compact social proof: live streams + top earner + optional win ticker.
 */
export function SocialProofStrip({
  showTicker = true,
  className = "",
}: {
  showTicker?: boolean;
  className?: string;
}) {
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [topEarner, setTopEarner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const liveRes = await fetch(
          `${API}/api/streaming/cloudflare/live-inputs?only_live=true`
        );
        if (liveRes.ok) {
          const data = await liveRes.json();
          const rows = data.streams || data.results || data.inputs || [];
          const count = Array.isArray(rows)
            ? rows.length
            : Number(data.count) || 0;
          if (!cancelled) setLiveCount(count);
        }
      } catch {
        /* cosmetic */
      }

      try {
        const leadRes = await fetch(
          `${API}/api/mining/leaderboard?limit=1&window_hours=168`
        );
        if (leadRes.ok) {
          const data = await leadRes.json();
          const rows = (data.rows || data.leaderboard || data) as LeaderRow[];
          const top = Array.isArray(rows) ? rows[0] : null;
          if (top && !cancelled) {
            setTopEarner(
              top.username || top.display_name || "a Vibez player"
            );
          }
        }
      } catch {
        /* cosmetic */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={className} data-testid="social-proof-strip">
      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          to="/streams/live"
          className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"
        >
          <Radio className="h-3.5 w-3.5" />
          {liveCount == null
            ? "Live streams"
            : liveCount === 0
              ? "Be first to go live"
              : `${liveCount} live now`}
        </Link>
        <Link
          to="/games"
          className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-100 hover:bg-yellow-500/20"
        >
          <Trophy className="h-3.5 w-3.5" />
          Who&apos;s winning
        </Link>
        <Link
          to="/earn"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          {topEarner ? `Top earner: ${topEarner}` : "Who's earning"}
        </Link>
      </div>
      {showTicker && <WinnerTicker compact limit={12} className="rounded-xl" />}
    </div>
  );
}
