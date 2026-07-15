import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { OperationsConsole } from '@/components/ops/OperationsConsole';

export default function OperationsConsolePage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen w-full bg-[#0f172a] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-violet-400" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Operations & Monitoring</p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Platform Health Dashboard</h1>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Real-time view of backend service health, database latency, and system integrity checks.
          </p>
        </header>

        <OperationsConsole />
      </div>
    </main>
  );
}
