/**
 * Cyber Casino room — Unity WebGL container.
 *
 * Drop a Unity WebGL build into `/app/frontend/public/unity/cyber-casino/`
 * and the iframe below will auto-load it. Folder layout expected:
 *
 *   /public/unity/cyber-casino/
 *     ├─ index.html           ← Unity's WebGL build entry point
 *     ├─ Build/                  (TemplateData/ and Build/ are emitted
 *     ├─ TemplateData/            by Unity's WebGL build pipeline)
 *     └─ StreamingAssets/      (optional)
 *
 * Until a build is uploaded, the page renders a "Coming Soon" frame
 * w/ instructions for the founder to drop in their .zip via the
 * `/api/uploads/media?kind=generic` endpoint we built earlier.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, ArrowLeft, Cpu, Sparkles, Box, Upload, RotateCw } from "lucide-react";

const UNITY_BUILD_PATH = "/unity/cyber-casino/index.html";
// Existence marker — a tiny txt file the SPA doesn't fall back to.
// Drop `manifest.txt` next to your Unity build's index.html and this
// page flips from "Coming Soon" to live.
const UNITY_MARKER_PATH = "/unity/cyber-casino/manifest.txt";
const SPLINE_EMBED_URL = process.env.REACT_APP_CYBER_CASINO_SPLINE_URL || "";

export default function CyberCasino() {
  const navigate = useNavigate();
  const [unityAvailable, setUnityAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // The preview proxy serves SPA fallback HTML for ALL unknown paths,
    // including .txt files — so we can't trust a 200 status. Instead we
    // fetch the marker and check the body for the literal token. Drop a
    // file at `/public/unity/cyber-casino/manifest.txt` containing the
    // single line `unity-build-ready` to flip this page to live.
    fetch(UNITY_MARKER_PATH, { cache: "no-store" })
      .then((r) => r.text())
      .then((t) => setUnityAvailable(t.trim() === "unity-build-ready"))
      .catch(() => setUnityAvailable(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#07030F] text-white" data-testid="cyber-casino-page">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/games-menu")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-4"
          data-testid="cyber-casino-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_22px_rgba(217,70,239,0.55)]">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Game Room · Cyber Casino
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Cyber Casino</h1>
          </div>
        </div>

        {unityAvailable === null ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
          </div>
        ) : unityAvailable ? (
          <div
            className="rounded-2xl overflow-hidden border border-fuchsia-500/30 shadow-[0_0_40px_rgba(217,70,239,0.35)] bg-black"
            data-testid="cyber-casino-unity-frame"
          >
            <iframe
              src={UNITY_BUILD_PATH}
              title="Cyber Casino"
              className="w-full"
              style={{ height: "75vh", border: 0 }}
              allow="autoplay; fullscreen; gamepad; xr-spatial-tracking"
            />
          </div>
        ) : SPLINE_EMBED_URL ? (
          <div
            className="rounded-2xl overflow-hidden border border-fuchsia-500/30 bg-black"
            data-testid="cyber-casino-spline-frame"
          >
            <iframe
              src={SPLINE_EMBED_URL}
              title="Cyber Casino (Spline)"
              className="w-full"
              style={{ height: "75vh", border: 0 }}
              allow="autoplay; fullscreen; xr-spatial-tracking"
            />
          </div>
        ) : (
          <>
            {/* Native React games — playable RIGHT NOW, no Unity needed. */}
            <div className="grid md:grid-cols-3 gap-4 mb-8" data-testid="cyber-casino-game-tiles">
              <button
                onClick={() => navigate("/games/cyber-casino/roulette")}
                className="group p-6 rounded-2xl bg-[#0F0720] border border-fuchsia-500/30 hover:border-fuchsia-400/60 transition-all hover:-translate-y-0.5 text-left"
                data-testid="cyber-casino-tile-roulette"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center mb-3 shadow-[0_0_18px_rgba(217,70,239,0.45)]">
                  <RotateCw className="w-6 h-6 text-white" />
                </div>
                <p className="text-base font-black text-white mb-1">Neon Roulette</p>
                <p className="text-xs text-purple-300/80 leading-snug">
                  European single-zero. Straight, color, parity, dozen bets.
                  Live now in Vibez Coins.
                </p>
                <span className="inline-block mt-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ● PLAYABLE
                </span>
              </button>
              <button
                onClick={() => navigate("/games/cyber-casino/slots")}
                className="group p-6 rounded-2xl bg-[#0F0720] border border-fuchsia-500/30 hover:border-amber-400/60 transition-all hover:-translate-y-0.5 text-left"
                data-testid="cyber-casino-tile-slots"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-600 flex items-center justify-center mb-3 shadow-[0_0_18px_rgba(245,158,11,0.5)]">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <p className="text-base font-black text-white mb-1">Neon Slots</p>
                <p className="text-xs text-purple-300/80 leading-snug">
                  Server-authoritative 3-reel cyberpunk slot. Top pay 50× on
                  3× WILD. Provably fair.
                </p>
                <span className="inline-block mt-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ● PLAYABLE
                </span>
              </button>
              <button
                onClick={() => navigate("/games/cyber-casino/blackjack")}
                className="group p-6 rounded-2xl bg-[#0F0720] border border-fuchsia-500/30 hover:border-cyan-400/60 transition-all hover:-translate-y-0.5 text-left"
                data-testid="cyber-casino-tile-blackjack"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-fuchsia-600 flex items-center justify-center mb-3 shadow-[0_0_18px_rgba(34,211,238,0.45)]">
                  <Box className="w-6 h-6 text-white" />
                </div>
                <p className="text-base font-black text-white mb-1">Neon Blackjack</p>
                <p className="text-xs text-purple-300/80 leading-snug">
                  Classic 21 · 6-deck shoe · Dealer S17 · BJ pays 3:2.
                  Server holds the shoe.
                </p>
                <span className="inline-block mt-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ● PLAYABLE
                </span>
              </button>
            </div>

            {/* All three native games are live above. The Unity / Spline
                hot-swap pillar below is a forward-compat slot for if/when
                the founder wants to drop in a 3D / WebGL casino room.
                Collapsed by default to keep the playable tiles the focus. */}
            <details className="group" data-testid="cyber-casino-future-room-toggle">
              <summary className="cursor-pointer list-none flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-purple-300/60 hover:text-fuchsia-300 transition-colors py-3">
                <span className="opacity-50 group-open:opacity-0 transition-opacity">+</span>
                <span className="opacity-0 group-open:opacity-50 -ml-3 transition-opacity">−</span>
                Add a 3D / Unity room
              </summary>
              <div className="mt-4">
                <ComingSoon />
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

