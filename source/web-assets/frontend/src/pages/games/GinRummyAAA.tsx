/**
 * Gin Rummy AAA — gold variant, 2-player density.
 * Card Physics engine: BaseCardGameRoom + HandFan (meld sort) +
 * useCardSelection + CardActionTray — same feel as Spades/Bid Whist.
 */
import { useCallback, useEffect, useState } from "react";
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
import SpadesCard from "@/components/spades/SpadesCard";
import {
  BaseCardGameRoom,
  HandFan,
  useCardSelection,
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

  const handCards = raw?.your_hand ?? [];
  const selection = useCardSelection({
    mode: "single",
    cards: handCards,
    enabled: Boolean(raw && raw.phase === "discard" && raw.turn === raw.user_position),
  });
  const discardSelected = selection.selected[0] ?? null;

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
      selection.clear();
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
  }, [raw, busy, discardSelected, flash, selection]);

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

  const backToLobby = () => { setRaw(null); setPhase("lobby"); selection.clear(); };

  useEffect(() => {
    if (raw?.phase !== "discard") selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw?.phase]);

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

  const phaseActions: CardAction[] = [
    {
      id: "discard",
      label: "Discard",
      onClick: () => void submitDiscard(false),
      disabled: !discardSelected || busy,
      variant: "primary",
      phases: ["discard"],
      testId: "gin-rummy-discard-btn",
    },
    {
      id: "knock",
      label: raw.is_gin ? "Gin!" : "Knock",
      onClick: () => void submitDiscard(true),
      disabled: !discardSelected || busy || !(raw.can_knock || raw.is_gin),
      variant: "success",
      phases: ["discard"],
      testId: "gin-rummy-knock-btn",
    },
    {
      id: "next-hand",
      label: "Next Hand",
      onClick: () => void newHand(),
      disabled: busy,
      variant: "primary",
      phases: ["scoring"],
      testId: "gin-rummy-next-hand-btn",
    },
    {
      id: "replay",
      label: "Play Again",
      onClick: () => void startMatch(),
      disabled: busy,
      variant: "primary",
      phases: ["finished"],
      testId: "gin-rummy-aaa-replay-btn",
    },
    {
      id: "lobby",
      label: "Back to Lobby",
      onClick: backToLobby,
      variant: "secondary",
      phases: ["finished"],
      testId: "gin-rummy-aaa-lobby-btn",
    },
  ];

  return (
    <BaseCardGameRoom
      testId="gin-rummy-aaa"
      title="Gin Rummy"
      subtitle={`Deadwood ${raw.your_deadwood}${raw.is_gin ? " · GIN" : raw.can_knock ? " · can knock" : ""}`}
      onBack={backToLobby}
      phase={raw.phase}
      phaseActions={phaseActions}
      actionsLeading={
        <div className="flex justify-center items-center gap-3 mb-1" data-testid="gin-rummy-status">
          <div className="px-3 py-1 rounded-full bg-slate-900/70 border border-amber-400/30 text-amber-200 text-xs font-bold">
            Deadwood: <span className="text-amber-100" data-testid="gin-rummy-deadwood">{raw.your_deadwood}</span>
          </div>
        </div>
      }
      hudExtra={
        <div className="flex flex-wrap items-center gap-1.5">
          <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] uppercase tracking-[0.2em] text-fuchsia-300 font-bold">
            <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] uppercase tracking-[0.2em] text-amber-200 font-bold tabular-nums">
            Stock · {raw.stock_count}
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
          <span className="sr-only" data-testid="gin-rummy-aaa-back-btn">Lobby</span>
        </div>
      }
      table={
        <div className="relative">
          <SpadesTable brandSubLabel="GIN RUMMY" variant="gold" density="2p" centreGlyph="G">
            <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
          </SpadesTable>
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
              className={`rounded-md transition hover:scale-105 ${
                isYourTurn && raw.phase === "draw" ? "cursor-pointer ring-2 ring-amber-300/70" : "cursor-default opacity-90"
              }`}
              data-testid="gin-rummy-take-discard-btn"
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
        <div data-testid="gin-rummy-hand-strip">
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
            testId="gin-rummy-hand"
          />
        </div>
      }
      overlay={
        <>
          <SpadesStatusBanner message={statusMsg} />
          {raw.hand_summary && scoring ? (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[min(92vw,28rem)] p-4 rounded-2xl bg-black/70 border border-amber-400/30 text-center z-40" data-testid="gin-rummy-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.outcome.toUpperCase()}
              </p>
              <p className="text-amber-100">
                {raw.hand_summary.scorer === youPosition ? "You" : raw.hand_summary.scorer === null ? "Stalemate" : "Opponent"} +{raw.hand_summary.points}
              </p>
            </div>
          ) : null}
          {finished ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-4 bottom-24 p-4 rounded-2xl bg-gradient-to-br from-amber-950/80 to-[#050302] border-2 border-amber-400/40 text-center z-40" data-testid="gin-rummy-aaa-finished-footer">
              <Sparkles className="w-8 h-8 mx-auto mb-1 text-amber-300" />
              <h2 className="text-xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : "Opponent wins"}
              </h2>
            </motion.div>
          ) : null}
          <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
          <SpadesCommunityChat open={chatOpen} gameId={`gin-rummy-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
        </>
      }
    />
  );
}
