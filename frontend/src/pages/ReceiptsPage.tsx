/**
 * /receipts — Receipt OCR submission + 15% bonus credit.
 *
 * User pastes image URL + merchant + amount. Backend OCR-verifies (stub
 * until LLM key budget) and credits +15% on the spent amount in ₵.
 * Merchant gets a 30-day "boosted" flag in YellowPages.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Receipt, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type R = { receipt_id: string; merchant_id: string; amount_usd: number; status: string; bonus_vibe_credited?: number; submitted_at_iso: string };

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [history, setHistory] = useState<R[]>([]);

  const refresh = async () => {
    try {
      const r = await authFetch(`${API}/api/receipts/my-receipts?limit=10`);
      const d = await r.json();
      setHistory((d?.rows as R[]) || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { refresh(); }, []);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await authFetch(`${API}/api/receipts/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          merchant_id: merchantId,
          amount_usd: parseFloat(amount) || 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Submission failed");
      if (d.status === "verified") {
        setMsg({ kind: "ok", text: `+₵${d.bonus_vibe} credited · merchant boosted 30 days` });
        setImageUrl(""); setMerchantId(""); setAmount("");
        await refresh();
      } else {
        setMsg({ kind: "err", text: `Rejected: ${d.reason || "OCR could not verify"}` });
      }
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message || "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const valid = imageUrl.startsWith("http") && merchantId.length >= 2 && parseFloat(amount) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1014] via-[#0d0817] to-[#0a1014] text-white" data-testid="receipts-page">
      <header className="px-6 py-4 flex items-center justify-between border-b border-emerald-500/15">
        <button onClick={() => navigate(-1)} className="text-white/70 text-sm flex items-center gap-2 hover:text-white" data-testid="receipts-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-emerald-300 flex items-center gap-2">
          <Receipt className="w-5 h-5" /> Receipt Boost
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-white/40 hidden md:inline">
          +15% bonus · 30-day merchant boost
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <section className="rounded-2xl bg-black/40 border border-emerald-500/20 p-6 mb-6" data-testid="receipts-form">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <h2 className="text-sm uppercase tracking-widest text-emerald-200">Submit a receipt</h2>
          </div>
          <p className="text-xs text-white/60 mb-4">
            Upload a HungryVibes / VibeRidez / Yellow Pages merchant receipt — we OCR-verify,
            credit you +15% of the spend back in ₵ VIBE, and boost the merchant for 30 days.
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50">Receipt image URL</span>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                data-testid="receipts-image-url"
                placeholder="https://i.imgur.com/your-receipt.jpg"
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 mt-1 text-sm placeholder-white/30 focus:outline-none focus:border-emerald-400"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50">Merchant ID / handle</span>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                data-testid="receipts-merchant"
                placeholder="e.g. vibez-pizza-303"
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 mt-1 text-sm placeholder-white/30 focus:outline-none focus:border-emerald-400"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50">Amount spent ($)</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="receipts-amount"
                placeholder="0.00"
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 mt-1 text-sm placeholder-white/30 focus:outline-none focus:border-emerald-400"
              />
            </label>
            <Button
              onClick={submit}
              disabled={!valid || busy}
              data-testid="receipts-submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-black font-black uppercase tracking-widest"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Claim 15%"}
            </Button>
            {msg && (
              <p
                className={`text-xs mt-2 text-center ${msg.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}
                data-testid="receipts-msg"
              >
                {msg.text}
              </p>
            )}
          </div>
        </section>

        {history.length > 0 && (
          <section className="rounded-2xl bg-black/40 border border-white/10 p-5" data-testid="receipts-history">
            <h2 className="text-xs uppercase tracking-widest text-white/60 mb-3">Your receipts</h2>
            <ul className="space-y-2">
              {history.map((r) => (
                <li
                  key={r.receipt_id}
                  className="flex items-center justify-between rounded-md bg-black/40 border border-white/5 px-3 py-2 text-xs"
                  data-testid={`receipts-row-${r.receipt_id}`}
                >
                  <span className="font-mono text-white/70">{r.merchant_id} · ${r.amount_usd.toFixed(2)}</span>
                  <span className={`uppercase tracking-widest text-[10px] ${r.status === "verified" ? "text-emerald-300" : "text-rose-300/70"}`}>
                    {r.status}{r.bonus_vibe_credited ? ` · +₵${r.bonus_vibe_credited}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
