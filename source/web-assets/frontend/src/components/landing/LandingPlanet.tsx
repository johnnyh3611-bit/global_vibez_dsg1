/**
 * LandingPlanet — logo-mapped central sun + orbiting hub planets.
 *
 * 1. Central Sun: official mark at /assets/logo.png on MeshStandardMaterial
 *    (map + emissiveMap, glowing emissiveIntensity).
 * 2. Orbiting hubs stay outside HUB_CLEARANCE so they never cover the logo.
 * 3. DSG Token moon orbits Gaming.
 * 4. Mobile (<768): static vertical hub list (≥14px), no 3D orbits.
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

/** Official brand mark — `public/assets/logo.png` (globe + wordmark below). */
const LOGO_SRC = "/assets/logo.png";
/** Intrinsic pixel aspect of logo.png — keep billboard geometry matched. */
const LOGO_ASPECT = 1019 / 960;
/** Large enough that hub orbits stay clear of the brand mark. */
const SUN_RADIUS = 1.75;
/** Keep hubs outside this XY radius so they never cover the logo face. */
const HUB_CLEARANCE = SUN_RADIUS + 1.25;
/** Pull back so the full brand billboard + outer hub belt stay in frustum. */
const CAMERA_Z = 12.4;
const CAMERA_FOV = 42;
const LOGO_EMISSIVE = 1.15;

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
 * Central Sun — emissive shell + full brand mark on a camera-facing plane
 * *in front of* the sphere surface (toward the camera).
 *
 * logo.png lays out globe (upper) + "GLOBAL VIBEZ" / "DSG" (lower). Mapping
 * that whole sheet onto sphere UVs wraps the wordmark around the equator and
 * clips it to fragments like "GLOB". Never put the wordmark on sphere UVs —
 * the billboard carries the complete mark with ClampToEdgeWrapping.
 */
function CentralLogoSun() {
  const sun = useRef<THREE.Mesh>(null);
  const billboard = useRef<THREE.Mesh>(null);
  const brandMap = useTexture(LOGO_SRC);

  useMemo(() => {
    brandMap.colorSpace = THREE.SRGBColorSpace;
    brandMap.anisotropy = 8;
    brandMap.wrapS = THREE.ClampToEdgeWrapping;
    brandMap.wrapT = THREE.ClampToEdgeWrapping;
    brandMap.repeat.set(1, 1);
    brandMap.offset.set(0, 0);
    brandMap.center.set(0.5, 0.5);
    brandMap.needsUpdate = true;
  }, [brandMap]);

  useFrame(({ camera }, dt) => {
    if (sun.current) sun.current.rotation.y += dt * 0.08;
    // Keep the full brand mark locked toward the viewer.
    if (billboard.current) billboard.current.quaternion.copy(camera.quaternion);
  });

  // Aspect-correct plane: tall enough for globe + GLOBAL VIBEZ + DSG.
  const brandH = SUN_RADIUS * 2.2;
  const brandW = brandH * LOGO_ASPECT;
  // Must sit outside the sphere shell (toward +Z / camera), not inside it.
  const brandZ = SUN_RADIUS + 0.16;

  return (
    <group>
      <pointLight color="#ffffff" intensity={3.6} distance={18} decay={2} />
      <pointLight color="#67e8f9" intensity={1.8} distance={14} decay={2} />

      {/* Glow shell only — no wordmark UVs (avoids GLOB truncation). */}
      <mesh ref={sun} renderOrder={1} frustumCulled={false}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <meshStandardMaterial
          color="#0a1628"
          emissive="#22d3ee"
          emissiveIntensity={0.55}
          roughness={0.4}
          metalness={0.35}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.06} renderOrder={0} frustumCulled={false}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Full brand mark — in front of the sun, fully in camera frustum */}
      <mesh
        ref={billboard}
        position={[0, 0, brandZ]}
        renderOrder={5}
        frustumCulled={false}
      >
        <planeGeometry args={[brandW, brandH]} />
        <meshStandardMaterial
          map={brandMap}
          emissiveMap={brandMap}
          emissive="#ffffff"
          emissiveIntensity={LOGO_EMISSIVE + 0.4}
          transparent
          opacity={1}
          depthTest
          depthWrite={false}
          toneMapped={false}
          side={THREE.FrontSide}
          alphaTest={0.05}
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
      zIndexRange={[40, 0]}
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
      className="relative mx-auto h-[460px] w-full max-w-[560px] overflow-hidden sm:h-[440px] lg:h-[580px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo sun with orbiting hubs"
    >
      {isMobile ? (
        <MobileHubStrip onOpen={onOpen} />
      ) : (
        <Canvas
          camera={{
            position: [0, 0.2, CAMERA_Z],
            fov: CAMERA_FOV,
            near: 0.1,
            far: 100,
          }}
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
          }}
        >
          <Scene onOpen={onOpen} />
        </Canvas>
      )}
    </div>
  );
}

export default LandingPlanet;
