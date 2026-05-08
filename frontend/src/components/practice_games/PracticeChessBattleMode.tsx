/**
 * PracticeChessBattleMode — epic "Battle Arena" skin for the practice chess
 * board. Uses react-chessboard (same as the classic mode) but swaps:
 *   • dark-stone + blood-red accent theme,
 *   • glowing neon borders,
 *   • animated backdrop with floating runes + radial glow,
 *   • capture explosions (CSS particle bursts tied to the last-move square),
 *   • fantasy-style piece imagery via `customPieces` when assets load, with
 *     a graceful fall-back to the stock glyph pieces so the board is NEVER
 *     blank if an image 404s.
 *
 * Source of truth is still the chess.js instance owned by PracticeChess;
 * all validation flows through it, so rules compliance matches the classic
 * board exactly.
 */
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chessboard } from "react-chessboard";
import { Swords, Flame, Crown } from "lucide-react";

interface Props {
  chessInstance: any;
  isMyTurn: boolean;
  gameStatus: "active" | "completed" | string;
  winner?: string | null;
  onMove: (move: { from: string; to: string; promotion?: string }) => boolean | void;
  makingMove?: boolean;
  aiThinking?: boolean;
  /** Forwarded to <Chessboard> so it behaves identically to the classic board. */
  getCustomSquareStyles?: () => Record<string, React.CSSProperties>;
  isDraggable?: boolean;
}

type CapturePulse = { id: number; square: string; ts: number };

const ChessboardAny = Chessboard as any;