const ComingSoon: React.FC = () => (
  <Card
    className="p-12 bg-gradient-to-br from-purple-950/60 via-fuchsia-950/40 to-[#0F0720] border border-fuchsia-500/30 rounded-2xl"
    data-testid="cyber-casino-coming-soon"
  >
    <div className="flex items-center gap-3 mb-6 justify-center">
      <Cpu className="w-8 h-8 text-fuchsia-300 animate-pulse" />
      <h2 className="text-3xl md:text-4xl font-black text-white">
        Add a 3D / WebGL Room
      </h2>
    </div>
    <p className="text-center text-purple-200/80 mb-8 max-w-2xl mx-auto leading-relaxed">
      The native React games above are live & playable. If you also want
      a 3D Unity or Spline room inside this casino, drop a build into{" "}
      <code className="text-fuchsia-300 font-mono text-xs bg-black/60 px-2 py-0.5 rounded">/public/unity/cyber-casino/</code>{" "}
      and it'll auto-render the moment the route refreshes.
    </p>

    <div className="grid md:grid-cols-3 gap-4 mb-8">
      <Pillar
        icon={Box}
        title="Unity WebGL"
        body="Build with Unity 6 LTS, target WebGL, drop the output folder under /public/unity/cyber-casino."
      />
      <Pillar
        icon={Sparkles}
        title="Spline (no install)"
        body="Build a 3D scene at spline.design, export embed URL, set REACT_APP_CYBER_CASINO_SPLINE_URL."
      />
      <Pillar
        icon={Upload}
        title="Hot-swap ready"
        body="Page probes for the build on every load. Upload + refresh = live. No code changes needed."
      />
    </div>

    <div className="flex gap-3 justify-center flex-wrap">
      <a
        href="https://unity.com/download"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-colors"
        data-testid="cyber-casino-unity-link"
      >
        Get Unity Hub →
      </a>
      <a
        href="https://spline.design"
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 font-bold transition-colors"
        data-testid="cyber-casino-spline-link"
      >
        Or try Spline →
      </a>
    </div>
  </Card>
);

const Pillar: React.FC<{
  icon: React.ElementType;
  title: string;
  body: string;
}> = ({ icon: Icon, title, body }) => (
  <div className="p-5 rounded-2xl bg-[#0B0618] border border-fuchsia-500/20">
    <Icon className="w-5 h-5 text-fuchsia-300 mb-3" />
    <p className="text-sm font-black text-white mb-1">{title}</p>
    <p className="text-xs text-purple-200/80 leading-relaxed">{body}</p>
  </div>
);
