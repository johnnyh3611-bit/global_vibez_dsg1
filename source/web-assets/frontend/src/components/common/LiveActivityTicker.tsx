/**
 * LiveActivityTicker — thin scrolling band of recent platform events.
 *
 * Mounted at the bottom of the Volumetric Galaxy. Polls
 * /api/live-activity/recent every 12s. Renders the events as a single
 * marquee row that scrolls right-to-left (CSS keyframes — no JS RAF
 * cost). When no events are available we render a placeholder strand
 * so the strip never collapses on first load.
 *
 * 2026-05-12 founder ask: "Vegas floor energy" — see who's playing now
 * without taking screen real estate.
 */
import { useEffect, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 12_000;

type Event = { ts: string; emoji: string; text: string };

const FALLBACK_EVENTS: Event[] = [
  { ts: "", emoji: "👑", text: "Sovereign tier holders get 1.75× bridge bonus" },
  { ts: "", emoji: "🎲", text: "Vibez 654 tables are open — ₵10 to ₵1,000 stakes" },
  { ts: "", emoji: "🪑", text: "Genius Chair · $20 one-time · all Sovereign perks for life" },
  { ts: "", emoji: "🏆", text: "Sports Lounge — crowd-judged settlement, no bookmaker tricks" },
];

export default function LiveActivityTicker() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        const r = await fetch(`${API}/api/live-activity/recent?limit=12`);
        const d = await r.json();
        if (!cancelled && Array.isArray(d?.events) && d.events.length > 0) {
          setEvents(d.events);
        }
      } catch { /* network — keep last good */ }
    };
    fetchEvents();
    const id = setInterval(fetchEvents, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const items = events.length > 0 ? events : FALLBACK_EVENTS;
  // Duplicate the list so the marquee is seamless on loop.
  const rendered = [...items, ...items];

  return (
    <div
      data-testid="live-activity-ticker"
      className="fixed bottom-0 left-0 right-0 z-[45] pointer-events-none"
    >
      <div
        className="overflow-hidden border-t border-fuchsia-500/30 bg-gradient-to-r from-black/90 via-fuchsia-950/40 to-black/90 backdrop-blur-md"
        style={{ height: "32px" }}
      >
        <div
          className="flex items-center whitespace-nowrap will-change-transform"
          style={{
            animation: "gv-ticker-scroll 90s linear infinite",
          }}
        >
          {rendered.map((e, i) => (
            <span
              key={`${i}-${e.ts}-${e.text}`}
              className="inline-flex items-center gap-2 px-6 text-[11px] text-white/85"
            >
              <span className="text-base leading-none">{e.emoji}</span>
              <span className="tracking-wide">{e.text}</span>
              <span className="text-fuchsia-400/60 mx-2">▸</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes gv-ticker-scroll {
          from { transform: translateX(0%); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
