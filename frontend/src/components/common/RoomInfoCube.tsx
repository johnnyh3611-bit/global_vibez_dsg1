/**
 * RoomInfoCube — universal "What is this room?" helper.
 *
 * Renders a tiny "i" pill that lives at top-right (just below the
 * landscape toggle). Click opens a modal containing the matching
 * RoomInfo entry for the current pathname. If no entry matches,
 * the cube hides itself.
 *
 * Mounted globally inside App.js so EVERY room — protected or public,
 * fullscreen-game or normal — gets the helper without per-page wiring.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Info, X, Sparkles, Coins, HeartHandshake, Shield, Volume2, VolumeX } from "lucide-react";
import { matchInfo, type RoomInfo } from "@/data/roomInfo";

// Paths where the cube would feel intrusive (login/signup/landing).
const HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * Speak the room's overview using the browser's native Web Speech API.
 * This is FREE, requires no API key, and ships with every modern browser
 * (Chrome, Safari, Edge, Firefox). Falls back silently on unsupported
 * environments. When the Universal LLM Key budget is restored we can
 * swap to OpenAI TTS (Onyx voice) for a richer cadence — the interface
 * here will stay identical.
 */
function speakRoomInfo(info: RoomInfo): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  const lines = [
    `${info.title}. ${info.tagline}`,
    "How it works.",
    ...info.howItWorks,
    ...(info.earn?.length ? ["How you earn.", ...info.earn] : []),
    ...(info.socialHook ? ["Social hook.", info.socialHook] : []),
    ...(info.safety ? ["Fairness and safety.", info.safety] : []),
  ];
  const utter = new SpeechSynthesisUtterance(lines.join(" "));
  utter.rate = 1.05;
  utter.pitch = 1.0;
  utter.volume = 0.95;
  // Prefer an English voice if available.
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((v) => v.lang.startsWith("en") && v.default) ||
                        voices.find((v) => v.lang.startsWith("en"));
  if (englishVoice) utter.voice = englishVoice;
  window.speechSynthesis.speak(utter);
  return utter;
}

export default function RoomInfoCube() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop speech whenever the modal closes or the route changes.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (!open && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [open]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  const info = matchInfo(pathname);
  if (!info) return null;

  const toggleSpeak = () => {
    if (speaking) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeaking(false);
      return;
    }
    const utter = speakRoomInfo(info);
    if (!utter) return;
    utterRef.current = utter;
    setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
  };

  const supportsSpeech = typeof window !== "undefined" && !!window.speechSynthesis;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="room-info-cube-trigger"
        aria-label="What is this room?"
        className="fixed top-16 left-3 z-[55] flex items-center gap-2 rounded-full border-2 border-cyan-400/50 bg-black/80 backdrop-blur-md pl-1.5 pr-3 py-1.5 text-[11px] uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/30 hover:border-cyan-300 hover:text-white transition shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)] group"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/30 border border-cyan-300/60 group-hover:bg-cyan-400 group-hover:text-black transition">
          <Info className="w-3.5 h-3.5" />
        </span>
        <span className="font-black">What is this room?</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4 py-8 overflow-y-auto"
          data-testid="room-info-cube-modal"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0a1218] border border-cyan-500/30 rounded-2xl max-w-lg w-full p-6 relative shadow-[0_0_40px_-10px_rgba(56,189,248,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="room-info-cube-close"
              aria-label="Close info"
              className="absolute top-3 right-3 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Info className="w-5 h-5 text-cyan-300" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400">Room Info</p>
            </div>
            <h2 className="text-2xl font-black text-white mt-1" data-testid="room-info-cube-title">
              {info.title}
            </h2>
            <p className="text-sm text-cyan-100/80 italic mt-1" data-testid="room-info-cube-tagline">
              {info.tagline}
            </p>

            {/* How it works */}
            <section className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-fuchsia-300" />
                <p className="text-[11px] uppercase tracking-widest text-fuchsia-300">How it works</p>
              </div>
              <ul className="space-y-2">
                {info.howItWorks.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/85 leading-snug">
                    <span className="text-fuchsia-300 font-black tabular-nums mt-0.5">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Earn */}
            {info.earn && info.earn.length > 0 && (
              <section className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-amber-300" />
                  <p className="text-[11px] uppercase tracking-widest text-amber-300">How you earn</p>
                </div>
                <ul className="space-y-1.5">
                  {info.earn.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80 leading-snug">
                      <span className="text-amber-300">▸</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Social hook */}
            {info.socialHook && (
              <section className="mt-5 rounded-xl bg-rose-950/40 border border-rose-400/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <HeartHandshake className="w-4 h-4 text-rose-300" />
                  <p className="text-[11px] uppercase tracking-widest text-rose-200">Social hook</p>
                </div>
                <p className="text-sm text-rose-100/90 leading-snug">{info.socialHook}</p>
              </section>
            )}

            {/* Safety */}
            {info.safety && (
              <section className="mt-5 rounded-xl bg-emerald-950/40 border border-emerald-400/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-emerald-300" />
                  <p className="text-[11px] uppercase tracking-widest text-emerald-200">Fairness · safety</p>
                </div>
                <p className="text-sm text-emerald-100/90 leading-snug">{info.safety}</p>
              </section>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="room-info-cube-got-it"
              className="mt-6 w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:opacity-90 text-white font-black uppercase tracking-widest text-xs"
            >
              Got it
            </button>
            {supportsSpeech && (
              <button
                type="button"
                onClick={toggleSpeak}
                data-testid="room-info-cube-speak"
                className={`mt-2 w-full py-2 rounded-lg border text-xs uppercase tracking-widest font-bold transition flex items-center justify-center gap-2 ${
                  speaking
                    ? "bg-rose-500/20 border-rose-400/50 text-rose-100 hover:bg-rose-500/30"
                    : "bg-cyan-500/10 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20"
                }`}
              >
                {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {speaking ? "Stop reading" : "Read this aloud"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
