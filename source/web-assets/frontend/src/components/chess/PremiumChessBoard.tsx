/**
 * PremiumChessBoard — themed squares, SVG pieces, glide moves, legal halos,
 * check aura, capture dissolve. Driven by chess.js FEN.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { AnimatePresence, motion } from "framer-motion";
import ChessPieceSvg, { pieceFromFenChar } from "./ChessPieceSvg";
import {
  CHESS_THEMES,
  type ChessTheme,
  type ChessThemeId,
  loadChessTheme,
} from "./chessThemes";
import {
  playCapture,
  playCheck,
  playLift,
  playPieceDrop,
} from "./chessAudio";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export type ChessMovePayload = {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  fen: string;
  captured?: string | null;
  check?: boolean;
  checkmate?: boolean;
};

type Props = {
  fen?: string;
  orientation?: "white" | "black";
  interactive?: boolean;
  /** Which color may move when interactive (null = both / spectator). */
  playerColor?: "w" | "b" | null;
  themeId?: ChessThemeId;
  onMove?: (move: ChessMovePayload) => void;
  className?: string;
  size?: number;
};

type Glide = {
  id: string;
  from: string;
  to: string;
  type: string;
  color: "w" | "b";
};

type CaptureFx = { id: string; square: string; type: string; color: "w" | "b" };

