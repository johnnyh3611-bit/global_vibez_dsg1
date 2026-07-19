/**
 * LandingPlanet — logo-mapped central sun + orbiting hub planets.
 *
 * 1. Central Body (Sun): large sphere textured with Global Vibez DSG logo
 *    (map + emissiveMap, emissive white @ 0.5, renderOrder 1).
 * 2. Orbiting hubs: Gaming, Dating, Streams, Vibe Rides, Vibe Vineyards,
 *    Hungry Vibez — smaller spheres on fixed orbital radii with labels
 *    beneath + onClick → hub routes.
 * 3. DSG Token moon: small golden/metallic sphere orbiting Gaming.
 * 4. Mobile (<768): no 3D orbits — vertical stacked hub labels (≥14px).
 */
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

/** Official brand mark (CRA serves from /public) */
const LOGO_SRC = "/global-vibez-logo.png";
/** Large enough that hub orbits stay clear of the brand mark. */
const SUN_RADIUS = 1.7;
/** Keep hubs outside this XY radius so they never cover the logo face. */
const HUB_CLEARANCE = SUN_RADIUS + 1.05;
const CAMERA_Z = 10.5;

type HubId =
  | "gaming"
  | "dating"
  | "streams"
  | "ridez"
  | "vineyards"
  | "hungry";

type HubDef = {
  id: HubId;
  label: string;
  /** Shorter label for tight mobile cells */
  shortLabel: string;
  path: string;
  color: string;
  emissive: string;
  orbitR: number;
  phase: number;
  speed: number;
};

/** Six lifestyle hubs evenly phased across two orbital belts. */
const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    shortLabel: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 3.35,
    phase: 0,
    speed: 0.28,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 3.35,
    phase: (Math.PI * 2) / 3,
    speed: 0.28,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 3.35,
    phase: (Math.PI * 4) / 3,
    speed: 0.28,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 4.45,
    phase: Math.PI / 3,
    speed: 0.2,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 4.45,
    phase: Math.PI,
    speed: 0.2,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 4.45,
    phase: (Math.PI * 5) / 3,
    speed: 0.2,
  },
];

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false,
  );
  useEffect(() => {
    const sync = () => setMobile(window.innerWidth < bp);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [bp]);
  return mobile;
}

/**
 * Central Sun — logo on MeshStandardMaterial (map + emissiveMap) plus a
 * camera-facing billboard so the brand mark stays perfectly legible even
 * as the sphere slowly spins. Hubs orbit outside HUB_CLEARANCE.
 */
function CentralLogoSun() {
  const sun = useRef<THREE.Mesh>(null);
  const billboard = useRef<THREE.Mesh>(null);
  const map = useTexture(LOGO_SRC);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
  }, [map]);

  useFrame(({ camera }, dt) => {
    if (sun.current) sun.current.rotation.y += dt * 0.1;
    // Keep the logo face locked toward the viewer for branding clarity.
    if (billboard.current) billboard.current.quaternion.copy(camera.quaternion);
  });

  const logoSize = SUN_RADIUS * 1.55;

  return (
    <group>
      <pointLight color="#ffffff" intensity={3.6} distance={18} decay={2} />
      <pointLight color="#67e8f9" intensity={1.8} distance={14} decay={2} />

      <mesh ref={sun} renderOrder={1} frustumCulled={false}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ffffff"
          emissiveIntensity={0.75}
          roughness={0.35}
          metalness={0.12}
          toneMapped={false}
        />
      </mesh>

      {/* Front-facing logo plane — glowing brand mark, never occluded by hubs */}
      <mesh
        ref={billboard}
        position={[0, 0, SUN_RADIUS * 0.15]}
        renderOrder={4}
        frustumCulled={false}
      >
        <planeGeometry args={[logoSize, logoSize]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ffffff"
          emissiveIntensity={1.05}
          transparent
          opacity={0.98}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function HubLabel({
  label,
  onOpen,
  testId,
}: {
  label: string;
  onOpen: () => void;
  testId: string;
}) {
  return (
    <Html
      center
      position={[0, -0.62, 0]}
      distanceFactor={8}
      zIndexRange={[50, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        data-testid={testId}
        style={{
          background: "rgba(0,0,0,0.5)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          cursor: "pointer",
          lineHeight: 1.2,
        }}
      >
        {label}
      </button>
    </Html>
  );
}

function OrbitingHub({
  hub,
  onOpen,
  gamingRef,
}: {
  hub: HubDef;
  onOpen: (path: string) => void;
  /** Expose Gaming world position so the DSG moon can orbit it */
  gamingRef?: MutableRefObject<THREE.Vector3>;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime() * hub.speed + hub.phase;
    let x = Math.cos(t) * hub.orbitR;
    const y = Math.sin(t * 0.35) * 0.22;
    // Shallow Z so hubs stay in a ring around the sun, not in front of it.
    let z = Math.sin(t) * hub.orbitR * 0.12;
    // Hard clearance: never let a hub cross the logo face in XY.
    const xy = Math.hypot(x, y);
    if (xy < HUB_CLEARANCE && xy > 0.001) {
      const scale = HUB_CLEARANCE / xy;
      x *= scale;
    }
    // Prefer hubs slightly behind the sun when they would sit in front.
    if (z > 0.35) z = 0.35;
    group.current.position.set(x, y, z);
    if (hub.id === "gaming" && gamingRef) {
      gamingRef.current.set(x, y, z);
    }
  });

  return (
    <group ref={group}>
      <mesh
        renderOrder={2}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(hub.path);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.38, 48, 48]} />
        <meshStandardMaterial
          color={hub.color}
          emissive={hub.emissive}
          emissiveIntensity={1.6}
          roughness={0.35}
          metalness={0.2}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh scale={1.15} renderOrder={2}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial
          color={hub.emissive}
          emissive={hub.emissive}
          emissiveIntensity={1.1}
          transparent
          opacity={0.25}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Label sits below the sphere — not intersecting */}
      <HubLabel
        label={hub.label}
        onOpen={() => onOpen(hub.path)}
        testId={`landing-hub-label-${hub.id}`}
      />
    </group>
  );
}

