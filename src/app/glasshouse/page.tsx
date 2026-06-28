import Link from "next/link";

import { CelestialGlasshousePanel } from "@/components/dashboard/CelestialGlasshousePanel";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Global Vibez - Celestial Glasshouse",
};

export default async function GlasshousePage() {
  const session = await getSession();

  return (
    <main className="min-h-[calc(100vh-64px)] bg-background-deep px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Genius Phase</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Celestial Glasshouse Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Connect, verify, and watch your Chair ownership update in real time.
            This is the investor &quot;Aha&quot; moment wired directly to your wallet session.
          </p>
          {session && (
            <p className="mt-3 font-mono text-xs text-white/50">
              Signed in: {session.publicKey.slice(0, 4)}...{session.publicKey.slice(-4)}
            </p>
          )}
        </header>

        <CelestialGlasshousePanel />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/chair-registry" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
            Open Chair Registry
          </Link>
          <Link href="/sweepstakes" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
            Weekly Sweepstakes
          </Link>
          <Link href="/operations" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
            Whole Unit Test Console
          </Link>
        </div>
      </div>
    </main>
  );
}
