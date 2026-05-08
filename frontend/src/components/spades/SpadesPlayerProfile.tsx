/**
 * SpadesPlayerProfile — pops up when a player taps any seat.
 *
 * For AI opponents: shows the bot's persona (name, tagline, "Practice Bot"
 * badge) + a stub win/loss record based on game-runtime state.
 * For the user's own seat: shows their real profile (via /api/users/me).
 * For real-player opponents in Live mode (future): would hit
 * /api/users/{user_id} + /api/friends/list to resolve friend status.
 *
 * The "Add Friend" action is plumbed to /api/friends/request/send. For
 * AI bots it shows a disabled "Bot · can't add friend" state.
 *
 * Matches the Vibe Wiz Premium aesthetic: emerald/amber gradient, Cinzel
 * typography, card-room feel.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Crown,
  Flame,
  Heart,
  Swords,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import type { SpadesPlayerView, SpadesPosition } from "./types";

const API = process.env.REACT_APP_BACKEND_URL;

interface Props {
  open: boolean;
  position: SpadesPosition | null;
  player: SpadesPlayerView | null;
  isYou: boolean;
  onClose: () => void;
}

interface ResolvedProfile {
  username: string;
  handle?: string;
  wins: number;
  losses: number;
  winRate: number;
  favoriteGame: string;
  bio?: string;
}

// Deterministic bot profile stub. Same bot name always yields the same
// personality / record so the UI feels consistent across games.
function botProfile(seat: SpadesPosition, name: string): ResolvedProfile {
  // Hash the name to a stable pseudo-record.
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const wins = 40 + (hash % 180);
  const losses = 30 + ((hash * 7) % 140);
  const favs = ["Spades AAA", "Bid Whist Premium", "Neon Blackjack", "Big Wheel"];
  const bios = [
    "Sharp bidder. Plays the long game.",
    "Old-school card shark. Rarely bags.",
    "Aggressive — lives for the overtrick.",
    "Defensive player. Nil specialist.",
  ];
  return {
    username: name,
    handle: `@${seat}_bot`,
    wins,
    losses,
    winRate: Math.round((wins / (wins + losses)) * 100),
    favoriteGame: favs[hash % favs.length],
    bio: bios[hash % bios.length],
  };
}

export const SpadesPlayerProfile: React.FC<Props> = ({
  open,
  position,
  player,
  isYou,
  onClose,
}) => {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<"none" | "sending" | "sent" | "error">("none");

  useEffect(() => {
    setFriendStatus("none");
    if (!open || !player || !position) {
      setProfile(null);
      return;
    }

    // Bot seat → deterministic stub.
    if (player.is_bot && !isYou) {
      setProfile(botProfile(position, player.name));
      return;
    }

    // User's own seat → fetch real profile from /api/users/me (if logged
    // in) otherwise fall back to the client-known username.
    if (isYou) {
      setLoading(true);
      authFetch(`${API}/api/users/me`)
        .then((r) => (r.ok ? r.json() : null))
        .then((me) => {
          if (me && (me.username || me.email)) {
            setProfile({
              username: me.username ?? me.email ?? player.name,
              handle: me.handle ?? me.username ?? "@you",
              wins: me.stats?.wins ?? 0,
              losses: me.stats?.losses ?? 0,
              winRate:
                me.stats?.wins !== undefined && me.stats?.losses !== undefined
                  ? Math.round(
                      (me.stats.wins / Math.max(me.stats.wins + me.stats.losses, 1)) *
                        100,
                    )
                  : 0,
              favoriteGame: me.favorite_game ?? "Spades AAA",
              bio: me.bio ?? "Welcome to the Vibez.",
            });
          } else {
            setProfile({
              username: player.name,
              handle: "@you",
              wins: 0,
              losses: 0,
              winRate: 0,
              favoriteGame: "Spades AAA",
              bio: "Welcome to the Vibez.",
            });
          }
        })
        .catch(() => {
          setProfile({
            username: player.name,
            handle: "@you",
            wins: 0,
            losses: 0,
            winRate: 0,
            favoriteGame: "Spades AAA",
            bio: "Welcome to the Vibez.",
          });
        })
        .finally(() => setLoading(false));
    }
  }, [open, player, position, isYou]);

  const handleAddFriend = async () => {
    if (!player || player.is_bot || isYou) return;
    setFriendStatus("sending");
    try {
      // Backend expects sender_id + receiver_id. For bots we no-op; this
      // branch only runs for real-player opponents in Live mode (future).
      const uid = getUserId();
      if (!uid) {
        setFriendStatus("error");
        return;
      }
      const res = await authFetch(`${API}/api/friends/request/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: uid,
          receiver_id: (player as { user_id?: string }).user_id,
        }),
      });
      setFriendStatus(res.ok ? "sent" : "error");
    } catch {
      setFriendStatus("error");
    }
  };

  const positionLabel = position?.toUpperCase() ?? "";

  return (
    <AnimatePresence>
      {open && player ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[68] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="spades-player-profile"
        >
          <motion.div
            initial={{ scale: 0.88, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-emerald-950 via-[#0a1a12] to-[#050507] border-2 border-amber-500/50 shadow-[0_0_50px_rgba(251,191,36,0.3)] overflow-hidden"
          >
            {/* Header with close */}
            <div className="relative px-5 pt-5 pb-4 text-center bg-gradient-to-b from-amber-500/10 to-transparent border-b border-amber-500/20">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 text-amber-300/60 hover:text-white transition"
                data-testid="spades-player-profile-close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Avatar + position pill */}
              <div className="relative inline-block">
                <div
                  className={`w-20 h-20 rounded-full mx-auto mb-2 flex items-center justify-center text-3xl font-black shadow-lg ${
                    player.team === "team1"
                      ? "bg-red-900/40 border-2 border-red-500 text-red-200"
                      : "bg-blue-900/40 border-2 border-blue-500 text-blue-200"
                  }`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {player.is_bot ? <Bot className="w-10 h-10" /> : player.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                {isYou ? (
                  <Crown className="absolute -top-1 -right-1 w-5 h-5 text-amber-300 drop-shadow-lg" />
                ) : null}
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 border border-amber-500/40">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {positionLabel} · {player.team === "team1" ? "RED" : "BLUE"}
                  </span>
                </div>
              </div>

              {/* Name */}
              <h2
                className="mt-2 text-xl font-black text-white"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {profile?.username ?? player.name}
              </h2>
              {profile?.handle ? (
                <p className="text-xs text-amber-300/60 font-mono">
                  {profile.handle}
                </p>
              ) : null}
              {player.is_bot && !isYou ? (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] uppercase tracking-wider font-bold text-fuchsia-200">
                  <Bot className="w-3 h-3" /> Practice Bot
                </div>
              ) : null}
            </div>

            {/* Stats grid */}
            {loading ? (
              <div className="px-5 py-8 text-center text-amber-300/60 text-sm">
                Loading profile…
              </div>
            ) : profile ? (
              <>
                <div className="px-5 py-4 grid grid-cols-3 gap-2">
                  <StatCell
                    icon={<Trophy className="w-3.5 h-3.5 text-emerald-300" />}
                    label="Wins"
                    value={profile.wins}
                    tone="emerald"
                  />
                  <StatCell
                    icon={<Swords className="w-3.5 h-3.5 text-rose-300" />}
                    label="Losses"
                    value={profile.losses}
                    tone="rose"
                  />
                  <StatCell
                    icon={<Flame className="w-3.5 h-3.5 text-amber-300" />}
                    label="Win %"
                    value={`${profile.winRate}%`}
                    tone="amber"
                  />
                </div>

                {/* Favorite game */}
                <div className="px-5 pb-3">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-950/60 border border-amber-500/20">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-amber-300/60 font-bold">
                        Favorite Game
                      </p>
                      <p
                        className="text-sm text-white font-bold"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {profile.favoriteGame}
                      </p>
                    </div>
                    <Heart className="w-5 h-5 text-rose-400" />
                  </div>
                </div>

                {profile.bio ? (
                  <div className="px-5 pb-4 text-xs text-amber-200/70 italic leading-relaxed">
                    &ldquo;{profile.bio}&rdquo;
                  </div>
                ) : null}
              </>
            ) : null}

            {/* CTA row */}
            {!isYou ? (
              <div className="px-5 pb-5">
                <button
                  onClick={handleAddFriend}
                  disabled={player.is_bot || friendStatus !== "none"}
                  className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-sm transition ${
                    player.is_bot
                      ? "bg-slate-800/70 border border-slate-600 text-slate-500 cursor-not-allowed"
                      : friendStatus === "sent"
                        ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200"
                        : friendStatus === "error"
                          ? "bg-rose-500/20 border-2 border-rose-400 text-rose-200"
                          : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                  }`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="spades-player-profile-friend-btn"
                >
                  <span className="inline-flex items-center gap-2 justify-center">
                    <UserPlus className="w-4 h-4" />
                    {player.is_bot
                      ? "Bot · Can't Add Friend"
                      : friendStatus === "sent"
                        ? "Friend Request Sent"
                        : friendStatus === "sending"
                          ? "Sending…"
                          : friendStatus === "error"
                            ? "Retry — Failed"
                            : "Add Friend"}
                  </span>
                </button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const StatCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "emerald" | "rose" | "amber";
}> = ({ icon, label, value, tone }) => {
  const palette =
    tone === "emerald"
      ? "text-emerald-300 border-emerald-400/20"
      : tone === "rose"
        ? "text-rose-300 border-rose-400/20"
        : "text-amber-300 border-amber-400/20";
  return (
    <div className={`px-2 py-2 rounded-lg bg-slate-950/60 border ${palette} text-center`}>
      <div className="flex items-center justify-center gap-1 mb-0.5">{icon}</div>
      <p
        className={`text-lg font-black tabular-nums ${palette}`}
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {value}
      </p>
      <p className="text-[8px] uppercase tracking-widest text-white/40 font-bold">
        {label}
      </p>
    </div>
  );
};

export default SpadesPlayerProfile;
