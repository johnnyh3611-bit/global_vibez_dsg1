/**
 * LandingPlanet — solar-system hub (logo = Sun).
 *
 * Hierarchy
 *  1. Central Sun — Global Vibez DSG logo (Billboard, always camera-facing,
 *     renderOrder 10, depthTest false, high emissive glow). Never occluded.
 *  2. Orbital planets — Gaming / Dating / Streams / Earn on distinct rings,
 *     colored spheres + high-contrast labels (dark chip behind text).
 *  3. DSG satellite — smaller golden/metallic moon orbiting the Sun.
 *
 * Mobile (<768px): orbital animation off; hubs snap to a horizontal nav bar
 * under a large static Sun so the logo stays the focal point.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Html, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

const CAMERA_Z = 8.5;
const SUN_RENDER_ORDER = 10;
const HUB_RENDER_ORDER = 2;

type HubId = "gaming" | "dating" | "streams" | "earn";

type HubPlanet = {
  id: HubId;
  label: string;
  path: string;
  /** Distinct planet color */
  color: string;
  emissive: string;
  /** Orbital radius */
  radius: number;
  /** Starting angle (radians) */
  phase: number;
  /** Orbital speed multiplier */
  speed: number;
};

const HUB_PLANETS: HubPlanet[] = [
  {
    id: "gaming",
    label: "Gaming",
    path: "/games",
    color: "#1d4ed8",
    emissive: "#38bdf8",
    radius: 2.55,
    phase: 0,
    speed: 0.32,
  },
  {
    id: "dating",
    label: "Dating",
    path: "/dating",
    color: "#be185d",
    emissive: "#fb7185",
    radius: 3.15,
    phase: Math.PI / 2,
    speed: 0.26,
  },
  {
    id: "streams",
    label: "Streams",
    path: "/my-streams",
    color: "#6d28d9",
    emissive: "#c084fc",
    radius: 3.75,
    phase: Math.PI,
    speed: 0.22,
  },
  {
    id: "earn",
    label: "Earn",
    path: "/wallet",
    color: "#a16207",
    emissive: "#fbbf24",
    radius: 4.35,
    phase: (Math.PI * 3) / 2,
    speed: 0.18,
  },
];

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}

/** Central Sun — full logo always facing camera, never occluded. */
function CentralSun() {
  const map = useTexture("/global-vibez-logo.png");
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  return (
    <group>
      {/* Point light from the Sun onto orbiting planets */}
      <pointLight
        color="#67e8f9"
        intensity={4.5}
        distance={18}
        decay={2}
        position={[0, 0, 0]}
      />
      <pointLight
        color="#fbbf24"
        intensity={1.8}
        distance={12}
        decay={2}
        position={[0.4, 0.2, 0.6]}
      />

      {/* Soft glow shell behind the logo */}
      <mesh renderOrder={SUN_RENDER_ORDER - 1} scale={1.15}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.22}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Logo disc — Billboard so the full mark is always readable */}
      <Billboard follow>
        <mesh renderOrder={SUN_RENDER_ORDER} frustumCulled={false}>
          <circleGeometry args={[1.35, 64]} />
          <meshStandardMaterial
            map={map}
            emissiveMap={map}
            emissive="#67e8f9"
            emissiveIntensity={2.4}
            roughness={0.35}
            metalness={0.2}
            toneMapped={false}
            depthTest={false}
            depthWrite={false}
            transparent
            alphaTest={0.05}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function HubLabel({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <Html
      center
      position={[0, -0.55, 0]}
      distanceFactor={8}
      zIndexRange={[60, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        data-testid={`landing-hub-label-${label.toLowerCase()}`}
        style={{
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          cursor: "pointer",
          lineHeight: 1.2,
          backdropFilter: "blur(4px)",
        }}
      >
        {label}
      </button>
    </Html>
  );
}

function OrbitHubPlanet({
  hub,
  animate,
  showLabel,
  onOpen,
  staticPosition,
}: {
  hub: HubPlanet;
  animate: boolean;
  showLabel: boolean;
  onOpen: (path: string) => void;
  /** When animate=false, park at this world position */
  staticPosition?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current || !animate) return;
    const t = clock.getElapsedTime() * hub.speed + hub.phase;
    group.current.position.set(
      Math.cos(t) * hub.radius,
      Math.sin(t * 0.4) * 0.28,
      Math.sin(t) * hub.radius * 0.55,
    );
  });

  useEffect(() => {
    if (!group.current || animate || !staticPosition) return;
    group.current.position.set(...staticPosition);
  }, [animate, staticPosition]);

  return (
    <group ref={group} position={staticPosition}>
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
        <sphereGeometry args={[0.42, 48, 48]} />
        <meshStandardMaterial
          color={hub.color}
          emissive={hub.emissive}
          emissiveIntensity={1.8}
          roughness={0.35}
          metalness={0.25}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh scale={1.18} renderOrder={HUB_RENDER_ORDER}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial
          color={hub.emissive}
          emissive={hub.emissive}
          emissiveIntensity={1.2}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={1}
        />
      </mesh>
      {showLabel && (
        <HubLabel label={hub.label} onOpen={() => onOpen(hub.path)} />
      )}
    </group>
  );
}

