/**
 * VoiceMirrorDock — floating, app-wide Voice Mirror widget.
 *
 * Sits in the bottom-right corner (above FreshDropsLauncher which is on the
 * left). Users can:
 *   1. Toggle Voice Mirror on/off from a collapsed mic pill
 *   2. Pick their target (translated-to) language
 *   3. Hold-to-talk → transcribe + translate via
 *      POST /api/voice-mirror/transcribe-and-translate
 *   4. See the latest transcript + translation
 *   5. Send the translated text into the currently-active chat surface
 *      (any component that used `useVoiceMirrorTarget`)
 *
 * The dock hides itself entirely on auth/landing routes where there's no
 * conversation happening.
 */
import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import {
  Mic,
  MicOff,
  Loader2,
  Languages,
  Send,
  X,
  Volume2,
  Sparkles,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import {
  useVoiceMirror,
  VOICE_MIRROR_LANGUAGES,
} from "@/contexts/VoiceMirrorContext";

const API = process.env.REACT_APP_BACKEND_URL;

// Routes where the dock should NOT show (pre-auth / onboarding / landing).
// Hide only on exact public routes; show on every other authed route.
const HIDDEN_PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth-callback",
]);

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToDataUrl = (b64: string, mime = "audio/mpeg"): string =>
  `data:${mime};base64,${b64}`;

