/**
 * TournamentBanner — small fixed header shown when a card game page is
 * running in tournament mode. Surfaces the round context and a return link.
 */
import React from "react";
import { Trophy, ArrowLeft, Check, Loader2 } from "lucide-react";
import type { TournamentModeApi } from "@/hooks/useTournamentMode";

export const TournamentBanner: React.FC<TournamentModeApi> = ({
  tournamentId,
  round,
  scoring,
  submitted,
  submitting,
  error,
  returnToRunner,
}) => {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] bg-gradient-to-r from-fuchsia-900/90 to-purple-900/90 backdrop-blur-md border-b border-fuchsia-500/30 px-4 py-2 flex items-center gap-4 text-sm text-white"
      data-testid="tournament-banner"
    >
      <Trophy className="w-4 h-4 text-fuchsia-300 shrink-0" />
      <span className="font-mono text-xs uppercase tracking-widest text-fuchsia-200">
        Tournament · Round {round}
      </span>
      <span className="text-xs text-neutral-300 hidden sm:inline">({scoring})</span>

      <div className="flex-1" />

      {submitting && (
        <span className="flex items-center gap-2 text-amber-300" data-testid="tournament-banner-submitting">
          <Loader2 className="w-4 h-4 animate-spin" /> Submitting score...
        </span>
      )}
      {submitted && (
        <span className="flex items-center gap-2 text-emerald-300" data-testid="tournament-banner-submitted">
          <Check className="w-4 h-4" /> Score submitted · returning to runner
        </span>
      )}
      {error && (
        <span className="text-rose-300 text-xs" data-testid="tournament-banner-error">
          {error}
        </span>
      )}

      <button
        onClick={returnToRunner}
        className="ml-2 flex items-center gap-1 px-3 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-xs font-bold uppercase tracking-wide"
        data-testid="tournament-banner-back-btn"
        disabled={!tournamentId}
      >
        <ArrowLeft className="w-3 h-3" /> Runner
      </button>
    </div>
  );
};

export default TournamentBanner;
