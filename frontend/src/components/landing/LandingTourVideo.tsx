/**
 * LandingTourVideo — 79-second cinematic tour of GLOBAL VIBEZ DSG that
 * sits on the public landing page directly below the DSG VIBE TV pillar.
 *
 * Founder directive 2026-05-09:
 *   "Just your voice talking, showing different pictures. People who
 *    don't scroll need a surplus they can hit and learn everything."
 *
 * Implementation
 *   • The 4 founder-uploaded MP4 clips loop in the background (muted).
 *   • An OpenAI-TTS Onyx-voiced narration MP3 plays as the master
 *     soundtrack — pre-rendered to /landing-tour-narration.mp3 by
 *     `backend/scripts/generate_landing_tour_narration.py`.
 *   • Browsers block autoplay-with-sound, so we render a big PLAY
 *     CTA overlay until the user clicks. The narration becomes the
 *     authoritative timeline; clip cycles independently.
 *   • Controls: play/pause · mute · restart · captions toggle.
 *   • Captions are synchronised with the narration timeline so
 *     scroll-shy visitors who skim can still read the pitch.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Captions, Sparkles, Download } from "lucide-react";

// 4 founder-uploaded promo clips, looped in this order.
const CLIPS: string[] = [
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/aeaebfxp_e_c_a_d_d_db_c_e_videomp_.mp4",
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/8s795ybg_mp_%20%281%29.mp4",
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/n612sxdb__The_video_will_be_available_for_hours.mp4",
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/p21nztqq_mp_.mp4",
];

const NARRATION_SRC = "/landing-tour-narration.mp3";

// Caption track synced to the narration timeline (Onyx · 1.0× · ~122s).
// Times in seconds; tweak after the founder reviews the rendered MP3.
type Cue = { t: number; text: string };
const CAPTIONS: Cue[] = [
  { t:   0.0, text: "GLOBAL VIBEZ DSG." },
  { t:   3.0, text: "The world's first sovereign infrastructure network — built on Solana — where every interaction earns." },
  { t:  13.0, text: "Six utility rooms · one currency · a real economy you actually own." },
  { t:  22.0, text: "30+ AAA card rooms — Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy." },
  { t:  33.0, text: "Neon casino floor — chess, Vibez 6-5-4, baccarat, blackjack, three-card poker. Every win → $VIBEZ." },
  { t:  44.0, text: "Find your Player Two · 98% synergy-logic matchmaking · Cinema Dates · culturally-aware AI dealer." },
  { t:  56.0, text: "Drive VibeRidez · keep 70% · Hungry VIBEZ · Vibe Artisan · Vibe Venue · DSG TV 24/7." },
  { t:  70.0, text: "70/30 Music Revolution · Beat Vault · Freestyle Battles · Collab Matchmaker · Totem Pole." },
  { t:  80.0, text: "Vibe Yellow Pages · Mom & Pop · hyper-local · DSG Guard safety protocol." },
  { t:  88.0, text: "3 BILLION VIBEZ · hard-capped · 13.5% Sovereign Tax recirculates back to the players." },
  { t:  98.0, text: "5× mining multiplier for chair holders · $VIBEZ bridges to Solana 4:1." },
  { t: 105.0, text: "Chair Hall is OPEN · Genius · Genesis · Apex · 1,000,000 seats · forever." },
  { t: 115.0, text: "First cohort to sit at the table owns the network." },
  { t: 120.0, text: "Right now is the best time to take your seat at the table." },
  { t: 127.0, text: "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ." },
];

interface Props {
  onJoinBeta?: () => void;
}

const LandingTourVideo: React.FC<Props> = ({ onJoinBeta }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [clipIdx, setClipIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  // Loop video clips one after the other.
  const handleClipEnded = () => {
    setClipIdx((prev) => (prev + 1) % CLIPS.length);
  };

  // Track narration progress for caption sync + scrubber.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setProgress(a.currentTime);
      // Find the latest cue whose `t` is <= currentTime.
      let i = 0;
      for (let k = CAPTIONS.length - 1; k >= 0; k--) {
        if (CAPTIONS[k].t <= a.currentTime) { i = k; break; }
      }
      setCaptionIdx(i);
    };
    const onEnded = () => {
      setPlaying(false);
      // Keep the current frame; user can click Replay.
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  const start = () => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    a.muted = muted;
    a.play().catch(() => undefined);
    v.play().catch(() => undefined);
    setPlaying(true);
    setHasStarted(true);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    if (playing) {
      a.pause();
      v.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => undefined);
      v.play().catch(() => undefined);
      setPlaying(true);
      setHasStarted(true);
    }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    const next = !muted;
    a.muted = next;
    setMuted(next);
  };

  const restart = () => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    a.currentTime = 0;
    v.currentTime = 0;
    setClipIdx(0);
    a.play().catch(() => undefined);
    v.play().catch(() => undefined);
    setPlaying(true);
    setHasStarted(true);
  };

  const duration = audioRef.current?.duration || 122;
  const pct = Math.min(100, (progress / duration) * 100);
  const currentCaption = CAPTIONS[captionIdx]?.text || "";

  return (
    <section
      data-testid="landing-tour-video"
      className="relative z-10 px-4 sm:px-6 py-16 md:py-20 bg-gradient-to-b from-[#0a0014] via-black to-[#0a0014]"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-fuchsia-300 font-black mb-2">
            <Sparkles className="inline w-3 h-3 mr-1.5 -mt-0.5" />
            Watch · 2-min tour
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-2">
            The Whole Vibe in <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">2 Minutes</span>
          </h2>
          <p className="text-sm md:text-base text-white/60 max-w-2xl mx-auto">
            Don't feel like scrolling? Hit play. We'll walk you through every room, every payout, every reason to lock in your seat.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden border-2 border-fuchsia-500/30 shadow-[0_0_60px_-15px_rgba(217,70,239,0.5)] bg-black aspect-video"
          data-testid="landing-tour-video-frame"
        >
          {/* Background video — looped MP4 sequence, MUTED */}
          <video
            ref={videoRef}
            key={CLIPS[clipIdx]}
            src={CLIPS[clipIdx]}
            muted
            playsInline
            autoPlay={hasStarted}
            onEnded={handleClipEnded}
            className="absolute inset-0 w-full h-full object-cover"
            data-testid="landing-tour-video-clip"
          />

          {/* Narration audio — master timeline */}
          <audio ref={audioRef} src={NARRATION_SRC} preload="auto" data-testid="landing-tour-audio" />

          {/* Vignette overlay so captions stay legible */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

          {/* PLAY CTA overlay — gates first interaction (browser autoplay block) */}
          {!hasStarted && (
            <button
              type="button"
              onClick={start}
              data-testid="landing-tour-play-overlay"
              className="absolute inset-0 flex flex-col items-center justify-center group cursor-pointer"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-[0_0_40px_rgba(217,70,239,0.7)] group-hover:scale-110 transition-transform">
                <Play className="w-10 h-10 md:w-12 md:h-12 text-white ml-1" fill="currentColor" />
              </div>
              <span className="mt-4 text-white font-black text-sm md:text-base uppercase tracking-[0.3em]">
                Play the Tour
              </span>
              <span className="text-white/60 text-xs mt-1">~2 min · narrated</span>
            </button>
          )}

          {/* Captions */}
          {hasStarted && showCaptions && currentCaption && (
            <motion.div
              key={captionIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute left-4 right-4 bottom-20 md:bottom-24 max-w-3xl mx-auto px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-center"
              data-testid="landing-tour-caption"
            >
              <p className="text-white text-sm md:text-base font-bold leading-snug">
                {currentCaption}
              </p>
            </motion.div>
          )}

          {/* Bottom controls */}
          {hasStarted && (
            <div className="absolute left-0 right-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
              {/* Scrubber */}
              <div className="h-1 bg-white/10 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-400 transition-all"
                  style={{ width: `${pct}%` }}
                  data-testid="landing-tour-progress"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    data-testid="landing-tour-play-btn"
                    aria-label={playing ? "Pause" : "Play"}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    data-testid="landing-tour-mute-btn"
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <button
                    type="button"
                    onClick={restart}
                    data-testid="landing-tour-restart-btn"
                    aria-label="Restart"
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  >
                    <RotateCcw className="w-4 h-4 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCaptions((v) => !v)}
                    data-testid="landing-tour-captions-btn"
                    aria-label="Toggle captions"
                    aria-pressed={showCaptions}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                      showCaptions ? "bg-fuchsia-500/40 hover:bg-fuchsia-500/60" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Captions className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-[11px] text-white/60 font-mono tabular-nums hidden sm:block">
                    {Math.floor(progress)}s · {Math.max(0, Math.floor(duration - progress))}s left
                  </span>
                </div>

                {onJoinBeta && (
                  <button
                    type="button"
                    onClick={onJoinBeta}
                    data-testid="landing-tour-join-beta-btn"
                    className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 hover:from-amber-300 hover:to-fuchsia-400 text-black text-xs font-black uppercase tracking-wider shadow-[0_0_20px_-5px_rgba(251,191,36,0.6)] transition"
                  >
                    Join Beta →
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <p className="text-center text-[11px] text-white/30 mt-4 font-mono uppercase tracking-widest">
          Voiceover: AI-narrated · Onyx · {CAPTIONS.length} cues · {CLIPS.length} clip loop
        </p>

        {/* Social-export row — direct download of the pre-rendered 9:16
            vertical MP4 (subtitles burned in, narration muxed). Ready to
            drag-and-drop into the TikTok / Reels / Shorts uploader. */}
        <div
          className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-cyan-500/10 p-5 md:p-6 flex flex-col md:flex-row items-center gap-4"
          data-testid="landing-tour-social-export"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-base md:text-lg font-black text-white">
              Want to share this?
            </h3>
            <p className="text-xs md:text-sm text-white/60">
              Same script, same Onyx narration, vertical 9:16 with burned-in captions — ready for TikTok, Reels &amp; Shorts.
            </p>
          </div>
          <a
            href="/landing-tour-tiktok-9x16.mp4"
            download="GlobalVibezDSG-Tour-9x16.mp4"
            data-testid="landing-tour-download-9x16-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-black uppercase tracking-wider hover:bg-fuchsia-200 transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Download MP4
          </a>
        </div>
      </div>
    </section>
  );
};

export default LandingTourVideo;
