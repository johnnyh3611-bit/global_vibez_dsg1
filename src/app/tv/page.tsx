import { TvFeed } from "@/components/tv/TvFeed";

export const metadata = {
  title: "Global Vibez — TV Network",
};

export default function TvNetworkPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-background-deep px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-accent">
            TV Network
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">The Global Vibez channel</h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            A live feed of auto-generated content — game highlights, winner
            announcements, and house reports synthesised from the floor.
          </p>
        </header>

        <TvFeed />
      </div>
    </main>
  );
}
