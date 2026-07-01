/**
 * UNO AAA — Universal prototype, neon variant. Reuses the Spades family
 * + a UNO-specific card face, color picker, and centre discard pile.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Plus, RotateCw, RotateCcw, Ban } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import type {
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";

interface UnoCardData {
  color: UnoColor;
  value: string;        // "0".."9" | "skip" | "reverse" | "draw2" | "wild" | "wild4"
  kind: "number" | "action" | "wild";
}
interface UnoPlayer { card_count: number; score: number; }
interface UnoLastAction {
  player?: SpadesPosition;
  card?: UnoCardData;
  declared?: string;
  drew?: UnoCardData | null;
  skipped?: boolean;
  reversed?: boolean;
  draw2_victim?: SpadesPosition;
  draw2_count?: number;
  wild4_victim?: SpadesPosition;
  wild4_count?: number;
  passed?: boolean;
}
interface UnoRaw {
  user_position: SpadesPosition;
  phase: "playing" | "wild4_challenge" | "scoring" | "finished";
  turn: SpadesPosition;
  direction: 1 | -1;
  top_card: UnoCardData;
  pending_color: "red" | "yellow" | "green" | "blue";
  draw_pile_count: number;
  your_hand: UnoCardData[];
  playable_cards: UnoCardData[];
  scores: Record<SpadesPosition, number>;
  players_data: Record<SpadesPosition, UnoPlayer>;
  hand_winner: SpadesPosition | null;
  match_winner: SpadesPosition | null;
  pending_wild: boolean;
  wild4_challenge_open: boolean;
  wild4_challenge: { challenger: SpadesPosition; previous_player: SpadesPosition; previous_color: string; previous_had_color: boolean } | null;
  last_action: UnoLastAction | null;
  play_sequence?: Array<UnoLastAction & { hand_complete?: boolean; winner?: SpadesPosition | null; wild4_resolution?: { challenger: SpadesPosition; previous_player: SpadesPosition; previous_had_color: boolean; challenged: boolean; penalty_target?: SpadesPosition; penalty_count?: number; bluff_caught?: boolean } }>;
}

const COLOR_CLASSES: Record<UnoColor, { bg: string; ring: string; chip: string; ink: string }> = {
  red:    { bg: "bg-red-600",    ring: "border-red-300",    chip: "bg-red-500",    ink: "text-red-100" },
  yellow: { bg: "bg-yellow-500", ring: "border-yellow-300", chip: "bg-yellow-400", ink: "text-yellow-100" },
  green:  { bg: "bg-emerald-600",ring: "border-emerald-300",chip: "bg-emerald-500",ink: "text-emerald-100" },
  blue:   { bg: "bg-blue-600",   ring: "border-blue-300",   chip: "bg-blue-500",   ink: "text-blue-100" },
  wild:   { bg: "bg-slate-900",  ring: "border-fuchsia-300",chip: "bg-fuchsia-500",ink: "text-fuchsia-100" },
};

const VALUE_LABEL: Record<string, string> = {
  skip: "⊘", reverse: "⟲", draw2: "+2", wild: "✦", wild4: "+4",
};

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "NEON", south: "You", east: "PULSE", west: "VOLT",
};

function UnoCardFace({ card, onClick, dim }: { card: UnoCardData; onClick?: () => void; dim?: boolean }) {
  const c = COLOR_CLASSES[card.color];
  const isAction = card.kind !== "number";
  const label = card.kind === "number" ? card.value : (VALUE_LABEL[card.value] ?? card.value);
  // Solid corner text for legibility (always white) + a strong centre rank.
  const centreInk = card.color === "wild"
    ? "text-fuchsia-700"
    : card.color === "yellow"
      ? "text-yellow-800"
      : card.color === "red"
        ? "text-red-700"
        : card.color === "green"
          ? "text-emerald-700"
          : "text-blue-700";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative w-12 h-16 md:w-14 md:h-20 rounded-md ${c.bg} border-2 ${c.ring} shadow flex items-center justify-center transition transform ${
        onClick ? "hover:-translate-y-1" : ""
      } ${dim ? "opacity-50 saturate-50" : ""}`}
      data-testid={`uno-card-${card.color}-${card.value}`}
    >
      {/* Diagonal white inner oval — classic UNO card identity */}
      <div className="absolute inset-1 rounded-full bg-white/95 -rotate-12 flex items-center justify-center">
        <span className={`${isAction ? "text-2xl" : "text-2xl md:text-3xl"} font-black ${centreInk}`}>
          {label}
        </span>
      </div>
      {/* Top-left + bottom-right white corner labels (high contrast) */}
      <span className="absolute top-0.5 left-1 text-[10px] font-black text-white drop-shadow">{label}</span>
      <span className="absolute bottom-0.5 right-1 text-[10px] font-black rotate-180 text-white drop-shadow">{label}</span>
    </button>
  );
}

