/**
 * ChairHolderName — Roadmap PDF §3.
 * Renders a chat username with the chair-holder's unique color + glow
 * if the user owns at least one chair. Falls back to a plain span for
 * non-holders. Pure presentation — no state side-effects.
 */
import React from "react";
import { Crown } from "lucide-react";
import type { ChairPerks } from "@/hooks/useChairPerks";

interface Props {
  username: string;
  perks?: ChairPerks | null;
  className?: string;
  showBadge?: boolean;
}

const ChairHolderName: React.FC<Props> = ({
  username,
  perks,
  className = "",
  showBadge = true,
}) => {
  if (!perks?.owns_chair) {
    return (
      <span className={className} data-testid="chat-username-default">
        {username}
      </span>
    );
  }
  return (
    <span
      data-testid="chat-username-chair-holder"
      data-chair-holder="true"
      className={`inline-flex items-center gap-1 font-bold ${className}`}
      style={{
        color: perks.name_color || "#fbbf24",
        textShadow: perks.glow_color
          ? `0 0 6px ${perks.glow_color}`
          : "0 0 6px rgba(251,191,36,0.45)",
      }}
      title={`${perks.badge_label || "Chair Holder"} · +${perks.generation_boost_pct}% $VIBEZ boost`}
    >
      {showBadge && (
        <Crown className="w-3 h-3" style={{ color: perks.name_color || "#fbbf24" }} />
      )}
      {username}
    </span>
  );
};

export default ChairHolderName;
