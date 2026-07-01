/**
 * Voice Mirror — Whisper STT → Claude translate → OpenAI TTS pipeline.
 *
 * Uses MediaRecorder to capture short WebM/Opus clips (~3s) from the user's
 * mic and POSTs them as base64 to /api/voice-mirror/transcribe-and-translate.
 * Plays the returned translated MP3 inline.
 *
 * No extra API keys — everything runs through the Emergent LLM Key.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, Languages, Sparkles, ArrowLeft, History, Trash2, Zap, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES: Array<{ code: string; label: string; flag: string }> = [
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "ES", label: "Spanish", flag: "🇪🇸" },
  { code: "FR", label: "French", flag: "🇫🇷" },
  { code: "DE", label: "German", flag: "🇩🇪" },
  { code: "IT", label: "Italian", flag: "🇮🇹" },
  { code: "PT", label: "Portuguese", flag: "🇵🇹" },
  { code: "JA", label: "Japanese", flag: "🇯🇵" },
  { code: "KO", label: "Korean", flag: "🇰🇷" },
  { code: "ZH", label: "Chinese", flag: "🇨🇳" },
  { code: "AR", label: "Arabic", flag: "🇸🇦" },
  { code: "HI", label: "Hindi", flag: "🇮🇳" },
  { code: "RU", label: "Russian", flag: "🇷🇺" },
];

interface TranscriptRow {
  id: string;
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  audioUrl?: string;
  voice?: string;
  timestamp: number;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToDataUrl = (b64: string, mime = "audio/mpeg"): string => `data:${mime};base64,${b64}`;

const VoiceMirror: React.FC = () => {
  const navigate = useNavigate();
  const [targetLang, setTargetLang] = useState("EN");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"iframe" | "permission" | "generic" | null>(null);
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const inIframe =
    typeof window !== "undefined" && window.self !== window.top;
  const openInNewTabHref =
    typeof window !== "undefined" ? window.location.href : "#";
  const [userId, setUserId] = useState("voice_mirror_user");
  const [continuous, setContinuous] = useState(false);
  const continuousRef = useRef(false);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  // (B) Voice picker
  type VoiceMeta = { id: string; label: string; vibe: string };
  const [voices, setVoices] = useState<VoiceMeta[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);

  // (C) History drawer
  type HistoryRow = {
    entry_id: string;
    original: string;
    translated: string;
    source_lang: string;
    target_lang: string;
    voice: string;
    channel: string;
    created_at: string;
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // (D) Quick-phrase packs
  type PhrasePack = { id: string; label: string; emoji: string; phrases: string[] };
  const [packs, setPacks] = useState<PhrasePack[]>([]);
  const [activePack, setActivePack] = useState<string>("gaming");
  const [speakingPhrase, setSpeakingPhrase] = useState<string | null>(null);

  // Resolve the logged-in user id so each user gets a stable TTS voice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {});
        if (!res.ok) return;
        const me = await res.json();
        const id = me?.user?.user_id || me?.user_id || me?.id;
        if (id && !cancelled) setUserId(String(id));
      } catch {
        /* anonymous — keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the voice catalog (once) + the user's saved preference.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/voice-mirror/voices?user_id=${encodeURIComponent(userId)}`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setVoices(data.voices || []);
        if (data.current) setSelectedVoice(data.current);
      } catch {/* non-fatal */}
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Load the static phrase-pack catalog (once).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/voice-mirror/phrase-packs`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setPacks(data.packs || []);
      } catch {/* non-fatal */}
    })();
    return () => { cancelled = true; };
  }, []);

  const saveVoice = useCallback(async (voiceId: string) => {
    setSelectedVoice(voiceId);
    setSavingVoice(true);
    try {
      await fetch(`${API}/api/voice-mirror/voices/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, voice: voiceId }),
      });
    } catch {/* silent */}
    finally { setSavingVoice(false); }
  }, [userId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API}/api/voice-mirror/history?user_id=${encodeURIComponent(userId)}&limit=100`, {});
      if (r.ok) {
        const data = await r.json();
        setHistoryRows((data.rows || []) as HistoryRow[]);
      }
    } finally { setHistoryLoading(false); }
  }, [userId]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Delete all transcript history? This cannot be undone.")) return;
    try {
      await fetch(`${API}/api/voice-mirror/history?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      setHistoryRows([]);
    } catch {/* silent */}
  }, [userId]);

  const speakPhrase = useCallback(async (text: string) => {
    setSpeakingPhrase(text);
    setError(null);
    try {
      const r = await fetch(`${API}/api/voice-mirror/speak-phrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          text,
          target_lang: targetLang,
          voice: selectedVoice || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Phrase failed");
      const audioUrl = data.audio_base64 ? base64ToDataUrl(data.audio_base64) : undefined;
      const row: TranscriptRow = {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        original: data.original || text,
        translated: data.translated || "",
        sourceLang: "EN",
        targetLang: data.target_lang || targetLang,
        audioUrl,
        voice: data.voice,
        timestamp: Date.now(),
      };
      setRows((prev) => [row, ...prev].slice(0, 20));
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {/* autoplay guard */});
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSpeakingPhrase(null);
    }
  }, [userId, targetLang, selectedVoice]);

  const currentPack = useMemo(() => packs.find((p) => p.id === activePack), [packs, activePack]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const processClip = useCallback(
    async (blob: Blob) => {
      setProcessing(true);
      setError(null);
      try {
        const buf = await blob.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        const res = await fetch(`${API}/api/voice-mirror/transcribe-and-translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_base64: b64,
            target_lang: targetLang,
            user_id: userId,
            voice: selectedVoice || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Transcription failed");
        if (!data.original && !data.translated) {
          setError("No speech detected");
          return;
        }
        const audioUrl = data.audio_base64 ? base64ToDataUrl(data.audio_base64) : undefined;
        const row: TranscriptRow = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          original: data.original || "",
          translated: data.translated || "",
          sourceLang: (data.source_lang || "").toUpperCase(),
          targetLang: data.target_lang || targetLang,
          audioUrl,
          voice: data.voice,
          timestamp: Date.now(),
        };
        setRows((prev) => [row, ...prev].slice(0, 20));
        // Auto-play the translated audio
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.play().catch(() => {
            /* autoplay may be blocked — user can click the play button */
          });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProcessing(false);
      }
    },
    [targetLang, userId, selectedVoice]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("This browser doesn't support mic recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // Pick the first MIME type this browser actually supports.
      // Safari/iOS only do audio/mp4 — audio/webm returns false.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      mr.onstop = async () => {
        stopStream();
        const blobMime = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobMime });
        if (blob.size < 400) {
          setError("Didn't catch anything — press record, speak for a second or two, then press again to stop.");
          return;
        }
        await processClip(blob);
        // Continuous mode: automatically reopen the mic for the next utterance.
        if (continuousRef.current) {
          setTimeout(() => { if (continuousRef.current) startRecording(); }, 300);
        }
      };
      // Request chunks every 250ms so very short recordings still flush data.
      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setMicPermissionDenied(true);
      const err = e as DOMException & { message?: string };
      const msg = err?.message || "";
      const name = err?.name || "";
      if (name === "NotAllowedError" || /Permission|NotAllowed/i.test(msg)) {
        if (inIframe) {
          setError("Voice Mirror needs mic access, which is blocked inside the Emergent preview panel.");
          setErrorKind("iframe");
        } else {
          setError("Mic blocked — click the 🎙 icon in your browser's address bar and allow microphone access, then try again.");
          setErrorKind("permission");
        }
      } else if (name === "NotFoundError" || /NotFound|Requested device/i.test(msg)) {
        setError("No microphone detected on this device.");
        setErrorKind("generic");
      } else {
        setError(`Mic error: ${msg || "unknown"}`);
        setErrorKind("generic");
      }
    }
  }, [processClip, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white" data-testid="voice-mirror-page">
      {/* Hero */}
      <section className="relative border-b border-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-black to-purple-900/20 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
            data-testid="voice-mirror-back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-4">
            <Sparkles className="w-4 h-4" /> Voice Mirror · Phase 3
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
            Speak once.
            <br />
            <span className="text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text">
              Heard everywhere.
            </span>
          </h1>
          <p className="mt-6 text-neutral-400 max-w-xl">
            Real-time bilingual voice translation. Whisper transcribes, Claude translates, and OpenAI
            gives you a deterministic voice — no cloning, no extra keys.
          </p>
        </div>
      </section>

      {/* Controls */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        {/* Top bar with History button */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { setHistoryOpen(true); loadHistory(); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10"
            data-testid="voice-mirror-history-btn"
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-stretch">
          {/* Language Picker */}
          <div className="flex-1 p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm">
            <label className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Languages className="w-4 h-4" /> Translate to
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="voice-mirror-lang-picker">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setTargetLang(lang.code)}
                  data-testid={`lang-${lang.code}`}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    targetLang === lang.code
                      ? "bg-cyan-500/20 border border-cyan-400 text-cyan-200"
                      : "bg-neutral-800/60 border border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  <span className="mr-1">{lang.flag}</span>
                  {lang.code}
                </button>
              ))}
            </div>
          </div>

          {/* Record Button */}
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm min-w-[240px]">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={recording ? stopRecording : startRecording}
              disabled={processing}
              data-testid={recording ? "voice-mirror-stop-btn" : "voice-mirror-record-btn"}
              className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-white transition-all shadow-2xl ${
                recording
                  ? "bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-500/50 animate-pulse"
                  : processing
                  ? "bg-neutral-700"
                  : "bg-gradient-to-br from-cyan-400 to-purple-600 hover:scale-105"
              } disabled:opacity-60`}
            >
              {processing ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : recording ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </motion.button>
            <div className="mt-3 text-xs font-mono uppercase tracking-widest text-neutral-400" data-testid="voice-mirror-status">
              {processing ? "Processing..." : recording ? "Recording · tap to stop" : continuous ? "Continuous ON · tap to start" : "Tap to record"}
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer w-full" data-testid="voice-mirror-continuous-toggle">
              <div>
                <div className="text-sm font-bold">Continuous</div>
                <div className="text-[10px] text-white/40">Auto-reopens mic after each utterance.</div>
              </div>
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => {
                  const next = e.target.checked;
                  setContinuous(next);
                  if (next && !recording) {
                    startRecording();
                  } else if (!next && recording) {
                    stopRecording();
                  }
                }}
                className="w-5 h-5 accent-cyan-400"
                data-testid="voice-mirror-continuous-checkbox"
              />
            </label>
          </div>
        </div>

        {/* (B) Voice Picker */}
        {voices.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm" data-testid="voice-picker-card">
            <div className="flex items-center gap-2 text-xs font-mono text-purple-300 uppercase tracking-widest mb-3">
              <Volume2 className="w-4 h-4" /> Your Voice
              {savingVoice && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="voice-picker-grid">
              {voices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => saveVoice(v.id)}
                  data-testid={`voice-${v.id}`}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedVoice === v.id
                      ? "bg-purple-500/20 border border-purple-400 text-purple-100"
                      : "bg-neutral-800/60 border border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  <div className="font-bold">{v.label}</div>
                  <div className="text-[10px] text-white/50">{v.vibe}</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-white/40 mt-2">Your saved voice is used on every translation — solo, pair, and quick phrases.</div>
          </div>
        )}

        {/* (D) Quick Phrases */}
        {packs.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm" data-testid="quick-phrases-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 uppercase tracking-widest">
                <Zap className="w-4 h-4" /> Quick Phrases
              </div>
              <div className="ml-auto flex gap-1">
                {packs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePack(p.id)}
                    data-testid={`phrase-pack-${p.id}`}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activePack === p.id
                        ? "bg-emerald-500/20 border border-emerald-400 text-emerald-100"
                        : "bg-neutral-800/60 border border-neutral-700 text-neutral-400 hover:border-neutral-500"
                    }`}
                  >
                    <span className="mr-1">{p.emoji}</span>{p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-testid="phrase-chips">
              {currentPack?.phrases.map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => speakPhrase(phrase)}
                  disabled={speakingPhrase === phrase}
                  data-testid={`phrase-btn`}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    speakingPhrase === phrase
                      ? "bg-emerald-500/30 border-emerald-400 text-white"
                      : "bg-black/40 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/30"
                  }`}
                >
                  {speakingPhrase === phrase ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : null}
                  {phrase}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-white/40 mt-3">
              Tap a phrase to speak it in <span className="text-emerald-200 font-mono">{targetLang}</span> with your selected voice.
            </div>
          </div>
        )}

        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-fuchsia-500/10 to-cyan-400/10 border border-fuchsia-500/20 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-fuchsia-300 flex-shrink-0" />
          <div className="text-sm text-white/80 flex-1">
            Want a <span className="text-fuchsia-300 font-bold">real two-way conversation</span>?
            Pair mode lets you + a friend each speak your own language — you hear theirs in yours, they hear yours in theirs.
          </div>
          <button
            onClick={() => navigate("/voice-mirror/pair")}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-sm font-black italic uppercase tracking-widest hover:opacity-90"
            data-testid="voice-mirror-pair-cta"
          >
            Pair Mode
          </button>
        </div>

        {error && (
          <div
            className={`mt-4 p-3 rounded-lg border text-sm ${
              errorKind === "iframe"
                ? "bg-amber-500/10 border-amber-400/40 text-amber-100"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
            data-testid="voice-mirror-error"
          >
            <div>{error}</div>
            {errorKind === "iframe" && (
              <a
                href={openInNewTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-100 font-bold px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                data-testid="voice-mirror-open-new-tab"
              >
                Open Voice Mirror in a new tab →
              </a>
            )}
            {errorKind !== "iframe" && micPermissionDenied && (
              <span className="block text-xs mt-1 opacity-70">
                Enable mic permission in your browser settings and refresh.
              </span>
            )}
          </div>
        )}

        {!error && inIframe && (
          <div
            className="mt-4 p-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2"
            data-testid="voice-mirror-iframe-notice"
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Heads up:</span> mic access is usually blocked in this preview panel.{" "}
              <a
                href={openInNewTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded"
              >
                Open in a new tab
              </a>{" "}
              to use the mic.
            </div>
          </div>
        )}
      </section>

      {/* Transcripts */}
      <section className="max-w-4xl mx-auto px-6 py-8 pb-24">
        <h2 className="text-lg font-black italic uppercase tracking-tighter mb-4">Transcripts</h2>
        {rows.length === 0 ? (
          <div className="text-neutral-500 text-sm" data-testid="voice-mirror-empty">
            Your translated clips will appear here. The platform uses a stable OpenAI voice per user — same voice, different language.
          </div>
        ) : (
          <div className="space-y-3" data-testid="voice-mirror-transcripts">
            {rows.map((r) => (
              <TranscriptCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      {/* (C) History Drawer */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-stretch justify-end"
            onClick={() => setHistoryOpen(false)}
            data-testid="voice-mirror-history-drawer"
          >
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full sm:w-[420px] bg-neutral-950 border-l border-white/10 text-white flex flex-col"
            >
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <History className="w-4 h-4 text-cyan-300" />
                <div className="text-xs font-mono uppercase tracking-widest text-cyan-300">Transcript History</div>
                <button
                  onClick={clearHistory}
                  disabled={historyRows.length === 0}
                  className="ml-auto text-[10px] text-rose-300 hover:text-rose-200 flex items-center gap-1 disabled:opacity-40"
                  data-testid="voice-mirror-history-clear"
                >
                  <Trash2 className="w-3 h-3" /> Clear all
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="text-white/50 hover:text-white"
                  data-testid="voice-mirror-history-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyLoading ? (
                  <div className="text-center py-12 text-white/40">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : historyRows.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-sm" data-testid="voice-mirror-history-empty">
                    Nothing translated yet. Record a clip or tap a quick phrase to start building your history.
                  </div>
                ) : (
                  historyRows.map((h) => (
                    <div
                      key={h.entry_id}
                      className="p-3 rounded-lg border border-white/10 bg-white/5"
                      data-testid={`voice-mirror-history-row-${h.entry_id}`}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-mono text-white/50 mb-1">
                        <span className="text-cyan-300">{h.source_lang || "?"} → {h.target_lang}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-white/5 uppercase text-[9px]">{h.channel}</span>
                        <span className="ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-white/60 italic">"{h.original}"</div>
                      <div className="text-sm text-white mt-0.5">{h.translated}</div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TranscriptCard: React.FC<{ row: TranscriptRow }> = ({ row }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!row.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(row.audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div
      className="p-4 rounded-xl bg-neutral-900/70 border border-white/5 hover:border-cyan-500/30 transition-colors"
      data-testid={`transcript-row-${row.id}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
          {row.sourceLang || "?"} → {row.targetLang}
        </span>
        {row.voice && (
          <span className="text-[10px] text-neutral-600 font-mono">voice: {row.voice}</span>
        )}
        <span className="text-[10px] text-neutral-600 ml-auto">
          {new Date(row.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm text-neutral-400 italic mb-1">"{row.original}"</div>
      <div className="text-lg text-white">{row.translated}</div>
      {row.audioUrl && (
        <button
          onClick={toggle}
          data-testid={`transcript-play-${row.id}`}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20"
        >
          <Volume2 className="w-3 h-3" />
          {playing ? "Pause" : "Play translation"}
        </button>
      )}
    </div>
  );
};

export default VoiceMirror;
