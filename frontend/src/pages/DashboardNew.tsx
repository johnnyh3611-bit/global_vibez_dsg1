import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Globe, Heart, LogOut, Settings, Sparkles, Crown, MessageCircle, Gamepad2,
  Trophy, Utensils, Car, Wallet, TrendingUp, Moon, Music, Film, Pizza,
  Languages, Mic, MapPin, BookMarked,
  // May 2026 PDF batch
  PenTool, Smile, Search, Eye, ShoppingBag, Disc3, Radio,
  // Music Arena + TV Totem Pole batch
  Mic2, Tv, Headphones, Swords, Sparkle,
  // Cyber Casino tile (Unity WebGL, see CyberCasinoRoom.tsx)
  Joystick,
  // Feb 2026 — High Roller VIP Casino + Media Master ecosystem + Broadcast Director
  Diamond, Antenna, Clapperboard,
  // Feb 2026 — Equity Master (Crewmate Architecture / 30% Revenue Split)
  Gem,
  // Feb 2026 — Ambassador Care Package (Walking Advertisements / Founder's Circle)
  Award,
  // May 2026 — Free TV Networks watch-party room
  RadioTower,
} from 'lucide-react';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import Logo from '@/components/Logo';
import CreditBalance from '@/components/CreditBalance';
import AppFooter from '@/components/AppFooter';
import NotificationBanner from '@/components/NotificationBanner';
import ChairHolderVoteBanner from '@/components/dashboard/ChairHolderVoteBanner';
import RideHomeButton from '@/components/common/RideHomeButton';
import { switchDashboardView } from '@/pages/DashboardRouter';
import UnifiedEarningsWidget from '@/components/common/UnifiedEarningsWidget';
import DashboardSpinBadge from '@/components/DashboardSpinBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ────────────────────────────────────────────── Category Tabs ──
// Founder ask 2026-05-16: less scroll, sectioned by category. The active
// tab borrows the MY VIBEZ holographic treatment (conic-gradient + glow)
// so the choice feels alive without overwhelming the page.

type CategoryId =
  | 'watch'
  | 'dating'
  | 'games'
  | 'music'
  | 'lifestyle'
  | 'social'
  | 'earnings'
  | 'all';

type CategoryDef = { id: CategoryId; label: string; icon: any };

const CATEGORIES: CategoryDef[] = [
  { id: 'watch',     label: 'Watch',     icon: Tv },
  { id: 'dating',    label: 'Dating',    icon: Heart },
  { id: 'games',     label: 'Games',     icon: Gamepad2 },
  { id: 'music',     label: 'Music',     icon: Music },
  { id: 'lifestyle', label: 'Lifestyle', icon: Utensils },
  { id: 'social',    label: 'Social',    icon: MessageCircle },
  { id: 'earnings',  label: 'Earnings',  icon: Gem },
  { id: 'all',       label: 'All',       icon: Sparkles },
];

// room.id → category. Anything not listed defaults to 'all' so we never
// silently hide a room. Update this map when you add a new room tile.
const ROOM_CATEGORY: Record<string, CategoryId> = {
  // Watch & Stream
  myvibez: 'watch',
  free_tv: 'watch',
  cinema_room: 'watch',
  vibez_tv: 'watch',
  tv_totem_pole: 'watch',
  streamer_overlay: 'watch',
  broadcast_director: 'watch',
  media_master: 'watch',
  lyric_glasshouse: 'watch',
  // Dating
  dating: 'dating',
  gamer_dating: 'dating',
  memory_bank: 'dating',
  vigilant_matchmaking: 'dating',
  cultural_onboarding: 'dating',
  just_for_the_night: 'dating',
  blind_auction: 'dating',
  voice_mirror: 'dating',
  // Games & Party
  games: 'games',
  tournaments: 'games',
  cyber_casino: 'games',
  high_roller: 'games',
  vibetionary: 'games',
  meme_matchmaker: 'games',
  hide_seek: 'games',
  vibeshopper: 'games',
  // Music
  dsg_music_group: 'music',
  beat_vault: 'music',
  beat_vault_dlc: 'music',
  sound_check: 'music',
  collab_matchmaker: 'music',
  totem_battles: 'music',
  vibe_suite: 'music',
  // Lifestyle
  hungry_vibez: 'lifestyle',
  rides: 'lifestyle',
  datespot: 'lifestyle',
  yellow_pages: 'lifestyle',
  // Social
  social: 'social',
  // Earnings
  equity_master: 'earnings',
  ambassador_care: 'earnings',
};

