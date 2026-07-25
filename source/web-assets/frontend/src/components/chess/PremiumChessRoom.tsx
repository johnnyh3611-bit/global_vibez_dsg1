/**
 * PremiumChessRoom — GameRoomLayout viewport for chess with themes,
 * takeback / clock modes, mute, and a classy emoji reaction rail.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Chess } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock3,
  Undo2,
  Volume2,
  VolumeX,
  Crown,
  Palette,
} from "lucide-react";
import GameRoomLayout from "@/components/games/GameRoomLayout";
import PremiumChessBoard, { type ChessMovePayload } from "./PremiumChessBoard";
import {
  CHESS_THEMES,
  THEME_ORDER,
  type ChessThemeId,
  loadChessTheme,
  saveChessTheme,
} from "./chessThemes";
import { isChessMuted, setChessMuted } from "./chessAudio";

const EMOJIS = ["🤔", "👑", "😂", "🔥", "👏", "😮"];

export type PremiumChessRoomProps = {
  /** Controlled FEN — if omitted, room owns local chess.js */
  fen?: string;
  orientation?: "white" | "black";
  playerColor?: "w" | "b" | null;
  interactive?: boolean;
  title?: string;
  subtitle?: string;
  /** casual = takebacks; blitz = clocks */
  mode?: "casual" | "blitz";
  /** Clock seconds per side for blitz (default 300) */
  clockSeconds?: number;
  onMove?: (move: ChessMovePayload) => void;
  onGameOver?: (result: { winner: "w" | "b" | "draw"; reason: string }) => void;
  onBack?: () => void;
  backTo?: string;
  hudExtra?: ReactNode;
  /** Dating / social room — show emoji rail */
  socialRail?: boolean;
  testId?: string;
};

type FloatEmoji = { id: string; emoji: string };

