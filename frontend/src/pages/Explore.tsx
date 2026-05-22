/**
 * /explore — Global Vibez Master Index
 *
 * One searchable catalog of every meaningful user destination on the
 * platform. Replaces "where's the X room?" questions with one place.
 *
 * Sourced from a hand-curated manifest (route + category + tags + one
 * line). A regression test counts entries so the manifest doesn't
 * silently shrink — and as new surfaces ship the registry below is
 * the single place to add them.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search, ArrowLeft, ChevronRight, Sparkles,
  Dice6, Music2, Heart, Tv, Wallet, Crown, Spade, Compass,
} from 'lucide-react';

type Cat = 'casino' | 'music' | 'dating' | 'streaming' | 'wallet' | 'founder';

const CATEGORY_META: Record<Cat, { label: string; Icon: any; tint: string }> = {
  casino: { label: 'Casino & Cards', Icon: Spade, tint: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10' },
  music: { label: 'Music & Media', Icon: Music2, tint: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10' },
  dating: { label: 'Dating & Social', Icon: Heart, tint: 'text-pink-300 border-pink-400/40 bg-pink-500/10' },
  streaming: { label: 'Streaming', Icon: Tv, tint: 'text-rose-300 border-rose-400/40 bg-rose-500/10' },
  wallet: { label: 'Wallet & Rewards', Icon: Wallet, tint: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' },
  founder: { label: 'Founder Tools', Icon: Crown, tint: 'text-amber-300 border-amber-400/40 bg-amber-500/10' },
};

type Entry = { route: string; title: string; subtitle: string; cat: Cat; tags: string[] };

// Curated catalog — single source of truth for the Explore page.
// Add new surfaces here as they ship. A regression test enforces
// minimum entry count.
export const EXPLORE_REGISTRY: Entry[] = [
  // Casino & Cards
  { route: '/vibe-654-hall', title: 'Vibez 654 Hall', subtitle: 'Master hub · all 7 dice variants', cat: 'casino', tags: ['dice', '654', 'hub', 'parlour'] },
  { route: '/vibez-654', title: 'Vibez 654 Classic', subtitle: "Nova's parlour · single-player dice", cat: 'casino', tags: ['dice', '654', 'classic'] },
  { route: '/dice', title: 'VibeDice 654 Premium', subtitle: 'Marble floor · gold orbit ring', cat: 'casino', tags: ['dice', 'premium'] },
  { route: '/vibe-654/solo', title: 'Solo High-Roller Vault', subtitle: '1-vs-AI underground · ≥ 50K ₵', cat: 'casino', tags: ['dice', 'solo', 'highroller'] },
  { route: '/vibe-654/prescription', title: 'Prescription Room', subtitle: 'Sovereign tier · 6→5→4 with re-rolls', cat: 'casino', tags: ['dice', 'sovereign', '654'] },
  { route: '/games/vibe654/tournament', title: 'Tournament Lobby', subtitle: '20-player tables · create your own', cat: 'casino', tags: ['dice', 'tournament', 'lobby'] },
  { route: '/chess-hall', title: 'Chess Hall', subtitle: 'Daily puzzles · ranked play', cat: 'casino', tags: ['chess'] },
  { route: '/chess/blitz', title: 'Chess Blitz', subtitle: 'Fast time-control matches', cat: 'casino', tags: ['chess', 'blitz'] },
  { route: '/chess/puzzle', title: 'Chess Daily Puzzle', subtitle: 'One curated FEN per day', cat: 'casino', tags: ['chess', 'puzzle'] },
  { route: '/chess/tournament', title: 'Chess Tournament', subtitle: '4-player single-elim bracket', cat: 'casino', tags: ['chess', 'tournament'] },
  { route: '/chess/multiplayer', title: 'Multiplayer Chess', subtitle: 'Solid-light holo pieces · PvP', cat: 'casino', tags: ['chess', 'holo'] },
  { route: '/blackjack', title: 'Blackjack', subtitle: 'Casino floor · split / double / surrender', cat: 'casino', tags: ['blackjack', 'cards'] },
  { route: '/baccarat', title: 'Baccarat', subtitle: 'Punto banco · dragon bonus', cat: 'casino', tags: ['baccarat', 'cards'] },
  { route: '/spades', title: 'Spades', subtitle: 'Classic 4-player bid game', cat: 'casino', tags: ['spades', 'cards'] },
  { route: '/bid-whist-lobby', title: 'Bid Whist', subtitle: 'Lobby + AAA variant', cat: 'casino', tags: ['whist', 'cards'] },
  { route: '/casino/high-roller', title: 'High-Roller VIP', subtitle: 'Premium-tier rooms · 100K+ ₵ stakes', cat: 'casino', tags: ['vip', 'highroller'] },
  { route: '/craps', title: 'Craps', subtitle: 'Traditional pass-line action', cat: 'casino', tags: ['craps'] },
  { route: '/roulette', title: 'Roulette', subtitle: 'European wheel', cat: 'casino', tags: ['roulette'] },
  { route: '/big-six-wheel', title: 'Big Six Wheel', subtitle: 'Spin & win', cat: 'casino', tags: ['wheel'] },
  { route: '/uno', title: 'UNO', subtitle: 'Color-match card duels', cat: 'casino', tags: ['uno', 'cards'] },
  { route: '/spades', title: 'Card Royale', subtitle: 'Modern remix of classics', cat: 'casino', tags: ['cards', 'royale'] },

  // Music & Media
  { route: '/plex', title: 'Plex Rooms', subtitle: 'Living rooms · Gaming · Dating · Showcase', cat: 'music', tags: ['plex', 'living-room', 'affinity'] },
  { route: '/artist/onboarding', title: 'Drop a Track', subtitle: '60-second creator funnel', cat: 'music', tags: ['artist', 'onboarding', 'music'] },
  { route: '/artist/dashboard', title: 'Creator Studio', subtitle: '80% take · ledger · Gas-Out', cat: 'music', tags: ['artist', 'creator', 'gas-out'] },
  { route: '/artist/music-group', title: 'DSG Music Group', subtitle: 'Rights ledger · collaborator splits · royalty audit', cat: 'music', tags: ['artist', 'music-group', 'splits', 'royalty', 'rights'] },
  { route: '/marketplace/license', title: 'License Marketplace', subtitle: 'TV sync · casino BG · commercial ad licensing', cat: 'music', tags: ['license', 'marketplace', 'sync', 'tv', 'commercial', 'broadcaster'] },
  { route: '/driver/cargo', title: 'Cargo Driver Console', subtitle: 'Retail manifests · dual-barcode lock · 80/20 split', cat: 'streaming', tags: ['driver', 'cargo', 'retail', 'viberidez', 'logistics'] },
  { route: '/cinema-room', title: 'Cinema Room', subtitle: 'Synchronous watch party', cat: 'music', tags: ['cinema', 'video'] },
  { route: '/beat-vault/dlc', title: 'Beat Vault DLC', subtitle: 'Premium production drops', cat: 'music', tags: ['vault', 'beats'] },

  // Dating & Social
  { route: '/dating', title: 'Dating', subtitle: 'Profile-first matchmaking', cat: 'dating', tags: ['dating'] },
  { route: '/ai-date-planner', title: 'AI Date Planner', subtitle: 'GPT-powered itinerary', cat: 'dating', tags: ['dating', 'ai', 'planner'] },
  { route: '/dating/blind-auction', title: 'Blind Auction', subtitle: 'Anonymous bid → reveal date', cat: 'dating', tags: ['dating', 'auction'] },
  { route: '/date-spot-finder', title: 'Date Spot Finder', subtitle: 'Curated venues near you', cat: 'dating', tags: ['dating', 'spots'] },
  { route: '/couples-tournaments', title: 'Couples Tournaments', subtitle: 'Compete as a duo', cat: 'dating', tags: ['dating', 'tournament'] },
  { route: '/affiliate', title: 'Affiliate', subtitle: 'Refer & earn', cat: 'dating', tags: ['affiliate'] },

  // Streaming
  { route: '/dsg-tv', title: 'DSG TV', subtitle: 'Prestige · Stools · Predict-to-Win', cat: 'streaming', tags: ['dsg-tv', 'prestige', 'predict', 'stools'] },
  { route: '/dsg-logistics', title: 'DSG Logistics Hub', subtitle: 'Emergency · Hardware · Tier · Creator Kitchen', cat: 'streaming', tags: ['logistics', 'driver', 'kitchen', 'safety', 'ridez', 'hunger'] },
  { route: '/browse-streams', title: 'Browse Streams', subtitle: 'Live DSG TV channels', cat: 'streaming', tags: ['streaming', 'tv'] },
  { route: '/dashboard/streamer/broadcast-director', title: 'Broadcast Director', subtitle: 'Streamer command center', cat: 'streaming', tags: ['streaming', 'director'] },

  // Wallet & Rewards
  { route: '/daily-spin', title: 'Daily Spin Wheel', subtitle: 'Tier-based prizes · once / 24h', cat: 'wallet', tags: ['rewards', 'spin', 'wheel'] },
  { route: '/daily-challenges', title: 'Daily Challenges', subtitle: 'Earn ₵ via quests', cat: 'wallet', tags: ['rewards', 'quests'] },
  { route: '/achievements', title: 'Achievement Badges', subtitle: 'Unlock lifetime badges', cat: 'wallet', tags: ['rewards', 'badges'] },
  { route: '/cosmetics-shop', title: 'Cosmetics Shop', subtitle: 'Profile skins · card decks', cat: 'wallet', tags: ['cosmetics', 'shop'] },
  { route: '/pricing', title: 'Pricing', subtitle: 'Memberships · power-ups', cat: 'wallet', tags: ['pricing'] },
  { route: '/battle-pass', title: 'Battle Pass', subtitle: 'Seasonal tier rewards', cat: 'wallet', tags: ['battlepass'] },
  { route: '/bonds', title: 'Vibez Bonds', subtitle: 'Long-form yield assets', cat: 'wallet', tags: ['bonds'] },
  { route: '/community-slots', title: 'Community Slots', subtitle: 'Pooled slot draws', cat: 'wallet', tags: ['slots'] },

  // Founder Tools
  { route: '/roadmap', title: 'Roadmap Hub', subtitle: 'Everything shipping next', cat: 'founder', tags: ['roadmap'] },
  { route: '/admin', title: 'Admin Console', subtitle: 'Top-level ops surface', cat: 'founder', tags: ['admin'] },
  { route: '/admin/recirculation', title: 'Recirculation Dashboard', subtitle: '40/30/30 pool monitor', cat: 'founder', tags: ['admin', 'recirculation', 'treasury'] },
  { route: '/admin/treasury', title: 'Treasury Operations', subtitle: 'Treasury bucket controls', cat: 'founder', tags: ['admin', 'treasury'] },
  { route: '/admin/payments-audit', title: 'Payments Audit', subtitle: 'Stripe drift detection', cat: 'founder', tags: ['admin', 'payments', 'audit'] },
  { route: '/admin/pricing', title: 'Pricing Catalog', subtitle: 'Live price editor', cat: 'founder', tags: ['admin', 'pricing'] },
  { route: '/admin/payouts', title: 'Payouts', subtitle: 'Creator + driver payouts', cat: 'founder', tags: ['admin', 'payouts'] },
  { route: '/admin/tier-pricing', title: 'Tier Pricing', subtitle: 'High-Roller tier config', cat: 'founder', tags: ['admin', 'tiers'] },
  { route: '/admin/users', title: 'User Management', subtitle: 'Search + moderation', cat: 'founder', tags: ['admin', 'users'] },
  { route: '/admin/analytics', title: 'Analytics', subtitle: 'Engagement + revenue charts', cat: 'founder', tags: ['admin', 'analytics'] },
  { route: '/admin/monitoring', title: 'System Monitoring', subtitle: 'Backend health + worker queues', cat: 'founder', tags: ['admin', 'monitoring'] },
  { route: '/admin/sos', title: 'SOS Center', subtitle: 'Real-time safety alerts', cat: 'founder', tags: ['admin', 'safety'] },
  { route: '/admin/moderation', title: 'Moderation', subtitle: 'Content review queue', cat: 'founder', tags: ['admin', 'moderation'] },
  { route: '/admin/transactions', title: 'Transactions', subtitle: 'Live ledger viewer', cat: 'founder', tags: ['admin', 'ledger'] },
];

export default function Explore() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<Cat | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXPLORE_REGISTRY.filter((e) => {
      if (activeCat !== 'all' && e.cat !== activeCat) return false;
      if (!q) return true;
      const hay = `${e.title} ${e.subtitle} ${e.route} ${e.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, activeCat]);

  const counts = useMemo(() => {
    const out: Record<Cat | 'all', number> = {
      all: EXPLORE_REGISTRY.length,
      casino: 0, music: 0, dating: 0, streaming: 0, wallet: 0, founder: 0,
    };
    EXPLORE_REGISTRY.forEach((e) => { out[e.cat]++; });
    return out;
  }, []);

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="explore-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-white/10 backdrop-blur-md bg-[#06080f]/95">
        <div className="max-w-5xl mx-auto flex items-center gap-4 flex-wrap">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="explore-back"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="flex items-center gap-2 text-base md:text-xl tracking-[0.3em] uppercase text-fuchsia-200">
            <Compass className="w-5 h-5" /> Explore
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-white/40" data-testid="explore-count">
            {filtered.length} of {counts.all} surfaces
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms, games, tools…"
            className="bg-black/40 border border-white/10 text-white pl-9"
            data-testid="explore-search"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2" data-testid="explore-category-chips">
          <button
            type="button"
            onClick={() => setActiveCat('all')}
            data-testid="explore-chip-all"
            className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors flex items-center gap-1.5 ${
              activeCat === 'all'
                ? 'bg-fuchsia-500/30 border-fuchsia-400/60 text-fuchsia-100'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3 h-3" /> All ({counts.all})
          </button>
          {(Object.keys(CATEGORY_META) as Cat[]).map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.Icon;
            const isActive = activeCat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                data-testid={`explore-chip-${c}`}
                className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors flex items-center gap-1.5 ${
                  isActive ? `${meta.tint} scale-105` : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3 h-3" /> {meta.label} ({counts[c]})
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card className="p-10 bg-black/30 border border-white/10 text-center" data-testid="explore-empty">
            <Compass className="w-10 h-10 mx-auto text-white/30" />
            <p className="text-base mt-3">No matches.</p>
            <p className="text-xs text-white/50 mt-1">Try a broader query, or pick a different category.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="explore-grid">
            {filtered.map((e) => {
              const meta = CATEGORY_META[e.cat];
              const Icon = meta.Icon;
              return (
                <button
                  key={e.route}
                  type="button"
                  onClick={() => navigate(e.route)}
                  data-testid={`explore-card-${e.route.replace(/\//g, '_')}`}
                  className={`text-left p-4 rounded-2xl border transition-colors hover:bg-white/10 ${meta.tint}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono truncate max-w-[140px]">
                      {e.route}
                    </span>
                  </div>
                  <p className="font-black text-white mt-2">{e.title}</p>
                  <p className="text-[11px] text-white/60 mt-0.5 leading-snug">{e.subtitle}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex flex-wrap gap-1">
                      {e.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                          {t}
                        </span>
                      ))}
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-white/30 text-center py-4" data-testid="explore-footnote">
          Curated catalog · auto-refreshes when new surfaces ship. Missing a destination?
          Ping the founder — the manifest at <span className="font-mono">/components/Explore.tsx</span> is single-source-of-truth.
        </p>
      </main>
    </div>
  );
}
