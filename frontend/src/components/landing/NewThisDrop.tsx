/**
 * NewThisDrop — landing-page discovery hub.
 *
 * A visible "room" that surfaces every recently-shipped feature so users
 * know where each piece lives in the app. Also hosts the Spotify unlock
 * pitch (Vibe Drive bonus $DSG) and a direct "Connect Spotify" CTA.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Music,
  Car,
  Gauge,
  Trophy,
  Mic,
  Coins,
  Swords,
  Radio,
  Sparkles,
  ArrowRight,
  Lock,
  Moon,
} from "lucide-react";

type Feature = {
  id: string;
  title: string;
  tagline: string;
  route: string;
  icon: React.ReactNode;
  accent: string;
  badge?: string;
};

const FEATURES: Feature[] = [
  {
    id: "find-player-2",
    title: "Find Your Player 2",
    tagline: "Match by shared games, skill, and vibe. Send a ping — run it back.",
    route: "/find-player-2",
    icon: <Sparkles className="w-6 h-6" />,
    accent: "from-fuchsia-500 to-cyan-400",
    badge: "NEW",
  },
  {
    id: "my-vibez-profile",
    title: "MyVibez Profile",
    tagline: "Your $DSG balance, win history, teleport cosmetics, and appreciation gifts in one hub.",
    route: "/me",
    icon: <Trophy className="w-6 h-6" />,
    accent: "from-pink-500 to-amber-400",
    badge: "NEW",
  },
  {
    id: "card-royale",
    title: "Daily Card Royale",
    tagline: "Five-game gauntlet tournament, auto-scheduled daily. Heckle Lane chat included.",
    route: "/card-royale",
    icon: <Swords className="w-6 h-6" />,
    accent: "from-fuchsia-500 to-pink-500",
    badge: "NEW",
  },
  {
    id: "leaderboard",
    title: "Top 100 $DSG",
    tagline: "Live leaderboard — who's mining hardest across the platform.",
    route: "/vibez-leaderboard",
    icon: <Trophy className="w-6 h-6" />,
    accent: "from-amber-400 to-orange-500",
    badge: "LIVE",
  },
  {
    id: "vibe-drive",
    title: "Vibe Drive",
    tagline: "Drive your real car + stream curated playlists → earn $DSG. OEM odometer verified.",
    route: "/vibe-drive",
    icon: <Car className="w-6 h-6" />,
    accent: "from-cyan-400 to-fuchsia-500",
    badge: "BETA",
  },
  {
    id: "vibe-drive-hud",
    title: "Driver HUD",
    tagline: "Full-screen dashboard-mount display: massive odometer, pulsing $DSG counter, album art.",
    route: "/vibe-drive/hud",
    icon: <Gauge className="w-6 h-6" />,
    accent: "from-emerald-400 to-cyan-500",
    badge: "NEW",
  },
  {
    id: "voice-mirror",
    title: "Voice Mirror",
    tagline: "Real-time voice translation in the Underground Club — speak your language, hear theirs.",
    route: "/voice-mirror",
    icon: <Mic className="w-6 h-6" />,
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    id: "tge",
    title: "$DSG Token Gen Event",
    tagline: "Opt in to the Solana SPL token minting drop. Pending launch — secure your allocation.",
    route: "/tge",
    icon: <Coins className="w-6 h-6" />,
    accent: "from-yellow-400 to-pink-500",
    badge: "SOON",
  },
  {
    id: "just-for-the-night",
    title: "Just for the Night",
    tagline: "Paid late-night rooms. Creators host, members pay to enter, vanishing chat + voice inside.",
    route: "/just-for-the-night",
    icon: <Moon className="w-6 h-6" />,
    accent: "from-indigo-500 to-fuchsia-500",
    badge: "NEW",
  },
];

const NewThisDrop: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      className="relative z-10 px-6 py-24 border-t border-purple-500/30 bg-black"
      data-testid="landing-new-this-drop"
    >
      {/* grain / scanline */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(236,72,153,0.06) 0 1px, transparent 1px 3px)",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Heading */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div>
            <div className="flex items-center gap-2 text-fuchsia-400 font-mono text-xs uppercase tracking-[0.4em] mb-3">
              <Sparkles className="w-4 h-4" /> Fresh Drops
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter leading-none">
              New this drop.
              <br />
              <span className="text-transparent bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 bg-clip-text">
                Click. Enter. Vibe.
              </span>
            </h2>
          </div>
          <p className="text-neutral-400 max-w-sm text-sm">
            Every feature we shipped recently, with a direct door in. No hunting, no hidden URLs.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="features-grid">
          {FEATURES.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(f.route)}
              className="group relative text-left p-6 rounded-2xl bg-neutral-950 border border-white/10 hover:border-fuchsia-500/50 transition-all hover:-translate-y-0.5"
              data-testid={`feature-card-${f.id}`}
            >
              {f.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300 uppercase tracking-widest">
                  {f.badge}
                </span>
              )}
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${f.accent} mb-4 shadow-lg`}>
                {f.icon}
              </div>
              <div className="text-xl font-black tracking-tight mb-1">{f.title}</div>
              <div className="text-sm text-neutral-400 leading-relaxed">{f.tagline}</div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-fuchsia-300 group-hover:text-cyan-300 transition-colors">
                Enter <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="absolute bottom-3 right-4 text-[10px] font-mono text-neutral-600 group-hover:text-fuchsia-400 transition-colors">
                {f.route}
              </div>
            </button>
          ))}
        </div>

        {/* Spotify unlock pitch */}
        <div
          className="mt-16 relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-black to-fuchsia-950/40 p-8 md:p-12"
          data-testid="spotify-unlock-pitch"
        >
          <div
            className="pointer-events-none absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #1db954 0%, transparent 70%)" }}
          />
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-8">
            <div>
              <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs uppercase tracking-[0.4em] mb-3">
                <Radio className="w-4 h-4" /> Connect → Unlock
              </div>
              <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter leading-tight">
                Link Spotify.
                <br />
                <span className="text-transparent bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text">
                  Unlock bonus $DSG.
                </span>
              </h3>
              <ul className="mt-5 space-y-2 text-neutral-300 text-sm">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Vibe Drive bonus</strong> — 1 $DSG per 10 verified miles while a curated Global Vibez Drive playlist is playing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Music className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Now-playing on the Driver HUD</strong> — album art + track info auto-populate on your dashboard.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Tamper-proof</strong> — we only see current_playback (read-only). Your library stays private.</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/spotify")}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-emerald-500 text-black font-black italic uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                data-testid="landing-spotify-connect-btn"
              >
                <Music className="w-5 h-5" /> Connect Spotify
              </button>
              <button
                onClick={() => navigate("/smartcar")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold uppercase tracking-wider"
                data-testid="landing-smartcar-connect-btn"
              >
                <Car className="w-4 h-4" /> + Link Car (Smartcar)
              </button>
              <span className="text-[10px] font-mono text-neutral-500 text-center uppercase tracking-widest">
                Required for Vibe Drive
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewThisDrop;
