/**
 * VibeSuite — live producer↔vocalist co-recording room.
 * Music Arena Blueprint §2 ("Live Studio Rooms").
 *
 * Two artists drop into the same Agora RTC channel. Audio is sent
 * via the existing `/api/agora/rtc-token` endpoint. Audience can
 * Pay-to-Suggest tempo / instrument changes — those tips post to
 * the Streamer Action Hub as `INSTRUMENT_GIFT` actions so the
 * 70/30 ledger fires on the same rail as everything else.
 *
 * NOTE: This component imports `agora-rtc-react` lazily so the rest
 * of the app doesn't pay the bundle cost. If the package isn't
 * installed (or RTC fails to initialize), the room falls back to a
 * "voice off" mode that still lets the audience tip in real time.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Sparkles, Music2, Hand } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface AgoraToken {
  app_id: string;
  channel: string;
  uid: number;
  token: string;
  ttl_seconds: number;
}

const SUGGESTIONS = [
  { id: 'tempo_up',   label: 'Tempo +10 BPM', cents: 100 },
  { id: 'tempo_down', label: 'Tempo −10 BPM', cents: 100 },
  { id: 'add_synth',  label: 'Add Synth Pad', cents: 250 },
  { id: 'add_808',    label: 'Add 808 Bass',  cents: 250 },
  { id: 'fade_out',   label: 'Fade Out',      cents: 50  },
];

export default function VibeSuite() {
  const navigate = useNavigate();
  const { suiteId = 'demo' } = useParams();
  const [tokenInfo, setTokenInfo] = useState<AgoraToken | null>(null);
  const [muted, setMuted] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [pot, setPot] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);

  const channel = useMemo(() => `vibe-suite-${suiteId}`, [suiteId]);

  // Mint an RTC token via the existing /api/agora/rtc-token endpoint.
  useEffect(() => {
    let alive = true;
    const t = localStorage.getItem('auth_token');
    fetch(`${API}/api/agora/rtc-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
      body: JSON.stringify({ channel, role: 'publisher' }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`token ${r.status}`)))
      .then((d) => alive && setTokenInfo(d))
      .catch((e) => alive && setError(`Voice unavailable (${e.message}) — tipping still works`));
    return () => { alive = false; };
  }, [channel]);

  // Lazy-init Agora RTC. We do this on first toggle-mic so users who
  // never want voice don't pay the SDK bundle cost.
  const enableVoice = async () => {
    if (!tokenInfo) { toast.error('No token yet'); return; }
    try {
      // @ts-ignore — module may be missing in some builds
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      await client.join(tokenInfo.app_id, tokenInfo.channel, tokenInfo.token, tokenInfo.uid);
      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([localTrack]);
      clientRef.current = client;
      localTrackRef.current = localTrack;
      setVoiceReady(true);
      setMuted(false);
      toast.success('Voice live');
    } catch (e: any) {
      setError(`Voice setup failed: ${e?.message || 'unknown'}`);
      toast.error('Voice failed — tipping still works');
    }
  };

  const toggleMute = async () => {
    if (!voiceReady) { await enableVoice(); return; }
    const next = !muted;
    setMuted(next);
    if (localTrackRef.current?.setMuted) {
      await localTrackRef.current.setMuted(next);
    }
  };

  // Audience pay-to-suggest → Streamer Action Hub as INSTRUMENT_GIFT
  const suggest = async (s: typeof SUGGESTIONS[0]) => {
    setPot((p) => p + s.cents);
    try {
      const t = localStorage.getItem('auth_token');
      await fetch(`${API}/api/streamer-actions/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
        body: JSON.stringify({
          streamer_id: `vibe_suite_${suiteId}`,
          action_kind: 'INSTRUMENT_GIFT',
          amount_cents: s.cents,
          metadata: { suggestion: s.id, suite_id: suiteId },
        }),
      });
      toast.success(`${s.label} suggested · +$${(s.cents / 100).toFixed(2)}`);
    } catch {}
  };

  // Cleanup on unmount — release mic + leave channel
  useEffect(() => {
    return () => {
      try {
        localTrackRef.current?.close?.();
        clientRef.current?.leave?.();
      } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-cyan-950/30 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-cyan-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="vs-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300">Music Arena · Vibe Suite · Live</div>
          <div className="text-lg font-black bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent truncate">
            Suite #{suiteId}
          </div>
        </div>
        <button
          onClick={toggleMute}
          data-testid="vs-mic-toggle"
          className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold ${voiceReady && !muted ? 'bg-emerald-500 text-black' : 'bg-white/10 hover:bg-white/20'}`}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {voiceReady ? (muted ? 'Unmute' : 'Live') : 'Enable Voice'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {error && (
          <div className="rounded-2xl bg-amber-500/15 border border-amber-400/40 p-3 text-xs text-amber-200" data-testid="vs-error">
            {error}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-cyan-500/10 border border-cyan-400/40 p-4 flex items-center gap-3"
          data-testid="vs-status"
        >
          <div className={`w-3 h-3 rounded-full ${voiceReady ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-cyan-300/80">RTC Channel</div>
            <div className="font-mono text-xs">{channel}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Pot</div>
            <div className="font-mono font-black text-amber-300" data-testid="vs-pot">${(pot / 100).toFixed(2)}</div>
          </div>
        </motion.div>

        <div className="rounded-2xl bg-stone-900/60 border border-fuchsia-500/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Hand className="w-5 h-5 text-fuchsia-300" />
            <div className="font-black">Pay-to-Suggest</div>
            <div className="text-[10px] text-fuchsia-200/70 ml-auto">audience tips · 70/30 split locked</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2" data-testid="vs-suggestion-grid">
            {SUGGESTIONS.map((s) => (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                data-testid={`vs-suggest-${s.id}`}
                onClick={() => suggest(s)}
                className="text-left rounded-xl px-3 py-3 bg-fuchsia-500/15 hover:bg-fuchsia-500/30 border border-fuchsia-400/30 hover:border-fuchsia-400/70 transition flex items-center justify-between"
              >
                <span className="font-bold text-sm">{s.label}</span>
                <span className="font-mono text-amber-300 text-xs">${(s.cents / 100).toFixed(2)}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-center text-xs text-amber-200/80 flex items-center justify-center gap-2">
          <Music2 className="w-4 h-4" /> 70% revenue split between producer & vocalist · 30% house · live recording streams to all listeners
        </div>
      </div>
    </div>
  );
}
