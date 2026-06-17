/**
 * DominoesMP — quick live-multiplayer Block Dominoes lobby + game.
 *
 * MVP scope: room create / join via /api/dominoes-mp/rooms/{create,list},
 * WebSocket play loop on /api/dominoes-mp/ws/{room_id}. Reuses the
 * DominoTile component from the AI room so visuals match.
 *
 * Connection states:
 *   • lobby  — show open rooms + "Create Room" button
 *   • waiting— sent join, waiting for opponent
 *   • game   — both seats filled, playing
 *   • over   — opponent left or match finished
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Plus, Users, Wifi, X } from "lucide-react";
import { toast } from "sonner";
import DominoTile from "@/components/dominoes/DominoTile";

const API = process.env.REACT_APP_BACKEND_URL;

interface DominoTileData { id: string; left: number; right: number; }
interface PlayerData { hand?: DominoTileData[]; hand_count: number; playable?: Record<string, { left: boolean; right: boolean; any: boolean }>; }
interface MPState {
  room_id: string;
  your_pos: string;
  seats: Record<string, string>;
  phase: "playing" | "round_over" | "finished";
  current_turn: string;
  scores: Record<string, number>;
  chain: DominoTileData[];
  left_end: number | null;
  right_end: number | null;
  boneyard_count: number;
  players_data: Record<string, PlayerData>;
}

export default function DominoesMP() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "connecting" | "waiting" | "game" | "over">("lobby");
  const [rooms, setRooms] = useState<Array<{ room_id: string; players: number; host: string | null }>>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [state, setState] = useState<MPState | null>(null);
  const [chat, setChat] = useState<Array<{ user: string; text: string; t: number }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);

  const username = (typeof window !== "undefined" ? localStorage.getItem("user_name") : null) || "Player";
  const userId = (typeof window !== "undefined" ? localStorage.getItem("user_id") : null) || `u_${Math.random().toString(36).slice(2, 10)}`;

  const refreshRooms = useCallback(async () => {
    const res = await fetch(`${API}/api/dominoes-mp/rooms`);
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms ?? []);
    }
  }, []);

  useEffect(() => {
    if (phase === "lobby") {
      void refreshRooms();
      const t = window.setInterval(refreshRooms, 4000);
      return () => window.clearInterval(t);
    }
  }, [phase, refreshRooms]);

  const connect = useCallback((rid: string) => {
    setPhase("connecting");
    setRoomId(rid);
    const wsUrl = `${API}/api/dominoes-mp/ws/${rid}?user_id=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`
      .replace(/^http/, "ws");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setPhase("waiting");
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      switch (data.type) {
        case "state":
          setState(data.game);
          setPhase("game");
          break;
        case "round_start":
          toast.success("Round started · highest double leads");
          break;
        case "match_over":
          toast.success(`Match over · ${data.match_winner} wins`);
          setPhase("over");
          break;
        case "opponent_left":
          toast.info("Opponent left the room");
          setPhase("over");
          break;
        case "player_joined":
          toast.message(`${data.username} sat at ${data.seat}`);
          break;
        case "chat":
          setChat((prev) => [...prev.slice(-49), { user: data.username, text: data.text, t: Date.now() }]);
          break;
        case "error":
          toast.error(data.detail);
          break;
        case "waiting":
          setPhase("waiting");
          break;
      }
    };
    ws.onclose = () => {
      setPhase("over");
      wsRef.current = null;
    };
    ws.onerror = () => toast.error("WebSocket error");
  }, [userId, username]);

  const createRoom = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/dominoes-mp/rooms/create`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        connect(data.room_id);
      }
    } finally { setBusy(false); }
  }, [connect]);

  const send = useCallback((msg: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const playTile = (tile: DominoTileData) => {
    if (!state) return;
    const me = state.players_data[state.your_pos];
    const playable = me?.playable?.[tile.id];
    if (!playable?.any) return;
    const side = playable.left ? "left" : "right";
    send({ type: "play", tile_id: tile.id, side });
  };

  const drawOrPass = (action: "draw" | "pass") => send({ type: action });
  const sendChat = () => {
    if (!chatInput.trim()) return;
    send({ type: "chat", text: chatInput });
    setChatInput("");
  };

  const leave = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setPhase("lobby");
    setState(null);
  };

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  // ─── UI ──────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#050614] text-white px-4 py-6" data-testid="dominoes-mp-lobby">
        <button onClick={() => navigate("/dominoes")} className="text-indigo-300/70 hover:text-white text-xs font-bold mb-3 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.55)]"><Users className="w-7 h-7 text-white" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>Live · Multiplayer</p>
              <h1 className="text-2xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>Dominoes Arena</h1>
            </div>
          </div>
          <button onClick={createRoom} disabled={busy} data-testid="dominoes-mp-create-btn" className="w-full mb-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:to-fuchsia-400 text-white font-black uppercase tracking-widest text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> {busy ? "Creating…" : "Create Room"}
          </button>
          <p className="text-xs uppercase tracking-[0.25em] text-indigo-300/70 font-bold mb-2">Open Rooms</p>
          {rooms.length === 0 ? (
            <p className="text-indigo-100/50 text-sm text-center py-6" data-testid="dominoes-mp-rooms-empty">No open rooms — be the first.</p>
          ) : (
            <div className="space-y-1.5" data-testid="dominoes-mp-rooms-list">
              {rooms.map((r) => (
                <button key={r.room_id} onClick={() => connect(r.room_id)} className="w-full p-3 rounded-xl bg-white/[0.03] border border-indigo-400/20 hover:bg-white/[0.06] flex items-center justify-between" data-testid={`dominoes-mp-room-${r.room_id}`}>
                  <div className="text-left">
                    <p className="font-mono text-indigo-200 text-sm">#{r.room_id}</p>
                    <p className="text-xs text-indigo-100/60">{r.host ?? "open"} · {r.players}/2</p>
                  </div>
                  <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Join</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "connecting" || phase === "waiting") {
    return (
      <div className="min-h-screen bg-[#050614] text-white flex flex-col items-center justify-center px-4 gap-4" data-testid="dominoes-mp-waiting">
        <div className="relative">
          <Wifi className="w-16 h-16 text-indigo-400 animate-pulse" />
          <Loader2 className="w-8 h-8 absolute -bottom-1 -right-1 text-fuchsia-400 animate-spin" />
        </div>
        <p className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: "'Cinzel', serif" }}>
          {phase === "connecting" ? "Connecting…" : "Waiting for Opponent"}
        </p>
        <p className="text-xs text-indigo-300 font-mono">Room {roomId}</p>
        <button onClick={leave} className="mt-4 text-rose-300 text-xs font-bold uppercase tracking-widest hover:text-rose-200 inline-flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="min-h-screen bg-[#050614] text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-2xl font-black" style={{ fontFamily: "'Cinzel', serif" }}>Match Closed</p>
        <button onClick={leave} className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold" data-testid="dominoes-mp-back-to-lobby">Back to Lobby</button>
      </div>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────
  if (!state) return null;
  const me = state.players_data[state.your_pos];
  const isMyTurn = state.current_turn === state.your_pos;
  const playableMap = me?.playable ?? {};
  const myHand = me?.hand ?? [];
  const oppPos = state.your_pos === "south" ? "north" : "south";
  const oppCount = state.players_data[oppPos]?.hand_count ?? 0;
  const oppName = state.seats[oppPos] ?? "Opponent";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0820] to-[#02030a] text-white px-3 py-3" data-testid="dominoes-mp-game">
      <div className="flex items-center justify-between mb-3">
        <button onClick={leave} className="text-indigo-300/70 hover:text-white text-xs font-bold flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Leave</button>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 font-mono">#{state.room_id}</span>
          <span className="px-2 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-400/40">vs {oppName}</span>
        </div>
      </div>

      {/* Opponent strip */}
      <div className="text-center mb-2" data-testid="dominoes-mp-opponent">
        <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-black">{oppName} · {oppCount} tiles</p>
        <div className="flex justify-center gap-0.5 mt-1.5">
          {Array.from({ length: oppCount }).map((_, i) => (
            <div key={i} className="w-3 h-6 rounded-sm bg-gradient-to-b from-indigo-700 to-slate-900 border border-indigo-400/30" />
          ))}
        </div>
      </div>

      {/* Chain */}
      <div className="my-4 px-3 py-3 rounded-2xl bg-white/[0.03] border border-indigo-400/20 overflow-x-auto">
        {state.chain.length === 0 ? (
          <p className="text-indigo-300/50 text-xs text-center py-3 uppercase tracking-widest">Place the highest double…</p>
        ) : (
          <div className="flex items-center gap-1.5 justify-center min-w-max">
            <span className="text-xs font-mono text-indigo-300">◀{state.left_end}</span>
            {state.chain.map((t) => (
              <DominoTile key={t.id} left={t.left} right={t.right} size="sm" orientation={t.left === t.right ? "v" : "h"} />
            ))}
            <span className="text-xs font-mono text-indigo-300">{state.right_end}▶</span>
          </div>
        )}
      </div>

      {/* Status + actions */}
      <div className="text-center mb-3 text-sm font-bold">
        {isMyTurn ? <span className="text-emerald-300">Your turn</span> : <span className="text-rose-300">Opponent's turn</span>}
        <span className="text-indigo-100/50 mx-2">·</span>
        Boneyard <span className="font-mono">{state.boneyard_count}</span>
      </div>

      {isMyTurn ? (
        <div className="flex justify-center gap-2 mb-3">
          {!Object.values(playableMap).some((p) => p.any) && state.boneyard_count > 0 ? (
            <button onClick={() => drawOrPass("draw")} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-black text-xs uppercase tracking-widest" data-testid="dominoes-mp-draw-btn">
              Draw Tile
            </button>
          ) : null}
          {!Object.values(playableMap).some((p) => p.any) && state.boneyard_count === 0 ? (
            <button onClick={() => drawOrPass("pass")} className="px-4 py-2 rounded-lg bg-rose-500 text-white font-black text-xs uppercase tracking-widest" data-testid="dominoes-mp-pass-btn">
              Pass
            </button>
          ) : null}
        </div>
      ) : null}

      {/* My hand */}
      <div className="flex flex-wrap justify-center gap-1.5" data-testid="dominoes-mp-hand">
        {myHand.map((tile) => (
          <DominoTile
            key={tile.id}
            left={tile.left}
            right={tile.right}
            size="md"
            playable={isMyTurn && (playableMap[tile.id]?.any ?? false)}
            onClick={() => playTile(tile)}
            testId={`dominoes-mp-tile-${tile.id}`}
          />
        ))}
      </div>

      {/* Chat */}
      <div className="mt-5 max-w-md mx-auto">
        <div className="space-y-1 mb-2 max-h-32 overflow-y-auto" data-testid="dominoes-mp-chat">
          {chat.slice(-6).map((m) => (
            <p key={m.t} className="text-xs"><span className="text-fuchsia-300 font-bold">{m.user}</span>: {m.text}</p>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
            placeholder="Talk trash…"
            data-testid="dominoes-mp-chat-input"
            className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-indigo-400/20 text-sm text-white placeholder:text-white/30"
          />
          <button onClick={sendChat} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold" data-testid="dominoes-mp-chat-send">Send</button>
        </div>
      </div>
    </div>
  );
}
