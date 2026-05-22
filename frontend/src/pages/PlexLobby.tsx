/**
 * /plex — Live Plex Room lobby. Browse + spin up new rooms.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Users, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type Room = {
  room_id: string;
  host_name: string;
  active_mode: string;
  affinity_score: number;
  affinity_key: string;
};

const STATE_COLOR: Record<string, string> = {
  icebreaker: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
  neon_spark: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40',
  synergy_flare: 'bg-amber-500/30 text-amber-100 border-amber-400/60',
};

export default function PlexLobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchRooms = async () => {
    try {
      const r = await fetch(`${API}/api/plex/rooms/live?limit=24`);
      const d = await r.json();
      setRooms(d?.rows || []);
    } catch {
      /* tolerate */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 6000);
    return () => clearInterval(id);
  }, []);

  const createRoom = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/auth');
      return;
    }
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/plex/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ initial_mode: 'GAMING' }),
      });
      const d = await r.json();
      if (d?.room_id) {
        toast.success('Plex room created!');
        navigate(`/plex/${d.room_id}`);
      } else {
        toast.error('Could not create room.');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="plex-lobby-page">
      <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 border-b border-white/10 backdrop-blur-md bg-[#06080f]/95">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-fuchsia-200 flex items-center gap-3">
          <Sparkles className="w-5 h-5" /> Plex Rooms
        </h1>
        <Button
          onClick={createRoom}
          disabled={creating}
          className="bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-black"
          data-testid="plex-lobby-create"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="ml-1">New room</span>
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
          </div>
        ) : rooms.length === 0 ? (
          <Card className="p-10 bg-black/30 border border-white/10 text-center" data-testid="plex-lobby-empty">
            <Users className="w-10 h-10 mx-auto text-white/30" />
            <p className="text-base mt-3">No live rooms yet — be the first.</p>
            <p className="text-xs text-white/40 mt-1">Hit "New room" to spin one up.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="plex-lobby-grid">
            {rooms.map((r) => (
              <button
                key={r.room_id}
                type="button"
                onClick={() => navigate(`/plex/${r.room_id}`)}
                data-testid={`plex-lobby-card-${r.room_id}`}
                className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-fuchsia-400/40 hover:bg-fuchsia-500/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-black truncate">{r.host_name}'s room</p>
                  <span
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATE_COLOR[r.affinity_key] || STATE_COLOR.icebreaker}`}
                  >
                    {r.affinity_key.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[10px] text-white/40 mt-1 font-mono">{r.room_id}</p>
                <div className="flex items-center justify-between mt-3 text-[11px]">
                  <span className="text-fuchsia-200">{r.active_mode}</span>
                  <span className="text-white/40">Affinity {r.affinity_score}/100</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
