/**
 * LandingPlanet — the logo IS the planet; hubs circle outside; DSG moon may cross it.
 *
 * 1. Center: official logo Billboard only (no sphere, no halo circle, no ring guides).
 * 2. Hub planets: Clockwise on a screen-facing ring AROUND the logo — never through it.
 * 3. DSG moon: Counter-Clockwise on a path that goes through & around the logo.
 * 4. Mobile (<768): stacked hub list, no 3D orbits.
 *
 * Screen clock (looking at the logo): top → right → bottom → left = Clockwise.
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
const LOGO_ASPECT = 1019 / 960;
/** Logo plane (+20%) — this graphic already is the planet. */
const LOGO_BASE_H = 3.45;
const LOGO_SCALE = 1.2;
const LOGO_H = LOGO_BASE_H * LOGO_SCALE;
const LOGO_W = LOGO_H * LOGO_ASPECT;
/**
 * Hub hard floor: outside the logo rectangle so satellites only circle
 * around the planet, never cut through it.
 */
const LOGO_CLEARANCE = Math.max(LOGO_W, LOGO_H) * 0.5 + 0.85;

const HUB_BODY_R = 0.36;
const HUB_GLOW_SCALE = 1.12;
/**
 * DSG moon — allowed through the logo. Smaller path so it crosses the face.
 */
const DSG_ORBIT_R = 1.65;
const DSG_BODY_R = 0.2;
const DSG_ORBIT_SPEED = 0.7;
const DSG_SPIN_SPEED = 2.4;

const CAMERA_Z = 13.5;
const CAMERA_FOV = 40;
const LOGO_EMISSIVE = 2.5;
const LOGO_RENDER_ORDER = 5;
const HUB_RENDER_ORDER = 2;
const DSG_RENDER_ORDER = 6;

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
  /** 0 = top of logo, increases Clockwise (right → bottom → left). */
  phase: number;
  speed: number;
};

/**
 * Phases on the screen clock around the logo:
 *   top    → Gaming
 *   right  → Vibe Ridez
 *   bottom → Streams (TV)
 *   left   → Vibe Vineyards
 * Outer belt fills the diagonals.
 */
const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    shortLabel: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 4.7,
    phase: 0,
    speed: 0.22,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 4.7,
    phase: Math.PI / 2,
    speed: 0.22,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 4.7,
    phase: Math.PI,
    speed: 0.22,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 4.7,
    phase: (Math.PI * 3) / 2,
    speed: 0.22,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 5.9,
    phase: Math.PI / 4,
    speed: 0.15,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 5.9,
    phase: (Math.PI * 5) / 4,
    speed: 0.15,
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
 * Hub path — screen-plane ring AROUND the logo.
 * angle 0 = top, +angle = Clockwise (right, bottom, left).
 * z stays behind the logo so hubs never fly through the brand face.
 */
function placeHubAroundLogo(
  angle: number,
  orbitR: number,
  out: THREE.Vector3,
) {
  const r = Math.max(orbitR, LOGO_CLEARANCE);
  const x = Math.sin(angle) * r;
  const y = Math.cos(angle) * r;
  // Park slightly behind the logo plane — circle around, never through.
  const z = -0.35;
  out.set(x, y, z);
}

/**
 * DSG moon — Counter-Clockwise path that goes THROUGH and around the logo.
 * Swings in front of (z>0) and behind (z<0) the brand face.
 */
function placeDSGThroughLogo(angle: number, out: THREE.Vector3) {
  const r = DSG_ORBIT_R;
  const x = Math.sin(angle) * r * 1.05;
  const y = Math.cos(angle) * r * 0.75;
  // Depth swing crosses the logo plane → "through the planet".
  const z = Math.sin(angle) * 1.35;
  out.set(x, y, z);
}

/** Hubs: Clockwise. Pass +state.clock.getElapsedTime(). */
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
    placeHubAroundLogo(angle, hub.orbitR, scratch);
    group.position.copy(scratch);
  }
}

/** DSG moon: Counter-Clockwise through the logo. Pass -elapsed. */
function animateDSGMoon(
  moonGroup: RefObject<THREE.Group | null>,
  spinMesh: RefObject<THREE.Mesh | null>,
  elapsedNegative: number,
  scratch: THREE.Vector3,
) {
  const group = moonGroup.current;
  if (!group) return;
  const angle = elapsedNegative * DSG_ORBIT_SPEED;
  placeDSGThroughLogo(angle, scratch);
  group.position.copy(scratch);
  if (spinMesh.current) {
    spinMesh.current.rotation.y = Math.abs(elapsedNegative) * DSG_SPIN_SPEED;
  }
}

/**
 * The planet = the logo. Nothing else — no sphere, no halo circle, no rings.
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
      <pointLight color="#ffffff" intensity={3.6} distance={16} decay={2} />
      <pointLight color="#67e8f9" intensity={1.6} distance={12} decay={2} />

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
      position={[0, -0.7, 0]}
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
          background: "rgba(0,0,0,0.55)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 13,
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
          emissiveIntensity={0.8}
          transparent
          opacity={0.18}
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

function OrbitSystem({ onOpen }: { onOpen: (path: string) => void }) {
  const hubGroups = useRef<Array<THREE.Group | null>>([]);
  const moonGroup = useRef<THREE.Group | null>(null);
  const moonSpin = useRef<THREE.Mesh | null>(null);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    // Independent vectors — hubs CW around logo; DSG CCW through logo.
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
            emissiveIntensity={1.75}
            metalness={0.9}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>
        <Html
          center
          position={[0, -0.42, 0]}
          distanceFactor={8}
          zIndexRange={[22, 0]}
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

function Scene({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.55} />

      <Suspense fallback={null}>
        <CentralLogoBillboard />
        <OrbitSystem onOpen={onOpen} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.95}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.55}
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
      aria-label="Global Vibez logo planet with orbiting hubs"
    >
      {isMobile ? (
        <MobileHubStrip onOpen={onOpen} />
      ) : (
        <Canvas
          camera={{
            position: [0, 0, CAMERA_Z],
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
          <Scene onOpen={onOpen} />
        </Canvas>
      )}
    </div>
  );
}

export default LandingPlanet;