function adapt(raw: UnoRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, UnoPlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 0,                          // pill: shows raw cards-remaining
      tricks: p?.card_count ?? 0,       // low = closer to UNO
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : BOT_NAMES[pos],
    };
  });
  const t1 = (raw.scores?.north ?? 0) + (raw.scores?.south ?? 0);
  const t2 = (raw.scores?.east ?? 0)  + (raw.scores?.west ?? 0);
  return { players, scores: { team1: { points: t1, bags: 0 }, team2: { points: t2, bags: 0 } } };
}

const COLOR_PICKER_OPTIONS: Array<{ id: "red" | "yellow" | "green" | "blue"; label: string }> = [
  { id: "red",    label: "RED" },
  { id: "yellow", label: "YELLOW" },
  { id: "green",  label: "GREEN" },
  { id: "blue",   label: "BLUE" },
];

function UnoColorModal({ open, busy, onPick }: { open: boolean; busy: boolean; onPick: (c: "red" | "yellow" | "green" | "blue") => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" data-testid="uno-color-modal">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 22 }} className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 border-fuchsia-400/50 rounded-3xl shadow-[0_0_40px_rgba(168,85,247,0.45)] p-5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>UNO · Wild</p>
            <h3 className="text-2xl font-black text-fuchsia-100 leading-tight mb-4" style={{ fontFamily: "'Cinzel', serif" }}>Declare a color</h3>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_PICKER_OPTIONS.map((opt) => {
                const c = COLOR_CLASSES[opt.id];
                return (
                  <button
                    key={opt.id}
                    onClick={() => onPick(opt.id)}
                    disabled={busy}
                    className={`h-24 rounded-xl ${c.bg} border-2 ${c.ring} hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center`}
                    data-testid={`uno-color-${opt.id}`}
                  >
                    <span className={`text-lg font-black uppercase tracking-[0.3em] ${c.ink}`} style={{ fontFamily: "'Cinzel', serif" }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function UnoAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<UnoRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingWild, setPendingWild] = useState<UnoCardData | null>(null);
  const [dealing, setDealing] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "fuchsia", ttl = 1700) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const STAGE_MS = 700;
  const stagePlaySequence = useCallback(async (next: UnoRaw) => {
    const seq = next.play_sequence ?? [];
    if (seq.length <= 1) {
      setRaw(next);
      return;
    }
    for (const ev of seq) {
      if (ev.drew) {
        flash(`${BOT_NAMES[ev.player ?? "north"]} drew a card`, "fuchsia", 800);
      } else if (ev.passed) {
        flash(`${BOT_NAMES[ev.player ?? "north"]} passed`, "fuchsia", 800);
      } else if (ev.card) {
        const c = ev.card;
        const valueLabel = c.kind === "number" ? c.value : (VALUE_LABEL[c.value] ?? c.value);
        const colorLabel = c.color === "wild" ? "WILD" : c.color.toUpperCase();
        let extras = "";
        if (ev.draw2_count) extras += ` · ${BOT_NAMES[ev.draw2_victim ?? "north"]} draws 2`;
        if (ev.wild4_count) extras += ` · ${BOT_NAMES[ev.wild4_victim ?? "north"]} draws 4`;
        if (ev.skipped)    extras += " · SKIP";
        if (ev.reversed)   extras += " · REVERSE";
        if (ev.declared && c.color === "wild") extras += ` · ${ev.declared.toUpperCase()}`;
        flash(`${BOT_NAMES[ev.player ?? "north"]} → ${colorLabel} ${valueLabel}${extras}`, "fuchsia", 1100);
        setRaw((prev) => prev ? { ...prev, top_card: c, pending_color: (ev.declared as UnoRaw["pending_color"]) ?? prev.pending_color } : prev);
      }
      await new Promise<void>((r) => setTimeout(r, STAGE_MS));
    }
    setRaw(next);
  }, [flash]);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as UnoRaw);
      setPhase("game");
      setDealing(true);
      window.setTimeout(() => setDealing(false), 2400);
      flash("UNO · Match underway", "fuchsia");
    } finally { setBusy(false); }
  }, [flash]);

  const playCard = useCallback(async (card: UnoCardData) => {
    if (!raw || busy) return;
    if (card.kind === "wild") {
      setPendingWild(card);
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card }) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Illegal play", "rose"); return; }
      await stagePlaySequence(data.game as UnoRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash, stagePlaySequence]);

  const finalizeWild = useCallback(async (color: "red" | "yellow" | "green" | "blue") => {
    if (!raw || !pendingWild) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card: pendingWild, declared_color: color }) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Wild rejected", "rose"); return; }
      setPendingWild(null);
      flash(`Wild · declared ${color.toUpperCase()}`, "fuchsia");
      await stagePlaySequence(data.game as UnoRaw);
    } finally { setBusy(false); }
  }, [raw, pendingWild, flash, stagePlaySequence]);

  const draw = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/draw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot draw", "rose"); return; }
      flash("Drew 1 · turn passes", "fuchsia");
      await stagePlaySequence(data.game as UnoRaw);
    } finally { setBusy(false); }
  }, [raw, busy, flash, stagePlaySequence]);

  // Resolve an open Wild Draw Four challenge — `challenge=true` calls
  // the prior player's bluff, false accepts the +4 + skip.
  const resolveChallenge = useCallback(async (challenge: boolean) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/challenge`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot resolve", "rose"); return; }
      const next = data.game as UnoRaw;
      const seq = next.play_sequence ?? [];
      // Narrate the resolution clearly: bluff caught vs back-fired.
      const first = seq[0];
      if (first?.wild4_resolution) {
        const r = first.wild4_resolution;
        if (challenge && r.bluff_caught) {
          flash(`Bluff caught! ${BOT_NAMES[r.previous_player ?? "north"]} draws ${r.penalty_count}`, "emerald", 2200);
        } else if (challenge) {
          flash(`Bad challenge — you draw ${r.penalty_count}`, "rose", 2200);
        } else {
          flash(`Accepted · you draw ${r.penalty_count}`, "fuchsia", 1800);
        }
      }
      await stagePlaySequence(next);
    } finally { setBusy(false); }
  }, [raw, busy, flash, stagePlaySequence]);

  const newHand = useCallback(async () => {
    if (!raw) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/uno-practice/new-hand`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot start next hand", "rose"); return; }
      setRaw(data.game as UnoRaw);
      flash("Next hand · dealt", "fuchsia");
      setDealing(true);
      window.setTimeout(() => setDealing(false), 2400);
    } finally { setBusy(false); }
  }, [raw, flash]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); setPendingWild(null); };

  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#04030a] text-white relative overflow-x-hidden" data-testid="uno-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-1/3 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
          <div className="absolute right-1/3 bottom-1/3 w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-cyan-500/15 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-fuchsia-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="uno-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-cyan-500 shadow-[0_0_24px_rgba(168,85,247,0.45)]">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80" style={{ fontFamily: "'Cinzel', serif" }}>Card Arena · UNO</p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>UNO AAA</h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-fuchsia-400/20 text-sm text-fuchsia-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>House Rules</p>
            • 108-card UNO deck · 4 players · 7 cards each · top card flipped to start<br />
            • Match by COLOR or NUMBER/ACTION · Wilds play any time + declare a color<br />
            • <strong>Skip</strong> ⊘ · <strong>Reverse</strong> ⟲ · <strong>Draw Two</strong> +2 · <strong>Wild Draw Four</strong> +4<br />
            • Can't play? Draw 1 (turn passes)<br />
            • First to empty wins · score is opponents' card pips · first to <strong>500</strong> wins the match
          </div>
          <button onClick={startMatch} disabled={busy} className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 hover:from-fuchsia-400 hover:to-cyan-400 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(168,85,247,0.55)] disabled:opacity-50" style={{ fontFamily: "'Cinzel', serif" }} data-testid="uno-aaa-lobby-start-btn">
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#04030a] flex items-center justify-center"><Loader2 className="w-12 h-12 text-fuchsia-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourTurn = raw.turn === youPosition && raw.phase === "playing" && !raw.pending_wild;
  const finished = raw.phase === "finished";
  const playableMap = new Set(raw.playable_cards.map((c) => `${c.color}-${c.value}`));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d0518] via-[#04030a] to-[#020108] text-white relative overflow-x-hidden" data-testid="uno-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-fuchsia-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="uno-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">UNO</div>
            <div className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full border text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-bold ${COLOR_CLASSES[raw.pending_color].bg} ${COLOR_CLASSES[raw.pending_color].ring} text-white`}>
              {raw.pending_color}
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-200 font-bold flex items-center gap-1">
              {raw.direction === 1 ? <RotateCw className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
              {raw.direction === 1 ? "CW" : "CCW"}
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-200 font-bold tabular-nums">
              Pile · {raw.draw_pile_count}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="UNO" variant="neon" centreGlyph="U">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
              <SpadesSeat position="east"  player={players.east}  isTurn={raw.turn === "east"}  isYou={youPosition === "east"}  onClick={() => setProfileOpen("east")} />
              <SpadesSeat position="west"  player={players.west}  isTurn={raw.turn === "west"}  isYou={youPosition === "west"}  onClick={() => setProfileOpen("west")} />
            </SpadesTable>
            {/* Centre pile: draw pile stub + discard top */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-3 pointer-events-none">
              <div className="relative">
                <div className="w-12 h-16 md:w-14 md:h-20 rounded-md bg-gradient-to-br from-fuchsia-700 to-purple-950 border-2 border-fuchsia-300/60 shadow-lg flex items-center justify-center">
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-fuchsia-200 -rotate-90">VIBEZ</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900/90 border border-fuchsia-400/50 text-[9px] font-bold text-fuchsia-200 tabular-nums">
                  ×{raw.draw_pile_count}
                </div>
              </div>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${raw.top_card.color}-${raw.top_card.value}`}
                  initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="relative"
                  data-testid="uno-top-card"
                >
                  <UnoCardFace card={raw.top_card} />
                  {raw.top_card.kind === "wild" ? (
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${COLOR_CLASSES[raw.pending_color].chip} text-white text-[8px] font-black uppercase tracking-[0.25em] shadow-lg border border-white/20`} data-testid="uno-declared-color">
                      {raw.pending_color}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          {/* Hand strip */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-3" data-testid="uno-hand-strip">
            {raw.your_hand.map((c, idx) => {
              const k = `${c.color}-${c.value}`;
              const playable = isYourTurn && playableMap.has(k);
              return (
                <UnoCardFace key={`${k}-${idx}`} card={c} dim={!playable} onClick={playable ? () => playCard(c) : undefined} />
              );
            })}
          </div>

          <div className="flex justify-center gap-3">
            {isYourTurn ? (
              <button
                onClick={draw}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border-2 border-fuchsia-400/50 text-fuchsia-200 hover:bg-slate-700 hover:border-fuchsia-300 font-bold flex items-center gap-2 disabled:opacity-50"
                data-testid="uno-draw-btn"
              >
                <Plus className="w-4 h-4" /> Draw
              </button>
            ) : null}
            {raw.phase === "scoring" ? (
              <button
                onClick={newHand}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-bold disabled:opacity-50"
                data-testid="uno-next-hand-btn"
              >
                Next Hand
              </button>
            ) : null}
          </div>

          {raw.last_action?.skipped ? (
            <div className="mt-3 flex justify-center">
              <div className="px-3 py-1 rounded-full bg-rose-500/30 border border-rose-300 text-rose-100 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-1">
                <Ban className="w-3 h-3" /> Skip
              </div>
            </div>
          ) : null}

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-fuchsia-950/40 to-[#020108] border-2 border-fuchsia-400/40 text-center" data-testid="uno-aaa-finished-footer">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-fuchsia-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : `${BOT_NAMES[raw.match_winner ?? "north"]} wins`}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white font-bold disabled:opacity-50" data-testid="uno-aaa-replay-btn">Play Again</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/10 font-bold" data-testid="uno-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <UnoColorModal open={pendingWild !== null} busy={busy} onPick={finalizeWild} />

      {/* Wild Draw Four challenge modal — appears when the prior player
          dropped a Wild +4 and the user is the next victim. */}
      <AnimatePresence>
        {raw.wild4_challenge_open && raw.phase === "wild4_challenge" ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
            data-testid="uno-wild4-challenge-modal"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="w-full max-w-lg bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 border-amber-400/60 rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.45)] p-5"
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
                UNO · Wild Draw Four
              </p>
              <h3 className="text-2xl font-black text-amber-100 leading-tight mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
                {BOT_NAMES[raw.wild4_challenge?.previous_player ?? "north"]} dropped +4
              </h3>
              <p className="text-amber-100/80 text-xs mb-4 leading-relaxed">
                You can <strong>CHALLENGE</strong> if you suspect they had a card matching the previous color. If they did, they draw 4 instead. If they didn't, <strong>you draw 6</strong>. Or just <strong>ACCEPT</strong> the +4 and skip.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => resolveChallenge(true)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(245,158,11,0.55)] disabled:opacity-40"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="uno-wild4-challenge-btn"
                >
                  Challenge
                </button>
                <button
                  onClick={() => resolveChallenge(false)}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl bg-slate-800 border-2 border-fuchsia-400/50 hover:bg-slate-700 text-fuchsia-200 font-black uppercase tracking-widest text-sm disabled:opacity-40"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="uno-wild4-accept-btn"
                >
                  Accept +4
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`uno-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
