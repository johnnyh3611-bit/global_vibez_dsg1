/**
 * Hub Switcher — lets workers / members jump between role dashboards
 * without hunting through Explore.
 */
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, ChevronDown } from "lucide-react";
import {
  HUBS,
  getPreferredHubId,
  setPreferredHub,
  type HubId,
} from "@/hubs/hubRegistry";
import { VibezCloseControl } from "@/components/ui/VibezCloseControl";

export default function HubSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => {
    const hit = HUBS.find(
      (h) =>
        pathname === h.dashboardPath ||
        pathname.startsWith(`${h.dashboardPath}/`) ||
        (h.id !== "vibe" && pathname.startsWith(`/hub/${h.id}`)),
    );
    return hit || HUBS.find((h) => h.id === getPreferredHubId()) || HUBS[0];
  }, [pathname]);

  const pick = (id: HubId) => {
    const hub = HUBS.find((h) => h.id === id);
    if (!hub) return;
    setPreferredHub(id);
    setOpen(false);
    navigate(hub.dashboardPath);
  };

  return (
    <div className="relative" data-testid="hub-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="hub-switcher-toggle"
        className={`inline-flex items-center gap-1.5 rounded-full border bg-black/40 px-3 py-1.5 text-xs font-semibold ${active.accent}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="max-w-[9rem] truncate">{active.short}</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
            aria-label="Close hub menu"
            onClick={() => setOpen(false)}
            data-testid="hub-switcher-backdrop"
          />
          <ul
            role="listbox"
            data-testid="hub-switcher-menu"
            className="absolute left-0 top-full z-50 mt-2 w-64 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0b12]/95 p-2 shadow-2xl backdrop-blur-xl"
          >
            <li className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/40">
                Switch dashboard
              </span>
              <VibezCloseControl
                onClick={() => setOpen(false)}
                label="Close"
                testId="hub-switcher-close"
              />
            </li>
            {HUBS.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={h.id === active.id}
                  data-testid={`hub-switcher-${h.id}`}
                  onClick={() => pick(h.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 ${
                    h.id === active.id ? "bg-white/10" : ""
                  }`}
                >
                  <div className={`text-sm font-bold ${h.accent.split(" ")[0]}`}>{h.label}</div>
                  <div className="text-[11px] text-white/50 leading-snug">{h.blurb}</div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
