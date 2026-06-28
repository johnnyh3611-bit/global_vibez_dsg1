"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  generatedAt: string;
  tokenPerChair: number;
  circulatingSupply: number;
  entries: Array<{
    seatNumber: number;
    wallet: string;
    dsgInCirculation: number;
    status: "active";
  }>;
};

function shortWallet(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function ChairRegistryView() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/api/chair/ledger", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSnapshot(data));
  }, []);

  if (!snapshot) {
    return <p className="text-sm text-white/70">Loading ledger...</p>;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Circulating DSG</p>
          <p className="mt-2 text-xl font-semibold text-white">{snapshot.circulatingSupply.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Token Per Chair</p>
          <p className="mt-2 text-xl font-semibold text-white">{snapshot.tokenPerChair.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Snapshot</p>
          <p className="mt-2 text-sm text-white">{new Date(snapshot.generatedAt).toLocaleString()}</p>
        </article>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="px-2 py-2">Seat</th>
              <th className="px-2 py-2">Wallet</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">DSG</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.entries.map((entry) => (
              <tr key={entry.wallet} className="border-t border-white/10">
                <td className="px-2 py-2">#{entry.seatNumber}</td>
                <td className="px-2 py-2 font-mono">{shortWallet(entry.wallet)}</td>
                <td className="px-2 py-2 text-emerald-300">{entry.status}</td>
                <td className="px-2 py-2">{entry.dsgInCirculation.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