function CategoryTabs({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div data-testid="dashboard-category-tabs" className="mb-6">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.id === active;
          return (
            <button
              key={cat.id}
              data-testid={`dashboard-category-tab-${cat.id}`}
              onClick={() => onChange(cat.id)}
              className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-all
                ${isActive
                  ? 'text-black ring-1 ring-amber-200/50 shadow-[0_0_30px_-8px_rgba(232,121,249,0.55)]'
                  : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10 ring-1 ring-white/10'
                }`}
            >
              {isActive && (
                <span
                  className="absolute inset-0 rounded-full overflow-hidden"
                  aria-hidden="true"
                >
                  <span
                    className="absolute inset-[-30%]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, #f0abfc, #fde047, #67e8f9, #fb7185, #c084fc, #fde047, #f0abfc)',
                      filter: 'blur(8px) saturate(140%)',
                      animation: 'spin 14s linear infinite',
                    }}
                  />
                  <span className="absolute inset-0 bg-white/15" />
                </span>
              )}
              <Icon className="relative w-3.5 h-3.5" />
              <span className="relative">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────── Live Right Now pill ──
// Polls /api/live-pulse/categories every 20s and surfaces per-category
// live audience counts above the tabs. Clicking a pulse pill switches
// the active category. Hidden when the platform is fully quiet so we
// don't show "0 live everywhere" — a credibility kill.

function LivePulsePill({
  onJump,
}: {
  onJump: (categoryId: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/live-pulse/categories`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCounts(json.counts || {});
      } catch {
        // Silent — pulse is a nice-to-have, never a blocker.
      }
    }
    void poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  // Show only categories with at least one live viewer, hottest first.
  const live = CATEGORIES
    .filter((c) => c.id !== 'all' && (counts[c.id] || 0) > 0)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));

  return (
    <div data-testid="live-pulse-pill" className="mb-3 flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        Live right now
      </span>
      {live.map((c) => {
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            data-testid={`live-pulse-${c.id}`}
            onClick={() => onJump(c.id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 hover:ring-emerald-300/70 px-2.5 py-1 text-xs text-emerald-100 transition-all"
          >
            <Icon className="w-3 h-3" />
            <span className="font-semibold">{counts[c.id]}</span>
            <span className="opacity-75">in {c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────── Hot Rooms carousel ──
// Surfaces the top 3 individual rooms by live audience under the pulse
// pill. One tap drops you in — no lobby browsing. Auto-hides when
// no rooms are live (same UX rule as the pulse pill).
//
// Each card carries a 30s preview hover-card (Netflix/Twitch pattern):
// hover ≥600ms on desktop, or long-press on touch — the preview rises
// with bigger thumbnail, full title, audience pulse, and Join CTA. The
// preview disappears the moment the cursor leaves or finger releases.

type HotRoom = {
  id: string;
  name: string;
  category: string;
  audience: number;
  path: string;
  network: string | null;
  preview_image_url?: string;
  preview_video_url?: string | null;
};

function HotRoomsCarousel() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<HotRoom[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/live-pulse/hot-rooms?limit=3`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRooms(json.rooms || []);
      } catch {
        // Silent — carousel is a nice-to-have, never a blocker.
      }
    }
    void poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function showPreview(id: string, delayMs = 600) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreviewId(id), delayMs);
  }

  function hidePreview() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setPreviewId(null);
  }

  if (rooms.length === 0) return null;

  return (
    <div data-testid="hot-rooms-carousel" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">
          Hot rooms · join in
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {rooms.map((r, idx) => (
          <div
            key={r.id}
            className="relative shrink-0 w-64"
            onMouseEnter={() => showPreview(r.id)}
            onMouseLeave={hidePreview}
            onTouchStart={() => showPreview(r.id, 400)}
            onTouchEnd={hidePreview}
            onTouchCancel={hidePreview}
          >
            <motion.button
              data-testid={`hot-room-${r.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              onClick={() => navigate(r.path)}
              className="group relative w-full text-left rounded-xl bg-gradient-to-br from-[#1a1206] via-[#0f0a14] to-[#0a1410] ring-1 ring-amber-300/30 hover:ring-amber-300/70 px-4 py-3 transition-all shadow-[0_0_30px_-10px_rgba(251,191,36,0.35)]"
            >
              <div className="absolute -inset-px rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(232,121,249,0.12))',
                }}
              />
              <div className="relative flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-amber-200/80">
                  {r.network || r.category}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <span className="font-semibold">{r.audience}</span>
                  watching
                </span>
              </div>
              <div className="relative text-sm font-medium text-white truncate">{r.name}</div>
              <div className="relative text-xs text-white/50 mt-1 truncate">Tap to join →</div>
            </motion.button>

            <AnimatePresence>
              {previewId === r.id && (
                <motion.div
                  data-testid={`hot-room-preview-${r.id}`}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl overflow-hidden bg-[#0a0a14] ring-1 ring-amber-300/50 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7),0_0_45px_-10px_rgba(251,191,36,0.45)]"
                >
                  {/* Thumbnail strip — swap to muted live <video> the
                      moment Cloudflare Stream sets `preview_video_url`.
                      No other code change needed; the Netflix-style
                      hover-to-play behaviour comes online for free. */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {r.preview_video_url ? (
                      <video
                        src={r.preview_video_url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover"
                        data-testid={`hot-room-preview-video-${r.id}`}
                      />
                    ) : (
                      <img
                        src={r.preview_image_url || '/placeholder-cinema.jpg'}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    {/* Live badge */}
                    <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-red-500/90 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      Live
                    </div>
                    {/* Animated gradient sweep to fake a "now playing" pulse */}
                    <motion.div
                      className="absolute inset-x-0 bottom-0 h-0.5"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 30, ease: 'linear' }}
                      style={{
                        background: 'linear-gradient(90deg, #f0abfc, #fde047, #67e8f9)',
                        transformOrigin: '0% 50%',
                      }}
                    />
                  </div>
                  {/* Meta */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-widest text-amber-200/80">
                        {r.network || r.category}
                      </span>
                      <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
                        <span className="font-semibold">{r.audience}</span> watching
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white mb-2">{r.name}</div>
                    <button
                      data-testid={`hot-room-preview-join-${r.id}`}
                      onClick={(e) => { e.stopPropagation(); navigate(r.path); }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-black text-xs font-bold py-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                    >
                      Join now
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}



export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('watch');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Use Bearer token from localStorage (the auth flow stores it on
        // login/demo-login). Sending credentials:'include' would be blocked
        // by the edge gateway's Allow-Origin:* CORS header.
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('No auth token');
        const response = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Not authenticated');

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Clear local Bearer fallback so we don't re-auth with a stale token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      navigate('/');
    } catch (error) {
      // console.error('Logout error:', error);
    }
  };

  const rooms = [
    {
      id: 'dating',
      name: 'Dating Universe',
      description: 'Find your perfect match with AI-powered compatibility',
      icon: Heart,
      gradient: 'from-pink-600 via-rose-500 to-purple-600',
      glow: 'rgba(225,29,72,0.5)',
      image: 'https://images.unsplash.com/photo-1567888818654-8e77698cdd4d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwzfHxkaXZlcnNlJTIwaGFwcHklMjBjb3VwbGUlMjBkYXRpbmclMjByb29tYW50aWMlMjBsaWdodGluZyUyMHRhYmxlfGVufDB8fHx8MTc3MzY5OTMxN3ww&ixlib=rb-4.1.0&q=85',
      path: '/discover',
      stats: { count: user?.match_count || 0, label: 'Matches' }
    },
    {
      id: 'gamer_dating',
      name: 'Find Your Player 2',
      description: 'Match with gamers and play together - dating through gaming',
      icon: Heart,
      gradient: 'from-pink-500 via-fuchsia-500 to-purple-600',
      glow: 'rgba(236,72,153,0.5)',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw2fHxjb3VwbGUlMjBkYXRpbmd8ZW58MHx8fHwxNzM5NTU2MDE2fDA&ixlib=rb-4.1.0&q=85',
      path: '/dating/profile/setup',
      stats: { count: 'NEW', label: 'Feature' }
    },
    {
      id: 'myvibez',
      name: 'MY VIBEZ',
      description: 'Streaming & watch place — share your moments, discover creators',
      icon: TrendingUp,
      gradient: 'from-cyan-400 via-blue-500 to-purple-600',
      glow: 'rgba(34,211,238,0.6)',
      image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?crop=entropy&cs=srgb&fm=jpg&ixid=M3w0NDExMzZ8MHwxfHNlYXJjaHwxfHx0aWt0b2slMjB2aXJhbCUyMHZpZGVvJTIwY29udGVudCUyMGNyZWF0b3J8ZW58MHx8fHwxNzQxNTczNTkzfDA&ixlib=rb-4.1.0&q=85',
      path: '/my-vibez',
      stats: { count: '🔥', label: 'Trending' }
    },
    {
      id: 'games',
      name: 'Game Arena',
      description: 'Play 34+ games including Casino, Arcade, Board & Card games',
      icon: Gamepad2,
      gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
      glow: 'rgba(14,165,233,0.5)',
      image: 'https://images.unsplash.com/photo-1672224745017-a9b54ad9188f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxuZW9uJTIwZnV0dXJpc3RpYyUyMGdhbWUlMjByb29tJTIwM2R8ZW58MHx8fHwxNzczNjk5MzE2fDA&ixlib=rb-4.1.0&q=85',
      path: '/practice',
      stats: { count: '34', label: 'Games' }
    },
    {
      id: 'tournaments',
      name: 'Tournament Hall',
      description: 'Compete in couples & friends tournaments for prizes',
      icon: Trophy,
      gradient: 'from-amber-400 via-orange-500 to-purple-700',
      glow: 'rgba(245,158,11,0.5)',
      image: 'https://images.unsplash.com/photo-1728488447889-13f95adcf5a0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBnb2xkJTIwZGFyayUyMHZpcCUyMGxvdW5nZSUyMGludGVyaW9yfGVufDB8fHx8MTc3MzY5OTMyOXww&ixlib=rb-4.1.0&q=85',
      path: '/tournaments',
      stats: { count: '$', label: 'Win Credits' }
    },
    {
      id: 'social',
      name: 'Social Lounge',
      description: 'Connect with matches and make new friends',
      icon: MessageCircle,
      gradient: 'from-orange-500 via-pink-500 to-rose-500',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1753674693617-0d5beec33f28?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHw0fHxkaXZlcnNlJTIwaGFwcHklMjBjb3VwbGUlMjBkYXRpbmclMjByb21hbnRpYyUyMGxpZ2h0aW5nfGVufDB8fHx8MTc3MzY5OTMxN3ww&ixlib=rb-4.1.0&q=85',
      path: '/matches',
      stats: { count: user?.message_count || 0, label: 'Messages' }
    },
    {
      id: 'datespot',
      name: 'Date Spot Finder',
      description: 'AI-powered restaurant recommendations',
      icon: Utensils,
      gradient: 'from-orange-400 via-red-500 to-pink-600',
      glow: 'rgba(251,146,60,0.5)',
      image: 'https://images.unsplash.com/photo-1760662503661-5f3781cd2a87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwzfHxyZXN0YXVyYW50JTIwZGlubmVyJTIwcm9tYW50aWMlMjBsaWdodGluZyUyMHRhYmxlfGVufDB8fHx8MTc3MzY5OTMzMXww&ixlib=rb-4.1.0&q=85',
      // FIXED 2026-02-16: was '/date-spots' (404). Real route is '/date-spot-finder'.
      path: '/date-spot-finder',
      stats: { count: '500+', label: 'Venues' }
    },
    // ─────── New tiles surfaced 2026-02-16 (founder asked: "I don't see none of the stuff we added") ───────
    {
      id: 'just_for_the_night',
      name: 'Just For The Night',
      description: 'Live now-or-never connections — vanish at sunrise',
      icon: Moon,
      gradient: 'from-purple-500 via-fuchsia-500 to-pink-600',
      glow: 'rgba(168,85,247,0.5)',
      image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?crop=entropy&cs=srgb&fm=jpg',
      path: '/just-for-the-night',
      stats: { count: 'NEW', label: 'After 9PM' }
    },
    {
      id: 'hungry_vibez',
      name: 'Hungry Vibez',
      description: 'Food delivery on the same fleet as VibeRidez',
      icon: Pizza,
      gradient: 'from-orange-500 via-red-500 to-fuchsia-600',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?crop=entropy&cs=srgb&fm=jpg',
      path: '/hungryvibes',
      stats: { count: '24/7', label: 'Delivery' }
    },
    {
      id: 'vibez_tv',
      name: 'Global Vibez DSG TV',
      description: 'Your 24/7 personal network — 30-min episodes',
      icon: Film,
      gradient: 'from-indigo-500 via-blue-600 to-cyan-500',
      glow: 'rgba(99,102,241,0.5)',
      image: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?crop=entropy&cs=srgb&fm=jpg',
      path: '/vibe-tv',
      stats: { count: 'LIVE', label: 'Streaming' }
    },
    {
      id: 'free_tv',
      name: 'Free TV Networks',
      description: 'Pluto · Tubi · Plex · YouTube — synced watch parties',
      icon: RadioTower,
      gradient: 'from-red-500 via-amber-500 to-yellow-400',
      glow: 'rgba(251,191,36,0.55)',
      image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?crop=entropy&cs=srgb&fm=jpg',
      path: '/free-tv',
      stats: { count: '4', label: 'Networks' }
    },
    {
      id: 'cinema_room',
      name: 'Cinema Room',
      description: 'Curated public-domain classics · sync-watch with anyone',
      icon: Film,
      gradient: 'from-amber-400 via-rose-500 to-purple-700',
      glow: 'rgba(251,191,36,0.5)',
      image: 'https://images.unsplash.com/photo-1485095329183-d0797cdc5676?crop=entropy&cs=srgb&fm=jpg',
      path: '/cinema-room',
      stats: { count: 'CLASSIC', label: 'Sync-Watch' }
    },
    {
      id: 'dsg_music_group',
      name: 'DSG Music Group',
      description: '70/30 Revolution — beats, battles, collab matchmaker',
      icon: Music,
      gradient: 'from-yellow-400 via-amber-500 to-orange-600',
      glow: 'rgba(251,191,36,0.5)',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/music-group',
      stats: { count: '70/30', label: 'Pillar 01' }
    },
    {
      id: 'yellow_pages',
      name: 'Vibe Yellow Pages',
      description: 'Mom & Pop directory — DSG Guard verified · hyper-local',
      icon: BookMarked,
      gradient: 'from-yellow-400 via-yellow-500 to-orange-500',
      glow: 'rgba(253,224,71,0.5)',
      image: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?crop=entropy&cs=srgb&fm=jpg',
      path: '/yellow-pages',
      stats: { count: 'NEW', label: 'Pillar 04' }
    },
    {
      id: 'beat_vault',
      name: 'Beat Vault',
      description: 'Auction & buy beats — artists keep 70% forever',
      icon: Music,
      gradient: 'from-yellow-400 via-amber-500 to-orange-600',
      glow: 'rgba(251,191,36,0.5)',
      image: 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/beat-vault',
      stats: { count: '70/30', label: 'Revolution' }
    },
    {
      id: 'memory_bank',
      name: 'Memory Bank',
      description: 'Sync-watch movies on Cinema Dates with your match',
      icon: Heart,
      gradient: 'from-rose-500 via-pink-600 to-purple-700',
      glow: 'rgba(244,63,94,0.5)',
      image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/memory-bank',
      stats: { count: '∞', label: 'Date Nights' }
    },
    {
      id: 'vigilant_matchmaking',
      name: 'Vigilant Matchmaking',
      description: '98% synergy logic — find your true Player 2',
      icon: Sparkles,
      gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?crop=entropy&cs=srgb&fm=jpg',
      path: '/dsg/matchmaking',
      stats: { count: '98%', label: 'Synergy' }
    },
    {
      id: 'cultural_onboarding',
      name: 'Cultural Profile',
      description: 'Set your home, dialect & cultural values for 200% global fit',
      icon: Languages,
      gradient: 'from-emerald-400 via-cyan-500 to-blue-600',
      glow: 'rgba(20,184,166,0.5)',
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?crop=entropy&cs=srgb&fm=jpg',
      path: '/dating/cultural-onboarding',
      stats: { count: '4', label: 'Steps' }
    },
    {
      id: 'voice_mirror',
      name: 'Voice Mirror',
      description: 'Pair your voice with a partner — chat hands-free',
      icon: Mic,
      gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?crop=entropy&cs=srgb&fm=jpg',
      path: '/voice-mirror',
      stats: { count: '🎙', label: 'Pair Up' }
    },
    {
      id: 'rides',
      name: 'Vibes Rides',
      description: 'Safe, verified transportation for dates',
      icon: Car,
      gradient: 'from-blue-600 via-sky-500 to-cyan-400',
      glow: 'rgba(59,130,246,0.5)',
      image: 'https://images.unsplash.com/photo-1673293964910-1a7dc4d5aa47?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwxfHx0cnVzdHdvcnRoeSUyMHNhZmUlMjBkcml2ZXIlMjBjYXIlMjBpbnRlcmlvciUyMG1vZGVybnxlbnwwfHx8fDE3NzM2OTkzMTl8MA&ixlib=rb-4.1.0&q=85',
      path: '/rides',
      stats: { count: '100%', label: 'Verified' }
    },
    // ─────── May 2026 PDF batch (Streamer Revenue / Master Tech /
    //         Party Hub blueprints). Each room runs on the already-
    //         shipped /api/streamer-actions/* + /api/dsg-guard/* rails.
    {
      id: 'vibetionary',
      name: 'Vibe-tionary',
      description: 'Collaborative neon-light drawing — guess the AI prompt for 1.5× stake',
      icon: PenTool,
      gradient: 'from-cyan-400 via-fuchsia-500 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/vibe-tionary',
      stats: { count: 'NEW', label: 'Party Hub' }
    },
    {
      id: 'meme_matchmaker',
      name: 'Meme Matchmaker',
      description: 'Underground Club — vote with 3D Glass Emojis · 86.5% winner share',
      icon: Smile,
      gradient: 'from-fuchsia-500 via-pink-500 to-amber-400',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/meme-matchmaker',
      stats: { count: 'NEW', label: 'Vote-to-Earn' }
    },
    {
      id: 'hide_seek',
      name: 'Vibe-Hide & Seek',
      description: 'Geo-spatial hunt across local Yellow Pages merchants — 5% kickback',
      icon: Search,
      gradient: 'from-emerald-400 via-cyan-500 to-amber-300',
      glow: 'rgba(16,185,129,0.5)',
      image: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?crop=entropy&cs=srgb&fm=jpg',
      path: '/party/hide-seek',
      stats: { count: 'NEW', label: 'Local Mining' }
    },
    {
      id: 'blind_auction',
      name: 'Blind Auction',
      description: 'Frost-filtered profiles · highest bid vs 98% synergy auto-bridge',
      icon: Eye,
      gradient: 'from-rose-500 via-pink-500 to-amber-300',
      glow: 'rgba(244,63,94,0.5)',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=srgb&fm=jpg',
      path: '/dating/blind-auction',
      stats: { count: 'NEW', label: 'Game Show' }
    },
    {
      id: 'vibeshopper',
      name: 'VibeShopper Hunt',
      description: 'Daily Odd Item Loop · 1.5× VibeXP boost · Vibe Vault escrow',
      icon: ShoppingBag,
      gradient: 'from-amber-400 via-orange-500 to-fuchsia-500',
      glow: 'rgba(245,158,11,0.5)',
      image: 'https://images.unsplash.com/photo-1601598704991-eef6114775c3?crop=entropy&cs=srgb&fm=jpg',
      path: '/vibeshopper',
      stats: { count: 'NEW', label: 'Direct-to-Shelf' }
    },
    {
      id: 'beat_vault_dlc',
      name: 'Beat Vault DLC',
      description: 'Mint finished tracks as Vibe DLC — artist keeps 70% forever',
      icon: Disc3,
      gradient: 'from-amber-500 via-orange-500 to-yellow-300',
      glow: 'rgba(217,119,6,0.5)',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=srgb&fm=jpg',
      path: '/beat-vault/dlc',
      stats: { count: 'NEW', label: '70/30' }
    },
    {
      id: 'streamer_overlay',
      name: 'Streamer Overlay',
      description: 'OBS browser source — heckle / buff / hype meter live FX',
      icon: Radio,
      gradient: 'from-violet-500 via-fuchsia-500 to-pink-500',
      glow: 'rgba(139,92,246,0.5)',
      image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?crop=entropy&cs=srgb&fm=jpg',
      path: '/streamer/overlay/demo',
      stats: { count: 'OBS', label: 'Live FX' }
    },
    // ─────── May 2026 — Music Arena + TV Totem Pole Blueprints ───────
    {
      id: 'sound_check',
      name: 'Sound-Check Gauntlet',
      description: '15-second flips · Vibe / No-Vibe swipe · Live Pilot Slot reward',
      icon: Headphones,
      gradient: 'from-fuchsia-500 via-pink-500 to-amber-300',
      glow: 'rgba(217,70,239,0.5)',
      image: 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/sound-check',
      stats: { count: 'NEW', label: 'Music Arena' }
    },
    {
      id: 'collab_matchmaker',
      name: 'Collab Matchmaker',
      description: '98% Synergy Logic · pair producers with vocalists in Vibe Suites',
      icon: Mic2,
      gradient: 'from-cyan-400 via-fuchsia-500 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/collab-matchmaker',
      stats: { count: '98%', label: 'Synergy' }
    },
    {
      id: 'totem_battles',
      name: 'Totem Pole Battles',
      description: '1v1 music-video battles · audience gifts decide · Power Hour ×1.5',
      icon: Swords,
      gradient: 'from-orange-500 via-rose-500 to-amber-300',
      glow: 'rgba(249,115,22,0.5)',
      image: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/totem-battles',
      stats: { count: 'LIVE', label: 'Battles' }
    },
    {
      id: 'tv_totem_pole',
      name: 'Vibe TV · Totem Pole',
      description: 'Audience-survival queue · Tip-to-Shield · 18+ age gating',
      icon: Tv,
      gradient: 'from-purple-500 via-pink-500 to-amber-300',
      glow: 'rgba(168,85,247,0.5)',
      image: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?crop=entropy&cs=srgb&fm=jpg',
      path: '/tv/totem-pole',
      stats: { count: 'NEW', label: 'PG-13 / 18+' }
    },
    {
      id: 'vibe_suite',
      name: 'Vibe Suite',
      description: 'Live producer↔vocalist co-recording · Agora RTC · Pay-to-Suggest',
      icon: Mic2,
      gradient: 'from-cyan-400 via-fuchsia-500 to-rose-400',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/vibe-suite/demo',
      stats: { count: 'LIVE', label: 'Agora RTC' }
    },
    {
      id: 'lyric_glasshouse',
      name: 'Lyric Glasshouse',
      description: '3D frequency-reactive visualizer — drop into OBS as a scene',
      icon: Sparkle,
      gradient: 'from-cyan-300 via-fuchsia-400 to-amber-300',
      glow: 'rgba(34,211,238,0.5)',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=srgb&fm=jpg',
      path: '/music/glasshouse',
      stats: { count: '3D', label: 'WebGL' }
    },
    {
      id: 'cyber_casino',
      name: 'Cyber Casino',
      description: 'Unity WebGL casino games · 72-hour God-Mode escrow rewards',
      icon: Joystick,
      gradient: 'from-violet-500 via-fuchsia-500 to-cyan-400',
      glow: 'rgba(139,92,246,0.5)',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?crop=entropy&cs=srgb&fm=jpg',
      path: '/cyber-casino',
      stats: { count: 'WebGL', label: 'Unity' }
    },
    // ─────── Feb 2026 — High Roller VIP Casino + Media Master ecosystem ───────
    {
      id: 'high_roller',
      name: 'High Roller VIP',
      description: '10,000₵ minimums · Blackjack · Roulette · Baccarat · VIP-gated',
      icon: Diamond,
      gradient: 'from-amber-300 via-yellow-500 to-orange-600',
      glow: 'rgba(251,191,36,0.6)',
      image: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?crop=entropy&cs=srgb&fm=jpg',
      path: '/casino/high-roller',
      stats: { count: 'VIP', label: '10K Min' }
    },
    {
      id: 'media_master',
      name: 'Media Master Hub',
      description: 'DSG TV · Vibe Radio · Music Group · AI Scout — your broadcast empire',
      icon: Antenna,
      gradient: 'from-rose-500 via-fuchsia-500 to-indigo-600',
      glow: 'rgba(244,63,94,0.5)',
      image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?crop=entropy&cs=srgb&fm=jpg',
      path: '/media-master',
      stats: { count: '4', label: 'Channels' }
    },
    {
      id: 'broadcast_director',
      name: 'Broadcast Director',
      description: 'Program DSG TV channels · break-in banners · live cut-ins',
      icon: Clapperboard,
      gradient: 'from-indigo-500 via-purple-600 to-rose-500',
      glow: 'rgba(99,102,241,0.5)',
      image: 'https://images.unsplash.com/photo-1559584098-1280cf2fe2c9?crop=entropy&cs=srgb&fm=jpg',
      path: '/dashboard/streamer/broadcast-director',
      stats: { count: 'LIVE', label: 'Programmer' }
    },
    {
      id: 'equity_master',
      name: 'Equity & Governance',
      description: 'Crewmate Architecture · 30% revenue split · Diamond Market Logic',
      icon: Gem,
      gradient: 'from-amber-300 via-fuchsia-400 to-cyan-300',
      glow: 'rgba(251,191,36,0.6)',
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?crop=entropy&cs=srgb&fm=jpg',
      path: '/equity',
      stats: { count: '30%', label: 'To Owners' }
    },
    {
      id: 'ambassador_care',
      name: 'Ambassador Care Package',
      description: "Walking Advertisements · 3-Month Diamond Challenge · 4 ways to earn",
      icon: Award,
      gradient: 'from-amber-300 via-orange-500 to-rose-500',
      glow: 'rgba(251,146,60,0.6)',
      image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?crop=entropy&cs=srgb&fm=jpg',
      path: '/ambassador',
      stats: { count: '90d', label: 'Challenge' }
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <motion.div 
          className="text-white text-xl"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading your universe...
        </motion.div>
      </div>
    );
  }

  return (
    <RoomLayout theme="games" showStars={true}>
      {/* Notification Banner - Only shows after login */}
      <NotificationBanner />
      

      {/* Header */}
      <header className="relative z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">Global Vibez DSG</h1>
              <p className="text-xs text-slate-300">The Social Multiverse</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <CreditBalance />
            <DashboardSpinBadge isAdmin={!!user?.is_admin} />
            
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-fuchsia-200 hover:text-white hover:bg-fuchsia-500/20 border border-fuchsia-400/40 rounded-full px-3 md:px-4 py-1.5 text-[10px] md:text-xs uppercase tracking-widest animate-pulse"
              onClick={() => {
                // 2026-05-12 (fix v2 + backlog #8): write localStorage AND
                // dispatch event so the router re-renders instantly. Show
                // a "Saved as default" toast on first volumetric toggle.
                const seen = localStorage.getItem("gv_dashboard_view_seen") === "1";
                switchDashboardView("volumetric");
                if (!seen) {
                  localStorage.setItem("gv_dashboard_view_seen", "1");
                  import("sonner").then(({ toast }) => {
                    toast.success("Volumetric Galaxy saved as your default", {
                      description: "Switch back anytime from Classic View.",
                    });
                  });
                }
                navigate("/dashboard");
              }}
              aria-label="Switch to volumetric view"
              data-testid="dashboard-try-volumetric"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Try Volumetric</span>
              <span className="sm:hidden">3D</span>
            </Button>

            <GlassCard className="px-4 py-2" hoverable={false}>
              <div className="text-white text-sm">
                <span className="font-semibold">{user?.name}</span>
                {user?.membership_type !== 'free' && (
                  <Crown className="w-4 h-4 inline-block ml-2 text-yellow-400" />
                )}
              </div>
            </GlassCard>
            
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => navigate('/profile/edit')}
              aria-label="Settings"
              title="Settings"
              data-testid="dashboard-settings-btn"
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              data-testid="dashboard-logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Welcome Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Welcome Back, <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span>
          </h2>
          <p className="text-xl text-slate-300">
            Choose your destination in the Global Vibez DSG universe
          </p>
        </motion.div>

        {/* 💸 Unified Earnings widget — auto-hides if user has zero income
            across every role and zero properties / streams. Surfaces income
            roll-up so multi-role users (driver + host + merchant + streamer)
            see one number instead of hunting between dashboards. */}
        <div className="max-w-3xl mx-auto mb-8">
          <UnifiedEarningsWidget />
        </div>

        {/* 🌌 Volumetric preview banner — founder ask 2026-05-12 ("build it
            first to see what it looks like; if I don't like it, take it
            off"). Big, can't-miss A/B toggle into the new Three.js dashboard. */}
        <motion.button
          type="button"
          onClick={() => {
            switchDashboardView("volumetric");
            navigate("/dashboard");
          }}
          data-testid="dashboard-volumetric-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="group relative w-full mb-8 overflow-hidden rounded-2xl border-2 border-fuchsia-400/50 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/30 to-cyan-600/30 backdrop-blur-md px-5 py-5 text-left hover:scale-[1.005] active:scale-[0.995] transition-transform shadow-[0_0_40px_-10px_rgba(217,70,239,0.6)]"
        >
          <div className="absolute -inset-px bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/30 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="text-4xl md:text-5xl animate-pulse">🌌</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300 font-bold flex items-center gap-2">
                NEW · Founder Preview
                <span className="bg-amber-400 text-amber-950 text-[8px] px-2 py-0.5 rounded-full font-black">A/B</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-white mt-1">
                Try the Volumetric Galaxy Dashboard
              </div>
              <div className="text-xs sm:text-sm text-fuchsia-100/80 mt-1">
                6 emissive planets · drag to spin · tap to dive in. Don't like it? One tap brings you back to Classic.
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-fuchsia-200 text-xs uppercase tracking-widest font-black">
              Open 3D →
            </div>
          </div>
        </motion.button>

        {/* Chair-holder vote banner — chair holders only, auto-hides if no open polls */}
        <ChairHolderVoteBanner />

        {/* What's New — May 2026 PDF batch (Streamer Revenue / Master
            Tech / Party Hub blueprints). Surfaces the seven new rooms
            shipped this week so the founder/users can find them. */}
        <motion.div
          data-testid="whats-new-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mb-10 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/10 via-cyan-500/5 to-amber-500/10 backdrop-blur-md px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-amber-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300 font-bold">
                What's New · May 2026
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                15 new rooms live — Vibe-tionary, Meme Matchmaker, Hide & Seek (now with Mapbox),
                Blind Auction, VibeShopper Hunt, Beat Vault DLC, Streamer Overlay,
                Sound-Check Gauntlet, Collab Matchmaker, Totem Pole Battles, Vibe TV Totem Pole,
                Vibe Suite (Agora RTC), Lyric Glasshouse (3D), Cyber Casino (Unity WebGL)
              </div>
              <div className="text-xs text-white/70 mt-1">
                Powered by the <span className="text-cyan-300 font-bold">Streamer Action Hub</span>, <span className="text-amber-300 font-bold">DSG Guard</span>, and <span className="text-fuchsia-300 font-bold">Totem Pole rails</span> ·
                70/13.5/10 split locked · Power Hour ×1.5 · 98% Synergy · Tip-to-Shield $2/5min ·
                {' '}
                <a href="/streamer/setup-guide" className="underline text-emerald-300">Streamer Setup Guide →</a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Ride Home — Roadmap PDF §3. One-tap geo-locked ride from
            the lobby. Hands off to /rides with lat/lng pre-filled. */}
        <div
          data-testid="dashboard-ride-home-row"
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-950/60 via-slate-950/40 to-cyan-950/40 backdrop-blur p-4"
        >
          <div className="text-white/90">
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-300">Need a lift?</p>
            <p className="text-base sm:text-lg font-black">One-tap Ride Home from anywhere on the platform.</p>
          </div>
          <RideHomeButton />
        </div>

        {/* ─────── Live Right Now pill — surfaces momentum so users
              drop into the busiest category at a glance. Hidden when
              the whole platform is quiet (avoids "0 live everywhere"
              credibility kill). */}
        <LivePulsePill onJump={(cat) => setActiveCategory(cat)} />

        {/* ─────── Hot Rooms carousel — top 3 individual live rooms by
              audience. Turns the pulse counter into an invitation. */}
        <HotRoomsCarousel />

        {/* ─────── Category Tabs (founder ask 2026-05-16: less scroll,
              sectioned by category. Less mess, more focus. Active tab
              borrows the MY VIBEZ holographic treatment so the choice
              feels alive. */}
        <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {rooms
            .filter((r) => activeCategory === 'all' || ROOM_CATEGORY[r.id] === activeCategory)
            .map((room, index) => {
            const Icon = room.icon;
            const isMyVibez = room.id === 'myvibez';

            // MY VIBEZ gets a custom vibrant "holographic" treatment so
            // it pops against the rest of the grid (founder ask, May
            // 2026). All other tiles render the standard GlassCard.
            if (isMyVibez) {
              return (
                <motion.div
                  key={room.id}
                  data-testid="dashboard-card-myvibez"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(room.path)}
                    className="group relative w-full h-full text-left rounded-2xl overflow-hidden ring-1 ring-fuchsia-400/40 hover:ring-amber-300/70 transition-all"
                    style={{
                      boxShadow: '0 0 70px -12px rgba(232,121,249,0.55), 0 0 90px -20px rgba(34,211,238,0.35)',
                    }}
                  >
                    {/* Animated holographic gradient layer */}
                    <div
                      className="absolute inset-0 opacity-90"
                      style={{
                        background:
                          'conic-gradient(from 0deg, #f0abfc, #fde047, #67e8f9, #fb7185, #c084fc, #fde047, #f0abfc)',
                        filter: 'blur(34px) saturate(140%)',
                        animation: 'spin 18s linear infinite',
                      }}
                    />
                    <div className="absolute inset-0 bg-black/55" />

                    {/* Floating sparkles */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {[...Array(8)].map((_, i) => (
                        <motion.span
                          key={i}
                          className="absolute w-1 h-1 rounded-full bg-white"
                          initial={{ opacity: 0 }}
                          animate={{
                            opacity: [0, 1, 0],
                            y: [-10, -50],
                            x: [0, (i % 2 === 0 ? 1 : -1) * 18],
                          }}
                          transition={{
                            duration: 2.4 + (i % 4) * 0.3,
                            repeat: Infinity,
                            delay: i * 0.35,
                            ease: 'easeOut',
                          }}
                          style={{ left: `${10 + i * 11}%`, bottom: '20%' }}
                        />
                      ))}
                    </div>

                    <div className="relative p-5 sm:p-6 min-h-[180px] flex flex-col justify-between">
                      {/* Top row: badge + stats */}
                      <div className="flex items-start justify-between">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                          <Sparkle className="w-3 h-3" /> Trending Now
                        </span>
                        <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-xs">
                          <span className="text-amber-300 font-mono font-bold">{room.stats.count}</span>
                          <span className="text-white/70 ml-1">{room.stats.label}</span>
                        </div>
                      </div>

                      {/* Title + icon */}
                      <div className="mt-6">
                        <motion.div
                          whileHover={{ scale: 1.08, rotate: -4 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
                          style={{
                            background:
                              'linear-gradient(135deg, #f0abfc 0%, #fde047 50%, #67e8f9 100%)',
                          }}
                        >
                          <Icon className="w-6 h-6 text-black" />
                        </motion.div>
                        <h3
                          className="text-2xl sm:text-3xl font-black tracking-tight"
                          style={{
                            background:
                              'linear-gradient(90deg, #fff 0%, #fde047 50%, #f0abfc 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >
                          {room.name}
                        </h3>
                        <p className="text-sm text-white/80 mt-1.5 line-clamp-2">
                          {room.description}
                        </p>
                      </div>

                      {/* CTA */}
                      <div className="mt-4 inline-flex self-start items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold text-black bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300 group-hover:scale-[1.04] transition-transform">
                        Enter <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <GlassCard
                  hoverable={true}
                  onClick={() => navigate(room.path)}
                  glow={true}
                  glowColor={room.glow}
                  className="group overflow-hidden h-full"
                >
                  {/* Background Image */}
                  <div className="relative h-36 overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-500"
                      style={{ backgroundImage: `url(${room.image})` }}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${room.gradient} opacity-60 group-hover:opacity-40 transition-opacity duration-300`} />

                    {/* Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Icon className="w-14 h-14 text-white drop-shadow-2xl" />
                      </motion.div>
                    </div>

                    {/* Stats Badge */}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs">
                      <span className="text-white font-mono font-bold">{room.stats.count}</span>
                      <span className="text-slate-300 ml-1">{room.stats.label}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {room.name}
                    </h3>
                    <p className="text-sm text-slate-300 mb-3 line-clamp-2">
                      {room.description}
                    </p>

                    <div className={`inline-flex items-center gap-1.5 text-white text-sm font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r ${room.gradient}`}>
                      <span>Enter</span>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <GlassCard className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {user?.membership_type === 'free' ? 'Unlock Premium Features' : 'Your Premium Status'}
                </h3>
                <p className="text-slate-300">
                  {user?.membership_type === 'free' 
                    ? 'Get unlimited access to all rooms, games, and exclusive features'
                    : 'You have access to all premium features across the universe'
                  }
                </p>
              </div>
              
              <div className="flex gap-4">
                {user?.membership_type === 'free' && (
                  <NeonButton
                    variant="gradient"
                    onClick={() => navigate('/pricing')}
                  >
                    <Crown className="w-5 h-5 inline-block mr-2" />
                    Upgrade Now
                  </NeonButton>
                )}
                
                <NeonButton
                  variant="ghost"
                  onClick={() => navigate('/practice')}
                >
                  <Gamepad2 className="w-5 h-5 inline-block mr-2" />
                  Practice Mode
                </NeonButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <AppFooter />
    </RoomLayout>
  );
}
