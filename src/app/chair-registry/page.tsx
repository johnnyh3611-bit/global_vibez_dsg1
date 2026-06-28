import Link from "next/link";

import { ChairRegistryView } from "@/components/chair/ChairRegistryView";
import { getSession } from "@/lib/auth";
import { walletHasChair } from "@/lib/dealer/chairs";

export const metadata = {
  title: "Global Vibez DSG - Chair Registry",
};

export default async function ChairRegistryPage() {
  const session = await getSession();
  const canView = session ? walletHasChair(session.publicKey) : false;

  if (!canView) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-background-deep px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Chair Registry</p>
          <h1 className="text-3xl font-bold">Chair-holder access required</h1>
          <p className="text-sm text-white/70">
            This transparent DSG circulation ledger is visible only to verified chair holders.
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <Link href="/checkout" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
              Get a Chair
            </Link>
            <Link href="/glasshouse" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/10">
              Back to Glasshouse
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-background-deep px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Recirculation Ledger</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Chair Registry</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            DSG circulation stays inside the ecosystem. This ledger makes that transparent to chair holders.
          </p>
        </header>

        <ChairRegistryView />
      </div>
    </main>
  );
}
