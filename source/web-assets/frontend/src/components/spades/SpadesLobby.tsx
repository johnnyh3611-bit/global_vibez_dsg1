/**
 * SpadesLobby — Pre-game room selector.
 *
 * Phase 0 of the Spades AAA flow. The user picks:
 *   • Mode: AI Practice vs Live Multiplayer
 *   • Ruleset: Classic (52-card) vs Big Wheel (54-card with promoted Jokers)
 *
 * Visual: Full-bleed deep-space background with a single glass card
 * floating in the centre. Big tactile choice tiles, neon cyan accents, a
 * sticky "Start" CTA at the bottom that's locked off until both choices
 * are made.
 *
 * Note: This is the lobby for the new Spades canonical room. The 5
 * legacy Spades pages will be deleted in a follow-up step once the user
 * verifies this implementation.
 */
import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Wifi, Sparkles, ShieldCheck, Spade } from "lucide-react";
import type { SpadesMode, SpadesRuleset } from "./types";

interface Props {
  mode: SpadesMode;
  ruleset: SpadesRuleset;
  busy: boolean;
  onChangeMode: (m: SpadesMode) => void;
  onChangeRuleset: (r: SpadesRuleset) => void;
  onStart: () => void;
  onBack: () => void;
}

export const SpadesLobby: React.FC<Props> = ({
  mode,
  ruleset,
  busy,
  onChangeMode,
  onChangeRuleset,
  onStart,
  onBack,
}) => {
  return (
    <div
      className="min-h-screen bg-[#050507] text-white relative overflow-x-hidden"
      data-testid="spades-aaa-lobby"
      data-testid-alt="spades-lobby"
    >
      {/* Glasshouse grid */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>
      {/* Cyan halo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-cyan-500/15 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-300/70 hover:text-white transition mb-4"
          data-testid="spades-lobby-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-fuchsia-700 shadow-[0_0_24px_rgba(34,211,238,0.45)]">
            <Spade className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-400/80">
              Card Room · Spades
            </p>
            <h1 className="text-3xl md:text-4xl font-black leading-none">
              Spades AAA
            </h1>
          </div>
        </div>

        {/* ── Mode picker ──────────────────────────────────────────── */}
        <Section title="Mode" subtitle="Pick your opponents.">
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile
              active={mode === "ai"}
              onClick={() => onChangeMode("ai")}
              testid="spades-mode-ai"
              icon={<Bot className="w-7 h-7" />}
              title="AI Practice"
              body="3 bots · instant start · perfect for warming up the bid tightness."
            />
            <Tile
              active={mode === "live"}
              onClick={() => onChangeMode("live")}
              testid="spades-mode-live"
              icon={<Wifi className="w-7 h-7" />}
              title="Live Multiplayer"
              body="Find 3 real players · matchmaking queue · partner pairs by seat."
            />
          </div>
        </Section>

        {/* ── Ruleset picker ───────────────────────────────────────── */}
        <Section
          title="Ruleset"
          subtitle="Classic is the standard. Big Wheel adds Jokers + promoted 2♠ / 2♦ trumps."
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile
              active={ruleset === "CLASSIC"}
              onClick={() => onChangeRuleset("CLASSIC")}
              testid="spades-ruleset-classic"
              icon={<ShieldCheck className="w-7 h-7" />}
              title="Classic"
              body="52-card deck · A♠ is top trump · 5% house cut on wagered tables."
            />
            <Tile
              active={ruleset === "BIG_WHEEL"}
              onClick={() => onChangeRuleset("BIG_WHEEL")}
              testid="spades-ruleset-bigwheel"
              icon={<Sparkles className="w-7 h-7" />}
              title="Big Wheel"
              body="54-card deck · Big Joker › Little Joker › 2♠ › 2♦ › A♠ · 7% house cut."
            />
          </div>
        </Section>

        {/* ── House rules ──────────────────────────────────────────── */}
        <div
          className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-cyan-400/15 text-xs text-purple-200/70 leading-relaxed"
          data-testid="spades-lobby-rules"
        >
          <span className="block text-cyan-300 font-bold uppercase tracking-widest text-[10px] mb-1">
            House rules
          </span>
          • First team to <strong>200 points</strong> wins the table.<br />
          • Spades are always trump · cannot lead spades until they're broken.<br />
          • <strong>Bag penalty:</strong> every 5 overtricks costs your team
          50 points (bags then reset to 0). Plan your bid tight.<br />
          • Failing your bid = −10 × bid points.
        </div>

        {/* ── Sticky Start CTA ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 sticky bottom-4 z-20"
        >
          <button
            onClick={onStart}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(34,211,238,0.45)] disabled:opacity-50 transition-all"
            data-testid="spades-aaa-lobby-start-btn"
            id="spades-lobby-start-btn"
          >
            {busy
              ? "Starting…"
              : mode === "ai"
                ? "Start AI Match"
                : "Find Opponents"}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="mb-6">
    <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80 mb-1">
      {title}
    </p>
    <p className="text-xs text-purple-200/60 mb-3">{subtitle}</p>
    {children}
  </div>
);

const Tile: React.FC<{
  active: boolean;
  onClick: () => void;
  testid: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = ({ active, onClick, testid, icon, title, body }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`text-left p-4 rounded-2xl transition-all border-2 ${
      active
        ? "bg-cyan-500/10 border-cyan-400/70 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
        : "bg-white/[0.02] border-white/10 hover:border-cyan-400/30"
    }`}
  >
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
        active ? "bg-cyan-400/20 text-cyan-200" : "bg-white/5 text-purple-200/70"
      }`}
    >
      {icon}
    </div>
    <p
      className={`text-base font-black mb-1 ${
        active ? "text-white" : "text-purple-100/90"
      }`}
    >
      {title}
    </p>
    <p className="text-xs text-purple-200/70 leading-snug">{body}</p>
  </button>
);

export default SpadesLobby;