export const VoiceMirrorDock: React.FC = () => {
  const location = useLocation();
  const {
    enabled,
    setEnabled,
    targetLang,
    setTargetLang,
    autoTranslateIncoming,
    setAutoTranslateIncoming,
    activeTarget,
    lastResult,
    pushResult,
  } = useVoiceMirror();

  const [open, setOpen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"iframe" | "permission" | "generic" | null>(null);
  const [sentFeedback, setSentFeedback] = useState(false);

  // Detect whether we're running inside an iframe that likely blocks
  // getUserMedia (the Emergent editor preview panel is the common case).
  // We can't reliably check the parent's `allow="microphone"` attribute
  // from inside (cross-origin), so we flag the iframe case up-front and
  // resolve the exact error after the first mic attempt.
  const inIframe =
    typeof window !== "undefined" && window.self !== window.top;

  const openInNewTabHref =
    typeof window !== "undefined" ? window.location.href : "#";

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const hidden = HIDDEN_PUBLIC_ROUTES.has(location.pathname);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const processClip = useCallback(
    async (blob: Blob) => {
      setProcessing(true);
      setError(null);
      try {
        const buf = await blob.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        const userId =
          (typeof window !== "undefined" &&
            localStorage.getItem("user_id")) ||
          "voice_mirror_user";
        const res = await fetch(
          `${API}/api/voice-mirror/transcribe-and-translate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_base64: b64,
              target_lang: targetLang,
              user_id: userId,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Transcription failed");
        if (!data.original && !data.translated) {
          setError("No speech detected");
          return;
        }
        pushResult({
          original: data.original || "",
          translated: data.translated || "",
          sourceLang: (data.source_lang || "").toUpperCase(),
          targetLang: data.target_lang || targetLang,
          audioBase64: data.audio_base64,
        });
        // Auto-play the user their own translated voice so they can confirm.
        if (data.audio_base64) {
          const audio = new Audio(base64ToDataUrl(data.audio_base64));
          audio.play().catch(() => {/* autoplay blocked */});
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProcessing(false);
      }
    },
    [targetLang, pushResult]
  );

  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setErrorKind(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("This browser doesn't support mic recording");
      setErrorKind("generic");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick the first MIME type the browser actually supports —
      // Safari/iOS don't do audio/webm, they need audio/mp4.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "",
      ];
      const picked = candidates.find(
        (c) => c === "" || (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c))
      );
      const mr = picked
        ? new MediaRecorder(stream, picked ? { mimeType: picked } : undefined)
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const mime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > 400) {
          processClip(blob);
        } else {
          setError("Clip too short — tap the mic, speak for a sec, then tap again to stop.");
          setErrorKind("generic");
        }
        stopStream();
      };
      // Request a chunk every 250ms so we always have data even on very
      // short recordings.
      mr.start(250);
      setRecording(true);
      setRecordingElapsed(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(
        () => setRecordingElapsed((e) => e + 1),
        1000
      );
    } catch (e) {
      const err = e as DOMException & { message?: string };
      const msg = err?.message || "";
      const name = err?.name || "";
      // NotAllowedError can mean:
      //   (a) browser-level deny (user clicked block)
      //   (b) iframe sandbox / permissions-policy deny (Emergent editor)
      // In iframe context we strongly suspect (b) and show a "Open in
      // new tab" CTA instead of the browser-settings instructions.
      if (name === "NotAllowedError" || /Permission|NotAllowed/i.test(msg)) {
        if (inIframe) {
          setError("Voice Mirror needs mic access, which is blocked inside the Emergent preview panel.");
          setErrorKind("iframe");
        } else {
          setError("Mic blocked — click the 🎙 icon in your browser's address bar, allow mic access, then try again.");
          setErrorKind("permission");
        }
      } else if (name === "NotFoundError" || /NotFound|Requested device/i.test(msg)) {
        setError("No microphone detected on this device.");
        setErrorKind("generic");
      } else {
        setError(`Mic error: ${msg || name || "unknown"}`);
        setErrorKind("generic");
      }
    }
  }, [processClip, stopStream, inIframe]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  // Clean up elapsed timer on unmount.
  React.useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // CommHub bridge (UDA §4) — open this dock when the top-nav
  // CommHub dropdown asks. Lets the floating dock stay invisible by
  // default while still reachable through the unified hub button.
  React.useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener("commhub:voice-mirror-toggle", onToggle);
    return () => window.removeEventListener("commhub:voice-mirror-toggle", onToggle);
  }, []);

  const sendToChat = useCallback(() => {
    if (!lastResult || !activeTarget) return;
    // Re-trigger the active target's callback with the same result.
    pushResult(lastResult);
    setSentFeedback(true);
    setTimeout(() => setSentFeedback(false), 1500);
  }, [lastResult, activeTarget, pushResult]);

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[120] pointer-events-none"
      data-testid="voice-mirror-dock"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-fuchsia-500/30 bg-slate-950/90 backdrop-blur-xl shadow-[0_0_40px_rgba(168,85,247,0.25)] p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-bold leading-tight">
                    Voice Mirror
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {activeTarget
                      ? `→ ${activeTarget.label}`
                      : "No active chat yet"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                data-testid="voice-mirror-dock-close"
                aria-label="Close Voice Mirror"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language picker */}
            <div className="relative mb-3">
              <button
                onClick={() => setShowLangPicker((s) => !s)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-left text-white text-xs"
                data-testid="voice-mirror-dock-lang-toggle"
              >
                <span className="flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-cyan-300" />
                  Translate to{" "}
                  <span className="font-semibold">
                    {VOICE_MIRROR_LANGUAGES.find((l) => l.code === targetLang)
                      ?.flag}{" "}
                    {VOICE_MIRROR_LANGUAGES.find((l) => l.code === targetLang)
                      ?.label || targetLang}
                  </span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {showLangPicker && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 backdrop-blur-xl p-1 shadow-2xl"
                  data-testid="voice-mirror-dock-lang-list"
                >
                  {VOICE_MIRROR_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setTargetLang(l.code);
                        setShowLangPicker(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-white/10 ${
                        l.code === targetLang
                          ? "text-cyan-300 bg-white/5"
                          : "text-slate-200"
                      }`}
                      data-testid={`voice-mirror-dock-lang-${l.code}`}
                    >
                      {l.flag} {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mic button — click to toggle recording (was hold-to-talk; too
                fragile on touch devices + people released too fast). */}
            <button
              onClick={() => {
                if (processing) return;
                if (recording) stopRecording();
                else startRecording();
              }}
              disabled={processing}
              className={`w-full rounded-xl py-4 text-sm font-bold flex items-center justify-center gap-2 transition ${
                recording
                  ? "bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.55)]"
                  : processing
                  ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white hover:from-fuchsia-400 hover:to-cyan-400"
              }`}
              data-testid="voice-mirror-dock-mic"
              aria-pressed={recording}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Translating…
                </>
              ) : recording ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  Listening… {recordingElapsed > 0 ? `${recordingElapsed}s` : ""} · Tap to stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" /> Tap to speak
                </>
              )}
            </button>
            {recording && (
              <p className="mt-1 text-[10px] text-slate-400 text-center">
                Speak clearly, then tap the red button to translate.
              </p>
            )}

            {error && (
              <div
                className={`mt-2 rounded-lg px-2.5 py-2 text-[11px] ${
                  errorKind === "iframe"
                    ? "bg-amber-500/10 border border-amber-400/40 text-amber-100"
                    : "text-red-300"
                }`}
                data-testid="voice-mirror-dock-error"
              >
                <div>{error}</div>
                {errorKind === "iframe" && (
                  <a
                    href={openInNewTabHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-100 font-bold px-2.5 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    data-testid="voice-mirror-dock-open-new-tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in a new tab to use Voice Mirror
                  </a>
                )}
              </div>
            )}

            {/* Proactive iframe banner — shows BEFORE the user even tries
                the mic, so they know up-front. */}
            {!error && inIframe && (
              <div
                className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200"
                data-testid="voice-mirror-dock-iframe-notice"
              >
                <span className="font-semibold">Heads up:</span>{" "}
                mic access is usually blocked in this preview panel.{" "}
                <a
                  href={openInNewTabHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded"
                  data-testid="voice-mirror-dock-preemptive-new-tab"
                >
                  Open in a new tab
                </a>{" "}
                for the best experience.
              </div>
            )}

            {lastResult && (
              <div
                className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3 text-xs space-y-1.5"
                data-testid="voice-mirror-dock-last"
              >
                <div className="text-slate-400">
                  {lastResult.sourceLang || "??"} → {lastResult.targetLang}
                </div>
                <div className="text-slate-300">{lastResult.original}</div>
                <div className="text-white font-semibold">
                  {lastResult.translated}
                </div>
                {activeTarget && (
                  <button
                    onClick={sendToChat}
                    className="mt-2 w-full rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-[11px] font-semibold py-1.5 flex items-center justify-center gap-1.5"
                    data-testid="voice-mirror-dock-send"
                  >
                    <Send className="w-3 h-3" />
                    {sentFeedback ? "Sent!" : `Send to ${activeTarget.label}`}
                  </button>
                )}
                {lastResult.audioBase64 && (
                  <button
                    onClick={() => {
                      const a = new Audio(base64ToDataUrl(lastResult.audioBase64!));
                      a.play().catch(() => {/* autoplay blocked */});
                    }}
                    className="mt-1 w-full rounded-md bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] py-1.5 flex items-center justify-center gap-1.5"
                    data-testid="voice-mirror-dock-replay"
                  >
                    <Volume2 className="w-3 h-3" />
                    Replay translated audio
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white font-semibold leading-tight">
                  Auto-translate incoming messages
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Show a {targetLang} subtitle under every foreign message
                </div>
              </div>
              <button
                onClick={() =>
                  setAutoTranslateIncoming(!autoTranslateIncoming)
                }
                aria-pressed={autoTranslateIncoming}
                aria-label="Toggle auto-translate incoming messages"
                className={`ml-2 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                  autoTranslateIncoming
                    ? "bg-cyan-500"
                    : "bg-slate-600"
                }`}
                data-testid="voice-mirror-dock-autotranslate-toggle"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    autoTranslateIncoming ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
              <span>Enabled everywhere you chat</span>
              <button
                onClick={() => setEnabled(false)}
                className="hover:text-slate-300 underline"
                data-testid="voice-mirror-dock-disable"
              >
                Turn off
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed pill */}
      {enabled ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-3.5 py-2 text-white text-xs font-bold shadow-[0_0_24px_rgba(168,85,247,0.45)] hover:shadow-[0_0_36px_rgba(168,85,247,0.65)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          data-testid="voice-mirror-dock-toggle"
          aria-label="Open Voice Mirror"
        >
          <Mic className="w-4 h-4" />
          <span className="hidden sm:inline">Voice Mirror</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] leading-none">
            {targetLang}
          </span>
        </button>
      ) : (
        <button
          onClick={() => {
            setEnabled(true);
            setOpen(true);
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:border-fuchsia-400/50 px-3 py-1.5 text-slate-300 hover:text-white text-[11px] shadow-lg backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          data-testid="voice-mirror-dock-enable"
          aria-label="Enable Voice Mirror"
        >
          <MicOff className="w-3 h-3" />
          Enable Voice Mirror
        </button>
      )}
    </div>
  );
};

export default VoiceMirrorDock;
