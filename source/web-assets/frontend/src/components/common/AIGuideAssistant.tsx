/**
 * AIGuideAssistant — floating AI Navigator for room guidance.
 *
 * Collapsed: "Need Guidance?" pill (hidden when PageActionStrip owns chrome).
 * Open: titled panel with VibezTabChrome + contextual hint from
 * POST /api/ai/guide-hint for the current route (plus tips / known issues).
 */
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Loader2, AlertTriangle, Lightbulb } from "lucide-react";
import useCornerDockTrigger from "@/hooks/useCornerDockTrigger";
import { VibezTabChrome } from "@/components/ui/VibezTabChrome";

const API = process.env.REACT_APP_BACKEND_URL || "";

const HIDDEN_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

function roomKeyFromPath(pathname: string): string {
  const p = pathname.toLowerCase();
  if (p.startsWith("/underground")) return "underground";
  if (p.startsWith("/sports-lounge")) return "sports";
  if (p.startsWith("/dashboard")) return "hub";
  if (p.startsWith("/hungry") || p.startsWith("/restaurants")) return "food";
  if (p.startsWith("/vibe-ridez") || p.startsWith("/vibe-drive")) return "rides";
  if (
    p.startsWith("/dating") ||
    p.startsWith("/matches") ||
    p.startsWith("/just-for-the-night") ||
    p.startsWith("/jftn")
  ) {
    return "dating";
  }
  if (
    p.startsWith("/streaming") ||
    p.startsWith("/streamer") ||
    p.startsWith("/dsg-tv") ||
    p.startsWith("/vibe-tv") ||
    p.startsWith("/cinema") ||
    p.startsWith("/free-tv")
  ) {
    return "streaming";
  }
  if (
    p.startsWith("/games") ||
    p.startsWith("/practice") ||
    p.startsWith("/spades") ||
    p.startsWith("/bid-whist") ||
    p.startsWith("/dominoes") ||
    p.startsWith("/hearts") ||
    p.startsWith("/euchre") ||
    p.startsWith("/pinochle") ||
    p.startsWith("/uno") ||
    p.startsWith("/casino") ||
    p.startsWith("/chess") ||
    p.startsWith("/checkers") ||
    p.startsWith("/vibez-654") ||
    p.startsWith("/three-card")
  ) {
    return "gaming";
  }
  return "default";
}

function collectDiagnostics() {
  if (typeof window === "undefined") return {};
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    viewport_w: w,
    viewport_h: h,
    orientation: w >= h ? "landscape" : "portrait",
    force_landscape: document.body.classList.contains("gv-force-landscape"),
    authenticated: Boolean(
      window.localStorage.getItem("user_id") ||
        window.localStorage.getItem("token") ||
        window.localStorage.getItem("access_token")
    ),
  };
}

export default function AIGuideAssistant() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [tips, setTips] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const triggerHidden = useCornerDockTrigger("ai_guide", setIsOpen);

  const hidden =
    pathname === "/" ||
    HIDDEN_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p));

  const fetchAIHint = useCallback(async (room: string, path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/ai/guide-hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room,
          path,
          diagnostics: collectDiagnostics(),
        }),
      });
      if (!response.ok) throw new Error(`hint ${response.status}`);
      const data = await response.json();
      setSuggestion(
        data.hint ||
          "Welcome! Let me know if you need help navigating this room."
      );
      setTips(Array.isArray(data.tips) ? data.tips : []);
      setIssues(Array.isArray(data.known_issues) ? data.known_issues : []);
    } catch {
      setSuggestion(
        "Welcome! Let me know if you need help navigating this room."
      );
      setTips([]);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    const room = roomKeyFromPath(pathname);
    fetchAIHint(room, pathname);
  }, [pathname, hidden, fetchAIHint]);

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[115] pointer-events-none"
      data-testid="ai-guide-assistant"
    >
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border border-fuchsia-500/30 bg-slate-950/95 backdrop-blur-xl shadow-[0_0_40px_rgba(168,85,247,0.25)]"
            data-testid="ai-guide-panel"
          >
            <VibezTabChrome
              title={
                <span className="inline-flex items-center gap-2">
                  <Bot className="w-4 h-4 text-fuchsia-300" />
                  AI Navigator
                </span>
              }
              onClose={() => setIsOpen(false)}
              closeTestId="ai-guide-close"
              testId="ai-guide-chrome"
              className="rounded-none sticky top-0 z-10"
            />
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Looking around this room…
                </div>
              ) : (
                <>
                  <p
                    className="text-sm text-white/85 leading-relaxed"
                    data-testid="ai-guide-hint"
                  >
                    {suggestion}
                  </p>
                  {tips.length > 0 ? (
                    <div data-testid="ai-guide-tips">
                      <p className="text-[10px] uppercase tracking-wider font-black text-amber-200/90 mb-1.5 inline-flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Right now
                      </p>
                      <ul className="space-y-1.5">
                        {tips.map((t) => (
                          <li
                            key={t}
                            className="text-[12px] leading-snug text-white/70 pl-2 border-l-2 border-amber-400/40"
                          >
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {issues.length > 0 ? (
                    <div data-testid="ai-guide-issues">
                      <p className="text-[10px] uppercase tracking-wider font-black text-rose-200/90 mb-1.5 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Watch-outs
                      </p>
                      <ul className="space-y-1.5">
                        {issues.map((t) => (
                          <li
                            key={t}
                            className="text-[12px] leading-snug text-white/65 pl-2 border-l-2 border-rose-400/35"
                          >
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          !triggerHidden && (
            <motion.button
              key="trigger"
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setIsOpen(true)}
              data-testid="ai-guide-open"
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_24px_rgba(232,121,249,0.45)] hover:from-fuchsia-500 hover:to-pink-500 transition-all text-sm font-bold"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Need Guidance?</span>
            </motion.button>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
