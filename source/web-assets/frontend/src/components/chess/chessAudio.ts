/**
 * Crisp chess audio — drop thud, capture click, check chime.
 * Web Audio synthesis (no asset downloads). Mute via localStorage.
 */

const MUTE_KEY = "gv_chess_muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isChessMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setChessMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gainPeak: number,
  freqEnd?: number,
) {
  if (isChessMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Heavy wooden / metallic drop */
export function playPieceDrop() {
  tone(110, 0.12, "triangle", 0.22, 70);
  tone(55, 0.18, "sine", 0.12, 40);
  haptic(12);
}

/** Sharp capture click */
export function playCapture() {
  tone(320, 0.06, "square", 0.14, 180);
  tone(90, 0.1, "triangle", 0.1, 50);
  haptic(18);
}

/** Check / checkmate chime */
export function playCheck(checkmate = false) {
  tone(523, 0.12, "sine", 0.12);
  setTimeout(() => tone(checkmate ? 784 : 659, 0.16, "sine", 0.14), 90);
  if (checkmate) setTimeout(() => tone(1046, 0.22, "sine", 0.12), 200);
  haptic(checkmate ? 30 : 16);
}

export function playLift() {
  tone(240, 0.05, "sine", 0.06);
  haptic(8);
}

function haptic(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}
