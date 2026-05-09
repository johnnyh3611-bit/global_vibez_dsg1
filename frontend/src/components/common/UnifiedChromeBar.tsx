/**
 * UnifiedChromeBar — single dedicated dock for ALL platform chrome.
 *
 * Founder ask (2026-02-09 voice memo, paraphrased):
 *   "Each page needs a particular spot where these buttons live. Comms
 *   to Tools to More — and tell me what that Emergent button is. Inside
 *   a game it can all live in the room menu, but OUTSIDE the game I
 *   need ONE specific spot they don't intertrude with content."
 *
 * Design contract
 * ───────────────
 *   • Position: fixed bottom-center on every protected page.
 *   • Content: 4 labeled pills inside a single glass strip:
 *       📢 COMMS    — opens the existing CommHubDropdown menu
 *       🔧 TOOLS    — opens a labeled menu for Voice Mirror /
 *                     Auto-Rotate / Beta Feedback
 *       ✨ MORE     — Cultural Hub / Fresh Drops / Hungry Vibez
 *       ⚡ EMERGENT — static info pill that ACKNOWLEDGES the
 *                     platform-injected "Made with Emergent" badge so
 *                     the user knows what the badge to its right is.
 *   • Hides on:
 *       – Game pages where RoomMenuBar is mounted (room owns chrome)
 *       – Streamer overlay (must stay clean for OBS)
 *       – Auth pages (/login, /signup)
 *   • Sets `document.body.dataset.chromeBarActive = "1"` so legacy
 *     free-floating FABs (CommHub pill, GlobeFAB, BetaFeedback,
 *     FreshDrops, FloatingFood, OrientationFAB, VoiceMirrorDock,
 *     LogDesignLesson) collapse their own triggers.
 *   • Pop-out menus open UPWARDS so the dock itself doesn't shift.
 */
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Headphones, Wrench, Sparkles,
  MessageSquare, Mic, RotateCcw, Globe, Utensils,
  ChevronUp,
} from "lucide-react";

const HIDE_PATTERNS: RegExp[] = [
  /^\/streamer\/overlay/,
  /^\/login/, /^\/signup/, /^\/auth/,
];

interface SubItem {
  id: string;
  label: string;
  hint?: string;
  Icon: React.ElementType;
  color: string;        // tailwind text-XXX
  href?: string;        // if set, opens a link instead of firing event
  onClick?: () => void; // direct handler (overrides event fire)
}

const fire = (id: string) => () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`cdock:open:${id}`));
  }
};

const COMMS_ITEMS: SubItem[] = [
  { id: "voice_mirror_alt", label: "Voice Mirror",      hint: "Real-time speech translation",   Icon: Mic,           color: "text-cyan-300",    onClick: fire("voice_mirror") },
  { id: "comm_mute_all",    label: "Mute All Comms",    hint: "Toggle voice + chat mute",       Icon: Headphones,    color: "text-rose-300",    onClick: () => window.dispatchEvent(new CustomEvent("commhub:mute-all", { detail: { muted: true } })) },
  { id: "comm_open_inbox",  label: "Open Inbox",        hint: "Friend messages",                Icon: MessageSquare, color: "text-fuchsia-300", href: "/inbox" },
];

const TOOLS_ITEMS: SubItem[] = [
  { id: "voice_mirror",  label: "Voice Mirror",      hint: "Hold to speak in any language", Icon: Mic,           color: "text-cyan-300",    onClick: fire("voice_mirror") },
  { id: "orientation",   label: "Auto-Rotate Lock",  hint: "Pin landscape or portrait",     Icon: RotateCcw,     color: "text-emerald-300", onClick: fire("orientation") },
  { id: "beta_feedback", label: "Beta Feedback",     hint: "Report a bug or request feature", Icon: MessageSquare, color: "text-amber-300",   onClick: fire("beta_feedback") },
];

const MORE_ITEMS: SubItem[] = [
  { id: "cultural_hub", label: "Cultural Hub",  hint: "Country, language, units",  Icon: Globe,    color: "text-cyan-300",    onClick: fire("cultural_hub") },
  { id: "fresh_drops",  label: "Fresh Drops",   hint: "What's new on the platform", Icon: Sparkles, color: "text-fuchsia-300", onClick: fire("fresh_drops") },
  { id: "food",         label: "Hungry Vibez",  hint: "Order food without leaving game", Icon: Utensils, color: "text-orange-300",  onClick: fire("food") },
];

type SlotKey = "comms" | "tools" | "more";

