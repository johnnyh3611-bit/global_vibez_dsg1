/**
 * VolumetricDashboard — Galaxy UI inspired by the Volumetric Nav Master PDF.
 *
 * Translates the UE5.5 spec into Three.js / React Three Fiber:
 *   • 6 category PLANETS in a slow-rotating ring (Games · Dating · Rides ·
 *     Food · Streaming · Venues).
 *   • Each planet bobs on the Z-axis (sin wave, freq 2, amp 0.3) per PDF.
 *   • Each planet has a colored aura (Dating = pulsing pink per PDF spec).
 *   • Hover = scale up + cyan rim glow.
 *   • Click = camera dollies toward planet (0.8s lerp) + reveals orbit
 *     ring of ROOM TILES around it; click a tile to navigate.
 *   • ESC / back button returns the camera to galaxy view.
 *
 * Auto-fallback: if WebGL is unavailable, renders a 2D classic grid so
 * the page never goes blank.
 *
 * FEATURE FLAG: This page is fully opt-in via `localStorage.gv_volumetric_v1`.
 * Toggle from the classic Dashboard pill. To disable globally, remove the
 * route registration in miscRoutes.tsx.
 */
import { useState, useRef, useMemo, useEffect, useCallback, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Text } from "@react-three/drei";
import { Vector3 } from "three";
import type { Mesh, Group } from "three";
import { ArrowLeft, Sparkles } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import LiveActivityTicker from "@/components/common/LiveActivityTicker";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { switchDashboardView } from "@/pages/DashboardRouter";
import UnifiedEarningsWidget from "@/components/common/UnifiedEarningsWidget";
import GalaxyGuidedTour from "@/components/dashboard/GalaxyGuidedTour";

const API = process.env.REACT_APP_BACKEND_URL;

type Homeworld = { path: string; label: string; emoji: string; visits: number };

const CATEGORIES = [
  {
    id: "games", label: "Games", color: "#22d3ee", aura: "#22d3ee",
    rooms: [
      { id: "spades", label: "Spades", emoji: "♠️", path: "/spades" },
      { id: "vibez-654", label: "Vibez 654", emoji: "🎲", path: "/vibez-654" },
      { id: "chess-hall", label: "Chess Hall", emoji: "♟️", path: "/chess-hall" },
      { id: "underground", label: "Underground", emoji: "🃏", path: "/underground-casino" },
      { id: "cyber", label: "Cyber Casino", emoji: "🎰", path: "/cyber-casino" },
      { id: "high-roller", label: "High Roller VIP", emoji: "💎", path: "/casino/high-roller" },
    ],
  },
  {
    id: "dating", label: "Dating", color: "#ec4899", aura: "#f0abfc",
    pulsing: true,  // PDF spec: "Pulsing_Pink_Aura"
    rooms: [
      { id: "dating", label: "Universe", emoji: "💞", path: "/dating" },
      { id: "matchmaking", label: "Matchmaking", emoji: "✨", path: "/matchmaking" },
      { id: "cinema", label: "Cinema Date", emoji: "🎬", path: "/cinema-room" },
      { id: "spots", label: "Vibez Spots", emoji: "📍", path: "/vibe-spots" },
    ],
  },
  {
    id: "rides", label: "Rides", color: "#f59e0b", aura: "#fbbf24",
    rooms: [
      { id: "ridez", label: "Vibez Ridez", emoji: "🚗", path: "/vibe-ridez" },
    ],
  },
  {
    id: "food", label: "Food", color: "#84cc16", aura: "#a3e635",
    rooms: [
      { id: "hungry", label: "Hungry Vibez", emoji: "🍕", path: "/hungryvibes" },
      { id: "yellow", label: "Yellow Pages", emoji: "📒", path: "/yellow-pages" },
      { id: "receipts", label: "Receipts +15%", emoji: "🧾", path: "/receipts" },
    ],
  },
  {
    id: "streaming", label: "Streaming", color: "#a855f7", aura: "#c084fc",
    rooms: [
      { id: "live", label: "Live", emoji: "📡", path: "/live" },
      { id: "live-now", label: "Live Now Wall", emoji: "🔴", path: "/streams/live" },
      { id: "go-live", label: "Go Live", emoji: "🎥", path: "/streamer/studio" },
      { id: "stream-analytics", label: "Stream Analytics", emoji: "📊", path: "/streamer/analytics" },
      { id: "underground-live", label: "Underground Live", emoji: "🎤", path: "/underground-live" },
      { id: "sports", label: "Vibez Sports", emoji: "🏆", path: "/sports-lounge" },
      { id: "memory", label: "Memory Bank", emoji: "🎞️", path: "/dsg/memory-bank" },
      { id: "beats", label: "Beat Vault", emoji: "🎧", path: "/dsg/beat-vault" },
      { id: "video-vault", label: "Video Vault", emoji: "🎬", path: "/dsg/video-vault" },
      { id: "media-master", label: "Media Master", emoji: "📡", path: "/media-master" },
      { id: "music-group", label: "Music Group", emoji: "🎵", path: "/music-group" },
      { id: "broadcast-director", label: "Broadcast Director", emoji: "🎬", path: "/dashboard/streamer/broadcast-director" },
    ],
  },
  {
    id: "vault", label: "Vault", color: "#fde047", aura: "#facc15",
    rooms: [
      { id: "lottery", label: "DSG 6 Lottery", emoji: "🎰", path: "/lottery" },
      { id: "tiers", label: "Vibez Tiers", emoji: "👑", path: "/tiers" },
      { id: "wallet", label: "Vibez Wallet", emoji: "💰", path: "/wallet" },
      { id: "chair", label: "Chair Hall", emoji: "🪑", path: "/chair-hall" },
      { id: "voice", label: "Voice Mirror", emoji: "🎙️", path: "/voice-mirror" },
      { id: "myvibez", label: "My Vibez", emoji: "🌟", path: "/my-vibez" },
      { id: "myvibez-themed", label: "My Vibez Themed", emoji: "🎨", path: "/my-vibez/themed" },
      { id: "equity", label: "Equity & Governance", emoji: "💎", path: "/equity" },
      { id: "ambassador", label: "Ambassador Care", emoji: "🏅", path: "/ambassador" },
    ],
  },
];

