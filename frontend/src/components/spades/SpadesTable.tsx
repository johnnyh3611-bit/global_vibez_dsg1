/**
 * SpadesTable — Universal 4-seat table shell.
 *
 * Base layout (seat positions, card pile anchor, casino chip slot) is
 * FROZEN and reused by every 4-player card room on the platform
 * (Spades, Bid Whist, …). Only the felt colour + wood bezel + centre
 * chip accent change per-game via the `variant` prop so each room
 * retains a unique identity without diverging from the prototype
 * the user declared canonical.
 *
 *   • emerald  → Spades AAA (emerald felt + amber wood + ♠ chip)
 *   • cobalt   → Bid Whist AAA (royal cobalt felt + mahogany + 🃏 chip)
 *   • crimson  → reserved for Hearts / future red-felt rooms
 *   • onyx     → reserved for Poker / ultra-dark rooms
 *
 * Seat anchors are identical across variants so the universal
 * SpadesSeat/HandFan/TrickPile/etc. components never need to change.
 */
import React, { Children } from "react";

export type SpadesTableVariant = "emerald" | "cobalt" | "crimson" | "onyx" | "ocean" | "gold" | "jade" | "ruby" | "neon" | "pearl" | "monaco";

interface Props {
  children: React.ReactNode;
  /** Optional branding text inside the casino chip (default "SPADES AAA"). */
  brandSubLabel?: string;
  /** Table theme — felt + wood + centre-chip accent. Defaults to emerald. */
  variant?: SpadesTableVariant;
  /** Optional override for the single-character suit shown in the casino chip. */
  centreGlyph?: string;
  /** Visual density. "4p" (default) shows N/E/S/W anchors at full size.
      "2p" hides the E/W anchors implicitly (the parent simply omits those
      seats) but also tightens the table footprint so the 2-player room
      doesn't feel sparse. */
  density?: "4p" | "2p";
}

// Table visual tokens per variant. Seat anchors (POS_DESKTOP) are NOT
// in here — they're identical across every variant by design.
const VARIANT_TOKENS: Record<
  SpadesTableVariant,
  {
    felt: string;            // tailwind bg-* for the emerald/cobalt/…  felt
    bezel: string;           // tailwind border-* for the wood ring
    shadow: string;          // tailwind shadow-[…] for outer glow
    chipRing: string;        // tailwind border-* for the centre chip ring
    chipAccentFrom: string;  // tailwind from-* for chip's inner glow
    chipText: string;        // tailwind text-* for the brand word
    chipTagBorder: string;   // tailwind border-* for the sub-label tag
    chipTagText: string;     // tailwind text-* for the sub-label tag
    chipPips: string;        // tailwind text-* for the 4 suit pips
    defaultGlyph: string;    // centre suit glyph if no override
  }
