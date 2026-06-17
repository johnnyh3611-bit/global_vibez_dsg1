/**
 * Admin Tier Pricing — Feb 2026
 *
 * Founder-facing UI for the Mongo-backed `pricing_catalog`. Lets you
 * change Genius / Genesis / Apex prices (and labels / taglines) on the
 * fly without a redeploy. Every save bumps the catalog version and is
 * recorded in `pricing_catalog_history` for audit.
 *
 * Backend contract:
 *   GET   /api/admin/pricing/catalogs
 *   GET   /api/admin/pricing/catalogs/high_roller_vip_tiers
 *   PATCH /api/admin/pricing/vip-tiers/{tier_id}
 *   GET   /api/admin/pricing/catalogs/high_roller_vip_tiers/history
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import SimplePricingCatalogCard from '@/components/admin/SimplePricingCatalogCard';

type Tier = {
  tier: string;
  label: string;
  price_usd: number;
  tagline: string;
  perks: string[];
  duration_days?: number;
};

type HistoryRow = {
  version: number;
  updated_at: string;
  updated_by: string | null;
};

const CATALOG_ID = 'high_roller_vip_tiers';
const API = process.env.REACT_APP_BACKEND_URL;

const AdminTierPricing: React.FC = () => {
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [version, setVersion] = useState<number>(0);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<string | null>(null);

  // Local form state per tier so the user can edit several before saving.
  const [drafts, setDrafts] = useState<Record<string, Partial<Tier>>>({});

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/pricing/catalogs/${CATALOG_ID}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const t = (data?.data?.tiers as Record<string, Tier>) || {};
      setTiers(t);
      setVersion(data?.data?.version ?? 0);
      setDrafts({});
    } catch (err: any) {
      toast.error(`Failed to load pricing catalog: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(
        `${API}/api/admin/pricing/catalogs/${CATALOG_ID}/history`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data?.history || []);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  const setDraftField = (tierId: string, field: keyof Tier, value: any) => {
    setDrafts((prev) => ({
      ...prev,
      [tierId]: { ...(prev[tierId] || {}), [field]: value },
    }));
  };

  const effective = (tierId: string, field: keyof Tier) => {
    const draft = drafts[tierId];
    if (draft && draft[field] !== undefined) return draft[field];
    return tiers[tierId]?.[field];
  };

  const isDirty = (tierId: string) => {
    const d = drafts[tierId];
    if (!d) return false;
    return Object.keys(d).some((k) => (d as any)[k] !== (tiers[tierId] as any)[k]);
  };

  const saveTier = async (tierId: string) => {
    const draft = drafts[tierId];
    if (!draft) return;
    setSavingTier(tierId);
    try {
      const body: Record<string, any> = {};
      if (draft.price_usd !== undefined) body.price_usd = Number(draft.price_usd);
      if (draft.label !== undefined) body.label = draft.label;
      if (draft.tagline !== undefined) body.tagline = draft.tagline;
      if (draft.perks !== undefined) body.perks = draft.perks;

      const res = await fetch(`${API}/api/admin/pricing/vip-tiers/${tierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail || `HTTP ${res.status}`);
      }
      toast.success(`Saved ${tierId.toUpperCase()} — version ${(await res.json())?.version ?? 'n/a'}`);
      await loadCatalog();
      await loadHistory();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || err}`);
    } finally {
      setSavingTier(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-400" data-testid="admin-tier-pricing-loading">
        Loading pricing catalog…
      </div>
    );
  }

  const tierIds = Object.keys(tiers);

  return (
    <div className="p-8 space-y-6" data-testid="admin-tier-pricing-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">VIP Tier Pricing</h1>
          <p className="text-sm text-gray-400">
            Hot-edit Genius / Genesis / Apex prices. Changes propagate live
            (no redeploy) via the Mongo pricing_catalog.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-amber-300 border-amber-500/50 bg-amber-950/30"
          data-testid="admin-tier-pricing-version-badge"
        >
          catalog v{version}
        </Badge>
      </header>

      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        data-testid="admin-tier-pricing-grid"
      >
        {tierIds.map((tierId) => {
          const tier = tiers[tierId];
          const priceVal = effective(tierId, 'price_usd') as number;
          const labelVal = effective(tierId, 'label') as string;
          const taglineVal = effective(tierId, 'tagline') as string;
          const perksVal = (effective(tierId, 'perks') as string[]) || [];
          return (
            <Card
              key={tierId}
              className="p-5 bg-black/40 border-zinc-800 backdrop-blur-sm"
              data-testid={`admin-tier-pricing-card-${tierId}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-zinc-500">
                  {tierId}
                </span>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                  {tier.duration_days || 30}-day grant
                </Badge>
              </div>

              <label className="block text-xs text-zinc-400 mb-1">Label</label>
              <Input
                value={labelVal ?? ''}
                onChange={(e) => setDraftField(tierId, 'label', e.target.value)}
                className="bg-zinc-900 border-zinc-700 mb-3 text-white"
                data-testid={`admin-tier-pricing-label-${tierId}`}
              />

              <label className="block text-xs text-zinc-400 mb-1">Price (USD)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={priceVal ?? ''}
                onChange={(e) => setDraftField(tierId, 'price_usd', parseFloat(e.target.value))}
                className="bg-zinc-900 border-zinc-700 mb-3 text-white font-mono"
                data-testid={`admin-tier-pricing-price-${tierId}`}
              />

              <label className="block text-xs text-zinc-400 mb-1">Tagline</label>
              <Textarea
                value={taglineVal ?? ''}
                onChange={(e) => setDraftField(tierId, 'tagline', e.target.value)}
                className="bg-zinc-900 border-zinc-700 mb-3 text-white"
                rows={2}
                data-testid={`admin-tier-pricing-tagline-${tierId}`}
              />

              <label className="block text-xs text-zinc-400 mb-1">
                Perks (one per line)
              </label>
              <Textarea
                value={perksVal.join('\n')}
                onChange={(e) =>
                  setDraftField(
                    tierId,
                    'perks',
                    e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                  )
                }
                className="bg-zinc-900 border-zinc-700 mb-4 text-white font-mono text-xs"
                rows={5}
                data-testid={`admin-tier-pricing-perks-${tierId}`}
              />

              <Button
                onClick={() => saveTier(tierId)}
                disabled={!isDirty(tierId) || savingTier === tierId}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40"
                data-testid={`admin-tier-pricing-save-${tierId}`}
              >
                {savingTier === tierId
                  ? 'Saving…'
                  : isDirty(tierId)
                  ? `Save ${tierId}`
                  : 'No changes'}
              </Button>
            </Card>
          );
        })}
      </section>

      <section data-testid="admin-simple-pricing-section">
        <h2 className="text-lg font-bold text-white mt-8 mb-3">
          Other live-editable catalogs
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Single-price entries that can be hot-edited the same way as VIP tiers.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SimplePricingCatalogCard
            catalogId="featured_streamer"
            title="Featured Streamer slot"
            subtitle="Pinned position on the Live Now Wall."
          />
          <SimplePricingCatalogCard
            catalogId="jftn_season_pass"
            title="JFTN Season Pass"
            subtitle="Premium room access for the duration window."
          />
        </div>
      </section>

      <section data-testid="admin-tier-pricing-history-section">
        <h2 className="text-lg font-bold text-white mt-8 mb-3">Change history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No history yet — saves will appear here.
          </p>
        ) : (
          <Card className="bg-black/30 border-zinc-800">
            <ul className="divide-y divide-zinc-800">
              {history.map((row) => (
                <li
                  key={row.version}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                  data-testid={`admin-tier-pricing-history-row-${row.version}`}
                >
                  <span className="font-mono text-amber-300">v{row.version}</span>
                  <span className="text-zinc-400">{row.updated_at}</span>
                  <span className="text-zinc-300">{row.updated_by || '—'}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
};

export default AdminTierPricing;
