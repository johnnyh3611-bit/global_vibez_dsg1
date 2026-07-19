/**
 * LandingPlanet — finalized spatial layout (PR #153 design specs).
 *
 * 1. Logo Billboard: static center anchor, renderOrder={1}, no orbital motion.
 * 2. Hub planets: large clockwise ring BEHIND the logo; clickable → dashboards.
 * 3. DSG moon: only object whose Z-path crosses the logo; counter-clockwise.
 * 4. No ring/path visual aids — satellites float freely.
 * 5. Mobile (<768): stacked hub list, no 3D orbits.
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
const LOGO_BASE_H = 3.45;
const LOGO_SCALE = 1.2;
const LOGO_H = LOGO_BASE_H * LOGO_SCALE;
const LOGO_W = LOGO_H * LOGO_ASPECT;

/** Hubs must clear the logo with a wide margin (significantly larger ring). */
const LOGO_CLEARANCE = Math.max(LOGO_W, LOGO_H) * 0.5 + 1.35;
/** Hub orbital plane sits behind the logo (negative Z). */
const HUB_ORBIT_Z = -1.15;

const HUB_BODY_R = 0.36;
const HUB_GLOW_SCALE = 1.12;
/** DSG moon — only body allowed through the logo plane on Z. */
const DSG_ORBIT_R = 1.7;
const DSG_BODY_R = 0.2;
const DSG_ORBIT_SPEED = 0.7;
const DSG_SPIN_SPEED = 2.4;

const CAMERA_Z = 14;
const CAMERA_FOV = 40;
const LOGO_EMISSIVE = 2.5;
/** Spec: logo plane renderOrder = 1 */
const LOGO_RENDER_ORDER = 1;
const HUB_RENDER_ORDER = 0;
const DSG_RENDER_ORDER = 2;

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
  /** App route for this hub dashboard */
  path: string;
  color: string;
  emissive: string;
  orbitR: number;
  /** 0 = top, increases Clockwise (right → bottom → left). */
  phase: number;
  speed: number;
};

/**
 * Clock positions around the logo (CW):
 *   top Gaming · right Ridez · bottom Streams · left Vineyards
 */
const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    shortLabel: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 5.6,
    phase: 0,
    speed: 0.2,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 5.6,
    phase: Math.PI / 2,
    speed: 0.2,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 5.6,
    phase: Math.PI,
    speed: 0.2,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 5.6,
    phase: (Math.PI * 3) / 2,
    speed: 0.2,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 6.85,
    phase: Math.PI / 4,
    speed: 0.14,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 6.85,
    phase: (Math.PI * 5) / 4,
    speed: 0.14,
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
 * Hub ring behind the logo — large radius, fixed negative Z.
 * angle 0 = top; +angle = Clockwise on screen.
 */
function placeHubBehindLogo(
  angle: number,
  orbitR: number,
  out: THREE.Vector3,
) {
  const r = Math.max(orbitR, LOGO_CLEARANCE);
  out.set(Math.sin(angle) * r, Math.cos(angle) * r, HUB_ORBIT_Z);
}

/** DSG moon — Z swings through the logo plane. */
function placeDSGThroughLogo(angle: number, out: THREE.Vector3) {
  const r = DSG_ORBIT_R;
  out.set(
    Math.sin(angle) * r * 1.05,
    Math.cos(angle) * r * 0.75,
    Math.sin(angle) * 1.4,
  );
}

/** Clockwise hubs. Pass +state.clock.getElapsedTime(). */
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
    placeHubBehindLogo(angle, hub.orbitR, scratch);
    group.position.copy(scratch);
  }
}

/** Counter-clockwise DSG moon. Pass -state.clock.getElapsedTime(). */
function animateDSGMoon(
  moonGroup: RefObject<THREE.Group | null>,
  spinMesh: RefObject<THREE.Mesh | null>,
  elapsedNegative: number,
  scratch: THREE.Vector3,
) {
  const group = moonGroup.current;
  if (!group) return;
  placeDSGThroughLogo(elapsedNegative * DSG_ORBIT_SPEED, scratch);
  group.position.copy(scratch);
  if (spinMesh.current) {
    spinMesh.current.rotation.y = Math.abs(elapsedNegative) * DSG_SPIN_SPEED;
  }
}

/**
 * Static logo-as-planet anchor.
 * No orbital motion / no spin on this plane — Billboard only faces camera.
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

/**
 * Dark-mode pill label — Billboard LookAt so text always faces the user.
 */
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
    <Billboard follow position={[0, -0.72, 0]}>
      <Html center distanceFactor={8} zIndexRange={[30, 0]} style={{ pointerEvents: "auto" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          data-testid={testId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(8, 10, 16, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            color: "#f8fafc",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            cursor: "pointer",
            lineHeight: 1.2,
            boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
          }}
        >
          {label}
        </button>
      </Html>
    </Billboard>
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
          emissiveIntensity={0.75}
          transparent
          opacity={0.16}
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

      {/* Golden DSG token satellite — only object through the logo on Z */}
      <group ref={moonGroup}>
        <mesh ref={moonSpin} renderOrder={DSG_RENDER_ORDER}>
          <sphereGeometry args={[DSG_BODY_R, 32, 32]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#fbbf24"
            emissiveIntensity={1.85}
            metalness={0.95}
            roughness={0.18}
            toneMapped={false}
          />
        </mesh>
        <mesh scale={1.22} renderOrder={DSG_RENDER_ORDER}>
          <sphereGeometry args={[DSG_BODY_R, 16, 16]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1.1}
            transparent
            opacity={0.2}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Billboard follow position={[0, -0.44, 0]}>
          <Html
            center
            distanceFactor={8}
            zIndexRange={[28, 0]}
            style={{ pointerEvents: "none" }}
          >
            <span
              data-testid="landing-dsg-moon-label"
              style={{
                display: "inline-flex",
                background: "rgba(8, 10, 16, 0.72)",
                border: "1px solid rgba(251, 191, 36, 0.45)",
                borderRadius: 999,
                padding: "4px 10px",
                color: "#fbbf24",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                boxShadow: "0 0 12px rgba(251,191,36,0.35)",
              }}
            >
              DSG
            </span>
          </Html>
        </Billboard>
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
        {/* No OrbitGuides / ring meshes — free-floating satellites only */}
        <CentralLogoBillboard />
        <OrbitSystem onOpen={onOpen} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.3}
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
            className="flex w-full min-w-0 items-center gap-3 rounded-full px-4 py-2.5"
            style={{
              background: "rgba(8, 10, 16, 0.78)",
              border: "1px solid rgba(148, 163, 184, 0.28)",
            }}
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