> = {
  emerald: {
    felt:           "bg-emerald-800",
    bezel:          "border-amber-900/90",
    shadow:         "shadow-[0_0_60px_rgba(6,78,59,0.6)]",
    chipRing:       "border-amber-500",
    chipAccentFrom: "from-amber-500/20",
    chipText:       "text-amber-400",
    chipTagBorder:  "border-amber-500/50",
    chipTagText:    "text-amber-300",
    chipPips:       "text-amber-400",
    defaultGlyph:   "♠",
  },
  cobalt: {
    // Deep royal felt with mahogany bezel — distinct from Spades at a
    // glance but every seat/anchor position stays identical.
    felt:           "bg-[#0b2a5e]",
    bezel:          "border-[#3d1a0b]",
    shadow:         "shadow-[0_0_60px_rgba(30,64,175,0.45)]",
    chipRing:       "border-cyan-300",
    chipAccentFrom: "from-cyan-400/25",
    chipText:       "text-cyan-200",
    chipTagBorder:  "border-cyan-300/60",
    chipTagText:    "text-cyan-200",
    chipPips:       "text-cyan-200",
    defaultGlyph:   "♦",
  },
  crimson: {
    felt:           "bg-[#6b1226]",
    bezel:          "border-[#2a0a12]",
    shadow:         "shadow-[0_0_60px_rgba(190,18,60,0.45)]",
    chipRing:       "border-rose-300",
    chipAccentFrom: "from-rose-400/25",
    chipText:       "text-rose-200",
    chipTagBorder:  "border-rose-300/60",
    chipTagText:    "text-rose-200",
    chipPips:       "text-rose-200",
    defaultGlyph:   "♥",
  },
  onyx: {
    felt:           "bg-[#111827]",
    bezel:          "border-[#1f2937]",
    shadow:         "shadow-[0_0_60px_rgba(99,102,241,0.35)]",
    chipRing:       "border-indigo-300",
    chipAccentFrom: "from-indigo-400/25",
    chipText:       "text-indigo-200",
    chipTagBorder:  "border-indigo-300/60",
    chipTagText:    "text-indigo-200",
    chipPips:       "text-indigo-200",
    defaultGlyph:   "♣",
  },
  ocean: {
    // Teal-and-aqua felt with weathered driftwood bezel — Go Fish vibe.
    felt:           "bg-[#053b3b]",
    bezel:          "border-[#5a3818]",
    shadow:         "shadow-[0_0_60px_rgba(20,184,166,0.45)]",
    chipRing:       "border-cyan-300",
    chipAccentFrom: "from-cyan-400/25",
    chipText:       "text-cyan-100",
    chipTagBorder:  "border-cyan-300/60",
    chipTagText:    "text-cyan-100",
    chipPips:       "text-cyan-100",
    defaultGlyph:   "🐟",
  },
  gold: {
    // Warm honey-gold felt with deep walnut bezel — Gin Rummy parlour.
    felt:           "bg-[#3a2710]",
    bezel:          "border-[#1f1208]",
    shadow:         "shadow-[0_0_60px_rgba(245,158,11,0.45)]",
    chipRing:       "border-amber-300",
    chipAccentFrom: "from-amber-400/25",
    chipText:       "text-amber-200",
    chipTagBorder:  "border-amber-300/60",
    chipTagText:    "text-amber-200",
    chipPips:       "text-amber-200",
    defaultGlyph:   "G",
  },
  jade: {
    // Deep jade felt with lacquered black bezel — Rummy salon.
    felt:           "bg-[#0a3525]",
    bezel:          "border-[#0a0f0a]",
    shadow:         "shadow-[0_0_60px_rgba(34,197,94,0.45)]",
    chipRing:       "border-emerald-300",
    chipAccentFrom: "from-emerald-400/25",
    chipText:       "text-emerald-200",
    chipTagBorder:  "border-emerald-300/60",
    chipTagText:    "text-emerald-200",
    chipPips:       "text-emerald-200",
    defaultGlyph:   "R",
  },
  ruby: {
    // Smouldering ruby felt with charcoal bezel — War battle pit.
    felt:           "bg-[#4a0c10]",
    bezel:          "border-[#1a0205]",
    shadow:         "shadow-[0_0_60px_rgba(225,29,72,0.55)]",
    chipRing:       "border-rose-400",
    chipAccentFrom: "from-rose-500/30",
    chipText:       "text-rose-100",
    chipTagBorder:  "border-rose-300/60",
    chipTagText:    "text-rose-100",
    chipPips:       "text-rose-200",
    defaultGlyph:   "⚔",
  },
  neon: {
    // Deep midnight felt with neon-accented chrome bezel — UNO arena.
    felt:           "bg-[#0a0512]",
    bezel:          "border-[#23253b]",
    shadow:         "shadow-[0_0_60px_rgba(168,85,247,0.55)]",
    chipRing:       "border-fuchsia-400",
    chipAccentFrom: "from-fuchsia-500/30",
    chipText:       "text-fuchsia-200",
    chipTagBorder:  "border-fuchsia-300/60",
    chipTagText:    "text-fuchsia-200",
    chipPips:       "text-fuchsia-200",
    defaultGlyph:   "U",
  },
  pearl: {
    // Soft pearl-grey felt with platinum bezel — Pinochle salon vibe.
    felt:           "bg-[#252533]",
    bezel:          "border-[#9ca3af]",
    shadow:         "shadow-[0_0_60px_rgba(203,213,225,0.45)]",
    chipRing:       "border-slate-200",
    chipAccentFrom: "from-slate-200/30",
    chipText:       "text-slate-100",
    chipTagBorder:  "border-slate-200/70",
    chipTagText:    "text-slate-100",
    chipPips:       "text-slate-200",
    defaultGlyph:   "P",
  },
  monaco: {
    // Riviera-emerald felt with deep-charcoal bezel + ambient gold pips —
    // Baccarat pit-table aesthetic. Adds a subtle warm under-glow that
    // sets it apart from the cooler Spades emerald.
    felt:           "bg-[#064e3b]",
    bezel:          "border-[#0a0d12]",
    shadow:         "shadow-[0_0_70px_rgba(251,191,36,0.32)]",
    chipRing:       "border-amber-300",
    chipAccentFrom: "from-amber-400/30",
    chipText:       "text-amber-100",
    chipTagBorder:  "border-amber-300/60",
    chipTagText:    "text-amber-100",
    chipPips:       "text-amber-200",
    defaultGlyph:   "B",
  },
};

