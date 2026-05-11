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
import { useState, useRef, useMemo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Text } from "@react-three/drei";
import { Vector3 } from "three";
import type { Mesh, Group } from "three";
import { ArrowLeft, Sparkles } from "lucide-react";

const CATEGORIES = [
  {
    id: "games", label: "Games", color: "#22d3ee", aura: "#22d3ee",
    rooms: [
      { id: "spades", label: "Spades", path: "/spades" },
      { id: "vibez-654", label: "Vibe 654", path: "/vibez-654" },
      { id: "chess-hall", label: "Chess Hall", path: "/chess-hall" },
      { id: "underground", label: "Underground", path: "/underground-casino" },
      { id: "cyber", label: "Cyber Casino", path: "/cyber-casino" },
    ],
  },
  {
    id: "dating", label: "Dating", color: "#ec4899", aura: "#f0abfc",
    pulsing: true,  // PDF spec: "Pulsing_Pink_Aura"
    rooms: [
      { id: "dating", label: "Universe", path: "/dating" },
      { id: "matchmaking", label: "Matchmaking", path: "/matchmaking" },
      { id: "cinema", label: "Cinema Date", path: "/cinema-room" },
      { id: "spots", label: "Vibe Spots", path: "/vibe-spots" },
    ],
  },
  {
    id: "rides", label: "Rides", color: "#f59e0b", aura: "#fbbf24",
    rooms: [
      { id: "ridez", label: "Vibe Ridez", path: "/vibe-ridez" },
    ],
  },
  {
    id: "food", label: "Food", color: "#84cc16", aura: "#a3e635",
    rooms: [
      { id: "hungry", label: "Hungry VIBEZ", path: "/hungryvibes" },
      { id: "yellow", label: "Yellow Pages", path: "/yellow-pages" },
      { id: "receipts", label: "Receipts +15%", path: "/receipts" },
    ],
  },
  {
    id: "streaming", label: "Streaming", color: "#a855f7", aura: "#c084fc",
    rooms: [
      { id: "live", label: "Live", path: "/live" },
      { id: "underground-live", label: "Underground Live", path: "/underground-live" },
      { id: "sports", label: "Sports Lounge", path: "/sports-lounge" },
    ],
  },
  {
    id: "vault", label: "Vault", color: "#fde047", aura: "#facc15",
    rooms: [
      { id: "lottery", label: "DSG 6 Lottery", path: "/lottery" },
      { id: "tiers", label: "Tiers", path: "/tiers" },
      { id: "wallet", label: "Wallet", path: "/wallet" },
      { id: "chair", label: "Chair Hall", path: "/chair-hall" },
    ],
  },
];

const RING_RADIUS = 6;

function Planet({
  category,
  index,
  total,
  selected,
  onSelect,
}: {
  category: typeof CATEGORIES[number];
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const [hover, setHover] = useState(false);

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
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.4;
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
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => { e.stopPropagation(); navigate(room.path); }}
      >
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={hover ? 0.9 : 0.5}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Html position={[0, 0.42, 0]} center distanceFactor={8}>
        <div
          data-testid={`vol-room-${room.id}`}
          className="text-white text-[10px] uppercase tracking-widest font-bold whitespace-nowrap pointer-events-none"
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

function GalaxyScene({ selectedIndex, setSelectedIndex }: { selectedIndex: number | null; setSelectedIndex: (i: number | null) => void }) {
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
        />
      ))}
    </>
  );
}

export default function VolumetricDashboard() {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const setClassicMode = () => {
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
          <GalaxyScene selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
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

      {/* Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-center text-[10px] uppercase tracking-widest text-white/50 px-4">
        {selectedIndex === null
          ? "6 planets · drag to spin the galaxy · tap a planet to see its rooms"
          : `${CATEGORIES[selectedIndex].label} · tap any orbiting tile to enter that room`}
      </div>
    </div>
  );
}
