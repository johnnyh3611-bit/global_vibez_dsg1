/**
 * LandingAccordion — generic collapsible section wrapper for the
 * landing page. Mimics the visual language of `ChairExpansionPlan`'s
 * "Important Information for Founders" disclosure box but accepts
 * arbitrary children + accent color, so we can collapse heavy
 * marketing/explainer sections (WelcomeLetter, TokenRoadmap,
 * LatestAdditions, MissionBriefing) behind a single click each
 * to dramatically shorten the vertical scroll.
 *
 * Defaults to closed. When a section is closed the cost is one row
 * of content (the toggle header) so the landing page becomes a
 * compact vertical menu instead of a 12-screen scroll.
 */
import { useState, ReactNode, ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

type Tone = "amber" | "fuchsia" | "cyan" | "emerald" | "violet";

const TONE_CLASSES: Record<
  Tone,
  { border: string; bg: string; iconBg: string; iconText: string; eyebrow: string; chevron: string }
> = {
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-950/10",
    iconBg: "border-amber-500/40 bg-amber-500/10",
    iconText: "text-amber-300",
    eyebrow: "text-amber-400",
    chevron: "text-amber-300",
  },
  fuchsia: {
    border: "border-fuchsia-500/30",
    bg: "bg-fuchsia-950/10",
    iconBg: "border-fuchsia-500/40 bg-fuchsia-500/10",
    iconText: "text-fuchsia-300",
    eyebrow: "text-fuchsia-400",
    chevron: "text-fuchsia-300",
  },
  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-950/10",
    iconBg: "border-cyan-500/40 bg-cyan-500/10",
    iconText: "text-cyan-300",
    eyebrow: "text-cyan-400",
    chevron: "text-cyan-300",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/10",
    iconBg: "border-emerald-500/40 bg-emerald-500/10",
    iconText: "text-emerald-300",
    eyebrow: "text-emerald-400",
    chevron: "text-emerald-300",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-950/10",
    iconBg: "border-violet-500/40 bg-violet-500/10",
    iconText: "text-violet-300",
    eyebrow: "text-violet-400",
    chevron: "text-violet-300",
  },
};

type LandingAccordionProps = {
  title: string;
  subtitle?: string;
  Icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  defaultOpen?: boolean;
  testId: string;
  children: ReactNode;
};

export default function LandingAccordion({
  title,
  subtitle,
  Icon,
  tone = "fuchsia",
  defaultOpen = false,
  testId,
  children,
}: LandingAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const c = TONE_CLASSES[tone];

  return (
    <section
      className="bg-black py-6 px-6 border-t border-neutral-900"
      data-testid={`${testId}-section`}
    >
      <div className="max-w-4xl mx-auto">
        <div
          className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden`}
          data-testid={`${testId}-box`}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            data-testid={`${testId}-toggle`}
            className={`w-full flex items-center justify-between gap-4 p-5 text-left hover:brightness-125 transition`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border ${c.iconBg} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-5 h-5 ${c.iconText}`} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-mono uppercase tracking-[0.3em] ${c.eyebrow}`}
                >
                  {open ? "Click to collapse" : "Click to expand"}
                </p>
                <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter mt-0.5 truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-1">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {open ? (
              <ChevronUp className={`w-6 h-6 ${c.chevron} flex-shrink-0`} />
            ) : (
              <ChevronDown className={`w-6 h-6 ${c.chevron} flex-shrink-0`} />
            )}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`border-t ${c.border}`}
                data-testid={`${testId}-content`}
              >
                <div className="overflow-hidden">{children}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
