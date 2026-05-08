/**
 * WhatsNewBanner — slides in on any page (except hidden routes + landing)
 * when the user hasn't acknowledged the current drop version yet.
 *
 * Shares the `fresh_drops_seen_version` localStorage key with
 * FreshDropsLauncher so dismissing one marks both as seen. Clicking
 * "What's new" opens the launcher menu (by simulating a custom event).
 */
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { CURRENT_DROP_VERSION } from "./FreshDropsLauncher";

const SEEN_KEY = "fresh_drops_seen_version";
const HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/vibe-drive/hud", "/vibe-vault-admin", "/chair-hall"];

// Human-readable headline per drop. Update when bumping CURRENT_DROP_VERSION.
const DROP_HEADLINES: Record<string, string> = {
  "2026-02-22-drop-4": "Just for the Night rooms are now live. Vanishing chat + voice inside.",
  "2026-02-21-drop-3": "Driver HUD + Landing discovery hub shipped. Tap to explore.",
};

const WhatsNewBanner: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      setVisible(seen !== CURRENT_DROP_VERSION);
    } catch {
      setVisible(false);
    }
  }, []);

  const p = location.pathname;
  const hidden =
    p === "/" || HIDDEN_PREFIXES.some((pre) => p.startsWith(pre));

  const dismiss = () => {
    setDismissing(true);
    setTimeout(() => {
      try { localStorage.setItem(SEEN_KEY, CURRENT_DROP_VERSION); } catch {
        // noop
      }
      setVisible(false);
    }, 220);
  };

  const openLauncher = () => {
    // Trigger the launcher via click synthesis on its button
    const btn = document.querySelector<HTMLButtonElement>('[data-testid="fresh-drops-launcher-btn"]');
    btn?.click();
    dismiss();
  };

  if (!visible || hidden) return null;

  const headline = DROP_HEADLINES[CURRENT_DROP_VERSION] ?? "New features are live.";

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[55] w-[min(90vw,440px)] transition-all ${
        dismissing ? "opacity-0 -translate-y-2" : "opacity-100"
      }`}
      data-testid="whats-new-banner"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-600/90 to-cyan-500/90 backdrop-blur-xl border border-white/20 shadow-xl">
        <Sparkles className="w-4 h-4 text-white shrink-0" />
        <span className="text-xs sm:text-sm font-bold text-white truncate">
          What&apos;s new: <span className="font-normal">{headline}</span>
        </span>
        <button
          onClick={openLauncher}
          className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30 hover:bg-black/50 text-[10px] font-bold uppercase tracking-widest text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          data-testid="whats-new-open-btn"
        >
          Explore <ArrowRight className="w-3 h-3" />
        </button>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-full text-white/80 hover:text-white hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          data-testid="whats-new-dismiss-btn"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default WhatsNewBanner;
