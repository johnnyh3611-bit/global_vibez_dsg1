import { EarningsWidget } from "@/components/dashboard/EarningsWidget";
import { JobBoard } from "@/components/dashboard/JobBoard";

export const metadata = {
  title: "Dashboard — Global Vibez DSG",
  description: "Your gaming, dating, streaming, and earning hub.",
};

export default function DashboardPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-background-deep px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold sm:text-5xl">
            Your Vibe Hub
          </h1>
          <p className="mt-2 max-w-2xl text-base text-white/70">
            Everything you can do right now — gaming, dating, streaming, and earning.
            Pick your next move.
          </p>
        </header>

        {/* Earnings Stats */}
        <EarningsWidget />

        {/* Job Board */}
        <JobBoard />

        {/* Footer CTA */}
        <div className="mt-16 rounded-glass border border-surface-glass-border bg-gradient-to-r from-brand-primary/10 to-brand-accent/10 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white">
            Want to maximize earnings?
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Combine roles: Play games, stream your wins, and refer friends for maximum rewards.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href="/earn"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-6 font-semibold text-white transition-all hover:scale-105 hover:bg-brand-primary-hover"
            >
              Explore All Earning Options
            </a>
            <a
              href="/tv/broadcast"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-surface-glass-border bg-transparent px-6 font-semibold text-white transition-all hover:bg-surface-glass"
            >
              Start Streaming Now
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
