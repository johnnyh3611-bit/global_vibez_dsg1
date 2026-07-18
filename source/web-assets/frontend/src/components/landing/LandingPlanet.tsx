/**
 * LandingPlanet — founder screenshot is the ONLY visual target.
 *
 * Exact layout (no in-between):
 *  1. Glass Earth hub on the right
 *  2. Little CONTINENT SHAPES inside the planet (VibeRide, Vibe Vineyards,
 *     Hungry Vibez, Dating, Logistics Hub, CDL/GDL, Home) — each its own
 *     landmass shape + icon/label tab → opens that dashboard
 *  3. ONE DSG fireball (fiery sun with DSG logo) circling the planet
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.05;
const SUN_ORBIT = 3.25;

/**
 * Continent tabs = glowing circular TILE orbs (founder style),
 * each a unique recognizable shape (car / pizza / truck / buildings…),
 * transparent outside the glow — no black square behind them.
 */
const HUB_ART: Partial<Record<HubId, { src: string; label: string; glow: string }>> = {
  ridez: { src: "/assets/hub-viberide.png", label: "VibeRide", glow: "#22d3ee" },
  vineyards: { src: "/assets/hub-vineyards.png", label: "Vibe Vineyards", glow: "#f9a8d4" },
  hungry: { src: "/assets/hub-hungry.png", label: "Hungry Vibez", glow: "#fb923c" },
  dating: { src: "/assets/hub-dating.png", label: "Dating", glow: "#fb7185" },
  viberise: { src: "/assets/hub-logistics.png", label: "Logistics Hub", glow: "#c084fc" },
  cdl: { src: "/assets/hub-cdl.png", label: "CDL / GDL", glow: "#fbbf24" },
  vibe: { src: "/assets/hub-home.png", label: "Home", glow: "#2dd4bf" },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.3;
  const lat = (0.5 - top) * Math.PI * 0.85;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.cos(lon) * radius,
  );
}

