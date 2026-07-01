/**
 * /merchant/leaderboard — Top Recruiters · Genius Phase.
 *
 * Public page that displays the top 10 merchants by completed referrals
 * (tracked via the `?ref=<merchant_id>` param on QR-code recruitment).
 * Drives viral merchant acquisition — every existing merchant becomes
 * a sales agent and earns 1 free Chair per N successful referrals.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Trophy, Sparkles, Coins, ChevronRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Row {
  merchant_id: string;
  business_name: string;
  service: string;
  chairs_held: number;
  referrals_completed: number;
  referral_rewards_granted: number;
}

interface LeaderboardRes {
  top: Row[];
  reward_threshold: number;
  chair_price_usd: number;
}

export default function MerchantLeaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<LeaderboardRes | null>(null);

  useEffect(() => {
    fetch(`${API}/api/merchant/leaderboard?limit=10`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ top: [], reward_threshold: 5, chair_price_usd: 20 }));
  }, []);

  return (
    <div
      data-testid="merchant-leaderboard-page"
      className="min-h-screen bg-gradient-to-br from-[#0c0716] via-[#120a23] to-[#070514] text-white"
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-fuchsia-200 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Genius Phase · Top Recruiters
            </div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-black flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-300" /> Recruiter Leaderboard
            </h1>
          </div>
          <button
            data-testid="leaderboard-back-btn"
            onClick={() => navigate("/merchant/join")}
            className="text-sm text-white/60 hover:text-white"
          >
            ← Business Brief
          </button>
        </div>
      </header>

      {/* Reward explainer */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div
          data-testid="leaderboard-reward-card"
          className="rounded-3xl border border-amber-300/30 bg-amber-300/[0.05] p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Coins className="h-5 w-5 text-amber-300" />
            <h3 className="font-bold">Recruit → Earn Chairs</h3>
          </div>
          <p className="text-sm text-white/80">
            Every <strong className="text-white">{data?.reward_threshold ?? 5}</strong> successful merchant referrals you bring in
            earns you <strong className="text-white">1 free Genius Phase Chair</strong>{" "}
            (worth ${data?.chair_price_usd ?? 20}) — credited instantly to your stake.
            Share your QR code from the dashboard to start climbing.
          </p>
        </div>
      </section>

      {/* Table */}
      <section className="mx-auto max-w-4xl px-6 pb-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-xs uppercase tracking-wider text-white/50 grid grid-cols-[40px_1fr_80px_80px_80px] gap-2">
            <div>#</div>
            <div>Merchant</div>
            <div className="text-right">Refs</div>
            <div className="text-right">Chairs</div>
            <div className="text-right">Reward</div>
          </div>
          {!data?.top || data.top.length === 0 ? (
            <div
              data-testid="leaderboard-empty"
              className="px-5 py-10 text-center text-sm text-white/50"
            >
              No referrals yet — be the first to recruit a neighbor.
            </div>
          ) : (
            data.top.map((row, i) => (
              <motion.div
                key={row.merchant_id}
                data-testid={`leaderboard-row-${i + 1}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`px-5 py-3 grid grid-cols-[40px_1fr_80px_80px_80px] gap-2 items-center text-sm border-b border-white/[0.03] ${
                  i < 3 ? "bg-amber-300/[0.04]" : ""
                }`}
              >
                <div
                  className={`font-black ${
                    i === 0
                      ? "text-amber-300"
                      : i === 1
                      ? "text-slate-300"
                      : i === 2
                      ? "text-orange-300"
                      : "text-white/40"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate flex items-center gap-1">
                    {row.business_name}
                    {i === 0 && (
                      <span
                        data-testid="top-recruiter-badge"
                        className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-300 text-black px-2 py-0.5 text-[10px] font-black"
                      >
                        <Crown className="h-3 w-3" /> Top Recruiter
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">
                    {row.service} · {row.merchant_id}
                  </div>
                </div>
                <div className="text-right font-bold text-fuchsia-300">
                  {row.referrals_completed}
                </div>
                <div className="text-right text-white/70">
                  {row.chairs_held}
                </div>
                <div className="text-right text-amber-300">
                  +{row.referral_rewards_granted}
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            data-testid="leaderboard-share-cta"
            onClick={() => navigate("/merchant/dashboard")}
            className="inline-flex items-center gap-1 rounded-full bg-fuchsia-400 text-black px-5 py-2.5 font-bold hover:brightness-110"
          >
            Get your referral QR code <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
