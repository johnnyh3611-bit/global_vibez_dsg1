import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

export interface SwipeToUnlockProps {
  /** Text shown on the track. */
  label?: string;
  /** Fires when the thumb passes the unlock threshold. */
  onUnlock: () => void | Promise<void>;
  /** Optional disable (e.g. while a previous unlock is still in flight). */
  disabled?: boolean;
  /** Unique test id suffix for automated checks. */
  testId?: string;
  /** Track width in pixels (thumb stops at width - 56). */
  width?: number;
}

/**
 * Swipe-to-unlock gesture component — the web equivalent of the React Native
 * `PanGestureHandler` + Reanimated pattern. Drag the thumb right; when it
 * crosses ~80% of the track, `onUnlock` fires once and the thumb snaps to
 * its final position with a green confirmation.
 */
export default function SwipeToUnlock({
  label = 'Swipe to Unlock',
  onUnlock,
  disabled = false,
  testId = 'swipe-to-unlock',
  width = 320,
}: SwipeToUnlockProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [unlocked, setUnlocked] = useState(false);

  const thumbSize = 56;
  const maxX = Math.max(0, width - thumbSize - 4);
  const unlockThreshold = maxX * 0.8;

  // Track fill fades as the thumb travels
  const trackOpacity = useTransform(x, [0, maxX], [0.6, 1]);
  // Label fades out as thumb covers it
  const labelOpacity = useTransform(x, [0, maxX * 0.4], [1, 0]);

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || unlocked) return;
    if (info.point.x && x.get() >= unlockThreshold) {
      animate(x, maxX, { type: 'spring', stiffness: 300, damping: 28 });
      setUnlocked(true);
      try {
        await onUnlock();
      } catch {
        // Reset if the handler fails
        animate(x, 0, { type: 'spring', stiffness: 300, damping: 28 });
        setUnlocked(false);
      }
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 28 });
    }
  };

  return (
    <div
      ref={trackRef}
      data-testid={testId}
      className="relative rounded-full border border-white/20 bg-black/40 backdrop-blur-md select-none overflow-hidden"
      style={{ width, height: thumbSize + 4, padding: 2 }}
    >
      {/* Gradient fill behind the thumb */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          opacity: trackOpacity,
          background: unlocked
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, rgba(212, 175, 55, 0.5), rgba(236, 72, 153, 0.5))',
          pointerEvents: 'none',
        }}
      />

      {/* Centered label */}
      <motion.span
        className="absolute inset-0 flex items-center justify-center text-white/85 font-semibold text-sm tracking-wide"
        style={{ opacity: unlocked ? 0 : labelOpacity, pointerEvents: 'none' }}
      >
        {label}
      </motion.span>

      {/* Draggable thumb */}
      <motion.button
        type="button"
        data-testid={`${testId}-thumb`}
        aria-label={label}
        drag={disabled || unlocked ? false : 'x'}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
        style={{ x, width: thumbSize, height: thumbSize }}
        className="absolute top-0.5 left-0.5 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing disabled:cursor-not-allowed"
        disabled={disabled}
      >
        {unlocked ? <Check className="w-6 h-6 text-emerald-600" /> : <ArrowRight className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
