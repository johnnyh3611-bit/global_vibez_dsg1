import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ChairRegistryView } from '@/components/chair/ChairRegistryView';

export default function ChairLedgerPage() {
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
          <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Chair Registry</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">DSG Circulation Ledger</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Transparent DSG token circulation ledger for verified chair holders.
          </p>
        </header>

        <ChairRegistryView />
      </div>
    </main>
  );
}
