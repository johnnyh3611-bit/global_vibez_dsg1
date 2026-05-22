/**
 * /plex/:roomId — Unified Plex Room (V3 Living-Room Ecosystem)
 *
 * Single multi-functional container with mode toggles (Gaming / Dating
 * / Showcase), the Affinity Engine ambient state, four persistent
 * participant nodes around the perimeter, and the Vibe DJ overlay
 * for monetization. Counter-proposal economics: in-app ₵, no burn.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Crown, Users, Heart, Tv, Gamepad2, Loader2, Sparkles, Wand2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import VibeDJOverlay from '@/components/VibeDJOverlay';
import InterestTagPicker, { hasPickedInterests, loadStoredInterests } from '@/components/InterestTagPicker';

const API = process.env.REACT_APP_BACKEND_URL;

type Mode = 'GAMING' | 'DATING' | 'SHOWCASE';

type Participant = {
  node_id: string;
  user_id: string;
  user_name: string;
  seat_index: number;
  is_video_active: boolean;
  interests: string[];
};

type RoomState = {
  ok: boolean;
  room: {
    room_id: string;
    host_id: string;
    host_name: string;
    active_mode: Mode;
    affinity_score: number;
    affinity_key: 'icebreaker' | 'neon_spark' | 'synergy_flare';
    visual_override_id: string | null;
    status: string;
  };
  participants: Participant[];
  affinity: { score: number; key: string; label: string };
  wager_caps_coins: { free: number; mid: number; top: number };
};

// Affinity Engine — ambient theme per state
const AFFINITY_THEMES: Record<string, { gradient: string; ring: string; chip: string }> = {
  icebreaker: {
    gradient: 'from-cyan-900/30 via-slate-900/60 to-slate-950',
    ring: 'ring-cyan-400/40',
    chip: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
  },
  neon_spark: {
    gradient: 'from-purple-900/40 via-fuchsia-900/30 to-slate-950',
    ring: 'ring-fuchsia-400/50',
    chip: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40',
  },
  synergy_flare: {
    gradient: 'from-amber-700/40 via-rose-700/30 to-slate-950',
    ring: 'ring-amber-400/60 animate-pulse',
    chip: 'bg-amber-500/30 text-amber-100 border-amber-400/60',
  },
};

const MODE_LABEL: Record<Mode, { label: string; subtitle: string; Icon: any }> = {
  GAMING: { label: 'Gaming', subtitle: 'Card grid · table felt', Icon: Gamepad2 },
  DATING: { label: 'Dating', subtitle: 'Compatibility & icebreakers', Icon: Heart },
  SHOWCASE: { label: 'Showcase', subtitle: 'DSG TV stream takeover', Icon: Tv },
};

const SeatOrb = ({ p, themeRing }: { p: Participant | null; themeRing: string }) => (
  <div
    className={`relative w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-white/15 bg-black/40 backdrop-blur-md flex items-center justify-center ${
      p ? `ring-2 ${themeRing} ring-offset-2 ring-offset-black/40` : 'opacity-50'
    }`}
    data-testid={`plex-seat-${p?.seat_index ?? 'empty'}`}
  >
    {p ? (
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 flex items-center justify-center text-lg font-black text-white">
          {p.user_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <p className="text-[10px] mt-1 text-white/80 truncate max-w-[90px]">{p.user_name}</p>
      </div>
    ) : (
      <Users className="w-6 h-6 text-white/30" />
    )}
  </div>
);

export default function PlexRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMode, setBusyMode] = useState<Mode | null>(null);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  const token = () => localStorage.getItem('auth_token');

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const r = await fetch(`${API}/api/plex/rooms/${roomId}`);
      const d = await r.json();
      if (d?.ok) setState(d);
    } catch {
      /* offline tolerant */
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Auto-join on mount (idempotent — backend dedupes). On first
  // join EVER (no interests stored), pop the InterestTagPicker so
  // the Affinity Engine activates with real data.
  useEffect(() => {
    const t = token();
    if (!t || !roomId) {
      fetchState();
      return;
    }
    if (!hasPickedInterests()) {
      setPickerOpen(true);
      fetchState();
      return;
    }
    fetch(`${API}/api/plex/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ interests: loadStoredInterests() }),
    })
      .catch(() => undefined)
      .finally(fetchState);
  }, [roomId, fetchState]);

  const handlePickerClose = async (picked: string[]) => {
    setPickerOpen(false);
    const t = token();
    if (!t || !roomId) return;
    // Replay join now that we have interests
    fetch(`${API}/api/plex/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ interests: picked }),
    })
      .catch(() => undefined)
      .finally(fetchState);
  };

  // Light polling — 4s. Cheap, no websockets needed for the MVP.
  useEffect(() => {
    const id = setInterval(fetchState, 4000);
    return () => clearInterval(id);
  }, [fetchState]);

  const handleMode = async (mode: Mode) => {
    if (!roomId) return;
    setBusyMode(mode);
    try {
      const t = token();
      const r = await fetch(`${API}/api/plex/rooms/${roomId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ mode }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Mode → ${mode}`);
        fetchState();
      } else if (d?.reason === 'host_only') {
        toast.error('Only the host can change the mode.');
      } else {
        toast.error(d?.reason || 'Mode change failed.');
      }
    } finally {
      setBusyMode(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="min-h-screen bg-[#06080f] flex flex-col items-center justify-center text-white">
        <p className="text-lg">Room not found.</p>
        <Button onClick={() => navigate('/plex')} className="mt-3">Browse live rooms</Button>
      </div>
    );
  }

  const theme = AFFINITY_THEMES[state.room.affinity_key] || AFFINITY_THEMES.icebreaker;
  const mode = state.room.active_mode;
  const isHost = state.room.host_id === localStorage.getItem('userId');
  const seats: (Participant | null)[] = [0, 1, 2, 3].map(
    (i) => state.participants.find((p) => p.seat_index === i) || null,
  );

  return (
    <div
      className={`min-h-screen text-white bg-gradient-to-br ${theme.gradient} transition-all duration-700`}
      data-testid="plex-room-page"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-white/10 backdrop-blur-md bg-black/30">
        <button
          onClick={() => navigate('/plex')}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
          data-testid="plex-room-back"
        >
          <ArrowLeft className="w-4 h-4" /> Live rooms
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/50">Vibez Plex Room</p>
          <p className="text-sm font-bold flex items-center gap-1.5 justify-center" data-testid="plex-room-id">
            <Crown className="w-3.5 h-3.5 text-amber-300" /> {state.room.host_name}'s room
          </p>
        </div>
        <Badge
          className={`border ${theme.chip} font-bold uppercase tracking-widest text-[10px]`}
          data-testid="plex-affinity-badge"
        >
          <Sparkles className="w-3 h-3 mr-1" /> {state.affinity.label.split(' — ')[0]} · {state.affinity.score}
        </Badge>
      </header>

      {/* Mode toggle bar */}
      <div className="max-w-5xl mx-auto px-5 pt-5">
        <div className="grid grid-cols-3 gap-2" data-testid="plex-mode-toggle">
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => {
            const { Icon, label, subtitle } = MODE_LABEL[m];
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleMode(m)}
                disabled={!isHost || busyMode !== null}
                data-testid={`plex-mode-${m.toLowerCase()}`}
                className={`p-3 rounded-2xl border transition-all text-left ${
                  isActive
                    ? 'bg-gradient-to-br from-fuchsia-500/30 to-purple-700/30 border-fuchsia-400/60 shadow-lg'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                } ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-fuchsia-200' : 'text-white/60'}`} />
                <p className="text-sm font-black mt-1">{label}</p>
                <p className="text-[10px] text-white/50 leading-snug">{subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pillar Grid — 4 participant orbs + central viewport */}
      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        <Card className="relative p-6 bg-black/40 border border-white/10 backdrop-blur-md">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center" data-testid="plex-seats-row">
            {seats.map((p, i) => (
              <SeatOrb key={i} p={p ?? { ...({} as Participant), seat_index: i } as any} themeRing={theme.ring} />
            ))}
          </div>

          {/* Central viewport — switches layout per mode */}
          <div className="mt-6 min-h-[260px] rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center p-6">
            {mode === 'GAMING' && (
              <div className="text-center" data-testid="plex-viewport-gaming">
                <Gamepad2 className="w-12 h-12 mx-auto text-cyan-300" />
                <p className="text-base font-black mt-2">Card Grid Active</p>
                <p className="text-xs text-white/50 mt-1">Tables · spades felt · client-side suit checks</p>
                <Button
                  onClick={() => navigate('/vibe-654-hall')}
                  className="mt-4 bg-cyan-500 text-black hover:bg-cyan-400"
                  data-testid="plex-open-hall-btn"
                >
                  Open Vibez 654 Hall
                </Button>
              </div>
            )}
            {mode === 'DATING' && (
              <div className="text-center" data-testid="plex-viewport-dating">
                <Heart className="w-12 h-12 mx-auto text-pink-300" />
                <p className="text-base font-black mt-2">Compatibility Canvas</p>
                <p className="text-xs text-white/50 mt-1">
                  Affinity score · live icebreakers · bio chips
                </p>
                <p className="text-xs text-pink-200 mt-3 font-mono">
                  Room affinity: {state.affinity.score} / 100
                </p>
              </div>
            )}
            {mode === 'SHOWCASE' && (
              <div className="text-center" data-testid="plex-viewport-showcase">
                <Tv className="w-12 h-12 mx-auto text-amber-300" />
                <p className="text-base font-black mt-2">DSG TV Showcase</p>
                <p className="text-xs text-white/50 mt-1">
                  Synchronous stream · ripple-trigger visual gifts
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Wager caps + economics transparency */}
        <Card className="p-4 bg-black/30 border border-white/10 text-xs" data-testid="plex-wager-caps">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-3.5 h-3.5 text-amber-300" />
            <p className="font-bold uppercase tracking-widest text-amber-200">Battle wager caps</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['free', 'mid', 'top'] as const).map((tier) => (
              <div
                key={tier}
                className="rounded-lg p-2 bg-white/5 border border-white/10"
                data-testid={`plex-cap-${tier}`}
              >
                <p className="text-[10px] uppercase tracking-widest text-white/50">{tier}</p>
                <p className="font-mono font-bold text-amber-200">
                  {state.wager_caps_coins[tier].toLocaleString()} ₵
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40 mt-3 text-center">
            Wager routing: 40% Tournament Pool · 30% Treasury · 30% Airlock · 0% burn
          </p>
        </Card>
      </main>

      {/* Vibe DJ overlay — single source of music monetization */}
      <VibeDJOverlay roomId={`plex-${state.room.room_id}`} />

      {/* Interest-tag picker — fires once per device on first Plex join */}
      <InterestTagPicker open={pickerOpen} onClose={handlePickerClose} />
    </div>
  );
}
