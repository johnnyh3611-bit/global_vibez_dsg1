/**
 * LandingTourVideo — 74-second cinematic tour of GLOBAL VIBEZ DSG.
 *
 * Refreshed 2026-07-15:
 *   • Six new AI-generated 9:16 B-roll clips (intro, casino, dating,
 *     hustle, stream, chair) — no Emergent CDN, no repeated loops.
 *   • Energetic Microsoft Edge TTS (JennyNeural) narration mixed and
 *     rendered to /landing-tour-narration.mp3 by
 *     `backend/scripts/generate_landing_tour_narration.py`.
 *   • Browsers block autoplay-with-sound, so a big PLAY CTA overlay
 *     is shown until the user clicks.
 *   • Captions stay locked to the narration timeline for scroll-shy visitors.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Captions, Sparkles, Download, Globe } from "lucide-react";

// Six new AI-generated 9:16 B-roll clips, all first-party under
// /landing-tour/clips (no Emergent CDN, no repeated loops).
const CLIPS: string[] = [
  "/landing-tour/clips/01-intro.mp4",
  "/landing-tour/clips/02-casino.mp4",
  "/landing-tour/clips/03-dating.mp4",
  "/landing-tour/clips/04-hustle.mp4",
  "/landing-tour/clips/05-stream.mp4",
  "/landing-tour/clips/06-chair.mp4",
];

// Per-clip caption tags for silent autoplay scrollers. Order MUST match CLIPS[].
const CLIP_TAGS: Array<{ kicker: string; line: string; tint: string }> = [
  { kicker: "GLOBAL VIBEZ DSG", line: "Own the network", tint: "from-cyan-400 to-fuchsia-500" },
  { kicker: "Cyber Casino", line: "30+ AAA card rooms", tint: "from-amber-400 to-rose-500" },
  { kicker: "Find your Player 2", line: "AI matchmaker · Cinema Dates", tint: "from-rose-400 to-pink-500" },
  { kicker: "Hustle hats", line: "Ride · deliver · cook · host", tint: "from-emerald-400 to-cyan-500" },
  { kicker: "Go live", line: "DSG TV · Music · Broadcast", tint: "from-violet-400 to-indigo-500" },
  { kicker: "Take your seat", line: "1M chairs · real ownership", tint: "from-yellow-400 to-amber-500" },
];

const MANIFEST_URL = "/landing-tour-i18n.json";

type Cue = { t: number; text: string };
type LangTrack = {
  label: string;
  native: string;
  rtl: boolean;
  audio: string;
  duration: number;
  cues: Cue[];
};
type I18nManifest = {
  default: string;
  languages: Record<string, LangTrack>;
};

// Pick the best language match for the visitor's browser.
const pickInitialLang = (manifest: I18nManifest): string => {
  if (typeof navigator === "undefined") return manifest.default;
  // Honour an explicit user choice first.
  const stored = typeof window !== "undefined" ? localStorage.getItem("gv_tour_lang") : null;
  if (stored && manifest.languages[stored]) return stored;
  // Then try the browser's preferred language.
  const browser = (navigator.languages || [navigator.language || "en"])[0] || "en";
  const short = browser.toLowerCase().split("-")[0];
  if (manifest.languages[short]) return short;
  return manifest.default;
};

// Cache-buster version tag — bump this whenever the MP3 is regenerated
// so production browsers + CDN edge nodes don't keep serving the stale file.
const NARRATION_SRC = "/landing-tour-narration.mp3?v=2026-07-15-overhaul";

// Static fallback caption track — used until the i18n manifest loads
// (or if it fails to fetch). Mirrors the 2026-07-15 overhaul narration.
const FALLBACK_CAPTIONS: Cue[] = [
  { t: 0.0, text: "YO! Welcome to GLOBAL VIBEZ DSG! The only platform that pays you back for everything you already love." },
  { t: 18.288, text: "Step into the Cyber Casino. 30+ AAA card rooms. Spades, Bid Whist, Hearts, UNO, Vibez 654, blackjack, roulette, slots." },
  { t: 32.184, text: "Find your Player 2. AI matchmaker, Cinema Dates, Voice Mirror, Just For The Night." },
  { t: 40.464, text: "Drive a VibeRidez, deliver Hungry Vibez, cook as a Vibe Artisan, host a Vibe Venue — keep 70%." },
  { t: 47.592, text: "Go live on DSG TV, drop a track, build your broadcast empire — keep 70% of tips, gifts, and ticket sales." },
  { t: 54.864, text: "The chair is the crown. One million chairs. 13.5% Sovereign Tax recirculates. 5x mining. Ambassador dividends." },
  { t: 66.312, text: "Take your seat NOW. Own the network. Feel the VIBEZ. LET'S GOOO!" },
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
  // Track per-clip decode failures so a single broken URL does NOT
  // start a tight retry loop across all 11 clips. Once everything has
  // failed once we bail out + show the poster fallback. Lives in a
  // ref so it doesn't trigger re-renders on every onError fire.
  const failedClipsRef = useRef<Set<number>>(new Set());
  const [allClipsFailed, setAllClipsFailed] = useState(false);

  // i18n state
  const [manifest, setManifest] = useState<I18nManifest | null>(null);
  const [langCode, setLangCode] = useState<string>("en");
  const [langOpen, setLangOpen] = useState(false);

  // Load the multi-language manifest once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: I18nManifest | null) => {
        if (cancelled || !m) return;
        setManifest(m);
        setLangCode(pickInitialLang(m));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const track: LangTrack | null = manifest?.languages?.[langCode] || null;
  const captions: Cue[] = track?.cues || FALLBACK_CAPTIONS;
  const audioSrc: string = track?.audio || NARRATION_SRC;
  const isRtl: boolean = !!track?.rtl;

  const switchLang = (code: string) => {
    if (!manifest?.languages?.[code]) return;
    setLangCode(code);
    setLangOpen(false);
    try { localStorage.setItem("gv_tour_lang", code); } catch { /* ignore */ }
    // Pause + reset so the new audio takes over cleanly. The user
    // re-clicks Play to start the new language.
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
    setPlaying(false);
    setProgress(0);
    setCaptionIdx(0);
    setHasStarted(false);
  };

  // Loop video clips one after the other.
  const handleClipEnded = () => {
    setClipIdx((prev) => (prev + 1) % CLIPS.length);
  };

  // 2026-05-22 — make the background video actually play. Three issues
  // were breaking the visual:
  //   (a) browsers throttle autoplay of cross-origin MP4s; we have to
  //       imperatively call .play() AFTER each src swap.
  //   (b) the previous `key={CLIPS[clipIdx]}` remount left a brief
  //       window where videoRef.current was stale and .play() resolved
  //       on the unmounted element.
  //   (c) onError without a retry cap led to a tight loop; the cap is
  //       now enforced via `failedClipsRef` and `allClipsFailed`.
  // The effect below kicks .play() every time the active clip changes —
  // both after the user starts the tour and on every loop transition.
  // When the poster fallback is active there is no <video> ref; we
  // short-circuit instead of erroring.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !hasStarted || allClipsFailed) return;
    try { v.load(); } catch { /* noop */ }
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[landing-tour] video play() rejected:", err?.message || err);
      });
    }
  }, [clipIdx, hasStarted, allClipsFailed]);

  // Track narration progress for caption sync + scrubber.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setProgress(a.currentTime);
      // Find the latest cue whose `t` is <= currentTime.
      let i = 0;
      for (let k = captions.length - 1; k >= 0; k--) {
        if (captions[k].t <= a.currentTime) { i = k; break; }
      }
      setCaptionIdx(i);
    };
    const onEnded = () => {
      const v = videoRef.current;
      if (v) { v.pause(); v.currentTime = 0; }
      setClipIdx(0);
      setPlaying(false);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [captions]);

  const start = () => {
    const a = audioRef.current;
    const v = videoRef.current;
    // Audio is the primary narration carrier — it must start even
    // when the video element is missing (poster-fallback path).
    if (!a) return;
    a.muted = muted;
    a.play().catch(() => undefined);
    if (v) v.play().catch(() => undefined);
    setPlaying(true);
    setHasStarted(true);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      if (v) v.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => undefined);
      if (v) v.play().catch(() => undefined);
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
    if (!a) return;
    a.currentTime = 0;
    if (v) v.currentTime = 0;
    setClipIdx(0);
    a.play().catch(() => undefined);
    if (v) v.play().catch(() => undefined);
    setPlaying(true);
    setHasStarted(true);
  };

  const duration = audioRef.current?.duration || track?.duration || 230;
  const pct = Math.min(100, (progress / duration) * 100);
  const currentCaption = captions[captionIdx]?.text || "";
  const langs: [string, LangTrack][] = manifest?.languages ? Object.entries(manifest.languages) : [["en", { native: "English" } as LangTrack]];

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
            Watch · ~3-min Founder's Tour
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-2">
            The Whole Vibe in <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">3 Minutes</span>
          </h2>
          <p className="text-sm md:text-base text-white/60 max-w-2xl mx-auto">
            Don't feel like scrolling? Hit play. We'll walk you through every room, every payout, every reason to lock in your seat — Equity Matrix, Ambassador Care, and all.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden border-2 border-fuchsia-500/30 shadow-[0_0_60px_-15px_rgba(217,70,239,0.5)] bg-black aspect-video"
          data-testid="landing-tour-video-frame"
        >
          {/* Background video — looped MP4 sequence, MUTED.
              `preload="auto"` warms the buffer before the user hits
              play so the first frame paints instantly. `crossOrigin`
              is intentionally omitted — we never decode pixels into
              a canvas, and the attribute adds CORS preflight friction
              that breaks Safari/iOS playback for cross-origin MP4s.
              If a clip URL fails to decode (codec issue, 404, etc.)
              we advance once + track that clip in `failedClipsRef`.
              When every clip has failed, we bail out and render the
              static poster fallback so the section never goes black. */}
          {!allClipsFailed ? (
            <video
              ref={videoRef}
              key={CLIPS[clipIdx]}
              src={CLIPS[clipIdx]}
              muted
              playsInline
              autoPlay={hasStarted}
              preload="auto"
              onEnded={handleClipEnded}
              onError={() => {
                failedClipsRef.current.add(clipIdx);
                // eslint-disable-next-line no-console
                console.warn("[landing-tour] clip failed to load:", clipIdx, CLIPS[clipIdx]);
                if (failedClipsRef.current.size >= CLIPS.length) {
                  // Every clip exhausted — stop the retry loop.
                  setAllClipsFailed(true);
                  return;
                }
                // Skip to the next un-tried clip — never re-fire on
                // an already-failed index.
                setClipIdx((prev) => {
                  for (let step = 1; step <= CLIPS.length; step++) {
                    const next = (prev + step) % CLIPS.length;
                    if (!failedClipsRef.current.has(next)) return next;
                  }
                  return prev;
                });
              }}
              className="absolute inset-0 w-full h-full object-cover"
              data-testid="landing-tour-video-clip"
            />
          ) : (
            // Static gradient + brand mark fallback when codec support
            // is missing (corp browsers, locked-down headless Chromium,
            // etc.). The narration MP3 continues playing — the founder's
            // voice + captions are the primary signal here.
            <div
              className="absolute inset-0 w-full h-full bg-gradient-to-br from-fuchsia-700 via-violet-800 to-cyan-700 flex items-center justify-center"
              data-testid="landing-tour-poster-fallback"
            >
              <div className="text-center px-6">
                <p className="text-[10px] uppercase tracking-[0.4em] text-white/70 font-black mb-2">
                  Global Vibez DSG
                </p>
                <p className="text-2xl md:text-4xl font-black text-white mb-2">
                  Own the network · Feel the vibez
                </p>
                <p className="text-xs text-white/60">
                  Audio narration continues below. Refresh in a modern browser
                  to see the cinematic clip loop.
                </p>
              </div>
            </div>
          )}

          {/* Narration audio — master timeline. Re-mounted whenever the
              language changes by keying on audioSrc; otherwise the
              audio element silently keeps the prior MP3. */}
          <audio
            key={audioSrc}
            ref={audioRef}
            src={audioSrc}
            preload="auto"
            data-testid="landing-tour-audio"
          />

          {/* Vignette overlay so captions stay legible */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

          {/* 2026-05-12 founder enhancement: per-clip caption tag overlay.
              Silent-autoplay scrollers get a 2-3 word "what you're seeing"
              tag so each scene communicates even without sound. Keyed on
              clipIdx so it animates on every clip transition. */}
          {hasStarted && CLIP_TAGS[clipIdx] && (
            <motion.div
              key={`clip-tag-${clipIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5 }}
              className="absolute top-4 left-4 md:top-6 md:left-6 pointer-events-none"
              data-testid={`landing-tour-clip-tag-${clipIdx}`}
            >
              <div
                className={`inline-block bg-gradient-to-br ${CLIP_TAGS[clipIdx].tint} px-3 py-1 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-black text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] mb-2`}
                data-testid="landing-tour-clip-tag-kicker"
              >
                {CLIP_TAGS[clipIdx].kicker}
              </div>
              <p
                className="text-white text-sm md:text-base font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight max-w-xs"
                data-testid="landing-tour-clip-tag-line"
              >
                {CLIP_TAGS[clipIdx].line}
              </p>
            </motion.div>
          )}

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
              <span className="text-white/60 text-xs mt-1">~3 min · narrated</span>
            </button>
          )}

          {/* Captions */}
          {hasStarted && showCaptions && currentCaption && (
            <motion.div
              key={captionIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              dir={isRtl ? "rtl" : "ltr"}
              className="absolute left-4 right-4 bottom-20 md:bottom-24 max-w-3xl mx-auto px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 text-center"
              data-testid="landing-tour-caption"
            >
              <p className="text-white text-sm md:text-base font-bold leading-snug">
                {currentCaption}
              </p>
            </motion.div>
          )}

          {/* Language picker — bottom-right corner of the player. Tiny
              globe pill that expands into a dropdown of every language
              the manifest ships with. Founder directive 2026-05-09 —
              "make it so the video can change to whatever language a
              person speaks". */}
          {hasStarted && manifest && langs.length > 1 && (
            <div className="absolute top-3 right-3 z-30" data-testid="landing-tour-lang-picker">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                data-testid="landing-tour-lang-trigger"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur border border-white/15 text-white text-[11px] font-black uppercase tracking-wider transition"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-300" />
                <span>{manifest.languages[langCode]?.native || langCode}</span>
              </button>
              {langOpen && (
                <ul
                  role="listbox"
                  data-testid="landing-tour-lang-menu"
                  className="absolute right-0 top-full mt-1.5 min-w-[160px] rounded-xl bg-black/90 backdrop-blur border border-white/15 shadow-xl py-1 max-h-64 overflow-auto"
                >
                  {langs.map(([code, info]) => (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => switchLang(code)}
                        data-testid={`landing-tour-lang-option-${code}`}
                        aria-selected={code === langCode}
                        className={`w-full text-left px-3 py-1.5 text-[11px] font-bold transition ${
                          code === langCode ? "bg-fuchsia-500/30 text-fuchsia-100" : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <span className="block">{(info as LangTrack).native}</span>
                        <span className="block text-[9px] text-white/40 uppercase tracking-widest">{code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          Voiceover: AI-narrated · JennyNeural · {captions.length} cues · {CLIPS.length} clips · {manifest ? Object.keys(manifest.languages).length : 1} language{manifest && Object.keys(manifest.languages).length > 1 ? "s" : ""}
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
              Same script, same excited Edge TTS voice, vertical 9:16 with burned-in captions — ready for TikTok, Reels &amp; Shorts.
            </p>
          </div>
          <a
            href="/landing-tour-tiktok-9x16.mp4?v=2026-07-15-overhaul"
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
