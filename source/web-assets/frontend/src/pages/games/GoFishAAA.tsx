/**
 * Go Fish AAA — Universal prototype, ocean variant (teal felt + driftwood).
 * Reuses SpadesTable + SpadesSeat + SpadesGameMenu + SpadesPlayerProfile
 * + SpadesCommunityChat. The hand fan is non-playable (cards aren't played
 * by tap — instead they're "asked for"), so we render a passive hand strip
 * + an explicit Ask button that opens GoFishAskModal.
 *
 * Per-seat progress pill: shows BOOKS COLLECTED (higher = better).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Fish, Loader2, Send } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import GoFishAskModal from "@/components/go-fish-aaa/GoFishAskModal";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

interface GfPlayer { card_count: number; books: string[]; books_count: number; }
interface GfRaw {
  user_position: SpadesPosition;
  phase: "playing" | "finished";
  turn: SpadesPosition;
  pool_count: number;
  your_hand: CardData[];
  askable_ranks: string[];
  askable_targets: SpadesPosition[];
  players_data: Record<SpadesPosition, GfPlayer>;
  match_winner: SpadesPosition | null;
  last_action: {
    asker?: SpadesPosition;
    target?: SpadesPosition;
    rank?: string;
    received_count?: number;
    booked?: string[];
    go_fish?: boolean;
    drew?: CardData | null;
    lucky?: boolean;
    drew_only?: boolean;
    passed?: boolean;
  } | null;
  public_asks: Array<{ asker: SpadesPosition; target: SpadesPosition; rank: string }>;
  play_sequence?: Array<{
    asker?: SpadesPosition;
    target?: SpadesPosition;
    rank?: string;
    received_count?: number;
    booked?: string[];
    go_fish?: boolean;
    drew?: CardData | null;
    lucky?: boolean;
    drew_only?: boolean;
    passed?: boolean;
  }>;
}

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Sailor",
  south: "You",
  east:  "Captain",
  west:  "Pearl",
};

const POSITION_LABEL: Record<SpadesPosition, string> = {
  north: "North", east: "East", south: "South", west: "West",
};

function adapt(raw: GfRaw): {
  players: Record<SpadesPosition, SpadesPlayerView>;
  scores: SpadesScores;
} {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, GfPlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      // Pill semantics: bid=13 (max books), tricks=books_count (higher = closer).
      bid: 13,
      tricks: p?.books_count ?? 0,
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : BOT_NAMES[pos],
    };
  });
  const total1 = (safe.north?.books_count ?? 0) + (safe.south?.books_count ?? 0);
  const total2 = (safe.east?.books_count ?? 0)  + (safe.west?.books_count ?? 0);
  return { players, scores: { team1: { points: total1, bags: 0 }, team2: { points: total2, bags: 0 } } };
}

const SUIT_GLYPH: Record<string, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
const SUIT_COLOR: Record<string, string> = { spades: "text-slate-900", clubs: "text-slate-900", hearts: "text-rose-600", diamonds: "text-rose-600" };

export default function GoFishAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<GfRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [dealing, setDealing] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "cyan", ttl = 2200) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/go-fish-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Failed to start", "rose");
        return;
      }
      setRaw(data.game as GfRaw);
      setPhase("game");
      setDealing(true);
      window.setTimeout(() => setDealing(false), 2400);
      flash("Go Fish · Match underway", "cyan");
    } finally {
      setBusy(false);
    }
  }, [flash]);

  const ask = useCallback(async (target: SpadesPosition, rank: string) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/go-fish-practice/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, rank }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Cannot ask that", "rose");
        return;
      }
      const next = data.game as GfRaw;
      setAskOpen(false);
      // Stage the ask sequence one event at a time so the user sees
      // each opponent's request + result before the next one fires.
      const seq = next.play_sequence ?? [];
      if (seq.length === 0) {
        setRaw(next);
        return;
      }
      for (const ev of seq) {
        if (ev.passed) {
          flash(`${BOT_NAMES[ev.asker ?? "north"]} passed`, "cyan", 800);
        } else if (ev.drew_only) {
          flash(`${BOT_NAMES[ev.asker ?? "north"]} drew a card`, "cyan", 800);
          if (ev.booked && ev.booked.length) {
            await new Promise<void>((r) => setTimeout(r, 700));
            flash(`${BOT_NAMES[ev.asker ?? "north"]} booked ${ev.booked.join(", ")}`, "emerald", 1200);
          }
        } else if (ev.go_fish) {
          flash(`${BOT_NAMES[ev.asker ?? "north"]} asked ${BOT_NAMES[ev.target ?? "north"]}: any ${ev.rank}s? · GO FISH`, "rose", 1100);
          await new Promise<void>((r) => setTimeout(r, 800));
          if (ev.lucky) {
            flash(`${BOT_NAMES[ev.asker ?? "north"]} drew the ${ev.rank}!`, "emerald", 950);
          }
        } else if (ev.received_count) {
          flash(`${BOT_NAMES[ev.asker ?? "north"]} took ${ev.received_count} ${ev.rank}${(ev.received_count ?? 0) > 1 ? "s" : ""} from ${BOT_NAMES[ev.target ?? "north"]}`, "emerald", 1100);
          if (ev.booked && ev.booked.length) {
            await new Promise<void>((r) => setTimeout(r, 700));
            flash(`${BOT_NAMES[ev.asker ?? "north"]} booked ${ev.booked.join(", ")}`, "emerald", 1200);
          }
        }
        await new Promise<void>((r) => setTimeout(r, 700));
      }
      setRaw(next);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash]);

  const backToLobby = () => {
    setRaw(null);
    setPhase("lobby");
    setAskOpen(false);
  };

  // Auto-open ask modal when it's the user's turn (phase === playing)
  useEffect(() => {
    if (raw?.phase === "playing" && raw.turn === raw.user_position && !dealing) {
      setAskOpen(true);
    }
  }, [raw?.phase, raw?.turn, raw?.user_position, dealing]);

  if (phase === "lobby") {
    return (
      <div
        className="min-h-screen bg-[#020707] text-white relative overflow-x-hidden"
        data-testid="go-fish-aaa-lobby"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-cyan-500/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-cyan-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="go-fish-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-700 shadow-[0_0_24px_rgba(20,184,166,0.45)]">
              <Fish className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Card Room · Go Fish
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Go Fish AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-cyan-400/20 text-sm text-cyan-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • 52-card deck · 5 cards each · rest is the pool<br />
            • Ask another player for a rank you already hold<br />
            • Got a match? Take all of them and ask again<br />
            • No match? <em>Go Fish</em> — draw 1 (lucky pull = ask again)<br />
            • Collect all 4 of a rank to claim a <strong>book</strong><br />
            • Most books when the pool is empty wins
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(20,184,166,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="go-fish-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="min-h-screen bg-[#020707] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourTurn = raw.turn === youPosition && raw.phase === "playing";
  const finished = raw.phase === "finished";

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#022a2a] via-[#021515] to-[#020707] text-white relative overflow-x-hidden"
      data-testid="go-fish-aaa"
    >
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-cyan-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="go-fish-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold">
              Go Fish
            </div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1">
                <Bot className="w-2.5 h-2.5" /> AI
              </span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-200 font-bold tabular-nums">
              Pool · {raw.pool_count}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="GO FISH" variant="ocean">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
              <SpadesSeat position="east"  player={players.east}  isTurn={raw.turn === "east"}  isYou={youPosition === "east"}  onClick={() => setProfileOpen("east")} />
              <SpadesSeat position="west"  player={players.west}  isTurn={raw.turn === "west"}  isYou={youPosition === "west"}  onClick={() => setProfileOpen("west")} />
            </SpadesTable>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          {/* Passive hand strip — Go Fish doesn't play cards by tap */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-3" data-testid="go-fish-hand-strip">
            {raw.your_hand.map((c, idx) => (
              <div
                key={`${c.suit}-${c.rank}-${idx}`}
                className="w-10 h-14 md:w-12 md:h-16 rounded-md bg-white border-2 border-cyan-200 shadow flex flex-col items-center justify-between p-0.5"
              >
                <span className={`text-[10px] font-bold leading-none ${SUIT_COLOR[c.suit]}`}>{c.rank}</span>
                <span className={`text-xl ${SUIT_COLOR[c.suit]}`}>{SUIT_GLYPH[c.suit]}</span>
                <span className={`text-[10px] font-bold leading-none rotate-180 ${SUIT_COLOR[c.suit]}`}>{c.rank}</span>
              </div>
            ))}
            {raw.your_hand.length === 0 ? (
              <div className="text-cyan-300/60 text-sm italic">No cards · waiting for pool</div>
            ) : null}
          </div>

          <div className="flex justify-center gap-3">
            {isYourTurn ? (
              <button
                onClick={() => setAskOpen(true)}
                disabled={busy || raw.askable_ranks.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(34,211,238,0.45)] disabled:opacity-40 flex items-center gap-2"
                style={{ fontFamily: "'Cinzel', serif" }}
                data-testid="go-fish-ask-btn"
              >
                <Send className="w-4 h-4" /> Ask
              </button>
            ) : !finished ? (
              <div className="text-cyan-300/60 text-xs uppercase tracking-[0.3em] font-bold">
                {BOT_NAMES[raw.turn]} is thinking…
              </div>
            ) : null}
          </div>

          {finished ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-[#020707] border-2 border-cyan-400/40 text-center"
              data-testid="go-fish-aaa-finished-footer"
            >
              <Fish className="w-10 h-10 mx-auto mb-2 text-cyan-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : `${BOT_NAMES[raw.match_winner ?? "north"]} wins`}
              </h2>
              <p className="text-cyan-200/70 mb-4 text-sm">
                Books are tallied — most books takes the haul.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold disabled:opacity-50" data-testid="go-fish-aaa-replay-btn">
                  Play Again
                </button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 font-bold" data-testid="go-fish-aaa-lobby-btn">
                  Back to Lobby
                </button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <GoFishAskModal
        open={askOpen && isYourTurn}
        busy={busy}
        askableRanks={raw.askable_ranks}
        askableTargets={raw.askable_targets}
        positionLabel={POSITION_LABEL}
        onSubmit={ask}
        onClose={() => setAskOpen(false)}
      />

      <SpadesPlayerProfile
        open={profileOpen !== null}
        position={profileOpen}
        player={profileOpen ? players[profileOpen] : null}
        isYou={profileOpen === youPosition}
        onClose={() => setProfileOpen(null)}
      />
      <SpadesCommunityChat open={chatOpen} gameId={`go-fish-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
