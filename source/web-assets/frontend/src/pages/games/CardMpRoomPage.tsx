import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, Play, Loader2, Copy, CheckCircle } from 'lucide-react';
import { apiGet, apiPost, getCurrentUser } from '../../components/vibe654/api';

// ----- Types (engine-ish) ----------------------------------------------------
type Seat = 'north' | 'east' | 'south' | 'west';
const SEATS: Seat[] = ['south', 'west', 'north', 'east'];
const SEAT_POS: Record<Seat, string> = {
  south: 'bottom-6 left-1/2 -translate-x-1/2',
  north: 'top-6 left-1/2 -translate-x-1/2',
  east: 'right-6 top-1/2 -translate-y-1/2',
  west: 'left-6 top-1/2 -translate-y-1/2',
};

interface CardEntity {
  suit: string;
  rank: string;
  copy?: number;
}

interface EngineView {
  phase?: string;
  turn?: Seat;
  bid_turn?: Seat;
  dealer?: Seat;
  upcard?: CardEntity | null;
  trump?: string | null;
  hands?: Record<Seat, CardEntity[]>;
  trick?: Array<{ pos: Seat; card: CardEntity }>;
  scores?: Record<string, number>;
  legal?: CardEntity[];
  message?: string;
}

interface RoomPayload {
  room_id: string;
  room_code: string;
  room_name: string;
  game_type: 'euchre' | 'pinochle';
  status: 'WAITING' | 'PLAYING' | 'COMPLETED';
  host_user_id: string;
  seats: Record<Seat, { user_id: string; user_name: string; is_host?: boolean; is_bot?: boolean } | null>;
  engine?: EngineView;
}

const SUIT_GLYPH: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

// ----- Card component -------------------------------------------------------
const PlayingCard: React.FC<{ card: CardEntity; onClick?: () => void; disabled?: boolean; small?: boolean }> = ({
  card,
  onClick,
  disabled,
  small,
}) => {
  const red = card.suit === 'H' || card.suit === 'D';
  const glyph = SUIT_GLYPH[card.suit] ?? card.suit;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick || disabled}
      whileHover={onClick && !disabled ? { y: -6 } : {}}
      whileTap={onClick && !disabled ? { scale: 0.97 } : {}}
      data-testid={`card-${card.rank}${card.suit}${card.copy ?? ''}`}
      className={`relative ${small ? 'w-10 h-14' : 'w-14 h-20'} rounded-md border-2 bg-white shadow-md flex flex-col justify-between p-1 select-none ${
        red ? 'text-rose-600 border-rose-200' : 'text-slate-900 border-slate-300'
      } ${disabled ? 'opacity-40' : onClick ? 'cursor-pointer hover:shadow-xl' : ''}`}
    >
      <span className={`${small ? 'text-xs' : 'text-sm'} font-black leading-none`}>{card.rank}</span>
      <span className={`${small ? 'text-lg' : 'text-2xl'} leading-none text-right`}>{glyph}</span>
    </motion.button>
  );
};

