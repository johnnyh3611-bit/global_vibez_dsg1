/**
 * WinCelebration — shared win/lose screen for multiplayer card games.
 *
 * - Animated trophy + confetti for the winner
 * - Calls the backend to claim $DSG (idempotent — the server dedupes)
 * - Shows mined amount with a count-up animation
 * - Plays win/lose sound via cardSoundManager
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Coins, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;

interface WinCelebrationProps {
  won: boolean;
  gameId: string;
  userId: string;
  gameLabel: string;       // e.g. "War", "Gin Rummy"
  subtitle?: string;       // e.g. "Final round: 47"
  winnerRole?: "player1" | "player2" | null;  // used to mark backend winner
  onBack: () => void;
  testId?: string;
}

interface ClaimResult {
  mined: number;
  total?: number;
  reason?: string;
  locked?: boolean;
  already_claimed?: boolean;
}

const WinCelebration: React.FC<WinCelebrationProps> = ({ won, gameId, userId, gameLabel, subtitle, winnerRole, onBack, testId = "win-celebration" }) => {
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [countUp, setCountUp] = useState(0);
  const claimTriedRef = useRef(false);

  // Claim + play sound — exactly once per mount
  useEffect(() => {
    if (claimTriedRef.current) return;
    claimTriedRef.current = true;

    const run = async () => {
      if (won) {
        cardSoundManager.playWinSound?.();
        setTimeout(() => cardSoundManager.playCardShuffle?.(), 200);

        setClaiming(true);
        // Declare the winner on the server first (idempotent; only runs once
        // per game since end-game just flips the status). Needed so the
        // subsequent /claim-win call finds a completed game with a winner.
        try {
          await fetch(
            `${API}/api/http-multiplayer/end-game?game_id=${encodeURIComponent(gameId)}&user_id=${encodeURIComponent(userId)}&winner=${encodeURIComponent(winnerRole || "player1")}`,
            { method: "POST",}
          );
        } catch {
          /* non-fatal — claim might still work if opponent already ended it */
        }

        try {
          const r = await fetch(
            `${API}/api/http-multiplayer/claim-win?game_id=${encodeURIComponent(gameId)}&user_id=${encodeURIComponent(userId)}`,
            { method: "POST",}
          );
          const data: ClaimResult = await r.json().catch(() => ({ mined: 0 }));
          setClaim(data);
          const target = Number(data.mined) || 0;
          if (target > 0) {
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - start) / 1200);
              setCountUp(Number((target * p).toFixed(2)));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        } catch {
          setClaim({ mined: 0, reason: "claim_failed" });
        } finally {
          setClaiming(false);
        }
      } else {
        cardSoundManager.playLoseSound?.();
      }
    };
    run();
  }, [won, gameId, userId, winnerRole]);

  const handleBack = useCallback(() => {
    cardSoundManager.playCardFlip?.();
    onBack();
  }, [onBack]);

  // Confetti positions, memoized per mount
  const confettiCount = 24;
  const confettiPieces = Array.from({ length: confettiCount }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.3,
    rot: (Math.random() - 0.5) * 180,
    color: ["#f0abfc", "#fef08a", "#67e8f9", "#86efac", "#fdba74"][i % 5],
  }));

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-6" data-testid={testId}>
      {/* Confetti — winner only */}
      {won && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confettiPieces.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -40, x: `${p.x}vw`, rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: p.rot }}
              transition={{ duration: 3.2 + Math.random() * 1.5, delay: p.delay, ease: "linear", repeat: Infinity, repeatDelay: 1.5 }}
              className="absolute w-2 h-3 rounded-sm"
              style={{ background: p.color }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 200 }}
        className="relative max-w-md w-full rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-neutral-900 to-black shadow-2xl"
      >
        {/* Ambient glow */}
        <div
          className={`absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-30 ${won ? "bg-yellow-400" : "bg-rose-500"}`}
          aria-hidden
        />

        <div className="relative p-8 text-center text-white">
          <motion.div
            initial={{ scale: 0, rotate: -60 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 140, delay: 0.1 }}
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
              won ? "bg-yellow-400/15 ring-2 ring-yellow-400/60" : "bg-rose-500/15 ring-2 ring-rose-500/40"
            }`}
          >
            <Trophy className={`w-10 h-10 ${won ? "text-yellow-300" : "text-rose-300"}`} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-black italic tracking-tighter mb-1"
          >
            {won ? "Victory." : "Defeated."}
          </motion.h1>
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-white/50 mb-5">{gameLabel}</div>
          {subtitle && <div className="text-sm text-white/60 mb-6">{subtitle}</div>}

          {/* $DSG reward — winner only */}
          {won && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-6 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-cyan-400/5 p-5"
                data-testid="win-vibez-reward"
              >
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300 mb-2">
                  <Coins className="w-3 h-3" /> $DSG Mined
                </div>
                {claiming ? (
                  <div className="flex items-center justify-center gap-2 text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" /> <span>Claiming…</span>
                  </div>
                ) : claim?.locked ? (
                  <div className="text-xs text-amber-300" data-testid="win-vibez-locked">
                    {claim.reason === "Free tier cannot mine"
                      ? "Upgrade to mine $DSG"
                      : claim.reason || "Mining locked"}
                  </div>
                ) : claim?.already_claimed ? (
                  <div className="text-xs text-white/40" data-testid="win-vibez-already">
                    Already claimed.
                  </div>
                ) : (
                  <div className="text-4xl font-black italic tabular-nums text-white" data-testid="win-vibez-amount">
                    +{countUp.toFixed(2)}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          <Button
            onClick={handleBack}
            className={`w-full font-black italic uppercase tracking-widest ${
              won ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black" : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            data-testid="win-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Lobby
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default WinCelebration;
