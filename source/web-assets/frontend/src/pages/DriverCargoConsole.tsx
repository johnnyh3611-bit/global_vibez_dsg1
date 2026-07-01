/**
 * /driver/cargo — VibeRidez Cargo Driver Retail Console
 *
 * Realises the PDF's "RETAIL DELIVERY INTERFACE" mock — assigned
 * manifest list + the dual-barcode flow:
 *   1. PICKUP   → driver scans / enters the store's pickup barcode
 *   2. HANDOVER → driver hits "Start Handover" → backend mints the
 *                 customer barcode → driver shows it (as QR text)
 *   3. DELIVERED → customer scans it via their app
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ScanBarcode, Package, CheckCircle2, RefreshCw,
  AlertTriangle, QrCode,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';
const token = () => localStorage.getItem('auth_token') || '';
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');

type Manifest = {
  manifest_id: string;
  order_id: string;
  store_id: string;
  state: string;
  cargo_value_coins: number;
  created_at: string;
};

type ManifestDetail = Manifest & {
  pickup_barcode_plaintext?: string;
  customer_barcode_plaintext?: string;
  pickup_at?: string;
  handover_at?: string;
};

export default function DriverCargoConsole() {
  const navigate = useNavigate();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token()}` }), []);
  const [assignments, setAssignments] = useState<Manifest[]>([]);
  const [active, setActive] = useState<ManifestDetail | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/cargo/driver/me/assignments`, { headers: auth });
      const d = await r.json();
      setAssignments(d?.rows || []);
    } catch { /* */ }
  }, [auth]);

  const fetchManifest = useCallback(async (mid: string) => {
    try {
      const r = await fetch(`${API}/api/cargo/driver/manifest/${mid}`, { headers: auth });
      const d = await r.json();
      if (d?.ok) setActive(d.manifest);
      else toast.error(d?.reason || 'Manifest not found');
    } catch { /* */ }
  }, [auth]);

  useEffect(() => {
    fetchAssignments();
    const t = setInterval(fetchAssignments, 20_000);
    return () => clearInterval(t);
  }, [fetchAssignments]);

  const scanPickup = async () => {
    if (!active || !scanInput.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/cargo/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          manifest_id: active.manifest_id,
          scanned_plaintext: scanInput.trim(),
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success('Cargo picked up · Step 1/2 verified');
        setScanInput('');
        await fetchManifest(active.manifest_id);
        await fetchAssignments();
      } else toast.error(d?.reason || 'Scan failed');
    } finally { setBusy(false); }
  };

  const startHandover = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/cargo/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ manifest_id: active.manifest_id }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success('Customer barcode minted — show it to the customer');
        await fetchManifest(active.manifest_id);
      } else toast.error(d?.reason || 'Handover failed');
    } finally { setBusy(false); }
  };

  const renderBarcode = (text: string) => (
    <div className="mt-2 rounded-xl bg-white text-black p-4 text-center font-mono text-xs break-all"
          data-testid="active-barcode-plaintext">
      <QrCode className="w-12 h-12 mx-auto text-black/80 mb-2" />
      {text}
      <p className="text-[10px] text-black/50 mt-2">
        single-use · sha256 secured
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#04060c] text-white" data-testid="driver-cargo-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-400/20 backdrop-blur-md bg-[#04060c]/95">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="driver-cargo-back"
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-cyan-300">
            CARGO DRIVER CONSOLE
          </h1>
          <button
            onClick={fetchAssignments}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 hover:bg-white/5"
            data-testid="driver-cargo-refresh"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <p className="max-w-4xl mx-auto mt-1 text-[10px] uppercase tracking-widest text-cyan-400/60">
          80/20 split · 40/30/30 vault recirculation · 0% in-app burn
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 grid lg:grid-cols-5 gap-5">
        {/* ─── Assignments list ─── */}
        <section className="lg:col-span-2" data-testid="assignments-section">
          <h2 className="text-xs font-black uppercase tracking-widest text-white/70 mb-3 flex items-center gap-2">
            <Package className="w-3 h-3" /> Cargo Assigned ({assignments.length})
          </h2>
          {assignments.length === 0 ? (
            <p className="text-xs text-white/40 rounded-xl border border-white/10 bg-white/5 p-4"
                data-testid="assignments-empty">
              No active cargo runs. Sit tight — dispatch will ping the moment a
              retail order routes to you.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map(m => (
                <li
                  key={m.manifest_id}
                  data-testid={`assignment-row-${m.manifest_id}`}
                  className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                    active?.manifest_id === m.manifest_id
                      ? 'border-cyan-400/60 bg-cyan-950/30'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                  onClick={() => fetchManifest(m.manifest_id)}
                >
                  <p className="font-mono text-[11px] text-cyan-300">{m.manifest_id}</p>
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 uppercase tracking-widest text-[9px]">
                      {m.state}
                    </span>
                    <span className="text-amber-200">{fmt(m.cargo_value_coins)} ₵</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Active manifest workspace ─── */}
        <section className="lg:col-span-3" data-testid="active-manifest-section">
          {!active ? (
            <p className="text-xs text-white/40 rounded-2xl border border-white/10 bg-white/5 p-5 text-center"
                data-testid="active-empty">
              <Package className="w-6 h-6 mx-auto mb-2 text-white/30" />
              Tap a cargo run on the left to open the dual-barcode workspace.
            </p>
          ) : (
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/15 p-5 space-y-4">
              <header className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300/70">Active Manifest</p>
                  <p className="font-mono text-sm text-white">{active.manifest_id}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-100 font-bold uppercase tracking-widest text-[10px]"
                      data-testid="active-state-pill">
                  {active.state}
                </span>
              </header>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase text-white/40">Cargo value</p>
                  <p className="text-white font-bold">{fmt(active.cargo_value_coins)} ₵</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/40">Store</p>
                  <p className="text-white truncate">{active.store_id}</p>
                </div>
              </div>

              {/* ─── Step 1: Pickup ─── */}
              {active.state === 'assigned' && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-950/15 p-4 space-y-2"
                      data-testid="pickup-block">
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-200 flex items-center gap-2">
                    <ScanBarcode className="w-3 h-3" /> Step 1 · Pickup Scan
                  </h3>
                  <p className="text-[11px] text-white/60">
                    Scan or paste the pickup barcode printed on the order
                    receipt. The hash is verified server-side before the
                    cargo is marked as picked up.
                  </p>
                  <input
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    placeholder="pickup-XXXX..."
                    data-testid="pickup-scan-input"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono"
                  />
                  <button
                    onClick={scanPickup}
                    disabled={busy || !scanInput.trim()}
                    data-testid="pickup-scan-btn"
                    className="w-full px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Verify Pickup
                  </button>
                </div>
              )}

              {/* ─── Step 2a: Generate customer barcode ─── */}
              {active.state === 'picked_up' && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/15 p-4 space-y-2"
                      data-testid="handover-block">
                  <h3 className="text-xs font-black uppercase tracking-widest text-emerald-200 flex items-center gap-2">
                    <QrCode className="w-3 h-3" /> Step 2 · Generate Handover Code
                  </h3>
                  <p className="text-[11px] text-white/60">
                    Hit the button on arrival. We mint a single-use barcode
                    you'll show the customer to scan with their app.
                  </p>
                  <button
                    onClick={startHandover}
                    disabled={busy}
                    data-testid="start-handover-btn"
                    className="w-full px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Start Handover
                  </button>
                </div>
              )}

              {/* ─── Step 2b: Show barcode ─── */}
              {active.state === 'handover' && active.customer_barcode_plaintext && (
                <div className="rounded-xl border border-purple-400/30 bg-purple-950/15 p-4"
                      data-testid="show-barcode-block">
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-200 flex items-center gap-2">
                    <QrCode className="w-3 h-3" /> Show Customer
                  </h3>
                  {renderBarcode(active.customer_barcode_plaintext)}
                  <p className="text-[10px] text-white/40 mt-3">
                    Waiting for customer scan to complete delivery…
                  </p>
                </div>
              )}

              {active.state === 'returning' && (
                <p className="text-xs text-rose-300 flex items-center gap-2"
                    data-testid="returning-banner">
                  <AlertTriangle className="w-3 h-3" />
                  Order cancelled by customer — route back to store. You will
                  be credited the protection fee on completion.
                </p>
              )}

              {active.state === 'delivered' && (
                <p className="text-xs text-emerald-300 flex items-center gap-2"
                    data-testid="delivered-banner">
                  <CheckCircle2 className="w-3 h-3" />
                  Settled · 80% to store · 20% recirculated 40/30/30.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
