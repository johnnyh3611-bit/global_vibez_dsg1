// Global ambient declarations for the app.
export {};

declare global {
  interface Window {
    /** VibeDice654 stores the current server-side roll id for stand/reroll. */
    currentRollId?: string | null;
    /** Web Speech API — Chrome / Safari vendor-prefixed. */
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    /** Legacy Safari audio context prefix. */
    webkitAudioContext?: typeof AudioContext;
  }

  // Allow `new Date() - new Date()` without casting — used in "time ago" loops.
  interface Date {
    [Symbol.toPrimitive](hint: 'number'): number;
  }
}

// Lazy-loaded Solana streaming SDK — not a direct dependency, imported
// dynamically in StreamflowAdmin.tsx so the page still loads without it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module '@streamflow/stream' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const SolanaStreamClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const GenericStreamClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ICluster: any;
}
