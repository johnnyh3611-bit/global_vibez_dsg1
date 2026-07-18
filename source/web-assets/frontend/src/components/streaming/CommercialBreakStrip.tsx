/**
 * Fetches the next paid DSG TV commercial and plays creative_url
 * as a short break before / between live programming.
 */
import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Ad = {
  ad_id: string;
  title: string;
  creative_url: string;
  duration_seconds: number;
  business_name?: string;
};

export default function CommercialBreakStrip({
  channelId,
  enabled = true,
}: {
  channelId?: string;
  enabled?: boolean;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || !channelId) return;
    let cancelled = false;
    void (async () => {
      try {
        const q = new URLSearchParams({ channel_id: channelId });
        const r = await fetch(`${API}/api/vibe-tv/ads/now-playing?${q}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j?.ad?.creative_url) {
          setAd(j.ad);
          setDismissed(false);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId, enabled]);

  if (!ad || dismissed || !ad.creative_url) return null;

  return (
    <div
      className="mb-4 rounded-2xl overflow-hidden border border-amber-400/30 bg-black/70"
      data-testid="commercial-break-strip"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-400/20">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-200 font-bold">
          <Megaphone className="w-3.5 h-3.5" />
          Paid spot · {ad.business_name || ad.title}
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-white/50 hover:text-white"
          aria-label="Dismiss ad"
          data-testid="commercial-break-dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <video
        src={ad.creative_url}
        controls
        autoPlay
        muted
        playsInline
        className="w-full max-h-56 bg-black"
        data-testid="commercial-break-video"
      />
    </div>
  );
}
