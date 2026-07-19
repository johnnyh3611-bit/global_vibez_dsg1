/**
 * LandingPlanet — logo-skinned central sun + orbiting hub planets.
 *
 * 1. Official logo is the MeshStandardMaterial skin of the central sun
 *    (map + emissiveMap, high emissiveIntensity), renderOrder above hubs.
 * 2. Primary hubs orbit the sun Clockwise (elapsed-time driven).
 * 3. DSG token satellite orbits the sun Counter-Clockwise on a tighter radius.
 * 4. Mobile (<768): static vertical hub list (≥14px), no 3D orbits.
 */
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

/** Official brand mark — `public/assets/logo.png` (globe + wordmark below). */
const LOGO_SRC = "/assets/logo.png";
/** Intrinsic pixel aspect — front-face skin plane stays matched to the asset. */
const LOGO_ASPECT = 1019 / 960;
/** Large enough that hub orbits stay clear of the brand mark. */
const SUN_RADIUS = 1.75;
/**
 * Brand half-extent + hub glow — hard floor for hub satellite XY.
 * Inner hub orbitR must stay ≥ this so glow shells never cross the mark.
 */
const HUB_CLEARANCE = SUN_RADIUS + 1.85;
/** Hub body + glow shell radius used for clearance math. */
const HUB_BODY_R = 0.38;
const HUB_GLOW_SCALE = 1.15;
/**
 * DSG satellite — tighter than primary hubs, outside the sun shell.
 * Must stay < min hub orbit (4.35) for a distinct inner path.
 */
const DSG_ORBIT_R = 2.95;
const DSG_BODY_R = 0.2;
const DSG_SPEED = 0.55;
/** Pull back so the logo sun + outer hub belt stay in frustum. */
const CAMERA_Z = 13.6;
const CAMERA_FOV = 42;
/** Bright glow on the logo skin. */
const LOGO_EMISSIVE = 2.15;
/** Central sun / logo skin draws above orbiting satellites. */
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
  /** Shorter label for tight mobile cells */
  shortLabel: string;
  path: string;
  color: string;
  emissive: string;
  orbitR: number;
  phase: number;
  speed: number;
};

/** Six lifestyle hubs — radii keep body+glow outside HUB_CLEARANCE. */
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
 * Central Sun — logo.png is the MeshStandardMaterial skin (map + emissiveMap).
 * The whole sun group is camera-locked so the brand face stays on the planet
 * surface (flush front skin), not a hovering card away from the sphere.
 */
function CentralLogoSun() {
  const sunGroup = useRef<THREE.Group>(null);
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

  useFrame(({ camera }) => {
    // Lock logo-skinned face toward the viewer.
    if (sunGroup.current) sunGroup.current.quaternion.copy(camera.quaternion);
  });

  // Flush front-face skin — sized inside the sphere silhouette.
  const faceH = SUN_RADIUS * 1.92;
  const faceW = faceH * LOGO_ASPECT;

  return (
    <group>
      <pointLight color="#ffffff" intensity={3.6} distance={18} decay={2} />
      <pointLight color="#67e8f9" intensity={1.8} distance={14} decay={2} />

      <mesh scale={1.08} renderOrder={0} frustumCulled={false}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.14}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={sunGroup}>
        {/* Curved planet body — same logo skin wraps the sphere */}
        <mesh renderOrder={SUN_RENDER_ORDER} frustumCulled={false}>
          <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
          <meshStandardMaterial
            map={brandMap}
            emissiveMap={brandMap}
            emissive="#ffffff"
            emissiveIntensity={LOGO_EMISSIVE * 0.85}
            roughness={0.32}
            metalness={0.16}
            toneMapped={false}
            side={THREE.FrontSide}
          />
        </mesh>

        {/*
          Front-face skin flush with the sphere surface (local +Z pole).
          Keeps GLOBAL VIBEZ / DSG fully legible without hovering off-planet.
        */}
        <mesh
          position={[0, 0, SUN_RADIUS * 0.02]}
          renderOrder={SUN_RENDER_ORDER + 1}
          frustumCulled={false}
        >
          <planeGeometry args={[faceW, faceH]} />
          <meshStandardMaterial
            map={brandMap}
            emissiveMap={brandMap}
            emissive="#ffffff"
            emissiveIntensity={LOGO_EMISSIVE}
            roughness={0.28}
            metalness={0.12}
            transparent
            opacity={1}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
            side={THREE.FrontSide}
            alphaTest={0.04}
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

/** Primary hubs — Clockwise around the sun via negative elapsed angle. */
function OrbitingHub({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (path: string) => void;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    // Clockwise: decreasing angle over time (standard math CCW is +t).
    const t = hub.phase - clock.getElapsedTime() * hub.speed;
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
    group.current.position.set(x, y, z);
  });

  return (
    <group ref={group}>
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
    </group>
  );
}

/**
 * DSG token satellite — Counter-Clockwise around the central sun on a
 * tighter radius than Gaming / Dating / Streams hubs.
 */
function DsgTokenMoon() {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    // Opposite of hubs: +elapsed → Counter-Clockwise.
    const a = elapsed * DSG_SPEED;
    // Tighter than hub belt (4.35+), outside the sun shell.
    const r = Math.min(
      DSG_ORBIT_R,
      Math.min(...HUBS.map((h) => h.orbitR)) - 0.9,
    );
    const orbitR = Math.max(SUN_RADIUS + 0.65, r);
    let x = Math.cos(a) * orbitR;
    const y = Math.sin(a * 0.4) * 0.16;
    let z = Math.sin(a) * orbitR * 0.1;
    if (z > 0.1) z = 0.1;
    if (z < -0.4) z = -0.4;
    if (group.current) group.current.position.set(x, y, z);
    if (spin.current) spin.current.rotation.y = elapsed * 2.2;
  });

  return (
    <group ref={group}>
      <mesh ref={spin} renderOrder={DSG_RENDER_ORDER}>
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
            opacity={r === DSG_ORBIT_R ? 0.28 : 0.18}
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
      <ambientLight intensity={0.45} />

      <Suspense fallback={null}>
        <CentralLogoSun />
        <OrbitGuides />
        {HUBS.map((hub) => (
          <OrbitingHub key={hub.id} hub={hub} onOpen={onOpen} />
        ))}
        <DsgTokenMoon />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.1}
          luminanceThreshold={0.22}
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
