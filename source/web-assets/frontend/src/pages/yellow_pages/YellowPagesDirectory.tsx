/**
 * Vibe Yellow Pages — Public directory (4th Pillar of Global Vibez DSG)
 *
 * Hybrid card-grid + Mapbox layout. Filters by 7 categories (Food, Beauty,
 * Home Services, Auto, Retail, Events, Adult/18+). Adult category is double-
 * gated: viewer must be age_verified AND opt-in via "Show 18+" toggle.
 *
 * Tier badges (visually distinct):
 *   • Listed   — gray  outline (free)
 *   • Verified — green shield  ($29 one-time DSG Guard)
 *   • Elite    — gold  crown   ($99 one-time + license review)
 *   • Featured — orange flame  ($19/mo top-of-zip)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, MapPin, Plus, Shield, Crown, Flame, Utensils, Sparkles, Wrench,
  Car, ShoppingBag, Music, Lock, Globe, Phone, ExternalLink, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const API = process.env.REACT_APP_BACKEND_URL;

const CAT_ICONS: Record<string, any> = {
  food: Utensils,
  beauty: Sparkles,
  home_services: Wrench,
  auto: Car,
  retail: ShoppingBag,
  events: Music,
  adult: Lock,
};

const TIER_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
  free:     { label: 'Listed',   cls: 'bg-slate-700/40 text-slate-300 border-slate-500/40',  Icon: Globe },
  verified: { label: 'Verified', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60', Icon: Shield },
  elite:    { label: 'Elite',    cls: 'bg-amber-500/20 text-amber-300 border-amber-400/70',  Icon: Crown },
  featured: { label: 'Featured', cls: 'bg-orange-500/25 text-orange-300 border-orange-400/70', Icon: Flame },
};

interface Listing {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  state?: string;
  zip_code: string;
  phone?: string;
  email?: string;
  website?: string;
  hours?: string;
  photo_url?: string;
  tier: string;
  tier_label: string;
  is_adult: boolean;
  is_featured: boolean;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  is_adult?: boolean;
  requires_age_gate?: boolean;
}

export default function YellowPagesDirectory() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showAdult, setShowAdult] = useState(false);
  const [adultBlocked, setAdultBlocked] = useState(false);

  const isAuthed = !!localStorage.getItem('auth_token');

  // Load categories once
  useEffect(() => {
    fetch(`${API}/api/yellow-pages/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  // Load listings on filter change
  useEffect(() => {
    setLoading(true);
    setAdultBlocked(false);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (zip) params.set('zip_code', zip);
    if (activeCat) params.set('category', activeCat);
    if (showAdult) params.set('show_adult', 'true');
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/api/yellow-pages/listings?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => {
        setListings(d.listings || []);
        if (d.adult_blocked) setAdultBlocked(true);
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [q, zip, activeCat, showAdult]);

  const featuredListings = useMemo(
    () => listings.filter((l) => l.is_featured),
    [listings],
  );
  const otherListings = useMemo(
    () => listings.filter((l) => !l.is_featured),
    [listings],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white" data-testid="yellow-pages-directory">
      {/* ─── Hero ─── */}
      <header className="relative overflow-hidden border-b border-yellow-500/20">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(circle at 20% 50%, rgba(253, 224, 71, 0.18), transparent 40%), radial-gradient(circle at 80% 30%, rgba(251, 146, 60, 0.18), transparent 40%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-12 sm:py-16">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white mb-4"
            data-testid="yp-back-home-btn"
          >
            ← Back to Home
          </Button>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            Vibe <span className="text-yellow-400">Yellow Pages</span>
          </h1>
          <p className="mt-3 text-base text-slate-300 max-w-2xl">
            The 4th Pillar — supporting local Mom &amp; Pop businesses. Every listing is reviewed under the
            <span className="text-yellow-300 font-semibold"> DSG Guard </span>
            safety protocol.
          </p>

          {/* Search bar */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search businesses…"
                className="pl-9 bg-slate-900/60 border-slate-700/60 text-white"
                data-testid="yp-search-input"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP code"
                inputMode="numeric"
                className="pl-9 bg-slate-900/60 border-slate-700/60 text-white"
                data-testid="yp-zip-input"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <Button
              onClick={() => navigate(isAuthed ? '/yellow-pages/new' : '/login')}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold"
              data-testid="yp-add-listing-btn"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Your Business
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/yellow-pages/pricing')}
              className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
              data-testid="yp-pricing-btn"
            >
              <Shield className="mr-2 h-4 w-4" /> DSG Guard Tiers
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Filters ─── */}
      <section className="max-w-7xl mx-auto px-6 py-6 border-b border-slate-800/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2 items-center" data-testid="yp-category-filters">
            <Button
              variant={activeCat === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCat(null)}
              className={activeCat === null ? 'bg-yellow-500 text-slate-950' : 'border-slate-700/60 text-slate-300'}
              data-testid="yp-cat-all"
            >
              All
            </Button>
            {categories.map((c) => {
              const Icon = CAT_ICONS[c.id] ?? Filter;
              const active = activeCat === c.id;
              return (
                <Button
                  key={c.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCat(active ? null : c.id)}
                  className={
                    active
                      ? 'bg-yellow-500 text-slate-950'
                      : 'border-slate-700/60 text-slate-300 hover:border-yellow-500/40'
                  }
                  data-testid={`yp-cat-${c.id}`}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {c.label}
                </Button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-400 select-none">
            <Switch
              checked={showAdult}
              onCheckedChange={setShowAdult}
              data-testid="yp-show-adult-toggle"
            />
            Show 18+ listings
          </label>
        </div>

        {showAdult && !adultBlocked && (
          <div className="mt-3 text-xs text-orange-300/80">
            18+ listings require account age verification. Listings show only after license/permit review by DSG Guard.
          </div>
        )}
        {adultBlocked && (
          <div className="mt-3 text-xs text-rose-300/90" data-testid="yp-adult-blocked-msg">
            Age verification required to view 18+ listings. Sign in and verify your age to continue.
          </div>
        )}
      </section>

      {/* ─── Listings ─── */}
      <main className="max-w-7xl mx-auto px-6 py-8 pb-24">
        {loading && (
          <div className="text-center text-slate-400 py-16">Loading listings…</div>
        )}

        {!loading && listings.length === 0 && (
          <div className="text-center py-16" data-testid="yp-empty-state">
            <p className="text-slate-400">No businesses listed yet for this filter.</p>
            <Button
              onClick={() => navigate(isAuthed ? '/yellow-pages/new' : '/login')}
              className="mt-4 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold"
              data-testid="yp-empty-add-btn"
            >
              <Plus className="mr-2 h-4 w-4" /> Be the first
            </Button>
          </div>
        )}

        {/* Featured row */}
        {featuredListings.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3 text-orange-300">
              <Flame className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Featured</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="yp-featured-grid">
              {featuredListings.map((l) => (
                <ListingCard key={l.id} listing={l} onClick={() => navigate(`/yellow-pages/${l.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* Standard grid */}
        {otherListings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="yp-listings-grid">
            {otherListings.map((l) => (
              <ListingCard key={l.id} listing={l} onClick={() => navigate(`/yellow-pages/${l.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ────────────── ListingCard ────────────── */
function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const tier = TIER_BADGE[listing.tier] || TIER_BADGE.free;
  const TierIcon = tier.Icon;
  const CatIcon = CAT_ICONS[listing.category] ?? Filter;

  // Visual differentiation by tier
  const borderCls =
    listing.tier === 'elite'
      ? 'border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.22)]'
      : listing.tier === 'verified'
      ? 'border-emerald-400/40 shadow-[0_0_18px_rgba(16,185,129,0.18)]'
      : listing.tier === 'featured'
      ? 'border-orange-400/50 shadow-[0_0_22px_rgba(251,146,60,0.25)]'
      : 'border-slate-700/50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        onClick={onClick}
        className={`cursor-pointer bg-slate-900/60 ${borderCls} border p-4 hover:bg-slate-900/80 transition-colors`}
        data-testid={`yp-listing-card-${listing.id}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <CatIcon className="h-5 w-5 text-yellow-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">{listing.name}</h3>
              <p className="text-xs text-slate-400 truncate">{listing.city}{listing.state ? `, ${listing.state}` : ''} · {listing.zip_code}</p>
            </div>
          </div>
          <Badge className={`${tier.cls} border shrink-0`} data-testid={`yp-tier-badge-${listing.tier}`}>
            <TierIcon className="h-3 w-3 mr-1" />
            {tier.label}
          </Badge>
        </div>

        {listing.description && (
          <p className="text-sm text-slate-300 line-clamp-2">{listing.description}</p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          {listing.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {listing.phone}
            </span>
          )}
          {listing.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-yellow-300"
            >
              <ExternalLink className="h-3 w-3" /> Website
            </a>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
