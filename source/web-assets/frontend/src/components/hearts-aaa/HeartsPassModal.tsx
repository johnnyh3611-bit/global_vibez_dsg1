/**
 * HeartsPassModal — 3-card pass selector for the Hearts AAA prototype.
 * Selection via shared useCardSelection (identical multi-select feel).
 */
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import type { SpadesCard as CardData } from "@/components/spades/types";
import { HandFan, useCardSelection } from "@/components/shared/cards";

interface Props {
  open: boolean;
  hand: CardData[];
  passDirection: "left" | "right" | "across" | "none";
  busy: boolean;
  onSubmit: (cards: CardData[]) => void;
}

const DIRECTION_LABEL: Record<Props["passDirection"], string> = {
  left: "Pass 3 cards LEFT",
  right: "Pass 3 cards RIGHT",
  across: "Pass 3 cards ACROSS",
  none: "No pass this hand",
};

export const HeartsPassModal: React.FC<Props> = ({
  open,
  hand,
  passDirection,
  busy,
  onSubmit,
}) => {
  const selection = useCardSelection({
    mode: "multi",
    max: 3,
    cards: hand,
    enabled: open && !busy,
  });

  useEffect(() => {
    if (open) selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open]);

  if (passDirection === "none" || !open) return null;

  const submit = () => {
    if (selection.count !== 3 || busy) return;
    onSubmit(selection.selected);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="hearts-pass-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
        data-testid="hearts-pass-modal"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="w-full max-w-2xl bg-gradient-to-br from-[#1a0a16] via-[#2a0c20] to-[#0a0508] border-2 border-rose-500/50 rounded-3xl shadow-[0_0_60px_rgba(244,63,94,0.35)] overflow-hidden"
        >
          <div className="px-5 pt-5 pb-3 border-b border-rose-500/30 flex items-center justify-between">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.3em] text-rose-300/70 font-bold"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Hearts · Pass Phase
              </p>
              <h3
                className="text-2xl font-black text-rose-200 leading-tight"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {DIRECTION_LABEL[passDirection]}
              </h3>
            </div>
            <div
              className="px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-100 text-sm font-black tabular-nums"
              data-testid="hearts-pass-count"
            >
              {selection.count}/3
            </div>
          </div>

          <div className="px-4 py-4">
            <HandFan
              hand={hand}
              isYourTurn
              busy={busy}
              hideTurnIndicator
              sortMode="suit"
              selectionMode="multi"
              selectedKeys={selection.selectedKeys}
              onToggleSelect={selection.toggle}
              testId="hearts-pass-hand"
            />
          </div>

          <div className="px-5 pb-5 flex justify-center">
            <button
              type="button"
              onClick={submit}
              disabled={selection.count !== 3 || busy}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black uppercase tracking-widest text-sm disabled:opacity-40"
              data-testid="hearts-pass-submit"
            >
              <Send className="w-4 h-4" />
              Pass {selection.count}/3 cards
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HeartsPassModal;
