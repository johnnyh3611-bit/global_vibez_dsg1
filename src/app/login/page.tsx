"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WalletAuth } from "@/components/auth/WalletAuth";
import { useAuth } from "@/contexts/AuthContext";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, loading } = useAuth();
  const redirect = searchParams.get("redirect") ?? "/dating";

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace(redirect);
    }
  }, [authenticated, loading, redirect, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            &larr; Back to home
          </Link>
          <h1 className="mt-6 text-3xl font-bold">Sign in with Solana</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Connect your wallet and sign a message to verify ownership. No
            passwords, no emails — just your public key.
          </p>
        </div>

        <div>Auth Component Removed</div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            How it works
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Connect your Solana wallet</li>
            <li>Sign a one-time verification message</li>
            <li>Access the dating feature with your session</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-zinc-500">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
