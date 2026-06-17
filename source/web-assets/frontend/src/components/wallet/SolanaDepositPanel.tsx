/**
 * SolanaDepositPanel — drop-in component for the Vibe Wallet page.
 *
 * Calls /api/crypto-payments/create-deposit (cryptocurrency=SOL) to mint
 * a unique GVZ-* memo for this user, then renders:
 *   • the GlobalVibe DSG receive wallet address as a QR (Solana Pay
 *     style URL embedded so any Solana wallet auto-prefills the memo)
 *   • a Copy Address button
 *   • a Copy Memo button
 *   • a "Verify in your wallet" hint
 *
 * Dependencies (already installed): qrcode (npm).
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Wallet, Copy, Check, Loader2, Bolt, Info } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Deposit = {
  deposit_id: string;
  cryptocurrency: string;
  network: string;
  deposit_address: string;
  memo: string | null;
  amount_usd: number;
  status: string;
};

export default function SolanaDepositPanel({
  amountUsd = 25,
}: {
  amountUsd?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [copied, setCopied] = useState<"addr" | "memo" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mint a deposit row when the panel mounts.
  useEffect(() => {
    let cancelled = false;
    const mint = async () => {
      try {
        const userId = getUserId() || "anon";
        const r = await authFetch(`${API}/api/crypto-payments/create-deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            cryptocurrency: "SOL",
            amount_usd: amountUsd,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!cancelled) setDeposit(d.deposit as Deposit);
      } catch (e) {
        if (!cancelled) setError("Couldn't mint a deposit address. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    mint();
    return () => {
      cancelled = true;
    };
  }, [amountUsd]);

  // Render QR once we have a deposit. Solana Pay URL with memo so any
  // wallet that scans gets the GVZ-* tag pre-filled.
  useEffect(() => {
    if (!deposit?.deposit_address || !canvasRef.current) return;
    const memoParam = deposit.memo
      ? `&memo=${encodeURIComponent(deposit.memo)}`
      : "";
    const labelParam = `&label=${encodeURIComponent("GlobalVibe DSG")}`;
    const messageParam = `&message=${encodeURIComponent(
      "Vibez Coin top-up — keep the memo so we can credit your account.",
    )}`;
    const solanaUri = `solana:${deposit.deposit_address}?${labelParam.slice(1)}${memoParam}${messageParam}`;
    QRCode.toCanvas(canvasRef.current, solanaUri, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0e7490",
        light: "#00000000",
      },
      errorCorrectionLevel: "M",
    }).catch(() => {
      /* QR render failed — text fallback still works */
    });
  }, [deposit]);

  const copy = async (kind: "addr" | "memo", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center gap-3 text-cyan-300 p-6 border border-cyan-500/30 rounded-2xl bg-black/40 max-w-md"
        data-testid="solana-deposit-loading"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Minting your unique deposit memo…
      </div>
    );
  }

  if (error || !deposit?.deposit_address) {
    return (
      <div
        className="text-rose-300 p-6 border border-rose-500/30 rounded-2xl bg-black/40 max-w-md text-sm"
        data-testid="solana-deposit-error"
      >
        {error || "Deposit unavailable."}
      </div>
    );
  }

  const addr = deposit.deposit_address;
  const memo = deposit.memo || "";

  return (
    <div
      className="relative max-w-md w-full bg-black/60 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)] font-mono"
      data-testid="solana-deposit-panel"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-[0.3em] uppercase text-cyan-300">
            Send SOL → ₵ Vibez
          </h3>
          <p className="text-[10px] uppercase tracking-widest text-cyan-600">
            GlobalVibe DSG · Solana
          </p>
        </div>
        <span
          className="ml-auto text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-full px-2 py-0.5 flex items-center gap-1"
          data-testid="solana-deposit-amount"
        >
          <Bolt className="w-3 h-3" />₵{(amountUsd * 100).toLocaleString()}
        </span>
      </div>

      {/* QR */}
      <div className="flex items-center justify-center my-4">
        <div
          className="bg-cyan-500/5 border border-cyan-400/30 rounded-2xl p-3"
          data-testid="solana-deposit-qr"
        >
          <canvas
            ref={canvasRef}
            width={220}
            height={220}
            className="block"
            aria-label="Solana deposit QR"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <div>
          <label className="text-[9px] uppercase tracking-widest text-cyan-500">
            Treasury Address
          </label>
          <div className="flex items-center gap-2 mt-1 bg-black/50 border border-cyan-500/30 rounded-lg px-3 py-2">
            <span
              className="flex-1 text-[11px] text-cyan-200 truncate"
              data-testid="solana-deposit-address"
            >
              {addr}
            </span>
            <button
              onClick={() => copy("addr", addr)}
              className="text-cyan-300 hover:text-cyan-100"
              data-testid="solana-deposit-copy-address"
              aria-label="Copy address"
            >
              {copied === "addr" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Memo */}
        {memo && (
          <div>
            <label className="text-[9px] uppercase tracking-widest text-amber-400">
              Required memo (so we credit your ₵)
            </label>
            <div className="flex items-center gap-2 mt-1 bg-amber-500/10 border border-amber-400/40 rounded-lg px-3 py-2">
              <span
                className="flex-1 text-sm font-bold text-amber-200"
                data-testid="solana-deposit-memo"
              >
                {memo}
              </span>
              <button
                onClick={() => copy("memo", memo)}
                className="text-amber-300 hover:text-amber-100"
                data-testid="solana-deposit-copy-memo"
                aria-label="Copy memo"
              >
                {copied === "memo" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div
        className="mt-4 flex items-start gap-2 text-[10px] text-cyan-500/80 bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2"
        data-testid="solana-deposit-hint"
      >
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        Scan with your Solana wallet. Network confirmations land in
        ~15&nbsp;seconds; ₵ Vibez Coins are credited automatically as soon
        as the indexer matches your memo.
      </div>
    </div>
  );
}
