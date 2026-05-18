/**
 * MatchConsensusChip — anti-cheat verification indicator for tournament
 * bracket cells (2026-05-17).
 *
 * Hits `GET /api/match-consensus/{match_id}` once on mount, then polls
 * every 20s while the match is still in flight. Renders a compact chip:
 *
 *   ⏳ Awaiting   — submissions < required
 *   ✅ Verified   — both teams agreed; 72h airlock running
 *   💰 Cleared    — 72h airlock cleared; payout released
 *   🚨 Disputed   — winner/score mismatch
 *   ⚠️ Hash Check — winner+score match but game_log_hash differs
 *   🛡️ Resolved   — admin manual override
 *
 * Self-hides when the match has no submissions yet (avoids cluttering
 * pre-bracket cells). Zero deps beyond what TournamentDetailsPage
 * already imports.
 */
import { useEffect, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL;

type ConsensusStatus =
  | "VERIFIED_SUCCESS"
  | "DISPUTED_FLAGGED"
  | "HASH_MISMATCH_REVIEW"
  | "RESOLVED_BY_ADMIN";

type ConsensusState = {
  consensus: null | {
    status: ConsensusStatus;
    winner_team_id?: string | null;
  };
  airlock: null | {
    payout_status: "held" | "cleared";
    clears_at: string;
  };
  submissions_received: number;
  submissions_required: number;
};

type ChipSpec = {
  icon: string;
  label: string;
  cls: string;
  testid: string;
};

function deriveChip(s: ConsensusState): ChipSpec | null {
  // No submissions yet → hide.
  if (s.submissions_received === 0 && !s.consensus) return null;

  const status = s.consensus?.status;
  const cleared = s.airlock?.payout_status === "cleared";

  if (status === "VERIFIED_SUCCESS" && cleared) {
    return {
      icon: "💰",
      label: "Cleared",
      cls: "bg-emerald-500/20 border-emerald-400/60 text-emerald-200",
      testid: "match-consensus-chip-cleared",
    };
  }
  if (status === "VERIFIED_SUCCESS") {
    return {
      icon: "✅",
      label: "Verified · 72h",
      cls: "bg-green-500/20 border-green-400/60 text-green-200",
      testid: "match-consensus-chip-verified",
    };
  }
  if (status === "RESOLVED_BY_ADMIN") {
    return {
      icon: "🛡️",
      label: "Admin Resolved",
      cls: "bg-sky-500/20 border-sky-400/60 text-sky-200",
      testid: "match-consensus-chip-resolved",
    };
  }
  if (status === "HASH_MISMATCH_REVIEW") {
    return {
      icon: "⚠️",
      label: "Hash Check",
      cls: "bg-amber-500/20 border-amber-400/60 text-amber-200",
      testid: "match-consensus-chip-hash-mismatch",
    };
  }
  if (status === "DISPUTED_FLAGGED") {
    return {
      icon: "🚨",
      label: "Disputed",
      cls: "bg-rose-500/20 border-rose-400/60 text-rose-200",
      testid: "match-consensus-chip-disputed",
    };
  }
  // Submissions in flight, no final consensus yet.
  return {
    icon: "⏳",
    label: `Awaiting ${s.submissions_received}/${s.submissions_required}`,
    cls: "bg-yellow-500/15 border-yellow-400/40 text-yellow-200",
    testid: "match-consensus-chip-awaiting",
  };
}

export function MatchConsensusChip({ matchId }: { matchId: string }) {
  const [state, setState] = useState<ConsensusState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchState = async () => {
      try {
        const r = await fetch(`${API}/api/match-consensus/${matchId}`);
        if (!r.ok) return;
        const d = (await r.json()) as ConsensusState;
        if (!cancelled) setState(d);
      } catch {
        /* network / 404 — render nothing */
      }
    };
    fetchState();
    // Stop polling once the match is finalized + airlock cleared.
    const interval = setInterval(() => {
      const finalized =
        state?.consensus?.status === "VERIFIED_SUCCESS" &&
        state?.airlock?.payout_status === "cleared";
      if (!finalized) fetchState();
    }, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!state) return null;
  const chip = deriveChip(state);
  if (!chip) return null;

  return (
    <div
      data-testid={chip.testid}
      className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${chip.cls}`}
      title={
        state.airlock?.clears_at
          ? `Airlock clears: ${new Date(state.airlock.clears_at).toLocaleString()}`
          : undefined
      }
    >
      <span aria-hidden>{chip.icon}</span>
      <span>{chip.label}</span>
    </div>
  );
}
