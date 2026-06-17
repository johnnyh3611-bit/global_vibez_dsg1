/**
 * MainnetSignRehearsal — a 5-step pre-flight checklist the founder works
 * through before signing their first real-money Squads transaction.
 *
 * State persists in localStorage so the founder (or a co-founder) can
 * pick up mid-checklist if they get distracted. Each step has a clear
 * "what" and a clear "how to verify" so the first MAINNET sign feels
 * rehearsed, not nerve-wracking.
 *
 * Designed as a hand-off doc: a co-founder/team member can open the
 * Treasury panel, see this card, and complete the rehearsal without
 * needing the founder on the call to walk them through it.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ListChecks, RotateCcw } from "lucide-react";

const STORAGE_KEY = "vibez:mainnet-sign-rehearsal:v1";

interface Step {
  id: string;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    id: "phantom-on-mainnet",
    title: "Phantom is on Mainnet (not Devnet)",
    detail:
      "Open Phantom → Settings (gear) → Developer Settings → Testnet Mode is OFF. Top of the wallet should show no yellow 'Devnet' banner.",
  },
  {
    id: "fee-buffer",
    title: "Phantom holds ≥ 0.01 SOL for transaction fees",
    detail:
      "Two Squads txs (vault + proposal) cost ~0.001 SOL combined plus rent. Top up if your wallet balance shows under 0.01 SOL.",
  },
  {
    id: "vault-funded",
    title: "Squads vault holds enough SOL to cover the test transfer",
    detail:
      "Vault must hold ≥ 0.001 SOL plus rent-exempt minimum. Confirm on the Squads card above (live balance).",
  },
  {
    id: "create-test-tx",
    title: "Create 0.001 SOL test proposal in the Squads UI",
    detail:
      "Click 'New Transaction (Squads UI)' on the card above → Send SOL → 0.001 → destination = your founder cosigner. Sign in Phantom (Cosigner 1).",
  },
  {
    id: "approve-cosigner-2",
    title: "Approve from Cosigner 2 + execute",
    detail:
      "Switch wallet in Phantom (or open in a different browser) to Cosigner 2 → return to the Squads UI → approve the same proposal → click Execute. Confirm the on-chain signature on Solscan.",
  },
];

export default function MainnetSignRehearsal() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Record<string, boolean>) => {
    setDone(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggle = (id: string) => {
    persist({ ...done, [id]: !done[id] });
  };

  const reset = () => {
    persist({});
  };

  const completed = STEPS.filter((s) => done[s.id]).length;
  const allDone = completed === STEPS.length;

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5 space-y-4"
      data-testid="mainnet-sign-rehearsal-card"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-fuchsia-400" />
          <div>
            <h3 className="text-sm uppercase tracking-wider text-slate-300">
              First Mainnet Sign · Rehearsal Checklist
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Walk through these once before the first real-money Squads
              signing. State persists locally — pick up where you left off.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-full border ${
              allDone
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
            data-testid="rehearsal-progress"
          >
            {completed} / {STEPS.length}
          </span>
          {completed > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
              data-testid="rehearsal-reset-btn"
              title="Reset checklist"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, idx) => {
          const isDone = !!done[s.id];
          return (
            <li
              key={s.id}
              data-testid={`rehearsal-step-${s.id}`}
              className={`rounded-lg border p-3 transition ${
                isDone
                  ? "bg-emerald-950/20 border-emerald-700/40"
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="flex items-start gap-3 w-full text-left"
                data-testid={`rehearsal-toggle-${s.id}`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold ${isDone ? "text-emerald-200 line-through decoration-emerald-700/60" : "text-white"}`}
                  >
                    {idx + 1}. {s.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <div
          className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200"
          data-testid="rehearsal-complete-banner"
        >
          ✅ Rehearsal complete. You're ready for the first real-money
          Squads signing. Take a breath, double-check the recipient
          address one more time, and execute.
        </div>
      )}
    </Card>
  );
}