const SlotMenu: React.FC<{
  items: SubItem[];
  onItemClick: () => void;
}> = ({ items, onItemClick }) => (
  <div
    role="menu"
    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 min-w-[260px] rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-2"
  >
    {items.map(({ id, label, hint, Icon, color, href, onClick }) => {
      const Tag: any = href ? "a" : "button";
      return (
        <Tag
          key={id}
          {...(href ? { href } : { type: "button" })}
          onClick={(e: any) => {
            if (onClick) {
              if (!href) e.preventDefault?.();
              onClick();
            }
            onItemClick();
          }}
          data-testid={`chrome-bar-item-${id}`}
          className="block w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition group"
        >
          <span
            className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 ${color} group-hover:bg-white/10`}
          >
            <Icon className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-white/95 leading-tight">{label}</span>
            {hint && <span className="block text-[11px] text-white/50 leading-snug mt-0.5">{hint}</span>}
          </span>
        </Tag>
      );
    })}
  </div>
);

// Top-anchored variant — menu drops DOWN instead of popping up.
const SlotMenuTop: React.FC<{
  items: SubItem[];
  onItemClick: () => void;
}> = ({ items, onItemClick }) => (
  <div
    role="menu"
    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 min-w-[260px] rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-2"
  >
    {items.map(({ id, label, hint, Icon, color, href, onClick }) => {
      const Tag: any = href ? "a" : "button";
      return (
        <Tag
          key={id}
          {...(href ? { href } : { type: "button" })}
          onClick={(e: any) => {
            if (onClick) {
              if (!href) e.preventDefault?.();
              onClick();
            }
            onItemClick();
          }}
          data-testid={`chrome-bar-item-${id}`}
          className="block w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 transition group"
        >
          <span
            className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 ${color} group-hover:bg-white/10`}
          >
            <Icon className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-white/95 leading-tight">{label}</span>
            {hint && <span className="block text-[11px] text-white/50 leading-snug mt-0.5">{hint}</span>}
          </span>
        </Tag>
      );
    })}
  </div>
);

const UnifiedChromeBar: React.FC = () => {
  const loc = useLocation();
  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);
  const [insideGame, setInsideGame] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hide when RoomMenuBar is mounted (room owns chrome inside games).
  useEffect(() => {
    const update = () => {
      setInsideGame(!!document.querySelector('[data-testid="room-menu-bar"]'));
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [loc.pathname]);

  // Mark body so legacy free-floating FABs collapse.
  useEffect(() => {
    if (insideGame) return;
    document.body.dataset.chromeBarActive = "1";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chromebar:active"));
    }
    return () => {
      delete document.body.dataset.chromeBarActive;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chromebar:inactive"));
      }
    };
  }, [insideGame]);

  // Click-outside-to-close.
  useEffect(() => {
    if (!openSlot) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenSlot(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openSlot]);

  if (HIDE_PATTERNS.some((re) => re.test(loc.pathname))) return null;
  if (insideGame) return null;

  const slots: Array<{
    key: SlotKey;
    label: string;
    Icon: React.ElementType;
    accent: string;
    items: SubItem[];
  }> = [
    { key: "comms", label: "Comms", Icon: Headphones, accent: "from-fuchsia-500 to-purple-500", items: COMMS_ITEMS },
    { key: "tools", label: "Tools", Icon: Wrench,     accent: "from-cyan-500 to-emerald-500",   items: TOOLS_ITEMS },
    { key: "more",  label: "More",  Icon: Sparkles,   accent: "from-orange-500 to-fuchsia-500", items: MORE_ITEMS  },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      data-testid="unified-chrome-bar"
      // Founder fix Feb 2026: top-center anchored, in the empty space
      // below page headers. Bottom was a battle with the platform's
      // "Made with Emergent" badge — top is reserved real-estate.
      className="fixed z-[9994] left-1/2 -translate-x-1/2 top-2 sm:top-3"
    >
      <div className="flex items-stretch gap-1 rounded-full border border-white/15 bg-slate-950/90 backdrop-blur-xl shadow-2xl shadow-black/50 p-1">
        {slots.map(({ key, label, Icon, accent, items }) => {
          const isOpen = openSlot === key;
          return (
            <div key={key} className="relative">
              <button
                type="button"
                onClick={() => setOpenSlot(isOpen ? null : key)}
                data-testid={`chrome-bar-${key}-trigger`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition ${
                  isOpen
                    ? "bg-white text-slate-900 shadow-inner"
                    : `bg-gradient-to-br ${accent} text-black hover:scale-105`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full px-1 text-[9px] font-black ${
                    isOpen ? "bg-slate-900 text-white" : "bg-black/40 text-white"
                  }`}
                >
                  {items.length}
                </span>
                <ChevronUp className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    data-testid={`chrome-bar-${key}-menu`}
                  >
                    <SlotMenuTop items={items} onItemClick={() => setOpenSlot(null)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default UnifiedChromeBar;
