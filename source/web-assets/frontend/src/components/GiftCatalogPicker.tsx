/**
 * Virtual gift catalog picker — monetization coin gifts and optional
 * sovereign /gifts catalog. Used from Chat DMs and stream watch rooms.
 */
import { useEffect, useState } from 'react';
import { Gift, Loader } from 'lucide-react';
import { authFetch, getUserId } from '@/utils/secureAuth';

const API = process.env.REACT_APP_BACKEND_URL;

type MonetizationGift = {
  id: string;
  name: string;
  cost: number;
  emoji: string;
};

type CatalogMode = 'monetization' | 'streaming' | 'sovereign';

export interface GiftCatalogPickerProps {
  mode?: CatalogMode;
  toUserId?: string;
  streamId?: string;
  onSent?: (result: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function GiftCatalogPicker({
  mode = 'monetization',
  toUserId,
  streamId,
  onSent,
  onClose,
}: GiftCatalogPickerProps) {
  const me = getUserId();
  const [activeMode, setActiveMode] = useState<CatalogMode>(mode);
  const [gifts, setGifts] = useState<MonetizationGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowCatalogSwitch = mode !== 'streaming';

  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeMode === 'streaming') {
          const r = await fetch(`${API}/api/streaming/gifts/catalog`);
          const data = await r.json();
          const raw = data?.gifts || {};
          const list: MonetizationGift[] = Object.entries(raw).map(([id, g]: [string, any]) => ({
            id,
            name: g.label || id,
            cost: g.price || 0,
            emoji: id === 'solar_flare' ? '☀️' : id === 'nova_burst' ? '💥' : '👑',
          }));
          if (!cancelled) setGifts(list);
        } else if (activeMode === 'sovereign') {
          const r = await fetch(`${API}/api/gifts/list`);
          const data = await r.json();
          // Sovereign list has no sticker prices — buyer supplies price at purchase.
          // Default to 100 coins so /gifts/purchase validation (price > 0) passes.
          const list: MonetizationGift[] = (data?.gifts || []).map((g: any) => ({
            id: g.item_id,
            name: g.name || g.item_id,
            cost: typeof g.price === 'number' && g.price > 0 ? g.price : 100,
            emoji: '🎁',
          }));
          if (!cancelled) setGifts(list);
        } else {
          const r = await fetch(`${API}/api/monetization/gifts/catalog`);
          const data = await r.json();
          const raw = data?.gifts || {};
          const list: MonetizationGift[] = Object.entries(raw).map(([id, g]: [string, any]) => ({
            id,
            name: g.name || id,
            cost: g.cost || 0,
            emoji: g.emoji || '🎁',
          }));
          if (!cancelled) setGifts(list);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load gifts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeMode]);

  const sendGift = async (gift: MonetizationGift) => {
    if (!me || sending) return;
    setSending(gift.id);
    setError(null);
    try {
      let r: Response;
      if (activeMode === 'streaming') {
        if (!streamId) throw new Error('Missing stream');
        r = await authFetch(`${API}/api/streaming/gift`, {
          method: 'POST',
          body: JSON.stringify({
            stream_id: streamId,
            user_id: me,
            gift_code: gift.id,
          }),
        });
      } else if (activeMode === 'sovereign') {
        if (!toUserId) throw new Error('Missing recipient');
        r = await authFetch(`${API}/api/gifts/purchase`, {
          method: 'POST',
          body: JSON.stringify({
            item_id: gift.id,
            price: gift.cost || 100,
            buyer_id: me,
            recipient_id: toUserId,
          }),
        });
      } else {
        if (!toUserId) throw new Error('Missing recipient');
        r = await authFetch(`${API}/api/monetization/gifts/send`, {
          method: 'POST',
          body: JSON.stringify({
            from_user_id: me,
            to_user_id: toUserId,
            gift_id: gift.id,
          }),
        });
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.detail || data?.error || `HTTP ${r.status}`);
      }
      onSent?.(data);
      onClose();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Send failed');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-black/95 border border-pink-500/40 rounded-2xl p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="gift-catalog-picker"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm tracking-wide inline-flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-400" /> Send a Gift
          </h3>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-xs uppercase">
            Close
          </button>
        </div>

        {allowCatalogSwitch && (
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveMode('monetization')}
              className={`flex-1 text-[10px] uppercase tracking-widest py-2 rounded-lg border ${
                activeMode === 'monetization'
                  ? 'border-pink-400/60 bg-pink-500/20 text-pink-100'
                  : 'border-white/10 text-white/50'
              }`}
            >
              Coin gifts
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('sovereign')}
              className={`flex-1 text-[10px] uppercase tracking-widest py-2 rounded-lg border ${
                activeMode === 'sovereign'
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-100'
                  : 'border-white/10 text-white/50'
              }`}
            >
              Sovereign
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader className="w-6 h-6 text-pink-400 animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-red-300 text-xs mb-3" data-testid="gift-catalog-error">
            {error}
          </p>
        )}

        {!loading && (
          <div className="grid grid-cols-2 gap-2">
            {gifts.map((gift) => (
              <button
                key={gift.id}
                type="button"
                disabled={!!sending || !me}
                onClick={() => sendGift(gift)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 hover:bg-pink-500/20 border border-white/10 disabled:opacity-50"
                data-testid={`gift-item-${gift.id}`}
              >
                <span className="text-3xl">{gift.emoji}</span>
                <span className="text-white text-xs font-bold">{gift.name}</span>
                {gift.cost > 0 && (
                  <span className="text-amber-300 text-[10px]">₵{gift.cost.toLocaleString()}</span>
                )}
                {sending === gift.id && <span className="text-white/50 text-[10px]">Sending…</span>}
              </button>
            ))}
            {gifts.length === 0 && (
              <p className="col-span-2 text-white/50 text-sm text-center py-6">No gifts available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
