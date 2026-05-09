/**
 * LandingFeatureAccordions — Roadmap PDF (LandingPage_Enhancement.pdf §3
 * "Progressive Information Compression").
 *
 * Three expandable cards corresponding 1:1 with the spec table:
 *   1. Game Logic     → high-quality Spades/Dice icons, dropdown
 *                       "Rules & Mechanics".
 *   2. Tokenomics     → animated $VIBEZ coin asset, click-to-expand
 *                       full breakdown (live constants from
 *                       /api/vibez-rewards/constants + burn counter).
 *   3. Lifestyle Hub  → VibeRidez / Hungry Vibez 3D-feel models,
 *                       accordion service details.
 *
 * Copy is drafted from existing app data (no fabrication):
 *   • Game Logic       — the 29 live rooms + AAA card games surface
 *   • Tokenomics       — vibez_rewards constants + 3 B locked supply
 *   • Lifestyle Hub    — VibeRidez / HungryVibes / Vibe Venues / YP
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Spade, Dice5, Coins, Flame, Car, Pizza, Home, MapPin, ChevronDown,
} from "lucide-react";
import VibezCoin3D from "./VibezCoin3D";

const API = process.env.REACT_APP_BACKEND_URL;

interface FeatureCardProps {
  id: string;
  title: string;
  visualLabel: string;
  testId: string;
  visual: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** A single accordion card with a 3D-feel parallax-tilt visual cell. */
const FeatureCard: React.FC<FeatureCardProps> = ({
  id, title, visualLabel, testId, visual, open, onToggle, children,
}) => {
  const tiltRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg)`;
  };
  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
  };

  return (
    <div
      id={id}
      data-testid={testId}
      className="rounded-3xl border border-fuchsia-500/30 bg-black/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_42px_rgba(217,70,239,0.15)]"
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-6 items-center">
        {/* Visual cell — pseudo-3D tilt on mousemove */}
        <div
          ref={tiltRef}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ transition: "transform 160ms ease-out" }}
          className="flex items-center justify-center h-32 md:h-36 rounded-2xl bg-gradient-to-br from-purple-950/60 to-black border border-purple-500/20"
        >
          {visual}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-300 font-mono mb-1">
            {visualLabel}
          </p>
          <h3
            className="text-2xl sm:text-3xl font-black text-white"
            style={{ textShadow: "0 0 10px #d946ef" }}
          >
            {title}
          </h3>
        </div>

        <button
          type="button"
          onClick={onToggle}
          data-testid={`${testId}-toggle`}
          aria-expanded={open}
          className="self-start md:self-center inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-fuchsia-500/15 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 font-bold transition"
        >
          {open ? "Hide" : "Show"} details
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-fuchsia-500/20 text-slate-200">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Live data hooks — lightweight, fail-safe.
// ─────────────────────────────────────────────────────────────────

interface VibezConstants {
  formula: string;
  B_base_per_minute: number;
  power_hour_multiplier: number;
  T_bonus: Record<string, number>;
  eligible_games: string[];
  mint_mode: string;
}

const useVibezConstants = (): VibezConstants | null => {
  const [data, setData] = useState<VibezConstants | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/vibez-rewards/constants`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => mounted && setData(d))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  return data;
};

interface BurnStats {
  burned: number;
  burned_24h: number;
  total_supply: number;
  circulating: number;
}

