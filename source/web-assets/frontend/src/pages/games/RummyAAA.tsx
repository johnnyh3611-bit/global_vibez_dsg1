/**
 * Rummy AAA — Universal prototype, jade variant, 4-player density.
 * Card Physics engine: BaseCardGameRoom + HandFan (meld sort) +
 * useCardSelection + CardActionTray — same feel as Gin Rummy / Spades.
 */
import { useCallback, useEffect, useState } from "react";
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
import SpadesCard from "@/components/spades/SpadesCard";
import {
  BaseCardGameRoom,
  HandFan,
  useCardSelection,
  cardKey,
  type CardAction,
} from "@/components/shared/cards";
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

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Vipers", south: "You", east: "Cobras", west: "Hawks",
};

function rummyCardKey(c: RummyCard): string {
  if (c.joker_id != null) return `joker-${c.joker_id}`;
  return cardKey(c);
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
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(4);

  const handCards = raw?.your_hand ?? [];
  const selection = useCardSelection({
    mode: "single",
    cards: handCards,
    keyFn: rummyCardKey,
    enabled: Boolean(raw && raw.phase === "discard" && raw.turn === raw.user_position),
  });
  const discardSelected = selection.selected[0] ?? null;

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
      selection.clear();
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
  }, [raw, busy, discardSelected, flash, selection]);

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

  const backToLobby = () => { setRaw(null); setPhase("lobby"); selection.clear(); };

  useEffect(() => {
    if (raw?.phase !== "discard") selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw?.phase]);

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

  const phaseActions: CardAction[] = [
    {
      id: "discard",
      label: "Discard",
      onClick: () => void submitDiscard(),
      disabled: !discardSelected || busy,
      variant: "primary",
      phases: ["discard"],
      testId: "rummy-discard-btn",
    },
    ...(raw.can_declare
      ? [{
          id: "declare",
          label: "Declare",
          onClick: () => void declare(),
          disabled: busy,
          variant: "success" as const,
          phases: ["discard" as const],
          testId: "rummy-declare-btn",
        }]
      : []),
    {
      id: "next-hand",
      label: "Next Hand",
      onClick: () => void newHand(),
      disabled: busy,
      variant: "primary",
      phases: ["scoring"],
      testId: "rummy-next-hand-btn",
    },
    {
      id: "replay",
      label: "Play Again",
      onClick: () => void startMatch(),
      disabled: busy,
      variant: "primary",
      phases: ["finished"],
      testId: "rummy-aaa-replay-btn",
    },
    {
      id: "lobby",
      label: "Back to Lobby",
      onClick: backToLobby,
      variant: "secondary",
      phases: ["finished"],
      testId: "rummy-aaa-lobby-btn",
    },
  ];

  return (
    <BaseCardGameRoom
      testId="rummy-aaa"
      title="Rummy"
      subtitle={`Wildcard ${raw.wildcard_rank} · Deadwood ${raw.your_deadwood}${raw.can_declare ? " · declarable" : ""}`}
      onBack={backToLobby}
      phase={raw.phase}
      phaseActions={phaseActions}
      actionsLeading={
        <div className="flex justify-center items-center gap-3 mb-1" data-testid="rummy-status">
          <div className="px-3 py-1 rounded-full bg-slate-900/70 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
            Deadwood: <span className="text-emerald-100" data-testid="rummy-deadwood">{raw.your_deadwood}</span>
          </div>
          {raw.can_declare ? (
            <div className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-300 text-emerald-100 text-xs font-black uppercase tracking-widest">
              Declarable!
            </div>
          ) : null}
        </div>
      }
      hudExtra={
        <div className="flex flex-wrap items-center gap-1.5">
          <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] uppercase tracking-[0.2em] text-fuchsia-300 font-bold">
            <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/40 text-[9px] uppercase tracking-[0.2em] text-violet-200 font-bold">
            Wildcard · {raw.wildcard_rank}
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] uppercase tracking-[0.2em] text-emerald-200 font-bold tabular-nums">
            Stock · {raw.stock_count}
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
          <span className="sr-only" data-testid="rummy-aaa-back-btn">Lobby</span>
        </div>
      }
      table={
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
              className={`rounded-md transition hover:scale-105 ${
                isYourTurn && raw.phase === "draw" ? "cursor-pointer ring-2 ring-emerald-300/70" : "cursor-default opacity-90"
              }`}
              data-testid="rummy-take-discard-btn"
            >
              {raw.top_discard ? (
                <SpadesCard card={raw.top_discard} size="sm" isPlayable={isYourTurn && raw.phase === "draw"} />
              ) : (
                <div className="w-12 h-16 rounded-md bg-white/10 border border-slate-500 flex items-center justify-center text-slate-400 text-xs">empty</div>
              )}
            </button>
          </div>
        </div>
      }
      hand={
        <div data-testid="rummy-hand-strip">
          <HandFan
            hand={raw.your_hand}
            isYourTurn={raw.phase === "discard" && raw.turn === youPosition}
            busy={busy}
            sortMode="meld"
            showMeldLabels
            meldLabelFor={(id) => raw.meld_groups?.[id]?.label ?? null}
            selectionMode="single"
            selectedKeys={selection.selectedKeys}
            onToggleSelect={selection.toggle}
            hideTurnIndicator={raw.phase === "draw"}
            testId="rummy"
          />
        </div>
      }
      overlay={
        <>
          <SpadesStatusBanner message={statusMsg} />
          {raw.hand_summary && (scoring || finished) ? (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[min(92vw,28rem)] p-4 rounded-2xl bg-black/70 border border-emerald-400/30 text-center z-40" data-testid="rummy-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.outcome.toUpperCase()}
              </p>
              <p className="text-emerald-100">
                {raw.hand_summary.scorer === youPosition ? "You declared!" : `${raw.hand_summary.scorer ?? "—"} declared`}
              </p>
            </div>
          ) : null}
          {finished ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-4 bottom-24 p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-[#020402] border-2 border-emerald-400/40 text-center z-40" data-testid="rummy-aaa-finished-footer">
              <Sparkles className="w-8 h-8 mx-auto mb-1 text-emerald-300" />
              <h2 className="text-xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : `${raw.match_winner ?? "—"} wins`}
              </h2>
            </motion.div>
          ) : null}
          <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
          <SpadesCommunityChat open={chatOpen} gameId={`rummy-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
        </>
      }
    />
  );
}
