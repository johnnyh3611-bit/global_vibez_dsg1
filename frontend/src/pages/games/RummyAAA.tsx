/**
 * Rummy AAA — Universal prototype, jade variant, 4-player density.
 * 13-card Indian Rummy with auto-grouping declare flow.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Trophy } from "lucide-react";
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

interface RummyCard extends CardData { in_meld?: boolean; is_joker?: boolean; is_wild?: boolean; meld_id?: number; joker_id?: string | number; }
interface RummyPlayer { card_count: number; score: number; active: boolean; }
interface RummyMeldGroup { kind: "set" | "run"; label: string; indices: number[]; size: number; }
interface RummyRaw {
  user_position: SpadesPosition;
  num_players: number;
  active_positions: SpadesPosition[];
  phase: "draw" | "discard" | "scoring" | "finished";
  turn: SpadesPosition;
  stock_count: number;
  top_discard: CardData | null;
  wildcard_rank: string;
  your_hand: RummyCard[];
  your_deadwood: number;
  meld_groups?: RummyMeldGroup[];
  auto_groups: RummyCard[][];
  can_declare: boolean;
  scores: Record<SpadesPosition, number>;
  players_data: Record<SpadesPosition, RummyPlayer>;
  match_winner: SpadesPosition | null;
  hand_summary: { scorer: SpadesPosition | null; outcome: string; opp_deadwood?: Record<string, number> } | null;
  last_action: { player?: SpadesPosition; drew?: CardData; from?: string; discarded?: CardData } | null;
  play_sequence?: Array<{ player: SpadesPosition; drew_from?: string; discarded?: CardData }>;
}

const SUIT_GLYPH: Record<string, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦", joker: "★" };
const SUIT_COLOR: Record<string, string> = {
  spades: "text-slate-900", clubs: "text-slate-900",
  hearts: "text-rose-800", diamonds: "text-rose-800",
  joker: "text-violet-700",
};

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Vipers", south: "You", east: "Cobras", west: "Hawks",
};

function CardFace({ card, onClick, in_meld, selected, isWild }: { card: RummyCard; onClick?: () => void; in_meld?: boolean; selected?: boolean; isWild?: boolean }) {
  const isJoker = card.is_joker;
  if (isJoker) {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className={`relative w-10 h-14 md:w-12 md:h-16 rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-700 border-2 shadow flex flex-col items-center justify-between p-0.5 transition transform ${
          selected ? "border-amber-300 ring-2 ring-amber-200 -translate-y-2 shadow-[0_0_12px_rgba(251,191,36,0.55)]"
          : in_meld ? "border-emerald-300 hover:-translate-y-1"
          : "border-white/40 hover:-translate-y-1"
        }`}
        data-testid={`rummy-card-joker-${card.joker_id ?? 0}`}
      >
        <span className="text-[8px] font-black tracking-widest text-white leading-none">JKR</span>
        <span className="text-2xl text-white drop-shadow">🃏</span>
        <span className="text-[8px] font-black tracking-widest text-white leading-none rotate-180">JKR</span>
        {in_meld && !selected ? <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-300" /> : null}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative w-10 h-14 md:w-12 md:h-16 rounded-md bg-white border-2 shadow flex flex-col items-center justify-between p-0.5 transition transform ${
        selected ? "border-emerald-400 ring-2 ring-emerald-300 -translate-y-2 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
        : in_meld ? "border-emerald-400/60 hover:border-emerald-300 hover:-translate-y-1"
        : isWild ? "border-violet-400/70 hover:border-violet-300 hover:-translate-y-1"
        : "border-slate-300 hover:border-emerald-300 hover:-translate-y-1"
      }`}
      data-testid={`rummy-card-${card.suit}-${card.rank}`}
    >
      <span className={`text-[9px] font-bold leading-none ${SUIT_COLOR[card.suit] ?? "text-slate-900"}`}>{card.rank}</span>
      <span className={`text-xl ${SUIT_COLOR[card.suit] ?? "text-slate-900"}`}>{SUIT_GLYPH[card.suit]}</span>
      <span className={`text-[9px] font-bold leading-none rotate-180 ${SUIT_COLOR[card.suit] ?? "text-slate-900"}`}>{card.rank}</span>
      {isWild ? (
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500 border border-white text-white text-[8px] font-black flex items-center justify-center shadow" title="wildcard">
          W
        </div>
      ) : null}
      {in_meld && !selected && !isWild ? (
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
      ) : null}
    </button>
  );
}

function adapt(raw: RummyRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, RummyPlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 80,  // pill semantics: lower deadwood/score = better
      tricks: p?.score ?? 0,
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : BOT_NAMES[pos],
    };
  });
  return {
    players,
    scores: { team1: { points: raw.scores?.south ?? 0, bags: 0 }, team2: { points: raw.scores?.north ?? 0, bags: 0 } },
  };
}

export default function RummyAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<RummyRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [discardSelected, setDiscardSelected] = useState<RummyCard | null>(null);
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(4);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "emerald", ttl = 2200) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const startMatch = useCallback(async (np?: number) => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_players: np ?? numPlayers }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as RummyRaw);
      setPhase("game");
      flash(`Rummy · Wildcard ${data.game?.wildcard_rank ?? ""}`, "emerald");
    } finally { setBusy(false); }
  }, [flash, numPlayers]);

  const drawStock = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/draw-stock`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot draw", "rose"); return; }
      setRaw(data.game as RummyRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const takeDiscard = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/take-discard`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot take", "rose"); return; }
      setRaw(data.game as RummyRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const submitDiscard = useCallback(async () => {
    if (!raw || busy || !discardSelected) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/discard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: discardSelected }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Discard rejected", "rose"); return; }
      setDiscardSelected(null);
      // Stage bot turns: each bot's pick + discard plays out so the
      // user sees what every opponent did before settling.
      const next = data.game as RummyRaw;
      const seq = next.play_sequence ?? [];
      if (seq.length === 0) {
        setRaw(next);
        return;
      }
      for (const ev of seq) {
        if (ev.drew_from) {
          flash(`${BOT_NAMES[ev.player] ?? ev.player} ${ev.drew_from === "discard" ? "took the discard" : "drew from stock"}`, "emerald", 850);
          await new Promise<void>((r) => setTimeout(r, 700));
        }
        if (ev.discarded) {
          flash(`${BOT_NAMES[ev.player] ?? ev.player} discarded ${ev.discarded.rank}${ev.discarded.suit[0]?.toUpperCase() ?? ""}`, "emerald", 950);
          setRaw((prev) => prev ? { ...prev, top_discard: ev.discarded! } : prev);
          await new Promise<void>((r) => setTimeout(r, 750));
        }
      }
      setRaw(next);
    } finally { setBusy(false); }
  }, [raw, busy, discardSelected, flash]);

  const declare = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/declare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: raw.auto_groups }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Declaration invalid", "rose", 3500); return; }
      setRaw(data.game as RummyRaw);
      flash("Rummy! Hand declared", "emerald", 3000);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const newHand = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/rummy-practice/new-hand`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot start next hand", "rose"); return; }
      setRaw(data.game as RummyRaw);
      flash(`New hand · Wildcard ${data.game?.wildcard_rank}`, "emerald");
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); setDiscardSelected(null); };

  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#040804] text-white relative overflow-x-hidden" data-testid="rummy-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-emerald-500/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-emerald-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="rummy-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-[0_0_24px_rgba(16,185,129,0.45)]">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Card Salon · 13-Card Rummy
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Rummy AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-emerald-400/20 text-sm text-emerald-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • 2 decks + 4 jokers · 13 cards each · 2-4 players<br />
            • Wildcard rank announced at deal · printed jokers + every wildcard-rank card are wilds<br />
            • Pick STOCK or DISCARD · then discard 1 (always 13 in hand)<br />
            • <strong>DECLARE</strong> when you can arrange 13 cards into ≥2 sequences (≥1 PURE, no jokers) + valid sets<br />
            • Opponents score deadwood (capped 80) · first valid declare wins the match
          </div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-emerald-300/70 text-xs uppercase tracking-widest font-bold">Players</span>
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                onClick={() => setNumPlayers(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                  numPlayers === n ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                   : "bg-slate-900 border-slate-700 text-emerald-200 hover:border-emerald-400"
                }`}
                data-testid={`rummy-num-players-${n}`}
              >
                {n}P
              </button>
            ))}
          </div>
          <button
            onClick={() => startMatch()}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(16,185,129,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="rummy-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#040804] flex items-center justify-center"><Loader2 className="w-12 h-12 text-emerald-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourTurn = raw.turn === youPosition && (raw.phase === "draw" || raw.phase === "discard");
  const finished = raw.phase === "finished";
  const scoring = raw.phase === "scoring";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#03150b] via-[#040804] to-[#020402] text-white relative overflow-x-hidden" data-testid="rummy-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-emerald-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="rummy-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-300 font-bold">Rummy</div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-violet-200 font-bold">
              Wildcard · {raw.wildcard_rank}
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-200 font-bold tabular-nums">
              Stock · {raw.stock_count}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="RUMMY" variant="jade" centreGlyph="R">
              {raw.active_positions.includes("north") ? (
                <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
              ) : null}
              {raw.active_positions.includes("east") ? (
                <SpadesSeat position="east" player={players.east} isTurn={raw.turn === "east"} isYou={youPosition === "east"} onClick={() => setProfileOpen("east")} />
              ) : null}
              {raw.active_positions.includes("west") ? (
                <SpadesSeat position="west" player={players.west} isTurn={raw.turn === "west"} isYou={youPosition === "west"} onClick={() => setProfileOpen("west")} />
              ) : null}
            </SpadesTable>
            {/* Stock + discard centred */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] z-20 flex items-center gap-3 pointer-events-auto">
              <button
                onClick={isYourTurn && raw.phase === "draw" ? drawStock : undefined}
                disabled={!isYourTurn || raw.phase !== "draw" || busy}
                className={`w-12 h-16 md:w-14 md:h-20 rounded-md bg-gradient-to-br from-emerald-700 to-emerald-950 border-2 border-emerald-300/60 shadow-lg flex items-center justify-center transition hover:scale-105 ${
                  isYourTurn && raw.phase === "draw" ? "cursor-pointer ring-2 ring-emerald-300/70" : "cursor-default opacity-80"
                }`}
                data-testid="rummy-stock-btn"
              >
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-200 -rotate-90">VIBEZ</span>
              </button>
              <div className="text-emerald-200 text-[10px] uppercase tracking-widest font-bold">vs</div>
              <button
                onClick={isYourTurn && raw.phase === "draw" ? takeDiscard : undefined}
                disabled={!isYourTurn || raw.phase !== "draw" || !raw.top_discard || busy}
                className={`w-12 h-16 md:w-14 md:h-20 rounded-md bg-white border-2 shadow-lg flex flex-col items-center justify-between p-0.5 transition hover:scale-105 ${
                  isYourTurn && raw.phase === "draw" ? "cursor-pointer border-emerald-400 ring-2 ring-emerald-300/70" : "cursor-default border-slate-300 opacity-90"
                }`}
                data-testid="rummy-take-discard-btn"
              >
                {raw.top_discard ? (
                  <>
                    <span className={`text-[10px] font-bold leading-none ${SUIT_COLOR[raw.top_discard.suit] ?? "text-slate-900"}`}>{raw.top_discard.rank}</span>
                    <span className={`text-2xl ${SUIT_COLOR[raw.top_discard.suit] ?? "text-slate-900"}`}>{SUIT_GLYPH[raw.top_discard.suit] ?? "★"}</span>
                    <span className={`text-[10px] font-bold leading-none rotate-180 ${SUIT_COLOR[raw.top_discard.suit] ?? "text-slate-900"}`}>{raw.top_discard.rank}</span>
                  </>
                ) : <span className="text-slate-400 text-xs">empty</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          <div className="flex justify-center items-center gap-3 mb-3" data-testid="rummy-status">
            <div className="px-3 py-1 rounded-full bg-slate-900/70 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
              Deadwood: <span className="text-emerald-100" data-testid="rummy-deadwood">{raw.your_deadwood}</span>
            </div>
            {raw.can_declare ? (
              <div className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-300 text-emerald-100 text-xs font-black uppercase tracking-widest">
                Declarable!
              </div>
            ) : null}
          </div>

          {/* Hand — auto-grouped by meld so the player can SEE their
              sets/runs at a glance. Each meld_id rendered as its own
              jade-bordered group with a label badge. Loose cards trail
              as the deadwood column. Fix Feb 2026 (round 2): user said
              "matches don't sink nor the different pairs". */}
          {(() => {
            const groups: Record<number, RummyCard[]> = {};
            const order: number[] = [];
            raw.your_hand.forEach((c) => {
              const id = c.meld_id ?? -1;
              if (!(id in groups)) { groups[id] = []; order.push(id); }
              groups[id].push(c);
            });
            order.sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b));
            return (
              <div className="flex flex-wrap justify-center items-end gap-3 mb-3" data-testid="rummy-hand-strip">
                {order.map((id) => (
                  <div
                    key={id}
                    className={`flex flex-col items-center gap-1 ${
                      id === -1
                        ? "px-2 pt-1 rounded-lg border border-slate-700/50"
                        : "px-2 pt-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5"
                    }`}
                    data-testid={`rummy-meld-group-${id}`}
                  >
                    <div className="flex flex-wrap items-end gap-1">
                      {groups[id].map((c, idx) => (
                        <CardFace
                          key={`${c.suit}-${c.rank}-${id}-${idx}-${c.joker_id ?? ""}`}
                          card={c}
                          in_meld={c.in_meld}
                          isWild={c.is_wild}
                          selected={!!discardSelected && discardSelected.suit === c.suit && discardSelected.rank === c.rank && discardSelected.joker_id === c.joker_id}
                          onClick={raw.phase === "discard" && raw.turn === youPosition ? () => setDiscardSelected(c) : undefined}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-[8px] md:text-[9px] uppercase tracking-[0.18em] font-bold ${
                        id === -1 ? "text-slate-500" : "text-emerald-300"
                      }`}
                    >
                      {id === -1
                        ? `Deadwood · ${groups[id].length}`
                        : (raw.meld_groups?.[id]?.label ?? `Meld ${id + 1}`)}
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
                  onClick={submitDiscard}
                  disabled={!discardSelected || busy}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(16,185,129,0.45)] disabled:opacity-40"
                  data-testid="rummy-discard-btn"
                >
                  Discard
                </button>
                {raw.can_declare ? (
                  <button
                    onClick={declare}
                    disabled={busy}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(245,158,11,0.45)] disabled:opacity-40"
                    data-testid="rummy-declare-btn"
                  >
                    Declare
                  </button>
                ) : null}
              </>
            ) : null}
            {scoring ? (
              <button
                onClick={newHand}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-50"
                data-testid="rummy-next-hand-btn"
              >
                Next Hand
              </button>
            ) : null}
          </div>

          {raw.hand_summary && (scoring || finished) ? (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.04] border border-emerald-400/30 text-center" data-testid="rummy-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.outcome.toUpperCase()}
              </p>
              <p className="text-emerald-100">
                {raw.hand_summary.scorer === youPosition ? "You declared!" : `${raw.hand_summary.scorer ?? "—"} declared`}
              </p>
            </div>
          ) : null}

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-[#020402] border-2 border-emerald-400/40 text-center" data-testid="rummy-aaa-finished-footer">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : `${raw.match_winner ?? "—"} wins`}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => startMatch()} disabled={busy} className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-50" data-testid="rummy-aaa-replay-btn">Play Again</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 font-bold" data-testid="rummy-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`rummy-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
