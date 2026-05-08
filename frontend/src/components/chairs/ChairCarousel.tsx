/**
 * 3D rotating chair carousel for the Vault.
 *
 * Pure CSS-3D + framer-motion. No external 3D library so the page
 * loads instant. Renders up to 6 chair ORBS (Feb 2026) spinning
 * around a vertical axis; if the user owns more than 6 we just
 * label the front-most chair "+N more" so the perf doesn't explode.
 *
 * Chair labels prefer real permanent IDs (`chairIds` prop) — the
 * sequential numbers stamped at buy-time and visible on the public
 * Chair Wall. Falls back to placeholder #00001-#00006 when the IDs
 * prop is empty (e.g. legacy carousel callers that haven't been
 * wired to /api/chairs/me yet).
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import ChairOrb from "@/components/chairs/ChairOrb";

type Props = {
  chairCount: number;
  phaseLabel: string;
  chairIds?: number[];
};

export default function ChairCarousel({
  chairCount,
  phaseLabel,
  chairIds = [],
}: Props) {
  const visible = Math.min(Math.max(chairCount, 1), 6);
  const slots = Array.from({ length: visible });
  // Pick the LAST N chair IDs so the carousel preferentially shows the
  // user's most recently-parked chairs. Falls back to sequential
  // 1..N placeholders only if no IDs were passed.
  const ids: number[] = chairIds.length
    ? chairIds.slice(-visible)
    : slots.map((_, i) => i + 1);

  return (
    <div
      className="relative h-72 w-full flex items-center justify-center"
      style={{ perspective: 1100 }}
      data-testid="chair-carousel"
    >
      <motion.div
        className="relative w-32 h-32"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        {slots.map((_, i) => {
          const angle = (360 / visible) * i;
          return (
            <div
              key={i}
              className="absolute top-0 left-0 w-32 h-32 flex items-center justify-center"
              style={{ transform: `rotateY(${angle}deg) translateZ(140px)` }}
              data-testid={`carousel-chair-slot-${i}`}
            >
              <ChairOrb
                chairId={ids[i]}
                phase={phaseLabel}
                size="sm"
                staticOrb
                testId={`carousel-chair-label-${i}`}
              />
            </div>
          );
        })}
      </motion.div>

      {chairCount > 6 && (
        <p className="absolute top-2 right-4 text-[10px] uppercase tracking-widest text-amber-300/80">
          + {chairCount - 6} more parked
        </p>
      )}
      <div className="absolute bottom-2 inset-x-0 text-center">
        <p className="text-[11px] uppercase tracking-widest text-cyan-400 animate-pulse">
          {phaseLabel} phase · vaulted
        </p>
        <Link
          to="/chair-wall"
          className="inline-flex items-center gap-1 mt-1 text-[10px] uppercase tracking-widest text-fuchsia-300 hover:text-fuchsia-200"
          data-testid="carousel-wall-link"
        >
          View Public Wall <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}
