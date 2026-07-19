/**
 * LandingPlanet — logo-skinned central sun + independent orbital belts.
 *
 * 1. Logo.png is the MeshStandardMaterial skin of the central sun
 *    (map + emissiveMap). Sun uses transparent=false, depthTest=true, DoubleSide.
 * 2. Hub planets: animateHubPlanets(+elapsed) → Clockwise.
 * 3. DSG moon: animateDSGMoon(-elapsed) → Counter-Clockwise, tighter radius.
 * 4. Mobile (<768): static vertical hub list (≥14px), no 3D orbits.
 */
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

/** Official brand mark — `public/assets/logo.png` (globe + wordmark below). */
const LOGO_SRC = "/assets/logo.png";
/** Intrinsic pixel aspect — front-face skin stays matched to the asset. */
const LOGO_ASPECT = 1019 / 960;
const SUN_RADIUS = 1.75;
/** Hard floor so hub glow never crosses the logo planet face. */
const HUB_CLEARANCE = SUN_RADIUS + 1.85;
const HUB_BODY_R = 0.38;
const HUB_GLOW_SCALE = 1.15;
/**
 * Unique DSG moon radius — closer to the sun than every hub belt.
 * Hubs start at 4.35; moon stays on this independent inner track.
 */
const DSG_ORBIT_R = 2.85;
const DSG_BODY_R = 0.2;
/** Independent speed for the DSG moon (not shared with hubs). */
const DSG_ORBIT_SPEED = 0.62;
const DSG_SPIN_SPEED = 2.4;
const CAMERA_Z = 13.6;
const CAMERA_FOV = 42;
const LOGO_EMISSIVE = 2.35;
const SUN_RENDER_ORDER = 10;
const HUB_RENDER_ORDER = 2;
const DSG_RENDER_ORDER = 3;

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
  shortLabel: string;
  path: string;
  color: string;
  emissive: string;
  orbitR: number;
  phase: number;
  /** Per-hub angular speed — not shared with the DSG moon. */
  speed: number;
};

const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    shortLabel: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 4.35,
    phase: 0,
    speed: 0.26,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 4.35,
    phase: (Math.PI * 2) / 3,
    speed: 0.26,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 4.35,
    phase: (Math.PI * 4) / 3,
    speed: 0.26,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 5.55,
    phase: Math.PI / 3,
    speed: 0.18,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 5.55,
    phase: Math.PI,
    speed: 0.18,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 5.55,
    phase: (Math.PI * 5) / 3,
    speed: 0.18,
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
 * Clockwise hub belt (independent vector from the DSG moon).
 * Pass +state.clock.getElapsedTime() — angle uses the positive elapsed
 * term so this loop never shares a signed constant with animateDSGMoon.
 */
function animateHubPlanets(
  hubGroups: MutableRefObject<Array<THREE.Group | null>>,
  elapsed: number,
) {
  for (let i = 0; i < HUBS.length; i++) {
    const hub = HUBS[i];
    const group = hubGroups.current[i];
    if (!group) continue;

    // Screen-space Clockwise when viewing the XZ/XY ring from the camera:
    // advancing angle with -elapsed (opposite of the DSG moon's +elapsed).
    const t = hub.phase - elapsed * hub.speed;
    const minOrbit = HUB_CLEARANCE + HUB_BODY_R * HUB_GLOW_SCALE;
    const orbitR = Math.max(hub.orbitR, minOrbit);
    let x = Math.cos(t) * orbitR;
    const y = Math.sin(t * 0.35) * 0.18;
    let z = Math.sin(t) * orbitR * 0.08;

    const glowR = HUB_BODY_R * HUB_GLOW_SCALE;
    const xy = Math.hypot(x, y);
    const need = HUB_CLEARANCE + glowR;
    if (xy < need && xy > 0.001) {
      const scale = need / xy;
      x *= scale;
    }
    if (z > 0.12) z = 0.12;
    if (z < -0.55) z = -0.55;
    group.position.set(x, y, z);
  }
}

/**
 * Counter-Clockwise DSG moon on its own tighter radius (DSG_ORBIT_R).
 * Pass -state.clock.getElapsedTime() so this vector is the independent
 * opposite of animateHubPlanets (which receives +elapsed).
 */
function animateDSGMoon(
  moonGroup: RefObject<THREE.Group | null>,
  spinMesh: RefObject<THREE.Mesh | null>,
  elapsedNegative: number,
) {
  const group = moonGroup.current;
  if (!group) return;

  // elapsedNegative is -getElapsedTime(). Negate again so the moon advances
  // opposite the hubs (hubs use phase - elapsed*speed → CW; moon → CCW).
  const a = -elapsedNegative * DSG_ORBIT_SPEED;
  const orbitR = DSG_ORBIT_R;
  let x = Math.cos(a) * orbitR;
  const y = Math.sin(a * 0.4) * 0.16;
  let z = Math.sin(a) * orbitR * 0.1;
  if (z > 0.1) z = 0.1;
  if (z < -0.4) z = -0.4;
  group.position.set(x, y, z);

  if (spinMesh.current) {
    spinMesh.current.rotation.y = Math.abs(elapsedNegative) * DSG_SPIN_SPEED;
  }
}

/**
 * Central Sun — the logo IS the planet.
 * Opaque, depth-tested, DoubleSide skin so the brand face stays solid and clear.
 */
