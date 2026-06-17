/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🀫 DOMINOES AAA — Vibe Dominoes Superior Build
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single canonical Dominoes room. Replaces both the legacy
 * `PracticeDominoes` component and the unrouted
 * `HttpMultiplayerDominoes` page.
 *
 * Built on the universal Spades AAA prototype:
 *   • SpadesTable variant="onyx" density="2p" → "The Arena" felt.
 *   • SpadesSeat for north (bot) / south (you).
 *   • SpadesScoreBadge / SpadesGameMenu / SpadesCommunityChat re-used.
 *
 * Game-specific surfaces:
 *   • DominoTile component (pip-rendered, neon glow on playable).
 *   • Auto-scrolling chain that snakes horizontally on the felt.
 *   • Boneyard pill — count + DRAW button when you must draw.
 *   • Hand fan (horizontal) at the bottom, click to play.
 *   • PASS button when no playable + empty boneyard.
 *
 * Backend: /api/dominoes-practice/{start,play,draw,pass,next-round,state}
 * Ruleset: Block Dominoes, Double-Six, first to 150 (configurable).
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bot, Gamepad2, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import DominoTile from "@/components/dominoes/DominoTile";
import type {
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

interface DominoTileData { id: string; left: number; right: number; }
interface DominoesView {
  user_position: SpadesPosition;
  phase: "playing" | "round_over" | "finished";
  round_no: number;
  current_turn: SpadesPosition;
  target_score: number;
  scores: Record<SpadesPosition, number>;
  match_winner: SpadesPosition | null;
  chain: DominoTileData[];
  left_end: number | null;
  right_end: number | null;
  boneyard_count: number;
  opening_tile: string | null;
  passes_in_a_row: number;
  players_data: Record<
    SpadesPosition,
    {
      hand?: DominoTileData[];
      hand_count: number;
      playable?: Record<string, { left: boolean; right: boolean; any: boolean }>;
      has_playable?: boolean;
      is_bot: boolean;
    }
  >;
  last_round_summary: {
    round_no: number;
    winner: SpadesPosition | null;
    reason: "domino" | "blocked" | "tied_block";
    delta: number;
    south_pips: number;
    north_pips: number;
    scores: Record<SpadesPosition, number>;
  } | null;
}

function adapt(raw: DominoesView): {
  players: Record<SpadesPosition, SpadesPlayerView>;
  scores: SpadesScores;
} {
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    if (pos === "east" || pos === "west") {
      players[pos] = { hand_count: 0, bid: 0, tricks: 0, team: "team2", is_bot: true, name: "—" };
      return;
    }
    const data = raw.players_data?.[pos];
    players[pos] = {
      hand_count: data?.hand_count ?? 0,
      // Pill semantics: tiles_remaining / 7 (round-start) — gives a quick visual of who's closer to "domino".
      bid: 7,
      tricks: Math.max(0, 7 - (data?.hand_count ?? 0)),
      team: pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : "Adversary",
    };
  });
  return {
    players,
    scores: {
      team1: { points: raw.scores?.south ?? 0, bags: 0 },
      team2: { points: raw.scores?.north ?? 0, bags: 0 },
    },
  };
}