// Positions match the BidWhistPremium `positions` object exactly.
// N/S are lifted further OFF the felt and E/W pushed harder out toward
// the long-edge horizon so the orbs float cleanly beside the table
// instead of overlapping the rim (per the user's ask to make the
// players sit outside the table).
const POS_DESKTOP: Record<string, React.CSSProperties> = {
  north: { top: "-3.25rem", left: "50%", transform: "translateX(-50%)" },
  south: { bottom: "-3.25rem", left: "50%", transform: "translateX(-50%)" },
  east:  { right: "-7rem", top: "50%", transform: "translateY(-50%)" },
  west:  { left: "-7rem",  top: "50%", transform: "translateY(-50%)" },
};

export const SpadesTable: React.FC<Props> = ({
  children,
  brandSubLabel = "SPADES AAA",
  variant = "emerald",
  centreGlyph,
  density = "4p",
}) => {
  const tokens = VARIANT_TOKENS[variant];
  const glyph = centreGlyph ?? tokens.defaultGlyph;

  const childArray = Children.toArray(children);
  const seats: React.ReactNode[] = [];
  let center: React.ReactNode = null;

  for (const c of childArray) {
    if (!React.isValidElement(c)) continue;
    const pos = (c.props as { position?: string }).position;
    if (pos && pos in POS_DESKTOP) {
      seats.push(c);
    } else {
      center = c;
    }
  }

  // 2-player density narrows the long-axis so the head-to-head feels
  // intimate rather than sparse. We also reduce the corner radius so
  // the table reads more like a card-room booth than an arena.
  const sizeClass = density === "2p"
    ? "w-[78vw] max-w-[560px] h-[44vw] max-h-[320px] md:h-[320px] rounded-[110px] md:rounded-[160px]"
    : "w-[90vw] max-w-[720px] h-[52vw] max-h-[420px] md:h-[420px] rounded-[150px] md:rounded-[210px]";
  const innerRadius = density === "2p"
    ? "rounded-[100px] md:rounded-[150px]"
    : "rounded-[140px] md:rounded-[200px]";

  return (
    <div
      className={`relative ${sizeClass} border-[10px] md:border-[14px] mx-auto ${tokens.felt} ${tokens.bezel} ${tokens.shadow}`}
      data-testid="spades-table"
      data-variant={variant}
      data-density={density}
    >
      {/* Subtle felt grid pattern (matches BidWhistPremium) */}
      <div
        className={`absolute inset-0 opacity-5 ${innerRadius}`}
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── CENTER CASINO CHIP (matches BidWhistPremium brand chip) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-[6px] md:border-8 shadow-2xl ${tokens.chipRing}`}>
          <div className={`absolute inset-2 rounded-full border-4 border-dashed ${tokens.chipRing} opacity-40`} />
          <div className={`absolute inset-4 rounded-full bg-gradient-to-br to-transparent ${tokens.chipAccentFrom}`} />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div
              className={`font-bold text-2xl md:text-3xl tracking-wider my-1 ${tokens.chipText}`}
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              VIBEZ
            </div>
            <div className="my-1 md:my-2 text-lg md:text-xl">{glyph}</div>
            <div
              className={`text-[9px] md:text-[10px] font-bold tracking-[0.3em] bg-slate-950/80 px-2 md:px-2.5 py-0.5 rounded-full border ${tokens.chipTagBorder} ${tokens.chipTagText}`}
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {brandSubLabel}
            </div>
          </div>

          {/* 4 suit pips at the cardinal edges (variant-coloured) */}
          <div className={`absolute top-2 md:top-3 left-1/2 -translate-x-1/2 text-lg md:text-xl ${tokens.chipPips}`}>♠</div>
          <div className={`absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 text-lg md:text-xl ${tokens.chipPips}`}>♥</div>
          <div className={`absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-lg md:text-xl ${tokens.chipPips}`}>♦</div>
          <div className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-lg md:text-xl ${tokens.chipPips}`}>♣</div>
        </div>
      </div>

      {/* ── CENTER TRICK PILE layer (above the chip) ── */}
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        {center}
      </div>

      {/* ── PLAYER BADGES at N/S/E/W (floating OUTSIDE the rim) ── */}
      {seats.map((c, i) => {
        const el = c as React.ReactElement<{ position: string }>;
        const pos = el.props.position;
        return (
          <div
            key={`seat-${pos}-${i}`}
            className="absolute z-20"
            style={POS_DESKTOP[pos]}
          >
            {c}
          </div>
        );
      })}
    </div>
  );
};

export default SpadesTable;
