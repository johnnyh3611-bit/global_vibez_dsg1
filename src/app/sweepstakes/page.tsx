import { SweepstakesPanel } from "@/components/sweepstakes/SweepstakesPanel";

export const metadata = {
  title: "Global Vibez - Weekly Sweepstakes",
};

export default function SweepstakesPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-background-deep px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Genius Phase Launch</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">DSG Weekly Grand Sweepstakes</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Weekly retention loop for chair holders. Enter once per week and return for each new draw cycle.
          </p>
        </header>

        <SweepstakesPanel />
      </div>
    </main>
  );
}
