/**
 * OrientationToggle — universal in-app rotation control.
 *
 * Founder mandate (May 2026): every game room must let the player flip
 * between landscape and portrait without picking the phone up. We try
 * the proper OS-level `screen.orientation.lock(...)` first because that
 * lets the keyboard, status bar, and OS chrome rotate too. If the
 * browser refuses (Safari on iOS, non-fullscreen Chrome, desktop), we
 * fall back to a CSS `transform: rotate(90deg)` on `#root` so the same
 * tap still works.
 *
 * Three states cycle on tap: AUTO → LANDSCAPE → PORTRAIT → AUTO.
 *  - AUTO       follows the device sensor (default).
 *  - LANDSCAPE  forces wide layout regardless of how the phone is held.
 *  - PORTRAIT   forces tall layout regardless of how the phone is held.
 *
 * Choice persists in localStorage under `gv:orient-pref` so navigating
 * between rooms keeps the player's selection.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { RotateCw, Smartphone, Tablet } from 'lucide-react';

const STORAGE_KEY = 'gv:orient-pref';

export type OrientPref = 'auto' | 'landscape' | 'portrait';

export function getOrientPref(): OrientPref {
  if (typeof window === 'undefined') return 'auto';
  const v = window.localStorage?.getItem?.(STORAGE_KEY);
  if (v === 'landscape' || v === 'portrait' || v === 'auto') return v;
  return 'auto';
}

export function setOrientPref(p: OrientPref) {
  try {
    window.localStorage.setItem(STORAGE_KEY, p);
  } catch {
    // Safari private mode etc. — ignore, in-memory still works
  }
  applyOrientationPref(p);
  window.dispatchEvent(new CustomEvent('gv:orient-pref-changed', { detail: p }));
}

/**
 * Apply the current preference to the live DOM.
 *
 * Strategy
 *  1. Try OS lock via `screen.orientation.lock(...)`. Only works while
 *     in fullscreen on most mobile browsers. If this succeeds we're
 *     done — the browser handles every coordinate flip natively.
 *  2. Otherwise apply a CSS class to `<html>` that the global mobile
 *     stylesheet handles (rotates `#root` and swaps width/height).
 *
 * The CSS-class fallback is mobile-only — on tablets and desktops we
 * leave layout alone because users there can simply resize the window.
 */
async function applyOrientationPref(p: OrientPref): Promise<void> {
  const html = document.documentElement;
  html.classList.remove('gv-orient-fake-landscape', 'gv-orient-fake-portrait');
  html.dataset.orientPref = p;

  // Try OS lock
  const orientation: any = (window.screen as any)?.orientation;
  if (orientation) {
    try {
      if (p === 'auto') {
        orientation.unlock?.();
      } else if (orientation.lock) {
        await orientation.lock(p === 'landscape' ? 'landscape' : 'portrait');
        return; // success, native lock active
      }
    } catch {
      /* fallthrough to CSS fallback */
    }
  }

  if (p === 'auto') return;

  // CSS fallback — only on small viewports so we don't sideways-rotate
  // a tablet or laptop screen.
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isMobile = Math.min(w, h) < 768;
  if (!isMobile) return;

  const isCurrentlyPortrait = h > w;
  if (p === 'landscape' && isCurrentlyPortrait) {
    html.classList.add('gv-orient-fake-landscape');
  } else if (p === 'portrait' && !isCurrentlyPortrait) {
    html.classList.add('gv-orient-fake-portrait');
  }
}

interface Props {
  /** Smaller padding for in-bar usage. */
  compact?: boolean;
}

const PREF_LABEL: Record<OrientPref, string> = {
  auto: 'AUTO',
  landscape: 'WIDE',
  portrait: 'TALL',
};

