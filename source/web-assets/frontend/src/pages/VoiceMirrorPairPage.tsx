/**
 * Voice Mirror Pair — bidirectional, real-time voice translation between
 * two people. Each side sets their native language. The other person hears
 * everything you say translated into theirs; you hear theirs in yours.
 *
 * UX: create a room (get a 6-char pair code to share) OR paste a pair code
 * to join. Then push-to-talk (or flip Continuous Mode) and just talk.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Users, Loader2, ArrowLeft, Copy, Check, Sparkles, PhoneOff, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES = [
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

type Participant = { user_id: string; user_name?: string; native_lang: string };
type Room = { room_id: string; pair_code: string; participants: Participant[]; is_full: boolean; you?: Participant };
type InboxMsg = {
  msg_id: string;
  from_user_id: string;
  from_user_name?: string;
  original: string;
  source_lang: string;
  translated: string;
  target_lang: string;
  audio_base64: string;
  voice?: string;
  at: string;
  at_ms: number;
};
type TranscriptItem = {
  id: string;
  speaker: "me" | "peer";
  speaker_name?: string;
  original: string;
  translated: string;
  source_lang: string;
  target_lang: string;
  at_ms: number;
  audio_url?: string;
};

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const resolveUserId = async (): Promise<{ id: string; name: string }> => {
  try {
    const r = await fetch(`${API}/api/auth/me`, {});
    if (r.ok) {
      const me = await r.json();
      const id = me.user_id || me.id || me.user?.user_id;
      if (id) return { id: String(id), name: String(me.username || me.name || me.email?.split("@")[0] || "Player") };
    }
  } catch {/* anon */}
  let id = localStorage.getItem("mp_user_id");
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("mp_user_id", id);
  }
  const name = localStorage.getItem("mp_user_name") || "Player";
  return { id, name };
};

