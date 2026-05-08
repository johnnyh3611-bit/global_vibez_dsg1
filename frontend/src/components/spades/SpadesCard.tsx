/**
 * SpadesCard — Universal Vibez-branded playing card.
 *
 * Used by every AAA card room (Spades, Bid Whist, Hearts, Crazy Eights,
 * Go Fish, Gin Rummy, Rummy, UNO, Euchre, War). Updating the visuals
 * here propagates instantly across all 9 rooms.
 *
 * Visual contract:
 *   • Number cards (2..10) — corner index + big centre suit symbol.
 *   • ACE — corner "A" + oversized centre suit + subtle "VIBEZ ACE" tag.
 *   • Court cards (J/Q/K) — stylized monogram in a gradient bezel with
 *     mini suit pips beside the monogram. (No more bare "K" letter —
 *     user complaint Feb 2026.)
 *   • BIG_JOKER — gold/fuchsia gradient crest with "JOKER · BIG" wordmark
 *     stamped over the Vibez diamond pattern. (User: "you can put the
 *     Vibe symbol joker, Vibe symbol little joker to make it a little
 *     more cooler in the game for the joker face.")
 *   • LITTLE_JOKER — cyan/silver gradient crest, "JOKER · LITTLE" wordmark.
 *   • Promoted Big-Wheel non-jokers (2♠/2♦) — neon ring + tiny tag.
 *   • Face-down — deep glass gradient + gradient diamond crest.
 */
import React from "react";
import { motion } from "framer-motion";
import type { SpadesCard as SpadesCardData } from "./types";

const SUIT_SYMBOL: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

// Inks darkened Feb 2026 (testers said the imprints were "too light, can't
// see them" — Hearts/Pinochle/Euchre on glowing modal backdrops washed out
// the previous rose-700 reds). Deepened to rose-900 ink with a touch of
// black mix so the central pip + corner index read clearly on any felt.
const SUIT_COLOR: Record<string, string> = {
  spades: "#000000",
  hearts: "#7f1d1d",
  diamonds: "#7f1d1d",
  clubs: "#000000",
};

// Bigger corner indices + bigger central pip so ranks/suits are
// unambiguous at small hand-fan sizes. Bumped again Feb 2026 (round 2)
// after testers said the previous bump still wasn't enough.
const DIM_SIZES = {
  sm: { w: 48, h: 70,  rank: 16, suit: 16, big: 30, monogram: 34 },
  md: { w: 72, h: 102, rank: 22, suit: 22, big: 44, monogram: 50 },
  lg: { w: 92, h: 132, rank: 28, suit: 28, big: 56, monogram: 64 },
};

const RANK_DISPLAY: Record<string, string> = {
  J: "J",
  Q: "Q",
  K: "K",
  A: "A",
  BIG_JOKER: "★",
  LITTLE_JOKER: "✦",
  "2_SPADES": "2",
  "2_DIAMONDS": "2",
};

const PROMOTED_LABEL: Record<string, string> = {
  BIG_JOKER: "BIG",
  LITTLE_JOKER: "LITTLE",
  "2_SPADES": "2♠",
  "2_DIAMONDS": "2♦",
};

interface Props {
  card?: SpadesCardData;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  isPlayable?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
  className?: string;
}

