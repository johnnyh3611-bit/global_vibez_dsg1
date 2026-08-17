/**
 * ComingSoonOverlay — page-level placeholder rendered in place of any
 * game whose id is in `data/comingSoonGames.COMING_SOON_GAME_IDS`.
 *
 * Looks like a polished "we're cooking this one" message, NOT a 404.
 * Lets the user navigate back to the lobby, multiplayer, or browse other
 * games. Used by PracticeGamePlay + HttpGameRouter.
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2, Hammer, Sparkles } from "lucide-react";

interface Props {
  /** Human-readable game name for the headline (defaults to "This game"). */
  gameName?: string;
  /** data-testid prefix (defaults to "coming-soon"). */
  testId?: string;
}

export default function ComingSoonOverlay({
  gameName = "This game",
  testId = "coming-soon",
}: Props) {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-[#04060e] flex items-center justify-center p-6 relative overflow-hidden"
      data-testid={`${testId}-page`}
    >
      {/* Ambient grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Soft amber glow behind the card */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(251,191,36,0.45), rgba(251,191,36,0))",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 max-w-lg w-full bg-slate-900/70 backdrop-blur border border-amber-400/30 rounded-3xl p-8 md:p-10 text-center shadow-[0_0_60px_rgba(251,191,36,0.15)]"
        data-testid={`${testId}-card`}
      >
        {/* Hammer icon with soft pulse */}
        <motion.div
          initial={{ rotate: -8 }}
          animate={{ rotate: [-8, 4, -8] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/15 border border-amber-300/40 mb-5"
        >
          <Hammer className="w-8 h-8 text-amber-300" />
        </motion.div>

        <p
          className="text-[10px] uppercase tracking-[0.4em] text-amber-300/80 font-bold mb-2"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> In the workshop
          </span>
        </p>

        <h1
          className="text-3xl md:text-4xl font-black text-amber-200 mb-3 leading-tight"
          style={{ fontFamily: "'Cinzel', serif" }}
          data-testid={`${testId}-headline`}
        >
          Coming Soon
        </h1>

        <p className="text-slate-300 text-sm md:text-base mb-1">
          <span className="text-white font-bold">{gameName}</span> isn't quite ready yet.
        </p>
        <p className="text-slate-400 text-xs md:text-sm mb-7">
          Our team is finishing this room — check back soon. In the meantime, plenty of
          AAA tables are already live.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/games-menu")}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black uppercase tracking-[0.25em] text-xs shadow-[0_0_24px_rgba(251,191,36,0.4)] transition"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid={`${testId}-browse-btn`}
          >
            <Gamepad2 className="w-4 h-4" />
            Browse Live Rooms
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-200 font-bold uppercase tracking-[0.25em] text-xs transition"
            data-testid={`${testId}-back-btn`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
