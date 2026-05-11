/**
 * LandingHeaderEnhanced — Roadmap PDF (LandingPage_Enhancement.pdf §1+§2).
 *
 * AAA-game-style landing nav. Founder override (2026-02-09):
 *   "I don't want the top part to stick as you scroll. I want it to
 *    move with the page."
 * So we keep §2 (eye-candy / neon glow / parallax icons / room-hover
 * tint) and §3 (accordion targets) intact, but DROP §1's `position:
 * fixed; top: 0` requirement — the header now scrolls away with the
 * rest of the page like a normal block.
 *
 * Brand block, language switcher, Phantom Connect, Sign-In, Join-Now
 * CTAs all preserved.
 */
import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Spade, Coins, Sparkles } from "lucide-react";
import LandingLanguageSwitcher from "@/components/LandingLanguageSwitcher";
import PhantomConnectButton from "@/components/web3/PhantomConnectButton"; // eslint-disable-line @typescript-eslint/no-unused-vars

export type RoomKey =
  | "game_logic"
  | "tokenomics"
  | "lifestyle"
  | null;

interface NavItem {
  key: Exclude<RoomKey, null>;
  label: string;
  href: string;          // anchor target id on the same page
  Icon: React.ElementType;
  glow: string;          // rgb glow used for the per-room hover tint
}

const NAV_ITEMS: NavItem[] = [
  { key: "game_logic", label: "Game Logic",   href: "#feature-game-logic", Icon: Spade,    glow: "34, 211, 238"   /* cyan   */ },
  { key: "tokenomics", label: "Tokenomics",   href: "#feature-tokenomics", Icon: Coins,    glow: "251, 191, 36"   /* amber  */ },
  { key: "lifestyle",  label: "Lifestyle Hub", href: "#feature-lifestyle", Icon: Sparkles, glow: "232, 121, 249"  /* fuchsia*/ },
];

const NEON_GLOW = "0 0 10px #d946ef, 0 0 22px rgba(217, 70, 239, 0.55)";

interface Props {
  /** Notified when a nav link is hovered so the page background can
   *  shift its tint to reflect the room (PDF §2 Room Transitions). */
  onRoomHover?: (room: RoomKey) => void;
}

const ParallaxIcon: React.FC<{ Icon: React.ElementType; color: string }> = ({ Icon, color }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    el.style.transform = `perspective(220px) rotateY(${dx * 18}deg) rotateX(${-dy * 18}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "perspective(220px) rotateY(0deg) rotateX(0deg)";
  };
  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{
        display: "inline-flex",
        transition: "transform 120ms ease-out",
        filter: `drop-shadow(0 0 6px rgba(${color}, 0.65))`,
      }}
    >
      <Icon className="w-4 h-4" />
    </span>
  );
};

const LandingHeaderEnhanced: React.FC<Props> = ({ onRoomHover }) => {
  const navigate = useNavigate();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace(/^#/, "");
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="landing-header-enhanced"
      style={{
        // Founder override: NO STICK. Header scrolls with the page.
        position: "relative",
        zIndex: 50,
        background: "rgba(13, 17, 23, 0.95)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(217, 70, 239, 0.2)",
      }}
      className="px-6 py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand block */}
        <div
          className="flex items-center gap-3 cursor-pointer shrink-0"
          onClick={() => navigate("/vibe-vault-admin")}
          data-testid="landing-logo"
        >
          <img
            src="/global-vibez-logo.png?v=10"
            alt="Global Vibez DSG Logo"
            className="h-12 w-auto object-contain drop-shadow-[0_0_22px_rgba(217,70,239,0.45)]"
          />
          <div className="hidden sm:block">
            <h1
              className="text-xl font-black"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/");
              }}
            >
              <span className="text-white">GLOBAL VIBEZ</span>{" "}
              <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                DSG
              </span>
            </h1>
            <p className="text-[10px] text-purple-400 font-mono uppercase tracking-wider">
              Gaming · Dating · Rides · Food · Venues
            </p>
          </div>
        </div>

        {/* Center nav — PDF §3 entries with neon-fuchsia glow + parallax icons */}
        <nav
          className="hidden lg:flex items-center gap-2 mx-4"
          data-testid="landing-nav-progressive"
          onMouseLeave={() => onRoomHover?.(null)}
        >
          {NAV_ITEMS.map(({ key, label, href, Icon, glow }) => (
            <a
              key={key}
              href={href}
              onClick={(e) => handleNavClick(e, href)}
              onMouseEnter={() => onRoomHover?.(key)}
              data-testid={`landing-nav-${key}`}
              className="group inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold uppercase tracking-wider text-white/85 hover:text-white transition"
              style={{ textShadow: NEON_GLOW }}
            >
              <ParallaxIcon Icon={Icon} color={glow} />
              <span
                className="transition-all"
                style={{
                  animation: "vibezNeonPulse 2.4s ease-in-out infinite",
                }}
              >
                {label}
              </span>
            </a>
          ))}
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LandingLanguageSwitcher />

          {/* 2026-05-12: Phantom wallet button moved from landing header
              to /wallet (Connect Wallet flow happens AFTER login). */}

          <button
            onClick={() => navigate("/login")}
            data-testid="landing-signin-btn"
            className="hidden md:inline-flex px-4 py-2 text-purple-300 font-bold hover:text-fuchsia-400 transition-colors border border-purple-500/30 rounded-lg hover:border-fuchsia-500"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/signup")}
            data-testid="landing-signup-btn"
            className="px-5 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold rounded-lg hover:scale-105 transition-transform shadow-lg shadow-fuchsia-500/50"
          >
            Join Now
          </button>
        </div>
      </div>

      {/* Inlined keyframes — keeps the neon pulse self-contained without
          editing the global stylesheet. */}
      <style>{`
        @keyframes vibezNeonPulse {
          0%, 100% { text-shadow: 0 0 8px #d946ef, 0 0 16px rgba(217,70,239,0.4); }
          50%      { text-shadow: 0 0 14px #d946ef, 0 0 28px rgba(217,70,239,0.7); }
        }
      `}</style>
    </motion.header>
  );
};

export default LandingHeaderEnhanced;
