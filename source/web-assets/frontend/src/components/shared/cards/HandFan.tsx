/**
 * HandFan — shared arc hand with Spades deal-in motion + selection modes.
 * SpadesHandFan becomes a thin wrapper around this.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import SpadesCard from "@/components/spades/SpadesCard";
import type { PlayingCard, CardSortMode, SelectionMode } from "./types";
import { calculateHandArcLayout } from "./calculateHandArcLayout";
import { cardKey, groupByMeld, sortHand } from "./sortHand";

export type HandFanProps<T extends PlayingCard & { meld_id?: number; in_meld?: boolean } = PlayingCard> = {
  hand: T[];
  validPlays?: T[];
  isYourTurn?: boolean;
  onPlay?: (card: T) => void;
  busy?: boolean;
  hideTurnIndicator?: boolean;
  /** suit (default) | none | meld (Gin Rummy groups) */
  sortMode?: CardSortMode;
  /** @deprecated use sortMode="none" */
  disableSuitSort?: boolean;
  selectionMode?: SelectionMode;
  selectedKeys?: string[];
  onToggleSelect?: (card: T) => void;
  maxSelect?: number;
  testId?: string;
  showMeldLabels?: boolean;
  meldLabelFor?: (id: number) => string | null;
};

export function HandFan<T extends PlayingCard & { meld_id?: number; in_meld?: boolean }>({
  hand,
  validPlays = [],
  isYourTurn = false,
  onPlay,
  busy = false,
  hideTurnIndicator = false,
  sortMode,
  disableSuitSort = false,
  selectionMode,
  selectedKeys = [],
  onToggleSelect,
  testId = "hand-fan",
  showMeldLabels = false,
  meldLabelFor,
}: HandFanProps<T>) {
  const mode: CardSortMode =
    sortMode ?? (disableSuitSort ? "none" : "suit");

  const [vw, setVw] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const [vh, setVh] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const shortViewport = vh > 0 && vh < 520;
  const handMinHeight = shortViewport ? 72 : 130;
  const handMtClass = shortViewport ? "relative mt-0" : "relative mt-4";

  const validKeys = new Set(validPlays.map(cardKey));
  const selected = new Set(selectedKeys);

  const renderCard = (card: T, i: number, N: number, layoutSize: "sm" | "md", marginLeft: number, angle: number) => {
    const key = cardKey(card);
    const isSel = selected.has(key);
    const selecting = Boolean(selectionMode && onToggleSelect);
    const isPlayable =
      !selecting &&
      isYourTurn &&
      !busy &&
      (validPlays.length === 0 || validKeys.has(key)) &&
      Boolean(onPlay);
    const isDimmed =
      !selecting && isYourTurn && validPlays.length > 0 && !validKeys.has(key);

    const handleClick = () => {
      if (selecting) {
        onToggleSelect?.(card);
        return;
      }
      if (isPlayable) onPlay?.(card);
    };

    return (
      <motion.div
        key={`${key}-${i}`}
        initial={{ y: -120, rotate: angle, opacity: 0 }}
        animate={{
          y: isSel ? -18 : 0,
          rotate: angle,
          opacity: 1,
          scale: isSel ? 1.04 : 1,
        }}
        transition={{
          duration: 0.6,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: 0.08 * Math.min(i, 12),
        }}
        style={{
          marginLeft,
          zIndex: isSel ? 60 : i,
          transformOrigin: "bottom center",
        }}
        className="relative hover:z-50"
      >
        <SpadesCard
          card={card}
          size={layoutSize}
          isPlayable={isPlayable || (selecting && isYourTurn && !busy)}
          isDimmed={isDimmed}
          selected={isSel}
          onClick={
            selecting
              ? isYourTurn && !busy
                ? handleClick
                : undefined
              : isPlayable
                ? handleClick
                : undefined
          }
        />
        {card.in_meld && !isSel ? (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none" />
        ) : null}
      </motion.div>
    );
  };

  if (mode === "meld" && showMeldLabels) {
    const { groups } = groupByMeld(hand);
    return (
      <div className={handMtClass} style={{ minHeight: handMinHeight }} data-testid={testId}>
        {hideTurnIndicator ? null : (
          <div className={`text-center ${shortViewport ? "mb-0.5" : "mb-2"}`}>
            <span
              className={`text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold ${
                isYourTurn ? "text-cyan-300" : "text-purple-300/50"
              }`}
            >
              {isYourTurn ? "● Your move" : "Waiting…"}
            </span>
          </div>
        )}
        <div className="flex flex-wrap justify-center items-end gap-3" data-testid={`${testId}-meld-groups`}>
          {groups.map((g) => {
            const layout = calculateHandArcLayout({
              viewportWidth: Math.min(vw, 320),
              viewportHeight: vh,
              handSize: g.cards.length,
            });
            return (
              <div
                key={g.id}
                className={`flex flex-col items-center gap-1 px-2 pt-1 rounded-lg ${
                  g.id === -1
                    ? "border border-slate-700/50"
                    : "border border-amber-500/40 bg-amber-500/5"
                }`}
                data-testid={`${testId}-meld-group-${g.id}`}
              >
                <div className="flex justify-center items-end relative">
                  {g.cards.map((card, i) => {
                    const slot = layout.slots[i];
                    return renderCard(
                      card,
                      i,
                      layout.N,
                      layout.cardSize,
                      slot.marginLeft,
                      slot.angleDeg,
                    );
                  })}
                </div>
                <span
                  className={`text-[8px] md:text-[9px] uppercase tracking-[0.18em] font-bold ${
                    g.id === -1 ? "text-slate-500" : "text-amber-300"
                  }`}
                >
                  {g.id === -1
                    ? `Deadwood · ${g.cards.length}`
                    : meldLabelFor?.(g.id) ?? `Meld ${g.id + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const displayHand = sortHand(hand, mode === "meld" ? "meld" : mode);
  const layout = calculateHandArcLayout({
    viewportWidth: vw,
    viewportHeight: vh,
    handSize: displayHand.length,
  });

  return (
    <div className={handMtClass} style={{ minHeight: handMinHeight }} data-testid={testId}>
      {hideTurnIndicator ? null : (
        <div className={`text-center ${shortViewport ? "mb-0.5" : "mb-2"}`}>
          <span
            className={`text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold ${
              isYourTurn ? "text-cyan-300" : "text-purple-300/50"
            }`}
            data-testid={
              testId === "spades-hand-fan"
                ? "spades-hand-turn-indicator"
                : `${testId}-turn-indicator`
            }
          >
            {isYourTurn ? "● Your move" : "Waiting…"}
          </span>
        </div>
      )}
      <div className="flex justify-center items-end relative">
        {displayHand.map((card, i) => {
          const slot = layout.slots[i];
          return renderCard(
            card,
            i,
            layout.N,
            layout.cardSize,
            slot.marginLeft,
            slot.angleDeg,
          );
        })}
      </div>
    </div>
  );
}

export default HandFan;
