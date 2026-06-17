/**
 * SimplePricingCatalogCard — Feb 2026
 *
 * Compact card for "single-price + duration" catalog entries
 * (Featured Streamer slot, JFTN Season Pass). Reuses the same
 * generic backend endpoints as the VIP tier editor:
 *   GET /api/admin/pricing/catalogs/{catalog_id}
 *   PUT /api/admin/pricing/catalogs/{catalog_id}
 *
 * On save we send the full `data` payload (price_usd + duration_days)
 * so the audit trail captures both fields.
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

interface Props {
  catalogId: string;
  title: string;
  subtitle: string;
}

const SimplePricingCatalogCard: React.FC<Props> = ({
  catalogId,
  title,
  subtitle,
}) => {
  const [price, setPrice] = useState<number | string>('');
  const [duration, setDuration] = useState<number | string>('');
  const [version, setVersion] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Track loaded values separately so isDirty math is reliable.
  const [loaded, setLoaded] = useState<{ price: number; duration: number }>({
    price: 0,
    duration: 0,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/admin/pricing/catalogs/${catalogId}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const payload = data?.data || {};
      const p = Number(payload.price_usd ?? 0);
      const d = Number(payload.duration_days ?? 30);
      setPrice(p);
      setDuration(d);
      setLoaded({ price: p, duration: d });
      setVersion(Number(payload.version ?? 0));
    } catch (err: any) {
      toast.error(`Failed to load ${catalogId}: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogId]);

  const isDirty =
    Number(price) !== loaded.price || Number(duration) !== loaded.duration;

  const save = async () => {
    const p = Number(price);
    const d = Number(duration);
    if (!Number.isFinite(p) || p <= 0) {
      toast.error('Price must be a positive number');
      return;
    }
    if (!Number.isFinite(d) || d <= 0) {
      toast.error('Duration must be a positive integer');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${API}/api/admin/pricing/catalogs/${catalogId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            data: { price_usd: p, duration_days: d },
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const newVersion = body?.data?.version;
      toast.success(`Saved ${title} — version ${newVersion ?? 'n/a'}`);
      await load();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="p-5 bg-black/40 border-zinc-800 backdrop-blur-sm"
      data-testid={`admin-simple-pricing-card-${catalogId}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-zinc-400">{subtitle}</p>
        </div>
        <Badge
          variant="outline"
          className="text-amber-300 border-amber-500/50 bg-amber-950/30"
          data-testid={`admin-simple-pricing-version-${catalogId}`}
        >
          v{version}
        </Badge>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <label className="block text-xs text-zinc-400 mb-1">
            Price (USD)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="bg-zinc-900 border-zinc-700 mb-3 text-white font-mono"
            data-testid={`admin-simple-pricing-price-${catalogId}`}
          />

          <label className="block text-xs text-zinc-400 mb-1">
            Duration (days)
          </label>
          <Input
            type="number"
            min="1"
            step="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="bg-zinc-900 border-zinc-700 mb-4 text-white font-mono"
            data-testid={`admin-simple-pricing-duration-${catalogId}`}
          />

          <Button
            onClick={save}
            disabled={!isDirty || saving}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40"
            data-testid={`admin-simple-pricing-save-${catalogId}`}
          >
            {saving ? 'Saving…' : isDirty ? 'Save changes' : 'No changes'}
          </Button>
        </>
      )}
    </Card>
  );
};

export default SimplePricingCatalogCard;
