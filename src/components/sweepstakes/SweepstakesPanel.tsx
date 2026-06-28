"use client";

import { useEffect, useState } from "react";

type StatusPayload = {
  weekKey: string;
  entered: boolean;
  totalEntries: number;
  nextDrawAt: string;
};

export function SweepstakesPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    const res = await fetch("/api/sweepstakes/status", { cache: "no-store" });
    const payload = await res.json();
    setStatus(payload);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/sweepstakes/status", { cache: "no-store" });
        const payload = await res.json();
        if (active) {
          setStatus(payload);
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

  const enter = async () => {
    const res = await fetch("/api/sweepstakes/enter", { method: "POST" });
    const payload = await res.json();
    if (payload.alreadyEntered) {
      setMessage("You are already entered for this week.");
    } else {
      setMessage("Entry confirmed. Good luck in the DSG Weekly Grand Sweepstakes.");
    }
    await loadStatus();
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <h2 className="text-2xl font-semibold text-white">DSG Weekly Grand Sweepstakes</h2>
      <p className="mt-2 text-sm text-white/70">
        Weekly chair-holder draw to reward long-term participation and keep momentum alive.
      </p>

      {loading && <p className="mt-4 text-sm text-white/60">Loading draw status...</p>}

      {!loading && status && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Week</p>
            <p className="mt-2 text-lg font-semibold text-white">{status.weekKey}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Entries</p>
            <p className="mt-2 text-lg font-semibold text-white">{status.totalEntries}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Next Draw</p>
            <p className="mt-2 text-sm text-white">{new Date(status.nextDrawAt).toLocaleString()}</p>
          </article>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enter}
          className="rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Enter This Week
        </button>
        {status?.entered && <span className="text-sm text-emerald-300">You are currently entered.</span>}
      </div>

      {message && <p className="mt-4 text-sm text-violet-200">{message}</p>}
    </section>
  );
}
