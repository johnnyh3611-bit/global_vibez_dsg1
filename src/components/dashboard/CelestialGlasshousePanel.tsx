"use client";

import { useEffect, useMemo, useState } from "react";

type WalletOverview = {
  publicKey: string;
  hasChair: boolean;
  chairUnitsOwned: number;
  solBalance: number;
  rpcUrl: string;
  rpcError: string | null;
};

function shortWallet(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function CelestialGlasshousePanel() {
  const [data, setData] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/wallet/overview", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Unable to load wallet overview");
      }
      const payload = (await res.json()) as WalletOverview;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/wallet/overview", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Unable to load wallet overview");
        }
        const payload = (await res.json()) as WalletOverview;
        if (active) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const status = useMemo(() => {
    if (!data) return "Unknown";
    return data.hasChair ? "Chair Confirmed" : "No Chair Found";
  }, [data]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Celestial Glasshouse</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Proof of Ownership</h2>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          Refresh status
        </button>
      </div>

      {loading && <p className="mt-6 text-sm text-white/70">Loading wallet bridge...</p>}
      {error && <p className="mt-6 text-sm text-rose-300">{error}</p>}

      {!loading && !error && data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Wallet</p>
            <p className="mt-2 font-mono text-sm text-white">{shortWallet(data.publicKey)}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">SOL Holdings</p>
            <p className="mt-2 text-lg font-semibold text-white">{data.solBalance.toFixed(4)} SOL</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Chair Status</p>
            <p className={`mt-2 text-lg font-semibold ${data.hasChair ? "text-emerald-300" : "text-amber-300"}`}>
              {status}
            </p>
          </article>
        </div>
      )}

      {!loading && !error && data?.rpcError && (
        <p className="mt-4 text-xs text-amber-300">RPC warning: {data.rpcError}</p>
      )}
    </section>
  );
}
