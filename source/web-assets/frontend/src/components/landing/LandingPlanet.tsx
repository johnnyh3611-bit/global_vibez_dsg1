/**
 * LandingPlanet — logo billboard sun + hub satellites on true orbital rings.
 *
 * 1. Central core is the official logo plane inside <Billboard> (no sphere).
 * 2. Hubs orbit Clockwise around the logo (+elapsed) on a horizontal ring.
 * 3. DSG moon orbits Counter-Clockwise (-elapsed) on a tighter ring.
 * 4. Mobile (<768): stacked hub list, no 3D orbits.
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
import { Billboard, Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

const LOGO_SRC = "/assets/logo.png";
/** Intrinsic pixel aspect of logo.png */
const LOGO_ASPECT = 1019 / 960;
/**
 * Base logo plane size, then +20% so it is the unmistakable page anchor.
 * (No sphere — the logo itself is the sun.)
 */
const LOGO_BASE_H = 3.45;
const LOGO_SCALE = 1.2;
const LOGO_H = LOGO_BASE_H * LOGO_SCALE;
const LOGO_W = LOGO_H * LOGO_ASPECT;
/** Keep every satellite outside the logo disk (+ glow margin). */
const LOGO_CLEARANCE = Math.hypot(LOGO_W, LOGO_H) * 0.5 + 0.55;

const HUB_BODY_R = 0.38;
const HUB_GLOW_SCALE = 1.15;
/** Unique tighter DSG track — always inside the hub belts. */
const DSG_ORBIT_R = 3.15;
const DSG_BODY_R = 0.22;
const DSG_ORBIT_SPEED = 0.55;
const DSG_SPIN_SPEED = 2.2;

const CAMERA_Z = 14.2;
const CAMERA_FOV = 42;
const LOGO_EMISSIVE = 2.4;
const LOGO_RENDER_ORDER = 10;
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
    orbitR: 4.55,
    phase: 0,
    speed: 0.24,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 4.55,
    phase: (Math.PI * 2) / 3,
    speed: 0.24,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 4.55,
    phase: (Math.PI * 4) / 3,
    speed: 0.24,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 5.85,
    phase: Math.PI / 3,
    speed: 0.16,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 5.85,
    phase: Math.PI,
    speed: 0.16,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 5.85,
    phase: (Math.PI * 5) / 3,
    speed: 0.16,
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
 * Place a body on a horizontal ring around the logo (XZ plane).
 * Viewed from above (+Y): increasing angle with z = -sin → Clockwise.
 * Slight Y bob only — never cuts through the logo plane.
 */
function placeOnRing(
  angle: number,
  orbitR: number,
  out: THREE.Vector3,
  bob = 0.14,
) {
  const r = Math.max(orbitR, LOGO_CLEARANCE);
  const x = Math.cos(angle) * r;
  const z = -Math.sin(angle) * r;
  const y = Math.sin(angle * 0.85) * bob;
  out.set(x, y, z);
}

/**
 * Hub belt — Clockwise.
 * MUST be called with +state.clock.getElapsedTime().
 */
function animateHubPlanets(
  hubGroups: MutableRefObject<Array<THREE.Group | null>>,
  elapsedPositive: number,
  scratch: THREE.Vector3,
) {
  for (let i = 0; i < HUBS.length; i++) {
    const hub = HUBS[i];
    const group = hubGroups.current[i];
    if (!group) continue;
    const angle = hub.phase + elapsedPositive * hub.speed;
    const minR = LOGO_CLEARANCE + HUB_BODY_R * HUB_GLOW_SCALE;
    placeOnRing(angle, Math.max(hub.orbitR, minR), scratch, 0.16);
    group.position.copy(scratch);
  }
}

/**
 * DSG moon — Counter-Clockwise on its own tighter radius.
 * MUST be called with -state.clock.getElapsedTime().
 */
function animateDSGMoon(
  moonGroup: RefObject<THREE.Group | null>,
  spinMesh: RefObject<THREE.Mesh | null>,
  elapsedNegative: number,
  scratch: THREE.Vector3,
) {
  const group = moonGroup.current;
  if (!group) return;
  // elapsedNegative is already -getElapsedTime(); advancing this angle
  // runs opposite the hubs' (+elapsed) ring.
  const angle = elapsedNegative * DSG_ORBIT_SPEED;
  const r = Math.min(
    DSG_ORBIT_R,
    Math.min(...HUBS.map((h) => h.orbitR)) - 1.1,
  );
  placeOnRing(angle, Math.max(r, LOGO_CLEARANCE + 0.15), scratch, 0.12);
  group.position.copy(scratch);
  if (spinMesh.current) {
    spinMesh.current.rotation.y = Math.abs(elapsedNegative) * DSG_SPIN_SPEED;
  }
}

