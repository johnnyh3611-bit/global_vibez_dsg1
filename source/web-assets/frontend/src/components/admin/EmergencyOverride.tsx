/**
 * EmergencyOverride — manual lock-down toggle for the God-Mode dashboard.
 *
 * Posts to `/api/admin/emergency-lock` with `{enabled, reason}`.
 * When ON: payouts freeze, point-minting pauses, banner shown to holders.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

export default function EmergencyOverride() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/health-check`, {})
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setLocked(Boolean(d.emergency_lock)));
  }, []);

  const toggle = async () => {
    if (locked === null) return;
    const turningOn = !locked;
    let reason: string | null = null;
    if (turningOn) {
      reason = window.prompt(
        "FREEZE the system?\n\nThis will:\n  • Pause all chair payouts\n  • Halt loyalty stake accrual\n  • Show 'audit in progress' banner to holders\n\nReason for the lock-down (will be audit-logged):"
      );
      if (reason === null) return;
    } else {
      const ok = window.confirm("Release the Emergency Lock and resume payouts?");
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/emergency-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: turningOn, reason }),
      });
      if (r.ok) {
        const data = await r.json();
        setLocked(Boolean(data.emergency_lock));
      } else {
        alert("Could not toggle emergency lock — check console.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (locked === null) return null;

  return (
    <div
      data-testid="emergency-override"
      className={`rounded-xl p-4 mb-4 flex items-center justify-between border-2 ${
        locked
          ? "bg-rose-950/40 border-rose-500"
          : "bg-slate-900/60 border-cyan-500/40"
      }`}
    >
      <div className="min-w-0">
        <p className="text-white font-black text-sm uppercase tracking-widest">
          System Control · {locked ? "LOCKED" : "ACTIVE"}
        </p>
        <p className="text-slate-400 text-[11px] mt-0.5">
          Auto-Pilot: {locked ? "OVERRIDDEN" : "OPTIMIZED"}
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.95 }}
        disabled={busy}
        onClick={toggle}
        data-testid="emergency-override-toggle"
        className={`shrink-0 ml-4 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition disabled:opacity-50 ${
          locked
            ? "bg-emerald-400 text-black hover:brightness-110"
            : "bg-rose-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.6)] hover:brightness-110"
        }`}
      >
        {busy ? "…" : locked ? "Release Lock" : "Emergency Lock"}
      </motion.button>
    </div>
  );
}
