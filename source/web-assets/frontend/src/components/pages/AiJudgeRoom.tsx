/**
 * AI Judge Room — GameRoomLayout standard + Three.js Digital Bench.
 *
 * Split testimony (A | B), bottom-arc GUILTY / INNOCENT vote HUD with
 * VibeCredit stake slider (Blackjack-style bet selector).
 *
 * Layout: inherits VibezShell from ProtectedRoute — main
 * event (Digital Bench) stays centered.
 *
 * Route: /network/judge
 */
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Text } from "@react-three/drei";
import { useNavigate, useSearchParams } from "react-router-dom";
import GameRoomLayout from "@/components/games/GameRoomLayout";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const STAKE_CHIPS = [25, 100, 250, 500, 1000, 2500];

type CasePublic = {
  case_id: string;
  user_a_id: string;
  user_b_id: string;
  story_a: string;
  story_b: string;
  entry_fee_credits: number;
  escrow_credits: number;
  stake_pool_credits: number;
  status: string;
  majority_verdict?: string | null;
  verdict_speech?: string | null;
  guilty_votes?: number;
  innocent_votes?: number;
};

function DigitalBenchScene() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 4, 2]} intensity={1.4} color="#22d3ee" />
      <pointLight position={[-3, 2, -2]} intensity={0.6} color="#c084fc" />
      {/* Digital Bench */}
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[2.4, 0.28, 1.1]} />
          <meshStandardMaterial
            color="#0e7490"
            emissive="#0891b2"
            emissiveIntensity={0.55}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, -0.05, -0.35]}>
          <boxGeometry args={[2.2, 0.5, 0.18]} />
          <meshStandardMaterial
            color="#155e75"
            emissive="#22d3ee"
            emissiveIntensity={0.35}
          />
        </mesh>
      </Float>
      {/* Holographic synth-head avatar */}
      <Float speed={2.2} rotationIntensity={0.6} floatIntensity={0.9}>
        <group position={[0, 1.05, 0]}>
          <Sphere args={[0.42, 48, 48]}>
            <MeshDistortMaterial
              color="#67e8f9"
              emissive="#22d3ee"
              emissiveIntensity={0.9}
              roughness={0.15}
              metalness={0.4}
              distort={0.35}
              speed={2.5}
              transparent
              opacity={0.85}
            />
          </Sphere>
          <Sphere args={[0.48, 32, 32]}>
            <meshBasicMaterial color="#a5f3fc" wireframe transparent opacity={0.35} />
          </Sphere>
          <Text
            position={[0, 0.75, 0]}
            fontSize={0.14}
            color="#e0f2fe"
            anchorX="center"
            anchorY="middle"
          >
            AI JUDGE
          </Text>
        </group>
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial
          color="#020617"
          emissive="#083344"
          emissiveIntensity={0.4}
        />
      </mesh>
    </>
  );
}