export default function DominoesAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<DominoesView | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [targetScore, setTargetScore] = useState<number>(150);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "indigo", ttl = 2000) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const startMatch = useCallback(async () => {
    setBusy(true);
    setSelectedTile(null);
    try {
      const res = await authFetch(`${API}/api/dominoes-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_score: targetScore }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Failed to start", "rose");
        return;
      }
      setRaw(data.game as DominoesView);
      setPhase("game");
      flash("The Arena · take a tile", "indigo");
    } finally {
      setBusy(false);
    }
  }, [targetScore, flash]);

  const playTile = useCallback(
    async (tileId: string, side: "left" | "right") => {
      if (!raw || busy) return;
      setBusy(true);
      try {
        const res = await authFetch(`${API}/api/dominoes-practice/play`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tile_id: tileId, side }),
        });
        const data = await res.json();
        if (!res.ok) {
          flash(data.detail || "Cannot play that tile", "rose");
          return;
        }
        const next = data.game as DominoesView;
        setRaw(next);
        setSelectedTile(null);
        // Hype Feed pulse on big plays
        const t = next.last_round_summary;
        if (t && t.reason === "domino") {
          flash(t.winner === "south" ? "DOMINO! Round won." : "Adversary slammed it down.", t.winner === "south" ? "emerald" : "rose", 2600);
        } else if (next.phase === "finished") {
          flash(next.match_winner === "south" ? "Match won!" : "Match lost", next.match_winner === "south" ? "emerald" : "rose", 3000);
        }
      } finally {
        setBusy(false);
      }
    },
    [raw, busy, flash],
  );

  const drawTile = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/dominoes-practice/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Cannot draw", "rose");
        return;
      }
      setRaw(data.game as DominoesView);
      flash("Drew from the Boneyard Ring", "indigo");
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash]);

  const passTurn = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/dominoes-practice/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Cannot pass", "rose");
        return;
      }
      setRaw(data.game as DominoesView);
      flash("Pass — Adversary up", "indigo");
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash]);

  const nextRound = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/dominoes-practice/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Failed", "rose");
        return;
      }
      setRaw(data.game as DominoesView);
      flash(`Round ${(data.game as DominoesView).round_no} · Begin`, "indigo");
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash]);

  const backToLobby = () => {
    setRaw(null);
    setPhase("lobby");
  };

  const handleTileClick = (tile: DominoTileData) => {
    if (!raw) return;
    if (raw.current_turn !== raw.user_position) {
      flash("Not your turn", "rose", 1200);
      return;
    }
    const playable = raw.players_data[raw.user_position]?.playable?.[tile.id];
    if (!playable?.any) {
      flash("That tile doesn't fit either end", "rose", 1500);
      return;
    }
    if (playable.left && playable.right) {
      // Need to ask side. Toggle selection — second click on a side button submits.
      setSelectedTile(tile.id);
      flash("Pick a side: ◀ left or right ▶", "indigo", 2000);
      return;
    }
    const side = playable.left ? "left" : "right";
    void playTile(tile.id, side);
  };

  // ─── LOBBY ───────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#050614] text-white relative overflow-x-hidden" data-testid="dominoes-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-indigo-500/15 blur-[120px]" />
          <div className="absolute right-10 bottom-10 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-indigo-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="dominoes-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-600 to-indigo-700 shadow-[0_0_24px_rgba(99,102,241,0.55)]">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-indigo-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                The Arena · Dominoes
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Dominoes AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-indigo-400/20 text-sm text-indigo-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules — Block Dominoes (Double-Six)
            </p>
            • Head-to-head · 28-tile set · 7 tiles each + 14-tile boneyard<br />
            • Highest double opens. Match a pip to either open end to play.<br />
            • Can't play? Draw from the boneyard until you can.<br />
            • Boneyard empty + no fit? Pass. Both pass = round blocked.<br />
            • Win the round → score the loser's remaining pip total.<br />
            • First to <strong className="text-indigo-300">{targetScore}</strong> wins the match.
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-indigo-400/20" data-testid="dominoes-aaa-target-score">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-300 font-bold mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
              Target Score
            </p>
            <div className="flex gap-2">
              {[100, 150, 200, 250].map((s) => (
                <button
                  key={s}
                  onClick={() => setTargetScore(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-black transition ${
                    targetScore === s
                      ? "bg-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.55)]"
                      : "bg-white/5 text-indigo-200/70 hover:bg-white/10"
                  }`}
                  data-testid={`dominoes-aaa-target-${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-600 to-indigo-500 hover:from-indigo-400 hover:to-fuchsia-500 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(99,102,241,0.55)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="dominoes-aaa-lobby-start-btn"
          >
            {busy ? "Shuffling tiles…" : "Enter The Arena"}
          </button>
          {/* Live MP button — opens the WebSocket lobby (Feb 2026). */}
          <button
            onClick={() => navigate("/dominoes-mp")}
            className="w-full mt-2 py-3 rounded-2xl bg-white/[0.04] border border-indigo-400/30 hover:bg-white/[0.08] text-indigo-200 font-black uppercase tracking-widest text-sm"
            data-testid="dominoes-aaa-mp-btn"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Play Live · Multiplayer
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="min-h-screen bg-[#050614] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const myHand = raw.players_data[youPosition]?.hand ?? [];
  const playableMap = raw.players_data[youPosition]?.playable ?? {};
  const hasPlayable = !!raw.players_data[youPosition]?.has_playable;
  const isYourTurn = raw.current_turn === youPosition && raw.phase === "playing";
  const canDraw = isYourTurn && !hasPlayable && raw.boneyard_count > 0;
  const canPass = isYourTurn && !hasPlayable && raw.boneyard_count === 0;
  const finished = raw.phase === "finished";
  const roundOver = raw.phase === "round_over";
  const summary = raw.last_round_summary;

  // ─── GAME ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0820] via-[#050614] to-[#02030a] text-white relative overflow-x-hidden" data-testid="dominoes-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header strip */}
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-indigo-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="dominoes-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-indigo-300 font-bold">
              The Arena
            </div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-indigo-200 font-bold tabular-nums">
              Round · {raw.round_no} · → {raw.target_score}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        {/* Table — onyx variant, 2-player density */}
        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="DOMINOES AAA" variant="onyx" density="2p" centreGlyph="🀫">
              <SpadesSeat
                position="north"
                player={players.north}
                isTurn={raw.current_turn === "north" && raw.phase === "playing"}
                isYou={false}
                onClick={() => setProfileOpen("north")}
              />
            </SpadesTable>

            {/* Centre — chain + open ends. We push the chain slightly
                below the centre chip so the opening tile doesn't sit
                exactly on top of the VIBEZ medallion. The boneyard
                pill anchors below the chain. */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none w-full px-4" style={{ transform: "translate(-50%, calc(-50% + 4.5rem))" }}>
              {raw.chain.length === 0 ? (
                <div className="text-indigo-300/50 text-[11px] md:text-xs uppercase tracking-widest font-bold">
                  Place the highest double…
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 max-w-[60vw] md:max-w-[600px] overflow-x-auto px-2 py-2" data-testid="dominoes-chain">
                    <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-black text-indigo-300/80 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-400/40 tabular-nums">
                      ◀ {raw.left_end}
                    </span>
                    <AnimatePresence initial={false} mode="popLayout">
                      {raw.chain.map((t) => {
                        const isDouble = t.left === t.right;
                        // Master Plan v2 spec: tiles start at scale 0.7 and
                        // shrink to a minimum of 0.4 as the chain fills up
                        // — `0.7 - chain.length * 0.01`, clamped at 0.4.
                        const dynamicScale = Math.max(
                          0.4,
                          0.7 - raw.chain.length * 0.01,
                        );
                        return (
                          <motion.div
                            key={t.id}
                            layout
                            initial={{ scale: 0.4, opacity: 0, y: -20 }}
                            animate={{ scale: dynamicScale, opacity: 1, y: 0 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 320, damping: 22 }}
                            className="flex-shrink-0"
                            data-testid="dominoes-chain-tile"
                            data-tile-scale={dynamicScale.toFixed(2)}
                          >
                            <DominoTile
                              left={t.left}
                              right={t.right}
                              orientation={isDouble ? "v" : "h"}
                              size="sm"
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <span className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-black text-indigo-300/80 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-400/40 tabular-nums">
                      {raw.right_end} ▶
                    </span>
                  </div>
                </>
              )}
              {/* Boneyard ring pill */}
              <div className="px-3 py-1 rounded-full bg-slate-900/70 border border-indigo-400/40 text-[10px] md:text-xs text-indigo-200 font-bold flex items-center gap-1.5 pointer-events-auto" data-testid="dominoes-boneyard">
                <span className="text-indigo-400">⬡</span>
                Boneyard <span className="tabular-nums">{raw.boneyard_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action row + hand fan */}
        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          <div className="flex justify-center gap-3 mb-3 flex-wrap">
            {selectedTile ? (
              <>
                <button
                  onClick={() => playTile(selectedTile, "left")}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50"
                  data-testid="dominoes-play-left-btn"
                >
                  ◀ Play LEFT
                </button>
                <button
                  onClick={() => playTile(selectedTile, "right")}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50"
                  data-testid="dominoes-play-right-btn"
                >
                  Play RIGHT ▶
                </button>
                <button
                  onClick={() => setSelectedTile(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-500/50 text-slate-200 hover:bg-slate-700/40 font-bold text-xs"
                  data-testid="dominoes-cancel-btn"
                >
                  Cancel
                </button>
              </>
            ) : null}
            {canDraw ? (
              <button
                onClick={drawTile}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-black uppercase tracking-widest text-xs disabled:opacity-50 shadow-[0_0_18px_rgba(245,158,11,0.55)]"
                data-testid="dominoes-draw-btn"
              >
                Draw from Boneyard
              </button>
            ) : null}
            {canPass ? (
              <button
                onClick={passTurn}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-widest text-xs disabled:opacity-50"
                data-testid="dominoes-pass-btn"
              >
                Pass
              </button>
            ) : null}
          </div>

          {/* Your hand */}
          <div className="flex justify-center items-end gap-1.5 md:gap-2 flex-wrap min-h-[72px]" data-testid="dominoes-hand">
            {myHand.length === 0 ? (
              <div className="text-indigo-300/50 text-xs uppercase tracking-widest font-bold py-6">
                {finished ? "Match over" : "Hand empty — DOMINO!"}
              </div>
            ) : (
              myHand.map((tile) => {
                const playable = playableMap[tile.id];
                return (
                  <DominoTile
                    key={tile.id}
                    left={tile.left}
                    right={tile.right}
                    size="md"
                    playable={isYourTurn && (playable?.any ?? false)}
                    active={selectedTile === tile.id}
                    onClick={() => handleTileClick(tile)}
                    testId={`dominoes-tile-${tile.id}`}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Round-over modal */}
        <AnimatePresence>
          {roundOver && summary ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              data-testid="dominoes-round-modal"
            >
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 20 }}
                className="max-w-md w-full p-6 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-[#050614] border-2 border-indigo-400/40 shadow-[0_0_60px_rgba(99,102,241,0.4)] text-center"
              >
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-indigo-300 mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
                  Round {summary.round_no} · {summary.reason === "domino" ? "Hand cleared" : summary.reason === "blocked" ? "Board blocked" : "Tied block"}
                </p>
                <h2 className="text-3xl font-black mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
                  {summary.winner === "south" ? "+" + summary.delta + " for You" : summary.winner === "north" ? "+" + summary.delta + " for Adversary" : "No score"}
                </h2>
                <div className="text-sm text-indigo-200/80 mb-4 space-y-1">
                  <p>Pip totals — You <strong className="text-indigo-300">{summary.south_pips}</strong> · Adversary <strong className="text-rose-300">{summary.north_pips}</strong></p>
                  <p>Match score — You <strong>{summary.scores.south}</strong> · Adversary <strong>{summary.scores.north}</strong></p>
                </div>
                <button
                  onClick={nextRound}
                  disabled={busy}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-black uppercase tracking-widest text-sm disabled:opacity-50"
                  data-testid="dominoes-next-round-btn"
                >
                  {busy ? "Dealing…" : "Next Round"}
                </button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Match-over footer */}
        {finished ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 md:mx-4 mb-4 p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-[#02030a] border-2 border-indigo-400/40 text-center"
            data-testid="dominoes-aaa-finished-footer"
          >
            <Gamepad2 className="w-10 h-10 mx-auto mb-2 text-indigo-300" />
            <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
              {raw.match_winner === youPosition ? "Arena Conquered!" : "Adversary Wins"}
            </h2>
            <p className="text-indigo-200/70 mb-4 text-sm">
              Final tally · You {raw.scores.south} · Adversary {raw.scores.north} · target {raw.target_score}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold disabled:opacity-50" data-testid="dominoes-aaa-replay-btn">
                Rematch
              </button>
              <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/10 font-bold" data-testid="dominoes-aaa-lobby-btn">
                Back to Lobby
              </button>
            </div>
          </motion.div>
        ) : null}
      </div>

      <SpadesPlayerProfile
        open={profileOpen !== null}
        position={profileOpen}
        player={profileOpen ? players[profileOpen] : null}
        isYou={profileOpen === youPosition}
        onClose={() => setProfileOpen(null)}
      />
      <SpadesCommunityChat
        open={chatOpen}
        gameId={`dominoes-${raw.user_position}`}
        mode="ai"
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
