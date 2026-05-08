/**
 * HeartsPassModal — 3-card pass selector for the Hearts AAA prototype.
 * Reuses the SpadesAAA visual language: glassy slate panel, Cinzel headers,
 * crimson accent. Up to 3 cards can be selected; submit is gated until
 * exactly 3 are picked.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import type { SpadesCard as CardData } from "@/components/spades/types";

interface Props {
  open: boolean;
  hand: CardData[];
  passDirection: "left" | "right" | "across" | "none";
  busy: boolean;
  onSubmit: (cards: CardData[]) => void;
}

// Inks darkened Feb 2026 (round 2): the previous slate-100 / rose-400
// pairing was light-on-white inside the pass modal — testers reported
// they "couldn't see the imprints" on club/spade cards. Dropped to
// slate-900 / rose-700 for unmistakable contrast on the white face.
const SUIT_LABELS: Record<string, { glyph: string; color: string }> = {
  spades:   { glyph: "♠", color: "text-slate-900" },
  clubs:    { glyph: "♣", color: "text-slate-900" },
  hearts:   { glyph: "♥", color: "text-rose-700" },
  diamonds: { glyph: "♦", color: "text-rose-700" },
};

const DIRECTION_LABEL: Record<Props["passDirection"], string> = {
  left:   "Pass 3 cards LEFT",
  right:  "Pass 3 cards RIGHT",
  across: "Pass 3 cards ACROSS",
  none:   "No pass this hand",
};

function cardKey(c: CardData): string {
  return `${c.suit}-${c.rank}`;
}

export const HeartsPassModal: React.FC<Props> = ({
  open,
  hand,
  passDirection,
  busy,
  onSubmit,
}) => {
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  if (passDirection === "none" || !open) return null;

  const toggle = (c: CardData) => {
    const k = cardKey(c);
    setPicked((cur) => {
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= 3) return cur;
      return [...cur, k];
    });
  };

  const submit = () => {
    if (picked.length !== 3 || busy) return;
    const selected = picked
      .map((k) => hand.find((c) => cardKey(c) === k))
      .filter(Boolean) as CardData[];
    onSubmit(selected);
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
              className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/40 text-xs font-black tabular-nums"
              data-testid="hearts-pass-counter"
            >
              <span className="text-rose-200">{picked.length}</span>
              <span className="text-rose-300/60">/3</span>
            </div>
          </div>

          <div className="p-4">
            <p className="text-rose-100/70 text-xs mb-3">
              Tap 3 cards to send. Aim to dump high spades, the queen, or risky hearts.
            </p>
            <div className="grid grid-cols-7 sm:grid-cols-13 gap-1.5 sm:gap-2">
              {hand.map((c) => {
                const k = cardKey(c);
                const selected = picked.includes(k);
                const meta = SUIT_LABELS[c.suit];
                return (
                  <button
                    key={k}
                    onClick={() => toggle(c)}
                    disabled={busy}
                    className={`relative h-20 sm:h-24 rounded-md border-2 bg-white shadow flex flex-col items-center justify-between p-1 transition transform ${
                      selected
                        ? "border-rose-400 ring-2 ring-rose-300 -translate-y-2 shadow-[0_0_15px_rgba(244,63,94,0.55)]"
                        : "border-slate-300 hover:border-rose-300 hover:-translate-y-1"
                    }`}
                    data-testid={`hearts-pass-card-${k}`}
                  >
                    <span className={`text-sm font-black leading-none ${meta.color}`}>
                      {c.rank}
                    </span>
                    <span className={`text-3xl font-black ${meta.color}`}>{meta.glyph}</span>
                    <span className={`text-sm font-black leading-none rotate-180 ${meta.color}`}>
                      {c.rank}
                    </span>
                    {selected ? (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              onClick={submit}
              disabled={busy || picked.length !== 3}
              className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-rose-500 hover:from-rose-400 hover:to-rose-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(244,63,94,0.45)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: "'Cinzel', serif" }}
              data-testid="hearts-pass-submit-btn"
            >
              <Send className="w-4 h-4" />
              {busy ? "Sending…" : `Send ${picked.length}/3`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HeartsPassModal;