export default function PremiumChessBoard({
  fen = "start",
  orientation = "white",
  interactive = true,
  playerColor = "w",
  themeId,
  onMove,
  className = "",
  size,
}: Props) {
  const theme = CHESS_THEMES[themeId || loadChessTheme()];
  const gameRef = useRef(new Chess());
  const [position, setPosition] = useState(() => fenToMap(safeFen(fen)));
  const [selected, setSelected] = useState<string | null>(null);
  const [legal, setLegal] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [checkSq, setCheckSq] = useState<string | null>(null);
  const [glide, setGlide] = useState<Glide | null>(null);
  const [captureFx, setCaptureFx] = useState<CaptureFx | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [sqPx, setSqPx] = useState(48);

  // Sync external FEN (opponent / AI)
  useEffect(() => {
    const next = safeFen(fen);
    const cur = gameRef.current.fen();
    if (next === cur) return;
    const before = fenToMap(cur);
    try {
      gameRef.current.load(next);
    } catch {
      gameRef.current.reset();
      if (next !== "start") {
        try {
          gameRef.current.load(next);
        } catch {
          /* keep */
        }
      }
    }
    const after = fenToMap(gameRef.current.fen());
    const moved = detectMove(before, after);
    if (moved) {
      const piece = before[moved.from];
      if (piece) {
        setGlide({
          id: `${moved.from}-${moved.to}-${Date.now()}`,
          from: moved.from,
          to: moved.to,
          type: piece.type,
          color: piece.color,
        });
        if (moved.captured) {
          setCaptureFx({
            id: `cap-${Date.now()}`,
            square: moved.to,
            type: moved.captured.type,
            color: moved.captured.color,
          });
          playCapture();
        } else {
          playPieceDrop();
        }
        setLastMove({ from: moved.from, to: moved.to });
        if (gameRef.current.inCheck()) {
          playCheck(gameRef.current.isCheckmate());
        }
      }
    }
    setPosition(after);
    setCheckSq(findKingInCheck(gameRef.current));
    setSelected(null);
    setLegal([]);
  }, [fen]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSqPx(Math.floor(w / 8));
    });
    ro.observe(el);
    setSqPx(Math.floor(el.clientWidth / 8));
    return () => ro.disconnect();
  }, []);

  const ranks = useMemo(
    () => (orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]),
    [orientation],
  );
  const files = useMemo(
    () => (orientation === "white" ? [...FILES] : [...FILES].reverse()),
    [orientation],
  );

  const canPlay = interactive && !glide;

  const onSquareClick = useCallback(
    (sq: string) => {
      if (!canPlay) return;
      const turn = gameRef.current.turn();
      if (playerColor && turn !== playerColor) return;

      if (selected && legal.includes(sq)) {
        applyLocalMove(selected, sq);
        return;
      }

      const piece = position[sq];
      if (!piece) {
        setSelected(null);
        setLegal([]);
        setLifted(null);
        return;
      }
      if (playerColor && piece.color !== playerColor) return;
      if (piece.color !== turn) return;

      playLift();
      setSelected(sq);
      setLifted(sq);
      const moves = gameRef.current.moves({ square: sq as Square, verbose: true }) as Move[];
      setLegal(moves.map((m) => m.to));
    },
    [canPlay, legal, playerColor, position, selected],
  );

  const applyLocalMove = (from: string, to: string) => {
    const beforePiece = position[from];
    const target = position[to];
    let move: Move | null = null;
    try {
      move = gameRef.current.move({ from, to, promotion: "q" });
    } catch {
      move = null;
    }
    if (!move) {
      setSelected(null);
      setLegal([]);
      setLifted(null);
      return;
    }

    if (beforePiece) {
      setGlide({
        id: `${from}-${to}-${Date.now()}`,
        from,
        to,
        type: beforePiece.type,
        color: beforePiece.color,
      });
    }
    if (target || move.captured) {
      setCaptureFx({
        id: `cap-${Date.now()}`,
        square: to,
        type: target?.type || (move.captured as string) || "p",
        color: target?.color || (move.color === "w" ? "b" : "w"),
      });
      playCapture();
    } else {
      playPieceDrop();
    }

    setLastMove({ from, to });
    setSelected(null);
    setLegal([]);
    setLifted(null);

    const nextFen = gameRef.current.fen();
    // Keep displayed piece on origin until glide ends; update map after glide
    const check = gameRef.current.inCheck();
    const checkmate = gameRef.current.isCheckmate();
    if (check) playCheck(checkmate);

    window.setTimeout(() => {
      setPosition(fenToMap(nextFen));
      setGlide(null);
      setCheckSq(findKingInCheck(gameRef.current));
      onMove?.({
        from,
        to,
        promotion: move.promotion,
        san: move.san,
        fen: nextFen,
        captured: move.captured || null,
        check,
        checkmate,
      });
    }, 320);
  };

  const boardStyle = size
    ? { width: size, height: size }
    : { width: "100%", aspectRatio: "1" as const };

  return (
    <div
      ref={boardRef}
      className={`relative select-none ${className}`}
      style={boardStyle}
      data-testid="premium-chess-board"
      data-theme={theme.id}
    >
      <div
        className="absolute -inset-3 rounded-[22px] -z-10"
        style={{
          background: theme.boardFrame,
          boxShadow: theme.boardGlow,
        }}
      />
      <div
        className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-xl overflow-hidden border border-white/10 relative"
        style={{ backgroundImage: theme.boardTexture, backgroundSize: "12px 12px" }}
      >
        {ranks.map((rank, ri) =>
          files.map((file, fi) => {
            const sq = `${file}${rank}`;
            const isLight = (ri + fi) % 2 === 0;
            const piece = position[sq];
            const isLegal = legal.includes(sq);
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isSel = selected === sq;
            const isCheck = checkSq === sq;
            const hidingForGlide =
              glide && (sq === glide.from || (sq === glide.to && glide));

            return (
              <button
                key={sq}
                type="button"
                data-testid={`chess-sq-${sq}`}
                onClick={() => onSquareClick(sq)}
                className="relative focus:outline-none"
                style={{
                  background: isLight ? theme.light : theme.dark,
                  boxShadow: isCheck
                    ? `inset 0 0 22px ${theme.checkAura}`
                    : isLast
                      ? `inset 0 0 16px ${theme.lastMove}`
                      : isSel
                        ? `inset 0 0 14px ${theme.accent}66`
                        : undefined,
                }}
              >
                {/* subtle specular on light squares */}
                {isLight && (
                  <span
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.14), transparent 50%)",
                    }}
                  />
                )}
                {isLegal && (
                  <span
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    data-testid={`legal-${sq}`}
                  >
                    <span
                      className="rounded-full animate-pulse"
                      style={{
                        width: piece ? "72%" : "28%",
                        height: piece ? "72%" : "28%",
                        boxShadow: piece
                          ? `inset 0 0 0 2px ${theme.legalHalo}`
                          : undefined,
                        background: piece ? "transparent" : theme.legalHalo,
                      }}
                    />
                  </span>
                )}
                {piece && !(hidingForGlide && sq === glide?.from) && !(glide && sq === glide.to) && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <ChessPieceSvg
                      type={piece.type as any}
                      color={piece.color}
                      theme={theme}
                      size={Math.max(28, sqPx * 0.82)}
                      lifted={lifted === sq}
                    />
                  </span>
                )}
                {/* file/rank labels */}
                {fi === 0 && (
                  <span className="absolute left-0.5 top-0 text-[9px] opacity-40 font-mono">
                    {rank}
                  </span>
                )}
                {ri === 7 && (
                  <span className="absolute right-0.5 bottom-0 text-[9px] opacity-40 font-mono">
                    {file}
                  </span>
                )}
              </button>
            );
          }),
        )}

        {/* Glide overlay */}
        <AnimatePresence>
          {glide && (
            <GlidePiece
              key={glide.id}
              glide={glide}
              files={files as unknown as string[]}
              ranks={ranks}
              theme={theme}
              sqPx={sqPx}
            />
          )}
        </AnimatePresence>

        {/* Capture dissolve */}
        <AnimatePresence>
          {captureFx && (
            <motion.div
              key={captureFx.id}
              className="absolute pointer-events-none z-20"
              style={squareStyle(captureFx.square, files as unknown as string[], ranks, sqPx)}
              initial={{ opacity: 1, scale: 1, y: 0 }}
              animate={{ opacity: 0, scale: 0.4, y: 24, rotate: 12 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              onAnimationComplete={() => setCaptureFx(null)}
            >
              <ChessPieceSvg
                type={captureFx.type as any}
                color={captureFx.color}
                theme={theme}
                size={Math.max(28, sqPx * 0.75)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function GlidePiece({
  glide,
  files,
  ranks,
  theme,
  sqPx,
}: {
  glide: Glide;
  files: string[];
  ranks: number[];
  theme: ChessTheme;
  sqPx: number;
}) {
  const from = squareStyle(glide.from, files, ranks, sqPx);
  const to = squareStyle(glide.to, files, ranks, sqPx);
  return (
    <motion.div
      className="absolute z-30 pointer-events-none flex items-center justify-center"
      initial={{ left: from.left, top: from.top, y: 0 }}
      animate={{
        left: to.left,
        top: to.top,
        y: [0, -10, 0],
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: sqPx, height: sqPx }}
    >
      <ChessPieceSvg
        type={glide.type as any}
        color={glide.color}
        theme={theme}
        size={Math.max(28, sqPx * 0.82)}
        lifted
      />
    </motion.div>
  );
}

function squareStyle(
  sq: string,
  files: string[],
  ranks: number[],
  sqPx: number,
): { left: number; top: number } {
  const file = sq[0];
  const rank = Number(sq[1]);
  const fi = files.indexOf(file);
  const ri = ranks.indexOf(rank);
  return { left: fi * sqPx, top: ri * sqPx };
}

function safeFen(fen: string) {
  if (!fen || fen === "start") {
    return new Chess().fen();
  }
  return fen;
}

function fenToMap(fen: string): Record<string, { type: string; color: "w" | "b" }> {
  const map: Record<string, { type: string; color: "w" | "b" }> = {};
  const board = fen.split(" ")[0];
  const rows = board.split("/");
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        c += Number(ch);
      } else {
        const p = pieceFromFenChar(ch);
        if (p) {
          const file = FILES[c];
          const rank = 8 - r;
          map[`${file}${rank}`] = p;
        }
        c += 1;
      }
    }
  }
  return map;
}

function detectMove(
  before: Record<string, { type: string; color: "w" | "b" }>,
  after: Record<string, { type: string; color: "w" | "b" }>,
) {
  const fromSq = Object.keys(before).find((sq) => !after[sq] || after[sq].color !== before[sq].color || after[sq].type !== before[sq].type);
  // Better: squares that lost a piece
  const lost = Object.keys(before).filter((sq) => !after[sq]);
  const gained = Object.keys(after).filter((sq) => !before[sq] || before[sq].color !== after[sq].color);
  if (lost.length === 1 && gained.length === 1) {
    return {
      from: lost[0],
      to: gained[0],
      captured: before[gained[0]] || null,
    };
  }
  // Capture: lost 1, gained 1 but target had piece
  if (lost.length >= 1 && gained.length === 1) {
    const to = gained[0];
    const from = lost.find((sq) => before[sq]?.color === after[to]?.color) || lost[0];
    return { from, to, captured: before[to] || null };
  }
  if (fromSq && gained[0]) {
    return { from: fromSq, to: gained[0], captured: before[gained[0]] || null };
  }
  return null;
}

function findKingInCheck(game: Chess): string | null {
  if (!game.inCheck()) return null;
  const turn = game.turn();
  const board = game.board();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p && p.type === "k" && p.color === turn) {
        return `${FILES[j]}${8 - i}`;
      }
    }
  }
  return null;
}
