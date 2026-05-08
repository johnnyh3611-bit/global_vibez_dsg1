import React, { useEffect, useState } from 'react';
import { Zap, Clock } from 'lucide-react';

interface PowerHourStatus {
  active: boolean;
  multiplier: number;
  window: { start_iso: string; end_iso: string; tz: string };
  starts_in_seconds?: number;
  ends_in_seconds?: number;
}

const fmt = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/**
 * Power Hour status badge — Master Plan v4 (2026-02-06).
 *
 * Polls `/api/power-hour/status` every 30s and renders one of:
 *   ⚡  ACTIVE · 1.10× · ends in Xh Ym
 *   ⏰  Power Hour starts in Xh Ym
 *
 * Plug onto any chair-purchase landing surface to nudge buyers into
 * the 5pm-9pm America/New_York window.
 */
export const PowerHourBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [status, setStatus] = useState<PowerHourStatus | null>(null);

  useEffect(() => {
    const apiUrl = process.env.REACT_APP_BACKEND_URL || '';
    let alive = true;
    const fetchStatus = async () => {
      try {
        const r = await fetch(`${apiUrl}/api/power-hour/status`);
        if (!r.ok) return;
        const d = (await r.json()) as PowerHourStatus;
        if (alive) setStatus(d);
      } catch {
        /* silent — badge just hides until backend is reachable */
      }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!status) return null;

  if (status.active) {
    return (
      <div
        data-testid="power-hour-badge"
        data-active="true"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-fuchsia-500 text-black shadow-[0_0_18px_rgba(251,191,36,0.5)] ${className}`}
      >
        <Zap className="w-3.5 h-3.5" fill="currentColor" />
        Power Hour · {status.multiplier.toFixed(2)}×
        <span className="opacity-70">
          · {status.ends_in_seconds ? fmt(status.ends_in_seconds) : ''} left
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="power-hour-badge"
      data-active="false"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-black/40 border border-amber-400/40 text-amber-200 ${className}`}
    >
      <Clock className="w-3.5 h-3.5" />
      Power Hour in {status.starts_in_seconds ? fmt(status.starts_in_seconds) : '—'}
    </div>
  );
};

export default PowerHourBadge;
