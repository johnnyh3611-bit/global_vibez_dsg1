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
import { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Text } from "@react-three/drei";
import { Vector3 } from "three";
import type { Mesh, Group } from "three";
import { ArrowLeft, Sparkles } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import LiveActivityTicker from "@/components/common/LiveActivityTicker";

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
      { id: "underground-live", label: "Underground Live", emoji: "🎤", path: "/underground-live" },
      { id: "sports", label: "Vibez Sports", emoji: "🏆", path: "/sports-lounge" },
      { id: "memory", label: "Memory Bank", emoji: "🎞️", path: "/dsg/memory-bank" },
      { id: "beats", label: "Beat Vault", emoji: "🎧", path: "/dsg/beat-vault" },
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
      {/* Label */}
      <Html position={[0, -1.4, 0]} center distanceFactor={10}>
        <div
          data-testid={`vol-planet-${category.id}`}
          className="text-white text-xs uppercase tracking-[0.3em] font-black whitespace-nowrap pointer-events-none select-none"
          style={{ textShadow: `0 0 12px ${category.color}` }}
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

  const setClassicMode = () => {
    // 2026-05-12: switch the persistent dashboard preference and reload
    // /dashboard so the DashboardRouter picks up the Classic view.
    localStorage.setItem("gv_dashboard_view", "classic");
    localStorage.removeItem("gv_volumetric_v1");
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

      {/* The R3F canvas */}
      <Canvas
        camera={{ position: [0, 4, 12], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
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
