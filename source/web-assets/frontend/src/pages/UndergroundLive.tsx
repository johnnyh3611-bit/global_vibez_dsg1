/**
 * /underground-live — Underground Music & Dance Battle lobby + crowd judge.
 *
 * Lobby grid shows tonight's lineup. Tapping a live battle opens the
 * crowd-judge meter (POV stream placeholder + vote buttons). Voting is
 * free; chair-holders vote 2×. Winner takes 70% of the sponsor pool.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic2, Flame, Crown, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Contestant = { id: string; name: string; tagline: string };
type Battle = {
  battle_id: string;
  kind: "music" | "dance";
  title: string;
  starts_at_iso: string;
  status: "scheduled" | "live" | "closed";
  contestants: Contestant[];
  pool_vibe: number;
  stream_url?: string | null;
  crowd_meter?: Record<string, number>;
  total_votes?: number;
};

export default function UndergroundLive() {
  const navigate = useNavigate();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [active, setActive] = useState<Battle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [b, a] = await Promise.all([
      fetch(`${API}/api/underground-live/battles`).then((r) => r.json()),
      fetch(`${API}/api/underground-live/active`).then((r) => r.json()),
    ]);
    setBattles((b?.battles as Battle[]) || []);
    setActive((a?.battle as Battle) || null);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await refresh(); } finally { setLoading(false); }
    })();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const vote = async (cid: string) => {
    if (!active) return;
    setBusy(cid);
    setMsg(null);
    try {
      const r = await authFetch(`${API}/api/underground-live/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battle_id: active.battle_id, contestant_id: cid }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Vote failed");
      setMsg(`Vote recorded · weight ${d?.weight || 1}×`);
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#160a0a] via-[#0a060a] to-[#13080d] text-white" data-testid="underground-live">
      <header className="px-6 py-4 flex items-center justify-between border-b border-amber-500/15">
        <button onClick={() => navigate(-1)} className="text-white/70 text-sm flex items-center gap-2 hover:text-white" data-testid="ul-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-300 flex items-center gap-2">
          <Flame className="w-5 h-5" /> Underground · Live
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-white/40 hidden md:inline">
          Crowd judge · 70/30 pool · chair-holder 2×
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-white/40 text-xs flex items-center gap-2 justify-center mt-12">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading battles…
          </p>
        ) : (
          <>
            {/* Active battle */}
            {active && (
              <section className="mb-8 rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-rose-950/30 to-amber-950/40 overflow-hidden" data-testid="ul-active-battle">
                <div className="px-6 py-3 bg-gradient-to-r from-rose-500/40 via-amber-500/40 to-rose-500/40 text-center text-[10px] uppercase tracking-[0.4em] font-black">
                  ⚡ Live now — {active.title}
                </div>
                <div className="aspect-video bg-black/70 flex items-center justify-center text-white/30">
                  {active.stream_url ? (
                    <video src={active.stream_url} controls autoPlay className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-xs uppercase tracking-widest">POV stream coming online…</p>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-[10px] uppercase tracking-widest text-amber-200 mb-3">
                    Pool ₵{active.pool_vibe.toLocaleString()} · {active.total_votes ?? 0} votes
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {active.contestants.map((c) => {
                      const pct = active.crowd_meter?.[c.id] ?? 0;
                      return (
                        <div key={c.id} className="rounded-2xl bg-black/40 border border-amber-500/20 p-4" data-testid={`ul-contestant-${c.id}`}>
                          <div className="flex items-center gap-2">
                            <Mic2 className="w-4 h-4 text-amber-300" />
                            <h3 className="text-base font-black text-white">{c.name}</h3>
                          </div>
                          <p className="text-[11px] text-white/60 italic mt-1">{c.tagline}</p>
                          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-amber-400"
                              style={{ width: `${pct}%` }}
                              data-testid={`ul-meter-${c.id}`}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] uppercase tracking-widest text-white/40">crowd</span>
                            <span className="text-xs font-black tabular-nums text-amber-200">{pct}%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => vote(c.id)}
                            disabled={busy === c.id}
                            data-testid={`ul-vote-${c.id}`}
                            className="w-full mt-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-90 text-black font-black text-xs uppercase tracking-widest disabled:opacity-50"
                          >
                            {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Vote crowd"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {msg && <p className="text-xs text-amber-200 mt-4 text-center" data-testid="ul-msg">{msg}</p>}
                </div>
              </section>
            )}

            {/* Tonight's lineup */}
            <section>
              <h2 className="text-xs uppercase tracking-[0.3em] text-white/60 mb-3">Tonight's lineup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="ul-lineup">
                {battles.filter((b) => b.status !== "live").map((b) => (
                  <div key={b.battle_id} className="rounded-2xl bg-black/40 border border-white/10 p-4" data-testid={`ul-battle-${b.battle_id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-rose-300/80">
                        {b.kind === "music" ? "🎤 Music" : "💃 Dance"} · {b.status}
                      </span>
                      <Crown className="w-3 h-3 text-amber-400/60" />
                    </div>
                    <h3 className="text-base font-black text-white mt-1">{b.title}</h3>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {new Date(b.starts_at_iso).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-amber-200 mt-2">
                      Pool ₵{b.pool_vibe.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/70 mt-2">
                      {b.contestants.map((c) => c.name).join(" vs ")}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
