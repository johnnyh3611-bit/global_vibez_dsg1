/**
 * PageActionStrip — INLINE chrome menu (founder directive 2026-02-09).
 *
 *   "Place it under the Live Wins. Don't stick. Scroll with the page.
 *   Three little dots they click that tells you where everything is."
 *
 * Contract
 *   • Renders as a NORMAL block element — flows with document, scrolls
 *     with the page, NEVER `position: fixed`.
 *   • Each page that wants it imports + drops it in the chosen spot.
 *   • Compact 3-dot trigger ("⋯ Quick Access") opens a single panel
 *     listing Comms / Tools / More with full labels and descriptions.
 *   • Sets `document.body.dataset.pageActionStripActive = "1"` while
 *     mounted so the leftover floating FABs (CornerDock, CommHub free
 *     pill, beta-feedback bug, etc.) stay hidden — same legacy
 *     suppression contract.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal, MessageSquare, Mic, RotateCcw, Globe, Utensils, Sparkles,
  Headphones, X, ZapOff,
} from "lucide-react";

const fire = (id: string) => () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`cdock:open:${id}`));
  }
};

/**
 * Toggle the "Reduce Motion / No Flash" body flag — the global CSS
 * killswitch in vibez-pro.css picks this up to freeze every continuous
 * animation. Persists across reloads via localStorage so users never
 * have to re-enable it. Founder accessibility directive 2026-05-09.
 */
const NO_FLASH_KEY = "gv_no_flash_v1";
const isNoFlashActive = () => typeof window !== "undefined" && localStorage.getItem(NO_FLASH_KEY) === "1";
const applyNoFlash = (enabled: boolean) => {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.body.dataset.noFlash = "1";
    localStorage.setItem(NO_FLASH_KEY, "1");
  } else {
    delete document.body.dataset.noFlash;
    localStorage.removeItem(NO_FLASH_KEY);
  }
};
// Apply on initial module load so the flag is set BEFORE any
// animation-bearing component mounts.
if (typeof document !== "undefined") applyNoFlash(isNoFlashActive());
const toggleNoFlash = () => applyNoFlash(!isNoFlashActive());

interface SubItem {
  id: string;
  label: string;
  hint: string;
  Icon: React.ElementType;
  color: string;
  href?: string;
  onClick?: () => void;
}

const SECTIONS: { title: string; items: SubItem[] }[] = [
  {
    title: "Comms",
    items: [
      { id: "voice_mirror_alt", label: "Voice Mirror",   hint: "Real-time speech translation", Icon: Mic,           color: "text-cyan-300",    onClick: fire("voice_mirror") },
      { id: "comm_mute_all",    label: "Mute All",       hint: "Toggle voice + chat mute",     Icon: Headphones,    color: "text-rose-300",    onClick: () => window.dispatchEvent(new CustomEvent("commhub:mute-all", { detail: { muted: true } })) },
      { id: "comm_open_inbox",  label: "Inbox",          hint: "Friend messages",              Icon: MessageSquare, color: "text-fuchsia-300", href: "/inbox" },
    ],
  },
  {
    title: "Tools",
    items: [
      { id: "voice_mirror",  label: "Voice Mirror",      hint: "Hold to speak in any language",  Icon: Mic,           color: "text-cyan-300",    onClick: fire("voice_mirror") },
      { id: "orientation",   label: "Auto-Rotate Lock",  hint: "Pin landscape or portrait",      Icon: RotateCcw,     color: "text-emerald-300", onClick: fire("orientation") },
      { id: "beta_feedback", label: "Beta Feedback",     hint: "Report a bug / request feature", Icon: MessageSquare, color: "text-amber-300",   onClick: fire("beta_feedback") },
      { id: "no_flash",      label: "Reduce Motion",     hint: "Stop pulsing / flashing UI",     Icon: ZapOff,        color: "text-emerald-300", onClick: toggleNoFlash },
    ],
  },
  {
    title: "More",
    items: [
      { id: "cultural_hub", label: "Cultural Hub", hint: "Country, language, units",     Icon: Globe,    color: "text-cyan-300",    onClick: fire("cultural_hub") },
      { id: "fresh_drops",  label: "Fresh Drops",  hint: "What's new on the platform",   Icon: Sparkles, color: "text-fuchsia-300", onClick: fire("fresh_drops") },
      { id: "food",         label: "Hungry Vibez", hint: "Order food without leaving",   Icon: Utensils, color: "text-orange-300",  onClick: fire("food") },
    ],
  },
];

interface Props {
  /** Optional alignment — `start` (default), `center`, or `end`. */
  align?: "start" | "center" | "end";
  className?: string;
}

const PageActionStrip: React.FC<Props> = ({ align = "end", className = "" }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.dataset.pageActionStripActive = "1";
    document.body.dataset.chromeBarActive = "1";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chromebar:active"));
    }
    return () => {
      delete document.body.dataset.pageActionStripActive;
      delete document.body.dataset.chromeBarActive;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chromebar:inactive"));
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const alignClass =
    align === "center" ? "justify-center" : align === "start" ? "justify-start" : "justify-end";

  return (
    <div
      ref={wrapRef}
      className={`relative w-full flex ${alignClass} ${className}`}
      data-testid="page-action-strip"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="page-action-strip-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Quick Access — Comms · Tools · More"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-widest transition ${
          open
            ? "bg-white text-slate-900 border-white shadow-inner"
            : "bg-slate-950/70 text-white/80 hover:text-white border-white/15 hover:border-white/30 backdrop-blur"
        }`}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span>Quick Access</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            data-testid="page-action-strip-menu"
            className={`absolute top-full mt-2 w-[300px] sm:w-[340px] rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-2 z-50 ${
              align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/10">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">
                Quick Access
              </span>
              <button
                onClick={() => setOpen(false)}
                data-testid="page-action-strip-close"
                aria-label="Close menu"
                className="text-white/60 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {SECTIONS.map(({ title, items }, sIdx) => (
              <div key={title} className={sIdx > 0 ? "mt-2 pt-2 border-t border-white/8" : ""}>
                <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 font-bold mb-1">
                  {title}
                </p>
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
                        setOpen(false);
                      }}
                      data-testid={`page-action-strip-item-${id}`}
                      className="block w-full text-left flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-white/8 transition group"
                    >
                      <span
                        className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 ${color} group-hover:bg-white/10`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-white/95 leading-tight">
                          {label}
                        </span>
                        <span className="block text-[11px] text-white/50 leading-snug mt-0.5">
                          {hint}
                        </span>
                      </span>
                    </Tag>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PageActionStrip;
