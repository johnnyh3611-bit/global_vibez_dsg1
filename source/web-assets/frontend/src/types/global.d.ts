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
