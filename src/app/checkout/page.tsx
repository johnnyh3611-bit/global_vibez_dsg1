"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type WalletOverview = {
  publicKey: string;
  hasChair: boolean;
  chairUnitsOwned: number;
  solBalance: number;
  chairPriceUsd: number;
  requiredSolForChair: number;
  hasRequiredChairFunds: boolean;
  rpcError: string | null;
};

type MintResponse = {
  success: boolean;
  message: string;
  txHash: string;
};

export default function CheckoutPage() {
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<MintResponse | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/wallet/overview", { cache: "no-store" });
    if (res.status === 401) {
      setNeedsAuth(true);
      setOverview(null);
      setError(null);
      return;
    }

    const body = (await res.json()) as WalletOverview & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Failed to load wallet status");
    }

    setNeedsAuth(false);
    setOverview(body);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        if (active) {
          await loadOverview();
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load wallet status");
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
  }, [loadOverview]);

  const canMint = useMemo(() => {
    if (!overview) return false;
    return !overview.hasChair && overview.hasRequiredChairFunds;
  }, [overview]);

  const handleMint = async () => {
    setMinting(true);
    setError(null);
    setMintResult(null);

    try {
      const res = await fetch("/api/chair/mint", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });

      const body = (await res.json()) as
        | MintResponse
        | {
            error?: string;
          };

      if (!res.ok) {
        throw new Error("error" in body && body.error ? body.error : "Mint request failed");
      }

      setMintResult(body as MintResponse);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint request failed");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">
        Global Vibez DSG
      </p>
      <h1 className="mt-4 text-3xl font-bold">Get Your Chair</h1>
      <p className="mt-4 max-w-md text-zinc-300">
        Chair holders unlock the Dealer Room — club-ready AI dealers, AAA Plus
        access, and your seat at the table.
      </p>

      {loading && <p className="mt-6 text-sm text-zinc-400">Loading wallet status...</p>}

      {!loading && needsAuth && (
        <Link
          href="/login?redirect=/checkout"
          className="mt-6 text-sm text-purple-300 transition-colors hover:text-purple-200"
        >
          Connect wallet to continue
        </Link>
      )}

      {!loading && overview && (
        <div className="mt-6 flex max-w-md flex-col items-center gap-3 text-sm text-zinc-300">
          <p className="font-mono text-zinc-400">
            Wallet: {overview.publicKey.slice(0, 4)}...{overview.publicKey.slice(-4)}
          </p>
          <p>
            Balance: {overview.solBalance.toFixed(4)} SOL (requires at least{" "}
            {overview.requiredSolForChair.toFixed(4)} SOL for ${overview.chairPriceUsd})
          </p>
          {overview.hasChair && <p className="text-emerald-300">You already own a chair.</p>}
          {!overview.hasChair && !overview.hasRequiredChairFunds && (
            <p className="text-amber-300">Insufficient balance for chair mint.</p>
          )}
          {overview.rpcError && <p className="text-amber-300">RPC warning: {overview.rpcError}</p>}

          <button
            type="button"
            onClick={handleMint}
            disabled={!canMint || minting}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-6 py-2 font-semibold text-white transition-all hover:scale-[1.02] hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {minting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Minting chair...
              </span>
            ) : (
              "Mint Chair"
            )}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      {mintResult && (
        <p className="mt-4 text-sm text-emerald-300">
          {mintResult.message} ({mintResult.txHash})
        </p>
      )}

      <p className="mt-8 max-w-md text-sm text-zinc-500">
        This mint path is now wired end-to-end with auth and funds pre-checks.
        Configure mint env vars to authorize treasury transfers and keep chair-holder
        access in sync with confirmed transactions.
      </p>

      <Link
        href="/"
        className="mt-8 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
