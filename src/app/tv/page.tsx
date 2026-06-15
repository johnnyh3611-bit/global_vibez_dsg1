import { GlobalCard } from "@/components/ui/GlobalCard";

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
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Live channels, coming soon</h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            The Global Vibez stream goes here — events, tables, and lounges in real time.
          </p>
        </header>

        <GlobalCard className="overflow-hidden p-0">
          {/* Stream slot — glass panel ready to receive an HLS/video player */}
          <div className="relative aspect-video w-full bg-background-abyss">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25),transparent_60%)]"
              aria-hidden
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-surface-glass-border bg-surface-glass text-3xl shadow-brand-glow backdrop-blur-md">
                &#9658;
              </span>
              <p className="text-lg font-semibold">Stream offline</p>
              <p className="max-w-sm text-sm text-white/60">
                This glass panel is wired for the live player. Drop in the HLS source to go live.
              </p>
            </div>
          </div>
        </GlobalCard>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["Main Stage", "Tables", "Lounge", "Events"].map((channel) => (
            <GlobalCard key={channel} interactive className="p-4 text-center">
              <p className="text-sm font-semibold">{channel}</p>
              <p className="mt-1 text-xs text-white/50">Offline</p>
            </GlobalCard>
          ))}
        </div>
      </div>
    </main>
  );
}
