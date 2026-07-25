/**
 * Premium Date Night board arena — walnut / felt / marble presentation.
 * Chess uses PremiumChessBoard (themes, glide, audio) + emoji reaction rail.
 */
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Palette, Volume2, VolumeX } from "lucide-react";
import PremiumChessBoard from "@/components/chess/PremiumChessBoard";
import { isChessMuted, setChessMuted } from "@/components/chess/chessAudio";
import {
  CHESS_THEMES,
  THEME_ORDER,
  loadChessTheme,
  saveChessTheme,
  type ChessThemeId,
} from "@/components/chess/chessThemes";

const DATE_EMOJIS = ["🤔", "👑", "😂", "🔥", "👏", "😮"];

type BoardState = {
  cells?: string[];
  moves?: { by: string; san: string; from?: string; to?: string }[];
  fen?: string;
  winner?: string | null;
  draw?: boolean;
  simplified?: boolean;
};

type Props = {
  gameType: "tictactoe" | "connect4" | "chess" | string;
  board: BoardState;
  myId: string;
  player1Id: string;
  player2Id: string;
  turn: string | null;
  onMove: (move: Record<string, unknown>) => void;
  busy?: boolean;
};

export default function DateNightBoardArena({
  gameType,
  board,
  myId,
  player1Id,
  player2Id,
  turn,
  onMove,
  busy,
}: Props) {
  const myTurn = turn === myId;
  const p1 = myId === player1Id;

  if (gameType === "connect4") {
    return (
      <ArenaShell
        title="Connect 4"
        subtitle="Navy felt · glass discs"
        tone="felt"
        myTurn={myTurn}
        status={statusLine(board, myId, player1Id, player2Id)}
      >
        <div className="rounded-[28px] p-4 sm:p-5 bg-gradient-to-b from-[#1e3a5f] to-[#0b1c33] shadow-[inset_0_2px_12px_rgba(255,255,255,0.08),0_25px_50px_rgba(0,0,0,0.55)] border border-[#4a6d94]/40">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, col) => (
              <button
                key={col}
                type="button"
                disabled={!myTurn || busy || !!board.winner || board.draw}
                onClick={() => onMove({ column: col })}
                className="flex flex-col gap-2 group"
                data-testid={`c4-col-${col}`}
              >
                {Array.from({ length: 6 }).map((__, row) => {
                  const cell = (board.cells || [])[row * 7 + col] || "";
                  return (
                    <div
                      key={`${row}-${col}`}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#06101c] shadow-[inset_0_4px_8px_rgba(0,0,0,0.7)] flex items-center justify-center"
                    >
                      {cell && (
                        <motion.div
                          initial={{ y: -40, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg ${
                            cell === "crimson"
                              ? "bg-gradient-to-br from-[#ff6b6b] via-[#c62828] to-[#7f1010]"
                              : "bg-gradient-to-br from-[#fff8e7] via-[#e8d5a8] to-[#b8955a]"
                          }`}
                          style={{
                            boxShadow:
                              cell === "crimson"
                                ? "inset 0 -4px 8px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.4)"
                                : "inset 0 -4px 8px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.35)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                <span className="text-[10px] text-center text-sky-100/40 group-hover:text-sky-100/80">
                  drop
                </span>
              </button>
            ))}
          </div>
        </div>
        <PlayerPlaques p1Label={p1 ? "You · Crimson" : "Them · Crimson"} p2Label={p1 ? "Them · Ivory" : "You · Ivory"} />
      </ArenaShell>
    );
  }

  if (gameType === "chess") {
    return (
      <DateNightChess
        board={board}
        myId={myId}
        player1Id={player1Id}
        player2Id={player2Id}
        turn={turn}
        myTurn={myTurn}
        busy={busy}
        onMove={onMove}
      />
    );
  }

  // Tic-tac-toe default — marble
  const cells = board.cells || Array(9).fill("");
  return (
    <ArenaShell
      title="Tic-Tac-Toe"
      subtitle="Carrara marble · brass inlay"
      tone="marble"
      myTurn={myTurn}
      status={statusLine(board, myId, player1Id, player2Id)}
    >
      <div
        className="grid grid-cols-3 gap-3 p-4 rounded-3xl"
        style={{
          background:
            "linear-gradient(145deg,#f5f0e8 0%,#e8dfd0 40%,#d9cfc0 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.7), 0 24px 48px rgba(0,0,0,0.35)",
        }}
      >
        {cells.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!myTurn || busy || !!cell || !!board.winner || board.draw}
            onClick={() => onMove({ index: idx })}
            data-testid={`ttt-cell-${idx}`}
            className="aspect-square rounded-2xl bg-gradient-to-br from-[#faf7f2] to-[#ddd2c3] border border-[#b9a993]/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] flex items-center justify-center text-4xl font-serif disabled:opacity-90"
          >
            {cell === "X" && (
              <span className="text-[#5c1a1a] drop-shadow-sm font-semibold">✕</span>
            )}
            {cell === "O" && (
              <span className="text-[#1a335c] drop-shadow-sm font-semibold">○</span>
            )}
          </button>
        ))}
      </div>
      <PlayerPlaques p1Label={p1 ? "You · X" : "Them · X"} p2Label={p1 ? "Them · O" : "You · O"} />
    </ArenaShell>
  );
}

function ArenaShell({
  title,
  subtitle,
  tone,
  myTurn,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  tone: "felt" | "walnut" | "marble";
  myTurn: boolean;
  status: string;
  children: ReactNode;
}) {
  const bg =
    tone === "felt"
      ? "from-[#071018] via-[#0b1520] to-[#05080d]"
      : tone === "walnut"
        ? "from-[#140e0a] via-[#1c140e] to-[#0a0705]"
        : "from-[#1a1714] via-[#12100e] to-[#0c0a09]";
  return (
    <div
      className={`relative rounded-3xl border border-white/10 bg-gradient-to-b ${bg} p-5 sm:p-6`}
      data-testid="date-night-board-arena"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-medium text-[#f4ebe0] tracking-tight">{title}</h3>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-100/50 mt-1">{subtitle}</p>
        </div>
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            myTurn
              ? "bg-emerald-400/15 text-emerald-100 border border-emerald-300/30"
              : "bg-white/5 text-white/60 border border-white/10"
          }`}
        >
          {myTurn ? "Your move" : "Their move"}
        </div>
      </div>
      {children}
      <p className="mt-4 text-center text-sm text-[#d2c2ad]">{status}</p>
    </div>
  );
}

function PlayerPlaques({ p1Label, p2Label }: { p1Label: string; p2Label: string }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-xs text-[#f0e6d8]">
        {p1Label}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-xs text-[#f0e6d8]">
        {p2Label}
      </div>
    </div>
  );
}

function statusLine(
  board: BoardState,
  myId: string,
  p1: string,
  p2: string,
): string {
  if (board.draw) return "Draw — evenly matched.";
  if (board.winner) {
    return board.winner === myId ? "You take the table." : "They take the table.";
  }
  return p1 && p2 ? "Play clean. Play sharp." : "";
}

function DateNightChess({
  board,
  myId,
  player1Id,
  player2Id,
  turn,
  myTurn,
  busy,
  onMove,
}: {
  board: BoardState;
  myId: string;
  player1Id: string;
  player2Id: string;
  turn: string | null;
  myTurn: boolean;
  busy?: boolean;
  onMove: (move: Record<string, unknown>) => void;
}) {
  const [muted, setMuted] = useState(isChessMuted);
  const [themeId, setThemeId] = useState<ChessThemeId>(loadChessTheme);
  const [floats, setFloats] = useState<{ id: string; emoji: string }[]>([]);
  const amP1 = myId === player1Id;
  const fen =
    board.fen ||
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const theme = CHESS_THEMES[themeId];

  const fireEmoji = (emoji: string) => {
    const id = `${Date.now()}-${emoji}`;
    setFloats((f) => [...f, { id, emoji }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
  };

  return (
    <ArenaShell
      title="Chess"
      subtitle={`${theme.tagline} · glide & soft drop`}
      tone="walnut"
      myTurn={myTurn}
      status={statusLine(board, myId, player1Id, player2Id)}
    >
      <div className="relative flex justify-end gap-2 mb-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-white/15 bg-black/30"
          onClick={() => {
            const i = THEME_ORDER.indexOf(themeId);
            const next = THEME_ORDER[(i + 1) % THEME_ORDER.length];
            setThemeId(next);
            saveChessTheme(next);
          }}
          data-testid="date-chess-theme"
        >
          <Palette className="w-3.5 h-3.5" /> {theme.label}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-white/15 bg-black/30"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setChessMuted(next);
          }}
          data-testid="date-chess-mute"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {muted ? "Muted" : "Sound"}
        </button>
      </div>
      <PremiumChessBoard
        fen={fen}
        orientation={amP1 ? "white" : "black"}
        interactive={myTurn && !busy && !board.winner && !board.draw}
        playerColor={amP1 ? "w" : "b"}
        themeId={themeId}
        onMove={(m) =>
          onMove({
            from: m.from,
            to: m.to,
            san: m.san,
            fen: m.fen,
            checkmate: m.checkmate,
            check: m.check,
          })
        }
      />
      <div
        className="mt-4 flex items-center justify-center gap-2"
        data-testid="date-chess-emoji-rail"
      >
        {DATE_EMOJIS.map((e) => (
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
      <AnimatePresence>
        {floats.map((f) => (
          <motion.div
            key={f.id}
            className="pointer-events-none absolute right-6 text-3xl z-20"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: -70 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            style={{ bottom: 120 }}
          >
            {f.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          disabled={!myTurn || busy || !!board.winner}
          onClick={() => onMove({ resign: true, san: "resign" })}
          className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-400/30 text-rose-100 text-sm disabled:opacity-40"
        >
          Resign
        </button>
      </div>
      <PlayerPlaques
        p1Label={amP1 ? "You · White" : "Them · White"}
        p2Label={amP1 ? "Them · Black" : "You · Black"}
      />
      {!!turn && <p className="sr-only">turn {turn}</p>}
    </ArenaShell>
  );
}
