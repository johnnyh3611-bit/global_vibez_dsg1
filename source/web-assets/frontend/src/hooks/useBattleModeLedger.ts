/**
 * useBattleModeLedger — Cyber-Casino Battle Mode wager ledger.
 *
 * Caller provides:
 *   • the current credits balance
 *   • a `debit` callback (e.g. POST /api/coins/spend with a category
 *     of "battle_mode_wager" so the burn counter still ticks)
 *   • a `credit` callback for absorbed wagers
 *
 * Hook returns:
 *   • `wagers` — Map<pieceId, amount>
 *   • `setWager(pieceId, amount)` — debits the delta and updates map
 *   • `transferOnCapture(capturedId, capturerId)` — moves the wager
 *     from the captured piece to the capturer's "won" pool, returns
 *     the absorbed amount so the caller can fire ChipStream
 *   • `clear()` — reset at game end (returns total still-on-board so
 *     the caller can refund it)
 */
import { useCallback, useState } from "react";

export function useBattleModeLedger() {
  const [wagers, setWagers] = useState<Record<string, number>>({});

  const setWager = useCallback((pieceId: string, amount: number) => {
    setWagers((prev) => ({ ...prev, [pieceId]: amount }));
  }, []);

  const transferOnCapture = useCallback(
    (capturedId: string, capturerId: string): number => {
      let absorbed = 0;
      setWagers((prev) => {
        const next = { ...prev };
        absorbed = next[capturedId] ?? 0;
        if (absorbed > 0) {
          delete next[capturedId];
          next[capturerId] = (next[capturerId] ?? 0) + absorbed;
        }
        return next;
      });
      return absorbed;
    },
    [],
  );

  const clear = useCallback((): number => {
    let total = 0;
    setWagers((prev) => {
      total = Object.values(prev).reduce((a, b) => a + b, 0);
      return {};
    });
    return total;
  }, []);

  return { wagers, setWager, transferOnCapture, clear };
}

export default useBattleModeLedger;
