import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Bot, Copy, CheckCircle, Loader2 } from 'lucide-react';
import { apiGet, apiPost, getCurrentUser } from '../vibe654/api';

export type CardMpGame = 'euchre' | 'pinochle';

interface CardMpRoom {
  room_id: string;
  room_code: string;
  room_name: string;
  game_type: CardMpGame;
  status: 'WAITING' | 'PLAYING' | 'COMPLETED';
  buy_in: number;
  occupied: number;
  max_seats: number;
  host_user_id: string;
}

interface Props {
  open: boolean;
  game: CardMpGame;
  onClose: () => void;
  /** Route to jump to with ``?room=<id>`` query once the host seats everyone. */
  playRoute: string;
}

/**
 * Universal lobby modal for the Card Multiplayer backend.
 *
 * Lets you create a new 4-seat room for Euchre or Pinochle, refresh the
 * active-rooms list, fill open seats with bots, and launch into the AAA
 * game page in multiplayer mode (``?room=<id>``).
 */
export const CardMpLobbyModal: React.FC<Props> = ({ open, game, onClose, playRoute }) => {
  const navigate = useNavigate();
  const { userId, userName } = getCurrentUser();

  const [rooms, setRooms] = useState<CardMpRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>(`${game.charAt(0).toUpperCase()}${game.slice(1)} Room`);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ rooms: CardMpRoom[] }>(`/api/card-multiplayer/rooms?game_type=${game}`);
      setRooms(data.rooms || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const i = setInterval(refresh, 4000);
    return () => clearInterval(i);
  }, [open, game]);

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost<{ room: { room_id: string; room_code: string } }>(
        '/api/card-multiplayer/create-room',
        {
          game_type: game,
          host_user_id: userId,
          host_user_name: userName,
          room_name: roomName,
        },
      );
      // Auto-jump to the room
      navigate(`${playRoute}?room=${data.room.room_id}`);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (room: CardMpRoom) => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/card-multiplayer/room/${room.room_id}/join`, {
        user_id: userId,
        user_name: userName,
      });
      navigate(`${playRoute}?room=${room.room_id}`);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Join failed');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={onClose}
          data-testid={`card-mp-lobby-${game}`}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-cyan-400/30 rounded-2xl p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-cyan-300" />
                <h3 className="text-xl font-black tracking-wide">
                  {game.charAt(0).toUpperCase() + game.slice(1)} · Multiplayer Lobby
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="opacity-70 hover:opacity-100"
                data-testid={`card-mp-lobby-close`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create new */}
            <div className="rounded-xl bg-black/40 border border-white/10 p-4 mb-4">
              <p className="text-xs uppercase tracking-widest text-cyan-200/80 mb-2">Create a new room</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Room name"
                  data-testid="card-mp-room-name-input"
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={createRoom}
                  disabled={busy}
                  data-testid="card-mp-create-room"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Create
                </button>
              </div>
            </div>

            {/* Room list */}
            <div className="rounded-xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <p className="text-xs uppercase tracking-widest text-cyan-200/80">Open rooms</p>
                {loading && <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {rooms.length === 0 && !loading && (
                  <div className="p-4 text-center text-white/50 text-sm">
                    No open rooms. Create one above to get started.
                  </div>
                )}
                {rooms.map((r) => {
                  const full = r.occupied >= r.max_seats;
                  return (
                    <div
                      key={r.room_id}
                      className="flex items-center justify-between px-4 py-3"
                      data-testid={`card-mp-room-${r.room_id}`}
                    >
                      <div>
                        <div className="font-bold text-sm">{r.room_name}</div>
                        <div className="text-xs text-white/60 flex items-center gap-2">
                          {r.room_code}
                          <button
                            type="button"
                            onClick={() => copyCode(r.room_code)}
                            className="opacity-70 hover:opacity-100"
                            title="Copy code"
                          >
                            {copied === r.room_code ? (
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          · Seats {r.occupied}/{r.max_seats} · {r.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={full || busy}
                        onClick={() => joinRoom(r)}
                        data-testid={`card-mp-join-${r.room_id}`}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm disabled:opacity-40"
                      >
                        {full ? 'Full' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-rose-300" data-testid="card-mp-error">
                {error}
              </p>
            )}

            <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40 text-center">
              <Bot className="w-3 h-3 inline mr-1" /> Tip: missing players? Once inside, click{' '}
              <strong className="text-cyan-200">Fill With Bots</strong> to start immediately.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardMpLobbyModal;
