/**
 * SmartcarConnect — user-facing connect page at /smartcar.
 * Shows currently connected vehicles, a "Connect your car" CTA that redirects
 * to Smartcar OAuth, and inline unlock/lock buttons per vehicle.
 *
 * Running in Smartcar TEST mode means you can pair simulated Teslas/Fords
 * from the Smartcar sandbox — no real vehicle needed.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Zap, Plus, Lock, Unlock, ArrowLeft, Loader2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  battery_percent?: number;
  locked?: boolean;
  error?: string;
}

interface VehiclesResp {
  mode: string;
  connected?: boolean;
  vehicles: Vehicle[];
  user_id?: string;
}

const SmartcarConnect: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<VehiclesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/smartcar/vehicles`, {});
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const body: VehiclesResp = await res.json();
      setData(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    try {
      const res = await fetch(`${API}/api/smartcar/auth-url`, {});
      const body = await res.json();
      if (!body.url) throw new Error("No auth URL returned");
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const action = async (vehicleId: string, cmd: "lock" | "unlock") => {
    setActing(`${vehicleId}_${cmd}`);
    try {
      const res = await fetch(`${API}/api/smartcar/${cmd}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || `${cmd} failed`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const vehicles = data?.vehicles || [];
  const connected = (data?.connected ?? vehicles.length > 0) && data?.mode !== "mock";

  return (
    <div className="min-h-screen bg-black text-white" data-testid="smartcar-connect">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
          data-testid="smartcar-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2 text-fuchsia-400 font-mono text-xs uppercase tracking-widest mb-4">
          <Car className="w-4 h-4" /> Smartcar · {data?.mode || "..."}
        </div>
        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
          Bring your ride
          <br />
          <span className="text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text">
            into the vibe.
          </span>
        </h1>
        <p className="mt-4 text-neutral-400 max-w-xl">
          Connect your vehicle via Smartcar. Unlock your door, push Spotify to the dash, earn extra
          $DSG for verified road-trip streams. Works with Tesla, Ford, BMW, Hyundai, Audi, and 20+ others.
        </p>

        {error && (
          <div className="mt-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" data-testid="smartcar-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-neutral-400" data-testid="smartcar-loading">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading vehicles...
          </div>
        ) : !connected ? (
          <div className="mt-10 p-8 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-fuchsia-500/10 border border-white/10 text-center" data-testid="smartcar-empty">
            <Car className="w-12 h-12 mx-auto text-cyan-400 mb-3" />
            <h2 className="text-xl font-bold">No vehicle connected</h2>
            <p className="text-sm text-neutral-400 mt-2 mb-6">
              {data?.mode === "test"
                ? "You're in TEST mode — you'll pair a simulated Tesla/Ford/BMW from Smartcar's sandbox. No real car needed."
                : "Securely authorize one of your vehicles via the Smartcar app."}
            </p>
            <button
              onClick={connect}
              data-testid="smartcar-connect-btn"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 font-bold uppercase tracking-wide text-sm hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" /> Connect your car
            </button>
          </div>
        ) : (
          <div className="mt-10 space-y-4" data-testid="smartcar-vehicles">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
                data-testid={`smartcar-vehicle-${v.id}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                    <Car className="w-6 h-6 text-fuchsia-300" />
                  </div>
                  <div>
                    <div className="font-bold">
                      {v.year ? `${v.year} ` : ""}{v.make || "Vehicle"} {v.model || ""}
                    </div>
                    <div className="text-xs font-mono text-neutral-500 mt-0.5">{v.id}</div>
                    {v.error && (
                      <div className="text-xs text-rose-400 mt-1">{v.error}</div>
                    )}
                  </div>
                </div>

                {typeof v.battery_percent === "number" && (
                  <div className="flex items-center gap-1 text-amber-400 text-sm" data-testid={`battery-${v.id}`}>
                    <Zap className="w-3 h-3" /> {v.battery_percent}%
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => action(v.id, "unlock")}
                    disabled={Boolean(acting)}
                    data-testid={`smartcar-unlock-${v.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    {acting === `${v.id}_unlock` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                    Unlock
                  </button>
                  <button
                    onClick={() => action(v.id, "lock")}
                    disabled={Boolean(acting)}
                    data-testid={`smartcar-lock-${v.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40"
                  >
                    {acting === `${v.id}_lock` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                    Lock
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={connect}
              data-testid="smartcar-add-another"
              className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-fuchsia-500 hover:text-fuchsia-300 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add another vehicle
            </button>
          </div>
        )}

        <div className="mt-10 text-[11px] text-neutral-600">
          Vehicle data is stored encrypted. Global Vibez only issues a command after you take an explicit action — we never auto-unlock.
        </div>
      </div>
    </div>
  );
};

export default SmartcarConnect;
