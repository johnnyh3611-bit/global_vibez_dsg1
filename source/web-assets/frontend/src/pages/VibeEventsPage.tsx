/**
 * Live events + rewarded actions — gamification revenue surface.
 * Route: /vibe-events
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Zap, Gift, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type EventRow = {
  event_id: string;
  title: string;
  description?: string;
  entry_coins: number;
  boost_coins: number;
  prize_pool_coins?: number;
  entries?: number;
};

type ActionRow = {
  action_id: string;
  label: string;
  coins: number;
  description?: string;
};

export default function VibeEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const [e, a] = await Promise.all([
      fetch(`${API}/api/vibe-events`),
      fetch(`${API}/api/vibe-events/rewarded`),
    ]);
    if (e.ok) setEvents((await e.json()).events || []);
    if (a.ok) setActions((await a.json()).actions || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const enter = async (id: string) => {
    setBusy(id);
    setErr("");
    setMsg("");
    try {
      const r = await authFetch(`${API}/api/vibe-events/${id}/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof d.detail === "string" ? d.detail : "Entry failed");
        return;
      }
      setMsg(d.already ? "Already entered this window." : "You're in — good luck!");
      await load();
    } finally {
      setBusy("");
    }
  };

  const claim = async (id: string) => {
    setBusy(id);
    setErr("");
    setMsg("");
    try {
      const r = await authFetch(`${API}/api/vibe-events/rewarded/${id}`, {
        method: "POST",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof d.detail === "string" ? d.detail : "Claim failed");
        return;
      }
      setMsg(
        d.already
          ? "Already claimed."
          : `+₵${d.coins} for ${d.action || id}`,
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0815] to-[#120818] text-white px-4 py-8"
      data-testid="vibe-events-page"
    >
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-3xl font-black mb-1 flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-300" /> Live Events
        </h1>
        <p className="text-sm text-purple-200/70 mb-6">
          Time-limited contests and rewarded social actions — drive ₵ into game
          rooms without ads.
        </p>

        {(msg || err) && (
          <p
            className={`text-xs mb-4 ${err ? "text-rose-300" : "text-emerald-200"}`}
            role="status"
          >
            {err || msg}
          </p>
        )}

        <div className="space-y-3 mb-8" data-testid="vibe-events-list">
          {events.map((ev) => (
            <div
              key={ev.event_id}
              className="rounded-2xl border border-amber-500/25 bg-[#120818] p-4"
              data-testid={`vibe-event-${ev.event_id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-amber-100">{ev.title}</p>
                  <p className="text-xs text-purple-200/70 mt-1">
                    {ev.description}
                  </p>
                  <p className="text-[11px] text-white/50 mt-2">
                    Pool ₵{(ev.prize_pool_coins || 0).toLocaleString()} ·{" "}
                    {ev.entries || 0} entries
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => enter(ev.event_id)}
                  className="shrink-0 rounded-lg bg-amber-500/90 text-black text-xs font-bold px-3 py-2 disabled:opacity-40"
                >
                  {busy === ev.event_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Enter ₵{ev.entry_coins}</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-300" /> Rewarded actions
        </h2>
        <div className="grid gap-2 sm:grid-cols-2" data-testid="vibe-rewarded-list">
          {actions.map((a) => (
            <button
              key={a.action_id}
              type="button"
              disabled={!!busy}
              onClick={() => claim(a.action_id)}
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-left hover:border-emerald-400/50"
              data-testid={`vibe-reward-${a.action_id}`}
            >
              <p className="font-bold text-sm flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-300" />
                {a.label}
              </p>
              <p className="text-[11px] text-purple-200/60 mt-1">
                {a.description}
              </p>
              <p className="text-xs text-emerald-200 mt-2">+₵{a.coins}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
