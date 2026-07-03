import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SweepstakesPanel } from '@/components/sweepstakes/SweepstakesPanel';

export default function SweepstakesPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen w-full bg-[#0f172a] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Back
          </button>
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
