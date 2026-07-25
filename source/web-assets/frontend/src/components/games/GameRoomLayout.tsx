/**
 * GameRoomLayout — the Table Standard for all card rooms.
 *
 * Ergonomics:
 *  • Table locked to viewport center (grid place-items)
 *  • Hand as a bottom semi-circular arc
 *  • Draw / Action buttons sit above the arc (thumb-safe)
 *  • Z-index: table base → actions → hand → overlays → HUD
 *
 * Convenience:
 *  • Persistent Room HUD (swap games / wallet without full exit)
 *  • Quick Settings (volume + game speed) top-right
 *  • View Cards accessibility toggle
 *  • ResizeObserver → mobile landscape preference
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Gauge,
  LayoutGrid,
  Settings2,
  Volume2,
  Wallet,
} from "lucide-react";
import soundManager from "@/utils/soundManager";
import { authFetch } from "@/utils/secureAuth";
import { vibezTabTriggerClass } from "@/components/ui/VibezTabStyle";
import { VibezTabChrome } from "@/components/ui/VibezTabChrome";

const SPEED_KEY = "gv_game_speed";
const VIEW_CARDS_KEY = "gv_view_cards";
const API = process.env.REACT_APP_BACKEND_URL;

export interface GameRoomLayoutProps {
  /** Room title shown in the HUD. */
  title: string;
  /** Optional subtitle (ruleset / mode). */
  subtitle?: string;
  /** Felt / table content — rendered in the centered stage. */
  table: React.ReactNode;
  /** Player hand (arc). Prefer wrapping cards in `.gv-room-hand-arc`. */
  hand?: React.ReactNode;
  /** Draw / Hit / Play controls — rendered above the hand. */
  actions?: React.ReactNode;
  /** Score, chat, modals — higher z-index overlay layer. */
  overlay?: React.ReactNode;
  /** Extra HUD right-side content (score badge, etc.). */
  hudExtra?: React.ReactNode;
  /** When true, table slot uses passthrough (no forced oval felt). */
  nativeTable?: boolean;
  /** Back target — default /games. */
  backTo?: string;
  /** Optional custom back handler. */
  onBack?: () => void;
  /** data-testid root suffix */
  testId?: string;
  className?: string;
  children?: React.ReactNode;
}

function readStoredSpeed(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(SPEED_KEY);
  const n = raw ? parseFloat(raw) : 1;
  return Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : 1;
}

function readStoredViewCards(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(VIEW_CARDS_KEY) === "1";
}

