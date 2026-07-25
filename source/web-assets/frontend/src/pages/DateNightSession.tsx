/**
 * Date Night Session room — progressive warm-up → Build-a-Night / arena → chemistry.
 * Safety chrome (report, end-session) is always visible. ID-gated via dating routes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Flag,
  LogOut,
  Shield,
  Sparkles,
  Loader2,
  MessageCircleHeart,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import DateNightBoardArena from "@/components/dating/DateNightBoardArena";
import ReportUserModal from "@/components/ReportUserModal";
import { io, Socket } from "socket.io-client";

const API = process.env.REACT_APP_BACKEND_URL || "";

type Session = {
  session_id: string;
  match_id: string;
  player_1_id: string;
  player_2_id: string;
  pack_name?: string;
  phases: string[];
  phase_index: number;
  current_phase: string;
  soft_wyr: any[];
  icebreakers: any[];
  build_steps: any[];
  answers: Record<string, Record<string, string>>;
  build_choices: Record<string, Record<string, string>>;
  build_preferences?: any;
  board_game?: string | null;
  board?: any;
  board_turn?: string | null;
  chemistry?: any;
  date_plan?: any;
  status: string;
};

export default function DateNightSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const me = getUserId() || "";
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [chem, setChem] = useState<any>(null);

  const partnerId = useMemo(() => {
    if (!session || !me) return "";
    return me === session.player_1_id ? session.player_2_id : session.player_1_id;
  }, [session, me]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Session unavailable");
      setSession(d);
    } catch (e: any) {
      setError(e?.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  // Socket presence (best-effort)
  useEffect(() => {
    if (!sessionId || !me) return;
    let socket: Socket | null = null;
    try {
      socket = io(API, { path: "/api/socket.io", transports: ["websocket", "polling"] });
      socket.emit("date_night_join", { session_id: sessionId, user_id: me });
      socket.on("date_night_session", (payload: any) => {
        if (payload?.session) setSession(payload.session);
      });
    } catch {
      /* polling covers sync */
    }
    return () => {
      try {
        socket?.emit("date_night_leave", { session_id: sessionId, user_id: me });
        socket?.disconnect();
      } catch {
        /* noop */
      }
    };
  }, [sessionId, me]);

  // Auto-fetch chemistry when phase hits chemistry
  useEffect(() => {
    if (!session || session.current_phase !== "chemistry" || chem) return;
    (async () => {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/chemistry`, {
        method: "POST",
      });
      if (r.ok) {
        const d = await r.json();
        setChem(d);
        // Also hit legacy dating chemistry endpoint for match card sync
        await authFetch(`${API}/api/dating/chemistry/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_type: session.board_game || session.pack_name || "date_night",
            partner_id: partnerId,
            game_data: {
              finished_game: true,
              close_game: true,
              positive_interaction: true,
              good_sportsmanship: true,
            },
          }),
        }).catch(() => null);
      }
    })();
  }, [session, sessionId, chem, partnerId]);

  const answer = async (questionId: string, value: string) => {
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, answer: value }),
      });
      const d = await r.json();
      if (r.ok && d.session) setSession(d.session);
      else setError(d.detail || "Answer failed");
    } finally {
      setBusy(false);
    }
  };

  const buildChoice = async (stepId: string, optionId: string) => {
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/build-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id: stepId, option_id: optionId }),
      });
      const d = await r.json();
      if (r.ok && d.session) setSession(d.session);
      else setError(d.detail || "Choice failed");
    } finally {
      setBusy(false);
    }
  };

  const boardMove = async (move: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/board-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ move }),
      });
      const d = await r.json();
      if (r.ok && d.session) setSession(d.session);
      else setError(typeof d.detail === "string" ? d.detail : "Move failed");
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/advance`, {
      method: "POST",
    });
    const d = await r.json();
    if (r.ok && d.session) setSession(d.session);
  };

  const handoffPlan = async () => {
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/dating-games/session/${sessionId}/plan`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Planner failed");
      if (d.session) setSession(d.session);
      if (d.redirect_to) navigate(d.redirect_to);
    } catch (e: any) {
      setError(e?.message || "Planner handoff failed");
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    await authFetch(`${API}/api/dating-games/session/${sessionId}/end`, { method: "POST" });
    navigate("/dating/matches");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0908] flex items-center justify-center text-amber-100">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0b0908] flex flex-col items-center justify-center text-[#f4ebe0] gap-4 p-6">
        <p>{error || "Session not found"}</p>
        <button
          type="button"
          onClick={() => navigate("/dating/matches")}
          className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-200/30"
        >
          Back to matches
        </button>
      </div>
    );
  }

  const phase = session.current_phase;
  const questions =
    phase === "soft_wyr" ? session.soft_wyr : phase === "icebreaker" ? session.icebreakers : [];

  return (
    <div
      className="min-h-screen bg-[#0b0908] text-[#f4ebe0]"
      data-testid="date-night-session"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, rgba(160,100,40,0.18), transparent 50%), linear-gradient(180deg,#16100c,#0b0908 40%)",
      }}
    >
      {/* Safety chrome */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0908]/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-amber-200/60">Date Night</p>
            <h1 className="text-lg font-medium">{session.pack_name || "Session"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/safety?match=${encodeURIComponent(session.match_id)}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-400/30 bg-cyan-950/40 text-cyan-100 text-xs"
              data-testid="date-night-safety"
            >
              <Shield className="w-3.5 h-3.5" /> Safety
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-400/30 bg-rose-950/40 text-rose-100 text-xs"
              data-testid="date-night-report"
            >
              <Flag className="w-3.5 h-3.5" /> Report
            </button>
            <button
              type="button"
              onClick={endSession}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-white/5 text-white/80 text-xs"
              data-testid="date-night-end"
            >
              <LogOut className="w-3.5 h-3.5" /> End
            </button>
          </div>
        </div>
        <PhaseRail phases={session.phases} current={phase} index={session.phase_index} />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {(phase === "soft_wyr" || phase === "icebreaker") && (
          <WarmUpPanel
            title={phase === "soft_wyr" ? "Soft Would You Rather" : "Icebreakers"}
            questions={questions}
            answers={session.answers}
            me={me}
            busy={busy}
            onAnswer={answer}
          />
        )}

        {phase === "build_a_night" && (
          <BuildANightPanel
            steps={session.build_steps}
            choices={session.build_choices}
            me={me}
            busy={busy}
            onChoose={buildChoice}
          />
        )}

        {phase === "board" && session.board_game && (
          <DateNightBoardArena
            gameType={session.board_game}
            board={session.board || {}}
            myId={me}
            player1Id={session.player_1_id}
            player2Id={session.player_2_id}
            turn={session.board_turn || null}
            onMove={boardMove}
            busy={busy}
          />
        )}

        {phase === "chemistry" && (
          <ChemistryReveal
            chem={chem || session.chemistry}
            onContinue={advance}
            onChat={() => navigate(`/chat/${partnerId}`)}
          />
        )}

        {phase === "planner" && (
          <PlannerHandoff
            prefs={session.build_preferences}
            plan={session.date_plan}
            busy={busy}
            onGenerate={handoffPlan}
            onOpenPlan={() =>
              navigate(
                `/ai-date-planner?match_id=${session.match_id}${
                  session.date_plan?.plan_id ? `&plan_id=${session.date_plan.plan_id}` : ""
                }`,
              )
            }
          />
        )}

        {(phase === "complete" || phase === "ended" || session.status === "completed") && (
          <div className="rounded-3xl border border-amber-200/20 bg-black/30 p-8 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-amber-200 mb-3" />
            <h2 className="text-2xl font-medium mb-2">Date Night complete</h2>
            <p className="text-sm text-[#cbb9a4] mb-6">Chemistry saved to your match.</p>
            <button
              type="button"
              onClick={() => navigate("/dating/matches")}
              className="px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-200/30"
            >
              Back to matches
            </button>
          </div>
        )}
      </main>

      {reportOpen && partnerId && (
        <div className="fixed inset-0 z-50">
          <ReportUserModal
            userId={partnerId}
            userName="Date Night partner"
            onClose={() => setReportOpen(false)}
            onSuccess={async () => {
              await authFetch(`${API}/api/dating-games/session/${sessionId}/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Reported from Date Night session" }),
              }).catch(() => null);
              setReportOpen(false);
              endSession();
            }}
          />
        </div>
      )}
    </div>
  );
}

function PhaseRail({
  phases,
  current,
  index,
}: {
  phases: string[];
  current: string;
  index: number;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto">
      {phases.map((p, i) => (
        <div
          key={p}
          className={`px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase whitespace-nowrap ${
            p === current || i === index
              ? "bg-amber-400/20 text-amber-50 border border-amber-200/30"
              : i < index
                ? "bg-white/10 text-white/50"
                : "bg-white/5 text-white/30"
          }`}
        >
          {p.replace(/_/g, " ")}
        </div>
      ))}
    </div>
  );
}

function WarmUpPanel({ title, questions, answers, me, busy, onAnswer }: any) {
  return (
    <section data-testid="date-night-warmup">
      <h2 className="text-2xl font-medium mb-1">{title}</h2>
      <p className="text-sm text-[#cbb9a4] mb-5">Answer together. Reveals when both pick.</p>
      <div className="space-y-4">
        {questions.map((q: any) => {
          const mine = answers?.[q.id]?.[me];
          const both = answers?.[q.id] && Object.keys(answers[q.id]).length >= 2;
          return (
            <motion.div
              key={q.id}
              layout
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <p className="text-base mb-3">{q.question}</p>
              {q.option_a ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    ["a", q.option_a],
                    ["b", q.option_b],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      disabled={busy || !!mine}
                      onClick={() => onAnswer(q.id, label)}
                      className={`rounded-xl border px-3 py-3 text-sm text-left ${
                        mine === label
                          ? "border-amber-300/50 bg-amber-500/15"
                          : "border-white/10 bg-white/[0.03] hover:border-amber-200/30"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {["Easy yes", "Maybe later", "Hard pass"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={busy || !!mine}
                      onClick={() => onAnswer(q.id, opt)}
                      className={`flex-1 rounded-xl border px-2 py-2 text-xs ${
                        mine === opt
                          ? "border-amber-300/50 bg-amber-500/15"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {mine && !both && (
                <p className="mt-2 text-xs text-amber-100/60">Waiting for your match…</p>
              )}
              {both && (
                <p className="mt-2 text-xs text-emerald-200/80">
                  Both answered
                  {Object.values(answers[q.id]).every(
                    (v, _, arr) => String(v).toLowerCase() === String(arr[0]).toLowerCase(),
                  )
                    ? " — same pick!"
                    : " — different vibes."}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function BuildANightPanel({ steps, choices, me, busy, onChoose }: any) {
  return (
    <section data-testid="date-night-build">
      <h2 className="text-2xl font-medium mb-1">Build-a-Night</h2>
      <p className="text-sm text-[#cbb9a4] mb-5">
        Design the date together. When you both finish, we hand it to the AI planner.
      </p>
      <div className="space-y-5">
        {steps.map((step: any) => {
          const mine = choices?.[step.id]?.[me];
          return (
            <div key={step.id} className="rounded-2xl border border-amber-200/20 bg-[#1a120c]/80 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-amber-100/50 mb-2">
                {step.key}
              </p>
              <p className="text-lg mb-3">{step.prompt}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {step.options.map((opt: any) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy || !!mine}
                    onClick={() => onChoose(step.id, opt.id)}
                    data-testid={`ban-opt-${step.id}-${opt.id}`}
                    className={`rounded-xl border px-3 py-3 text-sm text-left ${
                      mine === opt.id
                        ? "border-amber-300/60 bg-amber-500/20"
                        : "border-white/10 hover:border-amber-200/30 bg-black/20"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChemistryReveal({ chem, onContinue, onChat }: any) {
  const score = chem?.chemistry_score ?? "—";
  return (
    <section
      className="rounded-3xl border border-pink-300/20 bg-gradient-to-b from-[#2a121c] to-[#12080e] p-8 text-center"
      data-testid="date-night-chemistry"
    >
      <MessageCircleHeart className="w-10 h-10 mx-auto text-pink-200 mb-3" />
      <h2 className="text-2xl font-medium mb-1">Chemistry reveal</h2>
      <p className="text-5xl font-semibold text-pink-100 my-4">{score}%</p>
      <ul className="text-sm text-[#e8cfd8] space-y-1 mb-4">
        {(chem?.insights || ["Calculating…"]).map((i: string) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {(chem?.openers || []).length > 0 && (
        <div className="rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-left mb-5">
          <p className="text-[10px] uppercase tracking-widest text-pink-200/60 mb-1">Opener</p>
          {chem.openers[0]}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={onContinue}
          className="px-5 py-3 rounded-xl bg-pink-500/20 border border-pink-200/30"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onChat}
          className="px-5 py-3 rounded-xl bg-white/5 border border-white/15"
        >
          Open chat
        </button>
      </div>
    </section>
  );
}

function PlannerHandoff({ prefs, plan, busy, onGenerate, onOpenPlan }: any) {
  return (
    <section
      className="rounded-3xl border border-amber-200/25 bg-[#1a120c] p-8"
      data-testid="date-night-planner"
    >
      <h2 className="text-2xl font-medium mb-2">Your night, drafted</h2>
      <p className="text-sm text-[#cbb9a4] mb-4">
        Build-a-Night choices feed the AI Date Planner.
      </p>
      {prefs?.consensus && (
        <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
          {Object.entries(prefs.consensus).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="uppercase tracking-widest text-amber-100/40">{k}</p>
              <p className="text-[#f0e6d8] mt-0.5">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
      {plan ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-100/80">Plan ready.</p>
          <button
            type="button"
            onClick={onOpenPlan}
            className="w-full px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-200/30"
          >
            Open AI Date Planner
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="w-full px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-200/30 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate date plan"}
        </button>
      )}
    </section>
  );
}
