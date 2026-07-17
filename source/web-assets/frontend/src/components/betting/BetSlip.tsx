/**
 * Shared betting UX — BetSlip, presets, standardized Bet button, toasts.
 * Used by casino shells (Craps, Sic Bo, …) for sportsbook-style clarity.
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const DICE_ROLL_MS = 1500;

/** Z-index layers so cards/bets always sit above in-game video docks. */
export const GAME_Z = {
  videoDock: 20,
  table: 30,
  cards: 40,
  chips: 45,
  betSlip: 50,
  toast: 60,
  /** Voice call modals stay above everything (existing 9998+) */
  callOverlay: 9998,
} as const;

export type BetPresetId = "min" | "x5" | "x10" | "max";

export function computePresetStake(
  preset: BetPresetId,
  minBet: number,
  maxBet: number,
  balance: number,
): number {
  const ceiling = Math.max(minBet, Math.min(maxBet, balance > 0 ? balance : maxBet));
  switch (preset) {
    case "min":
      return minBet;
    case "x5":
      return Math.min(ceiling, minBet * 5);
    case "x10":
      return Math.min(ceiling, minBet * 10);
    case "max":
      return ceiling;
    default:
      return minBet;
  }
}

export function potentialReturn(stake: number, payoutRatio: number): number {
  // payoutRatio like 30 means 30:1 → stake * 30 on win (gross before house tax)
  return Math.round(stake * payoutRatio * 100) / 100;
}

/** Fixed-duration dice tumble — same feel on every device. */
export async function runFixedDiceRoll(
  onFrame: (faces: number[]) => void,
  dieCount: number,
  durationMs: number = DICE_ROLL_MS,
): Promise<void> {
  const frameMs = 80;
  const frames = Math.max(1, Math.floor(durationMs / frameMs));
  const start = Date.now();
  for (let i = 0; i < frames; i++) {
    onFrame(
      Array.from({ length: dieCount }, () => Math.ceil(Math.random() * 6)),
    );
    const elapsed = Date.now() - start;
    const target = (i + 1) * frameMs;
    const wait = Math.max(0, target - elapsed);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, wait));
  }
  // Pad to exact duration if frames finished early
  const left = durationMs - (Date.now() - start);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
}

export function notifyBetPlaced(stake: number, label?: string) {
  toast.success(label || `Bet ₵${stake} locked in`, {
    description: "Good luck",
    duration: 2200,
  });
}

export function notifyInsufficientCoins(need: number, have: number) {
  toast.error("Not enough coins", {
    description: `Need ₵${need.toLocaleString()} · you have ₵${have.toLocaleString()}`,
    duration: 3200,
  });
}

export function notifyBetError(message: string) {
  toast.error(message, { duration: 2800 });
}

/** High-contrast Global Vibez Bet / Confirm CTA — same look in every room. */
export function BetButton({
  children,
  onClick,
  disabled,
  testid,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  testid?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-[0_0_24px_rgba(251,191,36,0.35)]"
      : variant === "danger"
        ? "bg-gradient-to-r from-rose-500 to-red-600 text-white"
        : "bg-white/10 border border-white/25 text-white hover:bg-white/15";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={
        "gv-bet-btn w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-full font-black uppercase tracking-widest " +
        "transition active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed " +
        styles +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export function BetPresets({
  minBet,
  maxBet,
  balance,
  stake,
  onChange,
  disabled,
  testid = "bet-presets",
}: {
  minBet: number;
  maxBet: number;
  balance: number;
  stake: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  testid?: string;
}) {
  const presets: { id: BetPresetId; label: string }[] = [
    { id: "min", label: "Min" },
    { id: "x5", label: "5×" },
    { id: "x10", label: "10×" },
    { id: "max", label: "Max" },
  ];
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid} role="group" aria-label="Bet presets">
      {presets.map((p) => {
        const value = computePresetStake(p.id, minBet, maxBet, balance);
        const active = stake === value;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value)}
            data-testid={`${testid}-${p.id}`}
            className={
              "px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border transition " +
              (active
                ? "border-amber-300 bg-amber-400/20 text-amber-200"
                : "border-white/15 bg-white/5 text-white/70 hover:border-white/30") +
              " disabled:opacity-40"
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export interface BetSlipProps {
  open: boolean;
  stake: number;
  payoutRatio: number;
  selectionLabel: string;
  balance?: number;
  minBet?: number;
  maxBet?: number;
  confirming?: boolean;
  disabled?: boolean;
  onStakeChange?: (n: number) => void;
  onConfirm: () => void;
  onDismiss?: () => void;
  confirmLabel?: string;
  testid?: string;
}

/**
 * Floating sportsbook-style bet slip — Stake, Potential Return, Confirm.
 * z-index sits above table/video dock, below voice-call overlays.
 */
export default function BetSlip({
  open,
  stake,
  payoutRatio,
  selectionLabel,
  balance = 0,
  minBet = 5,
  maxBet = 1000,
  confirming = false,
  disabled = false,
  onStakeChange,
  onConfirm,
  onDismiss,
  confirmLabel = "Confirm bet",
  testid = "bet-slip",
}: BetSlipProps) {
  const ret = useMemo(
    () => potentialReturn(stake, payoutRatio),
    [stake, payoutRatio],
  );
  const canAfford = balance <= 0 || stake <= balance;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[360px] p-3 sm:p-0"
          style={{ zIndex: GAME_Z.betSlip }}
          data-testid={testid}
        >
          <div className="rounded-2xl border border-amber-400/35 bg-black/92 backdrop-blur-xl shadow-[0_0_40px_rgba(251,191,36,0.18)] p-4 text-white">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold">
                  Bet slip
                </p>
                <p className="text-sm font-semibold text-white/90 mt-0.5">
                  {selectionLabel}
                </p>
              </div>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-white/40 hover:text-white text-xs"
                  data-testid={`${testid}-dismiss`}
                >
                  Close
                </button>
              )}
            </div>

            {onStakeChange && (
              <div className="mb-3">
                <BetPresets
                  minBet={minBet}
                  maxBet={maxBet}
                  balance={balance > 0 ? balance : maxBet}
                  stake={stake}
                  onChange={onStakeChange}
                  disabled={disabled || confirming}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <div className="text-[9px] uppercase tracking-wider text-white/45">
                  Stake
                </div>
                <div className="font-mono font-black text-amber-200" data-testid={`${testid}-stake`}>
                  ₵{stake}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <div className="text-[9px] uppercase tracking-wider text-white/45">
                  Odds
                </div>
                <div className="font-mono font-black text-cyan-300">
                  {payoutRatio}:1
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                <div className="text-[9px] uppercase tracking-wider text-white/45">
                  To win
                </div>
                <div
                  className="font-mono font-black text-emerald-300"
                  data-testid={`${testid}-return`}
                >
                  ₵{ret}
                </div>
              </div>
            </div>

            {balance > 0 && (
              <p className="text-[10px] text-white/40 mb-3 text-center">
                Balance ₵{balance.toLocaleString()}
                {!canAfford && (
                  <span className="text-rose-300"> · stake exceeds balance</span>
                )}
              </p>
            )}

            <BetButton
              testid={`${testid}-confirm`}
              disabled={disabled || confirming || !canAfford || stake < minBet}
              onClick={() => {
                if (!canAfford) {
                  notifyInsufficientCoins(stake, balance);
                  return;
                }
                onConfirm();
              }}
            >
              {confirming ? "Confirming…" : confirmLabel}
            </BetButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