const RING_RADIUS = 6;

/**
 * Render the right Lucide icon for a category. Kept as an explicit
 * function (vs `<category.Icon />` destructure) so TypeScript narrowing
 * through `typeof CATEGORIES[number]` doesn't lose the React.FC type
 * and silently render as undefined.
 */
function renderIcon(_categoryId: string) {
  // Kept as a future hook for Lucide-based icons once drei's Html portal
  // SVG-namespace issue is resolved upstream. Today we use emoji glyphs
  // via categoryEmoji() — they survive the portal cleanly.
  return null;
}

/**
 * Pictorial emoji for the category — rendered inside the planet's "coin"
 * frame above. Unicode glyphs survive drei's Html portal cleanly where
 * SVG components rendered at zero width.
 */
function categoryEmoji(categoryId: string): string {
  switch (categoryId) {
    case "games": return "🎲";
    case "dating": return "💞";
    case "rides": return "🚗";
    case "food": return "🍕";
    case "streaming": return "🍿";
    case "vault": return "💎";
    default: return "✦";
  }
}

function Planet({
  category,
  index,
  total,
  selected,
  onSelect,
  homeworld,
}: {
  category: typeof CATEGORIES[number];
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  homeworld?: Homeworld | null;
}) {
  const navigate = useNavigate();
  const meshRef = useRef<Mesh>(null);
  const cloudsRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const moonOrbitRef = useRef<Group>(null);
  const groupRef = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const [thumbHover, setThumbHover] = useState(false);

  // Position on a circle.
  const basePos = useMemo(() => {
    const angle = (index / total) * Math.PI * 2;
    return new Vector3(Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS);
  }, [index, total]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // PDF spec: sin wave bobbing (freq 2, amp 0.3 scaled for web view).
      groupRef.current.position.set(
        basePos.x,
        basePos.y + Math.sin(t * 2 + index) * 0.3,
        basePos.z,
      );
    }
    // Planet rotation — faster on hover so it feels reactive.
    const spinSpeed = hover ? 1.4 : 0.4;
    if (meshRef.current) meshRef.current.rotation.y = t * spinSpeed;
    // Cloud / noise layer rotates the OPPOSITE direction at a different
    // speed, creating procedural-feeling surface motion without a texture.
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = -t * (spinSpeed * 0.6);
      cloudsRef.current.rotation.x = Math.sin(t * 0.3 + index) * 0.05;
    }
    // Saturn ring slowly counter-rotates for life.
    if (ringRef.current) ringRef.current.rotation.z = t * 0.08;
    // Moon orbit.
    if (moonOrbitRef.current) {
      moonOrbitRef.current.rotation.y = t * 1.2 + index;
      moonOrbitRef.current.rotation.x = 0.4;
    }
    if (auraRef.current && category.pulsing) {
      // PDF spec: pulsing pink aura on Dating.
      const pulse = 1 + Math.sin(t * 2.5) * 0.15;
      auraRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  const radius = hover || selected ? 0.95 : 0.8;

  return (
    <group ref={groupRef}>
      {/* Outer aura sphere */}
      <mesh ref={auraRef} scale={hover ? 1.4 : 1.2}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial color={category.aura} transparent opacity={hover ? 0.25 : 0.15} />
      </mesh>
      {/* Saturn-style ring tilted ~20° — makes the orbs feel like planets */}
      <mesh ref={ringRef} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <ringGeometry args={[radius * 1.5, radius * 2.0, 64]} />
        <meshBasicMaterial color={category.aura} transparent opacity={0.35} side={2} />
      </mesh>
      {/* Inner secondary ring — gives the planet more "structure" */}
      <mesh rotation={[Math.PI / 2 - 0.55, 0.4, 0]}>
        <ringGeometry args={[radius * 2.1, radius * 2.2, 64]} />
        <meshBasicMaterial color={category.color} transparent opacity={0.5} side={2} />
      </mesh>
      {/* Core planet */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={category.color}
          emissive={category.color}
          emissiveIntensity={hover ? 0.6 : 0.3}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      {/* Cloud / noise layer — slightly larger semi-transparent sphere
          that rotates the OPPOSITE direction. Creates surface motion
          without needing a texture asset. */}
      <mesh ref={cloudsRef} scale={1.035}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={category.aura}
          emissive={category.aura}
          emissiveIntensity={0.18}
          transparent
          opacity={0.32}
          roughness={0.9}
          wireframe={category.id === "vault"}
        />
      </mesh>
      {/* Tiny orbiting moon — adds dynamism */}
      <group ref={moonOrbitRef}>
        <mesh position={[radius * 2.4, 0, 0]} scale={0.12}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={category.aura} emissive={category.aura} emissiveIntensity={0.7} />
        </mesh>
      </group>
      {/* Label — 2026-05-12 founder enhancement: subtle but more readable
          planet labels visible from the overview. Bumped distanceFactor
          from 10 → 7 (slightly larger), added a category-tinted glass
          pill background, and dropped from text-xs to text-sm so first-
          time visitors don't have to tap a planet to find out what it is. */}
      <Html position={[0, -1.5, 0]} center distanceFactor={7} zIndexRange={[60, 0]}>
        <div
          data-testid={`vol-planet-${category.id}`}
          className="text-white text-sm md:text-base uppercase tracking-[0.3em] font-black whitespace-nowrap pointer-events-none select-none px-3 py-1 rounded-full"
          style={{
            textShadow: `0 0 14px ${category.color}, 0 2px 8px rgba(0,0,0,0.9)`,
            background: `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.85))`,
            border: `1px solid ${category.color}aa`,
            boxShadow: `0 0 24px ${category.color}55`,
          }}
        >
          {category.label}
        </div>
      </Html>
      {/* Crisp icon thumbnail — billboarded above the planet. We use
          high-fidelity Unicode emoji glyphs (font-rendered, work inside
          drei's Html portal) inside a category-colored "coin" circle.
          Tested fallback: Lucide SVG components rendered as 0-width
          inside Html portals on this drei version. */}
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={8}
        zIndexRange={[100, 0]}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            // 2026-05-12 founder enhancement: tap-thumbnail = jump to
            // the user's personal "homeworld" (most-played room in this
            // category). Falls back to the first room if no homeworld
            // is known yet.
            const target = homeworld?.path ?? category.rooms[0]?.path;
            if (target) navigate(target);
          }}
          onMouseEnter={() => setThumbHover(true)}
          onMouseLeave={() => setThumbHover(false)}
          style={{
            cursor: "pointer",
            width: "76px",
            height: "76px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 30%, ${category.color}cc, ${category.aura}40 60%, transparent 75%)`,
            border: `2px solid ${category.color}`,
            boxShadow: thumbHover
              ? `0 0 32px ${category.color}, 0 0 60px ${category.aura}`
              : `0 0 22px ${category.color}, 0 0 40px ${category.aura}`,
            fontSize: "44px",
            lineHeight: 1,
            transform: thumbHover ? "scale(1.12)" : "scale(1)",
            transition: "transform 0.2s, box-shadow 0.2s",
            position: "relative",
          }}
          title={homeworld
            ? `Jump to your homeworld: ${homeworld.label}`
            : `Jump to ${category.rooms[0]?.label ?? category.label}`}
        >
          {renderIcon(category.id)}
          <span style={{ filter: `drop-shadow(0 0 6px ${category.color})` }}>
            {homeworld?.emoji || categoryEmoji(category.id)}
          </span>
          {homeworld && (
            <span
              style={{
                position: "absolute",
                bottom: "-8px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "8px",
                lineHeight: 1,
                padding: "2px 6px",
                borderRadius: "999px",
                background: category.color,
                color: "white",
                fontWeight: 900,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                boxShadow: `0 0 8px ${category.color}`,
              }}
            >
              HOME
            </span>
          )}
        </div>
      </Html>
      {/* Orbiting room tiles (only when selected) */}
      {selected && category.rooms.map((room, i) => (
        <OrbitingRoom
          key={room.id}
          room={room}
          index={i}
          total={category.rooms.length}
          tint={category.color}
        />
      ))}
    </group>
  );
}

