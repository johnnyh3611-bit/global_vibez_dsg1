/**
 * LandingPlanet — production landing-hero hub.
 *
 * Matches the Global Vibez DSG reference:
 *  • Photoreal Earth + cloud shell + glass energy cage
 *  • Neon hub “continents” as glowing 3D icon pins (VibeRide, Dating, Hungry…)
 *  • Fiery DSG mini-sun with bloom, corona, and comet trail
 *
 * Textures live in /public/assets/ (served as /assets/…).
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  Sparkles,
  Stars,
  useTexture,
} from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  Building2,
  Car,
  Heart,
  Home,
  Truck,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 1.55;
const SUN_ORBIT = 2.45;

type HubVisual = {
  Icon: LucideIcon;
  label: string;
  glow: string;
  tint: string;
};

const HUB_VISUAL: Partial<Record<HubId, HubVisual>> = {
  vibe: { Icon: Home, label: "Home", glow: "#22d3ee", tint: "from-cyan-500/40 to-sky-900/70" },
  ridez: { Icon: Car, label: "VibeRide", glow: "#22d3ee", tint: "from-cyan-400/50 to-blue-900/80" },
  cdl: { Icon: Truck, label: "CDL / GDL", glow: "#fbbf24", tint: "from-amber-400/50 to-yellow-900/80" },
  viberise: {
    Icon: Building2,
    label: "Logistics Hub",
    glow: "#c084fc",
    tint: "from-violet-400/50 to-purple-950/80",
  },
  dating: { Icon: Heart, label: "Dating", glow: "#fb7185", tint: "from-rose-400/55 to-pink-950/80" },
  hungry: {
    Icon: UtensilsCrossed,
    label: "Hungry",
    glow: "#fb923c",
    tint: "from-orange-400/55 to-red-950/80",
  },
  vineyards: { Icon: Wine, label: "Vineyards", glow: "#f9a8d4", tint: "from-rose-300/40 to-fuchsia-950/70" },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.4;
  const lat = (0.5 - top) * Math.PI * 0.95;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.cos(lon) * radius,
  );
}

function EnergyRings() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.08;
  });
  return (
    <group ref={group}>
      {[
        { r: 1.78, color: "#a78bfa", tilt: [0.9, 0.15, 0.2] as const },
        { r: 1.95, color: "#f97316", tilt: [1.15, -0.35, 0.1] as const },
        { r: 2.12, color: "#22d3ee", tilt: [0.55, 0.55, -0.25] as const },
      ].map((ring) => (
        <mesh key={ring.r} rotation={[...ring.tilt]}>
          <torusGeometry args={[ring.r, 0.01, 16, 180]} />
          <meshStandardMaterial
            color={ring.color}
            emissive={ring.color}
            emissiveIntensity={2.4}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function EarthGlobe() {
  const [day, normal, specular, clouds] = useTexture([
    "/assets/earth-day.jpg",
    "/assets/earth-normal.jpg",
    "/assets/earth-specular.jpg",
    "/assets/earth-clouds.jpg",
  ]);
  const cloudRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
    clouds.anisotropy = 4;
  }, [day, clouds]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.02;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial
          map={day}
          normalMap={normal}
          roughnessMap={specular}
          metalness={0.15}
          roughness={0.72}
          emissive="#0b3a4a"
          emissiveIntensity={0.12}
        />
      </mesh>

      {/* Soft city-light night wash on the dark limb */}
      <mesh scale={1.002}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.018}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          map={clouds}
          transparent
          opacity={0.38}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Glass energy shell */}
      <mesh scale={1.055}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshPhysicalMaterial
          color="#67e8f9"
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0.2}
          transmission={0.65}
          thickness={0.55}
          clearcoat={1}
          clearcoatRoughness={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere rim */}
      <mesh scale={1.14}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function HubIconPin({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (hub: HubDef) => void;
}) {
  const visual = HUB_VISUAL[hub.id];
  if (!visual) return null;
  const pos = useMemo(() => hubToSphere(hub, GLOBE_R * 1.08), [hub]);
  const Icon = visual.Icon;

  return (
    <group position={pos}>
      {/* Neon pedestal under the icon */}
      <mesh>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial
          color={visual.glow}
          emissive={visual.glow}
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>
      <Html
        center
        distanceFactor={7.5}
        zIndexRange={[50, 0]}
        style={{ pointerEvents: "auto", transform: "translateY(-18px)" }}
      >
        <button
          type="button"
          data-testid={hub.testid}
          title={`${hub.label} dashboard`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(hub);
          }}
          className={`group flex w-[72px] flex-col items-center gap-1 rounded-xl border border-white/25 bg-gradient-to-b ${visual.tint} px-1.5 py-1.5 shadow-[0_0_22px_var(--glow)] backdrop-blur-md transition hover:scale-110 hover:border-white/60`}
          style={{ ["--glow" as string]: `${visual.glow}99` }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-black/45"
            style={{
              boxShadow: `0 0 16px ${visual.glow}, inset 0 0 10px ${visual.glow}66`,
              color: visual.glow,
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span
            className="text-[8px] font-black uppercase tracking-[0.12em] text-white"
            style={{ textShadow: `0 0 8px ${visual.glow}, 0 0 2px #000` }}
          >
            {visual.label}
          </span>
        </button>
      </Html>
    </group>
  );
}

function HubPins({ onOpen }: { onOpen: (hub: HubDef) => void }) {
  return (
    <group>
      {GLOBE_HUBS.map((hub) => (
        <HubIconPin key={hub.id} hub={hub} onOpen={onOpen} />
      ))}
    </group>
  );
}

/** Mini-sun DSG — bright corona + comet trail + logo badge. */
function DsgMiniSun() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useTexture("/assets/sun-glow.png");
  const trail = useRef<THREE.Group>(null);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
  }, [glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      // Elliptical front-biased orbit so the sun never vanishes behind Earth
      const a = t * 0.42;
      const x = Math.cos(a) * SUN_ORBIT;
      const y = Math.sin(a * 0.65) * 0.55 - 0.15;
      const z = 0.85 + Math.abs(Math.sin(a)) * SUN_ORBIT * 0.55;
      group.current.position.set(x, y, z);
      // Aim trail opposite orbital tangent
      const tx = -Math.sin(a);
      const tz = Math.cos(a) * Math.sign(Math.sin(a) || 1);
      if (trail.current) {
        trail.current.lookAt(
          group.current.position.x + tx,
          group.current.position.y,
          group.current.position.z + tz,
        );
      }
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 5.5 + Math.sin(t * 8) * 1.2;
    }
    if (light.current) {
      light.current.intensity = 3.2 + Math.sin(t * 6) * 0.6;
    }
  });

  return (
    <group ref={group} renderOrder={30}>
      <pointLight ref={light} color="#fb923c" intensity={3.4} distance={8} decay={2} />

      {/* Comet / flame trail */}
      <group ref={trail}>
        {[0.35, 0.65, 1.0, 1.4].map((d, i) => (
          <sprite key={d} position={[0, 0, -d]} scale={[0.85 - i * 0.12, 0.45 - i * 0.06, 1]}>
            <spriteMaterial
              map={glow}
              transparent
              opacity={0.7 - i * 0.12}
              depthWrite={false}
              depthTest={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              color={i < 2 ? "#fff7ed" : "#ef4444"}
            />
          </sprite>
        ))}
      </group>

      {/* Soft corona sprites */}
      <sprite scale={[1.35, 1.35, 1]} renderOrder={31}>
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
      <sprite scale={[2.1, 2.1, 1]} renderOrder={30}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.45}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#f97316"
        />
      </sprite>

      {/* Hot core */}
      <mesh ref={core} renderOrder={32}>
        <sphereGeometry args={[0.2, 48, 48]} />
        <meshStandardMaterial
          color="#fdba74"
          emissive="#ef4444"
          emissiveIntensity={6}
          roughness={0.15}
          metalness={0.05}
          toneMapped={false}
          depthTest={false}
        />
      </mesh>

      {/* DSG emblem badge */}
      <Html center distanceFactor={5.2} zIndexRange={[80, 0]} style={{ pointerEvents: "none" }}>
        <div
          data-testid="landing-planet-dsg-sun"
          className="flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 border-amber-200/80 bg-gradient-to-b from-yellow-300 via-orange-500 to-red-700 shadow-[0_0_28px_rgba(249,115,22,0.95),0_0_48px_rgba(239,68,68,0.7)]"
        >
          <span
            aria-hidden
            className="mb-0.5 h-2.5 w-2 rounded-full bg-gradient-to-t from-red-700 via-amber-300 to-white"
            style={{ boxShadow: "0 0 8px #fff, 0 0 12px #f97316" }}
          />
          <span className="text-[9px] font-black tracking-[0.18em] text-black">DSG</span>
        </div>
      </Html>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[5, 3, 4]} intensity={1.35} color="#e0f2fe" />
      <pointLight position={[-4, -1, 3]} intensity={0.55} color="#a78bfa" />

      <Stars radius={40} depth={30} count={1200} factor={2.2} saturation={0.4} fade speed={0.4} />
      <Sparkles count={40} scale={6} size={2} speed={0.25} opacity={0.45} color="#c084fc" />

      <Suspense fallback={null}>
        <EarthGlobe />
        <EnergyRings />
        <HubPins onOpen={onOpen} />
        <DsgMiniSun />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.35}
        minPolarAngle={Math.PI * 0.35}
        maxPolarAngle={Math.PI * 0.65}
      />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.35}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.7}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[240px] w-full max-w-[460px] items-center justify-center sm:h-[340px] lg:h-[520px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez hub planet — tap a continent icon to open its dashboard"
    >
      <Canvas
        camera={{ position: [0, 0.2, 5.2], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] uppercase tracking-[0.32em] text-cyan-100/80 sm:text-[10px]">
        Tap a continent · your dashboard
      </p>
    </div>
  );
}

export default LandingPlanet;
