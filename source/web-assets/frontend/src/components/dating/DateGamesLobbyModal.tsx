/**
 * Date Games lobby — primary CTA from every /dating/matches card.
 * Starts a match-scoped Date Night Session (shared room), not practice pages.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Flame, Swords, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Pack = {
  id: string;
  name: string;
  tagline: string;
  phases: string[];
  headline?: boolean;
  board_game?: string | null;
  arena?: { name: string; label: string; duration: string; description: string } | null;
};

type MatchLike = {
  match_id: string;
  user?: { user_id: string; name?: string };
  username?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  match: MatchLike | null;
};

export default function DateGamesLobbyModal({ isOpen, onClose, match }: Props) {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    authFetch(`${API}/api/dating-games/session/catalog`)
      .then((r) => r.json())
      .then((d) => setPacks(d.packs || []))
      .catch(() =>
        setPacks([
          {
            id: "warm_up",
            name: "Warm-Up Pack",
            tagline: "Soft WYR → icebreakers → chemistry",
            phases: ["soft_wyr", "icebreaker", "chemistry"],
          },
          {
            id: "build_a_night",
            name: "Build-a-Night",
            tagline: "Design the date — AI planner finishes it",
            phases: ["build_a_night", "chemistry", "planner"],
            headline: true,
          },
          {
            id: "full_arc",
            name: "Full Date Night Arc",
            tagline: "Warm-up → Build-a-Night → chemistry → plan",
            phases: ["soft_wyr", "icebreaker", "build_a_night", "chemistry", "planner"],
          },
          {
            id: "arena_tictactoe",
            name: "Arena · Tic-Tac-Toe",
            tagline: "Marble grid. Tournament tempo.",
            phases: ["board", "chemistry"],
            board_game: "tictactoe",
          },
          {
            id: "arena_connect4",
            name: "Arena · Connect 4",
            tagline: "Navy felt. Glass discs.",
            phases: ["board", "chemistry"],
            board_game: "connect4",
          },
          {
            id: "arena_chess",
            name: "Arena · Chess",
            tagline: "Walnut & brass. Slow burn.",
            phases: ["board", "chemistry"],
            board_game: "chess",
          },
        ]),
      );
  }, [isOpen]);

  const partnerId = match?.user?.user_id;
  const partnerName = match?.user?.name || match?.username || "your match";

  const startPack = async (packId: string) => {
    if (!match?.match_id || !partnerId) return;
    setBusy(packId);
    setError(null);
    try {
      const r = await authFetch(`${API}/api/dating-games/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_type: "date_night",
          pack_id: packId,
          match_id: match.match_id,
          partner_id: partnerId,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.message || "Could not start Date Night",
        );
      }
      const sid = data.session_id || data.session?.session_id;
      const dest = data.redirect_to || `/dating/date-night/${sid}`;
      onClose();
      navigate(dest);
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    } finally {
      setBusy(null);
    }
  };

  const talkPacks = packs.filter((p) => !p.board_game);
  const arenaPacks = packs.filter((p) => p.board_game);

  return (
    <AnimatePresence>
      {isOpen && match && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="date-games-lobby"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-200/20 bg-[#120c08] text-[#f4ebe0] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse at top, rgba(180,120,60,0.25), transparent 55%), linear-gradient(180deg,#1a120c 0%,#0b0908 100%)",
              }}
            />
            <div className="relative p-6 sm:p-8">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10"
                data-testid="date-games-lobby-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="text-[11px] tracking-[0.28em] uppercase text-amber-200/70 mb-2">
                Date Night Session
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-[#f7f0e6] mb-1">
                Date Games with {partnerName}
              </h2>
              <p className="text-sm text-[#d4c4b0]/80 mb-6">
                Shared room. Progressive beats. Chemistry reveal at the end.
              </p>

              {error && (
                <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
                  {error}
                </div>
              )}

              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-amber-100/60 mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Get to know you
                </h3>
                <div className="grid gap-3">
                  {talkPacks.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!busy}
                      onClick={() => startPack(p.id)}
                      data-testid={`date-pack-${p.id}`}
                      className={`text-left rounded-2xl border px-4 py-4 transition ${
                        p.headline
                          ? "border-amber-300/50 bg-gradient-to-r from-[#3a2410] to-[#1a120c] ring-1 ring-amber-200/30"
                          : "border-white/10 bg-white/[0.03] hover:border-amber-200/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium text-[#f7f0e6]">{p.name}</span>
                            {p.headline && (
                              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-100">
                                Headline
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#cbb9a4] mt-1">{p.tagline}</p>
                        </div>
                        {busy === p.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-amber-200" />
                        ) : p.id === "build_a_night" ? (
                          <Flame className="w-5 h-5 text-amber-300" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-amber-200/70" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-amber-100/60 mb-3">
                  <Swords className="w-3.5 h-3.5" /> Competitive arena
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {arenaPacks.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!busy}
                      onClick={() => startPack(p.id)}
                      data-testid={`date-pack-${p.id}`}
                      className="rounded-2xl border border-[#3d2a18] bg-[#0e0b08] hover:border-amber-200/40 p-4 text-left min-h-[120px]"
                    >
                      <p className="text-[10px] tracking-[0.22em] uppercase text-amber-200/50 mb-2">
                        {p.arena?.label || "Arena"}
                      </p>
                      <p className="text-base font-medium text-[#f3e8d8]">{p.name.replace("Arena · ", "")}</p>
                      <p className="text-xs text-[#b8a48c] mt-2 leading-relaxed">{p.tagline}</p>
                      {busy === p.id && (
                        <Loader2 className="w-4 h-4 animate-spin mt-3 text-amber-200" />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