function OrbitingRoom({ room, index, total, tint }: { room: any; index: number; total: number; tint: string }) {
  const navigate = useNavigate();
  const groupRef = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const ORBIT_R = 2.0;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      const base = (index / total) * Math.PI * 2;
      // PDF spec: each tile orbits its parent planet (constant rotation).
      const angle = base + t * 0.5;
      groupRef.current.position.set(
        Math.cos(angle) * ORBIT_R,
        Math.sin(t * 2 + index) * 0.15,
        Math.sin(angle) * ORBIT_R,
      );
      groupRef.current.rotation.y = -angle;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Invisible click-target sphere — easier to tap than a tiny box */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); navigate(room.path); }}
      >
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial color={tint} transparent opacity={hover ? 0.4 : 0.15} />
      </mesh>
      {/* Glowing picture-tile billboarded above the click target */}
      <Html position={[0, 0, 0]} center distanceFactor={7} zIndexRange={[80, 0]}>
        <div
          data-testid={`vol-room-${room.id}`}
          onClick={() => navigate(room.path)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            cursor: "pointer",
            width: "64px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "16px",
            background: `linear-gradient(135deg, ${tint}d0, ${tint}50)`,
            border: `2px solid ${tint}`,
            boxShadow: `0 0 18px ${tint}, 0 8px 18px -4px rgba(0,0,0,0.6)`,
            fontSize: "30px",
            lineHeight: 1,
            transform: hover ? "scale(1.18) translateY(-3px)" : "scale(1)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
        >
          <span style={{ filter: `drop-shadow(0 0 6px ${tint})` }}>
            {room.emoji ?? "✦"}
          </span>
        </div>
      </Html>
      {/* Label below the tile */}
      <Html position={[0, -0.55, 0]} center distanceFactor={10}>
        <div
          className="text-white text-[10px] uppercase tracking-widest font-bold whitespace-nowrap pointer-events-none select-none"
          style={{ textShadow: `0 0 8px ${tint}` }}
        >
          {room.label}
        </div>
      </Html>
    </group>
  );
}

