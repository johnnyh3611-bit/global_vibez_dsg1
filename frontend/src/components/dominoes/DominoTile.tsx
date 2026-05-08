/**
 * DominoTile — pip-rendered domino tile.
 *
 * The PDF calls for "Neon Resin Tiles: Semi-transparent black 3D models
 * with glowing pips". Web equivalent: a translucent obsidian tile with
 * frosted-glass inner sheen, classic dot pip layout per side, and an
 * indigo neon glow on hover / when playable.
 */
import React from "react";
import { motion } from "framer-motion";

export type Orientation = "h" | "v";

interface Props {
  left: number;       // 0..6 pips on the (visually) left/top half
  right: number;      // 0..6 pips on the (visually) right/bottom half
  orientation?: Orientation;     // "h" = horizontal tile, "v" = vertical
  size?: "sm" | "md" | "lg";
  playable?: boolean;            // glow + clickable
  active?: boolean;              // currently selected by user
  faceDown?: boolean;            // hidden / boneyard tile
  onClick?: () => void;
  testId?: string;
}

// 3x3 dot grid coordinates for each pip count (0..6).
const PIP_LAYOUT: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const SIZE_PRESET = {
  sm: { half: 28, dot: 4 },
  md: { half: 38, dot: 5 },
  lg: { half: 52, dot: 7 },
};

function PipFace({ value, half, dot }: { value: number; half: number; dot: number }) {
  const dots = PIP_LAYOUT[value] ?? [];
  return (
    <div
      className="relative bg-gradient-to-br from-slate-100 to-slate-300 rounded-[3px]"
      style={{ width: half, height: half }}
    >
      {dots.map(([row, col], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-slate-900 shadow-[inset_0_-1px_1px_rgba(255,255,255,0.5)]"
          style={{
            width: dot,
            height: dot,
            top: `${(row * (half - dot - 6)) / 2 + 3}px`,
            left: `${(col * (half - dot - 6)) / 2 + 3}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function DominoTile({
  left,
  right,
  orientation = "h",
  size = "md",
  playable,
  active,
  faceDown,
  onClick,
  testId,
}: Props) {
  const { half, dot } = SIZE_PRESET[size];
  const isClickable = !!onClick && !faceDown;
  const totalW = orientation === "h" ? half * 2 + 4 : half + 4;
  const totalH = orientation === "h" ? half + 4 : half * 2 + 4;

  if (faceDown) {
    return (
      <div
        className="rounded-md border-2 border-indigo-400/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-md"
        style={{ width: totalW, height: totalH }}
        data-testid={testId}
      >
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[10px] font-black text-indigo-300/50 uppercase tracking-widest">VIBEZ</span>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={isClickable ? { y: -4, scale: 1.05 } : undefined}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
      onClick={onClick}
      disabled={!isClickable}
      className={`relative rounded-md border-2 p-[2px] transition-all
        ${active ? "border-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,0.85)]" : ""}
        ${playable && !active ? "border-indigo-300 shadow-[0_0_14px_rgba(99,102,241,0.65)]" : ""}
        ${!playable && !active ? "border-slate-500/40 opacity-80" : ""}
        bg-gradient-to-br from-slate-200 via-white to-slate-300
      `}
      style={{ width: totalW, height: totalH }}
      data-testid={testId}
    >
      <div className={`w-full h-full flex ${orientation === "h" ? "flex-row" : "flex-col"} items-stretch justify-center gap-[2px]`}>
        <PipFace value={left} half={half} dot={dot} />
        <div
          className="bg-slate-900/70"
          style={
            orientation === "h"
              ? { width: 2, height: half }
              : { width: half, height: 2 }
          }
        />
        <PipFace value={right} half={half} dot={dot} />
      </div>
      {playable ? (
        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
      ) : null}
    </motion.button>
  );
}