export default function AiJudgeRoom() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [cases, setCases] = useState<CasePublic[]>([]);
  const [active, setActive] = useState<CasePublic | null>(null);
  const [pendingVerdict, setPendingVerdict] = useState<"GUILTY" | "INNOCENT" | null>(
    null,
  );
  const [stake, setStake] = useState(100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [speech, setSpeech] = useState("");

  const focusId = params.get("case") || "";

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/ai-judge/cases/open?limit=12`);
      if (!r.ok) return;
      const rows: CasePublic[] = await r.json();
      setCases(rows);
      if (focusId) {
        const hit = rows.find((c) => c.case_id === focusId);
        if (hit) setActive(hit);
        else {
          const one = await authFetch(`${API}/api/ai-judge/cases/${focusId}`);
          if (one.ok) setActive(await one.json());
        }
      } else if (rows[0]) {
        setActive(rows[0]);
      }
    } catch {
      /* room still renders empty state */
    }
  };

  useEffect(() => {
    void load();
  }, [focusId]);

  const cast = async () => {
    if (!active || !pendingVerdict) return;
    const uid = getUserId();
    if (!uid) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await authFetch(`${API}/api/ai-judge/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: active.case_id,
          verdict_type: pendingVerdict,
          vibe_credits_staked: stake,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof d.detail === "string" ? d.detail : "Vote failed");
        return;
      }
      setMsg(`Staked ₵${stake.toLocaleString()} on ${pendingVerdict}`);
      setPendingVerdict(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!active) return;
    setBusy(true);
    setErr("");
    try {
      const r = await authFetch(
        `${API}/api/ai-judge/cases/${active.case_id}/execute`,
        { method: "POST" },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof d.detail === "string" ? d.detail : "Execute failed");
        return;
      }
      setSpeech(d.verdict_speech || "");
      setMsg(`Verdict: ${d.majority_verdict}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const table = useMemo(
    () => (
      <div className="w-full max-w-6xl px-2" data-testid="ai-judge-table">
        <div className="h-[220px] sm:h-[280px] rounded-2xl overflow-hidden border border-cyan-400/30 bg-black/50 mb-4 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
          <Canvas camera={{ position: [0, 1.4, 3.2], fov: 42 }}>
            <Suspense fallback={null}>
              <DigitalBenchScene />
            </Suspense>
          </Canvas>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div
            className="rounded-xl border border-rose-400/35 bg-rose-950/30 p-4 min-h-[140px]"
            data-testid="ai-judge-story-a"
          >
            <p className="text-[10px] uppercase tracking-widest text-rose-300 mb-2">
              User A testimony
            </p>
            <p className="text-sm text-white/85 whitespace-pre-wrap">
              {active?.story_a || "Awaiting case… Select an open dispute below."}
            </p>
            {active && (
              <p className="text-[11px] text-white/40 mt-3 font-mono">
                {active.user_a_id}
              </p>
            )}
          </div>
          <div
            className="rounded-xl border border-cyan-400/35 bg-cyan-950/30 p-4 min-h-[140px]"
            data-testid="ai-judge-story-b"
          >
            <p className="text-[10px] uppercase tracking-widest text-cyan-300 mb-2">
              User B testimony
            </p>
            <p className="text-sm text-white/85 whitespace-pre-wrap">
              {active?.story_b || "Awaiting case…"}
            </p>
            {active && (
              <p className="text-[11px] text-white/40 mt-3 font-mono">
                {active.user_b_id}
              </p>
            )}
          </div>
        </div>

        {cases.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
            {cases.map((c) => (
              <button
                key={c.case_id}
                type="button"
                onClick={() => setActive(c)}
                className={`shrink-0 text-xs rounded-lg px-3 py-1.5 border ${
                  active?.case_id === c.case_id
                    ? "border-amber-400/70 bg-amber-500/20"
                    : "border-white/15 bg-black/40"
                }`}
              >
                {c.case_id.slice(-8)} · ₵{c.escrow_credits}
              </button>
            ))}
          </div>
        )}

        {(speech || active?.verdict_speech) && (
          <div
            className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50"
            data-testid="ai-judge-speech"
          >
            {speech || active?.verdict_speech}
          </div>
        )}
      </div>
    ),
    [active, cases, speech],
  );

  return (
    <GameRoomLayout
      testId="ai-judge-room"
      title="AI Judge"
      subtitle="Render the Verdict · Earn VibeCredits"
      backTo="/games"
      nativeTable
      hudExtra={
        active ? (
          <span className="text-[11px] text-cyan-200/80 tabular-nums">
            Pool ₵
            {(
              (active.escrow_credits || 0) + (active.stake_pool_credits || 0)
            ).toLocaleString()}{" "}
            · G {active.guilty_votes || 0}/{active.innocent_votes || 0} I
          </span>
        ) : null
      }
      table={table}
      actions={
        <div
          className="w-full max-w-xl bg-black/70 backdrop-blur border border-white/15 rounded-2xl p-4"
          data-testid="ai-judge-verdict-hud"
        >
          <p className="text-center text-[10px] uppercase tracking-[0.25em] text-white/50 mb-3">
            Verdict HUD
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              type="button"
              data-testid="ai-judge-guilty"
              disabled={!active || active.status !== "VOTING" || busy}
              onClick={() => setPendingVerdict("GUILTY")}
              className={`rounded-2xl py-4 font-black text-lg tracking-wide transition shadow-[0_0_30px_rgba(244,63,94,0.35)] ${
                pendingVerdict === "GUILTY"
                  ? "bg-rose-500 text-white scale-[1.03] ring-2 ring-rose-300"
                  : "bg-rose-950/80 text-rose-200 border border-rose-500/50 hover:bg-rose-900/80"
              } disabled:opacity-40`}
            >
              GUILTY
            </button>
            <button
              type="button"
              data-testid="ai-judge-innocent"
              disabled={!active || active.status !== "VOTING" || busy}
              onClick={() => setPendingVerdict("INNOCENT")}
              className={`rounded-2xl py-4 font-black text-lg tracking-wide transition shadow-[0_0_30px_rgba(34,211,238,0.35)] ${
                pendingVerdict === "INNOCENT"
                  ? "bg-cyan-400 text-slate-900 scale-[1.03] ring-2 ring-cyan-100"
                  : "bg-cyan-950/80 text-cyan-100 border border-cyan-400/50 hover:bg-cyan-900/70"
              } disabled:opacity-40`}
            >
              INNOCENT
            </button>
          </div>

          {pendingVerdict && (
            <div
              className="rounded-xl border border-amber-400/40 bg-slate-900/80 p-3 mb-3"
              data-testid="ai-judge-stake-slider"
            >
              <p className="text-center text-xs text-amber-200 mb-2">
                Stake VibeCredits on{" "}
                <span className="font-bold">{pendingVerdict}</span>
              </p>
              <input
                type="range"
                min={10}
                max={5000}
                step={10}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full accent-amber-400 mb-2"
                data-testid="ai-judge-stake-range"
              />
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {STAKE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setStake(chip)}
                    className={`aspect-square rounded-full text-[10px] font-bold ${
                      stake === chip
                        ? "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 scale-105"
                        : "bg-slate-800 text-slate-300"
                    }`}
                    data-testid={`ai-judge-chip-${chip}`}
                  >
                    ₵{chip >= 1000 ? `${chip / 1000}K` : chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={cast}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 text-slate-900 font-bold py-2.5 text-sm disabled:opacity-40"
                data-testid="ai-judge-confirm-stake"
              >
                {busy
                  ? "Locking…"
                  : `Confirm ₵${stake.toLocaleString()} on ${pendingVerdict}`}
              </button>
            </div>
          )}

          {active?.status === "VOTING" && (
            <button
              type="button"
              disabled={busy}
              onClick={execute}
              className="w-full text-xs text-white/50 hover:text-white underline"
              data-testid="ai-judge-execute"
            >
              Render verdict (parties / admin)
            </button>
          )}

          {(msg || err) && (
            <p
              className={`mt-2 text-center text-xs ${
                err ? "text-rose-300" : "text-emerald-200"
              }`}
              role="status"
            >
              {err || msg}
            </p>
          )}
        </div>
      }
    />
  );
}
