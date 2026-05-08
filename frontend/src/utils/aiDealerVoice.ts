/**
 * AI Dealer Voice — global on/off toggle (LOCKED v8.0).
 *
 * The user requested a single master switch in the menu bar that mutes
 * the AI dealer's voice / chatter across every game. This module owns
 * the canonical state, persists it to localStorage, and emits a window
 * event so any game room can respond live without a page reload.
 *
 * Public surface:
 *   isAIDealerVoiceMuted()           — boolean snapshot (default: false)
 *   setAIDealerVoiceMuted(muted)     — set + persist + emit
 *   subscribeToAIDealerVoice(cb)     — listener helper, returns unsub
 */
const STORAGE_KEY = 'gv_ai_dealer_voice_muted_v8';
const EVENT = 'gv:ai-dealer-voice-changed';

export function isAIDealerVoiceMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAIDealerVoiceMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* storage may be disabled — best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { muted } }));
  } catch {
    /* SSR safety */
  }
}

export function subscribeToAIDealerVoice(
  cb: (muted: boolean) => void,
): () => void {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{ muted: boolean }>;
    cb(!!ce.detail?.muted);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
