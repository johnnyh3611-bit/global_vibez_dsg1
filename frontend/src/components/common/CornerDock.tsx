/**
 * CornerDock — Unified bottom-corner menu (Vigilant Agent v2 fix).
 *
 * Founder reported (Vigilant Agent PDF v2, 2026-02-09 / "we've been
 * trying to fix this for two days"):
 *   • Bottom-left has 3 FABs (Voice Mirror / Orientation / Beta
 *     Feedback) all positioned at the SAME corner — clicking is a
 *     z-index lottery.
 *   • Bottom-right has 2 FABs (Fresh Drops / Hungry Vibez Food) +
 *     the platform's "Made with Emergent" badge — same problem.
 *
 * Founder's options ("pop down, pop out, pop up — but out the way
 * and clicked, everybody could see what they're getting into"):
 *   ➜ One trigger per corner.
 *   ➜ Click → labeled vertical menu pops UP showing every action.
 *   ➜ Each item is icon + clear name so the user knows what they're
 *     about to press.
 *
 * Implementation contract
 * ───────────────────────
 * The 5 existing FAB components KEEP their modals/panels — only
 * their trigger buttons are suppressed (each accepts `forceHidden`).
 * To open one of them programmatically, CornerDock dispatches a
 * window event — `cdock:open:${id}` — which the underlying
 * component listens for. Lightweight, stateless contract; no
 * refactor of internal modal logic required.
 */
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Wrench, ChevronUp, MessageSquare, Mic, RotateCcw, Sparkles, Utensils, Globe, X,
} from "lucide-react";
import CornerDockTooltip from "./CornerDockTooltip";

const HIDE_PATTERNS: RegExp[] = [
  /^\/streamer\/overlay/,   // OBS scene capture must stay clean.
  /^\/login/, /^\/signup/, /^\/auth/,
  // Landing route NOT hidden anymore (2026-02-09 founder polish):
  // CornerDock activates on `/` too so anonymous visitors can reach
  // Cultural Hub / Fresh Drops, and GlobeFAB stops colliding with
  // the platform-injected "Made with Emergent" badge.
];

interface DockItem {
  id: string;
  label: string;
  Icon: React.ElementType;
  badgeColor: string;       // Tailwind text-XXX class for the icon glow.
  onClick: () => void;
}

const fire = (id: string) => () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`cdock:open:${id}`));
  }
};

const LEFT_ITEMS: DockItem[] = [
  { id: "voice_mirror",   label: "Voice Mirror",     Icon: Mic,           badgeColor: "text-cyan-300",    onClick: fire("voice_mirror") },
  { id: "orientation",    label: "Auto-Rotate Lock", Icon: RotateCcw,     badgeColor: "text-emerald-300", onClick: fire("orientation") },
  { id: "beta_feedback",  label: "Beta Feedback",    Icon: MessageSquare, badgeColor: "text-amber-300",   onClick: fire("beta_feedback") },
];

const RIGHT_ITEMS: DockItem[] = [
  { id: "cultural_hub",   label: "Cultural Hub",     Icon: Globe,    badgeColor: "text-cyan-300",    onClick: fire("cultural_hub") },
  { id: "fresh_drops",    label: "Fresh Drops",      Icon: Sparkles,      badgeColor: "text-fuchsia-300", onClick: fire("fresh_drops") },
  { id: "food",           label: "Hungry Vibez",     Icon: Utensils,      badgeColor: "text-orange-300",  onClick: fire("food") },
];

const DockSide: React.FC<{
  side: "left" | "right";
  items: DockItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
}> = ({ side, items, open, setOpen }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside-to-close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, setOpen]);

  const positionClass =
    side === "left"
      ? "fixed bottom-4 left-4 z-[9995]"
      // Right side: on mobile the Emergent badge takes the bottom-
      // right corner, so we sit ABOVE it. On ≥sm, badge moves to
      // the side and we have room next to it.
      : "fixed bottom-20 right-4 sm:bottom-4 sm:right-[230px] z-[9995]";

  return (
    <div
      ref={ref}
      className={positionClass}
      data-testid={`corner-dock-${side}`}
      data-corner-dock-side={side}
    >
      {/* Pop-out labeled menu. Renders ABOVE the trigger. */}
      {open && (
        <div
          data-testid={`corner-dock-${side}-menu`}
          className="absolute bottom-full mb-2 left-0 min-w-[210px] rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/10">
            <span className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-bold">
              Tools
            </span>
            <button
              onClick={() => setOpen(false)}
              data-testid={`corner-dock-${side}-close`}
              className="text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {items.map(({ id, label, Icon, badgeColor, onClick }) => (
            <button
              key={id}
              onClick={() => {
                onClick();
                setOpen(false);
              }}
              data-testid={`corner-dock-item-${id}`}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 text-left transition group"
            >
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 ${badgeColor} group-hover:bg-white/10`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-bold text-white/90">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid={`corner-dock-${side}-trigger`}
        aria-expanded={open}
        aria-label={`${side === "left" ? "Tools" : "More"} menu (${items.length} items)`}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition shadow-lg ${
          open
            ? "bg-white text-slate-900 shadow-white/30"
            : side === "left"
              ? "bg-gradient-to-br from-cyan-500/90 to-emerald-500/90 text-black shadow-cyan-500/30 hover:scale-105"
              : "bg-gradient-to-br from-fuchsia-500/90 to-orange-500/90 text-black shadow-fuchsia-500/30 hover:scale-105"
        }`}
      >
        <Wrench className="w-3.5 h-3.5" />
        <span>{side === "left" ? "Tools" : "More"}</span>
        <span
          className={`inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5 text-[10px] font-black ${
            open ? "bg-slate-900 text-white" : "bg-black/40 text-white"
          }`}
        >
          {items.length}
        </span>
        <ChevronUp
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
};

const CornerDock: React.FC = () => {
  const loc = useLocation();
  const [openLeft, setOpenLeft] = useState(false);
  const [openRight, setOpenRight] = useState(false);

  // Mark body so the underlying FABs can hide their own trigger
  // buttons via document.body.dataset (no React-tree coupling).
  // Also fire window events so FABs that mounted BEFORE this dock
  // (race condition) get a synchronous signal to hide.
  useEffect(() => {
    document.body.dataset.cornerDockActive = "1";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cdock:active"));
    }
    return () => {
      delete document.body.dataset.cornerDockActive;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cdock:inactive"));
      }
    };
  }, []);

  if (HIDE_PATTERNS.some((re) => re.test(loc.pathname))) return null;

  return (
    <>
      <DockSide side="left"  items={LEFT_ITEMS}  open={openLeft}  setOpen={setOpenLeft}  />
      <DockSide side="right" items={RIGHT_ITEMS} open={openRight} setOpen={setOpenRight} />
      <CornerDockTooltip />
    </>
  );
};

export default CornerDock;