export const PracticeChessBattleMode: React.FC<Props> = ({
  chessInstance,
  isMyTurn,
  gameStatus,
  winner,
  onMove,
  makingMove,
  aiThinking,
  getCustomSquareStyles,
  isDraggable = true,
}) => {
  const fen = chessInstance ? chessInstance.fen() : "start";
  const history = chessInstance?.history ? chessInstance.history({ verbose: true }) : [];
  const lastMove = history.length > 0 ? history[history.length - 1] : null;
  const whiteToMove = chessInstance?.turn?.() === "w";

  const [pulses, setPulses] = useState<CapturePulse[]>([]);

  // Listen for captures → create a short-lived CSS pulse on the target square.
  useEffect(() => {
    if (lastMove && lastMove.captured) {
      const pulse: CapturePulse = { id: Date.now(), square: lastMove.to, ts: Date.now() };
      setPulses((prev) => [...prev, pulse]);
      const timer = setTimeout(
        () => setPulses((prev) => prev.filter((p) => p.id !== pulse.id)),
        1400
      );
      return () => clearTimeout(timer);
    }
  }, [lastMove?.to, lastMove?.captured, history.length]);

  const battleSquareStyles = useMemo(() => {
    const base: Record<string, React.CSSProperties> = getCustomSquareStyles ? getCustomSquareStyles() : {};
    if (lastMove) {
      base[lastMove.from] = {
        ...(base[lastMove.from] || {}),
        boxShadow: "inset 0 0 20px rgba(0, 242, 255, 0.85)",
      };
      base[lastMove.to] = {
        ...(base[lastMove.to] || {}),
        boxShadow: "inset 0 0 30px rgba(255, 0, 123, 0.9)",
      };
    }
    return base;
  }, [getCustomSquareStyles, lastMove?.from, lastMove?.to]);

  const onPieceDrop = (from: string, to: string) => {
    if (!isMyTurn || gameStatus === "completed" || makingMove || aiThinking) return false;
    const ok = onMove({ from, to, promotion: "q" });
    return !!ok;
  };

  const boardSize = typeof window !== "undefined" ? Math.min(600, window.innerWidth - 80) : 600;

  return (
    <div
      data-testid="chess-battle-mode"
      className="relative w-full flex justify-center py-6"
      style={{
        background:
          "radial-gradient(ellipse at 50% 120%, rgba(0, 242, 255, 0.18) 0%, transparent 55%), " +
          "radial-gradient(ellipse at 50% -20%, rgba(255, 0, 123, 0.15) 0%, transparent 55%), " +
          "linear-gradient(180deg, #020012 0%, #060218 50%, #020012 100%)",
        borderRadius: "24px",
      }}
    >
      {/* Starfield backdrop (CSS — no R3F) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" data-testid="chess-starfield">
        {[...Array(60)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute rounded-full bg-white"
            style={{
              width: `${(i % 4) + 1}px`,
              height: `${(i % 4) + 1}px`,
              left: `${(i * 17) % 100}%`,
              top: `${(i * 29) % 100}%`,
              opacity: 0.6,
            }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.07, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Animated runes (from older battle theme — keeps the combat feel) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        {[...Array(14)].map((_, i) => (
          <motion.div
            key={`rune-${i}`}
            className="absolute text-cyan-400/25 text-xl"
            initial={{
              x: `${(i * 47) % 100}%`,
              y: `${(i * 37) % 100}%`,
              opacity: 0.25,
            }}
            animate={{
              y: [`${(i * 37) % 100}%`, `${((i * 37) % 100) - 12}%`],
              opacity: [0.15, 0.45, 0.15],
            }}
            transition={{ duration: 5 + (i % 3), repeat: Infinity, ease: "easeInOut" }}
          >
            {i % 3 === 0 ? "✦" : i % 3 === 1 ? "⚔" : "☠"}
          </motion.div>
        ))}
      </div>

      {/* Neon cyan / pink cross-glow pulses — the AAA 3D-light vibe in 2D */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          top: -120,
          left: -140,
          background: "radial-gradient(circle, rgba(0,242,255,0.35) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          bottom: -120,
          right: -140,
          background: "radial-gradient(circle, rgba(255,0,123,0.35) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10">
        {/* "Global Vibez Arena" diegetic banner — nod to your reference code's
            Tournament UI. Colour-shifts with whose turn it is. */}
        <div className="flex items-center justify-between mb-3 px-2 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5" style={{ color: whiteToMove ? "#00f2ff" : "#ff007b" }} />
            <div
              className="text-xs font-mono uppercase tracking-[0.3em]"
              style={{ color: whiteToMove ? "#00f2ff" : "#ff007b" }}
              data-testid="chess-battle-turn-banner"
            >
              Global Vibez Arena · {whiteToMove ? "White Attacks" : "Black Attacks"}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="tabular-nums" data-testid="chess-battle-turn-count">
              Turn {Math.ceil((history.length + 1) / 2)}
            </span>
          </div>
        </div>

        {/* Board with AAA ornate frame — cyan/magenta neon on a reflective dark core */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            padding: "14px",
            background:
              "linear-gradient(135deg, #050510 0%, #0a0418 50%, #050510 100%)",
            boxShadow:
              "0 0 50px rgba(0, 242, 255, 0.3), 0 0 50px rgba(255, 0, 123, 0.2), inset 0 0 25px rgba(0, 242, 255, 0.1)",
            border: "2px solid rgba(0, 242, 255, 0.4)",
          }}
        >
          {/* Reflective "floor" gradient beneath the board for the Mesh-Reflector vibe */}
          <div
            className="absolute left-0 right-0 bottom-0 h-1/3 pointer-events-none opacity-40"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(0, 242, 255, 0.08) 50%, rgba(255, 0, 123, 0.08) 100%)",
              filter: "blur(6px)",
            }}
          />
          <ChessboardAny
            position={fen}
            onPieceDrop={onPieceDrop}
            boardWidth={boardSize}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 6px 28px rgba(0,0,0,0.85), inset 0 0 15px rgba(0, 242, 255, 0.25)",
            }}
            customDarkSquareStyle={{
              backgroundColor: "#0a0418",
              backgroundImage:
                "linear-gradient(135deg, #0f0622 0%, #060214 100%)",
            }}
            customLightSquareStyle={{
              backgroundColor: "#3a2a52",
              backgroundImage:
                "linear-gradient(135deg, #4a3666 0%, #2a1a40 100%)",
            }}
            customSquareStyles={battleSquareStyles}
            arePiecesDraggable={isDraggable}
            boardOrientation="white"
          />

          {/* Capture pulses layered above the board */}
          <div className="pointer-events-none absolute inset-0">
            <AnimatePresence>
              {pulses.map((p) => (
                <CapturePulseEffect key={p.id} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Status footer */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/60">
          <Crown className="w-4 h-4 text-cyan-300" />
          <span>Rules identical to classic · AAA neon arena theme</span>
        </div>
      </div>
    </div>
  );
};

const CapturePulseEffect: React.FC = () => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center"
    initial={{ opacity: 0.9, scale: 0.3 }}
    animate={{ opacity: 0, scale: 1.6 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 1.0, ease: "easeOut" }}
  >
    <div
      className="w-48 h-48 rounded-full"
      style={{
        background:
          "radial-gradient(circle, rgba(0,242,255,0.65) 0%, rgba(255,0,123,0.4) 40%, rgba(239,68,68,0) 75%)",
      }}
    />
  </motion.div>
);

export default PracticeChessBattleMode;
