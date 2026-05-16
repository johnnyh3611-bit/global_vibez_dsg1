/**
 * LandingTourVideo — 79-second cinematic tour of GLOBAL VIBEZ DSG that
 * sits on the public landing page directly below the DSG VIBE TV pillar.
 *
 * Founder directive 2026-05-09:
 *   "Just your voice talking, showing different pictures. People who
 *    don't scroll need a surplus they can hit and learn everything."
 *
 * Implementation
 *   • Founder-uploaded MP4 clips loop in the background (muted).
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
import { Play, Pause, Volume2, VolumeX, RotateCcw, Captions, Sparkles, Download, Globe } from "lucide-react";

// Founder-uploaded promo clips, looped in this order.
//
// 2026-05-12 founder ask: "I want the tour video to stay the same. I want
// the dice to just be the first thing you see in the front 'cause I like
// that, but I want you to add this so we don't have... so it add more
// wow factor to the video." Adding clips #5 and #6 AT THE END so the
// dice intro and existing flow stay exactly as-is and the new clips
// extend the loop for additional wow factor when the narration cycles
// through B-roll a second time.
const CLIPS: string[] = [
  // 1 — dice intro (founder explicitly likes this first)
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/aeaebfxp_e_c_a_d_d_db_c_e_videomp_.mp4",
  // 2 — original promo
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/8s795ybg_mp_%20%281%29.mp4",
  // 3 — original promo
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/n612sxdb__The_video_will_be_available_for_hours.mp4",
  // 4 — original promo
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/p21nztqq_mp_.mp4",
  // 5 — 2026-05-12 founder-added wow-factor clip ("Now_could_you_make_me_another")
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/jhcw8qgh_Now_could_you_make_me_another.mp4",
  // 6 — 2026-05-12 founder-added wow-factor clip ("mp_")
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/4r7dg2zf_mp_.mp4",
  // 7 — 2026-05-13 founder-added talking-host clip
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/p3dccmdd_Okay_make_me_one_more_talk_ab.mp4",
  // 8 — 2026-05-13 founder-added closing wow clip
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/fdv0cph9_bmp_.mp4",
  // 9 — 2026-05-16 founder-added commercial clip ("generated_video_content"), pairs with Commercial 1 voiceover
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/ycmjkhqh__http_com_generated_video_content_.mp4",
  // 10 — 2026-05-16 founder-added commercial clip ("mp4.mp4"), pairs with Commercial 2 voiceover
  "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/a0uflv8a_mp4.mp4",
];

// Per-clip caption tags — 2026-05-12 founder enhancement: silent-autoplay
// scrollers (the majority of social-feed traffic) get a 2-3 word "what
// you're seeing" overlay so they understand each scene without sound.
// Order MUST match CLIPS[].
const CLIP_TAGS: Array<{ kicker: string; line: string; tint: string }> = [
  { kicker: "Roll the dice", line: "Vibez 654 · live tables", tint: "from-fuchsia-400 to-violet-500" },
  { kicker: "Game on", line: "30+ casino rooms · social play", tint: "from-amber-400 to-rose-500" },
  { kicker: "Just for the Night", line: "Season pass · creator rooms", tint: "from-cyan-400 to-fuchsia-500" },
  { kicker: "Earn on every hat", line: "Drive · host · stream · sell", tint: "from-emerald-400 to-cyan-500" },
  { kicker: "All-new wow", line: "More rooms · more vibes", tint: "from-pink-400 to-fuchsia-500" },
  { kicker: "Welcome home", line: "Your Vibez universe awaits", tint: "from-violet-400 to-indigo-500" },
  { kicker: "Meet your host", line: "Founder talks the vision", tint: "from-orange-400 to-amber-500" },
  { kicker: "Sit at the table", line: "Apex · Genesis · Genius chairs", tint: "from-yellow-400 to-emerald-500" },
  { kicker: "Commercial · 15s", line: "Coins that pay the rent", tint: "from-cyan-400 to-fuchsia-500" },
  { kicker: "Commercial · 15s", line: "From streamer to seat-holder", tint: "from-amber-400 to-rose-500" },
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

const NARRATION_SRC = "/landing-tour-narration.mp3";

// Static fallback caption track — used until the i18n manifest loads
// (or if it fails to fetch). Mirrors the v3 (Feb-2026) narration script
// in `backend/scripts/generate_landing_tour_narration.py`. Updated for
// the energetic "nova" voice, Ambassador Care Package, Equity Master v2,
// High Roller VIP, Media Master, and Regional TV Hubs.
const FALLBACK_CAPTIONS: Cue[] = [
  { t:   0.0, text: "YO! Welcome to GLOBAL VIBEZ DSG — your seat at a brand-new economy that pays you back." },
  { t:   8.0, text: "Every game, every ride, every meal, every stream, every chair — ALL of it earns." },
  { t:  18.0, text: "Cyber Casino: 30+ AAA card rooms · Spades · Bid Whist · UNO · Pinochle · Euchre · Gin Rummy." },
  { t:  30.0, text: "Vibez 6-5-4: chess · baccarat · blackjack · three-card poker · slots that pay real $VIBEZ." },
  { t:  42.0, text: "HIGH ROLLER VIP — 10,000-coin minimums · Diamond blackjack, roulette, baccarat. VIP-gated." },
  { t:  54.0, text: "Go LIVE on DSG TV in 30 seconds. Keep 70% of every tip, gift, and Featured unlock." },
  { t:  64.0, text: "Media Master Hub: DSG TV · Vibe Radio · Music Group · AI Scout — your broadcast empire." },
  { t:  74.0, text: "Regional Hubs: Chicago · Atlanta · NYC · LA · Miami · Houston feed the House Revenue Pool." },
  { t:  86.0, text: "VibeRidez · Hungry VIBEZ · Vibe Artisan · Vibe Venue — every hustle hat pays 70%." },
  { t:  98.0, text: "Cinema creators? 80% on every ticket sold!" },
  { t: 104.0, text: "AMBASSADOR Care Package — you're a Walking Advertisement. Founder's Circle status." },
  { t: 114.0, text: "Scan a vendor with your Master QR · Restaurants → Hungry Vibez · Businesses → Yellow Pages · Sponsors → DSG TV." },
  { t: 126.0, text: "Chair Dividends · Referral Bounties · Override Commissions · forever." },
  { t: 138.0, text: "3-Month Diamond Challenge: 3 vendors · 1,000 $VIBEZ · 50k vote → Tier-2 Equity + Pit Boss rights!" },
  { t: 152.0, text: "EQUITY MASTER v2 — 4-tier Value Matrix." },
  { t: 158.0, text: "Floor: $500K gross → $18/chair · Genesis: $2.75M → $99/chair." },
  { t: 168.0, text: "Diamond: $10M → $360/chair · Platinum: $50M → $1,800/chair!" },
  { t: 178.0, text: "Block-Release Governance: 50K-unit blocks · >51% majority vote · 12-month lock-up · $20 buy-back floor." },
  { t: 190.0, text: "3B VIBEZ burning to 1.5B · 50/50 Buyback + Liquidity · 30% of gross to chair holders · paid every 90 days." },
  { t: 200.0, text: "5× mining multiplier for chair holders · $VIBEZ bridges to Solana 4:1 · 1 Coin = 10 Credits." },
  { t: 208.0, text: "ONE MILLION CHAIRS. Globally. Forever. The first cohort to sit at the table OWNS the network." },
  { t: 220.0, text: "Take your seat. RIGHT NOW." },
  { t: 225.0, text: "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ. LET'S GOOO!" },
  // ── Two new founder commercials (2026-05-16, dsg_commercial_scripts.pdf) ──
  { t: 232.0, text: "— And one more thing. Two new spots. Fifteen seconds each. Listen close." },
  { t: 238.0, text: "Commercial One · The Sovereign Casino — neon card rooms, Diamond-tier blackjack." },
  { t: 246.0, text: "Every chip you win is REAL $VIBEZ. Coins that pay your rent. Take your seat." },
  { t: 254.0, text: "Commercial Two · From streamer to seat-holder." },
  { t: 258.0, text: "Go live · keep 70% of every tip · onboard 3 vendors → Tier-2 Equity FOREVER." },
  { t: 266.0, text: "GLOBAL VIBEZ DSG — own the network." },
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

  const duration = audioRef.current?.duration || track?.duration || 230;
  const pct = Math.min(100, (progress / duration) * 100);
  const currentCaption = captions[captionIdx]?.text || "";
  const langs = manifest?.languages ? Object.entries(manifest.languages) : [["en", { native: "English" } as LangTrack]];

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
          Voiceover: AI-narrated · Nova · {captions.length} cues · {CLIPS.length} clip loop · {manifest ? Object.keys(manifest.languages).length : 1} language{manifest && Object.keys(manifest.languages).length > 1 ? "s" : ""}
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
