/**
 * MY VIBEZ — vertical-first short-form home.
 *
 * Opens directly into a full-screen snap loop (TikTok-style), powered by
 * the unified `/api/my-vibez` content stack:
 *   • For You  → personalized heuristic ranker (`/feed/for-you`)
 *   • Following → creators you follow (`/feed/following`)
 *
 * Create uses the same VideoRecorder → `/api/my-vibez/upload` path.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  UserPlus,
  UserCheck,
  Eye,
} from "lucide-react";
import { VideoRecorder } from "@/components/my-vibez/VideoRecorder";
import { CommentsOverlay } from "@/components/my-vibez/CommentsOverlay";
import { ShareModal } from "@/components/my-vibez/ShareModal";
import { FuturisticTabs } from "@/components/ui/futuristic-tabs";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastNotification";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type FeedTab = "for-you" | "following";

type VibezVideo = {
  video_id: string;
  video_url?: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  creator_id?: string;
  creator_name?: string;
  creator_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
  thumbnail_url?: string;
};

function formatNumber(num = 0) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function mediaSrc(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

export function MyVibez() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<FeedTab>("for-you");
  const [videos, setVideos] = useState<VibezVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showRecorder, setShowRecorder] = useState(
    () => searchParams.get("create") === "1"
  );
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [followingIds, setFollowingIds] = useState<Record<string, boolean>>({});
  const [ranker, setRanker] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const { toasts, removeToast, success, error: showError } = useToast();

  const current = videos[currentIndex];

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === "for-you"
          ? "/api/my-vibez/feed/for-you"
          : "/api/my-vibez/feed/following";
      const response = await authFetch(`${API}${endpoint}?limit=30`);
      if (!response.ok) throw new Error("Failed to fetch feed");
      const data = await response.json();
      const list: VibezVideo[] = data.videos || [];
      setVideos(list);
      setRanker(data.ranker || null);
      setCurrentIndex(0);
      if (containerRef.current) containerRef.current.scrollTop = 0;

      // Deep-link start: ?v=videoId
      const startId = searchParams.get("v");
      if (startId && list.length) {
        const idx = list.findIndex((v) => v.video_id === startId);
        if (idx >= 0) {
          setCurrentIndex(idx);
          requestAnimationFrame(() => {
            containerRef.current
              ?.querySelectorAll("[data-vibez-snap]")
              ?.[idx]?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
          });
        }
      }
    } catch {
      setVideos([]);
      setRanker(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  // Autoplay current; pause others
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return;
      if (Number(idx) === currentIndex) {
        el.muted = muted;
        void el.play().catch(() => undefined);
      } else {
        el.pause();
      }
    });
  }, [currentIndex, muted, videos]);

  // Keep the loop on /my-vibez?v=… (shareable without remounting VideoPlayer)
  useEffect(() => {
    if (!current?.video_id) return;
    const next = new URLSearchParams(searchParams);
    next.set("v", current.video_id);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [current?.video_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Engagement signal for the ranker
  useEffect(() => {
    if (!current?.video_id) return;
    const uid = localStorage.getItem("user_id");
    if (!uid) return;
    void authFetch(`${API}/api/my-vibez/feed/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: uid,
        video_id: current.video_id,
        event: "view",
        watch_pct: 0.1,
      }),
    }).catch(() => undefined);
  }, [current?.video_id]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== currentIndex && index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  };

  const toggleLike = async (video: VibezVideo) => {
    const liked = !!likedIds[video.video_id];
    try {
      const response = await authFetch(
        `${API}/api/my-vibez/video/${video.video_id}/like`,
        { method: liked ? "DELETE" : "POST" }
      );
      if (!response.ok) throw new Error("like failed");
      setLikedIds((prev) => ({ ...prev, [video.video_id]: !liked }));
      setVideos((prev) =>
        prev.map((v) =>
          v.video_id === video.video_id
            ? {
                ...v,
                likes_count: (v.likes_count || 0) + (liked ? -1 : 1),
              }
            : v
        )
      );
      if (!liked) success("Liked!");
    } catch {
      showError("Could not update like");
    }
  };

  const toggleFollow = async (video: VibezVideo) => {
    if (!video.creator_id) return;
    const following = !!followingIds[video.creator_id];
    try {
      const response = await authFetch(
        `${API}/api/my-vibez/follow/${video.creator_id}`,
        { method: following ? "DELETE" : "POST" }
      );
      if (!response.ok) throw new Error("follow failed");
      setFollowingIds((prev) => ({
        ...prev,
        [video.creator_id!]: !following,
      }));
      success(following ? "Unfollowed" : "Following!");
    } catch {
      showError("Could not update follow");
    }
  };

  const handleShare = async (video: VibezVideo) => {
    setShowShare(true);
    try {
      await authFetch(`${API}/api/my-vibez/video/${video.video_id}/share`, {
        method: "POST",
      });
      setVideos((prev) =>
        prev.map((v) =>
          v.video_id === video.video_id
            ? { ...v, shares_count: (v.shares_count || 0) + 1 }
            : v
        )
      );
    } catch {
      /* share count best-effort */
    }
  };

  return (
    <div
      className="h-[100dvh] bg-black overflow-hidden relative"
      data-testid="my-vibez-vertical-home"
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {showRecorder && (
        <VideoRecorder
          isOpen={showRecorder}
          onClose={() => {
            setShowRecorder(false);
            const next = new URLSearchParams(searchParams);
            next.delete("create");
            setSearchParams(next, { replace: true });
          }}
          onVideoUploaded={() => {
            success("Video uploaded! 🎬", "Upload Complete");
            setShowRecorder(false);
            void fetchFeed();
          }}
        />
      )}

      {current ? (
        <>
          <CommentsOverlay
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            videoId={current.video_id}
            onCommentAdded={() => {
              setVideos((prev) =>
                prev.map((v) =>
                  v.video_id === current.video_id
                    ? {
                        ...v,
                        comments_count: (v.comments_count || 0) + 1,
                      }
                    : v
                )
              );
            }}
          />
          <ShareModal
            isOpen={showShare}
            onClose={() => setShowShare(false)}
            videoId={current.video_id}
            videoTitle={current.title || "MY VIBEZ"}
          />
        </>
      ) : null}

      {/* Top chrome */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/85 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-transparent bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400 bg-clip-text truncate">
              MY VIBEZ
            </h1>
            {ranker && activeTab === "for-you" ? (
              <p className="text-[9px] uppercase tracking-wider text-white/45 font-bold">
                Ranked · {ranker}
              </p>
            ) : null}
          </div>
          <FuturisticTabs
            ariaLabel="Feed type"
            variant="pills"
            value={activeTab}
            onChange={(v) => setActiveTab(v as FeedTab)}
            className="max-w-[14rem]"
            options={[
              {
                value: "for-you",
                label: "For You",
                icon: Sparkles,
                testId: "my-vibez-tab-for-you",
              },
              {
                value: "following",
                label: "Following",
                icon: Users,
                testId: "my-vibez-tab-following",
              },
            ]}
          />
        </div>
      </div>

      {/* Snap feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        data-testid="my-vibez-snap-feed"
      >
        {loading ? (
          <div className="h-[100dvh] flex items-center justify-center text-white/70">
            Loading vibes…
          </div>
        ) : videos.length === 0 ? (
          <div
            className="h-[100dvh] flex flex-col items-center justify-center text-white px-8 text-center"
            data-testid="my-vibez-empty"
          >
            <Sparkles className="w-16 h-16 text-fuchsia-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {activeTab === "following"
                ? "No videos from people you follow"
                : "No vibes yet"}
            </h2>
            <p className="text-white/55 mb-6 max-w-xs">
              {activeTab === "following"
                ? "Follow creators, then come back here."
                : "Be the first to post — your clip lands in the For You loop."}
            </p>
            <button
              type="button"
              onClick={() => setShowRecorder(true)}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 font-bold"
              data-testid="my-vibez-empty-create"
            >
              Create Video
            </button>
          </div>
        ) : (
          videos.map((video, index) => {
            const liked = !!likedIds[video.video_id];
            const following = !!(
              video.creator_id && followingIds[video.creator_id]
            );
            return (
              <div
                key={video.video_id}
                data-vibez-snap
                data-testid={`my-vibez-snap-${index}`}
                className="h-[100dvh] w-full snap-start relative flex items-center justify-center bg-black"
              >
                {video.video_url ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[index] = el;
                    }}
                    src={mediaSrc(video.video_url)}
                    className="w-full h-full object-cover"
                    loop
                    muted={muted}
                    playsInline
                    poster={mediaSrc(video.thumbnail_url)}
                    onClick={(e) => {
                      const el = e.currentTarget;
                      if (el.paused) void el.play();
                      else el.pause();
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full bg-gradient-to-br from-fuchsia-950 via-purple-950 to-slate-950"
                    style={{
                      backgroundImage: video.thumbnail_url
                        ? `url(${mediaSrc(video.thumbnail_url)})`
                        : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/80 pointer-events-none" />

                {/* Mute */}
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="absolute top-20 right-3 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
                  aria-label={muted ? "Unmute" : "Mute"}
                  data-testid="my-vibez-mute"
                >
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                {/* Info + actions */}
                <div className="absolute bottom-24 left-0 right-0 px-4 flex items-end justify-between gap-3 z-20">
                  <div className="flex-1 min-w-0 text-white pr-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center overflow-hidden shrink-0">
                        {video.creator_avatar ? (
                          <img
                            src={video.creator_avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-bold">
                            {(video.creator_name || "?")[0]}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {video.creator_name || "Creator"}
                        </p>
                        <button
                          type="button"
                          onClick={() => void toggleFollow(video)}
                          className="text-xs font-bold text-fuchsia-300"
                        >
                          {following ? "Following" : "Follow"}
                        </button>
                      </div>
                    </div>
                    <h2 className="font-bold text-base line-clamp-2 mb-1">
                      {video.title}
                    </h2>
                    {video.description ? (
                      <p className="text-sm text-white/75 line-clamp-2 mb-1">
                        {video.description}
                      </p>
                    ) : null}
                    {video.hashtags && video.hashtags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {video.hashtags.slice(0, 5).map((tag) => (
                          <span key={tag} className="text-cyan-300 text-xs">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5 text-white/55 text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      {formatNumber(video.views_count || 0)} views
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 shrink-0 pb-2">
                    <button
                      type="button"
                      onClick={() => void toggleLike(video)}
                      className="flex flex-col items-center gap-1"
                      data-testid="my-vibez-like"
                    >
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          liked
                            ? "bg-gradient-to-br from-red-500 to-pink-600"
                            : "bg-white/10 backdrop-blur"
                        }`}
                      >
                        <Heart
                          className={`w-6 h-6 ${liked ? "fill-white text-white" : "text-white"}`}
                        />
                      </div>
                      <span className="text-white text-[10px] font-bold">
                        {formatNumber(video.likes_count || 0)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowComments(true)}
                      className="flex flex-col items-center gap-1"
                      data-testid="my-vibez-comment"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-bold">
                        {formatNumber(video.comments_count || 0)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(video)}
                      className="flex flex-col items-center gap-1"
                      data-testid="my-vibez-share"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-white text-[10px] font-bold">
                        {formatNumber(video.shares_count || 0)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFollow(video)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        following
                          ? "bg-white/10"
                          : "bg-gradient-to-br from-fuchsia-600 to-pink-600"
                      }`}
                      data-testid="my-vibez-follow"
                    >
                      {following ? (
                        <UserCheck className="w-6 h-6 text-white" />
                      ) : (
                        <UserPlus className="w-6 h-6 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create FAB */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setShowRecorder(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 flex items-center justify-center shadow-[0_0_28px_rgba(232,121,249,0.55)]"
        data-testid="my-vibez-create-fab"
        aria-label="Create video"
      >
        <Plus className="w-7 h-7 text-white" />
      </motion.button>

      {/* Optional grid escape hatch — discover */}
      <button
        type="button"
        onClick={() => navigate("/my-vibez/profile")}
        className="fixed bottom-24 right-4 z-50 px-3 py-2 rounded-full bg-black/60 border border-white/15 text-[10px] font-bold uppercase tracking-wider text-white/80"
        data-testid="my-vibez-profile-link"
      >
        Profile
      </button>
    </div>
  );
}

export default MyVibez;
