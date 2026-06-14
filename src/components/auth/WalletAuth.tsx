"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/contexts/AuthContext";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletAuth() {
  const { connected, publicKey } = useWallet();
  const { authenticated, signingIn, error, signIn, signOut, demoLogin } = useAuth();

  if (authenticated && publicKey) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-zinc-500">
          Signed in as{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {truncateAddress(publicKey.toBase58())}
          </span>
        </p>
        <button
          onClick={signOut}
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <WalletMultiButton className="!rounded-full !bg-violet-600 !h-12 !px-8 hover:!bg-violet-700" />

      {connected && publicKey && (
        <button
          onClick={signIn}
          disabled={signingIn}
          className="rounded-full bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {signingIn ? "Signing message..." : "Sign in with wallet"}
        </button>
      )}

      {!connected && (
        <p className="max-w-sm text-center text-sm text-zinc-500">
          Connect a Solana wallet (Phantom or Solflare), then sign a message to
          verify ownership.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Testing? Use demo login:
        </p>
        <button
          onClick={demoLogin}
          disabled={signingIn}
          className="rounded-full bg-blue-600 px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {signingIn ? "Signing in..." : "Demo Login"}
        </button>
      </div>
    </div>
  );
}
