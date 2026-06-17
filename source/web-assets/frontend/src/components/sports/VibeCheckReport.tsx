/**
 * VibeCheckReport — crowdsourced score report widget for a settled bet.
 *
 * Wired into the Sports Lounge "My Bets" row. One click pops the modal,
 * user picks who won, we POST to /api/integrity/report. Once 10 reports
 * arrive on the same game, an admin can call /api/integrity/resolve to
 * settle + ban dishonest reporters.
 */
import { useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface Props {
  gameId: string;
  homeName: string;
  awayName: string;
  homeId: string;
  awayId: string;
}

export default function VibeCheckReport({ gameId, homeName, awayName, homeId, awayId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (winnerId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await authFetch(`${API}/api/integrity/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, reported_winner: winnerId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't report");
      setDone(d?.status === "already_reported" ? "You already reported this game." : "Vibe Check submitted — thanks!");
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`vibe-check-trigger-${gameId}`}
        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300/80 hover:text-emerald-200 transition"
      >
        <ShieldCheck className="w-3 h-3" /> Vibe Check
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid="vibe-check-modal"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0a1218] border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="vibe-check-close"
              className="absolute top-3 right-3 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base uppercase tracking-widest text-emerald-300">Vibe Check</h3>
            </div>
            <p className="text-xs text-white/60 mb-4">
              Crowdsourced fairness — 10 reports at 75% agreement settle the game.
              Genius chair-holders count for 2 votes. Lying earns a strike; 3 strikes = permanent ban.
            </p>
            {done ? (
              <p className="text-emerald-300 text-sm mb-4" data-testid="vibe-check-done">{done}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => submit(homeId)}
                  disabled={busy}
                  data-testid={`vibe-check-pick-${homeId}`}
                  className="rounded-lg bg-emerald-900/30 border border-emerald-500/30 px-4 py-3 text-sm text-white hover:bg-emerald-800/40 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : homeName}
                </button>
                <button
                  type="button"
                  onClick={() => submit(awayId)}
                  disabled={busy}
                  data-testid={`vibe-check-pick-${awayId}`}
                  className="rounded-lg bg-emerald-900/30 border border-emerald-500/30 px-4 py-3 text-sm text-white hover:bg-emerald-800/40 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : awayName}
                </button>
              </div>
            )}
            {err && <p className="text-rose-300 text-xs mt-3" data-testid="vibe-check-error">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