function CameraRig({ selectedIndex }: { selectedIndex: number | null }) {
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(0, 0, 0), []);
  const desired = useMemo(() => new Vector3(0, 4, 12), []);

  useFrame(() => {
    if (selectedIndex !== null) {
      const angle = (selectedIndex / CATEGORIES.length) * Math.PI * 2;
      // PDF spec: 0.8s focus duration — translates to slow lerp factor.
      desired.set(
        Math.cos(angle) * (RING_RADIUS + 3),
        1.5,
        Math.sin(angle) * (RING_RADIUS + 3),
      );
      target.set(Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS);
    } else {
      desired.set(0, 4, 12);
      target.set(0, 0, 0);
    }
    camera.position.lerp(desired, 0.05);
    camera.lookAt(target);
  });

  return null;
}

function GalaxyScene({
  selectedIndex,
  setSelectedIndex,
  homeworlds,
}: {
  selectedIndex: number | null;
  setSelectedIndex: (i: number | null) => void;
  homeworlds: Record<string, Homeworld>;
}) {
  return (
    <>
      <color attach="background" args={["#040208"]} />
      <fog attach="fog" args={["#040208", 12, 30]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#a855f7" />
      <pointLight position={[8, 2, 8]} intensity={0.6} color="#22d3ee" />
      <pointLight position={[-8, 2, -8]} intensity={0.6} color="#ec4899" />
      <Stars radius={80} depth={50} count={4000} factor={4} fade speed={1} />
      <CameraRig selectedIndex={selectedIndex} />
      {CATEGORIES.map((c, i) => (
        <Planet
          key={c.id}
          category={c}
          index={i}
          total={CATEGORIES.length}
          selected={selectedIndex === i}
          onSelect={() => setSelectedIndex(selectedIndex === i ? null : i)}
          homeworld={homeworlds[c.id] ?? null}
        />
      ))}
    </>
  );
}

export default function VolumetricDashboard() {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [homeworlds, setHomeworlds] = useState<Record<string, Homeworld>>({});

  // 2026-05-12 PRODUCTION BUG (beta-tester reports): "when they go into
  // the volumetric view, they cannot see that page. It redirects them
  // back out." Root cause: the `<Canvas>` throws on devices where WebGL
  // is unavailable (older Android browsers, low-memory iOS, hardware
  // accel disabled in Chrome flags). The throw bubbles up to the parent
  // ErrorBoundary which redirects out.
  //
  // Fix: detect WebGL availability at mount BEFORE rendering the Canvas.
  // If unavailable: persist preference to classic, dispatch the router
  // event, AND show a friendly toast so the user knows what happened
  // (no silent redirect — they understand and can come back later from
  // a WebGL-capable device).
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ok = false;
    try {
      const canvas = document.createElement("canvas");
      ok = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      ok = false;
    }
    setWebglOk(ok);
    if (!ok) {
      // Flip to Classic + tell the user why. We don't navigate() because
      // the DashboardRouter listens for `gv-dashboard-view` and re-renders
      // in-place — no extra mount thrash.
      switchDashboardView("classic");
      import("sonner").then(({ toast }) => {
        toast.info("Volumetric Galaxy needs WebGL", {
          description:
            "Your browser doesn't support 3D acceleration — showing Classic view instead. Try Chrome / Safari with hardware acceleration on.",
          duration: 6000,
        });
      });
    }
  }, []);

  // 2026-05-12 founder enhancement: fetch user's per-category top room
  // ("Personal Homeworld") so the planet thumbnails reflect their habits.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(`${API}/api/recent-rooms/me`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d?.homeworlds) {
          setHomeworlds(d.homeworlds);
        }
      } catch {
        /* anonymous / network — leave homeworlds empty */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // While we're probing WebGL or after we determined it's unavailable,
  // render a minimal placeholder. The router will swap to Classic via
  // the event we fired above, so this only shows for one paint.
  if (webglOk === false) {
    return (
      <div
        className="fixed inset-0 bg-[#040208] text-white flex items-center justify-center"
        data-testid="volumetric-webgl-unavailable"
      >
        <p className="text-fuchsia-200/70 text-sm">Switching to Classic view…</p>
      </div>
    );
  }

  const setClassicMode = () => {
    // 2026-05-12 (fix v2): switchDashboardView() writes localStorage AND
    // dispatches a custom event that DashboardRouter listens for, so the
    // router re-renders the Classic view instantly. Previously we only
    // wrote localStorage + navigated to /dashboard, which is a no-op when
    // already on /dashboard → the toggle did nothing.
    //
    // 2026-05-12 (backlog #8): show a "Saved as default" toast the first
    // time so the user knows their preference persists.
    const seen = localStorage.getItem("gv_dashboard_view_seen") === "1";
    switchDashboardView("classic");
    localStorage.removeItem("gv_volumetric_v1");
    if (!seen) {
      localStorage.setItem("gv_dashboard_view_seen", "1");
      // Lazy-import toast to avoid pulling sonner into the R3F chunk.
      import("sonner").then(({ toast }) => {
        toast.success("Classic view saved as your default", {
          description: "Switch back anytime from Try Volumetric.",
        });
      });
    }
    navigate("/dashboard");
  };

  return (
    <div className="fixed inset-0 bg-[#040208] text-white" data-testid="volumetric-dashboard">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <button
          type="button"
          onClick={setClassicMode}
          data-testid="vol-back-classic"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" /> Classic view
        </button>
        <div className="flex items-center gap-2 text-fuchsia-300">
          <Sparkles className="w-4 h-4" />
          <h1 className="text-sm md:text-base tracking-[0.4em] uppercase">Volumetric Galaxy</h1>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">
          {selectedIndex === null ? "Tap a planet to dive in" : "Tap planet again to exit · drag to orbit"}
        </div>
      </div>

      {/* 💸 Unified Earnings widget — floats bottom-left over the canvas.
          Auto-hides if user has no income / venues / streams so first-time
          guests aren't confused. Compact variant to keep the galaxy hero.
          Mobile-quiet (founder ask 2026-02-15): on phones (<768px) the
          widget overlapped the planets, so we hide it there and rely on
          the inline PageActionStrip / Classic-view Earnings card. */}
      <div className="absolute bottom-16 left-3 z-20 w-72 max-w-[calc(100vw-1.5rem)] pointer-events-auto hidden md:block">
        <UnifiedEarningsWidget compact />
      </div>

      {/* The R3F canvas — wrapped in a dedicated ErrorBoundary so a
          runtime WebGL crash (e.g. context lost, GPU OOM, driver hang on
          beta-tester devices) falls back to Classic view in-place
          instead of bubbling to the app-level boundary which would
          redirect the user out of /dashboard. */}
      <ErrorBoundary
        name="volumetric-canvas"
        fallback={
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30"
            data-testid="volumetric-canvas-crashed"
          >
            <div className="text-center max-w-sm px-4">
              <p className="text-fuchsia-200 text-sm font-bold mb-2">
                The 3D galaxy hit a snag on your device.
              </p>
              <button
                type="button"
                onClick={() => {
                  switchDashboardView("classic");
                  navigate("/dashboard");
                }}
                className="px-4 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-xs font-bold uppercase tracking-widest"
                data-testid="volumetric-canvas-crashed-classic-btn"
              >
                Switch to Classic view
              </button>
            </div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 4, 12], fov: 60 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false, failIfMajorPerformanceCaveat: false }}
          onCreated={({ gl }) => {
            // 2026-05-12 — auto-recover from WebGL context loss instead
            // of letting the canvas go blank. Browsers fire this on tab
            // backgrounding, GPU driver hiccups, or low-memory swaps.
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
            });
          }}
        >
          <Suspense fallback={null}>
            <GalaxyScene selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} homeworlds={homeworlds} />
          </Suspense>
          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={8}
            maxDistance={20}
            autoRotate={selectedIndex === null}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </ErrorBoundary>

      {/* 2026-05-12 founder fix: "the rotation don't actually rotate one
          by one... if you spin it, you spin it by wanting to go over one
          by one so people could actually have easier access." Adding
          prev/next snap-navigation arrows on the mid-left and mid-right
          plus a dot indicator + planet label, so users can step through
          planets like a carousel instead of fighting OrbitControls drag.
          Camera tween is automatic via the existing CameraRig lerp on
          selectedIndex change. */}
      <PlanetCarouselNav
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
      />

      {/* 30-second cinematic guided tour — auto-plays on first visit,
          re-playable from the "Replay Tour" pill it renders itself. */}
      <GalaxyGuidedTour
        planets={CATEGORIES.map((c) => ({
          id: c.id,
          label: c.label,
          color: c.color,
          rooms: c.rooms.map((r) => ({ id: r.id, label: r.label })),
        }))}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
      />

      {/* Bottom hint — sits just above the activity ticker (32px tall) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 text-center text-[10px] uppercase tracking-widest text-white/50 px-4">
        {selectedIndex === null
          ? "6 planets · drag to spin the galaxy · tap a planet to see its rooms"
          : `${CATEGORIES[selectedIndex].label} · tap any orbiting tile to enter that room`}
      </div>

      {/* 2026-05-12 enhancement: live activity ticker across the bottom */}
      <LiveActivityTicker />
    </div>
  );
}