// ----- Main page -----------------------------------------------------------
export default function CardMpRoomPage() {
  const { gameType, roomId } = useParams<{ gameType: 'euchre' | 'pinochle'; roomId: string }>();
  const navigate = useNavigate();
  const { userId, userName } = getCurrentUser();

  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [bidAmount, setBidAmount] = useState<number>(250);

  // ----- Polling ------------------------------------------------------------
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await apiGet<{ room: RoomPayload }>(`/api/card-multiplayer/room/${roomId}`);
      setRoom(data.room);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Room fetch failed');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
    const i = setInterval(fetchRoom, 2500);
    return () => clearInterval(i);
  }, [fetchRoom]);

  // ----- Derived ------------------------------------------------------------
  const mySeat: Seat | null = useMemo(() => {
    if (!room) return null;
    for (const s of SEATS) {
      if (room.seats[s]?.user_id === userId) return s;
    }
    return null;
  }, [room, userId]);

  const isHost = room?.host_user_id === userId;
  const engine = room?.engine;
  const myHand = mySeat && engine?.hands?.[mySeat] ? engine.hands[mySeat] : [];
  const legalSet = new Set(
    (engine?.legal ?? []).map((c) => `${c.rank}${c.suit}${c.copy ?? ''}`),
  );
  const myTurn = (engine?.turn === mySeat) || (engine?.bid_turn === mySeat);
  const phase = engine?.phase ?? (room?.status === 'WAITING' ? 'waiting' : 'unknown');

  // ----- Actions ------------------------------------------------------------
  const call = async (path: string, body: unknown = {}) => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(path, body);
      await fetchRoom();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const fillBots = () => call(`/api/card-multiplayer/room/${roomId}/fill-bots`);
  const startRoom = () => call(`/api/card-multiplayer/room/${roomId}/start`);
  const playCard = (c: CardEntity) => call(`/api/card-multiplayer/room/${roomId}/play-card`, { user_id: userId, card: c });
  const bid = (payload: Record<string, unknown>) =>
    call(`/api/card-multiplayer/room/${roomId}/bid`, { user_id: userId, ...payload });
  const nextHand = () => call(`/api/card-multiplayer/room/${roomId}/next-hand`);
  const copyCode = async () => {
    if (!room?.room_code) return;
    try {
      await navigator.clipboard.writeText(room.room_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // ----- Render -------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-black to-emerald-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-black to-emerald-950 text-white flex flex-col items-center justify-center gap-3">
        <p>Room not found.</p>
        <button onClick={() => navigate('/games')} className="px-4 py-2 bg-white/10 rounded">Back</button>
      </div>
    );
  }

  const backRoute = gameType === 'euchre' ? '/euchre' : '/pinochle';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-black to-emerald-900 text-white" data-testid={`card-mp-room-${gameType}`}>
      {/* header */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">{room.room_name}</h1>
          <p className="text-xs text-emerald-200/80 flex items-center gap-2">
            {gameType?.toUpperCase()} · code {room.room_code}
            <button type="button" onClick={copyCode} className="opacity-80 hover:opacity-100" data-testid="card-mp-copy-code">
              {codeCopied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            · {room.status}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(backRoute)}
            data-testid="card-mp-back"
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> AI Practice
          </button>
        </div>
      </div>

      {/* table */}
      <div className="relative max-w-5xl mx-auto px-4 pb-32">
        <div className="relative aspect-[4/3] bg-[radial-gradient(ellipse_at_center,_#0c3d33_0%,_#061a16_75%)] rounded-3xl border border-emerald-400/20 overflow-hidden shadow-2xl">
          {/* felt label */}
          <div className="absolute inset-6 rounded-full border border-emerald-400/10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.5em] text-emerald-200/60 mb-1">Phase</p>
              <p className="text-xl font-black capitalize" data-testid="card-mp-phase">
                {phase}
              </p>
              {engine?.trump && (
                <p className="text-sm mt-1">Trump: <span className="font-bold">{SUIT_GLYPH[engine.trump] ?? engine.trump}</span></p>
              )}
              {engine?.message && (
                <p className="text-xs mt-2 text-emerald-200/80 max-w-xs">{engine.message}</p>
              )}
              {/* center trick */}
              {engine?.trick && engine.trick.length > 0 && (
                <div className="flex gap-1 justify-center mt-3">
                  {engine.trick.map((t, i) => (
                    <PlayingCard key={`trick-${i}`} card={t.card} small />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* seats */}
          {SEATS.map((s) => {
            const occ = room.seats[s];
            const isActive = engine?.turn === s || engine?.bid_turn === s;
            const isMe = s === mySeat;
            return (
              <div key={s} className={`absolute ${SEAT_POS[s]}`} data-testid={`card-mp-seat-${s}`}>
                <div
                  className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex flex-col items-center justify-center text-center text-xs font-bold border-4 ${
                    isActive ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)]' : 'border-white/10'
                  } ${
                    isMe ? 'bg-gradient-to-br from-amber-600 to-orange-700' : occ?.is_bot ? 'bg-gradient-to-br from-fuchsia-700 to-indigo-900' : occ ? 'bg-gradient-to-br from-cyan-700 to-emerald-900' : 'bg-black/40'
                  }`}
                >
                  {occ ? (
                    <>
                      <span className="truncate max-w-[90%]">{occ.user_name}</span>
                      <span className="text-[10px] opacity-70">{s}{occ.is_bot ? ' · bot' : ''}</span>
                      {engine?.scores?.[s] !== undefined && (
                        <span className="text-amber-300 text-[10px] font-bold">{engine.scores[s]}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="opacity-50">empty</span>
                      <span className="text-[10px] opacity-40">{s}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Waiting-room controls */}
        {room.status === 'WAITING' && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {isHost && (
              <>
                <button
                  type="button"
                  onClick={fillBots}
                  disabled={busy}
                  data-testid="card-mp-fill-bots"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-bold disabled:opacity-50"
                >
                  <Bot className="w-4 h-4" /> Fill With Bots
                </button>
                <button
                  type="button"
                  onClick={startRoom}
                  disabled={busy}
                  data-testid="card-mp-start"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold disabled:opacity-50"
                >
                  <Play className="w-4 h-4" /> Start Hand
                </button>
              </>
            )}
            {!isHost && <p className="text-sm text-white/60 self-center">Waiting for host to fill seats and start…</p>}
          </div>
        )}

        {/* Bid controls */}
        {room.status === 'PLAYING' && engine?.phase === 'bidding' && myTurn && (
          <div className="mt-4 p-4 rounded-xl bg-black/60 border border-cyan-400/30">
            <p className="text-xs uppercase tracking-widest text-cyan-200 mb-2">Your Bid</p>
            {gameType === 'euchre' ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => bid({ action: 'order_up' })} data-testid="card-mp-bid-orderup" className="px-3 py-2 rounded bg-amber-500 text-black font-bold text-sm">Order Up</button>
                {['S', 'H', 'D', 'C'].map((s) => (
                  <button key={`nt-${s}`} onClick={() => bid({ action: 'name_trump', suit: s })} data-testid={`card-mp-bid-trump-${s}`} className="px-3 py-2 rounded bg-cyan-500 font-bold text-sm">
                    Name {SUIT_GLYPH[s]}
                  </button>
                ))}
                <button onClick={() => bid({ action: 'pass' })} data-testid="card-mp-bid-pass" className="px-3 py-2 rounded bg-white/10 font-bold text-sm">Pass</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={250}
                  max={600}
                  step={10}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(parseInt(e.target.value || '0', 10) || 0)}
                  data-testid="card-mp-bid-amount"
                  className="w-24 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm"
                />
                <button onClick={() => bid({ action: 'place_bid', amount: bidAmount })} data-testid="card-mp-bid-place" className="px-3 py-2 rounded bg-amber-500 text-black font-bold text-sm">Bid {bidAmount}</button>
                <button onClick={() => bid({ action: 'pass' })} data-testid="card-mp-bid-pinochle-pass" className="px-3 py-2 rounded bg-white/10 font-bold text-sm">Pass</button>
                {['S', 'H', 'D', 'C'].map((s) => (
                  <button key={`pnt-${s}`} onClick={() => bid({ action: 'name_trump', suit: s })} data-testid={`card-mp-name-trump-${s}`} className="px-2 py-1 rounded bg-cyan-500/80 font-bold text-xs">
                    Trump {SUIT_GLYPH[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next-hand button when hand finishes */}
        {room.status === 'PLAYING' && engine?.phase === 'hand_over' && (
          <button
            type="button"
            onClick={nextHand}
            disabled={busy}
            data-testid="card-mp-next-hand"
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold disabled:opacity-50"
          >
            Deal Next Hand
          </button>
        )}

        {error && (
          <p className="mt-2 text-xs text-rose-300" data-testid="card-mp-error">
            {error}
          </p>
        )}
      </div>

      {/* Player hand — fixed bottom */}
      {mySeat && myHand.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-emerald-400/20 py-4">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-[10px] uppercase tracking-widest text-emerald-200/80 mb-1">
              Your hand · seat {mySeat}
              {engine?.phase === 'playing' && myTurn && <span className="ml-2 text-cyan-300">your turn</span>}
            </div>
            <div className="flex gap-1 justify-center flex-wrap" data-testid="card-mp-hand">
              {myHand.map((c, i) => {
                const key = `${c.rank}${c.suit}${c.copy ?? ''}`;
                const legal = engine?.phase === 'playing' ? legalSet.has(key) : false;
                const canPlay = myTurn && engine?.phase === 'playing' && legal;
                return (
                  <PlayingCard
                    key={`my-${i}`}
                    card={c}
                    onClick={canPlay ? () => playCard(c) : undefined}
                    disabled={!canPlay}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
