/**
 * Gin Rummy AAA — Universal prototype, gold variant, 2-player density.
 * Reuses SpadesTable + SpadesSeat (north only — south hidden by design)
 * + SpadesGameMenu + SpadesPlayerProfile + SpadesCommunityChat.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Hand } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

interface GrCard extends CardData { in_meld?: boolean; meld_id?: number; }
interface GrPlayer { card_count: number; score: number; }
interface GrMeldGroup { kind: "set" | "run"; label: string; indices: number[]; size: number; }
interface GrRaw {
  user_position: SpadesPosition;
  phase: "draw" | "discard" | "scoring" | "finished";
  turn: SpadesPosition;
  stock_count: number;
  top_discard: CardData | null;
  your_hand: GrCard[];
  your_deadwood: number;
  meld_groups?: GrMeldGroup[];
  can_knock: boolean;
  is_gin: boolean;
  scores: Record<SpadesPosition, number>;
  players_data: Record<SpadesPosition, GrPlayer>;
  match_winner: SpadesPosition | null;
  hand_summary: { scorer: SpadesPosition | null; outcome: string; points: number; knocker_deadwood?: number; defender_deadwood?: number } | null;
  last_action: { player?: SpadesPosition; drew?: CardData; from?: string; discarded?: CardData; knock?: boolean } | null;
  play_sequence?: Array<{ player: SpadesPosition; drew_from?: string; discarded?: CardData; knock?: boolean; end?: boolean; gin?: boolean }>;
}

const SUIT_GLYPH: Record<string, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
const SUIT_COLOR: Record<string, string> = { spades: "text-slate-900", clubs: "text-slate-900", hearts: "text-rose-800", diamonds: "text-rose-800" };

function CardFace({ card, onClick, in_meld, selected }: { card: GrCard; onClick?: () => void; in_meld?: boolean; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative w-12 h-16 md:w-14 md:h-20 rounded-md bg-white border-2 shadow flex flex-col items-center justify-between p-0.5 transition transform ${
        selected ? "border-amber-400 ring-2 ring-amber-300 -translate-y-2 shadow-[0_0_12px_rgba(245,158,11,0.55)]"
        : in_meld ? "border-amber-400/70 hover:border-amber-300 hover:-translate-y-1"
        : "border-slate-300 hover:border-amber-300 hover:-translate-y-1"
      }`}
      data-testid={`gin-card-${card.suit}-${card.rank}`}
    >
      <span className={`text-[10px] font-bold leading-none ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
      <span className={`text-2xl ${SUIT_COLOR[card.suit]}`}>{SUIT_GLYPH[card.suit]}</span>
      <span className={`text-[10px] font-bold leading-none rotate-180 ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
      {in_meld && !selected ? (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
      ) : null}
    </button>
  );
}

function adapt(raw: GrRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, GrPlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 100,  // pill semantics: progress towards 100-pt match
      tricks: p?.score ?? 0,
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : "Opponent",
    };
  });
  return {
    players,
    scores: {
      team1: { points: (raw.scores?.south ?? 0), bags: 0 },
      team2: { points: (raw.scores?.north ?? 0), bags: 0 },
    },
  };
}

export default function GinRummyAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<GrRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [discardSelected, setDiscardSelected] = useState<GrCard | null>(null);
  const [showKnock, setShowKnock] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "amber", ttl = 2200) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/gin-rummy-practice/start`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as GrRaw);
      setPhase("game");
      flash("Gin Rummy · Match underway", "amber");
    } finally { setBusy(false); }
  }, [flash]);

  const drawStock = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/gin-rummy-practice/draw-stock`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot draw", "rose"); return; }
      setRaw(data.game as GrRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const takeDiscard = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/gin-rummy-practice/take-discard`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot take", "rose"); return; }
      setRaw(data.game as GrRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const submitDiscard = useCallback(async (knock: boolean) => {
    if (!raw || busy || !discardSelected) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/gin-rummy-practice/discard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: discardSelected, knock }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Discard rejected", "rose"); return; }
      setDiscardSelected(null);
      setShowKnock(false);
      if (knock) flash("Knock!", "amber", 1800);
      // Stage bot turn one event at a time so the user sees what
      // happened: first the bot drew (top discard taken or stock face-
      // down), then the bot discarded their card. Mirror of Spades AAA.
      const next = data.game as GrRaw;
      const seq = next.play_sequence ?? [];
      if (seq.length === 0) {
        setRaw(next);
        return;
      }
      for (const ev of seq) {
        if (ev.drew_from === "discard") {
          flash("Opponent took the discard", "amber", 900);
        } else if (ev.drew_from === "stock") {
          flash("Opponent drew from stock", "amber", 900);
        }
        await new Promise<void>((r) => setTimeout(r, 800));
        if (ev.discarded) {
          flash(`Opponent discarded ${ev.discarded.rank}${ev.discarded.suit[0].toUpperCase()}${ev.knock ? " · KNOCK" : ev.gin ? " · GIN" : ""}`, ev.knock || ev.gin ? "emerald" : "amber", 1100);
          // Briefly reflect the discarded card on top so the user sees
          // it before the authoritative state lands.
          setRaw((prev) => prev ? { ...prev, top_discard: ev.discarded! } : prev);
          await new Promise<void>((r) => setTimeout(r, 700));
        }
        if (ev.end) break;
      }
      setRaw(next);
    } finally { setBusy(false); }
  }, [raw, busy, discardSelected, flash]);

  const newHand = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/gin-rummy-practice/new-hand`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot start next hand", "rose"); return; }
      setRaw(data.game as GrRaw);
      flash("New hand · dealt", "amber");
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); setDiscardSelected(null); };

  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#0a0604] text-white relative overflow-x-hidden" data-testid="gin-rummy-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-amber-500/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-amber-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="gin-rummy-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 shadow-[0_0_24px_rgba(245,158,11,0.45)]">
              <Hand className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Card Room · Gin Rummy
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Gin Rummy AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-amber-400/20 text-sm text-amber-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • Head-to-head · 52-card deck · 10 cards each<br />
            • Pick STOCK or top of DISCARD · then discard 1<br />
            • Form melds: <strong>3+ of a rank</strong> (set) or <strong>3+ in suit-sequence</strong> (run)<br />
            • <strong>KNOCK</strong> when deadwood ≤ 10 · <strong>GIN</strong> = 0 deadwood (+25 bonus)<br />
            • <strong>UNDERCUT</strong> if defender has less deadwood (+25)<br />
            • First to 100 points wins the match
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(245,158,11,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="gin-rummy-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#0a0604] flex items-center justify-center"><Loader2 className="w-12 h-12 text-amber-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourTurn = raw.turn === youPosition && (raw.phase === "draw" || raw.phase === "discard");
  const finished = raw.phase === "finished";
  const scoring = raw.phase === "scoring";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#160a02] via-[#0a0604] to-[#050302] text-white relative overflow-x-hidden" data-testid="gin-rummy-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-amber-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="gin-rummy-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold">Gin Rummy</div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold tabular-nums">
              Stock · {raw.stock_count}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="GIN RUMMY" variant="gold" density="2p" centreGlyph="G">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
            </SpadesTable>
            {/* Stock + Discard piles centred on the felt */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] z-20 flex items-center gap-3 pointer-events-auto">
              <button
                onClick={isYourTurn && raw.phase === "draw" ? drawStock : undefined}
                disabled={!isYourTurn || raw.phase !== "draw" || busy}
                className={`w-12 h-16 md:w-14 md:h-20 rounded-md bg-gradient-to-br from-amber-700 to-amber-950 border-2 border-amber-300/60 shadow-lg flex items-center justify-center transition hover:scale-105 ${
                  isYourTurn && raw.phase === "draw" ? "cursor-pointer ring-2 ring-amber-300/70" : "cursor-default opacity-80"
                }`}
                data-testid="gin-rummy-stock-btn"
              >
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-amber-200 -rotate-90">VIBEZ</span>
              </button>
              <div className="text-amber-200 text-[10px] uppercase tracking-widest font-bold">vs</div>
              <button
                onClick={isYourTurn && raw.phase === "draw" ? takeDiscard : undefined}
                disabled={!isYourTurn || raw.phase !== "draw" || !raw.top_discard || busy}
                className={`w-12 h-16 md:w-14 md:h-20 rounded-md bg-white border-2 shadow-lg flex flex-col items-center justify-between p-0.5 transition hover:scale-105 ${
                  isYourTurn && raw.phase === "draw" ? "cursor-pointer border-amber-400 ring-2 ring-amber-300/70" : "cursor-default border-slate-300 opacity-90"
                }`}
                data-testid="gin-rummy-take-discard-btn"
              >
                {raw.top_discard ? (
                  <>
                    <span className={`text-[10px] font-bold leading-none ${SUIT_COLOR[raw.top_discard.suit]}`}>{raw.top_discard.rank}</span>
                    <span className={`text-2xl ${SUIT_COLOR[raw.top_discard.suit]}`}>{SUIT_GLYPH[raw.top_discard.suit]}</span>
                    <span className={`text-[10px] font-bold leading-none rotate-180 ${SUIT_COLOR[raw.top_discard.suit]}`}>{raw.top_discard.rank}</span>
                  </>
                ) : <span className="text-slate-400 text-xs">empty</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          {/* Deadwood + Knock controls */}
          <div className="flex justify-center items-center gap-3 mb-3" data-testid="gin-rummy-status">
            <div className="px-3 py-1 rounded-full bg-slate-900/70 border border-amber-400/30 text-amber-200 text-xs font-bold">
              Deadwood: <span className="text-amber-100" data-testid="gin-rummy-deadwood">{raw.your_deadwood}</span>
            </div>
            {raw.is_gin ? (
              <div className="px-3 py-1 rounded-full bg-amber-500/30 border border-amber-300 text-amber-100 text-xs font-black uppercase tracking-widest">
                Gin!
              </div>
            ) : raw.can_knock ? (
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-bold">
                You can knock
              </div>
            ) : null}
          </div>

          {/* Hand — grouped by meld so the player can SEE their pairs/runs.
              Each meld_id is rendered as its own bordered group with a
              label badge. Loose cards (meld_id = -1) trail at the end as
              the "deadwood" column. Fix Feb 2026 (round 2): user said
              "matches don't sink nor the different pairs" — so we now
              auto-group cards by their best-meld-partition assignment
              from the backend. */}
          {(() => {
            const groups: Record<number, GrCard[]> = {};
            const order: number[] = [];
            raw.your_hand.forEach((c) => {
              const id = c.meld_id ?? -1;
              if (!(id in groups)) { groups[id] = []; order.push(id); }
              groups[id].push(c);
            });
            // Render melds first (id >= 0), deadwood last (id = -1)
            order.sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b));
            const labelFor = (id: number): string | null => {
              if (id === -1) return null;
              const g = (raw.meld_groups ?? []).find((mg) => raw.your_hand.find((c) => c.meld_id === id) !== undefined);
              return raw.meld_groups?.[id]?.label ?? null;
            };
            return (
              <div className="flex flex-wrap justify-center items-end gap-3 mb-3" data-testid="gin-rummy-hand-strip">
                {order.map((id) => (
                  <div
                    key={id}
                    className={`flex flex-col items-center gap-1 ${
                      id === -1
                        ? "px-2 pt-1 rounded-lg border border-slate-700/50"
                        : "px-2 pt-1 rounded-lg border border-amber-500/40 bg-amber-500/5"
                    }`}
                    data-testid={`gin-rummy-meld-group-${id}`}
                  >
                    <div className="flex flex-wrap items-end gap-1">
                      {groups[id].map((c, idx) => (
                        <CardFace
                          key={`${c.suit}-${c.rank}-${id}-${idx}`}
                          card={c}
                          in_meld={c.in_meld}
                          selected={!!discardSelected && discardSelected.suit === c.suit && discardSelected.rank === c.rank}
                          onClick={raw.phase === "discard" && raw.turn === youPosition ? () => setDiscardSelected(c) : undefined}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-[8px] md:text-[9px] uppercase tracking-[0.18em] font-bold ${
                        id === -1 ? "text-slate-500" : "text-amber-300"
                      }`}
                    >
                      {id === -1 ? `Deadwood · ${groups[id].length}` : (labelFor(id) ?? `Meld ${id + 1}`)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex justify-center gap-3 flex-wrap">
            {raw.phase === "discard" && raw.turn === youPosition ? (
              <>
                <button
                  onClick={() => submitDiscard(false)}
                  disabled={!discardSelected || busy}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(245,158,11,0.45)] disabled:opacity-40"
                  data-testid="gin-rummy-discard-btn"
                >
                  Discard
                </button>
                {raw.can_knock || raw.is_gin ? (
                  <button
                    onClick={() => submitDiscard(true)}
                    disabled={!discardSelected || busy}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(16,185,129,0.45)] disabled:opacity-40"
                    data-testid="gin-rummy-knock-btn"
                  >
                    {raw.is_gin ? "Gin!" : "Knock"}
                  </button>
                ) : null}
              </>
            ) : null}
            {scoring ? (
              <button
                onClick={newHand}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50"
                data-testid="gin-rummy-next-hand-btn"
              >
                Next Hand
              </button>
            ) : null}
          </div>

          {raw.hand_summary && scoring ? (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.04] border border-amber-400/30 text-center" data-testid="gin-rummy-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.outcome.toUpperCase()}
              </p>
              <p className="text-amber-100">
                {raw.hand_summary.scorer === youPosition ? "You" : raw.hand_summary.scorer === null ? "Stalemate" : "Opponent"} +{raw.hand_summary.points}
              </p>
            </div>
          ) : null}

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 to-[#050302] border-2 border-amber-400/40 text-center" data-testid="gin-rummy-aaa-finished-footer">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-amber-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : "Opponent wins"}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50" data-testid="gin-rummy-aaa-replay-btn">Play Again</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 font-bold" data-testid="gin-rummy-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`gin-rummy-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
