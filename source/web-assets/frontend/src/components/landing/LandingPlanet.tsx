/**
 * LandingPlanet — tight brand cluster polished into the landing neon UI.
 *
 * 1. Static logo Billboard (renderOrder 10) — fixed center anchor.
 * 2. Hub groups (renderOrder 5): planet + ring + local DSG moon + pill label.
 * 3. Slow clockwise ambient orbits; hover scale + cyan label highlight.
 * 4. Neon triad lighting + light Bloom to match page CTAs.
 * 5. Mobile (<768): stacked hub list, no 3D orbits.
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
import { Billboard, Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

const LOGO_SRC = "/assets/logo.png";
const LOGO_ASPECT = 1019 / 960;
const LOGO_BASE_H = 3.45;
const LOGO_SCALE = 1.1;
const LOGO_H = LOGO_BASE_H * LOGO_SCALE;
const LOGO_W = LOGO_H * LOGO_ASPECT;

/**
 * Tight cluster — hubs hug the logo (part of the branding, not distant).
 * Clearance is only a slim gap past the logo edge.
 */
const LOGO_CLEARANCE = Math.max(LOGO_W, LOGO_H) * 0.5 + 0.1;
/** Hub plane slightly behind the logo face. */
const HUB_ORBIT_Z = -0.4;

const HUB_BODY_R = 0.3;
const HUB_RING_R = 0.44;
const HUB_RING_TUBE = 0.016;
/** Local golden DSG moon around each hub. */
const LOCAL_MOON_R = 0.12;
const LOCAL_MOON_ORBIT = 0.52;
/** Slow local moon — ambient, not mechanical. */
const LOCAL_MOON_SPEED = 0.55;

/** Camera framed slightly right so the cluster sits centered in its slot. */
const CAMERA_X = 0.65;
const CAMERA_Y = 0.08;
const CAMERA_Z = 11.4;
const CAMERA_FOV = 40;
const LOGO_EMISSIVE = 2.15;
const LOGO_RENDER_ORDER = 10;
const HUB_RENDER_ORDER = 5;
/** Shared hover scale for hub planet groups. */
const HUB_HOVER_SCALE = 1.2;

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
  /** 0 = top of logo; +phase = Clockwise. */
  phase: number;
  speed: number;
};

/**
 * Tight clockwise clock around the logo:
 *   top Gaming · right Ridez · bottom Streams · left Vineyards
 * Outer pair (Dating / Hungry) stays close too.
 */
const HUBS: HubDef[] = [
  {
    id: "gaming",
    label: "Gaming",
    shortLabel: "Gaming",
    path: "/games",
    color: "#1e3a8a",
    emissive: "#38bdf8",
    orbitR: 2.45,
    phase: 0,
    speed: 0.07,
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    shortLabel: "Ridez",
    path: "/vibe-ridez",
    color: "#065f46",
    emissive: "#34d399",
    orbitR: 2.45,
    phase: Math.PI / 2,
    speed: 0.07,
  },
  {
    id: "streams",
    label: "Streams",
    shortLabel: "Streams",
    path: "/streams",
    color: "#5b21b6",
    emissive: "#c084fc",
    orbitR: 2.45,
    phase: Math.PI,
    speed: 0.07,
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    shortLabel: "Vineyards",
    path: "/hub/vineyards",
    color: "#86198f",
    emissive: "#f9a8d4",
    orbitR: 2.45,
    phase: (Math.PI * 3) / 2,
    speed: 0.07,
  },
  {
    id: "dating",
    label: "Dating",
    shortLabel: "Dating",
    path: "/dating",
    color: "#9d174d",
    emissive: "#fb7185",
    orbitR: 2.95,
    phase: Math.PI / 4,
    speed: 0.05,
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    shortLabel: "Hungry",
    path: "/hungryvibes",
    color: "#9a3412",
    emissive: "#fb923c",
    orbitR: 2.95,
    phase: (Math.PI * 5) / 4,
    speed: 0.05,
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

/** Clockwise ring around logo (screen plane), behind the brand face. */
function placeHubAroundLogo(
  angle: number,
  orbitR: number,
  out: THREE.Vector3,
) {
  const r = Math.max(orbitR, LOGO_CLEARANCE);
  out.set(Math.sin(angle) * r, Math.cos(angle) * r, HUB_ORBIT_Z);
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
    placeHubAroundLogo(angle, hub.orbitR, scratch);
    group.position.copy(scratch);
  }
}

/** Static logo-as-planet — no orbital motion on this plane. */
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
      {/* Neon triad — cyan / fuchsia / indigo to match landing CTAs */}
      <pointLight color="#22d3ee" intensity={2.1} distance={14} decay={2} position={[0, 0.4, 2.2]} />
      <pointLight color="#e879f9" intensity={1.35} distance={12} decay={2} position={[-1.6, -0.6, 1.4]} />
      <pointLight color="#818cf8" intensity={1.15} distance={12} decay={2} position={[1.5, 0.8, 1.2]} />

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

/** Fully opaque pill — drop-shadow for dark neon backdrop; highlights on hover. */
function HubPillLabel({
  label,
  onOpen,
  testId,
  hovered,
}: {
  label: string;
  onOpen: () => void;
  testId: string;
  hovered: boolean;
}) {
  return (
    <Billboard follow position={[0, -0.78, 0]}>
      <Html
        center
        distanceFactor={7.5}
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
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: hovered ? "#111827" : "#0b0f17",
            color: "#ffffff",
            border: hovered
              ? "1px solid rgba(34, 211, 238, 0.85)"
              : "1px solid rgba(226, 232, 240, 0.55)",
            borderRadius: 999,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            cursor: "pointer",
            lineHeight: 1.15,
            opacity: 1,
            transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
            textShadow:
              "0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.75), 0 0 18px rgba(34,211,238,0.25)",
            boxShadow: hovered
              ? "0 0 22px rgba(34, 211, 238, 0.45), 0 8px 20px rgba(0,0,0,0.7)"
              : "0 6px 18px rgba(0,0,0,0.75), 0 0 12px rgba(0,0,0,0.5)",
          }}
        >
          {label}
        </button>
      </Html>
    </Billboard>
  );
}

