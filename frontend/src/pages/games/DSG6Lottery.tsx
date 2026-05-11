/**
 * /lottery — DSG 6 Quantum Vault Lottery (Genius Phase PDF, p1).
 *
 * Lean MVP: pick 5 core numbers + 1 Vibe Ball, buy ticket, see your
 * tickets, see the latest draw. Full draw animation + crowd-roar
 * settles on a later sprint — the engine is fully wired backend-side.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Gem, Loader2, ArrowLeft, Ticket } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
type VibeBall = "RUBY" | "SAPPHIRE" | "EMERALD" | "GOLD" | "DIAMOND";

const BALL_COLORS: Record<VibeBall, string> = {
  RUBY: "from-rose-500 to-red-700",
  SAPPHIRE: "from-blue-500 to-indigo-700",
  EMERALD: "from-emerald-400 to-green-700",
  GOLD: "from-amber-300 to-yellow-600",
  DIAMOND: "from-cyan-200 to-sky-400",
};

type Ticket = {
  ticket_id: string;
  core: number[];
  vibe_ball: string;
  status: string;
  payout_vibe?: number;
};

export default function DSG6Lottery() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<{ pool_vibe: number; tickets_sold: number; draw_id: string; ticket_cost_vibe: number } | null>(null);
  const [lastDraw, setLastDraw] = useState<any | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [ball, setBall] = useState<VibeBall>("RUBY");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePick = (n: number) => {
    setPicks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < 5 ? [...prev, n].sort((a, b) => a - b) : prev
    );
  };

  const refreshMeta = useCallback(async () => {
    const r = await fetch(`${API}/api/dsg6/current`);
    setMeta(await r.json());
    const l = await fetch(`${API}/api/dsg6/last-draw`).then((res) => res.json());
    setLastDraw(l?.draw || null);
  }, []);

  const refreshTickets = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/dsg6/my-tickets?limit=10`);
      const d = await r.json();
      setTickets((d?.rows as Ticket[]) || []);
    } catch {
      // unauth — user just won't see their tickets
    }
  }, []);

  useEffect(() => { refreshMeta(); refreshTickets(); }, [refreshMeta, refreshTickets]);

  const buy = async () => {
    if (picks.length !== 5) {
      setError("Pick exactly 5 core numbers.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/dsg6/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ core: picks, vibe_ball: ball, quantity: 1 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Ticket purchase failed");
      setPicks([]);
      await refreshMeta();
      await refreshTickets();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0810] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="dsg6-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-300 flex items-center gap-2">
          <Gem className="w-5 h-5" /> DSG 6 Quantum Vault
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">5 + 1 · $2 / ticket</div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {meta && (
          <div data-testid="dsg6-pool" className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-fuchsia-700/10 border border-amber-400/30 p-5 mb-6">
            <p className="text-[10px] uppercase tracking-widest text-amber-300/70">Tonight's Vault</p>
            <p className="text-4xl md:text-5xl font-black text-amber-200 tabular-nums">₵{meta.pool_vibe.toLocaleString()}</p>
            <p className="text-xs text-white/60 mt-2 tabular-nums">{meta.tickets_sold.toLocaleString()} tickets in · settles at midnight UTC</p>
          </div>
        )}

        <div className="rounded-2xl bg-black/60 border border-white/10 p-5 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300/70 mb-3">Pick 5 core numbers · {picks.length}/5</p>
          <div className="grid grid-cols-10 gap-1.5" data-testid="dsg6-grid">
            {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
              const sel = picks.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => togglePick(n)}
                  data-testid={`dsg6-pick-${n}`}
                  className={`h-9 rounded-md text-xs font-black tabular-nums transition ${
                    sel
                      ? "bg-amber-400 text-black"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] uppercase tracking-widest text-fuchsia-300/70 mt-4 mb-2">Vibe Ball · 2× / 1.5× multiplier</p>
          <div className="flex flex-wrap gap-2" data-testid="dsg6-ball-row">
            {(["RUBY", "SAPPHIRE", "EMERALD", "GOLD", "DIAMOND"] as VibeBall[]).map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => setBall(b)}
                data-testid={`dsg6-ball-${b}`}
                className={`px-3 py-2 rounded-full text-[10px] font-black tracking-widest uppercase transition bg-gradient-to-br ${BALL_COLORS[b]} ${
                  ball === b ? "ring-2 ring-white text-black" : "text-white/80 opacity-70 hover:opacity-100"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {error && <p className="text-rose-300 text-xs mt-3" data-testid="dsg6-error">{error}</p>}

          <button
            onClick={buy}
            disabled={busy || picks.length !== 5}
            data-testid="dsg6-buy"
            className="mt-5 w-full px-5 py-3 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-400 text-black font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            Buy 1 ticket · ₵{meta?.ticket_cost_vibe || 200}
          </button>
        </div>

        {tickets.length > 0 && (
          <div className="rounded-2xl bg-black/60 border border-white/10 p-5 mb-6" data-testid="dsg6-my-tickets">
            <p className="text-[10px] uppercase tracking-widest text-amber-300/80 mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> My recent tickets
            </p>
            <ul className="space-y-1.5">
              {tickets.map((t) => (
                <li key={t.ticket_id} data-testid={`dsg6-ticket-${t.ticket_id}`} className="flex items-center justify-between text-xs rounded-md bg-black/40 border border-white/5 px-3 py-2">
                  <span className="font-mono text-white/70">{t.core.join(" · ")} · <span className="text-fuchsia-300">{t.vibe_ball}</span></span>
                  <span className={`text-[10px] uppercase tracking-widest ${t.status === "won" ? "text-emerald-300" : t.status === "lost" ? "text-rose-300/70" : "text-amber-300"}`}>
                    {t.status}{t.payout_vibe ? ` · +₵${t.payout_vibe.toLocaleString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastDraw && (
          <div className="rounded-2xl bg-black/60 border border-white/10 p-5" data-testid="dsg6-last-draw">
            <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 mb-3">Last draw · {lastDraw.draw_id}</p>
            <div className="flex flex-wrap items-center gap-2">
              {(lastDraw.winning_core || []).map((n: number) => (
                <span key={`w-${n}`} className="w-9 h-9 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-sm">{n}</span>
              ))}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-br ${BALL_COLORS[lastDraw.winning_ball as VibeBall] || "from-white/20 to-white/40"} text-black`}>
                {lastDraw.winning_ball}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-3 tabular-nums">
              {lastDraw.winners} winners · ₵{(lastDraw.payouts_total_vibe || 0).toLocaleString()} paid · ₵{(lastDraw.sovereign_tax_total_vibe || 0).toLocaleString()} tax
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