export default function PremiumChessRoom({
  fen: controlledFen,
  orientation = "white",
  playerColor = "w",
  interactive = true,
  title = "Chess",
  subtitle,
  mode: modeProp,
  clockSeconds = 300,
  onMove,
  onGameOver,
  onBack,
  backTo = "/games",
  hudExtra,
  socialRail = true,
  testId = "premium-chess-room",
}: PremiumChessRoomProps) {
  const localGame = useRef(new Chess());
  const [fen, setFen] = useState(() => controlledFen || localGame.current.fen());
  const [mode, setMode] = useState<"casual" | "blitz">(modeProp || "casual");
  const [themeId, setThemeId] = useState<ChessThemeId>(loadChessTheme);
  const [muted, setMuted] = useState(isChessMuted);
  const [history, setHistory] = useState<string[]>([]);
  const [whiteClock, setWhiteClock] = useState(clockSeconds);
  const [blackClock, setBlackClock] = useState(clockSeconds);
  const [floats, setFloats] = useState<FloatEmoji[]>([]);
  const [status, setStatus] = useState("");
  const theme = CHESS_THEMES[themeId];

  useEffect(() => {
    if (controlledFen) setFen(controlledFen);
  }, [controlledFen]);

  useEffect(() => {
    if (modeProp) setMode(modeProp);
  }, [modeProp]);

  // Blitz clocks
  useEffect(() => {
    if (mode !== "blitz") return;
    const g = new Chess(fen);
    if (g.isGameOver()) return;
    const turn = g.turn();
    const id = window.setInterval(() => {
      if (turn === "w") {
        setWhiteClock((s) => {
          if (s <= 1) {
            onGameOver?.({ winner: "b", reason: "timeout" });
            setStatus("White flagged");
            return 0;
          }
          return s - 1;
        });
      } else {
        setBlackClock((s) => {
          if (s <= 1) {
            onGameOver?.({ winner: "w", reason: "timeout" });
            setStatus("Black flagged");
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [fen, mode, onGameOver]);

  const handleMove = useCallback(
    (move: ChessMovePayload) => {
      if (!controlledFen) {
        try {
          localGame.current.load(move.fen);
        } catch {
          /* ignore */
        }
        setHistory((h) => [...h, fen]);
        setFen(move.fen);
      }
      if (move.checkmate) {
        setStatus("Checkmate");
        onGameOver?.({
          winner: move.san.includes("#")
            ? localGame.current.turn() === "w"
              ? "b"
              : "w"
            : playerColor === "w"
              ? "w"
              : "b",
          reason: "checkmate",
        });
      } else if (move.check) {
        setStatus("Check");
      } else {
        setStatus(move.san);
      }
      onMove?.(move);
    },
    [controlledFen, fen, onGameOver, onMove, playerColor],
  );

  const takeback = () => {
    if (mode !== "casual" || !history.length || controlledFen) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    try {
      localGame.current.load(prev);
      setFen(prev);
      setStatus("Takeback");
    } catch {
      /* ignore */
    }
  };

  const fireEmoji = (emoji: string) => {
    const id = `${Date.now()}-${emoji}`;
    setFloats((f) => [...f, { id, emoji }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setChessMuted(next);
  };

  const cycleTheme = () => {
    const i = THEME_ORDER.indexOf(themeId);
    const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
    setThemeId(next);
    saveChessTheme(next);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const actions = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setMode((m) => (m === "casual" ? "blitz" : "casual"))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-white/15 bg-black/40"
          data-testid="chess-mode-toggle"
        >
          <Clock3 className="w-3.5 h-3.5" />
          {mode === "casual" ? "Casual · takebacks" : "Blitz clock"}
        </button>
        {mode === "casual" && !controlledFen && (
          <button
            type="button"
            onClick={takeback}
            disabled={!history.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-white/15 bg-black/40 disabled:opacity-40"
            data-testid="chess-takeback"
          >
            <Undo2 className="w-3.5 h-3.5" /> Takeback
          </button>
        )}
        <button
          type="button"
          onClick={toggleMute}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-white/15 bg-black/40"
          data-testid="chess-mute"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {muted ? "Muted" : "Sound"}
        </button>
        <button
          type="button"
          onClick={cycleTheme}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-white/15 bg-black/40"
          data-testid="chess-theme"
        >
          <Palette className="w-3.5 h-3.5" /> {theme.label}
        </button>
      </div>
    ),
    [mode, history.length, muted, theme.label, controlledFen],
  );

  return (
    <GameRoomLayout
      title={title}
      subtitle={subtitle || `${theme.label} · ${mode === "casual" ? "Takebacks on" : "On the clock"}`}
      nativeTable
      backTo={backTo}
      onBack={onBack}
      testId={testId}
      hudExtra={
        <div className="flex items-center gap-2">
          {mode === "blitz" && (
            <div className="flex gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded-lg bg-white/10">W {fmt(whiteClock)}</span>
              <span className="px-2 py-1 rounded-lg bg-white/10">B {fmt(blackClock)}</span>
            </div>
          )}
          {status && (
            <span className="hidden sm:inline text-xs text-amber-100/80 flex items-center gap-1">
              <Crown className="w-3 h-3" /> {status}
            </span>
          )}
          {hudExtra}
        </div>
      }
      table={
        <div
          className="relative w-full max-w-[min(92vw,560px)] mx-auto"
          style={{ background: theme.railBg }}
        >
          <p className="text-center text-[10px] tracking-[0.25em] uppercase mb-3 opacity-60">
            {theme.tagline}
          </p>
          <PremiumChessBoard
            fen={fen}
            orientation={orientation}
            interactive={interactive}
            playerColor={playerColor}
            themeId={themeId}
            onMove={handleMove}
          />
          {socialRail && (
            <div
              className="mt-4 flex items-center justify-center gap-2"
              data-testid="chess-emoji-rail"
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => fireEmoji(e)}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-lg hover:scale-110 transition"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div
                key={f.id}
                className="pointer-events-none absolute right-2 text-3xl"
                initial={{ opacity: 0, y: 40, x: 0 }}
                animate={{ opacity: 1, y: -80, x: -10 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6 }}
                style={{ bottom: 80 }}
              >
                {f.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      }
      actions={actions}
    />
  );
}
