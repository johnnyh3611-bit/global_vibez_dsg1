/**
 * ShotClockRing — universal 10-second turn timer ring.
 *
 * Per Beta Specs PDF §4 (Vibez Whist Premium) and Universal Design
 * Agent v2 §2 (Universal Multiplayer Timing & Autoplay):
 *
 *   "10-Second Shot Clock: A visual timer ring must appear around the
 *   active player."
 *
 * Wraps a child (typically a SpadesSeat / player badge) with an SVG
 * progress ring that drains over `durationMs` (default 10000 = 10s).
 * Glows amber by default, switches to red in the final 3 seconds for
 * urgency. Calls `onExpire` exactly once when the ring hits 0. Reset
 * by changing the `expiresAt` prop (e.g. when the turn changes).
 *
 * Drift-resistant: uses `Date.now()` against a server-supplied
 * `expiresAt` epoch ms, so all clients see the same countdown even
 * across tab-pauses or slow renders.
 */
import React, { useEffect, useRef, useState } from "react";

interface Props {
  /** Absolute epoch ms when this turn expires. `null` disables the ring. */
  expiresAt: number | null;
  /** Total duration of this turn in ms — used to compute % remaining. */
  durationMs?: number;
  /** Fired exactly once when the ring reaches 0. */
  onExpire?: () => void;
  /** Children to wrap (the seat / badge). */
  children: React.ReactNode;
  /** Tailwind size class for the wrapper square. Default: w-24 h-24 (md+). */
  size?: number;
  /** Stroke width of the ring in px. */
  strokeWidth?: number;
}

export const ShotClockRing: React.FC<Props> = ({
  expiresAt,
  durationMs = 10000,
  onExpire,
  children,
  size = 110,
  strokeWidth = 4,
}) => {
  const [remaining, setRemaining] = useState<number>(durationMs);
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    if (!expiresAt) {
      setRemaining(durationMs);
      return;
    }

    let raf = 0;
    const tick = () => {
      const left = Math.max(0, expiresAt - Date.now());
      setRemaining(left);
      if (left <= 0) {
        if (!fired.current) {
          fired.current = true;
          onExpire?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [expiresAt, durationMs, onExpire]);

  const pct = expiresAt ? Math.max(0, Math.min(1, remaining / durationMs)) : 0;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const seconds = Math.ceil(remaining / 1000);

  // Switch to red urgency in the final 3 seconds.
  const urgent = expiresAt && remaining <= 3000 && remaining > 0;
  const color = !expiresAt ? "transparent" : urgent ? "#ef4444" : "#fbbf24";

  return (
    <div
      data-testid="shot-clock-ring"
      data-active={expiresAt ? "true" : "false"}
      data-seconds-remaining={expiresAt ? seconds : null}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {expiresAt ? (
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90 pointer-events-none"
          aria-hidden="true"
        >
          {/* track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke 0.2s ease",
              filter: urgent
                ? "drop-shadow(0 0 8px rgba(239,68,68,0.8))"
                : "drop-shadow(0 0 6px rgba(251,191,36,0.5))",
            }}
          />
        </svg>
      ) : null}

      {/* Seconds badge — tiny, unobtrusive, only when ring is active */}
      {expiresAt && remaining > 0 ? (
        <span
          data-testid="shot-clock-seconds"
          className={`absolute -top-1 -right-1 z-10 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center tabular-nums shadow-lg ${
            urgent
              ? "bg-red-500 text-white animate-pulse"
              : "bg-amber-400 text-black"
          }`}
        >
          {seconds}
        </span>
      ) : null}

      {/* The wrapped seat / badge */}
      <div className="relative z-0">{children}</div>
    </div>
  );
};

export default ShotClockRing;
