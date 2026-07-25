import { useId } from "react";
import type { ChessTheme } from "./chessThemes";

type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
type PieceColor = "w" | "b";

type Props = {
  type: PieceType;
  color: PieceColor;
  theme: ChessTheme;
  size?: number;
  lifted?: boolean;
  className?: string;
};

/** Weighted, glossy SVG chess pieces — theme-driven fills. */
export default function ChessPieceSvg({
  type,
  color,
  theme,
  size = 56,
  lifted = false,
  className = "",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const glossId = `gloss-${uid}-${color}-${type}`;
  const pal = color === "w" ? theme.whitePiece : theme.blackPiece;
  const path = PIECE_PATHS[type];
  return (
    <svg
      viewBox="0 0 45 45"
      width={size}
      height={size}
      className={className}
      style={{
        filter: lifted
          ? `drop-shadow(0 10px 14px ${pal.shadow}) drop-shadow(0 2px 2px ${pal.shadow})`
          : `drop-shadow(0 4px 6px ${pal.shadow}) drop-shadow(0 1px 1px ${pal.shadow})`,
        transition: "filter 160ms ease, transform 160ms ease",
        transform: lifted ? "translateY(-6px) scale(1.08)" : "none",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.gloss} />
          <stop offset="55%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <g fill={pal.fill} stroke={pal.stroke} strokeWidth="1.4" strokeLinejoin="round">
        <path d={path} />
      </g>
      <path d={path} fill={`url(#${glossId})`} opacity={0.85} />
    </svg>
  );
}

/** Standard chess.com-style silhouettes (viewBox 45×45). */
const PIECE_PATHS: Record<PieceType, string> = {
  p: "M22.5 9c-2.2 0-4 2.1-4 4.5 0 1.2.5 2.3 1.3 3.1C17.3 18 15 20.7 15 25c0 2.2 1.1 3.8 2.5 4.8V34h10v-4.2c1.4-1 2.5-2.6 2.5-4.8 0-4.3-2.3-7-4.8-8.4.8-.8 1.3-1.9 1.3-3.1 0-2.4-1.8-4.5-4-4.5z",
  r: "M9 39h27v-3H9v3zm3-6h21V18l-3-2v-3h-3v3h-3v-3h-3v3h-3v-3h-3v3l-3 2v15zm3-15h3v6h-3v-6zm6 0h3v6h-3v-6zm6 0h3v6h-3v-6z",
  n: "M22 10c-2 0-5 2-7 5-3 4-4 8-3 12l2 4h4l-1-3c0-3 1-6 3-8 1 3 3 5 6 6 2 1 3 3 3 5v3h4v-4c0-4-2-7-5-9 2-1 3-3 3-5 0-3-2-6-5-6h-4z",
  b: "M22.5 8c-1.5 2-4 5-4 8 0 2 1 3.5 2.5 4.5C17 23 14 27 14 32c0 2.5 1.5 4 3.5 5H28c2-1 3.5-2.5 3.5-5 0-5-3-9-7-11.5 1.5-1 2.5-2.5 2.5-4.5 0-3-2.5-6-4.5-8zm0 12l3 8h-6l3-8z",
  q: "M12 38h21v-3H12v3zm2-6h17l-1-10 4-9-5 3-3.5-7L22.5 16 19.5 9l-3.5 9-5-3 4 9-1 10z",
  k: "M22.5 6v4h-3v3h3v3h3v-3h3v-3h-3V6h-3zM12 38h21v-3H12v3zm2-6h17l-1-12c2-1 4-3 4-6 0-3-2-5-5-5-2 0-3.5 1-4.5 2.5C23.5 10 22 9 20 9c-3 0-5 2-5 5 0 3 2 5 4 6l-1 12z",
};

export function pieceFromFenChar(ch: string): { type: PieceType; color: PieceColor } | null {
  if (!ch || ch === "1" || ch === "/") return null;
  const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
  const type = ch.toLowerCase() as PieceType;
  if (!"kqrbnp".includes(type)) return null;
  return { type, color };
}
