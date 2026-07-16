import { useEffect, useMemo, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL;

/** Matches HowChairsWork avg weight assumption for empty markets. */
const AVG_WEIGHT_PER_CHAIR = 1.4333;
const DEFAULT_MARKET_DEPTH = 10_000;
const DEFAULT_QUARTERLY_REVENUE = 50_000;

export type ChairTier = {
  name: string;
  price_usd: number;
  weight: number;
  limit: number;
  tagline?: string;
};

export type ChairEconomics = {
  tiers: ChairTier[];
  chair_pool_pct: number;
  total_weighted: number;
  total_chairs: number;
  usd_to_coins: number;
};

export type ChairRoiEstimate = {
  tierName: string;
  chairs: number;
  totalCost: number;
  quarterlyUsd: number;
  monthlyUsd: number;
  quarterlyCoins: number;
  sharePct: number;
  breakevenQuarters: number;
};

export function estimateChairRoi(
  econ: ChairEconomics,
  opts?: { tierName?: string; chairs?: number; quarterlyRevenue?: number }
): ChairRoiEstimate | null {
  const chairs = Math.max(1, opts?.chairs ?? 1);
  const revenue = opts?.quarterlyRevenue ?? DEFAULT_QUARTERLY_REVENUE;
  const tier =
    econ.tiers.find((t) => t.name === (opts?.tierName || "Genius")) ||
    econ.tiers[0];
  if (!tier) return null;

  const myWeight = tier.weight * chairs;
  const baseWeighted =
    econ.total_weighted + DEFAULT_MARKET_DEPTH * AVG_WEIGHT_PER_CHAIR;
  const denominator = baseWeighted + myWeight;
  const share = denominator > 0 ? myWeight / denominator : 0;
  const quarterlyUsd = share * revenue * econ.chair_pool_pct;
  const totalCost = tier.price_usd * chairs;

  return {
    tierName: tier.name,
    chairs,
    totalCost,
    quarterlyUsd,
    monthlyUsd: quarterlyUsd / 3,
    quarterlyCoins: Math.round(quarterlyUsd * (econ.usd_to_coins || 1)),
    sharePct: share * 100,
    breakevenQuarters:
      quarterlyUsd > 0 ? totalCost / quarterlyUsd : Number.POSITIVE_INFINITY,
  };
}

export function useChairEconomics() {
  const [econ, setEcon] = useState<ChairEconomics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/chairs/economics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setEcon(d);
          setError(!d);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const estimateOneGenius = useMemo(
    () => (econ ? estimateChairRoi(econ, { chairs: 1, tierName: "Genius" }) : null),
    [econ]
  );

  return { econ, loading, error, estimateOneGenius, estimateChairRoi };
}