/** Golden/metallic DSG moon — DSG painted into the body; orbits the Sun. */
function useDsgMoonTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 110, 10, 128, 128, 128);
    g.addColorStop(0, "#fffbeb");
    g.addColorStop(0.35, "#fbbf24");
    g.addColorStop(0.7, "#d97706");
    g.addColorStop(1, "#78350f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);

    // Dark core with DSG inside the moon
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.ellipse(128, 138, 72, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = "900 42px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fafaf9";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 4;
    ctx.strokeText("DSG", 128, 142);
    ctx.fillText("DSG", 128, 142);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function DsgMoon({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const map = useDsgMoonTexture();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (animate && group.current) {
      const a = t * 0.7;
      const r = 1.95;
      group.current.position.set(
        Math.cos(a) * r,
        0.35 + Math.sin(a * 1.3) * 0.2,
        Math.sin(a) * r * 0.7,
      );
    } else if (group.current) {
      group.current.position.set(1.7, 0.55, 0.9);
    }
  });

  return (
    <group ref={group}>
      {/* Fire corona around the golden moon */}
      <mesh scale={1.4} renderOrder={HUB_RENDER_ORDER + 1}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color="#ff6a00"
          emissive="#ff4500"
          emissiveIntensity={2.8}
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Camera-facing golden moon with DSG in the dark core */}
      <Billboard follow>
        <mesh renderOrder={HUB_RENDER_ORDER + 2}>
          <sphereGeometry args={[0.3, 48, 48]} />
          <meshStandardMaterial
            map={map}
            emissiveMap={map}
            emissive="#fbbf24"
            emissiveIntensity={2.4}
            metalness={0.8}
            roughness={0.25}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function OrbitRings() {
  return (
    <group rotation={[Math.PI / 2.4, 0.15, 0]}>
      {HUB_PLANETS.map((hub) => (
        <mesh key={`ring-${hub.id}`} renderOrder={0}>
          <torusGeometry args={[hub.radius, 0.008, 8, 128]} />
          <meshBasicMaterial
            color={hub.emissive}
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({
  animate,
  onOpen,
}: {
  animate: boolean;
  onOpen: (path: string) => void;
}) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.55} />

      <Suspense fallback={null}>
        {/* Sun is always the hero — especially on mobile where hubs leave the canvas */}
        <CentralSun />
        {animate && (
          <>
            <OrbitRings />
            {HUB_PLANETS.map((hub) => (
              <OrbitHubPlanet
                key={hub.id}
                hub={hub}
                animate
                showLabel
                onOpen={onOpen}
              />
            ))}
          </>
        )}
        <DsgMoon animate={animate} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.15}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

/** Mobile bottom nav — hubs as a horizontal bar; Sun stays the hero above. */
function MobileHubBar({
  onOpen,
}: {
  onOpen: (path: string) => void;
}) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 flex items-stretch justify-center gap-2 border-t border-white/10 bg-black/70 px-2 py-2 backdrop-blur-md"
      data-testid="landing-planet-mobile-nav"
      aria-label="Hub destinations"
    >
      {HUB_PLANETS.map((hub) => (
        <button
          key={hub.id}
          type="button"
          onClick={() => onOpen(hub.path)}
          data-testid={`landing-mobile-hub-${hub.id}`}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 transition hover:bg-white/5"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{
              background: hub.emissive,
              boxShadow: `0 0 10px ${hub.emissive}`,
            }}
            aria-hidden
          />
          <span className="w-full truncate text-center text-sm font-bold uppercase tracking-wide text-white">
            {hub.label}
          </span>
        </button>
      ))}
    </nav>
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
      aria-label="Global Vibez solar system hub — logo sun with orbiting hubs"
      style={{ overflow: "hidden" }}
    >
      <Canvas
        camera={{
          position: [0, isMobile ? 0.6 : 0.35, isMobile ? 7.2 : CAMERA_Z],
          fov: isMobile ? 48 : 40,
          near: 0.05,
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
          overflow: "hidden",
        }}
      >
        <Scene animate={!isMobile} onOpen={onOpen} />
      </Canvas>

      {isMobile && <MobileHubBar onOpen={onOpen} />}
    </div>
  );
}

export default LandingPlanet;
