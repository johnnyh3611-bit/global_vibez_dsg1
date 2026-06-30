"use client";

import { useEffect, useState } from "react";

type LogisticsEvent = {
  id: string;
  service: "hunger-vibez" | "viberidez";
  status: "queued" | "persisted";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  azureTraceId: string;
  note: string;
};

export function OperationsConsole() {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      const res = await fetch("/api/logistics/audit?limit=20", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load audit trail");
      const payload = await res.json();
      setEvents(payload.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/logistics/audit?limit=20", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load audit trail");
        const payload = await res.json();
        if (active) {
          setEvents(payload.events ?? []);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const simulate = async (service: "hunger-vibez" | "viberidez") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/logistics/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Whole Unit Test Console</h2>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            disabled={loading}
            onClick={() => simulate("hunger-vibez")}
            className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            Trigger Hunger Vibez
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => simulate("viberidez")}
            className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
          >
            Trigger VibeRidez
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="px-2 py-2">Service</th>
              <th className="px-2 py-2">Latency</th>
              <th className="px-2 py-2">Azure Trace</th>
              <th className="px-2 py-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-white/10">
                <td className="px-2 py-2 uppercase">{event.service}</td>
                <td className="px-2 py-2">{event.latencyMs}ms</td>
                <td className="px-2 py-2 font-mono text-xs">{event.azureTraceId}</td>
                <td className="px-2 py-2">{new Date(event.completedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
