/**
 * Free TV Networks Cinema Room — synchronized FAST/AVOD watch parties.
 *
 * Implements the founder's Core Cinema Room Interaction Blueprint PDF
 * (2026-05-16). Four free networks (Pluto TV, Tubi, Plex, YouTube),
 * frame-accurate WebSocket sync, QR-code ambassador attribution, and
 * a hybrid embed strategy:
 *   - YouTube           → iframe player (sync friendly)
 *   - Pluto             → iframe attempt + external-launch fallback
 *   - Tubi / Plex       → external launch (their CSP blocks framing)
 *
 * Design ethos: dim "cinema lobby" obsidian backdrop, brand-color
 * accent rings around each network tile, glow-on-active. No purple
 * gradient slop — each network keeps its real brand color.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv, Users, Copy, ExternalLink, Send, ArrowRight, Play, Pause,
  RadioTower, Sparkles, Plus,
} from 'lucide-react';
import BackButton from '@/components/BackButton';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = (API || '').replace(/^http/, 'ws');

type Channel = {
  channel_id: string;
  name: string;
  genre: string;
  live: boolean;
};

type Network = {
  network_id: string;
  label: string;
  kind: string;
  description: string;
  logo_url: string;
  brand_color: string;
  embed_mode: 'iframe' | 'external' | 'hybrid';
  embed_base: string;
  external_base: string;
  epg_supported: boolean;
  channels: Channel[];
};

type Room = {
  room_id: string;
  name: string;
  active_network: string;
  channel_id: string;
  audience_count: number;
  ambassador_ref?: string | null;
  last_state?: {
    playback_state: string;
    current_time_marker: number;
  };
};

type ChatLine = { id: string; user_id: string; text: string };

export default function FreeTVCinemaRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();

  const [networks, setNetworks] = useState<Network[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [audience, setAudience] = useState(0);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [agentId] = useState(() => `AGENT_${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
  const [playbackState, setPlaybackState] = useState<'SYNCHRONIZED_RUNNING' | 'SYNCHRONIZED_PAUSED'>('SYNCHRONIZED_RUNNING');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Bootstrap networks (always) + maybe an inbound room from /:roomId.
  useEffect(() => {
    void (async () => {
      try {
        const [nRes, rRes] = await Promise.all([
          fetch(`${API}/api/cinema-network-room/networks`),
          fetch(`${API}/api/cinema-network-room/rooms`),
        ]);
        const nJson = await nRes.json();
        const rJson = await rRes.json();
        setNetworks(nJson.networks || []);
        setRooms(rJson.rows || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load networks');
      }
    })();
  }, []);

  // QR-code / share-link attribution: if `?ref=AMBASSADOR_ID` is in the
  // URL we ping the backend so the ambassador gets credit for this view.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref || !roomId) return;
    void fetch(`${API}/api/cinema-network-room/rooms/${roomId}/track-ref`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambassador_ref: ref, viewer_user_id: localStorage.getItem('user_id') || undefined }),
    }).catch(() => { /* non-fatal — attribution is best-effort */ });
  }, [roomId, searchParams]);

  // When we hit /free-tv/:roomId, fetch + open the WS.
  useEffect(() => {
    if (!roomId) {
      setActiveRoom(null);
      return;
    }
    void joinRoom(roomId);
    return () => closeSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function joinRoom(rid: string) {
    try {
      const res = await fetch(`${API}/api/cinema-network-room/rooms/${rid}`);
      if (!res.ok) throw new Error('Room not found');
      const room: Room = await res.json();
      setActiveRoom(room);
      setAudience(room.audience_count || 0);
      openSocket(rid);
    } catch (e: any) {
      setError(e?.message || 'Failed to join room');
    }
  }

  function openSocket(rid: string) {
    closeSocket();
    const ws = new WebSocket(`${WS_BASE}/api/cinema-network-room/ws/${rid}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const action: string = msg.action;
        const payload = msg.payload || {};
        if (action === 'SNAPSHOT_DELIVERY' || action === 'NETWORK_SOURCE_MUTATION') {
          setActiveRoom((prev) => prev ? {
            ...prev,
            active_network: payload.active_network || prev.active_network,
            channel_id: payload.channel_id || prev.channel_id,
          } : prev);
          if (payload.playback_state) setPlaybackState(payload.playback_state);
        } else if (action === 'PLAYBACK_STATE_CHANGE' || action === 'SCRUB_TO_MARKER') {
          if (payload.playback_state) setPlaybackState(payload.playback_state);
        } else if (action === 'AUDIENCE_UPDATE') {
          setAudience(payload.count || 0);
        } else if (action === 'CHAT_MESSAGE') {
          setChat((c) => [...c.slice(-49), {
            id: `${Date.now()}_${Math.random()}`,
            user_id: payload.user_id || 'anon',
            text: payload.text || '',
          }]);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => setError('Live sync connection error');
  }

  function closeSocket() {
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
  }

  function sendSocket(action: string, payload: Record<string, unknown>) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action, payload, originating_agent_uuid: agentId }));
  }

  async function createRoom(network_id: string, channel_id: string) {
    setCreating(true);
    setError(null);
    try {
      const inboundRef = searchParams.get('ref') || undefined;
      const res = await fetch(`${API}/api/cinema-network-room/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_user_id: localStorage.getItem('user_id') || agentId,
          name: `${network_id} · ${channel_id}`,
          active_network: network_id,
          channel_id,
          is_private: false,
          ambassador_ref: inboundRef,
        }),
      });
      if (!res.ok) throw new Error('Could not create room');
      const room: Room = await res.json();
      navigate(`/free-tv/${room.room_id}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }

  function switchChannel(network_id: string, channel_id: string) {
    sendSocket('NETWORK_SOURCE_MUTATION', { active_network: network_id, channel_id });
  }

  function togglePlay() {
    const next = playbackState === 'SYNCHRONIZED_RUNNING'
      ? 'SYNCHRONIZED_PAUSED'
      : 'SYNCHRONIZED_RUNNING';
    setPlaybackState(next);
    sendSocket('PLAYBACK_STATE_CHANGE', {
      playback_state: next,
      current_time_marker: activeRoom?.last_state?.current_time_marker || 0,
    });
  }

  function sendChat() {
    const text = chatDraft.trim();
    if (!text) return;
    sendSocket('CHAT_MESSAGE', { text });
    setChatDraft('');
  }

  const activeNetwork = useMemo(() => {
    if (!activeRoom) return null;
    return networks.find((n) => n.network_id === activeRoom.active_network) || null;
  }, [activeRoom, networks]);

  const activeChannel = useMemo(() => {
    if (!activeRoom || !activeNetwork) return null;
    return activeNetwork.channels.find((c) => c.channel_id === activeRoom.channel_id) || null;
  }, [activeRoom, activeNetwork]);

  const embedUrl = useMemo(() => {
    if (!activeNetwork || !activeRoom) return null;
    if (activeNetwork.network_id === 'YOUTUBE') {
      // YouTube iframe API — autoplay synced.
      return `${activeNetwork.embed_base}${activeRoom.channel_id}?autoplay=${playbackState === 'SYNCHRONIZED_RUNNING' ? 1 : 0}&rel=0`;
    }
    if (activeNetwork.embed_mode === 'iframe' || activeNetwork.embed_mode === 'hybrid') {
      return `${activeNetwork.embed_base}${activeRoom.channel_id}`;
    }
    return null;
  }, [activeNetwork, activeRoom, playbackState]);

  const externalUrl = useMemo(() => {
    if (!activeNetwork || !activeRoom) return null;
    if (activeNetwork.network_id === 'YOUTUBE') {
      return `${activeNetwork.external_base}${activeRoom.channel_id}`;
    }
    return `${activeNetwork.external_base}/${activeRoom.channel_id}`;
  }, [activeNetwork, activeRoom]);

  const shareUrl = activeRoom
    ? `${window.location.origin}/free-tv/${activeRoom.room_id}?ref=${encodeURIComponent(activeRoom.ambassador_ref || agentId)}`
    : '';

  async function copyShare() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); } catch { /* noop */ }
  }

  // ────────────────────────────────────────────── LOBBY view ──
  if (!activeRoom) {
    return (
      <div data-testid="free-tv-lobby" className="min-h-screen bg-[#06070b] text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-red-500/10 blur-[120px]" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-amber-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-5 py-8">
          <BackButton to="/dashboard" label="Back to Galaxy" />

          <header className="mt-6 mb-12">
            <div className="flex items-center gap-3 mb-3">
              <RadioTower className="w-7 h-7 text-amber-300" />
              <span className="uppercase tracking-[0.35em] text-xs text-amber-200/80">
                Free TV · Watch Party
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.05]">
              <span className="block text-white/95">Free Networks.</span>
              <span className="block bg-gradient-to-r from-red-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent">
                Synced for the whole crew.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-white/70 text-base">
              Pluto · Tubi · Plex · YouTube — frame-accurate watch parties.
              Networks keep their own ads. You and your crew stay in sync.
            </p>
          </header>

          {error && (
            <div data-testid="free-tv-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Network grid */}
          <section data-testid="free-tv-network-grid" className="mb-12">
            <h2 className="text-lg font-medium text-white/85 mb-5">Pick a network to start a room</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {networks.map((n, idx) => (
                <motion.button
                  key={n.network_id}
                  data-testid={`free-tv-network-${n.network_id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.45 }}
                  onClick={() => createRoom(n.network_id, n.channels[0].channel_id)}
                  disabled={creating}
                  className="group relative rounded-2xl overflow-hidden ring-1 ring-white/10 hover:ring-white/30 bg-gradient-to-br from-[#0c0a14] to-[#15080a] p-6 text-left transition-all"
                  style={{ boxShadow: `0 0 60px -25px ${n.brand_color}` }}
                >
                  <div
                    className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ background: `radial-gradient(circle at top right, ${n.brand_color}, transparent 60%)` }}
                  />
                  <div
                    className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: n.brand_color, color: '#0a0a0a' }}
                  >
                    <Tv className="w-6 h-6" />
                  </div>
                  <div className="relative text-2xl font-light">{n.label}</div>
                  <div className="relative text-[10px] uppercase tracking-widest text-white/40 mt-1">
                    {n.kind} · {n.channels.length} channels
                  </div>
                  <p className="relative text-sm text-white/65 mt-3 min-h-[2.5rem]">{n.description}</p>
                  <div className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: n.brand_color }}>
                    Start watching <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Open rooms */}
          {rooms.length > 0 && (
            <section data-testid="free-tv-open-rooms" className="mb-12">
              <h2 className="text-lg font-medium text-white/85 mb-5">Live rooms · join in</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((r) => (
                  <button
                    key={r.room_id}
                    data-testid={`free-tv-room-${r.room_id}`}
                    onClick={() => navigate(`/free-tv/${r.room_id}`)}
                    className="text-left rounded-xl bg-white/5 ring-1 ring-white/10 hover:ring-amber-300/40 p-5 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-widest text-amber-200/80">{r.active_network}</span>
                      <span className="flex items-center gap-1 text-xs text-emerald-300">
                        <Users className="w-3.5 h-3.5" /> {r.audience_count}
                      </span>
                    </div>
                    <div className="text-lg font-light truncate">{r.name}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">{r.channel_id}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────── ROOM view ──
  return (
    <div data-testid="free-tv-room" className="min-h-screen bg-[#06070b] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <BackButton to="/free-tv" label="All networks" />
          <div className="flex items-center gap-3 text-sm">
            <span data-testid="free-tv-audience" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 px-3 py-1.5 text-emerald-200">
              <Users className="w-4 h-4" /> {audience} watching
            </span>
            <button
              data-testid="free-tv-copy-share"
              onClick={copyShare}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/15 hover:ring-amber-300/40 px-3 py-1.5"
            >
              <Copy className="w-4 h-4" /> Share
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Player + controls */}
          <div>
            <div
              data-testid="free-tv-player"
              className="relative rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black aspect-video shadow-[0_0_80px_-15px_rgba(251,191,36,0.25)]"
            >
              {embedUrl ? (
                <iframe
                  title={`${activeNetwork?.label} · ${activeChannel?.name}`}
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div data-testid="free-tv-external-fallback" className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
                  <Tv className="w-12 h-12 text-amber-300" />
                  <div className="text-xl font-light">
                    {activeNetwork?.label} blocks in-app framing
                  </div>
                  <p className="text-sm text-white/60 max-w-md">
                    {activeNetwork?.label}&apos;s site can&apos;t be embedded directly (their content
                    security policy). Launch it in a new tab — your room stays in sync.
                  </p>
                  <a
                    href={externalUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-black px-5 py-2.5 text-sm font-semibold"
                  >
                    <ExternalLink className="w-4 h-4" /> Open on {activeNetwork?.label}
                  </a>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3 text-sm">
              <button
                data-testid="free-tv-play-toggle"
                onClick={togglePlay}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/15 hover:ring-amber-300/40 px-4 py-2"
              >
                {playbackState === 'SYNCHRONIZED_RUNNING' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playbackState === 'SYNCHRONIZED_RUNNING' ? 'Pause room' : 'Resume room'}
              </button>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/15 hover:ring-amber-300/40 px-4 py-2"
                >
                  <ExternalLink className="w-4 h-4" /> Open on {activeNetwork?.label}
                </a>
              )}
            </div>

            {/* Channel switcher */}
            <section className="mt-6">
              <h2 className="text-lg font-medium text-white/85 mb-3">
                Channels · {activeNetwork?.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="free-tv-channel-grid">
                {activeNetwork?.channels.map((c) => (
                  <button
                    key={c.channel_id}
                    data-testid={`free-tv-channel-${c.channel_id}`}
                    onClick={() => switchChannel(activeNetwork.network_id, c.channel_id)}
                    className={`text-left rounded-lg p-3 ring-1 transition-all ${
                      c.channel_id === activeRoom.channel_id
                        ? 'bg-amber-500/15 ring-amber-300/60'
                        : 'bg-white/5 ring-white/10 hover:ring-white/30'
                    }`}
                  >
                    <div className="text-sm font-light truncate">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1 flex items-center gap-1">
                      {c.live && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                      {c.genre}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Network switcher */}
            <section className="mt-6">
              <h2 className="text-lg font-medium text-white/85 mb-3">Switch network</h2>
              <div className="flex flex-wrap gap-2">
                {networks.map((n) => (
                  <button
                    key={n.network_id}
                    data-testid={`free-tv-switch-${n.network_id}`}
                    onClick={() => switchChannel(n.network_id, n.channels[0].channel_id)}
                    className={`rounded-full px-4 py-1.5 text-sm ring-1 transition-all ${
                      n.network_id === activeRoom.active_network
                        ? 'ring-white/40 bg-white/10'
                        : 'ring-white/10 hover:ring-white/30 bg-white/5'
                    }`}
                    style={n.network_id === activeRoom.active_network ? { color: n.brand_color } : {}}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Chat side panel */}
          <aside data-testid="free-tv-chat" className="rounded-2xl ring-1 ring-white/10 bg-white/[0.03] backdrop-blur-md flex flex-col max-h-[640px]">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-medium">Room chat</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
              <AnimatePresence initial={false}>
                {chat.map((line) => (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-white/85"
                  >
                    <span className="text-amber-300 mr-1.5">{line.user_id.slice(0, 8)}:</span>
                    {line.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              {chat.length === 0 && (
                <p className="text-white/40 text-xs">Say hi — your crew sees it in real time.</p>
              )}
            </div>
            <div className="px-3 py-3 border-t border-white/10 flex gap-2">
              <input
                data-testid="free-tv-chat-input"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder="Send a message…"
                className="flex-1 rounded-full bg-black/40 ring-1 ring-white/10 focus:ring-amber-300/40 focus:outline-none px-3 py-1.5 text-sm"
              />
              <button
                data-testid="free-tv-chat-send"
                onClick={sendChat}
                className="rounded-full bg-amber-500 text-black px-3 py-1.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>

        {/* Spawn new room CTA */}
        <div className="mt-8 text-center">
          <button
            data-testid="free-tv-new-room-btn"
            onClick={() => navigate('/free-tv')}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Spawn a new watch party
          </button>
        </div>
      </div>
    </div>
  );
}
