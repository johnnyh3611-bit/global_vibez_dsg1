import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          Powered by Solana
        </div>

        <h1 className="text-5xl font-bold tracking-tight">
          Sol<span className="text-violet-600">Date</span>
        </h1>

        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          The dating app where your wallet is your identity. Connect, sign, and
          start matching with fellow Solana enthusiasts.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-full bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Get started
          </Link>
          <Link
            href="/dating"
            className="rounded-full border border-zinc-300 px-8 py-3 text-sm font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Browse profiles
          </Link>
          <Link
            href="/dealer"
            className="rounded-full border border-violet-300 px-8 py-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            Dealer lounge
          </Link>
        </div>
      </div>
    </div>
  );
}
