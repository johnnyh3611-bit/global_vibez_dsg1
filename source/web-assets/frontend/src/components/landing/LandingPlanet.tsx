/**
 * LandingPlanet — logo-mapped central sun + orbiting hub planets.
 *
 * 1. Central Body (Sun): large sphere textured with Global Vibez DSG logo
 *    (map + emissiveMap, emissive white @ 0.5, renderOrder 1).
 * 2. Orbiting hubs: Gaming, Dating, Streams — smaller spheres on fixed
 *    orbital radii with labels beneath + onClick → hub routes.
 * 3. DSG Token moon: small golden/metallic sphere orbiting Gaming.
 * 4. Mobile (<768): no 3D orbits — static horizontal flex of hub logos.
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
const SUN_RADIUS = 1.45;
const CAMERA_Z = 9;

type HubId = "gaming" | "dating" | "streams";

type HubDef = {
  id: HubId;
  label: string;
  path: string;
  color: string;
  emissive: string;
  orbitR: number;
  phase: number;
  speed: number;
};

const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 2.9,
    phase: 0,
    speed: 0.3,
  },
  {
    id: "dating",
    label: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 3.55,
    phase: (Math.PI * 2) / 3,
    speed: 0.24,
  },
  {
    id: "streams",
    label: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 4.2,
    phase: (Math.PI * 4) / 3,
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
 * Central Sun — large sphere with the official logo mapped onto its surface.
 * emissiveMap + white emissive keeps the mark legible in any lighting.
 */
function CentralLogoSun() {
  const sun = useRef<THREE.Mesh>(null);
  const map = useTexture(LOGO_SRC);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
  }, [map]);

  // Slow spin so the mapped logo reads as a living sun surface
  useFrame((_, dt) => {
    if (sun.current) sun.current.rotation.y += dt * 0.12;
  });

  return (
    <group>
      <pointLight color="#ffffff" intensity={3.2} distance={16} decay={2} />
      <pointLight color="#67e8f9" intensity={1.6} distance={12} decay={2} />

      <mesh ref={sun} renderOrder={1} frustumCulled={false}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ffffff"
          emissiveIntensity={0.5}
          roughness={0.4}
          metalness={0.15}
          toneMapped={false}
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
    const x = Math.cos(t) * hub.orbitR;
    const y = Math.sin(t * 0.35) * 0.25;
    const z = Math.sin(t) * hub.orbitR * 0.35;
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
  return (
    <group rotation={[Math.PI / 2.35, 0.1, 0]}>
      {HUBS.map((h) => (
        <mesh key={h.id} renderOrder={0}>
          <torusGeometry args={[h.orbitR, 0.006, 8, 96]} />
          <meshBasicMaterial
            color={h.emissive}
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

/** Mobile: static horizontal flex of hub logos — no 3D orbits, no scroll. */
function MobileHubStrip({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="landing-planet-mobile"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <img
          src={LOGO_SRC}
          alt="Global Vibez DSG"
          className="max-h-full w-auto max-w-[220px] object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.45)]"
          draggable={false}
        />
      </div>
      <nav
        className="flex w-full shrink-0 items-stretch justify-center gap-2 overflow-hidden border-t border-white/10 bg-black/80 px-2 py-2"
        aria-label="Hub destinations"
        data-testid="landing-planet-mobile-nav"
      >
        {HUBS.map((hub) => (
          <button
            key={hub.id}
            type="button"
            onClick={() => onOpen(hub.path)}
            data-testid={`landing-mobile-hub-${hub.id}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg px-1 py-2"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <span
              className="h-8 w-8 rounded-full shadow-lg"
              style={{
                background: `radial-gradient(circle at 35% 30%, #fff 0%, ${hub.emissive} 35%, ${hub.color} 100%)`,
                boxShadow: `0 0 12px ${hub.emissive}`,
              }}
              aria-hidden
            />
            <span className="w-full truncate text-center text-sm font-bold uppercase tracking-wide text-white">
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
      className="relative mx-auto h-[300px] w-full max-w-[520px] overflow-hidden sm:h-[400px] lg:h-[540px] lg:max-w-none"
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
