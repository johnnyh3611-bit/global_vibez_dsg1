import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth/session";

export default async function CheckoutPage() {
  const session = await getSessionFromCookies();

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

      {session ? (
        <p className="mt-6 font-mono text-sm text-zinc-400">
          Wallet: {session.publicKey.slice(0, 4)}...{session.publicKey.slice(-4)}
        </p>
      ) : (
        <Link
          href="/login?redirect=/checkout"
          className="mt-6 text-sm text-purple-300 transition-colors hover:text-purple-200"
        >
          Connect wallet to continue
        </Link>
      )}

      <p className="mt-8 max-w-md text-sm text-zinc-500">
        Checkout integration coming soon. For early access, add your wallet to{" "}
        <code className="text-zinc-300">CHAIR_HOLDER_WALLETS</code> in{" "}
        <code className="text-zinc-300">.env.local</code>.
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
