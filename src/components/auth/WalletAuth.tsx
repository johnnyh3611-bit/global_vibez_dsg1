"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useAuth } from "@/contexts/AuthContext";

export function WalletAuth() {
  const { connected } = useWallet();
  const { signIn, signingIn, error } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4">
      <WalletMultiButton />

      <button
        type="button"
        onClick={() => signIn()}
        disabled={!connected || signingIn}
        className="w-full rounded-full bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {signingIn ? "Signing in…" : "Sign in with wallet"}
      </button>

      {!connected && (
        <p className="text-xs text-zinc-500">
          Connect your wallet to enable sign-in.
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