export default function VoiceMirrorPairPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Player");
  const [myLang, setMyLang] = useState("EN");
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sinceMsRef = useRef<number>(0);
  const pollIdRef = useRef<number | null>(null);
  const continuousRef = useRef(false);

  useEffect(() => {
    resolveUserId().then(({ id, name }) => {
      setUserId(id);
      setUserName(name);
    });
  }, []);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  // Peer-inbox poller — runs while we're in a room.
  useEffect(() => {
    if (!room || !userId) return;
    const tick = async () => {
      try {
        const r = await fetch(
          `${API}/api/voice-mirror/pair/${room.room_id}/inbox?user_id=${encodeURIComponent(userId)}&since_ms=${sinceMsRef.current}`,
          {}
        );
        if (!r.ok) return;
        const data = await r.json();
        const msgs: InboxMsg[] = data.messages || [];
        if (msgs.length) {
          msgs.forEach((m) => {
            sinceMsRef.current = Math.max(sinceMsRef.current, m.at_ms);
            setTranscript((prev) => [
              ...prev,
              {
                id: m.msg_id,
                speaker: "peer",
                speaker_name: m.from_user_name,
                original: m.original,
                translated: m.translated,
                source_lang: m.source_lang,
                target_lang: m.target_lang,
                at_ms: m.at_ms,
                audio_url: m.audio_base64 ? `data:audio/mpeg;base64,${m.audio_base64}` : undefined,
              },
            ]);
            if (m.audio_base64) {
              try {
                const audio = new Audio(`data:audio/mpeg;base64,${m.audio_base64}`);
                audio.play().catch(() => {/* autoplay may require gesture */});
              } catch {/* ignore */}
            }
          });
        }
        // Refresh room state (picks up peer join/leave + their lang)
        const sr = await fetch(`${API}/api/voice-mirror/pair/${room.room_id}?user_id=${encodeURIComponent(userId)}`, {});
        if (sr.ok) setRoom(await sr.json());
      } catch {/* transient */}
    };
    tick();
    pollIdRef.current = window.setInterval(tick, 1400);
    return () => {
      if (pollIdRef.current) window.clearInterval(pollIdRef.current);
      pollIdRef.current = null;
    };
  }, [room?.room_id, userId]);

  const createRoom = async () => {
    setError(null);
    try {
      const r = await fetch(`${API}/api/voice-mirror/pair/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, user_name: userName, native_lang: myLang }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Create failed");
      setRoom(data as Room);
      sinceMsRef.current = Date.now();
      setTranscript([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const joinRoom = async () => {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError("Enter a pair code first");
    try {
      const r = await fetch(`${API}/api/voice-mirror/pair/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, user_name: userName, native_lang: myLang, pair_code: code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Join failed");
      setRoom(data as Room);
      sinceMsRef.current = Date.now();
      setTranscript([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateLang = async (code: string) => {
    setMyLang(code);
    if (!room) return;
    try {
      await fetch(`${API}/api/voice-mirror/pair/${room.room_id}/set-lang`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, native_lang: code }),
      });
    } catch {/* non-fatal */}
  };

  const sendAudio = useCallback(async (blob: Blob) => {
    if (!room) return;
    setProcessing(true);
    setError(null);
    try {
      const buf = await blob.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const r = await fetch(`${API}/api/voice-mirror/pair/${room.room_id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, audio_base64: b64 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Send failed");
      if (data.empty) {
        setError("No speech detected in that clip.");
        return;
      }
      setTranscript((prev) => [
        ...prev,
        {
          id: `me_${data.at_ms}`,
          speaker: "me",
          speaker_name: userName,
          original: data.original,
          translated: data.translated,
          source_lang: data.source_lang,
          target_lang: data.target_lang,
          at_ms: data.at_ms,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [room, userId, userName]);

  const startRecording = useCallback(async () => {
    if (!room) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size >= 500) {
          await sendAudio(blob);
        } else {
          setError("Clip too short — hold for at least 1s.");
        }
        // Continuous mode: reopen the mic for the next utterance.
        if (continuousRef.current) {
          setTimeout(() => {
            if (continuousRef.current) startRecording();
          }, 300);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError((e as Error).message || "Mic permission denied");
    }
  }, [room, sendAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const leaveRoom = async () => {
    if (!room) return;
    try {
      await fetch(`${API}/api/voice-mirror/pair/${room.room_id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch {/* ignore */}
    setContinuous(false);
    setRecording(false);
    setRoom(null);
    setTranscript([]);
    sinceMsRef.current = 0;
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.pair_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {/* ignore */}
  };

  const peer = room?.participants.find((p) => p.user_id !== userId);
  const peerLangLabel = peer ? LANGUAGES.find((l) => l.code === peer.native_lang)?.label || peer.native_lang : null;

  // ---------- Pre-room setup screen ----------
  if (!room) {
    return (
      <div className="min-h-screen bg-black text-white" data-testid="voice-mirror-pair-page">
        <section className="relative border-b border-neutral-900">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-black to-fuchsia-900/20 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <button onClick={() => navigate(-1)} className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1" data-testid="vm-pair-back-btn">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2 text-fuchsia-400 font-mono text-xs uppercase tracking-widest mb-4">
              <Sparkles className="w-4 h-4" /> Pair Mode · Bidirectional
            </div>
            <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
              You speak yours.
              <br />
              <span className="text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text">They hear theirs.</span>
            </h1>
            <p className="mt-6 text-neutral-400 max-w-xl">
              Set your native language, share a 6-character pair code, then just talk. Every utterance is translated both ways in real time.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <Card className="p-5 bg-neutral-900/60 border-white/5 text-white">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2">
              <Languages className="w-4 h-4" /> Your Native Language
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-testid="vm-pair-lang-picker">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setMyLang(l.code)}
                  data-testid={`vm-pair-lang-${l.code}`}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    myLang === l.code
                      ? "bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-200"
                      : "bg-neutral-800/60 border border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  <span className="mr-1">{l.flag}</span>{l.code}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5 bg-neutral-900/60 border-white/5 text-white">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3">Start a Pair</div>
              <p className="text-sm text-white/60 mb-4">Generate a 6-letter code and share it with whoever you want to talk to.</p>
              <Button onClick={createRoom} className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black italic uppercase tracking-widest" data-testid="vm-pair-create-btn">
                <Users className="w-4 h-4 mr-1" /> Create Room
              </Button>
            </Card>

            <Card className="p-5 bg-neutral-900/60 border-white/5 text-white">
              <div className="text-xs font-mono uppercase tracking-widest text-fuchsia-300 mb-3">Join With Code</div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. AB7KMP"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="bg-black/40 border-white/10 text-white uppercase tracking-[0.3em] font-mono"
                  maxLength={6}
                  data-testid="vm-pair-code-input"
                />
                <Button onClick={joinRoom} className="bg-white/10 hover:bg-white/20 text-white" data-testid="vm-pair-join-btn">Join</Button>
              </div>
            </Card>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" data-testid="vm-pair-error">{error}</div>
          )}

          <div className="text-center text-xs text-white/40 pt-4">
            Prefer solo? Use the <button onClick={() => navigate("/voice-mirror")} className="underline text-cyan-300">single-speaker Voice Mirror</button> instead.
          </div>
        </section>
      </div>
    );
  }

  // ---------- In-room screen ----------
  return (
    <div className="min-h-screen bg-black text-white" data-testid="voice-mirror-pair-page-in-room">
      {/* Header band */}
      <div className="border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-950/40 via-black to-cyan-950/40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <button onClick={leaveRoom} className="text-sm text-neutral-400 hover:text-white flex items-center gap-1" data-testid="vm-pair-leave-btn">
            <PhoneOff className="w-4 h-4" /> Leave
          </button>

          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">Pair Code</div>
            <button
              onClick={copyCode}
              data-testid="vm-pair-code-display"
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono tracking-[0.4em] text-lg flex items-center gap-2 hover:bg-white/10"
            >
              {room.pair_code}
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10" data-testid="vm-pair-you-lang">
              <span className="text-white/40">You:</span>
              <select
                value={myLang}
                onChange={(e) => updateLang(e.target.value)}
                className="bg-transparent text-white outline-none"
                data-testid="vm-pair-my-lang-select"
              >
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${peer ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300" : "bg-amber-500/10 border-amber-400/30 text-amber-300"}`} data-testid="vm-pair-peer-status">
              {peer ? (
                <>● {peer.user_name || "Peer"} · {peerLangLabel}</>
              ) : (
                <>○ Waiting for peer…</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Transcript stream */}
        <div className="space-y-3" data-testid="vm-pair-transcript">
          {transcript.length === 0 ? (
            <div className="p-10 rounded-xl border border-white/5 bg-white/5 text-center text-white/40" data-testid="vm-pair-empty">
              {peer ? "Tap the mic and say something — it'll land in their language in ~2–3s." : "Share your pair code. Once they join, start talking."}
            </div>
          ) : (
            transcript.map((t) => <TranscriptCard key={t.id} t={t} />)
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Card className="p-5 bg-neutral-900/60 border-white/5 text-white">
            <div className="flex flex-col items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={recording ? stopRecording : startRecording}
                disabled={!peer && !continuous ? false : processing}
                data-testid={recording ? "vm-pair-stop-btn" : "vm-pair-record-btn"}
                className={`w-28 h-28 rounded-full flex items-center justify-center font-bold text-white transition-all shadow-2xl ${
                  recording
                    ? "bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-500/50 animate-pulse"
                    : processing
                    ? "bg-neutral-700"
                    : "bg-gradient-to-br from-fuchsia-500 to-cyan-400 hover:scale-105"
                } disabled:opacity-60`}
              >
                {processing && !recording ? <Loader2 className="w-10 h-10 animate-spin" /> : recording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
              </motion.button>
              <div className="text-xs font-mono uppercase tracking-widest text-neutral-400" data-testid="vm-pair-status">
                {processing && !recording ? "Translating…" : recording ? "Recording · tap to stop" : continuous ? "Continuous ON" : "Tap to record"}
              </div>
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer" data-testid="vm-pair-continuous-toggle">
              <div>
                <div className="text-sm font-bold">Continuous Mode</div>
                <div className="text-xs text-white/50">Keeps mic open; auto-sends each utterance.</div>
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
                className="w-5 h-5 accent-fuchsia-400"
                data-testid="vm-pair-continuous-checkbox"
              />
            </label>
          </Card>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" data-testid="vm-pair-room-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const TranscriptCard: React.FC<{ t: TranscriptItem }> = ({ t }) => {
  const mine = t.speaker === "me";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${mine ? "bg-cyan-500/5 border-cyan-500/20" : "bg-fuchsia-500/5 border-fuchsia-500/20"}`}
      data-testid={`vm-pair-msg-${t.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-mono uppercase tracking-[0.3em] ${mine ? "text-cyan-300" : "text-fuchsia-300"}`}>
          {mine ? "You" : (t.speaker_name || "Peer")} · {t.source_lang || "?"} → {t.target_lang}
        </span>
        <span className="text-[10px] text-white/30 ml-auto">{new Date(t.at_ms).toLocaleTimeString()}</span>
      </div>
      <div className="text-sm text-white/60 italic mb-1">"{t.original}"</div>
      <div className="text-lg text-white">{t.translated}</div>
    </motion.div>
  );
};
