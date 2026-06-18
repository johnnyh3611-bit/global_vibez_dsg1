"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useAuth } from "@/contexts/AuthContext";

const DEMO_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_LOGIN_ENABLED === "true";

export function WalletAuth() {
  const { connected } = useWallet();
  const { signIn, demoSignIn, signingIn, error } = useAuth();

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

      {DEMO_LOGIN_ENABLED && (
        <>
          <div className="flex w-full items-center gap-3">
            <div className="flex-1 border-t border-zinc-700" />
            <span className="text-xs text-zinc-500">or</span>
            <div className="flex-1 border-t border-zinc-700" />
          </div>
          <button
            type="button"
            onClick={() => demoSignIn()}
            disabled={signingIn}
            className="w-full rounded-full border border-zinc-600 bg-transparent px-8 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Demo Login (Quick Access)
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