export function GameRoomLayout({
  title,
  subtitle,
  table,
  hand,
  actions,
  overlay,
  hudExtra,
  nativeTable = true,
  backTo = "/games",
  onBack,
  testId = "game-room",
  className = "",
  children,
}: GameRoomLayoutProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [speed, setSpeed] = useState(readStoredSpeed);
  const [viewCards, setViewCards] = useState(readStoredViewCards);
  const [mobileLandscape, setMobileLandscape] = useState(false);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);

  // Load volume from localStorage (matches SoundControls).
  useEffect(() => {
    const saved = localStorage.getItem("soundVolume");
    if (saved != null) {
      const v = parseFloat(saved);
      if (Number.isFinite(v)) setVolume(v);
    }
  }, []);

  // Apply game speed as a CSS variable for animation timing consumers.
  useEffect(() => {
    document.documentElement.style.setProperty("--gv-game-speed", String(speed));
    localStorage.setItem(SPEED_KEY, String(speed));
  }, [speed]);

  useEffect(() => {
    localStorage.setItem(VIEW_CARDS_KEY, viewCards ? "1" : "0");
  }, [viewCards]);

  // ResizeObserver — detect mobile portrait and prefer landscape UI.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const apply = (width: number, height: number) => {
      const shortSide = Math.min(width, height);
      const isMobile = shortSide < 900;
      // Mobile portrait → landscape table chrome (wider usable felt).
      // Does not mutate body.gv-force-landscape — that stays opt-in via
      // LandscapeRotateHint so we don't hijack the whole app shell.
      setMobileLandscape(isMobile && height > width);
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    ro.observe(el);
    apply(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Lightweight wallet pill — best-effort; HUD still works offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userRaw = localStorage.getItem("user");
        const user = userRaw ? JSON.parse(userRaw) : null;
        const uid = user?.id || user?.user_id;
        if (!uid || !API) return;
        const res = await authFetch(`${API}/api/wallet/balance/${uid}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const bal = data?.balance ?? data?.credits_balance ?? data?.token_balance;
        if (typeof bal === "number" && !cancelled) {
          setWalletLabel(`₵${bal.toLocaleString()}`);
        }
      } catch {
        /* wallet optional in practice rooms */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else navigate(backTo);
  }, [backTo, navigate, onBack]);

  const handleVolume = (v: number) => {
    setVolume(v);
    soundManager.setVolume(v);
    if (v <= 0.01) soundManager.setEnabled(false);
    else soundManager.setEnabled(true);
  };

  return (
    <div
      ref={rootRef}
      className={`gv-room ${className}`}
      data-testid={testId}
      data-view-cards={viewCards ? "true" : "false"}
      data-mobile-landscape={mobileLandscape ? "true" : "false"}
      style={{ ["--gv-game-speed" as string]: String(speed) }}
    >
      {/* Persistent Room HUD */}
      <header className="gv-room-hud" data-testid="room-hud">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className={vibezTabTriggerClass({
              active: false,
              variant: "pills",
              className: "px-2.5 py-1.5",
            })}
            data-testid="room-hud-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/games")}
            className={vibezTabTriggerClass({
              active: false,
              variant: "pills",
              className: "px-2.5 py-1.5",
            })}
            title="Swap games without leaving the suite"
            data-testid="room-hud-swap"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Games</span>
          </button>
          <div className="min-w-0 pl-1">
            <p className="gv-room-hud__brand truncate">Vibez · {title}</p>
            {subtitle ? (
              <p className="text-[10px] text-white/45 truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hudExtra}
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="gv-room-hud__wallet inline-flex items-center gap-1"
            data-testid="room-hud-wallet"
            title="Wallet balance"
          >
            <Wallet className="h-3.5 w-3.5" />
            {walletLabel ?? "Wallet"}
          </button>
          <button
            type="button"
            onClick={() => setViewCards((v) => !v)}
            className={vibezTabTriggerClass({
              active: viewCards,
              variant: "pills",
              className: "px-2.5 py-1.5",
            })}
            title={viewCards ? "Normal card size" : "View Cards (larger)"}
            aria-pressed={viewCards}
            data-testid="room-view-cards-toggle"
          >
            {viewCards ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className={vibezTabTriggerClass({
              active: settingsOpen,
              variant: "pills",
              className: "px-2.5 py-1.5",
            })}
            title="Quick Settings"
            aria-expanded={settingsOpen}
            data-testid="room-quick-settings-toggle"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Quick Settings popover — top-right */}
      <AnimatePresence>
        {settingsOpen ? (
          <motion.div
            className="gv-room-settings"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            data-testid="room-quick-settings"
          >
            <VibezTabChrome
              title="Quick Settings"
              onClose={() => setSettingsOpen(false)}
              closeTestId="room-quick-settings-close"
              testId="room-quick-settings-chrome"
              className="rounded-none -mx-1 mb-2 px-1"
            />
            <label>
              <span className="inline-flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" /> Volume
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => handleVolume(parseFloat(e.target.value))}
                data-testid="room-settings-volume"
              />
            </label>
            <label>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Game Speed
              </span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.25}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                data-testid="room-settings-speed"
              />
            </label>
            <p className="text-[10px] text-white/40 text-right tabular-nums">
              {speed.toFixed(2)}×
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Centered table stage */}
      <main className="gv-room-stage" data-testid="room-stage">
        <div
          className={
            nativeTable ? "gv-room-table gv-room-table--passthrough" : "gv-room-table"
          }
          data-testid="room-table"
        >
          {table}
        </div>
        {children}
      </main>

      {/* Actions above hand arc */}
      {actions ? (
        <div className="gv-room-actions" data-testid="room-actions">
          {actions}
        </div>
      ) : null}

      {/* Hand arc */}
      {hand ? (
        <div className="gv-room-hand" data-testid="room-hand">
          <div className="gv-room-hand-arc w-full">{hand}</div>
        </div>
      ) : null}

      {/* Overlay layer */}
      {overlay ? (
        <div className="gv-room-overlay" data-testid="room-overlay">
          {overlay}
        </div>
      ) : null}
    </div>
  );
}

export default GameRoomLayout;