const useBurnStats = (): BurnStats | null => {
  const [data, setData] = useState<BurnStats | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/coins/stats/burn`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!mounted || !d) return;
        setData({
          burned:        d.lifetime_burned ?? d.burned ?? 0,
          burned_24h:    d.burned_24h      ?? d.last_24h ?? 0,
          total_supply:  d.total_supply    ?? 3_000_000_000,
          circulating:   d.circulating     ?? 0,
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  return data;
};

const fmt = (n: number) =>
  n >= 1_000_000_000 ? `${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000     ? `${(n / 1_000).toFixed(2)}K`
    : `${n.toFixed(0)}`;

// ─────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────

const LandingFeatureAccordions: React.FC = () => {
  const [open, setOpen] = useState<Record<string, boolean>>({
    game_logic: false,
    tokenomics: false,
    lifestyle: false,
  });
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const constants = useVibezConstants();
  const burn = useBurnStats();

  return (
    <section
      data-testid="landing-feature-accordions"
      className="relative z-10 px-4 sm:px-6 py-16 max-w-5xl mx-auto space-y-6"
    >
      <div className="text-center mb-8">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.5em] text-fuchsia-300 font-mono mb-2">
          Progressive Information Compression
        </p>
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-black text-white"
          style={{ textShadow: "0 0 14px #d946ef" }}
        >
          Click into what matters.
        </h2>
      </div>

      {/* 1. Game Logic */}
      <FeatureCard
        id="feature-game-logic"
        testId="feature-card-game-logic"
        title="Game Logic"
        visualLabel="High-quality icons · Spades + Dice"
        visual={
          <div className="flex items-center gap-4">
            <Spade className="w-12 h-12 text-fuchsia-300 drop-shadow-[0_0_18px_rgba(217,70,239,0.6)]" />
            <Dice5 className="w-12 h-12 text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.6)]" />
          </div>
        }
        open={open.game_logic}
        onToggle={() => toggle("game_logic")}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-fuchsia-300 mb-2">
              Rules & Mechanics
            </p>
            <ul className="space-y-2 text-slate-200">
              <li>• <b>29 live rooms</b> across cards, dice, dating, and party formats.</li>
              <li>• <b>AAA card stack</b> — Blackjack, Poker, Spades, Hearts, Bid Whist, Chess, with synced shot clocks.</li>
              <li>• <b>Roguelite Chess Trial</b> — daily 24-hour permadeath ladder; lives reset at UTC midnight.</li>
              <li>• <b>Voice Coach</b> — Whisper STT + Claude tip after every move, hold-to-talk Q&A.</li>
              <li>• <b>Cyber-Casino Battle Mode</b> — alternate neon arena skin for chess practice.</li>
              <li>• <b>DSG Guard</b> shot-clock + safety rails apply to every multiplayer table.</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-fuchsia-300 mb-2">
              Eligible $VIBEZ Earners
            </p>
            <div className="flex flex-wrap gap-2">
              {(constants?.eligible_games || ["spades","poker","blackjack","chess","hearts","bid_whist","vibe_dice"]).map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200"
                >
                  {g.replace("_", " ")}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Each match-end fires <code className="text-cyan-300">POST /api/vibez-rewards/match-end</code>,
              calculates the formula, and credits the user's wallet.
            </p>
          </div>
        </div>
      </FeatureCard>

      {/* 2. Tokenomics */}
      <FeatureCard
        id="feature-tokenomics"
        testId="feature-card-tokenomics"
        title="Tokenomics"
        visualLabel="Animated $VIBEZ coin asset"
        visual={<VibezCoin3D size={120} />}
        open={open.tokenomics}
        onToggle={() => toggle("tokenomics")}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-300 mb-2">
              Activity Multiplier Formula
            </p>
            <div className="rounded-xl bg-black/60 border border-amber-400/40 p-4 font-mono text-amber-200 text-sm">
              {constants?.formula || "R_total = (B_base × M_multiplier) + T_bonus + chair_boost"}
            </div>
            <ul className="space-y-1.5 mt-3 text-slate-200 text-[13px]">
              <li>• <b>B_base</b> — {constants?.B_base_per_minute ?? 1.0} token / minute of active play</li>
              <li>• <b>M_multiplier</b> — Power Hour boost {constants?.power_hour_multiplier ?? 1.5}×</li>
              <li>• <b>T_bonus</b> — chat / gift / match / vote / buff bonuses</li>
              <li>• <b>chair_boost</b> — +10% for verified Seated Ownership</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-300 mb-2">
              Live Supply Telemetry
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Supply"  value={`${fmt(burn?.total_supply ?? 3_000_000_000)} ₵`} accent="text-white" />
              <Stat label="Circulating"   value={`${fmt(burn?.circulating ?? 0)} ₵`}              accent="text-cyan-300" />
              <Stat label="Lifetime Burned" value={`${fmt(burn?.burned ?? 0)} ₵`}                  accent="text-rose-300" icon={<Flame className="w-3.5 h-3.5" />} />
              <Stat label="24h Burned"    value={`${fmt(burn?.burned_24h ?? 0)} ₵`}                accent="text-orange-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Locked rate: 2,000 ₵ = $1 USD · Mint mode:{" "}
              <span className="text-amber-300 font-bold">
                {constants?.mint_mode || "SIMULATED"}
              </span>{" "}
              (flips to mainnet on TGE).
            </p>
          </div>
        </div>
      </FeatureCard>

      {/* 3. Lifestyle Hub */}
      <FeatureCard
        id="feature-lifestyle"
        testId="feature-card-lifestyle"
        title="Lifestyle Hub"
        visualLabel="VibeRidez · Hungry Vibez · Vibe Venues"
        visual={
          <div className="flex items-center gap-3">
            <Car className="w-10 h-10 text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,0.55)]" />
            <Pizza className="w-10 h-10 text-orange-300 drop-shadow-[0_0_16px_rgba(251,146,60,0.55)]" />
            <Home className="w-10 h-10 text-fuchsia-300 drop-shadow-[0_0_16px_rgba(217,70,239,0.55)]" />
          </div>
        }
        open={open.lifestyle}
        onToggle={() => toggle("lifestyle")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <ServiceCell
            Icon={Car}
            color="text-cyan-300"
            title="VibeRidez"
            desc="Creator-fleet rides. One-tap Ride Home from any lobby; geolocates and hands off to verified drivers."
            cta="View rides →"
            href="/rides"
          />
          <ServiceCell
            Icon={Pizza}
            color="text-orange-300"
            title="HungryVibes"
            desc="In-game floating food menu. Order a pizza without pausing the table — picks up on the same fleet as VibeRidez."
            cta="Order food →"
            href="/hungryvibes"
          />
          <ServiceCell
            Icon={Home}
            color="text-fuchsia-300"
            title="Vibe Venues"
            desc="Real-world bars + clubs that host live Vibe Suites. Sync your watch-party with the room."
            cta="Find a venue →"
            href="/vibe-venues"
          />
          <ServiceCell
            Icon={MapPin}
            color="text-amber-300"
            title="Yellow Pages"
            desc="Mom-and-pop directory · verified businesses · hyper-local. Ad credits burn ₵ on every listing boost."
            cta="Browse directory →"
            href="/yellow-pages"
          />
        </div>
      </FeatureCard>
    </section>
  );
};

const Stat: React.FC<{ label: string; value: string; accent: string; icon?: React.ReactNode }> = ({
  label, value, accent, icon,
}) => (
  <div className="rounded-xl bg-black/40 border border-amber-400/15 p-3">
    <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
      {icon} {label}
    </div>
    <div className={`text-lg font-black ${accent}`}>{value}</div>
  </div>
);

const ServiceCell: React.FC<{
  Icon: React.ElementType;
  color: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
}> = ({ Icon, color, title, desc, cta, href }) => (
  <a
    href={href}
    className="block rounded-xl bg-black/40 border border-purple-500/25 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/5 p-4 transition"
  >
    <Icon className={`w-7 h-7 ${color} mb-2`} />
    <div className="font-black text-white mb-1">{title}</div>
    <div className="text-[12px] text-slate-300 leading-snug mb-2">{desc}</div>
    <div className={`text-[11px] font-mono uppercase tracking-wider ${color}`}>{cta}</div>
  </a>
);

export default LandingFeatureAccordions;

// Small global object used by the regression shield to introspect the
// rendered card slugs without DOM scraping in CI.
export const FEATURE_CARDS = {
  game_logic: "feature-card-game-logic",
  tokenomics: "feature-card-tokenomics",
  lifestyle:  "feature-card-lifestyle",
};
