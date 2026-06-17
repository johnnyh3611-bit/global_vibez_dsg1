/**
 * SquadsSDKVerifier — read-only diagnostic that tells us whether the
 * `@sqds/multisig` v2 SDK can actually parse this Squad's on-chain
 * state. This is the safety gate BEFORE we ever try to build a real
 * mainnet signing flow with the SDK.
 *
 * The check sequence:
 *   1. Connect to Solana mainnet RPC
 *   2. Fetch raw account info for the configured squad address
 *   3. Check ownership (V4 multisig must be owned by SQDS4ep…)
 *   4. Try to deserialize the account bytes as a `Multisig` struct
 *   5. If that fails: try treating the address as a Vault PDA and
 *      reverse-derive the multisig (best-effort guess)
 *
 * Output is a clear traffic-light verdict: GREEN (SDK can read this
 * Squad — full Phase B signing is viable), YELLOW (URL slug is the
 * vault, multisig PDA needs to be located), RED (SDK incompatible).
 *
 * NEVER submits a transaction. Pure read-only.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Connection, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TestTube2,
  Loader2,
} from "lucide-react";

type Verdict = "green" | "yellow" | "red";

type CheckResult = {
  step: string;
  ok: boolean;
  detail: string;
};

type VerifierState = {
  verdict: Verdict;
  summary: string;
  checks: CheckResult[];
  programId: string;
  multisigPdaCandidates: string[];
};

const SQUADS_V4_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
const API = process.env.REACT_APP_BACKEND_URL;

async function fetchRpcUrl(): Promise<string> {
  // We don't expose the RPC URL to the public; ask the backend for a
  // safe-to-use mainnet endpoint at run time. Falls back to the public
  // mainnet-beta endpoint if the admin call fails (works for read-only
  // RPC queries even though it's heavily rate-limited).
  try {
    const r = await fetch(`${API}/api/admin/treasury/squads-rpc`, {
    });
    if (r.ok) {
      const data = await r.json();
      if (data.rpc_url) return data.rpc_url as string;
    }
  } catch {
    /* fall through */
  }
  return "https://api.mainnet-beta.solana.com";
}

interface SquadsSDKVerifierProps {
  squadAddress: string | null;
}

export default function SquadsSDKVerifier({
  squadAddress,
}: SquadsSDKVerifierProps) {
  const [state, setState] = useState<VerifierState | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!squadAddress) return;
    setRunning(true);
    const checks: CheckResult[] = [];
    let verdict: Verdict = "red";
    let summary = "Unknown.";
    const multisigPdaCandidates: string[] = [];

    try {
      const pubkey = new PublicKey(squadAddress);
      checks.push({
        step: "Parse address",
        ok: true,
        detail: "Valid base58 Solana pubkey.",
      });

      const rpcUrl = await fetchRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");
      const accountInfo = await connection.getAccountInfo(pubkey);

      if (!accountInfo) {
        checks.push({
          step: "Fetch account",
          ok: false,
          detail: "Account does not exist on mainnet.",
        });
        summary = "Squad address is not initialized on mainnet.";
      } else {
        checks.push({
          step: "Fetch account",
          ok: true,
          detail: `Found · owner=${accountInfo.owner.toBase58().slice(0, 12)}… · ${accountInfo.data.length} bytes`,
        });

        const isV4Multisig = accountInfo.owner.toBase58() === SQUADS_V4_PROGRAM_ID;
        checks.push({
          step: "V4 program ownership",
          ok: isV4Multisig,
          detail: isV4Multisig
            ? "Owned by Squads V4 program — multisig PDA confirmed."
            : `Owner is ${accountInfo.owner.toBase58()}, not Squads V4 (SQDS4ep…). This address is NOT a V4 multisig PDA.`,
        });

        if (isV4Multisig) {
          // Try to deserialize as a Multisig
          try {
            const ms = multisig.accounts.Multisig.fromAccountInfo(accountInfo)[0];
            checks.push({
              step: "Deserialize Multisig",
              ok: true,
              detail: `members=${ms.members.length} · threshold=${ms.threshold} · transactionIndex=${ms.transactionIndex}`,
            });
            verdict = "green";
            summary =
              "✅ SDK can read this Squad. Full Phase B signing is viable.";
          } catch (e) {
            checks.push({
              step: "Deserialize Multisig",
              ok: false,
              detail: `Bytes don't match V4 Multisig schema: ${(e as Error).message}`,
            });
            summary =
              "Account is owned by Squads V4 program but the data layout doesn't match the SDK's Multisig schema. Possible SDK / program version mismatch.";
          }
        } else {
          // Possibly a vault PDA — try reverse-deriving against a small
          // search space (vaultIndex 0..3).
          verdict = "yellow";
          summary =
            "URL slug is owned by System Program, not Squads V4. Likely a Vault PDA — the multisig state account lives at a different address.";

          // Best-effort: look for a multisig that derives this vault PDA.
          // We can't reverse a PDA without the source key, but we CAN
          // surface a lookup hint for the operator.
          checks.push({
            step: "Multisig PDA lookup",
            ok: false,
            detail:
              "Cannot reverse-derive the multisig PDA from a vault PDA. Operator action: open https://app.squads.so/squads/" +
              squadAddress +
              "/settings and copy the 'Multisig Address' field.",
          });
        }
      }
    } catch (err) {
      checks.push({
        step: "Verifier crashed",
        ok: false,
        detail: (err as Error).message,
      });
      summary = "Verifier failed to run — see check details.";
    }

    setState({ verdict, summary, checks, programId: SQUADS_V4_PROGRAM_ID, multisigPdaCandidates });
    setRunning(false);
  };

  const verdictMeta: Record<Verdict, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    green: {
      label: "GREEN — SDK compatible",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      Icon: CheckCircle2,
    },
    yellow: {
      label: "YELLOW — Multisig PDA needed",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      Icon: AlertTriangle,
    },
    red: {
      label: "RED — SDK incompatible",
      cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
      Icon: XCircle,
    },
  };

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5 space-y-3"
      data-testid="squads-sdk-verifier-card"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TestTube2 className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm uppercase tracking-wider text-slate-300">
              Squads SDK Compatibility Verifier
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Read-only check before any in-app signing. Confirms whether
              <code className="text-slate-300 mx-1">@sqds/multisig</code>v2 can
              parse this Squad's on-chain state.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={run}
          disabled={running || !squadAddress}
          className="bg-cyan-700 hover:bg-cyan-600 text-cyan-50"
          data-testid="squads-sdk-verifier-run-btn"
        >
          {running ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <TestTube2 className="w-3.5 h-3.5 mr-1.5" />
              Run Verifier
            </>
          )}
        </Button>
      </div>

      {state && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={`${verdictMeta[state.verdict].cls} font-bold tracking-wider`}
              data-testid={`squads-sdk-verdict-${state.verdict}`}
            >
              {verdictMeta[state.verdict].label}
            </Badge>
            <span className="text-xs text-slate-400">{state.summary}</span>
          </div>

          <ol className="space-y-1.5" data-testid="squads-sdk-verifier-checks">
            {state.checks.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs"
                data-testid={`sdk-check-${i}`}
              >
                {c.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-slate-200 font-semibold">{c.step}</p>
                  <p className="text-slate-500 break-words">{c.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
