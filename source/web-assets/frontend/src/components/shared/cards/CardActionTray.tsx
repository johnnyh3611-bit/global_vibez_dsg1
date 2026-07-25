/**
 * CardActionTray — unified bottom control bar for pass/draw/play/score.
 * Drop into GameRoomLayout `actions` slot.
 */
import React from "react";
import type { CardPhase } from "./types";

export type CardAction = {
  id: string;
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  testId?: string;
  /** If set, only show when phase matches (or is in the list). */
  phases?: CardPhase | CardPhase[];
};

const VARIANT: Record<NonNullable<CardAction["variant"]>, string> = {
  primary:
    "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)]",
  secondary:
    "bg-white/10 hover:bg-white/15 text-white border border-white/20",
  danger:
    "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]",
  ghost: "bg-transparent hover:bg-white/5 text-slate-200 border border-slate-600",
  success:
    "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]",
};

export type CardActionTrayProps = {
  phase: CardPhase;
  actions: CardAction[];
  leading?: React.ReactNode;
  className?: string;
  testId?: string;
};

export function CardActionTray({
  phase,
  actions,
  leading,
  className = "",
  testId = "card-action-tray",
}: CardActionTrayProps) {
  const visible = actions.filter((a) => {
    if (!a.phases) return true;
    const list = Array.isArray(a.phases) ? a.phases : [a.phases];
    return list.includes(phase);
  });

  if (!visible.length && !leading) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 md:gap-3 px-2 ${className}`}
      data-testid={testId}
      data-phase={phase}
    >
      {leading}
      {visible.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          disabled={a.disabled}
          data-testid={a.testId ?? `card-action-${a.id}`}
          className={`px-4 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest disabled:opacity-40 transition ${
            VARIANT[a.variant ?? "primary"]
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export default CardActionTray;
