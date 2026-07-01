/**
 * `useLedgerSigning()` — convenience hook that bundles the Ledger context's
 * `signer`/`publicKey` with the typed wrappers in `./signing`. Call sites
 * get a flat, async API:
 *
 *   const { signTransaction, signMessage, applySignatureTo } = useLedgerSigning();
 *
 *   const sig = await signTransaction(tx, { onStep: (s) => toast(s.userAction) });
 *   applySignatureTo(tx, sig);
 *
 * Throws a clear error if no Ledger is connected — call `useLedger().connect()`
 * before invoking these.
 */
import { useCallback, useMemo } from "react";
import { type PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";

import { useLedger } from "@/components/web3/LedgerSignerProvider";
import {
  applyLedgerSignature,
  getAddressFromLedger,
  signMessageWithLedger,
  signTransactionWithLedger,
  type SignWithLedgerOptions,
} from "./signing";

export interface UseLedgerSigning {
  /** True when a Ledger is paired and ready to sign. */
  ready: boolean;
  /** The public key derived at the current path (or null if not connected). */
  publicKey: PublicKey | null;
  signTransaction: (
    tx: Transaction | VersionedTransaction,
    opts?: SignWithLedgerOptions,
  ) => Promise<Uint8Array>;
  signMessage: (
    message: string | Uint8Array,
    opts?: SignWithLedgerOptions,
  ) => Promise<Uint8Array>;
  /** Re-derive (and optionally verify on device) the address at a path. */
  getAddress: (
    opts?: SignWithLedgerOptions & { verifyOnDevice?: boolean },
  ) => Promise<PublicKey>;
  /** Stitch a Ledger signature onto a legacy `Transaction` for broadcasting. */
  applySignatureTo: (tx: Transaction, signature: Uint8Array) => Transaction;
}

function notConnected(): never {
  throw new Error(
    "Ledger not connected — call useLedger().connect() before signing.",
  );
}

export function useLedgerSigning(): UseLedgerSigning {
  const { signer, publicKey, status } = useLedger();
  const ready = status === "connected" && !!signer && !!publicKey;

  const signTransaction = useCallback<UseLedgerSigning["signTransaction"]>(
    (tx, opts) => (ready && signer ? signTransactionWithLedger(signer, tx, opts) : notConnected()),
    [ready, signer],
  );

  const signMessage = useCallback<UseLedgerSigning["signMessage"]>(
    (msg, opts) => (ready && signer ? signMessageWithLedger(signer, msg, opts) : notConnected()),
    [ready, signer],
  );

  const getAddress = useCallback<UseLedgerSigning["getAddress"]>(
    (opts) => (ready && signer ? getAddressFromLedger(signer, opts) : notConnected()),
    [ready, signer],
  );

  const applySignatureTo = useCallback<UseLedgerSigning["applySignatureTo"]>(
    (tx, sig) => {
      if (!publicKey) notConnected();
      return applyLedgerSignature(tx, publicKey, sig);
    },
    [publicKey],
  );

  return useMemo(
    () => ({
      ready,
      publicKey,
      signTransaction,
      signMessage,
      getAddress,
      applySignatureTo,
    }),
    [ready, publicKey, signTransaction, signMessage, getAddress, applySignatureTo],
  );
}
