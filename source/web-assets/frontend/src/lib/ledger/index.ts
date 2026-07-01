/**
 * Public surface of the Ledger Solana signing helpers.
 *
 * Use {@link useLedgerSigning} from React components, and the lower-level
 * `signTransactionWithLedger` / `signMessageWithLedger` if you already have
 * a `SignerSolana` reference outside React.
 */
export {
  signTransactionWithLedger,
  signMessageWithLedger,
  getAddressFromLedger,
  applyLedgerSignature,
  serializeForLedger,
  type LedgerSigningProgress,
  type SignWithLedgerOptions,
} from "./signing";

export {
  useLedgerSigning,
  type UseLedgerSigning,
} from "./useLedgerSigning";
