/**
 * VoiceCoachButton — Cyber-Casino Voice Coach UI surface
 * (Revolutionary Games Blueprint v1, May 2026).
 *
 * Two modes:
 *   • Auto move-tip — caller fires `coach.refreshTip(fen, lastMove)`
 *     after each move; this component renders the latest tip in a
 *     dismissible bubble.
 *   • Voice question — press-and-hold the mic to record (MediaRecorder
 *     API), release to upload to /api/voice-coach/voice-question, then
 *     show the transcribed question + Claude's answer.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, MessageCircle, Sparkles, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Props {
  /** Current FEN, used both for move-tips and voice questions. */
  fen: string;
  /** Last move in SAN (e.g. "e4", "Nxf6+"). When this changes we
   *  auto-fetch a fresh tip. */
  lastMove?: string | null;
  /** Side to move next. */
  side?: "white" | "black";
  /** Player Elo to calibrate coaching tone. */
  elo?: number;
  /** Disable when game over / between matches. */
  disabled?: boolean;
}

interface VoiceAnswer {
  question: string;
  answer: string;
}

export const VoiceCoachButton: React.FC<Props> = ({
  fen,
  lastMove,
  side = "white",
  elo = 1200,
  disabled = false,
}) => {
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceAnswer, setVoiceAnswer] = useState<VoiceAnswer | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const lastFenRef = useRef<string>("");

  // Auto-fetch a tip whenever a NEW move is played. Stateless
  // server-side so we just hit the endpoint each time.
  useEffect(() => {
    if (disabled || !lastMove || !fen) return;
    if (fen === lastFenRef.current) return;
    lastFenRef.current = fen;

    let cancelled = false;
    (async () => {
      setTipLoading(true);
      try {
        const res = await fetch(`${API}/api/voice-coach/move-tip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fen, last_move: lastMove, side, elo }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setTip(data.tip || null);
      } catch {
        if (!cancelled) setTip(null);
      } finally {
        if (!cancelled) setTipLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fen, lastMove, side, elo, disabled]);

  // ── Voice question — press to record, release to upload ──
  const startRecording = async () => {
    setVoiceError(null);
    setVoiceAnswer(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        stream.getTracks().forEach((t) => t.stop());
        await uploadAudio(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setVoiceError("Microphone unavailable. Check your browser permissions.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const uploadAudio = async (blob: Blob) => {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice-question.webm");
      fd.append("fen", fen);
      fd.append("side", side);
      const res = await fetch(`${API}/api/voice-coach/voice-question`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `status ${res.status}`);
      }
      const data: VoiceAnswer = await res.json();
      setVoiceAnswer(data);
    } catch (e: any) {
      setVoiceError(e?.message || "Coach unavailable");
    }
  };

  if (disabled) return null;

  return (
    <>
      {/* Floating button — small, anchored bottom-left of game area */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="voice-coach-trigger"
        title="Open Voice Coach"
        className="fixed bottom-4 left-4 z-[120] flex items-center gap-2 px-3 py-2 rounded-full border border-cyan-400/50 bg-slate-950/90 backdrop-blur text-cyan-200 hover:bg-slate-900 hover:border-cyan-300 transition shadow-lg shadow-cyan-500/20"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-[11px] uppercase tracking-[0.2em] font-mono">
          Coach
        </span>
        {tipLoading && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => {
              if (!recording) setOpen(false);
            }}
            data-testid="voice-coach-panel"
          >
            <motion.div
              initial={{ y: 40, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl p-6 text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgba(40, 50, 90, 0.95) 0%, rgba(15, 20, 40, 0.98) 100%)",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                boxShadow:
                  "0 0 60px rgba(34, 211, 238, 0.35), inset 0 0 24px rgba(34, 211, 238, 0.18)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-300">
                    Cyber-Casino · Voice Coach
                  </p>
                  <h3 className="text-2xl font-black mt-0.5">
                    Sharp eyes on the board.
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Latest move tip */}
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-wider text-slate-300 font-bold mb-1">
                  Last move tip
                </p>
                <div className="rounded-xl bg-black/40 border border-cyan-500/20 px-4 py-3 min-h-[68px] text-sm leading-relaxed">
                  {tipLoading
                    ? "Coach is reading the board…"
                    : tip || "Make a move to get a coach tip."}
                </div>
              </div>

              {/* Voice question */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-300 font-bold mb-2">
                  Ask the coach (hold to talk)
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onPointerDown={startRecording}
                    onPointerUp={stopRecording}
                    onPointerLeave={() => recording && stopRecording()}
                    data-testid="voice-coach-mic-btn"
                    className={`flex items-center justify-center w-14 h-14 rounded-full transition shadow-lg ${
                      recording
                        ? "bg-rose-500 animate-pulse shadow-rose-500/40"
                        : "bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/30"
                    }`}
                  >
                    {recording ? (
                      <MicOff className="w-6 h-6 text-white" />
                    ) : (
                      <Mic className="w-6 h-6 text-black" />
                    )}
                  </button>
                  <div className="flex-1 text-[12px] text-slate-300 leading-tight">
                    {recording
                      ? "Recording… release when done."
                      : voiceAnswer
                        ? null
                        : "Press and hold. Ask anything about the position."}
                  </div>
                </div>

                {voiceAnswer && (
                  <div
                    className="mt-3 rounded-xl bg-black/40 border border-fuchsia-500/30 p-3 text-sm"
                    data-testid="voice-coach-answer"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-fuchsia-300 font-mono mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> You asked
                    </p>
                    <p className="italic text-slate-200 mb-2">
                      "{voiceAnswer.question}"
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-mono mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Coach
                    </p>
                    <p className="text-white">{voiceAnswer.answer}</p>
                  </div>
                )}

                {voiceError && (
                  <div
                    className="mt-3 text-xs text-rose-300"
                    data-testid="voice-coach-error"
                  >
                    {voiceError}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceCoachButton;
