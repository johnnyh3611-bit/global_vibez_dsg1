/**
 * MenuBar — canonical wrap-safe top nav per MASTER_RULEBOOK §2.3.
 * Uses flex-wrap so items never clip on narrow screens.
 */
import { Link } from "react-router-dom";

export const MenuBar = ({
  brand = "GLOBAL VIBEZ",
  items = [
    { label: "Dating Hub", to: "/discover" },
    { label: "Streaming", to: "/live-streaming" },
    { label: "Cyber-Casino", to: "/cyber-casino" },
    { label: "My Vibez", to: "/dashboard" },
    { label: "Marketplace", to: "/pricing" },
  ],
  ctaLabel = "Connect SOL",
  onCtaClick,
}: {
  brand?: string;
  items?: { label: string; to: string }[];
  ctaLabel?: string;
  onCtaClick?: () => void;
}) => {
  return (
    <nav
      data-testid="vibez-menu-bar"
      className="w-full bg-black/60 border-b border-white/10 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/"
          data-testid="vibez-menu-brand"
          className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent"
        >
          {brand}
        </Link>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-gray-300">
          {items.map((it) => (
            <li key={it.to} className="hover:text-cyan-400 transition-colors">
              <Link to={it.to} data-testid={`menu-${it.label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <button
            data-testid="vibez-menu-cta"
            onClick={onCtaClick}
            className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 text-xs hover:bg-cyan-500 hover:text-black transition-all"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </nav>
  );
};
