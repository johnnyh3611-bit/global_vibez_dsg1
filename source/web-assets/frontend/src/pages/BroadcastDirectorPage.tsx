/**
 * Broadcast Director — streamer-side panel to attach a Cloudflare live
 * input to a DSG TV channel. Calls `POST /api/media-master/tv/program`.
 *
 * The user picks:
 *   1. One of the 5 DSG TV channels (with a lock badge on gated ones,
 *      so they know unlocking still costs $VIBEZ for viewers).
 *   2. Duration (1, 2, 4, 8, 24 hours)
 * and hits "Broadcast for N hours". Their existing CF live input is
 * provisioned on demand (idempotent) if they don't have one yet.
 *
 * Shows current active programs so the streamer never accidentally
 * double-books themselves on two channels at once.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Lock, Clock3, Megaphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

type Channel = {
  channel_id: string;
  name: string;
  tagline: string;
  category: string;
  requires_18_plus: boolean;
  requires_paywall: boolean;
  coin_price: number;
};

type LiveInput = {
  input_id: string;
  streamer_id: string;
  name?: string;
  is_live?: boolean;
  rtmps_url?: string | null;
  rtmps_key?: string | null;
  mode?: string;
};

type NowPlaying = {
  channel_id: string;
  live: boolean;
  live_input: null | { input_id: string; streamer_id: string; name: string };
  program?: { programmed_until: string } | null;
};

const CATEGORY_THEME: Record<string, string> = {
  arena: 'from-emerald-400/30 to-cyan-400/30',
  dating: 'from-pink-400/30 to-rose-400/30',
  radio: 'from-amber-400/30 to-orange-400/30',
  adult: 'from-rose-500/30 to-red-600/30',
  horror: 'from-violet-500/30 to-fuchsia-600/30',
};

const DURATION_OPTIONS = [1, 2, 4, 8, 24];

export default function BroadcastDirectorPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [liveInput, setLiveInput] = useState<LiveInput | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activePrograms, setActivePrograms] = useState<Record<string, NowPlaying>>({});
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [duration, setDuration] = useState<number>(4);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { void init(); }, []);

  async function init() {
    const token = localStorage.getItem('auth_token');
    if (!token) { navigate('/login'); return; }
    const me = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch(() => null);
    if (!me) { navigate('/login'); return; }
    const uid = me.user_id || me.id || me._id;
    setUserId(uid);

    // Load channels + the streamer's CF live input (if any).
    const [cRes, lRes] = await Promise.all([
      fetch(`${API_URL}/api/media-master/tv/channels`).then((r) => r.json()).catch(() => ({ channels: [] })),
      fetch(`${API_URL}/api/streaming/cloudflare/live-inputs/by-streamer/${uid}`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    setChannels(cRes.channels || []);
    if (lRes && lRes.input_id) setLiveInput(lRes);
    if (cRes.channels?.[0]) setSelectedChannelId(cRes.channels[0].channel_id);

    // Pull current programming for each channel so we can show "Live now"
    // tags / collision warnings against the streamer's own input.
    const programs = await Promise.all(
      (cRes.channels || []).map((c: Channel) =>
        fetch(`${API_URL}/api/media-master/tv/now-playing/${c.channel_id}`)
          .then((r) => r.json())
          .catch(() => ({ channel_id: c.channel_id, live: false, live_input: null })),
      ),
    );
    const map: Record<string, NowPlaying> = {};
    programs.forEach((p: NowPlaying) => { map[p.channel_id] = p; });
    setActivePrograms(map);
  }

  async function provisionLiveInput(): Promise<LiveInput | null> {
    if (!userId) return null;
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/streaming/cloudflare/live-inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamer_id: userId, name: 'My Live Input' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage({ kind: 'err', text: err?.detail || 'Failed to provision live input' });
        return null;
      }
      const data: LiveInput = await res.json();
      setLiveInput(data);
      return data;
    } finally { setBusy(false); }
  }

  async function broadcast() {
    setMessage(null);
    if (!userId || !selectedChannelId) {
      setMessage({ kind: 'err', text: 'Pick a channel first.' });
      return;
    }
    let input = liveInput;
    if (!input) {
      input = await provisionLiveInput();
      if (!input) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/media-master/tv/program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          input_id: input.input_id,
          streamer_id: userId,
          duration_hours: duration,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'err', text: json?.detail || 'Broadcast failed' });
        return;
      }
      setMessage({
        kind: 'ok',
        text: `Live on ${channels.find((c) => c.channel_id === selectedChannelId)?.name} until ${new Date(json.program.programmed_until).toLocaleString()}.`,
      });
      await init(); // refresh active programs
    } finally { setBusy(false); }
  }

  const selectedChannel = useMemo(
    () => channels.find((c) => c.channel_id === selectedChannelId),
    [channels, selectedChannelId],
  );
  const conflict = useMemo(() => {
    // Are we already programmed onto a different channel with this input?
    if (!liveInput) return null;
    for (const [cid, p] of Object.entries(activePrograms)) {
      if (cid === selectedChannelId) continue;
      if (p.live_input?.input_id === liveInput.input_id) return cid;
    }
    return null;
  }, [activePrograms, liveInput, selectedChannelId]);

  return (
    <div
      data-testid="broadcast-director-page"
      className="min-h-screen bg-[#06050a] text-white relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-[-5%] w-[55%] h-[55%] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-emerald-500/10 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-8">
        <BackButton to="/dashboard" label="Back to dashboard" />

        <header className="mt-6 mb-10">
          <div className="flex items-center gap-2 text-amber-300/80 text-xs uppercase tracking-widest mb-2">
            <Megaphone className="w-4 h-4" /> Streamer · Broadcast Director
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light">Broadcast to the Network.</h1>
          <p className="mt-4 max-w-xl text-white/65 text-sm">
            Attach your live feed to a DSG TV channel. Viewers will see your broadcast in the channel's
            HLS player — gated channels still charge viewers ₵ for a 24h pass.
          </p>
        </header>

        {/* Live input status */}
        <div
          data-testid="broadcast-director-input-status"
          className="rounded-2xl p-5 bg-gradient-to-br from-[#0a1318] to-[#0c0a14] ring-1 ring-emerald-400/25 mb-8"
        >
          <div className="flex items-start gap-3">
            <Radio className="w-5 h-5 text-emerald-300 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-emerald-300/80">Your CF live input</div>
              {liveInput ? (
                <>
                  <div className="text-white text-sm mt-1 font-mono break-all">{liveInput.input_id}</div>
                  <div className="text-white/55 text-xs mt-1">
                    {liveInput.is_live ? '🔴 Currently broadcasting' : '⚪ Not broadcasting yet — start your encoder to go live.'}
                    {liveInput.mode === 'stub' && <span className="ml-2 text-amber-200/70">(preview-env stub)</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-white/65 text-sm mt-1">No live input yet — we'll create one when you broadcast for the first time.</div>
                  <button
                    data-testid="broadcast-director-provision-btn"
                    onClick={provisionLiveInput}
                    disabled={busy}
                    className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-amber-400 text-black font-semibold disabled:opacity-50"
                  >
                    Provision now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Message strip */}
        {message && (
          <div
            data-testid={`broadcast-director-message-${message.kind}`}
            className={`mb-6 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
              message.kind === 'ok'
                ? 'bg-emerald-500/10 ring-1 ring-emerald-400/40 text-emerald-100'
                : 'bg-red-500/10 ring-1 ring-red-400/40 text-red-100'
            }`}
          >
            {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Channel picker */}
        <section className="mb-8" data-testid="broadcast-director-channels">
          <h2 className="text-lg font-medium text-white/85 mb-4">Pick a channel</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {channels.map((c, i) => {
              const isSelected = c.channel_id === selectedChannelId;
              const live = activePrograms[c.channel_id]?.live;
              const programmedByMe = activePrograms[c.channel_id]?.live_input?.streamer_id === userId;
              return (
                <motion.button
                  key={c.channel_id}
                  data-testid={`broadcast-director-channel-${c.channel_id}`}
                  onClick={() => setSelectedChannelId(c.channel_id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative text-left rounded-2xl p-5 bg-gradient-to-br ${CATEGORY_THEME[c.category] || 'from-slate-700/30 to-slate-900/30'} ring-1 transition-all ${
                    isSelected ? 'ring-amber-300/80 scale-[1.02]' : 'ring-white/10 hover:ring-white/30'
                  }`}
                >
                  {c.requires_paywall && (
                    <div className="absolute top-3 right-3">
                      <Lock className="w-4 h-4 text-amber-200" />
                    </div>
                  )}
                  <div className="text-white font-semibold">{c.name}</div>
                  <div className="text-white/65 text-xs mt-1 min-h-[2.5rem]">{c.tagline}</div>
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    {live && (
                      <span className={`px-2 py-0.5 rounded ${programmedByMe ? 'bg-emerald-400 text-black' : 'bg-rose-500/30 text-rose-100'}`}>
                        {programmedByMe ? 'You are live' : 'Another streamer is live'}
                      </span>
                    )}
                    {c.requires_paywall && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-100">
                        Viewer pass ₵{c.coin_price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Duration + broadcast */}
        <section className="rounded-2xl p-6 bg-gradient-to-br from-[#0c0a14] to-[#0a1318] ring-1 ring-amber-400/25">
          <div className="flex items-center gap-2 mb-4 text-amber-200/80 text-xs uppercase tracking-widest">
            <Clock3 className="w-4 h-4" /> Broadcast duration
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {DURATION_OPTIONS.map((h) => (
              <button
                key={h}
                data-testid={`broadcast-director-duration-${h}`}
                onClick={() => setDuration(h)}
                className={`rounded-full px-4 py-1.5 text-sm transition-all ${
                  duration === h
                    ? 'bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold'
                    : 'bg-white/10 ring-1 ring-white/20 text-white/80 hover:bg-white/15'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>

          {conflict && (
            <div className="mb-4 text-xs text-rose-200 bg-rose-500/10 ring-1 ring-rose-400/30 rounded-lg px-3 py-2">
              ⚠️ Your input is currently programmed on <strong>{conflict}</strong>. Broadcasting on{' '}
              <strong>{selectedChannel?.name}</strong> doesn't end the other slot — viewers on both channels will see the same feed.
            </div>
          )}

          <button
            data-testid="broadcast-director-broadcast-btn"
            disabled={busy || !selectedChannelId}
            onClick={broadcast}
            className="rounded-full px-7 py-3 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Megaphone className="w-4 h-4" />
            {busy ? 'Broadcasting…' : `Broadcast to ${selectedChannel?.name || '…'} for ${duration}h`}
          </button>
        </section>
      </div>
    </div>
  );
}