export const OrientationToggle: React.FC<Props> = ({ compact = false }) => {
  const [pref, setPref] = useState<OrientPref>(getOrientPref());

  // Re-apply on resize / actual rotation events so the CSS fallback
  // un-applies once the user physically rotates the phone (matches OS
  // intent). We DO NOT clobber the user's stored preference here.
  useEffect(() => {
    applyOrientationPref(pref);
    const onResize = () => applyOrientationPref(pref);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, [pref]);

  const cycle = useCallback(() => {
    const next: OrientPref =
      pref === 'auto' ? 'landscape' : pref === 'landscape' ? 'portrait' : 'auto';
    setPref(next);
    setOrientPref(next);
  }, [pref]);

  const Icon = pref === 'portrait' ? Smartphone : pref === 'landscape' ? Tablet : RotateCw;
  const accent =
    pref === 'auto' ? 'text-cyan-300 border-cyan-400/30'
    : pref === 'landscape' ? 'text-amber-300 border-amber-400/40'
    : 'text-fuchsia-300 border-fuchsia-400/40';

  return (
    <button
      type="button"
      onClick={cycle}
      data-testid="orientation-toggle"
      data-orient-pref={pref}
      aria-label={`Orientation: ${PREF_LABEL[pref]} (tap to change)`}
      title={`Orientation: ${PREF_LABEL[pref]} — tap to cycle`}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border bg-black/50 hover:bg-black/70 transition font-bold uppercase tracking-wider ${accent} ${
        compact ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{PREF_LABEL[pref]}</span>
    </button>
  );
};

/**
 * App-level mount that applies the saved preference once on every
 * page load (before any room is entered). Renders nothing.
 */
export const OrientationApplier: React.FC = () => {
  useEffect(() => {
    applyOrientationPref(getOrientPref());
  }, []);
  return null;
};

/**
 * Mobile-only floating orientation FAB.
 *
 * Auto-hides on tablets+ (>=1024px) and inside game rooms (where
 * RoomMenuBar already includes the toggle). Sits bottom-left so it
 * doesn't clash with the "Made with Emergent" badge bottom-right or
 * the GlobeFAB top-right.
 */
export const OrientationFAB: React.FC = () => {
  const [show, setShow] = useState(false);
  const [pref, setPref] = useState<OrientPref>(getOrientPref());
  const [triggerHidden, setTriggerHidden] = useState(false);

  const cycle = useCallback(() => {
    const next: OrientPref =
      pref === 'auto' ? 'landscape' : pref === 'landscape' ? 'portrait' : 'auto';
    setOrientPref(next);
    setPref(next);
  }, [pref]);

  useEffect(() => {
    const update = () => {
      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 1024;
      // Hide inside game rooms — RoomMenuBar already has its own toggle
      const inRoom = document.querySelector('[data-testid="room-menu-bar"]') !== null;
      setShow(isMobile && !inRoom);
      // Also reflect CornerDock takeover (Vigilant Agent v2 fix)
      setTriggerHidden(document.body.dataset.cornerDockActive === '1');
    };
    update();
    const onResize = () => update();
    const onPrefChange = (e: any) => setPref(e?.detail ?? getOrientPref());
    // CornerDock dispatches this when its menu item is clicked.
    const onCDockOpen = () => cycle();
    // Re-check when DOM mounts a room bar (e.g. user clicks into a game)
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('gv:orient-pref-changed', onPrefChange as any);
    window.addEventListener('cdock:open:orientation', onCDockOpen as any);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('gv:orient-pref-changed', onPrefChange as any);
      window.removeEventListener('cdock:open:orientation', onCDockOpen as any);
    };
  }, [cycle]);

  if (!show || triggerHidden) return null;

  const Icon = pref === 'portrait' ? Smartphone : pref === 'landscape' ? Tablet : RotateCw;

  return (
    <button
      type="button"
      onClick={cycle}
      data-testid="orientation-fab"
      data-orient-pref={pref}
      aria-label={`Orientation: ${PREF_LABEL[pref]} — tap to cycle`}
      title={`Orientation: ${PREF_LABEL[pref]} — tap to cycle`}
      // 2026-05-12 fix: moved up from bottom-4 left-4 and dropped z from
      // 9998 → 40 because the previous slot occluded voice-mirror-dock-enable
      // + log-design-lesson-toggle (VigilantAgent flagged 8+ click-block
      // warnings per page mount). bottom-20 keeps it visible without
      // stealing taps from the dev/owner dock buttons.
      className="fixed bottom-20 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-black/80 backdrop-blur-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-200 shadow-lg shadow-cyan-500/20 hover:bg-black/90 transition"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
    >
      <Icon className="w-4 h-4" />
      <span>{PREF_LABEL[pref]}</span>
    </button>
  );
};

export default OrientationToggle;
