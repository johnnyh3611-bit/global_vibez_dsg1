/**
 * Typed wrappers around the Ledger Solana signer's rxjs-based device-action
 * pipeline. Reduces every signing flow to a clean `await` while preserving
 * the rich progress callbacks that the Device Action system provides.
 *
 * Without these helpers, every call site has to deal with:
 *   - rxjs `Observable` plumbing (`firstValueFrom`, `filter`, `tap`)
 *   - five possible state branches (`not-started | pending | stopped | completed | error`)
 *   - intermediate `requiredUserInteraction` strings to surface to the UI
 *
 * With them:
 *   const sigBytes = await signTransactionWithLedger(signer, tx, {
 *     onStep: (s) => toast(s),                  // optional UX feedback
 *   });
 */
import {
  DeviceActionStatus,
  type DeviceActionState,
} from "@ledgerhq/device-management-kit";
import type { SignerSolana } from "@ledgerhq/device-signer-kit-solana";
import { PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { firstValueFrom, lastValueFrom, tap } from "rxjs";

import { LEDGER_SOLANA_DEFAULT_PATH } from "@/components/web3/LedgerSignerProvider";

/**
 * Optional progress hook fired on every Device Action state transition.
 * `step` is the string ID from the kit (e.g. `"signer.sol.steps.openApp"`).
 * `userAction` is what the device is asking the user to do (e.g.
 * `"verify-address"` or `"open-app"`) — surface this in toasts/modals.
 */
export type LedgerSigningProgress = (info: {
  step?: string;
  userAction?: string;
  raw: DeviceActionState<unknown, unknown, unknown>;
}) => void;

export interface SignWithLedgerOptions {
  /** BIP-44 path. Defaults to Solana app's standard path. */
  derivationPath?: string;
  /** Optional progress callback for UX. */
  onStep?: LedgerSigningProgress;
}

/**
 * Convert the Solana web3.js `Transaction` (or `VersionedTransaction`) into
 * the raw `Uint8Array` payload the Ledger Solana app expects.
 *
 * For legacy `Transaction`, we use `serialize({ requireAllSignatures: false,
 * verifySignatures: false })` so we can fetch the user's signature from the
 * device without having a fully-signed payload yet.
 */
export function serializeForLedger(tx: Transaction | VersionedTransaction): Uint8Array {
  if ("version" in tx) {
    // VersionedTransaction
    return tx.serialize();
  }
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}


function describeUserInteraction(value: unknown): string | undefined {
  if (
    value &&
    typeof value === "object" &&
    "requiredUserInteraction" in value &&
    typeof (value as { requiredUserInteraction: unknown }).requiredUserInteraction === "string"
  ) {
    return (value as { requiredUserInteraction: string }).requiredUserInteraction;
  }
  return undefined;
}

function describeStep(value: unknown): string | undefined {
  if (
    value &&
    typeof value === "object" &&
    "step" in value &&
    typeof (value as { step: unknown }).step === "string"
  ) {
    return (value as { step: string }).step;
  }
  return undefined;
}


/**
 * Run any Ledger Device Action `Observable` to completion and return its
 * `Output`, throwing if the action errors out or is stopped early.
 *
 * This is the single source of truth for "wait for the device" — every
 * `signTransactionWithLedger`, `signMessageWithLedger`, and
 * `getAddressWithLedger` funnels through here.
 */
async function awaitDeviceAction<O>(
  observable: { subscribe: unknown },
  onStep?: LedgerSigningProgress,
): Promise<O> {
  // The kit's Observable type isn't standard rxjs (it's their own with
  // `subscribe`), but it implements the rxjs contract — cast safely.
  const obs = observable as unknown as Parameters<typeof lastValueFrom>[0];

  const tapped = (obs as { pipe: (...ops: unknown[]) => unknown }).pipe(
    tap((state: DeviceActionState<unknown, unknown, unknown>) => {
      if (!onStep) return;
      const userAction =
        state.status === DeviceActionStatus.Pending
          ? describeUserInteraction(state.intermediateValue)
          : undefined;
      const step =
        state.status === DeviceActionStatus.Pending
          ? describeStep(state.intermediateValue)
          : undefined;
      onStep({ step, userAction, raw: state });
    }),
  );

  const final = await lastValueFrom(
    tapped as unknown as Parameters<typeof lastValueFrom>[0],
  ) as DeviceActionState<O, unknown, unknown>;

  if (final.status === DeviceActionStatus.Completed) return final.output;
  if (final.status === DeviceActionStatus.Error) {
    throw final.error instanceof Error
      ? final.error
      : new Error(`Ledger device action failed: ${JSON.stringify(final.error)}`);
  }
  throw new Error(`Ledger device action ended unexpectedly: ${final.status}`);
}


/**
 * Sign a Solana transaction with a connected Ledger and return the raw
 * 64-byte ed25519 signature. The caller is responsible for stitching the
 * signature back onto the transaction (see {@link applyLedgerSignature}).
 *
 * @example
 *   const sig = await signTransactionWithLedger(signer, tx);
 *   applyLedgerSignature(tx, publicKey, sig);
 *   await connection.sendRawTransaction(tx.serialize());
 */
export async function signTransactionWithLedger(
  signer: SignerSolana,
  tx: Transaction | VersionedTransaction,
  opts: SignWithLedgerOptions = {},
): Promise<Uint8Array> {
  const path = opts.derivationPath ?? LEDGER_SOLANA_DEFAULT_PATH;
  const payload = serializeForLedger(tx);
  const flow = signer.signTransaction(path, payload);
  return awaitDeviceAction<Uint8Array>(flow.observable, opts.onStep);
}


/**
 * Sign an arbitrary off-chain message (login challenge, EIP-191-style
 * proof). Returns the raw 64-byte signature. The Ledger Solana app
 * displays the message to the user before signing.
 */
export async function signMessageWithLedger(
  signer: SignerSolana,
  message: string | Uint8Array,
  opts: SignWithLedgerOptions = {},
): Promise<Uint8Array> {
  const path = opts.derivationPath ?? LEDGER_SOLANA_DEFAULT_PATH;
  const flow = signer.signMessage(path, message);
  return awaitDeviceAction<Uint8Array>(flow.observable, opts.onStep);
}


/**
 * Read the public key at a derivation path. By default does NOT prompt the
 * user (uses `checkOnDevice: false`) — pass `verifyOnDevice: true` to ask
 * the user to confirm the address on their hardware screen.
 */
export async function getAddressFromLedger(
  signer: SignerSolana,
  opts: SignWithLedgerOptions & { verifyOnDevice?: boolean } = {},
): Promise<PublicKey> {
  const path = opts.derivationPath ?? LEDGER_SOLANA_DEFAULT_PATH;
  const flow = signer.getAddress(path, { checkOnDevice: !!opts.verifyOnDevice });
  const out = await awaitDeviceAction<{ address: string; publicKey?: string }>(
    flow.observable,
    opts.onStep,
  );
  return new PublicKey(out.address);
}


/**
 * Stitch a Ledger-produced signature onto an unsigned legacy
 * {@link Transaction}. Mutates the transaction in place AND returns it for
 * fluent chaining. For `VersionedTransaction`, prefer the standard
 * `tx.addSignature(pubkey, signature)` API directly.
 *
 * Web3.js requires the signer's pubkey to be present in the
 * transaction's `signatures` array before `addSignature` will accept the
 * bytes — pass the `PublicKey` you got from {@link getAddressFromLedger}.
 */
export function applyLedgerSignature(
  tx: Transaction,
  publicKey: PublicKey,
  signature: Uint8Array,
): Transaction {
  tx.addSignature(publicKey, Buffer.from(signature));
  return tx;
}
