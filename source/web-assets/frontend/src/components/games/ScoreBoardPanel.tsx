/**
 * ScoreBoardPanel — Phase 2 collapsible right-rail score panel for the
 * 4-player partnership rooms (Spades / Bid Whist / Hearts).
 *
 * Founder ask (2026-02-16): "Score panel — collapsible right rail desktop /
 * swipe-up tray mobile."
 *
 * Behaviour:
 *  - Desktop (≥md): right-anchored sidebar, collapse button hides it.
 *  - Mobile: bottom-anchored swipe-up tray with handle, expands to full-height.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TeamRow {
  /** "us" / "them" / etc. */
  id: string;
  /** Display name e.g. "Aaron + You" */
  label: string;
  /** Brand color for this row (gold for your team, grey for opponents). */
  color?: string;
  /** Cumulative game score */
  score: number;
  /** Bid for the current hand (Spades/Bid Whist) — optional. */
  bid?: number;
  /** Tricks taken this hand — optional. */
  tricks?: number;
  /** Bags / penalties (Spades) — optional. */
  bags?: number;
}

interface ScoreBoardPanelProps {
  rows: TeamRow[];
  /** Optional title (default "Scoreboard"). */
  title?: string;
  /** Default-open state. Defaults to `false` (collapsed) on mobile. */
  defaultOpen?: boolean;
}

export function ScoreBoardPanel({
  rows, title = 'Scoreboard', defaultOpen,
}: ScoreBoardPanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState<boolean>(defaultOpen ?? false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(mq.matches);
      if (defaultOpen === undefined) setOpen(!mq.matches); // open on desktop by default
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [defaultOpen]);

  /* ── Mobile: swipe-up tray ────────────────────────────────────────── */
  if (isMobile) {
    return (
      <>
        <button
          data-testid="scoreboard-handle"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-30 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-lg"
        >
          {title} · {rows.map(r => r.score).join(' / ')}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              data-testid="scoreboard-tray"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] bg-[#0A0A0F] border-t-2 border-[#D4AF37]/30 rounded-t-2xl px-5 pt-3 pb-6"
            >
              <button
                onClick={() => setOpen(false)}
                data-testid="scoreboard-close"
                className="absolute top-3 right-3 p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mx-auto w-12 h-1 bg-white/20 rounded-full mb-3" />
              <h3 className="text-lg font-black mb-3">{title}</h3>
              <ScoreBody rows={rows} />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  /* ── Desktop: right rail ──────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="open"
          data-testid="scoreboard-rail"
          initial={{ x: 280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 280, opacity: 0 }}
          className="fixed top-24 right-4 z-30 w-64 bg-[#0A0A0F]/95 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
            <button
              onClick={() => setOpen(false)}
              data-testid="scoreboard-collapse"
              className="text-white/50 hover:text-white p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <ScoreBody rows={rows} />
        </motion.aside>
      ) : (
        <motion.button
          key="closed"
          data-testid="scoreboard-rail-tab"
          initial={{ x: 50 }}
          animate={{ x: 0 }}
          exit={{ x: 50 }}
          onClick={() => setOpen(true)}
          className="fixed top-1/2 right-0 z-30 -translate-y-1/2 px-2 py-3 bg-[#0A0A0F]/95 backdrop-blur-md border border-white/10 rounded-l-xl text-white/60 hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ── shared body ─── */
function ScoreBody({ rows }: { rows: TeamRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.id}
          data-testid={`scoreboard-row-${r.id}`}
          className="rounded-lg border border-white/10 bg-black/40 p-3"
          style={{ borderLeftColor: r.color || '#FFFFFF20', borderLeftWidth: 3 }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white/80">{r.label}</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: r.color || '#fff' }}>
              {r.score}
            </span>
          </div>
          {(r.bid !== undefined || r.tricks !== undefined || r.bags !== undefined) && (
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/50">
              {r.bid !== undefined && <span>Bid <strong className="text-white/80 tabular-nums">{r.bid}</strong></span>}
              {r.tricks !== undefined && <span>Trick <strong className="text-white/80 tabular-nums">{r.tricks}</strong></span>}
              {r.bags !== undefined && <span>Bag <strong className="text-white/80 tabular-nums">{r.bags}</strong></span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ScoreBoardPanel;
