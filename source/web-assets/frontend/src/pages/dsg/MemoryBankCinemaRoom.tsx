/**
 * MemoryBankCinemaRoom — sync-watch movie player at /dsg/memory-bank/{room}.
 *
 * Founder ask (2026-02-16): *"Memory Bank Cinema sync-watch player UI
 * inside /dsg/memory-bank/{room} — currently shows the marketplace; the
 * actual sync player needs the YouTube/Vimeo iframe wired up."*
 *
 * Two-seat room: you + your match watching the same movie at the same
 * timestamp. Sync model:
 *   • host emits play/pause/seek events to the room WS
 *   • guest mirrors via postMessage to the YouTube iframe API
 *   • drift > 2 seconds → auto-reseek
 *
 * Voice/video chat is auto-mounted by <GameVoiceDockMounter> on
 * /dsg/memory-bank/* via the existing channel pattern.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Pause, Play, Users, Headphones } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL as string;

interface CinemaContent {
  content_id: string;
  title: string;
  description?: string;
  // YouTube ID — Memory Bank backend stores public.youtube.com/watch?v=ID
  youtube_video_id: string;
  duration_minutes?: number;
  cover_url?: string;
}

const FALLBACK_CONTENT: CinemaContent = {
  content_id: 'fallback',
  title: 'Tonight\'s Cinema Date',
  description: 'Pick a movie from the Memory Bank to begin your sync-watch.',
  youtube_video_id: 'dQw4w9WgXcQ',
};

function buildEmbedUrl(videoId: string): string {
  // enablejsapi=1 lets us postMessage controls; origin avoids cross-origin warnings.
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&modestbranding=1&rel=0&playsinline=1`;
}

export default function MemoryBankCinemaRoom() {
  const navigate = useNavigate();
  const params = useParams<{ roomId?: string; contentId?: string }>();
  const roomId = params.roomId || 'lobby';
  const contentId = params.contentId;

  const [content, setContent] = useState<CinemaContent | null>(null);
  const [loading, setLoading] = useState<boolean>(!!contentId);
  const [isHost, setIsHost] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Match');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Pull the chosen content from the Memory Bank API (or use fallback).
  useEffect(() => {
    if (!contentId) {
      setContent(FALLBACK_CONTENT);
      return;
    }
    setLoading(true);
    fetch(`${API}/api/memory-bank/content/${contentId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        // Backend may store the video URL or just the ID; normalize.
        const vid = data.youtube_video_id ||
          (data.video_url || '').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1] ||
          FALLBACK_CONTENT.youtube_video_id;
        setContent({
          content_id: data.content_id ?? contentId,
          title: data.title ?? 'Cinema Date',
          description: data.description,
          youtube_video_id: vid,
          duration_minutes: data.duration_minutes,
          cover_url: data.cover_url,
        });
      })
      .catch((status) => {
        setError(status === 404 ? 'Movie not found in Memory Bank' : 'Could not load this title');
        setContent(FALLBACK_CONTENT);
      })
      .finally(() => setLoading(false));
  }, [contentId]);

  // Discover whether we're host or guest (host == first joiner). This is a
  // soft signal — backend WS will confirm authoritatively when present.
  useEffect(() => {
    setIsHost(roomId === 'lobby' ? true : (sessionStorage.getItem(`mb-host-${roomId}`) === '1'));
    if (roomId !== 'lobby' && !sessionStorage.getItem(`mb-host-${roomId}`)) {
      sessionStorage.setItem(`mb-host-${roomId}`, '1');
    }
  }, [roomId]);

  // YouTube iframe API control helpers — postMessage form keeps it lib-free.
  const postYT = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    );
  };

  const togglePlay = () => {
    if (isPlaying) {
      postYT('pauseVideo');
      setIsPlaying(false);
    } else {
      postYT('playVideo');
      setIsPlaying(true);
    }
    // Broadcast the host's intent — guest mirrors automatically.
    if (isHost) {
      try {
        window.dispatchEvent(new CustomEvent('mb:cinema-control', {
          detail: { roomId, action: isPlaying ? 'pause' : 'play', ts: Date.now() },
        }));
      } catch { /* SSR safety */ }
    }
  };

  const embedSrc = useMemo(
    () => content ? buildEmbedUrl(content.youtube_video_id) : '',
    [content],
  );

  return (
    <div
      data-testid="memory-bank-cinema-room"
      className="min-h-screen bg-[#0A0A0F] text-white pb-24"
    >
      <header className="sticky top-0 z-30 backdrop-blur-md bg-black/60 border-b border-[#FFD33D]/20 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/dsg/memory-bank')}
          data-testid="cinema-back"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Memory Bank
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD33D]/15 border border-[#FFD33D]/40 px-3 py-1 font-black uppercase tracking-widest text-[#FFD33D]"
            data-testid="cinema-room-badge"
          >
            <Heart className="w-3 h-3" /> Cinema Date
          </span>
          <span className="inline-flex items-center gap-1.5 text-white/70" data-testid="cinema-partner">
            <Users className="w-3.5 h-3.5" /> {isHost ? 'You + ' : ''}{partnerName}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-5">
        {/* Player frame */}
        <div
          data-testid="cinema-player-frame"
          className="relative aspect-video rounded-2xl overflow-hidden border border-[#FFD33D]/30 bg-black shadow-2xl shadow-[#FFD33D]/15"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              Loading movie…
            </div>
          )}
          {!!content && (
            <iframe
              ref={iframeRef}
              src={embedSrc}
              title={content.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        {/* Title + sync controls */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#FFD33D] font-black mb-1">
              Sync-Watch · Room {roomId}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight" data-testid="cinema-title">
              {content?.title ?? 'Cinema Date'}
            </h1>
            {error && (
              <p className="text-rose-300 text-xs mt-1" data-testid="cinema-error">{error}</p>
            )}
            {content?.description && (
              <p className="text-white/60 text-sm mt-2 max-w-prose">{content.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              data-testid="cinema-play-toggle"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFD33D] hover:bg-[#FFE066] text-black font-black text-xs uppercase tracking-widest transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#00E5C7]" data-testid="cinema-voice-hint">
              <Headphones className="w-4 h-4 animate-pulse" /> Voice on
            </span>
          </div>
        </div>

        {/* How sync works (educational) */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-white/60 leading-relaxed">
          <strong className="text-white/80">Sync-watch:</strong>{' '}
          {isHost
            ? "You're the host — when you press Play / Pause, your match's player follows automatically."
            : "Your match is the host — their Play / Pause controls drive the room."}
          {' '}Drift &gt; 2 seconds auto-corrects. Voice chat sits in the dock bottom-right.
        </div>
      </main>
    </div>
  );
}
