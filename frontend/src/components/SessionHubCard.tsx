/**
 * SessionHubCard — single dashboard card surfacing every new
 * destination shipped in Feb 2026 (Plex, Vibez 654 Hall, Daily Spin,
 * Artist Studio, Artist Onboarding, Prize Wheel). Without this card
 * the user has no way to discover them from the dashboard.
 *
 * Routes are clickable tiles with a one-line description and a
 * "NEW" pulse badge that fades after first visit (localStorage).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Sparkles, Disc3, Mic2, Dice6, Music2, Crown, ChevronRight,
} from 'lucide-react';

const SEEN_KEY = 'gv_session_hub_seen';

const SURFACES = [
  {
    key: 'plex',
    route: '/plex',
    title: 'Plex Rooms',
    subtitle: 'Living rooms · Gaming · Dating · Showcase',
    Icon: Sparkles,
    accent: 'from-fuchsia-500/30 to-purple-600/30 border-fuchsia-400/40',
    iconTint: 'text-fuchsia-300',
  },
  {
    key: 'vibe-654-hall',
    route: '/vibe-654-hall',
    title: 'Vibez 654 Hall',
    subtitle: 'All 7 dice variants in one place',
    Icon: Dice6,
    accent: 'from-amber-500/30 to-rose-500/30 border-amber-400/40',
    iconTint: 'text-amber-300',
  },
  {
    key: 'daily-spin',
    route: '/daily-spin',
    title: 'Daily Spin Wheel',
    subtitle: 'Tier-based prize wheel · once / 24h',
    Icon: Crown,
    accent: 'from-emerald-500/30 to-cyan-500/30 border-emerald-400/40',
    iconTint: 'text-emerald-300',
  },
  {
    key: 'artist-onboarding',
    route: '/artist/onboarding',
    title: 'Drop a Track',
    subtitle: 'Become an artist in 60 seconds',
    Icon: Mic2,
    accent: 'from-rose-500/30 to-fuchsia-500/30 border-rose-400/40',
    iconTint: 'text-rose-300',
  },
  {
    key: 'artist-dashboard',
    route: '/artist/dashboard',
    title: 'Creator Studio',
    subtitle: '80% take · Gas-Out to DSG',
    Icon: Music2,
    accent: 'from-amber-500/30 to-fuchsia-500/30 border-amber-400/40',
    iconTint: 'text-amber-300',
  },
  {
    key: 'roadmap',
    route: '/roadmap',
    title: 'Roadmap Hub',
    subtitle: 'Everything shipping next',
    Icon: Disc3,
    accent: 'from-slate-600/30 to-slate-800/30 border-white/20',
    iconTint: 'text-white/70',
  },
];

export default function SessionHubCard() {
  const navigate = useNavigate();
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      setSeen(raw ? JSON.parse(raw) : {});
    } catch {
      setSeen({});
    }
  }, []);

  const markSeen = (key: string) => {
    const next = { ...seen, [key]: true };
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* tolerate */
    }
  };

  return (
    <Card
      className="p-5 bg-black/40 border border-white/10 backdrop-blur-md"
      data-testid="session-hub-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-300">
            Sprint Surfaces · Feb 2026
          </p>
          <h3 className="text-lg font-black text-white">Everything new in one place</h3>
        </div>
        <Sparkles className="w-5 h-5 text-fuchsia-300" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SURFACES.map((s) => {
          const isNew = !seen[s.key];
          const Icon = s.Icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                markSeen(s.key);
                navigate(s.route);
              }}
              data-testid={`session-hub-tile-${s.key}`}
              className={`relative text-left p-3 rounded-xl border bg-gradient-to-br ${s.accent} hover:scale-[1.02] transition-transform`}
            >
              {isNew && (
                <span
                  className="absolute top-2 right-2 text-[8px] uppercase tracking-widest bg-rose-500 text-white px-1.5 py-0.5 rounded-full animate-pulse"
                  data-testid={`session-hub-new-${s.key}`}
                >
                  New
                </span>
              )}
              <Icon className={`w-5 h-5 ${s.iconTint}`} />
              <p className="text-sm font-black text-white mt-1.5">{s.title}</p>
              <p className="text-[11px] text-white/60 mt-0.5 leading-snug">{s.subtitle}</p>
              <ChevronRight className="w-3.5 h-3.5 text-white/40 absolute bottom-3 right-3" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