function GuideRings() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.045;
  });
  return (
    <group ref={g}>
      {[
        { r: 2.45, c: "#a78bfa", rot: [0.95, 0.15, 0.1] as const },
        { r: 2.7, c: "#f97316", rot: [1.15, -0.35, 0.05] as const },
        { r: 2.95, c: "#22d3ee", rot: [0.5, 0.55, -0.25] as const },
      ].map((ring) => (
        <mesh key={ring.r} rotation={[...ring.rot]}>
          <torusGeometry args={[ring.r, 0.011, 12, 180]} />
          <meshStandardMaterial
            color={ring.c}
            emissive={ring.c}
            emissiveIntensity={2.2}
            toneMapped={false}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Earth + shaped hub continents painted INSIDE + glass shell outside. */
function PlanetWithContinentsInside() {
  const [earth, clouds, continents] = useTexture([
    "/assets/earth-texture.jpg",
    "/assets/earth-clouds.jpg",
    "/assets/hub-continent-shapes.png",
  ]);
  const cloudRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
    continents.colorSpace = THREE.SRGBColorSpace;
    continents.anisotropy = 8;
  }, [earth, clouds, continents]);

  useFrame((_, dt) => {
    // Only clouds drift — continent shapes stay locked under their tabs
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.01;
  });

  return (
    <group>
      {/* Core Earth */}
      <mesh>
        <sphereGeometry args={[GLOBE_R * 0.97, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.82} metalness={0.06} />
      </mesh>

      {/* CONTINENT SHAPES living inside the planet (hub landmasses) */}
      <mesh scale={0.985}>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial
          map={continents}
          transparent
          opacity={0.35}
          depthWrite={false}
          emissive="#67e8f9"
          emissiveIntensity={0.12}
          emissiveMap={continents}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.01}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Glass shell over the continents */}
      <mesh scale={1.045}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshPhysicalMaterial
          color="#7dd3fc"
          transparent
          opacity={0.18}
          transmission={0.8}
          thickness={1}
          roughness={0.04}
          clearcoat={1}
          clearcoatRoughness={0.06}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={1.16}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Clickable continent tab seated ON its landmass (inside the glass).
 * Icon + name → dashboard.
 */
function ContinentTab({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_ART[hub.id];
  const map = useTexture(art?.src || "/assets/hub-home.png");
  // Sit on / just under the glass — reads as “inside” the planet
  const pos = useMemo(() => hubToSphere(hub, GLOBE_R * 1.02), [hub]);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  if (!art) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(hub);
  };

  return (
    <group position={pos}>
      {/* landmass hotspot glow */}
      <mesh>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial
          color={art.glow}
          emissive={art.glow}
          emissiveIntensity={3.8}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      {/* Glowing tile orb — style matches founder circular tiles */}
      <sprite
        scale={[0.95, 0.95, 1]}
        position={[0, 0.12, 0.05]}
        onClick={click}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <spriteMaterial
          map={map}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <Text
        position={[0, -0.42, 0.08]}
        fontSize={0.12}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.016}
        outlineColor="#000000"
        maxWidth={1.4}
        onClick={click}
      >
        {art.label}
      </Text>
    </group>
  );
}

function ContinentTabs({ onOpen }: { onOpen: (h: HubDef) => void }) {
  return (
    <group>
      {GLOBE_HUBS.map((hub) => (
        <ContinentTab key={hub.id} hub={hub} onOpen={onOpen} />
      ))}
    </group>
  );
}

/** ONE DSG fireball circling the planet — fiery sun + logo + fire ring. */
function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const fireRing = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const [glow, badge] = useTexture(["/assets/sun-glow.png", "/assets/dsg-sun-badge.png"]);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
    badge.colorSpace = THREE.SRGBColorSpace;
  }, [glow, badge]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      const a = t * 0.42;
      group.current.position.set(
        Math.cos(a) * SUN_ORBIT,
        Math.sin(a * 0.65) * 0.8,
        1.15 + Math.abs(Math.sin(a)) * SUN_ORBIT * 0.5,
      );
    }
    if (fireRing.current) fireRing.current.rotation.z = t * 2.4;
    if (core.current) {
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        9 + Math.sin(t * 8) * 1.8;
    }
    if (light.current) light.current.intensity = 5 + Math.sin(t * 6) * 0.8;
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff4500" intensity={5} distance={14} decay={2} />

      <sprite scale={[1.85, 1.85, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.95}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {/* Fire circling the DSG sun */}
      <mesh ref={fireRing} rotation={[Math.PI / 2.5, 0.35, 0]}>
        <torusGeometry args={[0.58, 0.05, 12, 64]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={7}
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </mesh>

      <sprite position={[-0.6, 0.06, 0]} scale={[1.15, 0.38, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#ff6a00"
        />
      </sprite>

      <mesh ref={core}>
        <sphereGeometry args={[0.32, 48, 48]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={10}
          toneMapped={false}
          roughness={0.1}
          depthTest={false}
        />
      </mesh>

      <sprite scale={[0.9, 0.9, 1]} position={[0, 0, 0.22]}>
        <spriteMaterial
          map={badge}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 4, 6]} intensity={1.15} />
      <pointLight position={[-4, -1, 3]} intensity={0.5} color="#a78bfa" />

      <Stars radius={55} depth={35} count={1400} factor={2.2} saturation={0.45} fade speed={0.3} />
      <Sparkles count={36} scale={8} size={2} speed={0.2} opacity={0.4} color="#c084fc" />

      <Suspense fallback={null}>
        <PlanetWithContinentsInside />
        <GuideRings />
        <ContinentTabs onOpen={onOpen} />
        {/* Only the DSG fireball orbits the planet */}
        <DsgFireball />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.4}
        minPolarAngle={Math.PI * 0.35}
        maxPolarAngle={Math.PI * 0.65}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.75} luminanceThreshold={0.14} luminanceSmoothing={0.55} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[260px] w-full max-w-[520px] items-center justify-center sm:h-[360px] lg:h-[540px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Home hub planet — continent tabs open dashboards; DSG fireball orbits"
    >
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
      <p
        data-testid="landing-planet-cta"
        className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] font-black uppercase tracking-[0.32em] sm:text-[10px] animate-pulse"
        style={{
          background: "linear-gradient(90deg,#67e8f9,#f9a8d4,#fbbf24,#67e8f9)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation: "landingCtaShift 2.4s ease-in-out infinite, pulse 1.6s ease-in-out infinite",
        }}
      >
        Tap a continent · hit your dashboard
      </p>
      <style>{`
        @keyframes landingCtaShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

export default LandingPlanet;