/**
 * One cohesive hub unit: Planet + white torus ring + local DSG moon + pill.
 * Entire group is clickable → dashboard route.
 */
function HubCluster({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (path: string) => void;
}) {
  const moon = useRef<THREE.Mesh>(null);
  const scaleGroup = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const hoverTarget = useRef(1);

  useFrame(({ clock }) => {
    if (moon.current) {
      const t = hub.phase - clock.getElapsedTime() * LOCAL_MOON_SPEED;
      moon.current.position.set(
        Math.cos(t) * LOCAL_MOON_ORBIT,
        Math.sin(t * 1.15) * 0.18,
        Math.sin(t) * LOCAL_MOON_ORBIT * 0.85,
      );
      moon.current.rotation.y = clock.getElapsedTime() * 0.9;
    }
    if (scaleGroup.current) {
      const s = scaleGroup.current.scale.x;
      const next = THREE.MathUtils.lerp(s, hoverTarget.current, 0.14);
      scaleGroup.current.scale.setScalar(next);
    }
  });

  const go = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onOpen(hub.path);
  };

  return (
    <group
      onClick={go}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        hoverTarget.current = HUB_HOVER_SCALE;
        setHovered(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        hoverTarget.current = 1;
        setHovered(false);
      }}
    >
      <group ref={scaleGroup}>
        {/* Planet body */}
        <mesh renderOrder={HUB_RENDER_ORDER}>
          <sphereGeometry args={[HUB_BODY_R, 48, 48]} />
          <meshStandardMaterial
            color={hub.color}
            emissive={hub.emissive}
            emissiveIntensity={hovered ? 1.75 : 1.25}
            roughness={0.32}
            metalness={0.22}
            toneMapped={false}
          />
        </mesh>

        {/* Subtle elegant ring around the hub */}
        <mesh
          renderOrder={HUB_RENDER_ORDER}
          rotation={[Math.PI / 2.4, 0.35, 0.15]}
        >
          <torusGeometry args={[HUB_RING_R, HUB_RING_TUBE, 12, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={hovered ? 0.42 : 0.26}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/* Tiny golden DSG token moon — unique to this hub */}
        <mesh ref={moon} renderOrder={HUB_RENDER_ORDER}>
          <sphereGeometry args={[LOCAL_MOON_R, 24, 24]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#fbbf24"
            emissiveIntensity={1.7}
            metalness={0.95}
            roughness={0.16}
            toneMapped={false}
          />
        </mesh>
      </group>

      <HubPillLabel
        label={hub.label}
        onOpen={() => onOpen(hub.path)}
        testId={`landing-hub-label-${hub.id}`}
        hovered={hovered}
      />

      {/* Invisible hit sphere so the whole cluster is easy to click */}
      <mesh renderOrder={HUB_RENDER_ORDER} visible={false}>
        <sphereGeometry args={[0.95, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function OrbitSystem({ onOpen }: { onOpen: (path: string) => void }) {
  const hubGroups = useRef<Array<THREE.Group | null>>([]);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    animateHubPlanets(hubGroups, +state.clock.getElapsedTime(), scratch);
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
          <HubCluster hub={hub} onOpen={onOpen} />
        </group>
      ))}
    </group>
  );
}

function Scene({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      {/* Soft indigo wash — matches landing dark neon, not a flat grey fill */}
      <ambientLight intensity={0.32} color="#a5b4fc" />

      <Suspense fallback={null}>
        <CentralLogoBillboard />
        <OrbitSystem onOpen={onOpen} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.42}
          luminanceThreshold={0.48}
          luminanceSmoothing={0.72}
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
              background: "#0b0f17",
              border: "1px solid #e2e8f0",
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
      className="relative mx-auto h-[520px] w-full max-w-[640px] overflow-hidden sm:h-[500px] lg:h-[640px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez logo planet with tight orbiting hub cluster"
    >
      {isMobile ? (
        <MobileHubStrip onOpen={onOpen} />
      ) : (
        <Canvas
          camera={{
            position: [CAMERA_X, CAMERA_Y, CAMERA_Z],
            fov: CAMERA_FOV,
            near: 0.1,
            far: 100,
          }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.02,
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
