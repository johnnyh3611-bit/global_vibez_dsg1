import { AnimatePresence, motion } from "framer-motion";
import { Flag, Share2, Star, X } from "lucide-react";
import { triggerHaptic } from "@/hooks/useGestures";

export type LongPressAction = {
  id: string;
  label: string;
  icon?: "share" | "favorite" | "report";
  danger?: boolean;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  title?: string;
  actions: LongPressAction[];
  onClose: () => void;
};

const ICONS = {
  share: Share2,
  favorite: Star,
  report: Flag,
};

/** Bottom sheet for long-press quick actions (share / favorite / report). */
export function LongPressSheet({ open, title, actions, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
          data-testid="long-press-sheet"
        >
          <motion.button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title || "Quick actions"}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative z-10 mb-4 w-full max-w-sm rounded-2xl border border-white/15 bg-[#121826] p-4 shadow-2xl sm:mb-0"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white/90">
                {title || "Quick actions"}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {actions.map((action) => {
                const Icon = action.icon ? ICONS[action.icon] : null;
                return (
                  <li key={action.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-white/5 ${
                        action.danger ? "text-rose-300" : "text-white"
                      }`}
                      onClick={() => {
                        triggerHaptic(action.danger ? "error" : "light");
                        action.onSelect();
                        onClose();
                      }}
                    >
                      {Icon && <Icon className="h-4 w-4 opacity-80" />}
                      {action.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
