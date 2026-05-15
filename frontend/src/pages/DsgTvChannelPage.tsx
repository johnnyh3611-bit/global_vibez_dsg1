/**
 * DSG TV Channel viewer — handles 3 states:
 *   1. Free channel → show "Live now" placeholder + clip strip
 *   2. Gated channel, no active pass → show unlock CTA (with 21+ + PIN inputs)
 *   3. Gated channel, active pass → unlocked viewing experience
 *
 * The "video player" is currently a styled placeholder — the actual
 * Cloudflare Stream HLS embed plugs in once a streamer goes live on
 * the channel.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Shield, KeyRound, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';
import HLSPlayer from '@/components/streaming/HLSPlayer';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const NOW_PLAYING_POLL_MS = 12_000;

type AccessState = {
  channel_id: string;
  access: boolean;
  reason?: string;
  coin_price?: number;
  requires_18_plus?: boolean;
  requires_secondary_pin?: boolean;
  expires_at?: string;
};

type Channel = {
  channel_id: string;
  name: string;
  tagline: string;
  category: string;
  requires_18_plus: boolean;
  requires_paywall: boolean;
  requires_secondary_pin: boolean;
  coin_price: number;
};

type NowPlaying = {
  channel_id: string;
  live: boolean;
  live_input: null | {
    input_id: string;
    streamer_id: string;
    name: string;
    hls_playback_url: string | null;
    dash_playback_url: string | null;
    started_at: string | null;
  };
};

export default function DsgTvChannelPage() {
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId: string }>();
  const [userId, setUserId] = useState<string>('');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [pin, setPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, [channelId]);

  // Poll the channel's now-playing endpoint while unlocked so the
  // viewer auto-attaches when a streamer goes live mid-session.
  useEffect(() => {
    if (!channelId || !access?.access) return;
    void pollNowPlaying();
    const t = setInterval(pollNowPlaying, NOW_PLAYING_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, access?.access]);

  async function pollNowPlaying() {
    if (!channelId) return;
    const data = await fetch(`${API_URL}/api/media-master/tv/now-playing/${channelId}`)
      .then((r) => r.json()).catch(() => null);
    if (data) setNowPlaying(data);
  }

  async function load() {
    if (!channelId) return;
    const token = localStorage.getItem('auth_token');
    if (!token) { navigate('/login'); return; }
    const me = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).catch(() => null);
    if (!me) { navigate('/login'); return; }
    const uid = me.user_id || me.id || me._id;
    setUserId(uid);

    const all = await fetch(`${API_URL}/api/media-master/tv/channels`).then((r) => r.json());
    const ch = (all.channels || []).find((c: Channel) => c.channel_id === channelId);
    setChannel(ch || null);

    const a = await fetch(`${API_URL}/api/media-master/tv/access/${channelId}/${uid}`).then((r) => r.json());
    setAccess(a);
  }

  async function unlock() {
    if (!channelId || !userId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/tv/unlock/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, secondary_pin: pin || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.detail?.message || json?.detail || 'Unlock failed'); return; }
      await load();
    } finally { setBusy(false); }
  }

  async function setPinNow() {
    if (!userId || newPin.length < 4) { setError('PIN must be 4-8 digits'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/tv/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin: newPin }),
      });
      if (!res.ok) { setError('Failed to set PIN'); return; }
      setPin(newPin);
      setNewPin('');
    } finally { setBusy(false); }
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-[#06050a] text-white grid place-items-center">
        <div className="text-white/60">Loading channel…</div>
      </div>
    );
  }

  const isUnlocked = !!access?.access;

  return (
    <div data-testid="dsg-tv-channel-page" className="min-h-screen bg-[#06050a] text-white">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <BackButton to="/media-master" label="Back to Network" />
        <header className="mt-6 mb-8">
          <h1 className="text-3xl sm:text-4xl font-light">{channel.name}</h1>
          <p className="text-white/60 mt-2">{channel.tagline}</p>
          {channel.requires_18_plus && (
            <span className="inline-block mt-3 text-xs font-bold bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded">
              21+ verification required
            </span>
          )}
        </header>

        {error && (
          <div data-testid="dsg-tv-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {isUnlocked ? (
          <div data-testid="dsg-tv-player">
            {nowPlaying?.live && nowPlaying.live_input?.hls_playback_url ? (
              <div className="rounded-3xl overflow-hidden ring-1 ring-emerald-400/30 bg-black">
                <HLSPlayer
                  src={nowPlaying.live_input.hls_playback_url}
                  isLive
                  autoPlay
                  className="w-full"
                />
                <div className="px-4 py-3 text-xs text-emerald-200/80 border-t border-emerald-500/20 bg-black/40">
                  Live · {nowPlaying.live_input.name || channel.name}
                  {access?.expires_at && (
                    <span className="ml-2 text-amber-200/70">
                      · pass until {new Date(access.expires_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                data-testid="dsg-tv-player-offline"
                className="rounded-3xl aspect-video bg-gradient-to-br from-[#0a1318] to-[#0c0a14] ring-1 ring-emerald-400/30 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="text-xs uppercase tracking-widest text-emerald-300/80 mb-2">Off air</div>
                  <div className="text-xl text-white">{channel.name}</div>
                  <div className="text-white/50 text-sm mt-2 max-w-md mx-auto">
                    No streamer is broadcasting on this channel right now. We'll attach the live feed automatically when one goes live.
                  </div>
                  {access?.expires_at && (
                    <div className="text-amber-200/70 text-xs mt-3">
                      Pass valid until {new Date(access.expires_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="dsg-tv-unlock-card"
            className="rounded-3xl p-8 bg-gradient-to-br from-[#15071a] to-[#0c0a14] ring-1 ring-amber-300/30"
          >
            <Lock className="w-8 h-8 text-amber-300 mb-3" />
            <h2 className="text-2xl text-white font-light mb-2">Unlock {channel.name}</h2>
            <p className="text-white/65 text-sm mb-5">
              ₵{access?.coin_price?.toLocaleString() || channel.coin_price.toLocaleString()} for a 24-hour pass.
            </p>

            {channel.requires_18_plus && (
              <div className="mb-5 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 px-4 py-3 text-amber-200 text-sm flex gap-2 items-start">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  Requires verified 21+ identity (via Stripe Identity).
                  <button onClick={() => navigate('/restricted-goods-verification')} className="underline ml-1">
                    Verify now
                  </button>
                </div>
              </div>
            )}

            {channel.requires_secondary_pin && (
              <div className="mb-5">
                <label className="text-xs uppercase tracking-widest text-white/60">Secondary PIN</label>
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="dsg-tv-pin-input"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-32"
                  />
                  <input
                    data-testid="dsg-tv-new-pin-input"
                    type="password"
                    inputMode="numeric"
                    placeholder="Set new"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-32"
                  />
                  <button
                    data-testid="dsg-tv-set-pin-btn"
                    onClick={setPinNow}
                    disabled={busy}
                    className="rounded-lg px-3 py-2 text-xs bg-white/10 ring-1 ring-white/20"
                  >
                    <KeyRound className="w-3.5 h-3.5 inline mr-1" /> Save
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-white/40">
                  PIN never leaves our backend in plaintext — it's hashed (SHA-256).
                </div>
              </div>
            )}

            <button
              data-testid="dsg-tv-unlock-btn"
              onClick={unlock}
              disabled={busy}
              className="rounded-full px-6 py-3 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              Unlock for ₵{channel.coin_price.toLocaleString()} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
