/**
 * DSG Music Group — studio booking floor + Artist Rolodex + Affiliate
 * Chair sponsorship management.
 *
 * For chair holders: a "Sponsor an artist" panel that lets them attach
 * their chair to a verified artist for a 30% revenue cut.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Headphones, Handshake, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

type Studio = { studio_id: string; name: string; environment: string; hourly_rate_coins: number };
type Artist = { user_id?: string; display_name?: string; name?: string; genre?: string };
type Sponsorship = { sponsorship_id: string; artist_id: string; revenue_share_bps: number; active_since: string };

export default function MusicGroupPage() {
  const [userId, setUserId] = useState<string>('');
  const [studios, setStudios] = useState<Studio[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [hours, setHours] = useState<Record<string, number>>({});
  const [sponsorTargetId, setSponsorTargetId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const me = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).catch(() => null);
    const uid = me?.user_id || me?.id || me?._id;
    setUserId(uid || '');

    const [s, a, sp] = await Promise.all([
      fetch(`${API_URL}/api/media-master/music/studios`).then((r) => r.json()).catch(() => ({ studios: [] })),
      fetch(`${API_URL}/api/media-master/music/artists`).then((r) => r.json()).catch(() => ({ artists: [] })),
      uid ? fetch(`${API_URL}/api/media-master/music/sponsorships/${uid}`).then((r) => r.json()).catch(() => ({ sponsorships: [] })) : { sponsorships: [] },
    ]);
    setStudios(s.studios || []);
    setArtists(a.artists || []);
    setSponsorships(sp.sponsorships || []);
  }

  async function book(studio_id: string) {
    if (!userId) return;
    setBusy(true); setMessage(null);
    const h = Math.max(1, Math.min(24, hours[studio_id] || 1));
    try {
      const res = await fetch(`${API_URL}/api/media-master/music/book-studio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, studio_id, hours: h }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json?.detail?.message || json?.detail?.code || 'Booking failed'); return; }
      setMessage(`Booked ${json.booking.hours}h · ₵${json.booking.total_coins.toLocaleString()}`);
    } finally { setBusy(false); }
  }

  async function sponsor() {
    if (!userId || !sponsorTargetId) { setMessage('Enter an artist user_id to sponsor'); return; }
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/music/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chair_user_id: userId, artist_id: sponsorTargetId }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage('Sponsor failed'); return; }
      setMessage(json.idempotent ? 'Already sponsoring this artist.' : 'Sponsorship active.');
      setSponsorTargetId('');
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div data-testid="music-group-page" className="min-h-screen bg-[#06050a] text-white">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <BackButton to="/media-master" label="Back to Network" />
        <header className="mt-6 mb-10">
          <div className="flex items-center gap-2 text-fuchsia-300/80 text-xs uppercase tracking-widest mb-2">
            <Music className="w-4 h-4" /> DSG Music Group
          </div>
          <h1 className="text-3xl sm:text-4xl font-light">Studios · Artists · Affiliate Chairs</h1>
        </header>

        {message && (
          <div data-testid="music-group-message" className="mb-6 rounded-lg bg-amber-500/10 ring-1 ring-amber-400/40 text-amber-100 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {/* Studios */}
        <section className="mb-12" data-testid="music-group-studios">
          <h2 className="text-lg md:text-lg font-medium text-white/85 mb-4">3D Virtual Studios</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {studios.map((s, idx) => (
              <motion.div
                key={s.studio_id}
                data-testid={`music-group-studio-${s.studio_id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-2xl p-5 bg-gradient-to-br from-[#15071a] to-[#0c0a14] ring-1 ring-fuchsia-400/25"
              >
                <Headphones className="w-5 h-5 text-fuchsia-300 mb-3" />
                <div className="text-white font-semibold">{s.name}</div>
                <div className="text-white/55 text-xs mt-1 mb-3 capitalize">{s.environment}</div>
                <div className="text-2xl text-amber-200 mb-3">₵{s.hourly_rate_coins.toLocaleString()}<span className="text-xs text-white/40">/hr</span></div>
                <div className="flex gap-2">
                  <input
                    data-testid={`music-group-hours-${s.studio_id}`}
                    type="number"
                    min={1}
                    max={24}
                    value={hours[s.studio_id] ?? 1}
                    onChange={(e) => setHours((h) => ({ ...h, [s.studio_id]: parseInt(e.target.value || '1', 10) }))}
                    className="bg-black/40 ring-1 ring-fuchsia-300/30 rounded-lg px-2 py-1.5 text-fuchsia-100 w-16 text-sm"
                  />
                  <button
                    data-testid={`music-group-book-${s.studio_id}`}
                    disabled={busy}
                    onClick={() => book(s.studio_id)}
                    className="flex-1 rounded-full py-1.5 bg-gradient-to-r from-amber-300 to-fuchsia-400 text-black text-sm font-semibold disabled:opacity-60"
                  >
                    Book
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Affiliate Chair sponsorship */}
        <section className="mb-12" data-testid="music-group-sponsor">
          <h2 className="text-lg md:text-lg font-medium text-white/85 mb-4">Affiliate Chair · Artist sponsorship</h2>
          <div className="rounded-2xl p-6 bg-gradient-to-br from-[#0c0a14] to-[#150712] ring-1 ring-amber-400/25">
            <Handshake className="w-6 h-6 text-amber-300 mb-3" />
            <p className="text-white/65 text-sm mb-4">
              As an Affiliate Chair holder you can sponsor any verified artist on the network.
              You receive <strong className="text-amber-200">30%</strong> of all ₵VIBEZ flowing into
              their streams and music sales while the sponsorship is active.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                data-testid="music-group-sponsor-input"
                value={sponsorTargetId}
                onChange={(e) => setSponsorTargetId(e.target.value)}
                placeholder="Artist user_id"
                className="bg-black/40 ring-1 ring-amber-300/30 rounded-lg px-3 py-2 text-amber-100 w-72"
              />
              <button
                data-testid="music-group-sponsor-btn"
                onClick={sponsor}
                disabled={busy || !sponsorTargetId}
                className="rounded-full px-5 py-2 bg-gradient-to-r from-amber-300 to-emerald-300 text-black font-semibold disabled:opacity-60"
              >
                Sponsor <ArrowRight className="w-4 h-4 inline" />
              </button>
            </div>

            {sponsorships.length > 0 && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Active sponsorships</div>
                <div className="flex flex-wrap gap-2">
                  {sponsorships.map((sp) => (
                    <span
                      key={sp.sponsorship_id}
                      data-testid={`music-group-sponsorship-${sp.sponsorship_id}`}
                      className="text-xs px-3 py-1 rounded-full bg-amber-500/10 ring-1 ring-amber-300/40 text-amber-200"
                    >
                      {sp.artist_id} · {sp.revenue_share_bps / 100}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Artist Rolodex */}
        <section data-testid="music-group-artists">
          <h2 className="text-lg md:text-lg font-medium text-white/85 mb-4">Artist Rolodex</h2>
          {artists.length === 0 ? (
            <div className="rounded-2xl p-6 bg-white/5 ring-1 ring-white/10 text-white/55 text-sm">
              No verified musicians in the rolodex yet. Add yourself as a verified musician via Yellow Pages
              to appear here.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {artists.map((a, i) => (
                <div key={i} className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10">
                  <div className="text-white font-semibold">{a.display_name || a.name || a.user_id}</div>
                  {a.genre && <div className="text-amber-200/70 text-xs mt-1">{a.genre}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
