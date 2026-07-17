import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authFetch } from "@/utils/secureAuth";

const API_URL = process.env.REACT_APP_BACKEND_URL;

type AbcOption = { id: string; text: string };
type AbcQuestion = {
  id: string;
  batch: number;
  category: string;
  domain: string;
  question: string;
  emoji?: string;
  options: AbcOption[];
};

type Props = {
  /** Onboarding setup pulls early batches; return visits pull next unanswered. */
  setup?: boolean;
  onComplete?: (result: {
    answered_count: number;
    total_count: number;
    personality_traits?: string[];
    gaming_style?: string;
    relationship_goals?: string;
  }) => void;
  /** Compact card for dashboard / discover banners */
  compact?: boolean;
};

/**
 * Tap-only A/B/C progressive profile questions.
 * No free typing — answers feed dating + gaming match signals.
 */
export default function ProgressiveAbcQuiz({
  setup = false,
  onComplete,
  compact = false,
}: Props) {
  const [questions, setQuestions] = useState<AbcQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ answered: 0, total: 0, pct: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `${API_URL}/api/dating/profile/abc/next?setup=${setup ? "true" : "false"}`
      );
      if (!res.ok) {
        setError("Could not load questions");
        return;
      }
      const data = await res.json();
      setProgress({
        answered: data.answered_count || 0,
        total: data.total_count || 0,
        pct: data.progress_pct || 0,
      });
      if (data.complete || !data.questions?.length) {
        setDone(true);
        setQuestions([]);
        onCompleteRef.current?.({
          answered_count: data.answered_count || 0,
          total_count: data.total_count || 0,
        });
      } else {
        setDone(false);
        setQuestions(data.questions);
        setIndex(0);
        setPicks({});
      }
    } catch {
      setError("Could not load questions");
    } finally {
      setLoading(false);
    }
  }, [setup]);

  useEffect(() => {
    load();
  }, [load]);

  const submitBatch = async (finalPicks: Record<string, string>) => {
    setSaving(true);
    setError(null);
    try {
      const answers = Object.entries(finalPicks).map(([question_id, option_id]) => ({
        question_id,
        option_id,
      }));
      const res = await authFetch(`${API_URL}/api/dating/profile/abc/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        setError("Failed to save answers");
        return;
      }
      const data = await res.json();
      setProgress({
        answered: data.answered_count || 0,
        total: data.total_count || 0,
        pct: data.progress_pct || 0,
      });
      onComplete?.({
        answered_count: data.answered_count || 0,
        total_count: data.total_count || 0,
        personality_traits: data.personality_traits,
        gaming_style: data.gaming_style,
        relationship_goals: data.relationship_goals,
      });
      // Load next batch if any remain (return visits)
      if (!setup) {
        await load();
      } else {
        setDone(true);
        setQuestions([]);
      }
    } catch {
      setError("Failed to save answers");
    } finally {
      setSaving(false);
    }
  };

  const choose = (optionId: string) => {
    const q = questions[index];
    if (!q || saving) return;
    const nextPicks = { ...picks, [q.id]: optionId };
    setPicks(nextPicks);
    if (index < questions.length - 1) {
      setIndex(index + 1);
    } else {
      submitBatch(nextPicks);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-10 h-10 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (done && !questions.length) {
    return (
      <div
        className={
          compact
            ? "rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-sm text-emerald-100"
            : "text-center py-6 text-white/70"
        }
      >
        Profile vibe check complete ({progress.answered}/{progress.total}).
        Thanks — matching just got smarter.
      </div>
    );
  }

  const q = questions[index];
  if (!q) return null;

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-fuchsia-500/30 bg-black/50 p-4"
          : "space-y-4"
      }
      data-testid="progressive-abc-quiz"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-mono uppercase tracking-widest text-fuchsia-300/80">
          A · B · C — tap only
        </p>
        <p className="text-xs text-white/50">
          {progress.pct}% profile · Q{index + 1}/{questions.length}
        </p>
      </div>

      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
          style={{
            width: `${((index + Object.keys(picks).length ? index + 1 : 0) / Math.max(questions.length, 1)) * 100}%`,
          }}
        />
      </div>

      <motion.div
        key={q.id}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4"
      >
        <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
          <span className="mr-2">{q.emoji || "✨"}</span>
          {q.question}
        </h3>

        <div className="space-y-3">
          {q.options.map((opt) => (
            <motion.button
              key={opt.id}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving}
              onClick={() => choose(opt.id)}
              className="w-full text-left px-4 py-4 rounded-xl border-2 border-white/15 bg-white/5 hover:border-fuchsia-400 hover:bg-fuchsia-500/20 text-white font-semibold transition-all disabled:opacity-60"
              data-testid={`abc-option-${opt.id}`}
            >
              <span className="inline-flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-fuchsia-600/80 text-sm font-black uppercase">
                {opt.id}
              </span>
              {opt.text}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      {saving && (
        <p className="text-white/50 text-sm flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
          Saving…
        </p>
      )}
    </div>
  );
}
