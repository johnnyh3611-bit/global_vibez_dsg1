/**
 * LandingPlanet — founder-target home globe.
 *
 * • Hub tabs sit on the Earth brim (rim sockets) — planet atmosphere wraps around them
 * • DSG fireball fully circles the planet on fire
 * • Second VIBEZ satellite also orbits (different path)
 * • Galaxy / stars behind
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, OrbitControls, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.2;
/** Tabs sit in the brim — atmosphere shell extends past them */
const SHAPE_R = GLOBE_R * 1.012;
const BRIM_R = GLOBE_R * 1.085;

const DSG_ORBIT_R = 3.55;
const DSG_TILT = 0.38;
const VIBE_ORBIT_R = 3.95;
const VIBE_TILT = -0.55;

const HUB_SHAPE: Partial<
  Record<HubId, { src: string; label: string; glow: string; scale: number }>
> = {
  ridez: {
    src: "/assets/shape-viberide.png",
    label: "VibeRide",
    glow: "#22d3ee",
    scale: 0.58,
  },
  dating: {
    src: "/assets/shape-dating.png",
    label: "Dating",
    glow: "#fb7185",
    scale: 0.55,
  },
  hungry: {
    src: "/assets/shape-hungry.png",
    label: "Hungry Vibez",
    glow: "#fb923c",
    scale: 0.56,
  },
  viberise: {
    src: "/assets/shape-viberise.png",
    label: "VibeRise",
    glow: "#c084fc",
    scale: 0.56,
  },
  cdl: {
    src: "/assets/shape-cdl.png",
    label: "CDL / GDL",
    glow: "#fbbf24",
    scale: 0.58,
  },
  vineyards: {
    src: "/assets/shape-vineyards.png",
    label: "Vibe Vineyards",
    glow: "#f9a8d4",
    scale: 0.54,
  },
  vibe: {
    src: "/assets/shape-home.png",
    label: "Home",
    glow: "#2dd4bf",
    scale: 0.52,
  },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.2;
  const lat = (0.5 - top) * Math.PI * 0.78;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.cos(lon) * radius,
  );
}

function useGalaxyTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const space = ctx.createLinearGradient(0, 0, 0, 512);
    space.addColorStop(0, "#020617");
    space.addColorStop(0.5, "#0a0f2a");
    space.addColorStop(1, "#020617");
    ctx.fillStyle = space;
    ctx.fillRect(0, 0, 1024, 512);

    const band = ctx.createLinearGradient(0, 120, 0, 400);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.4, "rgba(147,197,253,0.14)");
    band.addColorStop(0.5, "rgba(255,255,255,0.2)");
    band.addColorStop(0.62, "rgba(216,180,254,0.16)");
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 1024, 512);

    for (const [x, y, r, color] of [
      [240, 220, 200, "rgba(56,189,248,0.18)"],
      [540, 250, 240, "rgba(168,85,247,0.16)"],
      [800, 200, 180, "rgba(244,114,182,0.12)"],
    ] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.75})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, Math.random() * 1.7, Math.random() * 1.7);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function useDsgSphereTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 240, 16, 256, 256, 250);
    g.addColorStop(0, "#fffbeb");
    g.addColorStop(0.2, "#fbbf24");
    g.addColorStop(0.45, "#f97316");
    g.addColorStop(0.75, "#dc2626");
    g.addColorStop(1, "#450a0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    // Flame tongues
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const len = 80 + (i % 3) * 28;
      ctx.strokeStyle = i % 2 ? "rgba(253,224,71,0.55)" : "rgba(249,115,22,0.5)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90);
      ctx.quadraticCurveTo(
        256 + Math.cos(a + 0.2) * (90 + len * 0.5),
        256 + Math.sin(a + 0.2) * (90 + len * 0.5),
        256 + Math.cos(a) * (90 + len),
        256 + Math.sin(a) * (90 + len),
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(15,23,42,0.88)";
    ctx.beginPath();
    ctx.ellipse(256, 270, 118, 86, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "900 82px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 8;
    ctx.strokeText("DSG", 256, 300);
    ctx.fillStyle = "#fff7ed";
    ctx.fillText("DSG", 256, 300);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function useVibezSphereTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 230, 20, 256, 256, 250);
    g.addColorStop(0, "#ecfeff");
    g.addColorStop(0.3, "#22d3ee");
    g.addColorStop(0.65, "#0891b2");
    g.addColorStop(1, "#164e63");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = "rgba(15,23,42,0.78)";
    ctx.beginPath();
    ctx.ellipse(256, 268, 130, 78, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "900 64px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#083344";
    ctx.lineWidth = 7;
    ctx.strokeText("VIBEZ", 256, 275);
    ctx.fillStyle = "#ecfeff";
    ctx.fillText("VIBEZ", 256, 275);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function GalaxyBackdrop() {
  const map = useGalaxyTexture();
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.006;
  });
  return (
    <mesh ref={ref} position={[0, 0, -9]} scale={[20, 11, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function EarthGlobe() {
  const [earth, clouds] = useTexture(["/assets/earth-texture.jpg", "/assets/earth-clouds.jpg"]);
  const cloudRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Group>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.014;
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.0035;
  });

  return (
    <group>
      <group ref={earthRef}>
        <mesh>
          <sphereGeometry args={[GLOBE_R, 96, 96]} />
          <meshStandardMaterial map={earth} roughness={0.68} metalness={0.1} />
        </mesh>

        <mesh scale={1.004}>
          <sphereGeometry args={[GLOBE_R, 64, 64]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={cloudRef} scale={1.02}>
          <sphereGeometry args={[GLOBE_R, 64, 64]} />
          <meshStandardMaterial map={clouds} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>

      {/* Bright Earth BRIM — wraps past the hub tabs so the rim reads clearly */}
      <mesh scale={BRIM_R / GLOBE_R}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={(BRIM_R * 1.06) / GLOBE_R}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Thin crisp limb ring so the planet edge is obvious around the tabs */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[GLOBE_R * 1.04, 0.018, 12, 128]} />
        <meshBasicMaterial color="#a5f3fc" transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <mesh rotation={[0.2, 0.4, 0.1]}>
        <torusGeometry args={[GLOBE_R * 1.055, 0.01, 10, 128]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Hub tab in a nice brim “socket” — Earth atmosphere wraps around it.
 */
function HubShape({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_SHAPE[hub.id];
  const map = useTexture(art?.src || "/assets/shape-home.png");
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => hubToSphere(hub, SHAPE_R), [hub]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const facing = normal.dot(camera.position.clone().normalize());
    groupRef.current.visible = facing > 0.05;
  });

  if (!art) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(hub);
  };
  const setCursor = (on: boolean) => {
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  const s = art.scale;

  return (
    <group ref={groupRef} position={pos}>
      <Billboard follow>
        {/* Brim socket — glass ring so Earth edge frames the tab */}
        <mesh position={[0, 0, -0.03]}>
          <ringGeometry args={[s * 0.38, s * 0.48, 48]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.55}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, -0.025]}>
          <circleGeometry args={[s * 0.4, 40]} />
          <meshBasicMaterial
            color="#020617"
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[s * 0.36, 40]} />
          <meshBasicMaterial
            color={art.glow}
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        <sprite
          scale={[s * 0.92, s * 0.92, 1]}
          onClick={click}
          onPointerOver={() => setCursor(true)}
          onPointerOut={() => setCursor(false)}
        >
          <spriteMaterial map={map} transparent depthWrite={false} toneMapped={false} />
        </sprite>

        <Text
          position={[0, -s * 0.55, 0.02]}
          fontSize={0.11}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.016}
          outlineColor="#020617"
          maxWidth={1.35}
          textAlign="center"
          onClick={click}
          onPointerOver={() => setCursor(true)}
          onPointerOut={() => setCursor(false)}
        >
          {art.label}
        </Text>
      </Billboard>
    </group>
  );
}

function Continents({ onOpen }: { onOpen: (h: HubDef) => void }) {
  return (
    <group>
      {GLOBE_HUBS.map((hub) => (
        <HubShape key={hub.id} hub={hub} onOpen={onOpen} />
      ))}
    </group>
  );
}

/** DSG fireball — full circular orbit, clearly on fire */
function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useTexture("/assets/sun-glow.png");
  const dsgMap = useDsgSphereTexture();
  const orbitPlane = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeRotationX(DSG_TILT);
    return m;
  }, []);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
  }, [glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Full 360° circle around the planet
    const a = t * 0.48;
    const local = new THREE.Vector3(Math.cos(a) * DSG_ORBIT_R, 0, Math.sin(a) * DSG_ORBIT_R);
    local.applyMatrix4(orbitPlane);

    if (group.current) group.current.position.copy(local);
    if (ring.current) ring.current.rotation.z = t * 4.2;
    if (ring2.current) ring2.current.rotation.z = -t * 3.1;
    if (core.current) {
      core.current.rotation.y = t * 1.6;
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        5.2 + Math.sin(t * 9) * 1.1;
    }
    if (light.current) {
      const front = THREE.MathUtils.clamp((local.z / DSG_ORBIT_R) * 0.5 + 0.5, 0.4, 1);
      light.current.intensity = (5.2 + Math.sin(t * 6) * 0.8) * front;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff4500" intensity={5} distance={12} decay={2} />

      {/* Outer fire corona */}
      <mesh scale={2.1}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#ff6a00"
        />
      </mesh>

      {/* Spinning fire rings */}
      <mesh ref={ring} rotation={[Math.PI / 2.1, 0.15, 0]}>
        <torusGeometry args={[0.55, 0.055, 12, 56]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={6}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2.6, 0.6, 0.3]}>
        <torusGeometry args={[0.62, 0.03, 10, 48]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={core}>
        <sphereGeometry args={[0.38, 48, 48]} />
        <meshStandardMaterial
          map={dsgMap}
          emissiveMap={dsgMap}
          emissive="#ff4500"
          emissiveIntensity={5.2}
          roughness={0.3}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Second satellite — VIBEZ — opposite tilt / slower orbit */
function VibezSatellite() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const glow = useTexture("/assets/sun-glow.png");
  const vibezMap = useVibezSphereTexture();
  const orbitPlane = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeRotationX(VIBE_TILT);
    m.multiply(new THREE.Matrix4().makeRotationZ(0.4));
    return m;
  }, []);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
  }, [glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Opposite direction, different speed — full circle
    const a = -t * 0.32 + Math.PI * 0.7;
    const local = new THREE.Vector3(Math.cos(a) * VIBE_ORBIT_R, 0, Math.sin(a) * VIBE_ORBIT_R);
    local.applyMatrix4(orbitPlane);
    if (group.current) group.current.position.copy(local);
    if (core.current) core.current.rotation.y = t * 1.1;
  });

  return (
    <group ref={group}>
      <pointLight color="#22d3ee" intensity={2.2} distance={8} decay={2} />
      <mesh scale={1.6}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#22d3ee"
        />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.28, 40, 40]} />
        <meshStandardMaterial
          map={vibezMap}
          emissiveMap={vibezMap}
          emissive="#22d3ee"
          emissiveIntensity={3.8}
          roughness={0.35}
          metalness={0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function OrbitPaths() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2 + DSG_TILT, 0, 0]}>
        <torusGeometry args={[DSG_ORBIT_R, 0.012, 8, 128]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2 + VIBE_TILT, 0, 0.4]}>
        <torusGeometry args={[VIBE_ORBIT_R, 0.008, 8, 128]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.48} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      <pointLight position={[-4, 2, 2]} intensity={0.35} color="#a78bfa" />

      <Suspense fallback={null}>
        <GalaxyBackdrop />
        <Stars radius={70} depth={45} count={2800} factor={2.6} fade speed={0.4} />
        <EarthGlobe />
        <Continents onOpen={onOpen} />
        <OrbitPaths />
        <DsgFireball />
        <VibezSatellite />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.18}
        minPolarAngle={Math.PI * 0.4}
        maxPolarAngle={Math.PI * 0.6}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.4} luminanceThreshold={0.2} luminanceSmoothing={0.5} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[260px] w-full max-w-[520px] items-center justify-center sm:h-[360px] lg:h-[540px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez Earth hub — tap a continent for its dashboard"
    >
      <Canvas
        camera={{ position: [0, 0.25, 9.4], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
      <p
        data-testid="landing-planet-cta"
        className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] font-black uppercase tracking-[0.28em] sm:text-[10px]"
        style={{
          background: "linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b,#fde68a)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          color: "transparent",
          animation: "landingCtaShift 2.4s ease-in-out infinite",
        }}
      >
        Tap a continent · your dashboard
      </p>
      <style>{`
        @keyframes landingCtaShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

export default LandingPlanet;
