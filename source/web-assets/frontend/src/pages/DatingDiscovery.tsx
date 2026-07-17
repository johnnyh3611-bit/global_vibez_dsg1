import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Heart,
  X,
  Gamepad2,
  Sparkles,
  HeartCrack,
  Search,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { authFetch } from "@/utils/secureAuth";
import { triggerHaptic, useLongPress } from "@/hooks/useGestures";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { DiscoverCardSkeleton } from "@/components/mobile/DiscoverCardSkeleton";
import { LongPressSheet } from "@/components/mobile/LongPressSheet";
import CallButton from "@/components/voice/CallButton";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const SWIPE_THRESHOLD = 110;

export function DatingDiscovery() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [contentMatches, setContentMatches] = useState({});
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchContentMatches = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}/api/ai-content-matching/find-matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 20 }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const matchMap = {};
          data.matches.forEach((match) => {
            matchMap[match.user_id] = match;
          });
          setContentMatches(matchMap);
        }
      }
    } catch {
      // non-blocking
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const response = await authFetch(
        `${API_URL}/api/dating/discover?limit=20`,
        {}
      );

      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
        setCurrentIndex(0);
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchContentMatches();
  }, [fetchProfiles, fetchContentMatches]);

  const advance = useCallback(() => {
    setExitDir(null);
    setCurrentIndex((i) => i + 1);
  }, []);

  const handleLike = useCallback(async () => {
    if (currentIndex >= profiles.length) return;
    const currentProfile = profiles[currentIndex];
    triggerHaptic("medium");
    setExitDir("right");

    try {
      const response = await authFetch(
        `${API_URL}/api/dating/like/${currentProfile.user_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.is_match) {
          triggerHaptic("success");
          setMatchedUser(currentProfile);
          setShowMatch(true);
          setExitDir(null);
          return;
        }
      }
    } catch {
      // still advance
    }

    window.setTimeout(advance, 220);
  }, [advance, currentIndex, profiles]);

  const handlePass = useCallback(() => {
    triggerHaptic("light");
    setExitDir("left");
    window.setTimeout(advance, 220);
  }, [advance]);

  const handlePlayGame = () => {
    triggerHaptic("success");
    navigate(`/dating/matches`);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 700) {
      handleLike();
    } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -700) {
      handlePass();
    }
  };

  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useLongPress({
    onLongPress: () => setSheetOpen(true),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const currentProfile = profiles[currentIndex];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4">
        <DiscoverCardSkeleton />
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-fuchsia-500/10">
            <HeartCrack className="h-10 w-10 text-fuchsia-400" />
          </div>
          <h2 className="mb-3 text-2xl font-black text-white sm:text-3xl">
            No More Profiles
          </h2>
          <p className="mb-6 text-white/70">
            You&apos;ve seen everyone for now. Pull to refresh later, or explore
            other ways to connect.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                navigate("/find-player-2");
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-bold text-white"
            >
              <Search className="h-4 w-4" />
              Find Your Player 2
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setLoading(true);
                fetchProfiles();
              }}
              className="rounded-xl bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const profile = currentProfile.dating_profile || {};
  const avatar = currentProfile.avatar || {};

  return (
    <PullToRefresh
      className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16]"
      onRefresh={async () => {
        setLoading(true);
        await Promise.all([fetchProfiles(), fetchContentMatches()]);
      }}
    >
      <div className="flex min-h-screen items-center justify-center p-4 pb-24 pt-24">
        <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-2xl border-2 border-fuchsia-500/50 bg-black/70 px-6 py-3 backdrop-blur-xl"
          >
            <h1 className="bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-2xl font-black text-transparent">
              Discover & Play
            </h1>
          </motion.div>

          <motion.button
            type="button"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => {
              triggerHaptic("light");
              navigate("/dating/profile/setup");
            }}
            className="rounded-xl border-2 border-purple-500/50 bg-black/70 px-4 py-2 text-sm font-bold text-purple-400 transition-all hover:border-purple-500"
          >
            Edit Profile
          </motion.button>

          <motion.button
            type="button"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => {
              triggerHaptic("light");
              navigate("/dating/vibe-check");
            }}
            className="rounded-xl border-2 border-cyan-500/50 bg-black/70 px-4 py-2 text-sm font-bold text-cyan-300 transition-all hover:border-cyan-400"
            data-testid="vibe-check-entry"
          >
            Vibe check
          </motion.button>
        </div>

        <p className="fixed bottom-14 left-1/2 z-40 -translate-x-1/2 text-center text-[11px] text-white/35">
          Swipe right to like · left to pass · long-press for actions
        </p>
        <p
          data-testid="dating-age-notice"
          className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 text-center text-[10px] text-amber-200/70"
        >
          <ShieldCheck className="h-3 w-3 shrink-0" />
          Adults 18+ only ·{" "}
          <Link to="/age-verification" className="underline hover:text-amber-100">
            verify age
          </Link>
          {" · "}
          <Link to="/terms" className="underline hover:text-amber-100">
            Terms
          </Link>
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.92, opacity: 0, x: 40 }}
            animate={{
              scale: 1,
              opacity: 1,
              x:
                exitDir === "left" ? -420 : exitDir === "right" ? 420 : 0,
              rotate:
                exitDir === "left" ? -12 : exitDir === "right" ? 12 : 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
              x: exitDir === "left" ? -420 : 420,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative w-full max-w-md touch-pan-y"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{ touchAction: "pan-y" }}
          >
            <div className="relative overflow-hidden rounded-3xl border-2 border-fuchsia-500 bg-gradient-to-br from-black/80 to-black/60 shadow-2xl shadow-fuchsia-500/30 backdrop-blur-2xl">
              <div className="relative flex h-96 items-center justify-center bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30">
                {profile.photos && profile.photos[0] ? (
                  <img
                    src={profile.photos[0]}
                    alt={currentProfile.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="text-9xl">{avatar.emoji || "🎮"}</div>
                )}

                {contentMatches[currentProfile.user_id] && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute left-4 top-4 rounded-full border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 shadow-lg backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-yellow-300" />
                      <span className="text-sm font-bold text-white">
                        {
                          contentMatches[currentProfile.user_id]
                            .compatibility_score
                        }
                        % Content Match
                      </span>
                    </div>
                  </motion.div>
                )}

                <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-green-600/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Online
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <h2 className="mb-1 text-3xl font-black text-white">
                    {currentProfile.name}
                    {profile.age && `, ${profile.age}`}
                  </h2>
                  {profile.location && (
                    <p className="text-white/60">📍 {profile.location}</p>
                  )}
                </div>

                {profile.bio && (
                  <p className="mb-4 leading-relaxed text-white/80">
                    {profile.bio}
                  </p>
                )}

                {contentMatches[currentProfile.user_id]?.match_insight && (
                  <div className="mb-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 p-4 backdrop-blur-sm">
                    <p className="mb-2 text-sm font-bold text-cyan-300">
                      ✨ AI Match Insight
                    </p>
                    <p className="text-sm leading-relaxed text-white/90">
                      {contentMatches[currentProfile.user_id].match_insight}
                    </p>
                  </div>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm font-bold text-fuchsia-400">
                      💫 Interests
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest, idx) => (
                        <span
                          key={`interests-${idx}`}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-sm"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.favorite_games &&
                  profile.favorite_games.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-400">
                        <Gamepad2 className="h-4 w-4" />
                        Favorite Games
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.favorite_games.map((game, idx) => (
                          <span
                            key={game.id || `favorite_games-${idx}`}
                            className="rounded-full border border-cyan-500/30 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-3 py-1 text-xs text-cyan-300 backdrop-blur-sm"
                          >
                            {game}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handlePass}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-red-600 to-rose-600 shadow-xl shadow-red-500/50"
                aria-label="Pass"
              >
                <X className="h-8 w-8 text-white" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.15, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLike}
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-2xl shadow-cyan-500/50"
                aria-label="Like and play"
              >
                <Gamepad2 className="h-10 w-10 text-white" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleLike}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-xl shadow-fuchsia-500/50"
                aria-label="Like"
              >
                <Heart className="h-8 w-8 fill-white text-white" />
              </motion.button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-6">
              <p className="w-16 text-center text-xs text-white/40">Pass</p>
              <p className="w-20 text-center text-xs font-bold text-white/60">
                Play Game!
              </p>
              <p className="w-16 text-center text-xs text-white/40">Like</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <LongPressSheet
          open={sheetOpen}
          title={currentProfile.name}
          onClose={() => setSheetOpen(false)}
          actions={[
            {
              id: "favorite",
              label: "Save for later",
              icon: "favorite",
              onSelect: () => showToast("Saved — find them in Matches soon"),
            },
            {
              id: "share",
              label: "Share profile link",
              icon: "share",
              onSelect: async () => {
                const url = `${window.location.origin}/dating/discover`;
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: "Global Vibez Dating",
                      url,
                    });
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    showToast("Link copied");
                  }
                } catch {
                  showToast("Could not share");
                }
              },
            },
            {
              id: "report",
              label: "Report profile",
              icon: "report",
              danger: true,
              onSelect: () => {
                showToast("Thanks — we’ll review this profile");
                handlePass();
              },
            },
          ]}
        />

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-16 left-1/2 z-[130] -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMatch && matchedUser && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="relative w-full max-w-md p-8 text-center"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="mb-6 text-9xl"
                >
                  🎉
                </motion.div>

                <h2 className="mb-4 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text text-5xl font-black text-transparent">
                  It&apos;s a Match!
                </h2>
                <p className="mb-8 text-2xl text-white">
                  You and {matchedUser.name} liked each other!
                </p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <CallButton
                      userId={matchedUser.user_id}
                      displayName={matchedUser.name}
                      mediaType="video"
                      className="w-full !rounded-xl !py-3"
                    />
                    <CallButton
                      userId={matchedUser.user_id}
                      displayName={matchedUser.name}
                      mediaType="voice"
                      className="w-full !rounded-xl !py-3"
                    />
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      triggerHaptic("medium");
                      navigate(`/chat/${matchedUser.user_id}`);
                    }}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-8 py-4 text-lg font-black text-white shadow-2xl shadow-fuchsia-500/40"
                    data-testid="match-message-btn"
                  >
                    <MessageCircle className="h-6 w-6" />
                    Message
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlayGame}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-4 text-lg font-black text-white shadow-2xl shadow-cyan-500/50"
                  >
                    <Gamepad2 className="h-6 w-6" />
                    Play Game Together
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      triggerHaptic("light");
                      setShowMatch(false);
                      setCurrentIndex(currentIndex + 1);
                    }}
                    className="w-full rounded-xl border-2 border-white/20 bg-white/10 px-8 py-3 font-bold text-white backdrop-blur-sm"
                  >
                    Keep Swiping
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
