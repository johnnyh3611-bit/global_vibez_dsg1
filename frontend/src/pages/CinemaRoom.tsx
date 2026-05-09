/**
 * /cinema-room — The Cinema Room (public, sync-watch).
 *
 * Distinct from the founder's user-content "Memory Bank Cinema" at
 * /dsg/memory-bank — this room hosts curated FREE legal content
 * (YouTube + Archive.org public domain) so visitors can drop in,
 * pick a flick, and watch with strangers/friends in real time.
 *
 * Design:
 *   • Lobby = browse/create rooms · pick a movie from the catalog.
 *   • Room  = synced YouTube IFrame OR HTML5 video, live audience
 *             count, in-room chat, "Order food" CTA → HungryVIBEZ.
 *   • Sync  = WebSocket broadcasts {action:'play'|'pause'|'seek',time}
 *             from any participant; backend persists last_state so
 *             late joiners get a snapshot on connect.
 *
 * No external SDKs needed — uses the YouTube IFrame Player API
 * directly (loaded once per session) and a native <video> tag for
 * Archive.org sources.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Film, Users, Plus, Send, Pizza, Play, Pause, Volume2, VolumeX,
  ArrowLeft, Loader2, Clapperboard, Lock, Heart,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = (API || "").replace(/^http/, "ws");

type CatalogItem = {
  id: string;
  title: string;
  year: number;
  duration_min: number;
  source: "youtube" | "archive_org";
  url: string;
  youtube_id: string | null;
  thumbnail: string;
  genre: string[];
  rating: string;
  license: string;
};

type Room = {
  room_id: string;
  host_id: string;
  name: string;
  content_id: string | null;
  is_private: boolean;
  is_date_night?: boolean;
  audience_count: number;
  created_at: number;
  last_state?: { action: string; time: number; ts?: number };
};

type ChatLine = { user_id: string; text: string; ts: number; kind?: "chat" | "food" };

// Load the YouTube IFrame API once.
let _ytReadyPromise: Promise<void> | null = null;
const loadYTApi = (): Promise<void> => {
  if (_ytReadyPromise) return _ytReadyPromise;
  _ytReadyPromise = new Promise((resolve) => {
    if ((window as unknown as { YT?: { Player: unknown } }).YT?.Player) {
      resolve();
      return;
    }
    (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return _ytReadyPromise;
};

// ─────────────────────────────────────────────────────────────────────
// Lobby
// ─────────────────────────────────────────────────────────────────────
export default function CinemaRoom() {
  const { roomId } = useParams<{ roomId?: string }>();
  if (!roomId) return <CinemaLobby />;
  return <CinemaScreen roomId={roomId} />;
}

function CinemaLobby() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Friday Night Flix");
  const [contentId, setContentId] = useState<string>("");
  const [dateNight, setDateNight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, rRes] = await Promise.all([
          fetch(`${API}/api/cinema-room/catalog`),
          fetch(`${API}/api/cinema-room/rooms`),
        ]);
        const c = await cRes.json();
        const r = await rRes.json();
        setCatalog(c.items || []);
        setRooms(r.rows || []);
        if (c.items?.length) setContentId(c.items[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const createRoom = async () => {
    setCreating(true); setError(null);
    try {
      const userId = localStorage.getItem("user_id") || `guest_${Date.now()}`;
      const r = await authFetch(`${API}/api/cinema-room/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          content_id: contentId || null,
          host_id: userId,
          is_private: dateNight,           // date night is auto-private
          is_date_night: dateNight,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      const room = await r.json();
      navigate(`/cinema-room/${room.room_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create room");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05050a] text-white" data-testid="cinema-room-lobby">
      <header className="px-4 py-5 border-b border-white/10 flex items-center justify-between max-w-7xl mx-auto">
        <button onClick={() => navigate("/dashboard")} className="text-cyan-300 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl md:text-2xl font-black tracking-wider flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-fuchsia-400" /> The Cinema Room
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-white/40 hidden sm:block">Public · Free</span>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-[2fr,1fr] gap-8">
        {/* Catalog */}
        <section data-testid="cinema-room-catalog">
          <h2 className="text-sm uppercase tracking-widest text-cyan-300 mb-3">
            Pick tonight&apos;s flick
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-white/50"><Loader2 className="w-4 h-4 animate-spin" /> Loading catalog…</div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {catalog.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setContentId(it.id)}
                  data-testid={`cinema-content-${it.id}`}
                  className={`relative rounded-xl overflow-hidden text-left border-2 transition ${
                    contentId === it.id ? "border-fuchsia-400 shadow-[0_0_24px_-6px_rgba(217,70,239,0.6)]" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={it.thumbnail} alt={it.title} className="w-full aspect-video object-cover" loading="lazy" />
                  <div className="p-2 bg-black/70">
                    <div className="text-xs font-black truncate">{it.title}</div>
                    <div className="text-[10px] text-white/50 flex items-center gap-1.5 mt-0.5">
                      <span>{it.year}</span> · <span>{it.duration_min}m</span> · <span>{it.rating}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Create + Active rooms */}
        <aside className="space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/5 border border-white/10 p-4">
            <h3 className="text-sm uppercase tracking-widest text-fuchsia-300 mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Open a room
            </h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="cinema-create-name"
              className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm placeholder-white/30 mb-2"
              placeholder="Room name"
              maxLength={60}
            />
            <p className="text-[10px] text-white/40 mb-2">
              Selected: <span className="text-white/70">{catalog.find(c => c.id === contentId)?.title || "—"}</span>
            </p>
            {/* Date Night Mode — turns the room into a warm-themed
                two-person private link with audience hidden. Ideal
                for second / third dates from the Dating Universe. */}
            <label
              data-testid="cinema-date-night-toggle"
              className={`flex items-center gap-2 cursor-pointer rounded-lg p-2 mb-2 border transition ${
                dateNight ? "bg-rose-500/15 border-rose-400/40" : "bg-black/30 border-white/10 hover:border-rose-400/30"
              }`}
            >
              <input
                type="checkbox"
                checked={dateNight}
                onChange={(e) => setDateNight(e.target.checked)}
                className="accent-rose-400"
                data-testid="cinema-date-night-checkbox"
              />
              <Heart className={`w-4 h-4 ${dateNight ? "text-rose-300 fill-rose-300" : "text-white/40"}`} />
              <span className="text-xs">
                <span className={`block font-black ${dateNight ? "text-rose-200" : "text-white/80"}`}>
                  Date Night Mode
                </span>
                <span className="block text-[10px] text-white/50">
                  Just the two of you · private · audience hidden
                </span>
              </span>
            </label>
            <button
              onClick={createRoom}
              disabled={creating || !name.trim()}
              data-testid="cinema-create-btn"
              className="w-full px-4 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-400 hover:to-violet-500 text-white font-black uppercase tracking-wider text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
              Open Room
            </button>
            {error && <p className="text-rose-300 text-xs mt-2">{error}</p>}
          </div>

          <div data-testid="cinema-rooms-list">
            <h3 className="text-sm uppercase tracking-widest text-cyan-300 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Live rooms
            </h3>
            {rooms.length === 0 ? (
              <p className="text-xs text-white/40 italic">No live rooms yet — be the first to open one.</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((r) => {
                  const movie = catalog.find(c => c.id === r.content_id);
                  return (
                    <li key={r.room_id}>
                      <button
                        onClick={() => navigate(`/cinema-room/${r.room_id}`)}
                        data-testid={`cinema-room-card-${r.room_id}`}
                        className="w-full text-left rounded-lg p-3 bg-black/40 border border-white/10 hover:border-fuchsia-400/40 transition flex items-center gap-3"
                      >
                        {movie && <img src={movie.thumbnail} alt="" className="w-16 h-10 object-cover rounded" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{r.name}</div>
                          <div className="text-[10px] text-white/40 truncate">{movie?.title || "—"}</div>
                        </div>
                        <div className="text-[10px] text-cyan-300 font-mono flex items-center gap-1">
                          <Users className="w-3 h-3" /> {r.audience_count}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Room screen
// ─────────────────────────────────────────────────────────────────────
function CinemaScreen({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [content, setContent] = useState<CatalogItem | null>(null);
  const [audience, setAudience] = useState(1);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const ytPlayerRef = useRef<unknown>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isApplyingRemoteRef = useRef(false);

  const userId = (typeof localStorage !== "undefined" && localStorage.getItem("user_id")) || `guest_${roomId.slice(-4)}`;

  // Load the room + content metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rR, cR] = await Promise.all([
          fetch(`${API}/api/cinema-room/rooms/${roomId}`),
          fetch(`${API}/api/cinema-room/catalog`),
        ]);
        if (!rR.ok) throw new Error("Room not found");
        const rJ: Room = await rR.json();
        const cJ = await cR.json();
        if (cancelled) return;
        setRoom(rJ);
        setAudience(rJ.audience_count || 1);
        const item = cJ.items?.find((it: CatalogItem) => it.id === rJ.content_id) || null;
        setContent(item);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load room");
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Connect the sync socket
  useEffect(() => {
    if (!room) return;
    const ws = new WebSocket(`${WS_BASE}/api/cinema-room/ws/${roomId}`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.action === "audience") setAudience(msg.count);
        else if (msg.action === "chat") setChat((c) => [...c.slice(-50), { user_id: msg.user_id, text: msg.text, ts: msg.ts }]);
        else if (msg.action === "food_order") setChat((c) => [...c.slice(-50), { user_id: msg.user_id, text: `is ordering food${msg.item_hint ? `: ${msg.item_hint}` : ""}`, ts: Date.now() / 1000, kind: "food" }]);
        else if (msg.action === "snapshot") {
          // Late join — re-sync to last_state if any.
          if (msg.last_state) applyRemote(msg.last_state.action, msg.last_state.time);
        } else if (["play", "pause", "seek"].includes(msg.action)) {
          applyRemote(msg.action, msg.time);
        } else if (msg.action === "pick" && msg.content_id) {
          // Host picked a different movie — reload content metadata.
          fetch(`${API}/api/cinema-room/catalog/${msg.content_id}`).then(r => r.json()).then((c) => setContent(c)).catch(() => undefined);
        }
      } catch { /* ignore */ }
    };
    return () => { ws.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.room_id, roomId]);

  // Initialize the YouTube player when content is YouTube.
  useEffect(() => {
    if (!content || content.source !== "youtube" || !content.youtube_id) return;
    let cancelled = false;
    let player: { destroy?: () => void } | null = null;
    loadYTApi().then(() => {
      if (cancelled) return;
      const YT = (window as unknown as { YT: { Player: new (el: HTMLElement, opts: unknown) => unknown } }).YT;
      if (!ytContainerRef.current) return;
      ytContainerRef.current.innerHTML = ""; // reset before remount
      const div = document.createElement("div");
      div.id = `yt-player-${roomId}`;
      ytContainerRef.current.appendChild(div);
      player = new YT.Player(div, {
        videoId: content.youtube_id,
        playerVars: { autoplay: 0, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (isApplyingRemoteRef.current) return;
            const p = e.target as { getCurrentTime: () => number };
            if (e.data === 1) sendSync("play", p.getCurrentTime());   // playing
            else if (e.data === 2) sendSync("pause", p.getCurrentTime()); // paused
          },
        },
      }) as { destroy?: () => void };
      ytPlayerRef.current = player;
    });
    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.youtube_id, content?.source, roomId]);

  const sendSync = useCallback((action: string, time: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, time }));
    }
  }, []);

  function applyRemote(action: string, time: number) {
    isApplyingRemoteRef.current = true;
    try {
      if (content?.source === "youtube" && ytPlayerRef.current) {
        const p = ytPlayerRef.current as {
          seekTo: (t: number, allow: boolean) => void;
          playVideo: () => void;
          pauseVideo: () => void;
        };
        if (action === "seek") p.seekTo(time, true);
        else if (action === "play") { p.seekTo(time, true); p.playVideo(); }
        else if (action === "pause") { p.seekTo(time, true); p.pauseVideo(); }
      } else if (videoRef.current) {
        const v = videoRef.current;
        if (action === "seek") v.currentTime = time;
        else if (action === "play") { v.currentTime = time; v.play().catch(() => undefined); }
        else if (action === "pause") { v.currentTime = time; v.pause(); }
      }
    } finally {
      // Release the flag after the player has had a chance to settle.
      setTimeout(() => { isApplyingRemoteRef.current = false; }, 350);
    }
  }

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "chat", user_id: userId, text }));
    }
    setChatDraft("");
  };

  const orderFood = async () => {
    try {
      await authFetch(`${API}/api/cinema-room/rooms/${roomId}/food-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, user_id: userId, item_hint: "Movie snacks" }),
      });
      // Open Hungry VIBEZ in a new tab so the room playback isn't interrupted.
      window.open("/hungryvibes", "_blank", "noopener,noreferrer");
    } catch { /* ignore */ }
  };

  if (error) return <div className="min-h-screen bg-black text-rose-300 flex items-center justify-center p-6">{error}</div>;
  if (!room || !content) return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const dateNight = !!room.is_date_night;
  const themeShell = dateNight
    ? "bg-gradient-to-br from-[#1a0510] via-[#0a0508] to-[#1a0510]"
    : "bg-black";
  const themeAside = dateNight ? "bg-[#180a14] border-rose-500/15" : "bg-[#0b0b14] border-white/5";
  const themeHeaderBorder = dateNight ? "border-rose-500/20" : "border-white/10";

  return (
    <div className={`min-h-screen text-white flex flex-col ${themeShell}`} data-testid="cinema-room-screen" data-date-night={dateNight ? "1" : "0"}>
      <header className={`px-4 py-3 border-b ${themeHeaderBorder} flex items-center justify-between bg-black/80 backdrop-blur`}>
        <button onClick={() => navigate("/cinema-room")} className="text-cyan-300 text-xs flex items-center gap-1.5" data-testid="cinema-back-to-lobby">
          <ArrowLeft className="w-4 h-4" /> Lobby
        </button>
        <div className="text-center min-w-0 flex-1 px-4">
          <h1 className="text-sm md:text-base font-black truncate flex items-center justify-center gap-2">
            {dateNight && <Heart className="w-4 h-4 text-rose-300 fill-rose-300" />}
            {room.name}
          </h1>
          <p className="text-[10px] text-white/40 truncate">{content.title} · {content.year} · {content.license}</p>
        </div>
        {dateNight ? (
          <span className="text-[10px] uppercase tracking-widest text-rose-200 font-mono flex items-center gap-1.5" data-testid="cinema-date-night-badge">
            <Heart className="w-3.5 h-3.5 fill-rose-300 text-rose-300" /> Date Night
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-cyan-300 font-mono flex items-center gap-1.5" data-testid="cinema-audience-count">
            <Users className="w-3.5 h-3.5" /> {audience}
          </span>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Player */}
        <section className="flex-1 min-h-0 flex flex-col bg-black">
          <div className="flex-1 relative" data-testid="cinema-player-shell">
            {content.source === "youtube" ? (
              <div ref={ytContainerRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" data-testid="cinema-player-yt" />
            ) : (
              <video
                ref={videoRef}
                src={content.url}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                controls
                muted={muted}
                playsInline
                onPlay={() => !isApplyingRemoteRef.current && videoRef.current && sendSync("play", videoRef.current.currentTime)}
                onPause={() => !isApplyingRemoteRef.current && videoRef.current && sendSync("pause", videoRef.current.currentTime)}
                onSeeked={() => !isApplyingRemoteRef.current && videoRef.current && sendSync("seek", videoRef.current.currentTime)}
                data-testid="cinema-player-archive"
              />
            )}
          </div>

          <div className="px-4 py-2 flex items-center justify-between bg-black border-t border-white/5">
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              className="text-white/70 hover:text-white text-xs flex items-center gap-1.5"
              data-testid="cinema-mute-btn"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted ? "Muted" : "Sound on"}
            </button>
            <button
              type="button"
              onClick={orderFood}
              data-testid="cinema-order-food-btn"
              className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition"
            >
              <Pizza className="w-3.5 h-3.5" /> Order Food
            </button>
          </div>
        </section>

        {/* Chat sidebar */}
        <aside className={`w-full lg:w-80 ${themeAside} border-l flex flex-col`} data-testid="cinema-chat">
          <div className={`px-3 py-2 border-b ${themeHeaderBorder} text-[10px] uppercase tracking-widest ${dateNight ? "text-rose-200" : "text-cyan-300"}`}>
            {dateNight ? "Just the two of you" : `Live chat · ${audience} watching`}
          </div>
          <ul className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
            {dateNight && (
              <li className="text-rose-200 italic flex items-start gap-2 pb-2 mb-1 border-b border-rose-500/15" data-testid="cinema-date-night-pinned-msg">
                <Heart className="w-3.5 h-3.5 mt-0.5 fill-rose-300 text-rose-300 shrink-0" />
                <span>🌹 Just the two of you. Sound on. Snacks ready. Press play.</span>
              </li>
            )}
            {chat.length === 0 && !dateNight && <li className="text-white/30 italic">No chats yet — say hi.</li>}
            {chat.map((c, i) => (
              <li key={`${c.ts}-${i}`} className={c.kind === "food" ? "text-amber-200" : (dateNight ? "text-rose-100" : "text-white/85")}>
                <span className={`${dateNight ? "text-rose-300/80" : "text-cyan-300/80"} font-mono mr-1.5`}>@{c.user_id.slice(0, 8)}</span>
                {c.text}
              </li>
            ))}
          </ul>
          <div className={`p-2 border-t ${themeHeaderBorder} flex gap-2`}>
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder={dateNight ? "Whisper something…" : "Say something…"}
              data-testid="cinema-chat-input"
              className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs placeholder-white/30"
              maxLength={300}
            />
            <button
              onClick={sendChat}
              data-testid="cinema-chat-send"
              className={`px-3 rounded-lg text-white ${dateNight ? "bg-rose-500 hover:bg-rose-400" : "bg-fuchsia-500 hover:bg-fuchsia-400"}`}
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
