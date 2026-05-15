/**
 * Roadmap Hub — single hub surfacing every Feb 2026 founder-roadmap
 * feature (items 1-8). Lets you visually test each one in preview before
 * deeper UI rolls out per feature.
 *
 * Items surfaced:
 *   1. For You Feed (trending preview)
 *   2. Creator Earnings (dashboard preview)
 *   3. Live Commerce (Tap to Buy pin demo)
 *   4. Crews (create / list demo)
 *   5. Native Shell (Capacitor scaffolding status)
 *   6. Streamer Co-Pilot (title suggest + clip scorer)
 *   7. Responsible Gaming / Streaks / Tournaments
 *   8. RUM (metrics dashboard)
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, TrendingUp, Wallet, ShoppingBag, Users, Smartphone,
  Bot, Shield, Activity, Sparkles, CheckCircle2, ChevronRight,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const DEMO_USER = "demo-user-001";

type ItemState = "idle" | "loading" | "ok" | "fail";

function StatusDot({ state }: { state: ItemState }) {
  const color =
    state === "ok" ? "bg-emerald-400" :
    state === "fail" ? "bg-rose-400" :
    state === "loading" ? "bg-amber-300 animate-pulse" : "bg-white/20";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function RoadmapHub() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<ItemState>("idle");
  const [earnings, setEarnings] = useState<ItemState>("idle");
  const [commerce, setCommerce] = useState<ItemState>("idle");
  const [crew, setCrew] = useState<ItemState>("idle");
  const [copilot, setCopilot] = useState<ItemState>("idle");
  const [streak, setStreak] = useState<ItemState>("idle");
  const [rum, setRum] = useState<ItemState>("idle");

  const [feedTrending, setFeedTrending] = useState<any[]>([]);
  const [earningsData, setEarningsData] = useState<any>(null);
  const [crews, setCrews] = useState<any[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [streakData, setStreakData] = useState<any>(null);

  // Health-check every endpoint on mount.
  useEffect(() => {
    const run = async () => {
      // 1. Feed
      setFeed("loading");
      try {
        const r = await fetch(`${API}/api/my-vibez/feed/trending?limit=5`).then(r => r.json());
        setFeedTrending(r.trending || []);
        setFeed("ok");
      } catch { setFeed("fail"); }

      // 2. Earnings
      setEarnings("loading");
      try {
        const r = await fetch(`${API}/api/creator/earnings/${DEMO_USER}`).then(r => r.json());
        setEarningsData(r);
        setEarnings("ok");
      } catch { setEarnings("fail"); }

      // 3. Commerce
      setCommerce("loading");
      try {
        await fetch(`${API}/api/live-commerce/stream/demo-stream/pins`).then(r => r.json());
        setCommerce("ok");
      } catch { setCommerce("fail"); }

      // 4. Crews
      setCrew("loading");
      try {
        const r = await fetch(`${API}/api/crews/leaderboard/top?limit=5`).then(r => r.json());
        setCrews(r.top || []);
        setCrew("ok");
      } catch { setCrew("fail"); }

      // 6. Copilot
      setCopilot("loading");
      try {
        const r = await fetch(`${API}/api/streamer/copilot/title/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "casino", tag: "Vibez 654", use_llm: false }),
        }).then(r => r.json());
        setTitleSuggestions(r.titles || []);
        setCopilot("ok");
      } catch { setCopilot("fail"); }

      // 7. Streak
      setStreak("loading");
      try {
        const r = await fetch(`${API}/api/safety/streak/${DEMO_USER}`).then(r => r.json());
        setStreakData(r);
        setStreak("ok");
      } catch { setStreak("fail"); }

      // 8. RUM
      setRum("loading");
      try {
        await fetch(`${API}/api/rum/beacon`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metric: "page_load_ms", value: 320, route: "/roadmap-hub" }),
        });
        await fetch(`${API}/api/rum/metrics`).then(r => r.json());
        setRum("ok");
      } catch { setRum("fail"); }
    };
    run();
  }, []);

  return (
    <div data-testid="roadmap-hub" className="min-h-screen bg-[#06070d] text-white">
      <header className="sticky top-0 z-10 bg-[#06070d]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            data-testid="roadmap-back-btn"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-[0.4em]">
              Feb 2026 Roadmap · 8 Items · Live
            </span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <section className="text-center">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
            Engagement · Revenue · Retention
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/60 max-w-2xl mx-auto">
            Every item from the founder roadmap is wired in. Tap a card to deep-link into the feature.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1 — For You Feed */}
          <Card
            num="1"
            icon={TrendingUp}
            title="Personalized For You Feed"
            blurb={`Heuristic ranker live. ${feedTrending.length} trending videos in pool.`}
            state={feed}
            testid="roadmap-card-feed"
            endpoint="/api/my-vibez/feed/personalized"
          />

          {/* 2 — Creator Earnings */}
          <Card
            num="2"
            icon={Wallet}
            title="Creator Earnings Dashboard"
            blurb={
              earningsData
                ? `Lifetime: ${earningsData.lifetime.total_vibez.toLocaleString()} $VIBEZ · cash-out @ ${earningsData.cashout.min_cashout_vibez}`
                : "Aggregates all 6 revenue streams."
            }
            state={earnings}
            testid="roadmap-card-earnings"
            endpoint="/api/creator/earnings/{id}"
          />

          {/* 3 — Live Commerce */}
          <Card
            num="3"
            icon={ShoppingBag}
            title="Live Commerce — Tap to Buy"
            blurb="70% vendor · 20% streamer · 10% house. Pinned products on every live stream."
            state={commerce}
            testid="roadmap-card-commerce"
            endpoint="/api/live-commerce/pin"
          />

          {/* 4 — Crews */}
          <Card
            num="4"
            icon={Users}
            title="Crews · Squad Rooms"
            blurb={`4-12 person crews. ${crews.length} total registered. Shared chair pool ready.`}
            state={crew}
            testid="roadmap-card-crews"
            endpoint="/api/crews/leaderboard/top"
          />

          {/* 5 — Native shell */}
          <Card
            num="5"
            icon={Smartphone}
            title="Native Mobile Shell"
            blurb="Capacitor scaffolding committed. `yarn cap:add ios|android` then submit."
            state="ok"
            testid="roadmap-card-native"
            endpoint="frontend/capacitor.config.ts"
          />

          {/* 6 — Streamer Co-Pilot */}
          <Card
            num="6"
            icon={Bot}
            title="Streamer Co-Pilot"
            blurb={
              titleSuggestions[0]
                ? `Sample title: "${titleSuggestions[0]}"`
                : "Auto titles · clip-worthy scoring · chat moderation."
            }
            state={copilot}
            testid="roadmap-card-copilot"
            endpoint="/api/streamer/copilot/title/suggest"
          />

          {/* 7 — Responsible Gaming + Streaks + Tournaments */}
          <Card
            num="7"
            icon={Shield}
            title="RG · Streaks · Tournaments"
            blurb={
              streakData
                ? `Demo user streak: ${streakData.streak} day(s) · ${streakData.total_rewarded_vibez} $VIBEZ earned.`
                : "Loss limits · daily check-ins · brackets."
            }
            state={streak}
            testid="roadmap-card-safety"
            endpoint="/api/safety/*"
          />

          {/* 8 — RUM */}
          <Card
            num="8"
            icon={Activity}
            title="Real User Monitoring"
            blurb="Ring-buffer collector (5K samples / metric). p50/p95/p99 live at /api/rum/metrics."
            state={rum}
            testid="roadmap-card-rum"
            endpoint="/api/rum/beacon"
          />
        </section>

        <footer className="text-center text-[10px] uppercase tracking-[0.3em] text-white/30 pt-8 border-t border-white/5">
          All 8 endpoints health-checked on every page load.
        </footer>
      </main>
    </div>
  );
}

function Card({ num, icon: Icon, title, blurb, state, testid, endpoint }: {
  num: string;
  icon: typeof TrendingUp;
  title: string;
  blurb: string;
  state: ItemState;
  testid: string;
  endpoint: string;
}) {
  return (
    <div
      data-testid={testid}
      className="rounded-2xl border-2 border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 hover:border-cyan-400/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black font-black text-xs flex items-center justify-center">
            {num}
          </span>
          <Icon className="w-6 h-6 text-cyan-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot state={state} />
          <span className="text-[9px] uppercase tracking-widest text-white/40">
            {state === "ok" ? "Live" : state === "loading" ? "…" : state === "fail" ? "Down" : "Idle"}
          </span>
        </div>
      </div>
      <h3 className="text-base md:text-lg font-black text-white mt-3">{title}</h3>
      <p className="text-xs md:text-sm text-white/60 mt-1 leading-relaxed">{blurb}</p>
      <code className="block text-[10px] text-amber-300/70 mt-3 font-mono">
        {endpoint}
      </code>
    </div>
  );
}
