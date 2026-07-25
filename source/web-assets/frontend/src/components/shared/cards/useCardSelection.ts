/**
 * useCardSelection — identical click feel for trick-takers and meld games.
 * single: replace selection on each click (Spades/Hearts play)
 * multi: toggle up to max (Hearts pass, Bid Whist kitty, Gin discard prep)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { cardKey } from "./sortHand";
import type { SelectionMode } from "./types";

export type UseCardSelectionOpts<T extends { suit: string; rank: string }> = {
  mode: SelectionMode;
  max?: number;
  cards: T[];
  keyFn?: (c: T) => string;
  enabled?: boolean;
};

export function useCardSelection<T extends { suit: string; rank: string }>({
  mode,
  max = mode === "single" ? 1 : Number.POSITIVE_INFINITY,
  cards,
  keyFn = cardKey,
  enabled = true,
}: UseCardSelectionOpts<T>) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const validKeys = useMemo(
    () => new Set(cards.map((c) => keyFn(c))),
    [cards, keyFn],
  );

  // Drop keys that left the hand.
  useEffect(() => {
    setSelectedKeys((prev) => prev.filter((k) => validKeys.has(k)));
  }, [validKeys]);

  const selected = useMemo(
    () => cards.filter((c) => selectedKeys.includes(keyFn(c))),
    [cards, selectedKeys, keyFn],
  );

  const isSelected = useCallback(
    (c: T) => selectedKeys.includes(keyFn(c)),
    [selectedKeys, keyFn],
  );

  const clear = useCallback(() => setSelectedKeys([]), []);

  const select = useCallback(
    (c: T) => {
      if (!enabled) return;
      const k = keyFn(c);
      if (mode === "single") {
        setSelectedKeys([k]);
        return;
      }
      setSelectedKeys((prev) => {
        if (prev.includes(k)) return prev;
        if (prev.length >= max) return prev;
        return [...prev, k];
      });
    },
    [enabled, keyFn, mode, max],
  );

  const toggle = useCallback(
    (c: T) => {
      if (!enabled) return;
      const k = keyFn(c);
      if (mode === "single") {
        setSelectedKeys((prev) => (prev[0] === k ? [] : [k]));
        return;
      }
      setSelectedKeys((prev) => {
        if (prev.includes(k)) return prev.filter((x) => x !== k);
        if (prev.length >= max) return prev;
        return [...prev, k];
      });
    },
    [enabled, keyFn, mode, max],
  );

  return {
    selected,
    selectedKeys,
    isSelected,
    toggle,
    select,
    clear,
    atMax: selectedKeys.length >= max,
    count: selectedKeys.length,
  };
}

export default useCardSelection;