/**
 * Central core — official logo plane in a <Billboard>.
 * No sphere. The logo IS the sun.
 */
function CentralLogoBillboard() {
  const brandMap = useTexture(LOGO_SRC);

  useMemo(() => {
    brandMap.colorSpace = THREE.SRGBColorSpace;
    brandMap.anisotropy = 16;
    brandMap.wrapS = THREE.ClampToEdgeWrapping;
    brandMap.wrapT = THREE.ClampToEdgeWrapping;
    brandMap.repeat.set(1, 1);
    brandMap.offset.set(0, 0);
    brandMap.needsUpdate = true;
  }, [brandMap]);

  return (
    <group>
      <pointLight color="#ffffff" intensity={3.8} distance={18} decay={2} />
      <pointLight color="#67e8f9" intensity={1.9} distance={14} decay={2} />

      {/* Soft glow disc behind the logo — not a planet sphere */}
      <Billboard follow>
        <mesh renderOrder={0} position={[0, 0, -0.02]}>
          <circleGeometry args={[LOGO_H * 0.58, 48]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.16}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      <Billboard follow>
        <mesh renderOrder={LOGO_RENDER_ORDER} frustumCulled={false}>
          <planeGeometry args={[LOGO_W, LOGO_H]} />
          <meshStandardMaterial
            map={brandMap}
            emissiveMap={brandMap}
            emissive={0xffffff}
            emissiveIntensity={LOGO_EMISSIVE}
            transparent={true}
            depthTest={true}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            alphaTest={0.02}
          />
        </mesh>
      </Billboard>
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
      position={[0, -0.72, 0]}
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
 * One useFrame, two independent time vectors:
 *   hubs  → +elapsed  (Clockwise around the logo)
 *   DSG   → -elapsed  (Counter-Clockwise, tighter ring)
 */
function OrbitSystem({ onOpen }: { onOpen: (path: string) => void }) {
  const hubGroups = useRef<Array<THREE.Group | null>>([]);
  const moonGroup = useRef<THREE.Group | null>(null);
  const moonSpin = useRef<THREE.Mesh | null>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    animateHubPlanets(hubGroups, +elapsed, scratch);
    animateDSGMoon(moonGroup, moonSpin, -elapsed, scratch);
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
            emissiveIntensity={1.7}
            metalness={0.9}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>
        <mesh scale={1.25} renderOrder={DSG_RENDER_ORDER}>
          <sphereGeometry args={[DSG_BODY_R, 16, 16]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.95}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Html
          center
          position={[0, -0.45, 0]}
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

/** Horizontal ring guides in the same XZ plane as the satellites. */
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
    <group rotation={[Math.PI / 2, 0, 0]}>
      {rings.map(([r, color]) => (
        <mesh key={`ring-${r}`} renderOrder={0}>
          <torusGeometry args={[r, 0.007, 8, 128]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={r === DSG_ORBIT_R ? 0.32 : 0.16}
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
      <ambientLight intensity={0.55} />

      <Suspense fallback={null}>
        <CentralLogoBillboard />
        <OrbitGuides />
        <OrbitSystem onOpen={onOpen} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

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
          className="max-h-[140px] w-auto max-w-[220px] object-contain drop-shadow-[0_0_28px_rgba(34,211,238,0.45)]"
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
      className="relative mx-auto h-[500px] w-full max-w-[640px] overflow-hidden sm:h-[480px] lg:h-[620px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo sun with orbiting hubs"
    >
      {isMobile ? (
        <MobileHubStrip onOpen={onOpen} />
      ) : (
        <Canvas
          camera={{
            position: [0, 2.4, CAMERA_Z],
            fov: CAMERA_FOV,
            near: 0.1,
            far: 100,
          }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{
            width: "100%",
            height: "100%",
            background: "#000000",
          }}
        >
          {/* Slight top-down so rings read as orbiting around the logo */}
          <Scene onOpen={onOpen} />
        </Canvas>
      )}
    </div>
  );
}

export default LandingPlanet;