// ─── Joker face — Vibez-branded crest ──────────────────────────────────
function JokerFace({
  variant,
  dim,
}: {
  variant: "big" | "little";
  dim: typeof DIM_SIZES[keyof typeof DIM_SIZES];
}) {
  const isBig = variant === "big";
  // Big = gold + fuchsia royal palette. Little = cyan + silver chrome.
  const bgGradient = isBig
    ? "linear-gradient(135deg, #fde68a 0%, #fbbf24 40%, #be185d 100%)"
    : "linear-gradient(135deg, #e0f2fe 0%, #67e8f9 40%, #4338ca 100%)";
  const ringColour = isBig ? "rgba(217,70,239,0.65)" : "rgba(34,211,238,0.65)";
  const ink = isBig ? "#3f0a1e" : "#0b1f44";
  const accent = isBig ? "#fde68a" : "#e0f2fe";
  return (
    <div className="absolute inset-0">
      {/* Full-card gradient */}
      <div className="absolute inset-0" style={{ background: bgGradient }} />
      {/* Diagonal Vibez weave (matches the card back) */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 1px, transparent 1px 6px)",
        }}
      />
      {/* Inner bezel ring */}
      <div
        className="absolute inset-1 rounded-md"
        style={{
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 0 12px ${ringColour}`,
        }}
      />
      {/* Centre Vibez crest — diamond + V monogram */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: dim.monogram,
            height: dim.monogram,
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.05))",
            boxShadow: `0 0 14px ${ringColour}`,
          }}
        >
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: dim.monogram * 0.55,
              color: ink,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: `0 1px 0 ${accent}`,
            }}
          >
            V
          </span>
        </div>
      </div>
      {/* JOKER wordmark */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center font-black uppercase tracking-[0.25em]"
        style={{
          bottom: dim.suit * 0.6,
          color: ink,
          fontSize: dim.suit * 0.45,
          textShadow: `0 1px 0 ${accent}`,
          fontFamily: "'Cinzel', serif",
        }}
      >
        {isBig ? "Big · Joker" : "Little · Joker"}
      </div>
    </div>
  );
}

// ─── Court card — J/Q/K stylized monogram ─────────────────────────────
function CourtFace({
  rank,
  suit,
  colour,
  symbol,
  dim,
}: {
  rank: string;
  suit: string;
  colour: string;
  symbol: string;
  dim: typeof DIM_SIZES[keyof typeof DIM_SIZES];
}) {
  // Filigree gradient frame inside the white card. Monogram letter sits
  // in the centre with mini suit pips at its top-right & bottom-left.
  const isRed = suit === "hearts" || suit === "diamonds";
  const frameStroke = isRed
    ? "linear-gradient(135deg, #fda4af 0%, #f43f5e 50%, #881337 100%)"
    : "linear-gradient(135deg, #cbd5e1 0%, #475569 50%, #0f172a 100%)";
  return (
    <div className="absolute inset-0">
      {/* Filigree bezel — a coloured frame inside the white face. 2px
          stroke so it's visible at thumbnail sizes too. */}
      <div
        className="absolute inset-1.5 rounded-md"
        style={{
          padding: 2,
          background: frameStroke,
        }}
      >
        <div className="w-full h-full rounded-md bg-white" />
      </div>
      {/* Monogram centre */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: dim.monogram,
            color: colour,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: isRed ? "0 1px 0 #fda4af" : "0 1px 0 #94a3b8",
          }}
        >
          {rank}
        </span>
      </div>
      {/* Mini suit pip top-right of monogram */}
      <div
        className="absolute"
        style={{
          top: dim.h * 0.32,
          right: dim.w * 0.22,
          color: colour,
          fontSize: dim.suit,
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {symbol}
      </div>
      {/* Mini suit pip bottom-left of monogram */}
      <div
        className="absolute rotate-180"
        style={{
          bottom: dim.h * 0.32,
          left: dim.w * 0.22,
          color: colour,
          fontSize: dim.suit,
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {symbol}
      </div>
    </div>
  );
}

export const SpadesCard: React.FC<Props> = ({
  card,
  faceDown = false,
  size = "md",
  isPlayable = true,
  isDimmed = false,
  onClick,
  className = "",
}) => {
  const dim = DIM_SIZES[size];

  // ─── Face-down (card back) ──────────────────────────────────────
  if (faceDown || !card) {
    return (
      <motion.div
        whileHover={onClick ? { y: -4, scale: 1.02 } : undefined}
        onClick={onClick}
        style={{ width: dim.w, height: dim.h }}
        className={`relative rounded-lg overflow-hidden cursor-default shadow-[0_4px_18px_rgba(0,0,0,0.55)] ${className}`}
        data-testid="spades-card-back"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f44] via-[#162555] to-[#050818]" />
        <div className="absolute inset-0 rounded-lg border border-cyan-400/30" />
        <div
          className="absolute inset-1 rounded-md opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(34,211,238,0.18) 0 1px, transparent 1px 6px)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
            style={{ width: dim.big, height: dim.big }}
          />
        </div>
      </motion.div>
    );
  }

  // ─── Face-up ────────────────────────────────────────────────────
  const promoted = !!card.promoted;
  const promotedId = card.promoted_id ?? card.rank;
  const suit = card.suit;
  const rank = RANK_DISPLAY[card.rank] ?? card.rank;
  const colour = SUIT_COLOR[suit];
  const symbol = SUIT_SYMBOL[suit];

  const isBigJoker =
    card.rank === "BIG_JOKER" ||
    promotedId === "BIG_JOKER" ||
    card.type === "big_joker" ||
    (card.suit === "joker" && (card.rank === "Big" || card.value >= 16));
  const isLittleJoker =
    card.rank === "LITTLE_JOKER" ||
    promotedId === "LITTLE_JOKER" ||
    card.type === "little_joker" ||
    (card.suit === "joker" && (card.rank === "Little" || card.value === 15));
  const isJoker = isBigJoker || isLittleJoker;
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isAce = card.rank === "A";

  const promotedRingClass = promoted
    ? "ring-2 ring-fuchsia-400/70 shadow-[0_0_18px_rgba(217,70,239,0.45)]"
    : "";

  // Joker corner ink — match the gradient of the joker face for legibility.
  const cornerInk = isBigJoker ? "#3f0a1e" : isLittleJoker ? "#0b1f44" : colour;
  const cornerSymbol = isJoker ? "✦" : symbol;
  const cornerRank = isJoker ? "★" : rank;

  return (
    <motion.div
      whileHover={onClick && isPlayable ? { y: -10, scale: 1.04 } : undefined}
      onClick={isPlayable ? onClick : undefined}
      role={isPlayable && onClick ? "button" : undefined}
      aria-label={
        isPlayable && onClick
          ? isBigJoker
            ? "Play Big Joker"
            : isLittleJoker
              ? "Play Little Joker"
              : `Play ${rank} of ${suit}`
          : undefined
      }
      style={{ width: dim.w, height: dim.h }}
      className={`relative rounded-lg bg-white overflow-hidden select-none transition-all duration-200 ${
        isPlayable && onClick ? "cursor-pointer" : "cursor-default"
      } ${isDimmed ? "opacity-40 grayscale" : ""} ${promotedRingClass} shadow-[0_3px_12px_rgba(0,0,0,0.5)] ${
        isPlayable && onClick
          ? "hover:shadow-[0_6px_24px_rgba(34,211,238,0.45)] hover:ring-2 hover:ring-cyan-400/60"
          : ""
      } ${className}`}
      data-testid={`spades-card-${card.rank}-${card.suit}`}
    >
      {/* Centre artwork — Joker > Court > Ace > Number */}
      {isBigJoker ? (
        <JokerFace variant="big" dim={dim} />
      ) : isLittleJoker ? (
        <JokerFace variant="little" dim={dim} />
      ) : isCourt ? (
        <CourtFace rank={rank} suit={suit} colour={colour} symbol={symbol} dim={dim} />
      ) : (
        // Ace + Number cards — big centred suit pip on white face.
        // Boosted Feb 2026 (round 2): heavier text-stroke + drop-shadow
        // so the central imprint is unmistakable even on glowing felts.
        <div
          className="absolute inset-0 flex items-center justify-center font-black leading-none"
          style={{
            color: colour,
            fontSize: isAce ? dim.big * 1.3 : dim.big,
            textShadow: isAce
              ? "0 2px 6px rgba(0,0,0,0.22)"
              : "0 1px 2px rgba(0,0,0,0.15)",
            WebkitTextStroke: "0.6px " + colour,
          }}
        >
          {symbol}
        </div>
      )}

      {/* Top-left corner index — bold serif rank + suit. Boosted Feb
          2026 (round 2): wider text-stroke + heavier drop-shadow so the
          rank/suit is unmistakable on any felt, even through modal glows.
          - z-30 keeps it ABOVE court-card monograms / ace pips.
          - text-stroke + drop-shadow give the ink real weight. */}
      <div
        className="absolute top-0.5 left-1 z-30 flex flex-col items-center font-black leading-[0.95]"
        style={{
          color: cornerInk,
          textShadow: "0 1px 0 rgba(255,255,255,0.95), 0 0 1px rgba(0,0,0,0.4)",
          fontFamily: "'Cinzel', 'Georgia', serif",
          WebkitTextStroke: "0.7px " + cornerInk,
        }}
      >
        <span style={{ fontSize: dim.rank }}>{cornerRank}</span>
        <span style={{ fontSize: dim.suit, lineHeight: 1 }}>{cornerSymbol}</span>
      </div>
      {/* Bottom-right corner index — same treatment, rotated. */}
      <div
        className="absolute bottom-0.5 right-1 z-30 flex flex-col items-center font-black leading-[0.95] rotate-180"
        style={{
          color: cornerInk,
          textShadow: "0 1px 0 rgba(255,255,255,0.95), 0 0 1px rgba(0,0,0,0.4)",
          fontFamily: "'Cinzel', 'Georgia', serif",
          WebkitTextStroke: "0.7px " + cornerInk,
        }}
      >
        <span style={{ fontSize: dim.rank }}>{cornerRank}</span>
        <span style={{ fontSize: dim.suit, lineHeight: 1 }}>{cornerSymbol}</span>
      </div>

      {/* Ace tag — "VIBEZ" wordmark below the giant pip. Sized so it's
          legible even on small hand-fan cards. */}
      {isAce ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center font-black uppercase tracking-[0.2em] pointer-events-none"
          style={{
            bottom: Math.max(4, dim.suit * 0.4),
            color: colour,
            fontSize: Math.max(7, dim.suit * 0.55),
            opacity: 0.7,
            fontFamily: "'Cinzel', serif",
          }}
        >
          Vibez
        </div>
      ) : null}

      {/* Promoted (Big Wheel non-joker) label badge */}
      {promoted && !isJoker ? (
        <div
          className="absolute top-1 right-1 px-1 py-0.5 rounded bg-fuchsia-500/95 text-white text-[8px] font-black uppercase tracking-wider"
          style={{ fontSize: 8 }}
        >
          {PROMOTED_LABEL[promotedId] ?? "TRUMP"}
        </div>
      ) : null}
    </motion.div>
  );
};

export default SpadesCard;
