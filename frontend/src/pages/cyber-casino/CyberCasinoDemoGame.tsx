/**
 * CyberCasinoDemoGame — built-in HTML5 canvas mini-game shown when no
 * Unity WebGL build is deployed at /public/unity-builds/{gameId}/Build/.
 * Lets users tap targets to score, then submit the score into the
 * 72-hour escrow queue so the end-to-end flow is fully testable today.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Crosshair, RotateCcw } from "lucide-react";

type Props = {
  gameId: string;
  onSubmit: (raw: string) => void;
  submitting: boolean;
};

const ROUND_SECONDS = 20;

type Target = { id: number; x: number; y: number; r: number; born: number };

export default function CyberCasinoDemoGame({ gameId, onSubmit, submitting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const targetsRef = useRef<Target[]>([]);
  const nextIdRef = useRef(1);

  const reset = useCallback(() => {
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setDone(false);
    targetsRef.current = [];
  }, []);

  const start = useCallback(() => {
    reset();
    setRunning(true);
  }, [reset]);

  // Game loop
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setRunning(false);
          setDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  // Target spawner + render
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = (now: number) => {
      ctx.fillStyle = "#04060f";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      // grid
      ctx.strokeStyle = "rgba(0,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < cvs.width; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke();
      }
      for (let y = 0; y < cvs.height; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
      }

      // expire old targets, spawn new while running
      const list = targetsRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        if (now - list[i].born > 1500) list.splice(i, 1);
      }
      if (running && list.length < 5 && Math.random() < 0.06) {
        list.push({
          id: nextIdRef.current++,
          x: 30 + Math.random() * (cvs.width - 60),
          y: 30 + Math.random() * (cvs.height - 60),
          r: 18 + Math.random() * 14,
          born: now,
        });
      }

      // draw targets
      list.forEach((t) => {
        const age = (now - t.born) / 1500;
        const alpha = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,${0.85 * alpha})`;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
        ctx.stroke();
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!running) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) * cvs.width) / rect.width;
    const cy = ((e.clientY - rect.top) * cvs.height) / rect.height;
    const list = targetsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      const dx = cx - t.x;
      const dy = cy - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        list.splice(i, 1);
        setScore((s) => s + Math.round(50 + (t.r < 22 ? 50 : 20)));
        return;
      }
    }
  };

  const submit = () => {
    onSubmit(JSON.stringify({
      points: score,
      multiplier: 1,
      metadata: { game: gameId, mode: "demo" },
    }));
  };

  return (
    <div
      className="w-full max-w-3xl flex flex-col items-center gap-3"
      data-testid="cyber-casino-demo-game"
    >
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-cyan-300">
          <Crosshair className="w-4 h-4" /> Score:{" "}
          <span className="font-mono text-lg text-cyan-100">{score}</span>
        </div>
        <div className="text-fuchsia-300">
          Time: <span className="font-mono text-lg">{timeLeft}s</span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          data-testid="cyber-casino-demo-reset"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={720}
        height={400}
        onClick={onClick}
        className="rounded-lg border border-cyan-500/30 cursor-crosshair"
        style={{ width: "100%", maxWidth: 720, aspectRatio: "9 / 5", boxShadow: "0 0 60px rgba(0,255,255,0.15)" }}
        data-testid="cyber-casino-demo-canvas"
      />

      {!running && !done && (
        <button
          onClick={start}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black uppercase tracking-wider text-sm hover:opacity-90"
          data-testid="cyber-casino-demo-start"
        >
          Start Round · 20s
        </button>
      )}

      {done && (
        <button
          onClick={submit}
          disabled={submitting || score === 0}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 text-black font-black uppercase tracking-wider text-sm disabled:opacity-50"
          data-testid="cyber-casino-demo-submit"
        >
          {submitting ? "Submitting…" : `Cash Out ₵${score} into Escrow`}
        </button>
      )}

      <p className="text-[11px] text-slate-500 text-center max-w-md">
        Demo Mode · click neon orbs before they fade. Points convert 1:1 → ₵
        Vibez Coins. Drop a real Unity WebGL build into{" "}
        <code className="text-cyan-400">/public/unity-builds/{gameId}/Build/</code>{" "}
        to replace this with the actual game.
      </p>
    </div>
  );
}
