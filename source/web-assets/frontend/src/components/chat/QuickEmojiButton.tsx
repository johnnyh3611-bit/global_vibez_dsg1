/**
 * QuickEmojiButton — A drop-in emoji picker button for any chat input.
 * Click the smile icon → 24-emoji popover → click an emoji → calls
 * `onPick(emoji)` so the parent appends the emoji to its input state.
 *
 * Designed to match the SpadesCommunityChat aesthetic (8-col grid, hover
 * highlight) but visually neutral so it can fit any chat surface.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";

export const QUICK_EMOJIS = [
  "❤️", "😂", "😍", "🔥", "👍", "👏",
  "😊", "🎉", "😢", "😮", "😎", "🤔",
  "💯", "✨", "🙏", "💪", "🎊", "😘",
  "♠️", "♥️", "♣️", "♦️", "🃏", "🎲",
];

interface Props {
  onPick: (emoji: string) => void;
  /** Tailwind classes for the trigger button (defaults to neutral). */
  className?: string;
  /** Direction the popover opens (default "up"). */
  direction?: "up" | "down";
  /** data-testid prefix (defaults to "quick-emoji"). */
  testIdPrefix?: string;
}

export const QuickEmojiButton: React.FC<Props> = ({
  onPick,
  className = "p-2 rounded-lg bg-slate-900/70 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition",
  direction = "up",
  testIdPrefix = "quick-emoji",
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={className}
        data-testid={`${testIdPrefix}-toggle`}
        aria-label="Open emoji picker"
      >
        <Smile className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: direction === "up" ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction === "up" ? 10 : -10 }}
            className={`absolute z-50 ${direction === "up" ? "bottom-full mb-2" : "top-full mt-2"} left-0 w-64`}
            data-testid={`${testIdPrefix}-panel`}
          >
            <div className="bg-slate-950/95 backdrop-blur border border-purple-500/30 rounded-xl p-2 shadow-2xl">
              <div className="grid grid-cols-8 gap-1">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onPick(e);
                      setOpen(false);
                    }}
                    className="h-8 rounded hover:bg-purple-500/20 text-lg transition"
                    data-testid={`${testIdPrefix}-${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default QuickEmojiButton;