/** Golden metallic DSG token — orbits the Gaming hub as a moon. */
function DsgTokenMoon({
  gamingPos,
}: {
  gamingPos: MutableRefObject<THREE.Vector3>;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const host = gamingPos.current;
    const a = t * 1.35;
    const moonR = 0.85;
    if (group.current) {
      group.current.position.set(
        host.x + Math.cos(a) * moonR,
        host.y + Math.sin(a * 1.2) * 0.2,
        host.z + Math.sin(a) * moonR * 0.55,
      );
    }
    if (spin.current) spin.current.rotation.y = t * 2;
  });

  return (
    <group ref={group}>
      <mesh ref={spin} renderOrder={3}>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={1.8}
          metalness={0.9}
          roughness={0.2}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
    </group>
  );
}

function OrbitGuides() {
  const rings = useMemo(() => {
    const byR = new Map<number, string>();
    for (const h of HUBS) {
      if (!byR.has(h.orbitR)) byR.set(h.orbitR, h.emissive);
    }
    return [...byR.entries()];
  }, []);

  return (
    <group rotation={[Math.PI / 2.35, 0.1, 0]}>
      {rings.map(([r, color]) => (
        <mesh key={`ring-${r}`} renderOrder={0}>
          <torusGeometry args={[r, 0.006, 8, 96]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ onOpen }: { onOpen: (path: string) => void }) {
  const gamingPos = useRef(new THREE.Vector3(2.9, 0, 0));

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.45} />

      <Suspense fallback={null}>
        <CentralLogoSun />
        <OrbitGuides />
        {HUBS.map((hub) => (
          <OrbitingHub
            key={hub.id}
            hub={hub}
            onOpen={onOpen}
            gamingRef={hub.id === "gaming" ? gamingPos : undefined}
          />
        ))}
        <DsgTokenMoon gamingPos={gamingPos} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

/**
 * Mobile (<768): no 3D orbits — brand logo + vertical stacked hub labels.
 * Labels stay ≥14px and never scale down to illegibility.
 */
function MobileHubStrip({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="landing-planet-mobile"
    >
      <div className="flex min-h-0 shrink-0 items-center justify-center px-4 py-3">
        <img
          src={LOGO_SRC}
          alt="Global Vibez DSG"
          className="max-h-[120px] w-auto max-w-[200px] object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.45)]"
          draggable={false}
        />
      </div>
      <nav
        className="grid w-full min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto border-t border-white/10 bg-black/80 px-3 py-3"
        aria-label="Hub destinations"
        data-testid="landing-planet-mobile-nav"
      >
        {HUBS.map((hub) => (
          <button
            key={hub.id}
            type="button"
            title={hub.label}
            onClick={() => onOpen(hub.path)}
            data-testid={`landing-mobile-hub-${hub.id}`}
            className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <span
              className="h-8 w-8 shrink-0 rounded-full shadow-lg"
              style={{
                background: `radial-gradient(circle at 35% 30%, #fff 0%, ${hub.emissive} 35%, ${hub.color} 100%)`,
                boxShadow: `0 0 12px ${hub.emissive}`,
              }}
              aria-hidden
            />
            <span
              className="min-w-0 flex-1 text-left font-bold uppercase tracking-wide text-white"
              style={{ fontSize: 14, lineHeight: 1.3 }}
            >
              {hub.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function LandingPlanet() {
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const onOpen = (path: string) => navigate(path);

  return (
    <div
      className="relative mx-auto h-[420px] w-full max-w-[520px] overflow-hidden sm:h-[400px] lg:h-[540px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo sun with orbiting hubs"
      style={{ overflow: "hidden" }}
    >
      {isMobile ? (
        <MobileHubStrip onOpen={onOpen} />
      ) : (
        <Canvas
          camera={{ position: [0, 0.35, CAMERA_Z], fov: 40, near: 0.1, far: 100 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          style={{
            width: "100%",
            height: "100%",
            background: "#000000",
            overflow: "hidden",
          }}
        >
          <Scene onOpen={onOpen} />
        </Canvas>
      )}
    </div>
  );
}

export default LandingPlanet;
