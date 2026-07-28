/**
 * calculateHandArcLayout — Spades/Bid Whist fan physics as pure math.
 *
 * Arc −12°…+12° (24° span), overlap recomputed so the fan fits the
 * viewport. Used by SpadesHandFan and any room that wants the same feel.
 */

export type HandArcOpts = {
  viewportWidth: number;
  /** When the short side / height is tight (landscape phone), force sm cards. */
  viewportHeight?: number;
  handSize: number;
  maxFanWidth?: number;
  gutter?: number;
  size?: "sm" | "md" | "auto";
  arcDegrees?: number;
  naturalOverlap?: { sm: number; md: number };
  minStep?: number;
  cardWidths?: { sm: number; md: number };
};

export type HandArcSlot = {
  index: number;
  angleDeg: number;
  overlapPx: number;
  zIndex: number;
  size: "sm" | "md";
  cardWidth: number;
  marginLeft: number;
};

export type HandArcLayout = {
  slots: HandArcSlot[];
  cardSize: "sm" | "md";
  cardWidth: number;
  overlapPx: number;
  N: number;
};

const DEFAULT_WIDTHS = { sm: 48, md: 72 };
const DEFAULT_NATURAL = { sm: 18, md: 28 };

export function calculateHandArcLayout(opts: HandArcOpts): HandArcLayout {
  const {
    viewportWidth,
    viewportHeight,
    handSize,
    maxFanWidth = 700,
    gutter = 32,
    size = "auto",
    arcDegrees = 24,
    naturalOverlap = DEFAULT_NATURAL,
    minStep = 12,
    cardWidths = DEFAULT_WIDTHS,
  } = opts;

  const N = Math.max(handSize, 1);
  const isMobile = viewportWidth < 640;
  const shortHeight =
    typeof viewportHeight === "number" &&
    viewportHeight > 0 &&
    viewportHeight < 520;
  const cardSize: "sm" | "md" =
    size === "auto"
      ? shortHeight || (isMobile && N >= 10)
        ? "sm"
        : "md"
      : size;
  const cardW = cardWidths[cardSize];
  const targetWidth = Math.min(viewportWidth - gutter, maxFanWidth);
  const natural = naturalOverlap[cardSize];
  const overlapPx = Math.max(
    natural,
    cardW - Math.max((targetWidth - cardW) / Math.max(N - 1, 1), minStep),
  );

  const slots: HandArcSlot[] = Array.from({ length: handSize }, (_, i) => {
    const angleDeg =
      ((i - (N - 1) / 2) / Math.max(N - 1, 1)) * arcDegrees;
    return {
      index: i,
      angleDeg,
      overlapPx,
      zIndex: i,
      size: cardSize,
      cardWidth: cardW,
      marginLeft: i === 0 ? 0 : -overlapPx,
    };
  });

  return { slots, cardSize, cardWidth: cardW, overlapPx, N };
}
