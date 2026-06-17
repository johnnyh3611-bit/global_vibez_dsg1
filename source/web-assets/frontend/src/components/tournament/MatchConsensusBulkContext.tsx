/**
 * MatchConsensusBulkContext — a single 20-second poll per tournament
 * bracket that fans out to every <MatchConsensusChip /> cell.
 *
 * Why this exists: a 64-team single-elim bracket has 32 match cells
 * per round. Per-chip polling = 32 simultaneous GET requests every
 * 20s. With this provider, all chips REGISTER their match_id and
 * SHARE one batched `/api/match-consensus/bulk?match_ids=...` poll.
 *
 * Usage:
 *   <MatchConsensusBulkProvider>
 *     <Bracket>
 *       <MatchConsensusChip matchId="m1" />
 *       <MatchConsensusChip matchId="m2" />
 *       ...
 *     </Bracket>
 *   </MatchConsensusBulkProvider>
 *
 * The provider auto-debounces registrations (50ms) so a freshly-mounted
 * bracket of 32 cells fires ONE bulk fetch, not 32.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_INTERVAL_MS = 20_000;
const REGISTER_DEBOUNCE_MS = 50;

export type ConsensusStatus =
  | "VERIFIED_SUCCESS"
  | "DISPUTED_FLAGGED"
  | "HASH_MISMATCH_REVIEW"
  | "RESOLVED_BY_ADMIN";

export type MatchState = {
  match_id: string;
  consensus: null | { status: ConsensusStatus; winner_team_id?: string | null };
  airlock: null | { payout_status: "held" | "cleared"; clears_at: string };
  submissions_received: number;
  submissions_required: number;
};

type Ctx = {
  register: (matchId: string) => () => void;
  states: Record<string, MatchState>;
};

const MatchConsensusBulkContext = createContext<Ctx | null>(null);

export function MatchConsensusBulkProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, MatchState>>({});
  const idsRef = useRef<Map<string, number>>(new Map()); // matchId → refcount
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runBulkFetch = useCallback(async () => {
    const ids = Array.from(idsRef.current.keys());
    if (ids.length === 0) return;
    try {
      const url = `${API}/api/match-consensus/bulk?match_ids=${encodeURIComponent(ids.join(","))}`;
      const r = await fetch(url);
      if (!r.ok) return;
      const data = await r.json();
      const next: Record<string, MatchState> = {};
      for (const row of data.results || []) {
        next[row.match_id] = row;
      }
      setStates((prev) => ({ ...prev, ...next }));
    } catch {
      /* network — keep last-known state */
    }
  }, []);

  // Debounced registration → one fetch even if 32 chips mount together.
  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(runBulkFetch, REGISTER_DEBOUNCE_MS);
  }, [runBulkFetch]);

  const register = useCallback(
    (matchId: string) => {
      const refs = idsRef.current;
      refs.set(matchId, (refs.get(matchId) || 0) + 1);
      scheduleFetch();
      return () => {
        const cur = refs.get(matchId) || 0;
        if (cur <= 1) refs.delete(matchId);
        else refs.set(matchId, cur - 1);
      };
    },
    [scheduleFetch]
  );

  // 20-second polling. Stops if every registered match is finalized +
  // cleared so an idle bracket doesn't keep ticking.
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      const all = Object.values(states);
      const allDone =
        all.length > 0 &&
        all.every(
          (s) =>
            s.consensus?.status === "VERIFIED_SUCCESS" &&
            s.airlock?.payout_status === "cleared"
        );
      if (!allDone) runBulkFetch();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [runBulkFetch, states]);

  const value = useMemo<Ctx>(() => ({ register, states }), [register, states]);
  return (
    <MatchConsensusBulkContext.Provider value={value}>
      {children}
    </MatchConsensusBulkContext.Provider>
  );
}

export function useMatchConsensusBulk(matchId: string): MatchState | null {
  const ctx = useContext(MatchConsensusBulkContext);
  useEffect(() => {
    if (!ctx) return;
    return ctx.register(matchId);
  }, [ctx, matchId]);
  return ctx ? ctx.states[matchId] || null : null;
}