// ─── Planet Carousel Nav ─────────────────────────────────────────────
//
// 2026-05-12 founder fix: free-spin OrbitControls drag was too finicky
// for stepping through 6 planets one at a time. This component renders:
//
//   • Mid-left CHEVRON LEFT  → prev planet (wraps at 0 → last)
//   • Mid-right CHEVRON RIGHT → next planet (wraps at last → 0)
//   • Bottom-center planet label + dot indicator showing which of the 6
//     planets is active
//   • Keyboard ← / → / Esc shortcuts (Esc exits selection)
//
// Both arrows trigger setSelectedIndex which the existing CameraRig
// already lerps to — no extra animation logic needed. Auto-hides
// initially (selectedIndex === null) until user taps any planet, then
// the carousel becomes the primary nav surface.
function PlanetCarouselNav({
  selectedIndex,
  setSelectedIndex,
}: {
  selectedIndex: number | null;
  setSelectedIndex: (i: number | null) => void;
}) {
  const total = CATEGORIES.length;
  const isOpen = selectedIndex !== null;
  const current = isOpen ? CATEGORIES[selectedIndex] : null;

  const goNext = useCallback(() => {
    const next = selectedIndex === null ? 0 : (selectedIndex + 1) % total;
    setSelectedIndex(next);
  }, [selectedIndex, setSelectedIndex, total]);

  const goPrev = useCallback(() => {
    const prev = selectedIndex === null ? total - 1 : (selectedIndex - 1 + total) % total;
    setSelectedIndex(prev);
  }, [selectedIndex, setSelectedIndex, total]);

  // ← / → / Esc keyboard shortcuts. Always active on this page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into an input/textarea/select.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape" && selectedIndex !== null) {
        e.preventDefault();
        setSelectedIndex(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, selectedIndex, setSelectedIndex]);

  return (
    <>
      {/* Prev arrow — always rendered; bumps selection from null → last */}
      <button
        type="button"
        onClick={goPrev}
        data-testid="vol-carousel-prev"
        aria-label="Previous planet"
        className="absolute top-1/2 -translate-y-1/2 left-2 md:left-4 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 hover:border-fuchsia-400/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg shadow-black/40"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Next arrow */}
      <button
        type="button"
        onClick={goNext}
        data-testid="vol-carousel-next"
        aria-label="Next planet"
        className="absolute top-1/2 -translate-y-1/2 right-2 md:right-4 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 hover:border-fuchsia-400/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg shadow-black/40 rotate-180"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Dot indicator + active label — bottom-center, above the ticker */}
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none"
        data-testid="vol-carousel-indicator"
      >
        {current && (
          <div
            className="text-white text-xs font-black uppercase tracking-[0.4em] px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10"
            style={{ textShadow: `0 0 12px ${current.color}` }}
            data-testid="vol-carousel-active-label"
          >
            {current.label}
          </div>
        )}
        <div className="flex gap-1.5">
          {CATEGORIES.map((c, i) => {
            const active = i === selectedIndex;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedIndex(i)}
                aria-label={`Jump to ${c.label}`}
                data-testid={`vol-carousel-dot-${c.id}`}
                className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                  active ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60"
                }`}
                style={active ? { boxShadow: `0 0 8px ${c.color}` } : undefined}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
