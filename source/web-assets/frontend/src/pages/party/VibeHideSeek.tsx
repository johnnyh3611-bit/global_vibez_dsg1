/**
 * VibeHideSeek — geo-spatial scavenger hunt (Party Hub Blueprint §3).
 *
 * Players "hide" in sponsored Mom & Pop stores from the Vibe Yellow
 * Pages. Seekers see a Mapbox-rendered city with merchant pins and
 * have to identify which merchant the player is hiding at.
 *
 * Each correct find fires a `ROUTE_TIP` action through the Streamer
 * Action Hub (so the same payout / hype-meter rails apply) and gives
 * the merchant a 5% mining kickback per the Master Tech Blueprint §2.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Eye, Star, Trophy, Search } from 'lucide-react';
import { toast } from 'sonner';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const API = process.env.REACT_APP_BACKEND_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

interface Hideout {
  id: string;
  name: string;
  cat: string;
  clue: string;
  lat: number;
  lng: number;
}

const SAMPLE_HIDEOUTS: Hideout[] = [
  { id: 'h1', name: "Ramon's Cuban Bakery",  cat: 'food',   clue: "Smells like vanilla flan and abuelo's pipe smoke.",       lat: 25.7617, lng: -80.1918 },
  { id: 'h2', name: "Glitter Box Salon",    cat: 'beauty', clue: "Where heads of hair turn into rainbow sculptures.",       lat: 25.7741, lng: -80.1937 },
  { id: 'h3', name: "Volt Repair Garage",   cat: 'auto',   clue: "Engines hum and oil drips here — every wrench has a name.", lat: 25.7530, lng: -80.2000 },
  { id: 'h4', name: "Knit & Spin Studio",   cat: 'retail', clue: "Yarn balls roll like tumbleweeds across pine floors.",     lat: 25.7700, lng: -80.1850 },
  { id: 'h5', name: "Marisol Curaçao Café", cat: 'food',   clue: "Cracked coconut shells and steel drums rattle the wall.",  lat: 25.7580, lng: -80.1880 },
];

export default function VibeHideSeek() {
  const navigate = useNavigate();
  const [round, setRound] = useState(1);
  const [hidden, setHidden] = useState(() => SAMPLE_HIDEOUTS[Math.floor(Math.random() * SAMPLE_HIDEOUTS.length)]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [guessed, setGuessed] = useState<string | null>(null);

  const guess = async (h: Hideout) => {
    if (guessed) return;
    setGuessed(h.id);
    const correct = h.id === hidden.id;
    if (correct) {
      const reward = 200 * (streak + 1);
      setScore((s) => s + reward);
      setStreak((s) => s + 1);
      toast.success(`Found! +$${(reward / 100).toFixed(2)} · streak ×${streak + 1}`);
      try {
        const t = localStorage.getItem('auth_token');
        await fetch(`${API}/api/streamer-actions/tip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
          body: JSON.stringify({
            streamer_id: `merchant_${hidden.id}`,
            action_kind: 'ROUTE_TIP',
            amount_cents: reward,
            metadata: { game: 'hide_seek', merchant: hidden.name, kickback_pct: 0.05 },
          }),
        });
      } catch {}
    } else {
      setStreak(0);
      toast.error(`Not there. The hider was at ${hidden.name}.`);
    }
    setTimeout(() => {
      setRound((r) => r + 1);
      setHidden(SAMPLE_HIDEOUTS[Math.floor(Math.random() * SAMPLE_HIDEOUTS.length)]);
      setGuessed(null);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-black text-white">
      <div className="sticky top-0 z-30 bg-black/70 backdrop-blur-md border-b border-emerald-500/30 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} data-testid="hideseek-back" className="p-2 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-300">Party Hub · Geo-Sphere</div>
          <div className="text-lg font-black bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 bg-clip-text text-transparent">
            Vibe-Hide & Seek
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Score</div>
          <div className="font-mono font-black text-emerald-300" data-testid="hideseek-score">${(score / 100).toFixed(2)}</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        <motion.div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-5 mb-5" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-6 h-6 text-emerald-300" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Round {round} · Clue</div>
              <div className="text-lg font-bold italic" data-testid="hideseek-clue">"{hidden.clue}"</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Streak</div>
              <div className="font-mono font-black text-amber-300" data-testid="hideseek-streak">×{streak}</div>
            </div>
          </div>
        </motion.div>

        {/* Mapbox city view with merchant pins */}
        {MAPBOX_TOKEN && (
          <div className="rounded-2xl overflow-hidden border-2 border-emerald-500/30 mb-3" style={{ height: 280 }} data-testid="hideseek-map">
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{ longitude: -80.1918, latitude: 25.7617, zoom: 12.5 }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="top-right" />
              {SAMPLE_HIDEOUTS.map((h) => {
                const isHidden = h.id === hidden.id;
                const result = guessed === h.id ? (isHidden ? 'correct' : 'wrong') : null;
                return (
                  <Marker key={h.id} longitude={h.lng} latitude={h.lat} anchor="bottom">
                    <button
                      onClick={() => guess(h)}
                      data-testid={`hideseek-pin-${h.id}`}
                      disabled={!!guessed}
                      className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition ${
                        result === 'correct' ? 'bg-emerald-500 border-emerald-200' :
                        result === 'wrong'   ? 'bg-rose-500 border-rose-200' :
                        'bg-emerald-500/30 border-emerald-300 hover:bg-emerald-500/60'
                      }`}
                    >
                      <MapPin className="w-5 h-5 text-white" />
                    </button>
                  </Marker>
                );
              })}
            </Map>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3" data-testid="hideout-grid">
          {SAMPLE_HIDEOUTS.map((h) => {
            const result = guessed === h.id ? (h.id === hidden.id ? 'correct' : 'wrong') : null;
            return (
              <motion.button
                key={h.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                disabled={!!guessed}
                onClick={() => guess(h)}
                data-testid={`hideout-${h.id}`}
                data-result={result || ''}
                className={`text-left rounded-2xl p-4 border-2 transition relative overflow-hidden ${
                  result === 'correct' ? 'border-emerald-400 bg-emerald-500/30' :
                  result === 'wrong'   ? 'border-red-400 bg-red-500/20' :
                  'border-emerald-500/30 bg-stone-900/60 hover:border-emerald-400/70'
                }`}
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-200/70 mb-2">
                  <MapPin className="w-3 h-3" /> {h.cat}
                </div>
                <div className="font-black">{h.name}</div>
                {result === 'correct' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 text-emerald-300">
                    <Trophy className="w-6 h-6 drop-shadow-lg" />
                  </motion.div>
                )}
                {result === 'wrong' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 text-red-300">
                    <Eye className="w-6 h-6" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-center text-xs text-amber-200/80">
          <Star className="w-4 h-4 inline mr-1 -mt-1" />
          5% of every find goes back to the merchant as a mining kickback.
        </div>
      </div>
    </div>
  );
}
