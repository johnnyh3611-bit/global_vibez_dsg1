/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 UNO PREMIUM — VIBEZ UNO PLATINUM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BLUEPRINT: /app/frontend/src/pages/games/BidWhistPremiumAAA.tsx
 *
 * This room MUST look and operate exactly like BidWhist Premium AAA, with
 * UNO rules substituted in. It reuses the exact visual language:
 *  - Celestial deep-space background + glasshouse grid
 *  - Glassmorphism oval table with cyan energy accents
 *  - Dealer anchor, compact left-rail menu, UnifiedGameMenu top-right
 *  - Pop-down player stat drawers on every seated avatar
 *  - TableCenterTimer (SVG pulse ring)
 *  - Fan-arc hand math (rotation, lift, overlap)
 *  - Cinzel headings + Outfit body
 *
 * Backend contract (Socket.IO) — unchanged:
 *   create_uno_room / join_uno_room / start_uno_game /
 *   uno_play_card / uno_draw_card / uno_call_uno / leave_uno_table
 *
 * Route: /multiplayer-uno and /multiplayer-uno/:roomCode
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import {
  ArrowLeft,
  ChevronDown,
  Crown,
  MessageSquare,
  Plus,
  Repeat,
  Settings,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import cardSoundManager from "@/utils/cardSoundManager";
import ParticleEffectsOverlay, {
  ConfettiCelebration,
} from "@/components/ParticleEffectsOverlay";
import GameChat from "@/components/bidwhist/GameChat";
import UnifiedGameMenu from "@/components/bidwhist/UnifiedGameMenu";
import OrientationGuide from "@/components/bidwhist/OrientationGuide";
import { useTournamentMode } from "@/hooks/useTournamentMode";
import TournamentBanner from "@/components/tournament/TournamentBanner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// --------------------------- Types ---------------------------
type Card = {
  id?: string;
  color: "red" | "yellow" | "green" | "blue" | "wild";
  type: "number" | "skip" | "reverse" | "draw_two" | "wild" | "wild_draw_four";
  value: string | number;
};

type Player = {
  session_id: string;
  name: string;
  hand_count?: number;
  hand?: Card[];
  has_uno?: boolean;
  is_current_turn?: boolean;
  is_active?: boolean;
};

type Table = {
  room_code: string;
  round_number: number;
  game_state: "waiting" | "playing" | "round_complete";
  play_direction: 1 | -1;
  deck_count: number;
  top_card?: Card;
  current_color?: Card["color"] | string;
  players: Player[];
  winner?: Player;
};

// --------------------------- Colors ---------------------------
// Neon jewel tones — consistent with the Platinum aesthetic.
// Flat primary colors are intentionally rejected.
const COLOR_GRADIENT: Record<string, string> = {
  red: "from-rose-600 to-rose-700",
  yellow: "from-amber-400 to-amber-500",
  green: "from-emerald-500 to-emerald-600",
  blue: "from-blue-600 to-blue-700",
  wild: "from-fuchsia-600 via-pink-600 to-orange-600",
};

// audit:allow-hex — UNO deck has canonical fixed colors (red/yellow/green/blue/wild).
// Not a theme token; these are the actual physical card colors.
const COLOR_HEX: Record<string, string> = {
  red: "#e11d48",     // audit:allow-hex
  yellow: "#f59e0b",  // audit:allow-hex
  green: "#10b981",   // audit:allow-hex
  blue: "#2563eb",    // audit:allow-hex
  wild: "#a855f7",    // audit:allow-hex
};

const COLOR_GLOW: Record<string, string> = {
  red: "shadow-[0_0_18px_rgba(225,29,72,0.55)]",
  yellow: "shadow-[0_0_18px_rgba(245,158,11,0.55)]",
  green: "shadow-[0_0_18px_rgba(16,185,129,0.55)]",
  blue: "shadow-[0_0_18px_rgba(37,99,235,0.55)]",
  wild: "shadow-[0_0_18px_rgba(168,85,247,0.55)]",
};

// ============================================
// UNO FACE CARD (keeps gameplay semantics)
// ============================================
function UnoFaceCard({
  card,
  onClick,
  selectable = false,
  size = "md",
  testid,
}: {
  card: Card;
  onClick?: () => void;
  selectable?: boolean;
  size?: "sm" | "md" | "lg";
  testid?: string;
}) {
  const dims =
    size === "sm" ? "w-14 h-20" : size === "lg" ? "w-24 h-36" : "w-20 h-32";
  const numFont =
    size === "sm" ? "text-3xl" : size === "lg" ? "text-6xl" : "text-5xl";
  const iconSize =
    size === "sm" ? "w-5 h-5" : size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const icon =
    card.type === "skip" ? (
      <SkipForward className={iconSize} />
    ) : card.type === "reverse" ? (
      <Repeat className={iconSize} />
    ) : card.type === "draw_two" || card.type === "wild_draw_four" ? (
      <Plus className={iconSize} />
    ) : null;

  return (
    <motion.button
      type="button"
      onClick={selectable ? onClick : undefined}
      whileHover={selectable ? { scale: 1.08, y: -10 } : {}}
      whileTap={selectable ? { scale: 0.94 } : {}}
      disabled={!selectable}
      data-testid={testid}
      className={[
        dims,
        "relative overflow-hidden rounded-xl border-[3px] border-white/90 shadow-2xl",
        "bg-gradient-to-br",
        COLOR_GRADIENT[card.color] || "from-slate-600 to-slate-700",
        COLOR_GLOW[card.color] || "",
        selectable ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      aria-label={`${card.color} ${card.type} ${card.value}`}
    >
      {/* Oval inlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={[
            "bg-white/95 rounded-full",
            size === "sm" ? "w-10 h-14" : size === "lg" ? "w-16 h-24" : "w-14 h-20",
            "-rotate-[22deg]",
          ].join(" ")}
        />
      </div>
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center">
        {card.type === "number" ? (
          <span
            className={[
              numFont,
              "font-black drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]",
              "bg-gradient-to-br",
              COLOR_GRADIENT[card.color],
              "bg-clip-text text-transparent",
            ].join(" ")}
          >
            {card.value}
          </span>
        ) : (
          <span
            className={[
              "bg-gradient-to-br",
              COLOR_GRADIENT[card.color],
              "bg-clip-text text-transparent",
              "drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]",
            ].join(" ")}
          >
            {icon}
          </span>
        )}
        {card.type !== "number" && (
          <span
            className={[
              "mt-1 text-[10px] font-bold uppercase tracking-widest",
              "bg-gradient-to-br",
              COLOR_GRADIENT[card.color],
              "bg-clip-text text-transparent",
            ].join(" ")}
          >
            {String(card.value).replace("_", " ")}
          </span>
        )}
      </div>
      {card.type === "number" && (
        <>
          <span className="absolute top-1 left-1.5 text-xs font-black text-white drop-shadow">
            {card.value}
          </span>
          <span className="absolute bottom-1 right-1.5 text-xs font-black text-white rotate-180 drop-shadow">
            {card.value}
          </span>
        </>
      )}
    </motion.button>
  );
}

// ============================================
// UNO CARD BACK
// ============================================
function UnoBack({ count, size = "md" }: { count?: number; size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "sm" ? "w-12 h-16" : size === "lg" ? "w-24 h-36" : "w-16 h-24";
  return (
    <div
      className={[
        dims,
        "relative rounded-xl border-[3px] border-white/80 shadow-2xl",
        "bg-gradient-to-br from-slate-900 via-slate-800 to-black",
      ].join(" ")}
    >
      <div className="absolute inset-1 rounded-lg bg-[radial-gradient(circle,rgba(34,211,238,0.18)_0%,transparent_70%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black italic tracking-tighter text-2xl text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]">
          UNO
        </span>
      </div>
      {typeof count === "number" && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-cyan-500 border-2 border-slate-950 text-[11px] font-black text-slate-950 flex items-center justify-center">
          {count}
        </div>
      )}
    </div>
  );
}

// ============================================
// TABLE CENTER TIMER — SVG Pulse Ring (from BidWhist Premium)
// ============================================
const TableCenterTimer = ({
  timeLeft,
  totalTime = 20,
  isActive,
}: {
  timeLeft: number;
  totalTime?: number;
  isActive: boolean;
}) => {
  const strokeDash = (timeLeft / totalTime) * 565;
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 pointer-events-none">
      <svg className="w-56 h-56 md:w-64 md:h-64 transform -rotate-90">
        <circle
          cx="128"
          cy="128"
          r="90"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="8"
          fill="transparent"
        />
        {isActive && (
          <circle
            cx="128"
            cy="128"
            r="90"
            stroke={timeLeft < 5 ? "#ef4444" : "#22d3ee"} /* audit:allow-hex (timer warning red, brand cyan) */
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="565"
            strokeDashoffset={565 - strokeDash}
            className="transition-all duration-1000 ease-linear"
          />
        )}
      </svg>
    </div>
  );
};

// ============================================
// PLAYER NODE — Compact Avatar with Pop-Down Stats (cyan theme)
// ============================================
type SeatPosition = "north" | "south" | "east" | "west";

const UnoPlayerNode = ({
  player,
  position,
  isTurn,
  isMe,
  onClick,
}: {
  player: Player | null;
  position: SeatPosition;
  isTurn: boolean;
  isMe: boolean;
  onClick?: (pos: SeatPosition, p: Player | null) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const positions: Record<SeatPosition, string> = {
    north: "top-[-60px] left-1/2 -translate-x-1/2",
    south: "bottom-[-60px] left-1/2 -translate-x-1/2 scale-110",
    east: "right-[-80px] top-1/2 -translate-y-1/2",
    west: "left-[-80px] top-1/2 -translate-y-1/2",
  };
  const handCount = player?.hand_count ?? player?.hand?.length ?? 0;

  return (
    <div
      className={`absolute ${positions[position]} z-30 flex flex-col items-center`}
      data-testid={`uno-seat-${position}`}
    >
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          onClick && onClick(position, player);
        }}
        data-testid={`uno-player-node-${position}`}
        className={`group relative z-20 flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-full border-2 transition-all duration-500 ${
          isTurn
            ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.5)] scale-110"
            : "border-white/10 bg-black/60"
        }`}
      >
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-gray-700 to-black border-2 border-white/20 overflow-hidden flex items-center justify-center">
          <span className="text-white text-xl font-bold font-['Cinzel']">
            {(player?.name || position)?.[0]?.toUpperCase()}
          </span>
        </div>
        <div className="pr-2 md:pr-4 text-left flex items-center gap-2">
          {isMe && <Crown className="w-3 h-3 text-cyan-400" />}
          <div>
            <div
              className={`text-xs md:text-sm font-['Cinzel'] font-bold uppercase tracking-tight ${
                isTurn ? "text-cyan-300" : "text-white/90"
              }`}
            >
              {player?.name || "Empty"}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] text-white/40">Cards:</span>
              <span className="text-[10px] font-bold text-cyan-400 font-mono">
                {handCount}
              </span>
              {player?.has_uno && (
                <span className="ml-1 px-1 rounded-full bg-cyan-500/90 text-slate-950 text-[9px] font-black tracking-widest">
                  UNO!
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            size={12}
            className={`transition-transform text-white/50 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Pop-down stats drawer */}
      <div
        className={`absolute top-full left-0 w-full mt-2 transition-all duration-300 origin-top overflow-hidden ${
          isOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-3 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold tracking-widest text-white/40">
            <div>Cards</div>
            <div className="text-right text-cyan-400 font-mono">{handCount}</div>
            <div>Position</div>
            <div className="text-right text-cyan-400 capitalize">{position}</div>
            <div>Status</div>
            <div
              className={`text-right ${
                isTurn ? "text-cyan-400" : "text-green-400"
              }`}
            >
              {isTurn ? "Turn" : "Active"}
            </div>
            <div>UNO</div>
            <div className="text-right text-white">
              {player?.has_uno ? "Called" : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DEALER ANCHOR — Stationary chip rack (copied from BidWhist AAA)
// ============================================
const DealerAnchor = ({ dealerName = "Nova" }: { dealerName?: string }) => (
  <div className="absolute -top-40 flex flex-col items-center z-20">
    <div className="px-4 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] font-black tracking-[0.3em] text-cyan-400 mb-2 uppercase font-['Cinzel']">
      Dealer: {dealerName}
    </div>
    <div className="w-48 md:w-64 h-12 md:h-16 bg-gradient-to-b from-[#1a1a1c] to-[#0a0a0c] rounded-b-3xl border-x border-b border-white/10 shadow-2xl flex justify-center gap-2 md:gap-3 items-center px-4 md:px-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="w-5 h-6 md:w-6 md:h-8 bg-black/40 border border-white/5 rounded-sm flex flex-col-reverse gap-0.5 p-0.5"
        >
          <div className="h-1 w-full bg-cyan-500/40 rounded-full shadow-[0_0_5px_cyan]" />
          <div className="h-1 w-full bg-cyan-500/20 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// MENU BUTTON — Compact left-rail (copied from BidWhist AAA)
// ============================================
const MenuButton = ({
  icon,
  onClick,
  active,
  testid,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  testid?: string;
}) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`p-2 md:p-3 border rounded-xl md:rounded-2xl transition-all shadow-lg ${
      active
        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
        : "bg-white/5 border-white/10 text-white/60 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50"
    }`}
  >
    {icon}
  </button>
);

// ============================================
// WILD COLOR PICKER — Frosted glass + jewel orbs
// ============================================
const WildColorPicker = ({
  onPick,
  onClose,
}: {
  onPick: (c: Card["color"]) => void;
  onClose: () => void;
}) => {
  const options: Array<{ key: Card["color"]; label: string }> = [
    { key: "red", label: "Red" },
    { key: "yellow", label: "Yellow" },
    { key: "green", label: "Green" },
    { key: "blue", label: "Blue" },
  ];
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="uno-color-picker"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.25)] p-6 w-full max-w-md"
      >
        <button
          onClick={onClose}
          aria-label="Close color picker"
          data-testid="uno-color-picker-close"
          className="absolute top-3 right-3 p-1 rounded-full text-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-2xl font-['Cinzel'] font-bold text-cyan-300 text-center mb-1">
          Choose a Color
        </h2>
        <p className="text-center text-white/60 text-sm mb-6">
          The next player must match this color.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => onPick(o.key)}
              className={[
                "relative h-24 rounded-2xl border border-white/20 bg-gradient-to-br",
                COLOR_GRADIENT[o.key],
                COLOR_GLOW[o.key],
                "transition-transform hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
              ].join(" ")}
              data-testid={`uno-color-${o.key}`}
              aria-label={`Choose ${o.label}`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-white font-['Cinzel'] font-bold text-lg tracking-widest uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {o.label}
              </span>
              <span className="absolute inset-2 rounded-xl border border-white/30 pointer-events-none" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// UNO STATS PANEL (glass shell matching BidWhist GameStatsPanel)
// ============================================
const UnoGameStatsPanel = ({ table }: { table: Table }) => {
  const active = table.players.filter((p) => p.is_active !== false).length;
  const stats = [
    { label: "Round", value: `#${table.round_number || 1}` },
    { label: "Players", value: `${active}`.padStart(1, "0") },
    { label: "Deck", value: String(table.deck_count) },
    { label: "Direction", value: table.play_direction === 1 ? "CW" : "CCW" },
    { label: "Color", value: String(table.current_color || "—").toUpperCase() },
    { label: "Phase", value: table.game_state.replace("_", " ").toUpperCase() },
  ];
  return (
    <div
      className="h-full bg-slate-950/80 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 shadow-2xl overflow-y-auto"
      data-testid="uno-stats-panel"
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <Zap className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-['Cinzel'] font-bold tracking-[0.3em] text-cyan-300 uppercase">
          Game Stats
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/5 rounded-lg p-2">
            <div className="text-white/40 text-[10px] uppercase tracking-wider">
              {s.label}
            </div>
            <div className="text-white text-lg font-bold font-mono">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/10">
        <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">
          Seats
        </div>
        <ul className="space-y-1.5">
          {table.players.map((p) => (
            <li
              key={p.session_id}
              className={`flex items-center justify-between text-xs rounded-md px-2 py-1 ${
                p.is_current_turn
                  ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                  : "text-white/70"
              }`}
            >
              <span className="truncate max-w-[120px]">{p.name}</span>
              <span className="font-mono font-bold text-cyan-400">
                {p.hand_count ?? p.hand?.length ?? 0}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT — VIBEZ UNO PLATINUM
// ============================================
export default function UnoPremium() {
  const safeTimeout = useSafeTimeout();
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const tournament = useTournamentMode();

  // Connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState<Table | null>(null);
  const [playerName] = useState(localStorage.getItem("username") || "Player");
  const [mySessionId, setMySessionId] = useState<string | null>(null);

  // Uno-specific UI state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildIndex, setPendingWildIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] =
    useState<{ x: number; y: number; color: string } | null>(null);

  // Shared HUD state (mirrors BidWhist Premium)
  const [showChat, setShowChat] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showStats, setShowStats] = useState(false);
  // Universal 10-second Shot Clock (Universal Design Agent v2 §2). UNO
  // historically used 20s; the PDF mandates 10s across every multiplayer
  // room so cadence matches Whist / Spades / 654.
  const [turnTimeLeft, setTurnTimeLeft] = useState(10);

  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------- Socket wiring (preserved) ----------------
  useEffect(() => {
    const sock = io(API_URL as string, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
    });

    sock.on("connect", () => {
      setConnected(true);
      setMySessionId(sock.id ?? null);
      if (roomCode) {
        sock.emit("join_uno_room", { room_code: roomCode, player_name: playerName });
      } else {
        sock.emit("create_uno_room", { player_name: playerName });
      }
    });

    sock.on(
      "uno_table_created",
      (data: { success: boolean; table: Table; room_code: string }) => {
        if (data.success) {
          setTable(data.table);
          navigate(`/multiplayer-uno/${data.room_code}`, { replace: true });
        }
      }
    );

    sock.on("uno_state_update", (data: { table: Table }) => setTable(data.table));

    sock.on("error", (data: { message?: string }) => {
      const msg = data?.message || "Something went wrong";
      setError(msg);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(""), 4500);
    });

    sock.on("disconnect", () => setConnected(false));
    setSocket(sock);
    return () => {
      sock.close();
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  // ---------------- Derived ----------------
  const myPlayer = useMemo(() => {
    if (!table || !mySessionId) return null;
    return table.players.find((p) => p.session_id === mySessionId) || null;
  }, [table, mySessionId]);

  const opponents = useMemo(() => {
    if (!table || !mySessionId) return [] as Player[];
    return table.players.filter(
      (p) => p.session_id !== mySessionId && p.is_active !== false
    );
  }, [table, mySessionId]);

  const isMyTurn = !!(
    myPlayer?.is_current_turn && table?.game_state === "playing"
  );

  // Reset/arm turn timer whenever it becomes my turn (10s shot clock)
  useEffect(() => {
    if (isMyTurn) setTurnTimeLeft(10);
  }, [isMyTurn, table?.players.find((p) => p.is_current_turn)?.session_id]);

  useEffect(() => {
    if (!isMyTurn) return;
    if (turnTimeLeft <= 0) {
      // Universal Design Agent §2 auto-action: try a valid play first,
      // otherwise draw. Keeps the table moving on idle hand-stalls.
      if (!socket || !myPlayer?.hand) return;
      const top = table?.discard_top;
      const findPlayable = (): number | null => {
        if (!myPlayer.hand || !top) return null;
        const wildIdx = myPlayer.hand.findIndex(
          (c) => c.color === "wild" || c.value === "wild" || c.value === "wild_draw_four",
        );
        const matchIdx = myPlayer.hand.findIndex(
          (c) => c.color === top.color || c.value === top.value,
        );
        if (matchIdx >= 0) return matchIdx;
        if (wildIdx >= 0) return wildIdx;
        return null;
      };
      const idx = findPlayable();
      if (idx !== null) {
        socket.emit("uno_play_card", { card_index: idx, color_choice: "red" });
      } else {
        socket.emit("uno_draw_card", {});
      }
      return;
    }
    const t = setInterval(() => setTurnTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [isMyTurn, turnTimeLeft, socket, myPlayer, table?.discard_top]);

  // Seat mapping: me at SOUTH, opponents fill west → north → east in turn order.
  const opponentSeats: SeatPosition[] = useMemo(() => {
    switch (opponents.length) {
      case 1:
        return ["north"];
      case 2:
        return ["west", "east"];
      case 3:
      default:
        return ["west", "north", "east"];
    }
  }, [opponents.length]);

  // ---------------- Handlers ----------------
  const startGame = () => socket?.emit("start_uno_game", {});

  const drawCard = () => {
    if (!isMyTurn || !socket) return;
    cardSoundManager.playCardSlam();
    socket.emit("uno_draw_card", {});
  };

  const playCardAtIndex = (cardIndex: number) => {
    if (!myPlayer?.hand || !socket || !isMyTurn) return;
    const card = myPlayer.hand[cardIndex];
    if (!card) return;
    cardSoundManager.playCardSlam();
    setParticleTrigger({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: COLOR_HEX[card.color] || "#22d3ee", // audit:allow-hex (brand-cyan particle fallback)
    });
    safeTimeout(() => setParticleTrigger(null), 120);
    if (card.type === "wild" || card.type === "wild_draw_four") {
      setPendingWildIndex(cardIndex);
      setShowColorPicker(true);
    } else {
      socket.emit("uno_play_card", { card_index: cardIndex });
    }
  };

  const pickWildColor = (color: Card["color"]) => {
    if (socket && pendingWildIndex !== null) {
      socket.emit("uno_play_card", {
        card_index: pendingWildIndex,
        chosen_color: color,
      });
    }
    setShowColorPicker(false);
    setPendingWildIndex(null);
  };

  const callUno = () => {
    if (!socket) return;
    socket.emit("uno_call_uno", {});
    cardSoundManager.playWinSound();
    setShowConfetti(true);
    safeTimeout(() => setShowConfetti(false), 2500);
  };

  const leaveTable = () => {
    socket?.emit("leave_uno_table", {});
    navigate("/games");
  };

  // ---------------- Tournament submission (on round end) ----------------
  useEffect(() => {
    if (!tournament.active || !table) return;
    if (tournament.submitted || tournament.submitting) return;
    if (table.game_state !== "round_complete") return;
    tournament.submitScore({
      winner: table.winner?.name,
      round: table.round_number,
      my_hand_remaining: myPlayer?.hand?.length ?? 0,
      won: table.winner?.session_id === mySessionId,
    });
  }, [table, tournament, myPlayer, mySessionId]);

  // ---------------- Loading ----------------
  if (!connected || !table) {
    return (
      <div
        className="fixed inset-0 bg-[#050507] flex items-center justify-center"
        data-testid="uno-connecting"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin mx-auto mb-4" /> {/* audit:allow-animate */}
          <div className="text-cyan-300 font-['Cinzel']">
            {connected ? "Loading Vibez UNO Platinum…" : "Connecting to UNO server…"}
          </div>
        </div>
      </div>
    );
  }

  const activeCount = table.players.filter((p) => p.is_active !== false).length;
  const canStart = table.game_state === "waiting" && activeCount >= 2;

  // Map each opponent to a cardinal seat. My seat is always SOUTH.
  const seatAssignments: Array<{ pos: SeatPosition; player: Player | null; isMe: boolean }> = [
    { pos: "south", player: myPlayer, isMe: true },
    ...opponents.map((opp, i) => ({
      pos: opponentSeats[i] || "north",
      player: opp,
      isMe: false,
    })),
  ];

  return (
    <div
      className="relative min-h-screen w-full bg-[#050507] overflow-hidden flex items-center justify-center font-sans text-white"
      data-testid="uno-premium-root"
    >
      {tournament.active && <TournamentBanner {...tournament} />}

      {/* ====================================== */}
      {/* LAYER 1: CELESTIAL ENVIRONMENT          */}
      {/* ====================================== */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 via-black to-blue-900/10" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ====================================== */}
      {/* LAYER 2: THE ARENA (Dealer + Table)     */}
      {/* ====================================== */}
      <div className="relative z-10 flex flex-col items-center scale-75 md:scale-90 lg:scale-100">
        <DealerAnchor dealerName="Nova" />

        {/* GLASS OVAL TABLE */}
        <div
          className="relative w-[900px] h-[500px] md:w-[1000px] md:h-[550px] bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[220px] md:rounded-[240px] shadow-[0_0_120px_rgba(0,0,0,0.9)] flex items-center justify-center"
          data-testid="uno-table"
        >
          {/* Inner felt */}
          <div className="absolute inset-4 md:inset-6 rounded-[200px] md:rounded-[220px] bg-[#0c0c0e] border border-white/5 overflow-hidden shadow-inner">
            {/* Subtle carbon texture */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
              }}
            />

            {/* Center pulse-ring timer (active on my turn) */}
            <TableCenterTimer
              timeLeft={turnTimeLeft}
              totalTime={20}
              isActive={isMyTurn}
            />

            {/* Center play area: draw | direction | top card */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="flex items-center gap-6 pointer-events-auto">
                {/* Draw pile */}
                <button
                  onClick={drawCard}
                  disabled={!isMyTurn}
                  className={[
                    "group relative rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition",
                    isMyTurn
                      ? "hover:scale-105 cursor-pointer shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                      : "opacity-75 cursor-not-allowed",
                  ].join(" ")}
                  title={isMyTurn ? "Draw a card" : "Not your turn"}
                  data-testid="uno-draw-pile"
                  aria-label={`Draw card — ${table.deck_count} left`}
                >
                  <UnoBack size="lg" />
                  <div className="mt-2 text-center text-[10px] font-['Cinzel'] uppercase tracking-[0.3em] text-cyan-300">
                    Draw · {table.deck_count}
                  </div>
                </button>

                {/* Direction */}
                <motion.div
                  animate={{ rotate: table.play_direction === 1 ? 360 : -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="w-10 h-10 rounded-full border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-2xl bg-slate-950/40"
                  title={table.play_direction === 1 ? "Clockwise" : "Counter-clockwise"}
                  data-testid="uno-direction"
                >
                  {table.play_direction === 1 ? "↻" : "↺"}
                </motion.div>

                {/* Top card / discard pile */}
                {table.top_card && (
                  <div className="flex flex-col items-center">
                    <motion.div
                      key={`${table.top_card.color}-${table.top_card.value}-${table.round_number}`}
                      initial={{ rotate: -20, scale: 0.8, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      data-testid="uno-discard-pile"
                    >
                      <UnoFaceCard card={table.top_card} size="lg" testid="uno-top-card" />
                    </motion.div>
                    {table.current_color &&
                      table.current_color !== table.top_card.color && (
                        <div
                          className={[
                            "mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest",
                            "bg-gradient-to-r",
                            COLOR_GRADIENT[table.current_color as string] ||
                              "from-slate-500 to-slate-600",
                            "text-white border border-white/20",
                          ].join(" ")}
                          data-testid="uno-current-color"
                        >
                          Color · {table.current_color}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PLAYER NODES — seat assignments */}
          {seatAssignments.map(({ pos, player, isMe }) => (
            <UnoPlayerNode
              key={`${pos}-${player?.session_id || "empty"}`}
              player={player}
              position={pos}
              isTurn={!!player?.is_current_turn && table.game_state === "playing"}
              isMe={isMe}
            />
          ))}
        </div>
      </div>

      {/* ====================================== */}
      {/* LAYER 3: UNIFIED GAME MENU (TOP-RIGHT)  */}
      {/* ====================================== */}
      <div className="absolute right-4 md:right-6 top-4 z-50">
        <UnifiedGameMenu
          gameId={table.room_code}
          onLeave={leaveTable}
          onOpenChat={() => setShowChat(!showChat)}
          unreadMessages={unreadMessages}
        />
      </div>

      {/* ====================================== */}
      {/* LAYER 3: COMPACT LEFT RAIL              */}
      {/* ====================================== */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 md:gap-4 z-50">
        <MenuButton
          icon={<ArrowLeft size={18} />}
          onClick={leaveTable}
          testid="uno-back-btn"
        />
        <MenuButton
          icon={<Settings size={18} />}
          onClick={() => setShowStats(!showStats)}
          active={showStats}
          testid="uno-stats-btn"
        />
        <MenuButton
          icon={<MessageSquare size={18} />}
          onClick={() => setShowChat(!showChat)}
          active={showChat}
          testid="uno-chat-btn"
        />
        <MenuButton icon={<Trophy size={18} />} testid="uno-trophy-btn" />
      </div>

      {/* ====================================== */}
      {/* TOP HUD: Room code + round              */}
      {/* ====================================== */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 bg-slate-950/60 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-2">
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.3em] text-white/40">
            Room
          </div>
          <div
            className="font-mono text-lg font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
            data-testid="uno-room-code"
          >
            {table.room_code}
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.3em] text-white/40">
            Round
          </div>
          <div
            className="font-['Cinzel'] text-lg font-black text-cyan-400"
            data-testid="uno-round"
          >
            #{table.round_number || 1}
          </div>
        </div>
      </div>

      {/* ====================================== */}
      {/* ERROR TOAST                              */}
      {/* ====================================== */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-red-600/90 border border-red-300 text-white text-sm font-semibold shadow-xl"
            data-testid="uno-error"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================== */}
      {/* FAN-ARC HAND (same math as BidWhist)     */}
      {/* ====================================== */}
      {myPlayer?.hand && myPlayer.hand.length > 0 && (
        <div
          className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-6xl px-4"
          data-testid="uno-my-hand-container"
        >
          <div className="text-center mb-2">
            <h3 className="text-sm md:text-base font-['Cinzel'] text-cyan-300">
              Your Hand
            </h3>
            {!isMyTurn && (
              <p className="text-[10px] text-white/40">Waiting for your turn…</p>
            )}
          </div>

          <div
            className="flex justify-center items-end -mt-8 md:-mt-12"
            style={{ paddingBottom: 10 }}
            data-testid="uno-my-hand"
          >
            {myPlayer.hand.map((card, idx) => {
              const total = myPlayer.hand!.length;
              const centerIdx = (total - 1) / 2;
              const offset = idx - centerIdx;
              const rotation = offset * 4;
              const verticalLift = Math.abs(offset) * 3;
              return (
                <motion.div
                  key={`hand-${idx}`}
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={
                    isMyTurn
                      ? { y: -30, scale: 1.15, zIndex: 100, transition: { duration: 0.2 } }
                      : {}
                  }
                  className={isMyTurn ? "cursor-pointer" : "cursor-not-allowed"}
                  style={{
                    marginLeft: idx === 0 ? 0 : "-50px",
                    transform: `rotate(${rotation}deg) translateY(${verticalLift}px)`,
                    transformOrigin: "bottom center",
                    zIndex: idx,
                  }}
                >
                  <UnoFaceCard
                    card={card}
                    onClick={() => playCardAtIndex(idx)}
                    selectable={isMyTurn}
                    testid={`uno-hand-card-${idx}`}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Floating UNO-call button — frosted glass + cyan glow */}
          {myPlayer.hand.length === 1 && !myPlayer.has_uno && (
            <div className="mt-3 flex justify-center">
              <motion.button
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                onClick={callUno}
                className="px-8 py-3 rounded-2xl font-['Cinzel'] font-black text-xl tracking-[0.4em] uppercase text-cyan-200 bg-slate-950/70 backdrop-blur-xl border border-cyan-400/60 shadow-[0_0_40px_rgba(34,211,238,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                data-testid="uno-call-btn"
              >
                Call UNO!
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* ====================================== */}
      {/* WAITING PANEL                            */}
      {/* ====================================== */}
      {table.game_state === "waiting" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-6 py-4 bg-slate-950/85 border border-cyan-500/30 rounded-2xl backdrop-blur-xl shadow-[0_0_60px_rgba(34,211,238,0.2)] text-center"
          data-testid="uno-waiting-panel"
        >
          <div className="flex items-center gap-2 justify-center text-cyan-300 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm font-['Cinzel'] font-bold uppercase tracking-widest">
              Waiting · {activeCount} / 4
            </span>
          </div>
          <div className="text-xs text-white/60 mb-3">
            Share room code{" "}
            <span className="font-mono font-bold text-cyan-300">
              {table.room_code}
            </span>{" "}
            with friends.
          </div>
          {canStart && (
            <button
              onClick={startGame}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-['Cinzel'] font-bold uppercase tracking-widest text-sm shadow-lg shadow-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              data-testid="uno-start-btn"
            >
              Start Game
            </button>
          )}
          {/* AI-Bot fallback — fills empty seats with bots and starts the game
              so the user can SEE actual UNO gameplay without waiting for 3
              more humans. Backend handler: 'uno_fill_with_bots'. */}
          <div className="mt-3">
            <button
              onClick={() => socket?.emit('uno_fill_with_bots', {})}
              className="text-xs text-cyan-200 hover:text-cyan-100 underline underline-offset-4 decoration-cyan-400/40"
              data-testid="uno-fill-bots-btn"
            >
              🤖 Fill empty seats with AI bots
            </button>
          </div>
        </motion.div>
      )}

      {/* ====================================== */}
      {/* WINNER / ROUND COMPLETE                  */}
      {/* ====================================== */}
      <AnimatePresence>
        {table.game_state === "round_complete" && table.winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
            data-testid="uno-winner-panel"
          >
            <div className="relative bg-slate-950/90 backdrop-blur-xl border border-cyan-500/40 rounded-3xl p-8 text-center max-w-md shadow-[0_0_80px_rgba(34,211,238,0.25)]">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 border-4 border-white/90 shadow-xl flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <h2 className="mt-4 text-3xl font-['Cinzel'] font-black text-cyan-300 flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-300" />
                {table.winner.name} wins!
              </h2>
              <p className="text-white/60 mt-2 text-sm">
                Round {table.round_number} complete.
              </p>
              <div className="mt-5 flex gap-3 justify-center">
                <button
                  onClick={startGame}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-['Cinzel'] font-bold uppercase tracking-widest text-sm shadow-lg shadow-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  data-testid="uno-next-round-btn"
                >
                  Next Round
                </button>
                <button
                  onClick={leaveTable}
                  className="px-5 py-2 rounded-lg bg-slate-800 text-white/80 font-['Cinzel'] font-bold uppercase tracking-widest text-sm border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  data-testid="uno-back-to-lobby-btn"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================== */}
      {/* CHAT + STATS SIDE PANELS                 */}
      {/* ====================================== */}
      {showChat && (
        <div className="fixed right-4 top-24 bottom-20 w-80 z-50">
          <GameChat
            gameId={table.room_code}
            playerName={playerName}
            socket={socket}
            onClose={() => setShowChat(false)}
            onNewMessage={() => setUnreadMessages((v) => v + 1)}
          />
        </div>
      )}

      {showStats && (
        <div className="fixed left-4 top-24 bottom-20 w-80 z-50">
          <UnoGameStatsPanel table={table} />
        </div>
      )}

      {/* ====================================== */}
      {/* OVERLAYS                                 */}
      {/* ====================================== */}
      {showColorPicker && (
        <WildColorPicker
          onPick={pickWildColor}
          onClose={() => {
            setShowColorPicker(false);
            setPendingWildIndex(null);
          }}
        />
      )}

      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
      <ConfettiCelebration active={showConfetti} />

      {/* Orientation guide for mobile */}
      <OrientationGuide />
    </div>
  );
}
