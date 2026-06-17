/**
 * Listing detail page with upgrade CTAs and Stripe checkout flow.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, Phone, Mail, Globe, Clock, MapPin, Shield, Crown, Flame, Coins, CreditCard,
} from 'lucide-react';
import TopUpVibezCoinsModal from '@/components/wallet/TopUpVibezCoinsModal';

const API = process.env.REACT_APP_BACKEND_URL;

interface Tier {
  id: string;
  label: string;
  price_usd: number;
  price_coins: number;
  kind: string;
  badge_color: string;
  ambassador_cut_usd: number;
}

interface Listing {
  id: string;
  owner_user_id: string;
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
  tier: string;
  tier_label: string;
  is_featured: boolean;
}

const TIER_ICONS: Record<string, any> = {
  verified: Shield,
  elite: Crown,
  featured: Flame,
};

export default function YellowPagesListingDetail() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<string>('');

  const upgradeStatus = search.get('upgrade');
  const sessionId = search.get('session_id');

  // Coin top-up modal — auto-pops when the user tries to pay in coins
  // but their wallet is short. Pre-targets the smallest pack that
  // would clear the shortfall.
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpRecommended, setTopUpRecommended] = useState<string>('popular');
  const [topUpContext, setTopUpContext] = useState<string>('');

  const isOwner =
    !!listing &&
    !!localStorage.getItem('user_id') &&
    listing.owner_user_id === localStorage.getItem('user_id');

  const loadListing = useCallback(() => {
    if (!listingId) return;
    const token = localStorage.getItem('auth_token');
    fetch(`${API}/api/yellow-pages/listings/${listingId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setListing(d?.id ? d : null))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [listingId]);

  useEffect(() => {
    loadListing();
    fetch(`${API}/api/yellow-pages/pricing`)
      .then((r) => r.json())
      .then((d) => setTiers(d.tiers || []));
  }, [loadListing]);

  // Stripe success callback — poll status, then refresh listing.
  useEffect(() => {
    if (upgradeStatus !== 'success' || !sessionId || polling) return;
    setPolling(true);
    setPaymentBanner('Confirming payment with Stripe…');
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const r = await fetch(`${API}/api/yellow-pages/payments/${sessionId}/status`);
        const d = await r.json();
        if (d.status === 'paid') {
          setPaymentBanner('🎉 Upgrade complete! Your listing has been promoted.');
          setPolling(false);
          loadListing();
          search.delete('upgrade');
          search.delete('session_id');
          setSearch(search, { replace: true });
          return;
        }
        if (attempts < 6) {
          setTimeout(tick, 2000);
        } else {
          setPaymentBanner('Still confirming — refresh the page in a minute.');
          setPolling(false);
        }
      } catch {
        setPolling(false);
        setPaymentBanner('Payment confirmation failed — contact support if your card was charged.');
      }
    };
    tick();
  }, [upgradeStatus, sessionId, polling, loadListing, search, setSearch]);

  useEffect(() => {
    if (upgradeStatus === 'cancelled') {
      setPaymentBanner('Upgrade cancelled — no charges were made.');
    }
  }, [upgradeStatus]);

  const startUpgrade = async (tier: string, paymentMethod: 'card' | 'coins' = 'card') => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!listing) return;
    const res = await fetch(`${API}/api/yellow-pages/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        listing_id: listing.id,
        tier,
        origin_url: window.location.origin,
        payment_method: paymentMethod,
      }),
    });
    const d = await res.json();

    // Insufficient ₵ — pop the top-up modal so the founder doesn't
    // lose the upgrade purchase to a dead-end error.
    if (paymentMethod === 'coins' && (res.status === 402 || /insufficient/i.test(d.detail || ''))) {
      const m = /need\s*₵?(\d+).*have\s*₵?(\d+)/i.exec(d.detail || '');
      const need = m ? parseInt(m[1], 10) : 0;
      const have = m ? parseInt(m[2], 10) : 0;
      const gap = Math.max(0, need - have);
      setTopUpRecommended(gap <= 500 ? 'starter' : gap <= 1000 ? 'popular' : gap <= 2500 ? 'pro' : 'vip');
      setTopUpContext(`You need ₵${need.toLocaleString()} to upgrade — your wallet has ₵${have.toLocaleString()}.`);
      setTopUpOpen(true);
      return;
    }

    // Card path returns a Stripe URL → redirect to checkout.
    if (d.checkout_url) {
      window.location.href = d.checkout_url;
      return;
    }

    // Coin path applied immediately — refresh the listing to show new tier.
    if (d.success && d.payment_method === 'coins') {
      setPaymentBanner(`🎉 Paid with ₵${d.coins_paid.toLocaleString()} — listing upgraded to ${tier}.`);
      loadListing();
      return;
    }

    setPaymentBanner(d.detail || 'Could not start upgrade.');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white p-6">Loading…</div>;
  if (!listing) return (
    <div className="min-h-screen bg-slate-950 text-white p-6 text-center">
      <p>Listing not found.</p>
      <Button onClick={() => navigate('/yellow-pages')} className="mt-4">Back</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white" data-testid="yp-listing-detail">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Button variant="ghost" onClick={() => navigate('/yellow-pages')} className="mb-4 text-slate-300">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to directory
        </Button>

        {paymentBanner && (
          <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/40" data-testid="yp-payment-banner">
            <AlertDescription className="text-yellow-200">{paymentBanner}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-slate-900/60 border-slate-800 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{listing.name}</h1>
              <p className="text-slate-400 text-sm mt-1 capitalize">{listing.category.replace('_', ' ')}</p>
            </div>
            <Badge className="border bg-slate-800/60 text-slate-200" data-testid="yp-current-tier">
              {listing.tier_label}
            </Badge>
          </div>
          {listing.description && <p className="mt-4 text-slate-300">{listing.description}</p>}

          <div className="mt-5 space-y-2 text-sm text-slate-300">
            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-yellow-400" /> {listing.address}, {listing.city}{listing.state ? `, ${listing.state}` : ''} {listing.zip_code}</div>
            {listing.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-yellow-400" /> {listing.phone}</div>}
            {listing.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-yellow-400" /> {listing.email}</div>}
            {listing.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-yellow-400" /> <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-yellow-300 hover:underline">{listing.website}</a></div>}
            {listing.hours && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-400" /> {listing.hours}</div>}
          </div>
        </Card>

        {/* Upgrade panel — only for owner */}
        {isOwner && (
          <section className="mt-10" data-testid="yp-upgrade-panel">
            <h2 className="text-xl font-bold mb-3">Upgrade your listing</h2>
            <p className="text-slate-400 mb-6 text-sm">Stand out from the free listings. Higher tiers rank above free in every search.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map((t) => {
                const Icon = TIER_ICONS[t.id] ?? Shield;
                const active = listing.tier === t.id;
                return (
                  <Card
                    key={t.id}
                    className={`p-5 border bg-slate-900/60 ${active ? 'ring-2 ring-yellow-400' : 'border-slate-700/60'}`}
                    style={active ? {} : { borderColor: t.badge_color + '60' }}
                    data-testid={`yp-upgrade-tier-${t.id}`}
                  >
                    <div className="flex items-center gap-2 mb-2" style={{ color: t.badge_color }}>
                      <Icon className="h-5 w-5" />
                      <span className="font-bold">{t.label}</span>
                    </div>
                    <div className="text-3xl font-bold">${t.price_usd.toFixed(0)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.kind === 'monthly' ? '/month' : 'one-time'}</div>
                    <div className="text-[11px] text-yellow-300/70 mt-1">
                      or ₵{t.price_coins.toLocaleString()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <Button
                        onClick={() => startUpgrade(t.id, 'coins')}
                        disabled={active}
                        className="bg-yellow-500/90 hover:bg-yellow-400 text-slate-950 font-semibold disabled:opacity-50"
                        data-testid={`yp-upgrade-coins-btn-${t.id}`}
                      >
                        <Coins className="mr-1.5 h-4 w-4" />
                        Pay ₵
                      </Button>
                      <Button
                        onClick={() => startUpgrade(t.id, 'card')}
                        disabled={active}
                        variant="outline"
                        className="border-slate-600/70 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        data-testid={`yp-upgrade-card-btn-${t.id}`}
                      >
                        <CreditCard className="mr-1.5 h-4 w-4" />
                        Card
                      </Button>
                    </div>
                    {active && (
                      <div className="text-xs text-emerald-300 mt-2 text-center">Current tier</div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Coin top-up modal — auto-shown when the user is short of ₵. */}
      <TopUpVibezCoinsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        recommendedPackId={topUpRecommended}
        contextMessage={topUpContext}
      />
    </div>
  );
}
