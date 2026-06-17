/**
 * StreamerAnalytics — Cloudflare Stream analytics dashboard for the
 * owning streamer of a live input. Visible at `/streamer/analytics`.
 *
 * Pulls from `/api/streaming/cloudflare/analytics/:input_id`:
 *   • Headline KPIs: total minutes viewed, viewer days, top country
 *   • Daily minutes-viewed area chart (recharts)
 *   • Top-8 countries horizontal bar chart
 *   • Window selector (7 / 30 / 90 days)
 *
 * Cloudflare batches analytics with a ~15-minute ingestion delay so the
 * most-recent hour will always look thin — we surface that caveat in
 * the empty state copy.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import {
  ArrowLeft, Activity, Loader2, AlertTriangle,
  Globe, Clock, RefreshCcw, Sparkles, Radio, Mail,
} from "lucide-react";
import { getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const WINDOWS = [7, 30, 90] as const;

interface AnalyticsResponse {
  mode: "live" | "stub";
  input_id: string;
  streamer_id: string;
  window_days: number;
  summary: {
    total_minutes_viewed: number;
    unique_viewer_days: number;
    top_country: string | null;
    top_country_minutes?: number;
  };
  daily: { date: string; minutes_viewed: number }[];
  countries: { country: string; minutes_viewed: number }[];
}

interface LiveInputRef {
  input_id: string;
  streamer_id: string;
  name: string;
  is_live: boolean;
}

export default function StreamerAnalytics() {
  const nav = useNavigate();
  const [input, setInput] = useState<LiveInputRef | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadInput = useCallback(async () => {
    const uid = getUserId() || "anonymous";
    try {
      const r = await fetch(`${API}/api/streaming/cloudflare/live-inputs/by-streamer/${uid}`);
      if (r.status === 404) {
        setInput(null);
        return null;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setInput(d);
      return d as LiveInputRef;
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Failed to load your live input");
      return null;
    }
  }, []);

  const loadAnalytics = useCallback(async (inputId: string, days: number) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `${API}/api/streaming/cloudflare/analytics/${inputId}?days=${days}`,
      );
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail || `HTTP ${r.status}`);
      }
      setData(await r.json());
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const i = await loadInput();
      if (i) loadAnalytics(i.input_id, windowDays);
      else setLoading(false);
    })();
  }, [loadInput, loadAnalytics, windowDays]);

  const refresh = () => {
    if (input) loadAnalytics(input.input_id, windowDays);
  };

  const [emailing, setEmailing] = useState(false);
  const [emailToast, setEmailToast] = useState<string | null>(null);
  const emailMyWrapUp = async () => {
    if (!input) return;
    setEmailing(true);
    setEmailToast(null);
    try {
      const r = await fetch(
        `${API}/api/streamer-wrap-up/send/${input.streamer_id}`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!r.ok || (!data.ok && !data.skipped)) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }
      if (data.skipped) {
        setEmailToast(`Skipped — ${data.reason}`);
      } else {
        setEmailToast(`📩 Wrap-up sent to ${data.email}`);
      }
    } catch (e: unknown) {
      setEmailToast(
        `Failed: ${(e as Error)?.message || "send error"}`,
      );
    } finally {
      setEmailing(false);
      setTimeout(() => setEmailToast(null), 6000);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#070012] text-white font-mono"
      data-testid="streamer-analytics-root"
    >
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/60 border-b border-cyan-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="text-cyan-200/70 hover:text-white"
              aria-label="Back"
              data-testid="streamer-analytics-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Activity className="w-6 h-6 text-cyan-300" />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-[0.25em] uppercase text-cyan-100">
                Stream Analytics
              </h1>
              <p className="text-[10px] text-cyan-300/60 tracking-widest uppercase">
                {input?.name || "Cloudflare-powered"} · 15-min ingestion delay
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-full border border-cyan-500/30 p-1"
              data-testid="streamer-analytics-window-picker"
            >
              {WINDOWS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWindowDays(d)}
                  className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest ${
                    windowDays === d
                      ? "bg-cyan-400 text-black font-black"
                      : "text-cyan-200/70 hover:bg-cyan-500/10"
                  }`}
                  data-testid={`streamer-analytics-window-${d}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={refresh}
              className="p-2 rounded-full border border-cyan-500/30 hover:bg-cyan-500/10"
              data-testid="streamer-analytics-refresh"
              aria-label="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={emailMyWrapUp}
              disabled={emailing || !input}
              className="px-3 py-2 rounded-full border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-100 text-[10px] uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-50"
              data-testid="streamer-analytics-email-wrap-up"
              aria-label="Email me this wrap-up"
            >
              {emailing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Email me
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {emailToast && (
          <div
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 px-3 py-2 text-xs"
            data-testid="streamer-analytics-email-toast"
          >
            {emailToast}
          </div>
        )}
        {err && (
          <div
            className="rounded-xl border border-red-500/40 bg-red-900/20 text-red-200 px-3 py-2 text-xs flex items-center gap-2"
            data-testid="streamer-analytics-error"
          >
            <AlertTriangle className="w-4 h-4" /> {err}
          </div>
        )}

        {loading && (
          <div className="text-center text-cyan-300/60 text-xs uppercase tracking-widest py-12 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…
          </div>
        )}

        {!loading && !input && <NoInputState />}

        {!loading && input && data && (
          <>
            <KpiRow data={data} />
            <ChartCard
              title="Minutes Viewed · Daily"
              icon={<Clock className="w-4 h-4" />}
              testId="streamer-analytics-daily-chart"
            >
              {data.daily.length === 0 ? (
                <EmptyChart label="No viewers in this window yet" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={data.daily}
                    margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(34,211,238,0.08)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#67e8f9" }}
                      stroke="rgba(34,211,238,0.2)"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#67e8f9" }}
                      stroke="rgba(34,211,238,0.2)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(34,211,238,0.4)",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "#67e8f9" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="minutes_viewed"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#cyanGlow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Top Audience Countries"
              icon={<Globe className="w-4 h-4" />}
              testId="streamer-analytics-country-chart"
            >
              {data.countries.length === 0 ? (
                <EmptyChart label="No geo data yet — viewers will populate this map soon" />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, data.countries.length * 30)}>
                  <BarChart
                    data={data.countries}
                    layout="vertical"
                    margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="rgba(232,121,249,0.08)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#f0abfc" }}
                      stroke="rgba(232,121,249,0.2)"
                    />
                    <YAxis
                      dataKey="country"
                      type="category"
                      width={110}
                      tick={{ fontSize: 10, fill: "#f0abfc" }}
                      stroke="rgba(232,121,249,0.2)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(232,121,249,0.4)",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="minutes_viewed" fill="#e879f9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <FooterCta />
          </>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────── Building blocks ──
function KpiRow({ data }: { data: AnalyticsResponse }) {
  const kpis = useMemo(
    () => [
      {
        label: "Minutes viewed",
        value: data.summary.total_minutes_viewed.toLocaleString(),
        tone: "cyan",
        testId: "kpi-minutes",
      },
      {
        label: "Active days",
        value: `${data.summary.unique_viewer_days} / ${data.window_days}`,
        tone: "fuchsia",
        testId: "kpi-active-days",
      },
      {
        label: "Top country",
        value: data.summary.top_country || "—",
        tone: "amber",
        testId: "kpi-top-country",
      },
      {
        label: "Stream mode",
        value: data.mode === "live" ? "LIVE · Cloudflare" : "DEMO",
        tone: "emerald",
        testId: "kpi-mode",
      },
    ],
    [data],
  );

  const toneColors: Record<string, string> = {
    cyan: "border-cyan-400/40 text-cyan-100 bg-cyan-500/10",
    fuchsia: "border-fuchsia-400/40 text-fuchsia-100 bg-fuchsia-500/10",
    amber: "border-amber-400/40 text-amber-100 bg-amber-500/10",
    emerald: "border-emerald-400/40 text-emerald-100 bg-emerald-500/10",
  };

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      data-testid="streamer-analytics-kpi-row"
    >
      {kpis.map((k) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-4 ${toneColors[k.tone] || ""}`}
          data-testid={k.testId}
        >
          <div className="text-[10px] uppercase tracking-widest opacity-80">
            {k.label}
          </div>
          <div className="mt-1 text-2xl font-black truncate" title={String(k.value)}>
            {k.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ChartCard({
  title, icon, testId, children,
}: { title: string; icon: React.ReactNode; testId: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border border-cyan-500/20 bg-black/40 p-4"
      data-testid={testId}
    >
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-100 mb-2">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-xs text-cyan-300/40 uppercase tracking-widest">
      {label}
    </div>
  );
}

function NoInputState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cyan-500/30 bg-black/40 p-10 text-center"
      data-testid="streamer-analytics-no-input"
    >
      <Sparkles className="w-8 h-8 text-cyan-300 mx-auto" />
      <h2 className="mt-3 text-lg font-black uppercase tracking-widest">
        Provision your studio first
      </h2>
      <p className="text-xs text-cyan-200/70 mt-2 max-w-md mx-auto">
        Analytics need a live input. Open the Streamer Studio, click
        "Provision My Ingest", and you'll see this page populate the
        moment your first viewer tunes in.
      </p>
      <Link
        to="/streamer/studio"
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black text-xs font-black uppercase tracking-widest"
        data-testid="streamer-analytics-go-to-studio"
      >
        <Radio className="w-4 h-4" /> Open Streamer Studio
      </Link>
    </motion.div>
  );
}

function FooterCta() {
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-900/10 px-4 py-3 text-[11px] text-amber-100/80 flex items-center justify-between gap-3 flex-wrap">
      <span>
        ⭐ <b>Want bigger numbers?</b> Featured streamers get pinned to the
        top of the Live Now Wall — first thing every visitor sees.
      </span>
      <Link
        to="/streamer/studio"
        className="px-3 py-1.5 rounded-full bg-amber-300 text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-200"
        data-testid="streamer-analytics-featured-cta"
      >
        Get Featured · $5
      </Link>
    </div>
  );
}
