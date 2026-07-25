/**
 * usePlaySequence — Spades/Bid Whist/Hearts trick staging timings.
 * Stages each play_sequence event so cards land one-by-one, then holds
 * completed tricks before clearing.
 */
import { useCallback, useRef, useState } from "react";

export type PlaySeqEvent<TCard = { suit: string; rank: string }> = {
  player: string;
  card: TCard;
  trick_winner?: string | null;
  trick_complete?: boolean;
};

export type UsePlaySequenceOpts = {
  stagingMs?: number;
  trickHoldMs?: number;
  firstCardMs?: number;
};

export function usePlaySequence(opts: UsePlaySequenceOpts = {}) {
  const stagingMs = opts.stagingMs ?? 850;
  const trickHoldMs = opts.trickHoldMs ?? 1200;
  const firstCardMs = opts.firstCardMs ?? 200;
  const [busy, setBusy] = useState(false);
  const genRef = useRef(0);

  const run = useCallback(
    async <TCard, TTrick extends { player: string; card: TCard }>(
      seq: PlaySeqEvent<TCard>[],
      apply: (patch: {
        current_trick: TTrick[];
        trickCleared?: boolean;
        event: PlaySeqEvent<TCard>;
        index: number;
      }) => void,
      seedTrick: TTrick[] = [],
    ): Promise<void> => {
      if (!seq.length) return;
      const gen = ++genRef.current;
      setBusy(true);
      let staged: TTrick[] = [...seedTrick];
      try {
        for (let i = 0; i < seq.length; i++) {
          if (gen !== genRef.current) return;
          const ev = seq[i];
          staged = [...staged, { player: ev.player, card: ev.card } as TTrick];
          await new Promise<void>((r) =>
            setTimeout(r, i === 0 ? firstCardMs : stagingMs),
          );
          if (gen !== genRef.current) return;
          apply({ current_trick: staged, event: ev, index: i });
          if (ev.trick_complete) {
            await new Promise<void>((r) => setTimeout(r, trickHoldMs));
            if (gen !== genRef.current) return;
            staged = [];
            apply({
              current_trick: [],
              trickCleared: true,
              event: ev,
              index: i,
            });
          }
        }
      } finally {
        if (gen === genRef.current) setBusy(false);
      }
    },
    [firstCardMs, stagingMs, trickHoldMs],
  );

  const cancel = useCallback(() => {
    genRef.current += 1;
    setBusy(false);
  }, []);

  return { run, busy, cancel };
}

export default usePlaySequence;
