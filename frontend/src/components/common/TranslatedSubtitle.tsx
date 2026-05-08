/**
 * TranslatedSubtitle — tiny presentational component that renders an
 * auto-translated subtitle beneath a message. Invisible when the user
 * hasn't enabled auto-translate, when the source and target languages
 * match, or when the text is too short / translation failed.
 */
import React from "react";
import { Languages, Loader2 } from "lucide-react";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";

type Props = {
  text: string | undefined | null;
  className?: string;
  sourceHint?: string;
  /** visual density — 'dim' (default) for in-chat, 'solid' for standalone */
  tone?: "dim" | "solid";
};

export const TranslatedSubtitle: React.FC<Props> = ({
  text,
  className = "",
  sourceHint,
  tone = "dim",
}) => {
  const { enabled, translated, sameLanguage, loading, error, targetLang } =
    useAutoTranslate(text, { sourceHint });

  if (!enabled) return null;
  if (loading) {
    return (
      <div
        className={`mt-1 flex items-center gap-1.5 text-[10px] text-slate-400/80 italic ${className}`}
        data-testid="translated-subtitle-loading"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Translating to {targetLang}…
      </div>
    );
  }
  if (error) return null; // fail silently
  if (!translated || sameLanguage) return null;
  if (translated.trim().toLowerCase() === (text || "").trim().toLowerCase())
    return null;

  const toneClass =
    tone === "solid"
      ? "text-slate-200"
      : "text-cyan-300/80";

  return (
    <div
      className={`mt-1 flex items-start gap-1.5 text-[11px] italic ${toneClass} ${className}`}
      data-testid="translated-subtitle"
    >
      <Languages className="w-3 h-3 mt-0.5 shrink-0 opacity-70" />
      <span className="leading-snug">{translated}</span>
    </div>
  );
};

export default TranslatedSubtitle;
