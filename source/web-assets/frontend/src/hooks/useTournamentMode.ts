/**
 * useTournamentMode — tiny hook each card-game page uses to detect when
 * it is running as part of a Card Royale multi-game tournament.
 *
 * Usage:
 *   const tm = useTournamentMode();
 *   useEffect(() => {
 *     if (tm.active && phase === 'finished' && !tm.submitted) {
 *       tm.submitScore({ bid, tricks, bags });
 *     }
 *   }, [phase, ...]);
 *
 *   {tm.active && <TournamentBanner {...tm} />}
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_URL;

export interface TournamentModeApi {
  active: boolean;
  tournamentId: string | null;
  round: number | null;
  scoring: string | null;
  submitted: boolean;
  submitting: boolean;
  error: string | null;
  submitScore: (raw: Record<string, unknown>) => Promise<void>;
  returnToRunner: () => void;
}

export function useTournamentMode(): TournamentModeApi {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tournamentId = params.get("tournament_id");
  const roundStr = params.get("round");
  const scoring = params.get("scoring");
  const round = roundStr ? parseInt(roundStr, 10) : null;
  const active = Boolean(tournamentId && round && scoring);

  const submitScore = useCallback(
    async (raw: Record<string, unknown>): Promise<void> => {
      if (!active || submitted || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/card-royale/submit-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            tournament_id: tournamentId,
            round_num: round,
            raw_score: raw,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "submit_failed");
        setSubmitted(true);
        // Auto-return to runner after 2.5s so user sees the confirmation
        setTimeout(() => {
          navigate(`/card-royale/${tournamentId}/run`);
        }, 2500);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [active, submitted, submitting, tournamentId, round, navigate]
  );

  const returnToRunner = useCallback((): void => {
    if (tournamentId) navigate(`/card-royale/${tournamentId}/run`);
  }, [tournamentId, navigate]);

  return useMemo(
    () => ({
      active,
      tournamentId,
      round,
      scoring,
      submitted,
      submitting,
      error,
      submitScore,
      returnToRunner,
    }),
    [active, tournamentId, round, scoring, submitted, submitting, error, submitScore, returnToRunner]
  );
}