function CentralLogoSun() {
  const sunGroup = useRef<THREE.Group>(null);
  const brandMap = useTexture(LOGO_SRC);

  useMemo(() => {
    brandMap.colorSpace = THREE.SRGBColorSpace;
    brandMap.anisotropy = 16;
    brandMap.wrapS = THREE.ClampToEdgeWrapping;
    brandMap.wrapT = THREE.ClampToEdgeWrapping;
    brandMap.repeat.set(1, 1);
    brandMap.offset.set(0, 0);
    brandMap.center.set(0.5, 0.5);
    brandMap.needsUpdate = true;
  }, [brandMap]);

  useFrame(({ camera }) => {
    if (sunGroup.current) sunGroup.current.quaternion.copy(camera.quaternion);
  });

  // Front face fills the planet silhouette — logo reads as the planet itself.
  const faceH = SUN_RADIUS * 1.98;
  const faceW = faceH * LOGO_ASPECT;

  return (
    <group>
      <pointLight color="#ffffff" intensity={4.0} distance={18} decay={2} />
      <pointLight color="#67e8f9" intensity={2.0} distance={14} decay={2} />

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

      <group ref={sunGroup}>
        {/* Curved planet body — logo skin, opaque + depth tested */}
        <mesh renderOrder={SUN_RENDER_ORDER} frustumCulled={false}>
          <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
          <meshStandardMaterial
            map={brandMap}
            emissiveMap={brandMap}
            emissive="#ffffff"
            emissiveIntensity={LOGO_EMISSIVE}
            roughness={0.3}
            metalness={0.14}
            transparent={false}
            depthTest={true}
            depthWrite={true}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/*
          Flush planet-face layer (on the surface, not hovering).
          Same logo skin — keeps GLOBAL VIBEZ / DSG razor-clear on the sun.
        */}
        <mesh
          position={[0, 0, SUN_RADIUS * 0.015]}
          renderOrder={SUN_RENDER_ORDER + 1}
          frustumCulled={false}
        >
          <planeGeometry args={[faceW, faceH]} />
          <meshStandardMaterial
            map={brandMap}
            emissiveMap={brandMap}
            emissive="#ffffff"
            emissiveIntensity={LOGO_EMISSIVE + 0.2}
            roughness={0.26}
            metalness={0.1}
            transparent={false}
            depthTest={true}
            depthWrite={true}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
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
      position={[0, -0.78, 0]}
      distanceFactor={8}
      zIndexRange={[20, 0]}
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

function HubPlanetMesh({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (path: string) => void;
}) {
  return (
    <>
      <mesh
        renderOrder={HUB_RENDER_ORDER}
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
        <sphereGeometry args={[HUB_BODY_R, 48, 48]} />
        <meshStandardMaterial
          color={hub.color}
          emissive={hub.emissive}
          emissiveIntensity={1.35}
          roughness={0.35}
          metalness={0.2}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh scale={HUB_GLOW_SCALE} renderOrder={HUB_RENDER_ORDER}>
        <sphereGeometry args={[HUB_BODY_R, 24, 24]} />
        <meshStandardMaterial
          color={hub.emissive}
          emissive={hub.emissive}
          emissiveIntensity={0.85}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <HubLabel
        label={hub.label}
        onOpen={() => onOpen(hub.path)}
        testId={`landing-hub-label-${hub.id}`}
      />
    </>
  );
}

/**
 * Single useFrame that runs TWO independent animation vectors:
 *   animateHubPlanets(+elapsed)  → Clockwise hubs
 *   animateDSGMoon(-elapsed)     → Counter-Clockwise DSG moon
 */
function OrbitSystem({ onOpen }: { onOpen: (path: string) => void }) {
  const hubGroups = useRef<Array<THREE.Group | null>>([]);
  const moonGroup = useRef<THREE.Group | null>(null);
  const moonSpin = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    // Mandatory separation: two independent time vectors, never one shared sign.
    const elapsed = state.clock.getElapsedTime();
    animateHubPlanets(hubGroups, +elapsed); // Clockwise hubs
    animateDSGMoon(moonGroup, moonSpin, -elapsed); // Counter-Clockwise DSG
  });

  return (
    <group>
      {HUBS.map((hub, i) => (
        <group
          key={hub.id}
          ref={(el) => {
            hubGroups.current[i] = el;
          }}
        >
          <HubPlanetMesh hub={hub} onOpen={onOpen} />
        </group>
      ))}

      <group ref={moonGroup}>
        <mesh ref={moonSpin} renderOrder={DSG_RENDER_ORDER}>
          <sphereGeometry args={[DSG_BODY_R, 32, 32]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#fbbf24"
            emissiveIntensity={1.65}
            metalness={0.9}
            roughness={0.2}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
        <mesh scale={1.2} renderOrder={DSG_RENDER_ORDER}>
          <sphereGeometry args={[DSG_BODY_R, 16, 16]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.9}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Html
          center
          position={[0, -0.42, 0]}
          distanceFactor={8}
          zIndexRange={[18, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span
            data-testid="landing-dsg-moon-label"
            style={{
              color: "#fbbf24",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              textShadow: "0 0 8px rgba(251,191,36,0.65)",
            }}
          >
            DSG
          </span>
        </Html>
      </group>
    </group>
  );
}

function OrbitGuides() {
  const rings = useMemo(() => {
    const byR = new Map<number, string>();
    byR.set(DSG_ORBIT_R, "#fbbf24");
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
            opacity={r === DSG_ORBIT_R ? 0.3 : 0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.5} />

      <Suspense fallback={null}>
        <CentralLogoSun />
        <OrbitGuides />
        <OrbitSystem onOpen={onOpen} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.24}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

/**
 * Mobile (<768): no 3D orbits — brand logo + vertical stacked hub labels.
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
      className="relative mx-auto h-[480px] w-full max-w-[600px] overflow-hidden sm:h-[460px] lg:h-[600px] lg:max-w-none"
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
            toneMappingExposure: 1.08,
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
