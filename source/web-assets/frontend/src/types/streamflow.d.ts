// Ambient declaration for the lazy-loaded Solana streaming SDK. It is not a
// direct dependency and is imported dynamically in StreamflowAdmin.tsx so the
// page still loads when the SDK is absent. This file intentionally has no
// top-level import/export so the declaration is treated as an ambient module.
declare module '@streamflow/stream' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const SolanaStreamClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const GenericStreamClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ICluster: any;
}
