/**
 * NotFound — branded 404 page that replaces the silent
 * `<Route path="*" element={<Navigate to="/" />}>` fallback.
 *
 * The wildcard fallback was hiding broken routes from us — every dead
 * link silently bounced to the landing instead of telling the user
 * "this URL doesn't exist". This page surfaces the failure honestly
 * AND gives every type of visitor a useful next step.
 *
 * Founder fix Feb 2026 (post-card-room sweep): explicit 404 contract.
 */
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Compass, Home, Gamepad2, ArrowLeft } from "lucide-react";
import PageActionStrip from "@/components/common/PageActionStrip";

const SUGGESTIONS: Array<{ to: string; label: string; hint: string }> = [
  { to: "/dashboard", label: "Dashboard",  hint: "Your home base" },
  { to: "/games",     label: "Games",      hint: "34+ rooms · cards · casino" },
  { to: "/chair-hall",label: "Chair Hall", hint: "Sovereign Vault · 3D table" },
  { to: "/beta-tester",label: "Join Beta", hint: "Lock in your founder seat" },
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div
      className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,_#1a0033_0%,_#0a0014_60%,_#000_100%)] text-white flex flex-col px-4 py-6"
      data-testid="not-found-page"
    >
      <div className="w-full max-w-7xl mx-auto">
        <PageActionStrip align="end" />
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-400/30 mb-6">
          <Compass className="w-10 h-10 text-fuchsia-300" />
        </div>

        <h1 className="text-6xl sm:text-7xl font-black bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          404
        </h1>
        <h2 className="text-lg md:text-xl text-white/90 font-bold mb-2">
          This room is off the map.
        </h2>
        <p className="text-sm text-white/60 mb-1">
          We couldn&apos;t find <code className="px-1.5 py-0.5 rounded bg-white/10 text-fuchsia-300 font-mono">
            {location.pathname || "/"}
          </code>
        </p>
        <p className="text-xs text-white/40 mb-8">
          The link may be from an older build, or this URL was tombstoned.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-8">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              data-testid={`not-found-link-${s.to.replace(/\//g, "-").slice(1)}`}
              className="group flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 transition text-left"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/20 flex items-center justify-center">
                <Gamepad2 className="w-4 h-4 text-fuchsia-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white/95">{s.label}</div>
                <div className="text-[11px] text-white/50">{s.hint}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            data-testid="not-found-back-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/15 hover:bg-white/10 text-sm font-bold text-white/90 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <Link
            to="/"
            data-testid="not-found-home-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400 text-sm font-black text-white shadow-[0_0_24px_-6px_rgba(217,70,239,0.6)] transition"
          >
            <Home className="w-4 h-4" /> Take me home
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
