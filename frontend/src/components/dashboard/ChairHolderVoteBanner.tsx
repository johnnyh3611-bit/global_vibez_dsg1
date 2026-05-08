/**
 * ChairHolderVoteBanner — dashboard-top banner for chair holders.
 *
 * Pulls /api/chair-holder-votes and renders one compact card per open
 * poll with three cast buttons (yes / no / abstain). Reflects the
 * holder's prior choice if they already voted (they can change it
 * until close).
 *
 * Hidden entirely when:
 *   • User is not authenticated
 *   • User owns zero chairs
 *   • There are no open votes
 *
 * This is the counterpart to the God-Mode ChairHolderVoting composer.
 */
import { useCallback, useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Minus, Vote, Scale } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

type VoteRow = {
  vote_id: string;
  question: string;
  context: string;
  closes_at: string;
  weighted: boolean;
  created_by_handle: string;
  is_announcement?: boolean;
  status?: string;
  tally: {
    yes: number;
    no: number;
    abstain: number;
    holders_voted: number;
  };
  my_choice: string | null;
  eligible: boolean;
};

export default function ChairHolderVoteBanner() {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [eligible, setEligible] = useState<boolean>(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/chair-holder-votes`);
      if (!r.ok) return;
      const j = await r.json();
      setVotes(j.votes || []);
      setEligible(Boolean(j.eligible));
    } catch {
      // silent — banner is optional
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const cast = async (voteId: string, choice: "yes" | "no" | "abstain") => {
    setBusy(voteId);
    try {
      const r = await authFetch(
        `${API}/api/chair-holder-votes/${voteId}/cast`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice }),
        },
      );
      if (r.ok) {
        toast.success(`Vote recorded: ${choice.toUpperCase()}`);
        await load();
      } else {
        toast.error("Could not cast vote");
      }
    } finally {
      setBusy(null);
    }
  };

  // Always render announcements; only filter votes by eligibility.
  // (Server already filters non-eligible holders out of votable polls,
  // so if we have any rows here and at least one is_announcement, show.)
  if (votes.length === 0) return null;

  return (
    <section
      className="my-4 space-y-3"
      data-testid="chair-holder-vote-banner"
    >
      {votes.map((v) => {
        const isAnnouncement = !!v.is_announcement;
        const tweetUrl = isAnnouncement
          ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `🚀 Escape Velocity reached on Global Vibez. My chair earnings just doubled. ${window.location.origin}`,
            )}`
          : null;
        return (
        <div
          key={v.vote_id}
          data-testid={`holder-vote-${v.vote_id}`}
          className={`rounded-2xl border p-5 ${
            isAnnouncement
              ? "border-amber-500/50 bg-gradient-to-br from-amber-950/60 via-rose-900/30 to-fuchsia-950/40"
              : "border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/50 via-black to-cyan-950/40"
          }`}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Vote className="w-4 h-4 text-fuchsia-300" />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">
              {isAnnouncement ? "Founder announcement" : "Chair-holder vote"} from {v.created_by_handle}
            </span>
            {v.weighted && !isAnnouncement && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest flex items-center gap-1">
                <Scale className="w-2.5 h-2.5" /> Weighted
              </span>
            )}
            {isAnnouncement && (
              <span className="rounded-full bg-amber-500/30 text-amber-200 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest">
                🚀 Escape Velocity
              </span>
            )}
          </div>

          <h3 className="text-lg font-black text-white leading-snug">
            {v.question}
          </h3>
          {v.context && (
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
              {v.context}
            </p>
          )}
          {!isAnnouncement && (
            <p className="text-[10px] text-neutral-500 mt-2">
              Closes {new Date(v.closes_at).toLocaleString()} ·{" "}
              {v.tally.holders_voted} voted so far
            </p>
          )}

          {!isAnnouncement && (
            <div className="flex gap-2 mt-4">
              <CastButton
                label="Yes"
                Icon={ThumbsUp}
                active={v.my_choice === "yes"}
                count={v.tally.yes}
                color="emerald"
                disabled={busy === v.vote_id}
                onClick={() => cast(v.vote_id, "yes")}
                testId={`holder-vote-${v.vote_id}-yes`}
              />
              <CastButton
                label="No"
                Icon={ThumbsDown}
                active={v.my_choice === "no"}
                count={v.tally.no}
                color="rose"
                disabled={busy === v.vote_id}
                onClick={() => cast(v.vote_id, "no")}
                testId={`holder-vote-${v.vote_id}-no`}
              />
              <CastButton
                label="Abstain"
                Icon={Minus}
                active={v.my_choice === "abstain"}
                count={v.tally.abstain}
                color="slate"
                disabled={busy === v.vote_id}
                onClick={() => cast(v.vote_id, "abstain")}
                testId={`holder-vote-${v.vote_id}-abstain`}
              />
            </div>
          )}

          {isAnnouncement && tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noreferrer"
              data-testid={`holder-vote-${v.vote_id}-share`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2 text-xs font-black uppercase tracking-widest hover:brightness-95 transition"
            >
              Share on X
            </a>
          )}

          {!isAnnouncement && v.my_choice && (
            <p className="text-[10px] text-fuchsia-300 mt-2">
              ✓ You voted <strong>{v.my_choice.toUpperCase()}</strong>. Change
              anytime before close.
            </p>
          )}
        </div>
        );
      })}
    </section>
  );
}

function CastButton({
  label,
  Icon,
  active,
  count,
  color,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  Icon: typeof ThumbsUp;
  active: boolean;
  count: number;
  color: "emerald" | "rose" | "slate";
  disabled: boolean;
  onClick: () => void;
  testId: string;
}) {
  const tones: Record<typeof color, string> = {
    emerald: active
      ? "border-emerald-400 bg-emerald-500 text-black"
      : "border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-200",
    rose: active
      ? "border-rose-400 bg-rose-500 text-white"
      : "border-rose-500/40 hover:bg-rose-500/10 text-rose-200",
    slate: active
      ? "border-slate-300 bg-slate-200 text-black"
      : "border-slate-600 hover:bg-slate-700/40 text-slate-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-50 transition ${tones[color]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className="text-[10px] opacity-70 ml-1">({count})</span>
    </button>
  );
}
