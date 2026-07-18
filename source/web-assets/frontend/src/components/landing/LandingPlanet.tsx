/**
 * LandingPlanet — home globe people tap for dashboards.
 *
 * Spec (founder):
 * • Glass planet in deep space (galaxy / Milky Way behind)
 * • Landmasses INSIDE the planet ARE the tabs (different shapes OK)
 * • Tap a named landmass → that hub’s dashboard
 * • ONE DSG sun/satellite circles the planet
 * • No little planets bulging off the rim
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.1;
const ORBIT_R = 3.35;
const ORBIT_TILT = 0.35;
/** Landmass hit/label sits flush on the crust — never a bulging mini-planet */
const LAND_R = GLOBE_R * 1.004;

const HUB_LAND: Partial<Record<HubId, { label: string; glow: string; scale: number }>> = {
  vibe: { label: "Home", glow: "#2dd4bf", scale: 1.05 },
  viberise: { label: "VibeRise", glow: "#c084fc", scale: 1.0 },
  vineyards: { label: "Vibe Vineyards", glow: "#f9a8d4", scale: 1.1 },
  ridez: { label: "VibeRide", glow: "#22d3ee", scale: 1.0 },
  hungry: { label: "Hungry Vibez", glow: "#fb923c", scale: 1.05 },
  dating: { label: "Dating", glow: "#fb7185", scale: 0.95 },
  cdl: { label: "CDL / GDL", glow: "#fbbf24", scale: 1.0 },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.3;
  const lat = (0.5 - top) * Math.PI * 0.85;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.cos(lon) * radius,
  );
}

function surfaceBasis(pos: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const z = pos.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  else x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  m.makeBasis(x, y, z);
  q.setFromRotationMatrix(m);
  return q;
}

/** Soft Milky Way / nebula band for the deep-space backdrop */
function useGalaxyTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;

    // Deep space
    const space = ctx.createLinearGradient(0, 0, 0, 512);
    space.addColorStop(0, "#020617");
    space.addColorStop(0.45, "#0b1026");
    space.addColorStop(1, "#020617");
    ctx.fillStyle = space;
    ctx.fillRect(0, 0, 1024, 512);

    // Milky Way band
    const band = ctx.createLinearGradient(0, 140, 0, 380);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.35, "rgba(147,197,253,0.12)");
    band.addColorStop(0.5, "rgba(248,250,252,0.22)");
    band.addColorStop(0.65, "rgba(216,180,254,0.14)");
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 1024, 512);

    // Nebula clouds
    const blobs: Array<[number, number, number, string]> = [
      [220, 200, 180, "rgba(56,189,248,0.16)"],
      [520, 260, 220, "rgba(192,132,252,0.14)"],
      [780, 210, 160, "rgba(244,114,182,0.12)"],
      [400, 320, 140, "rgba(34,211,238,0.1)"],
    ];
    for (const [x, y, r, color] of blobs) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Star field
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const s = Math.random() * 1.6;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.7})`;
      ctx.fillRect(x, y, s, s);
    }
    // Brighter star points
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function useDsgSphereTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 240, 20, 256, 256, 250);
    g.addColorStop(0, "#fff7ed");
    g.addColorStop(0.25, "#fbbf24");
    g.addColorStop(0.55, "#f97316");
    g.addColorStop(0.85, "#dc2626");
    g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.ellipse(256, 270, 120, 88, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.moveTo(256, 175);
    ctx.bezierCurveTo(230, 220, 220, 245, 245, 270);
    ctx.bezierCurveTo(235, 250, 256, 290, 270, 255);
    ctx.bezierCurveTo(290, 275, 285, 220, 256, 175);
    ctx.fill();

    ctx.font = "900 72px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fde68a";
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 6;
    ctx.strokeText("DSG", 256, 300);
    ctx.fillText("DSG", 256, 300);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/** Soft irregular land silhouette (flat) — different shape per hub, not a 3D orb */
function useLandSilhouette(glow: string, seed: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 256);

    const cx = 128;
    const cy = 128;
    const lobes = 5 + (seed % 3);
    ctx.beginPath();
    for (let i = 0; i <= lobes; i++) {
      const t = (i / lobes) * Math.PI * 2;
      const wobble = 0.72 + ((Math.sin(seed * 12.3 + i * 2.1) + 1) / 2) * 0.28;
      const r = 88 * wobble;
      const x = cx + Math.cos(t) * r;
      const y = cy + Math.sin(t) * r * 0.88;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const fill = ctx.createRadialGradient(cx, cy, 10, cx, cy, 110);
    fill.addColorStop(0, glow);
    fill.addColorStop(0.55, glow);
    fill.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.95;
    ctx.fill();

    // Soft inner sparkle so it reads as a living continent
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 18; i++) {
      const a = (seed * 7 + i * 37) % 360;
      const rad = ((seed * 13 + i * 19) % 55) + 12;
      const x = cx + Math.cos((a * Math.PI) / 180) * rad;
      const y = cy + Math.sin((a * Math.PI) / 180) * rad * 0.9;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [glow, seed]);
}

function GalaxyBackdrop() {
  const map = useGalaxyTexture();
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.008;
  });
  return (
    <mesh ref={ref} position={[0, 0, -8]} scale={[18, 10, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function EarthGlobe() {
  const [earth, clouds, continents] = useTexture([
    "/assets/earth-texture.jpg",
    "/assets/earth-clouds.jpg",
    "/assets/hub-continent-shapes.png",
  ]);
  const cloudRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
    continents.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds, continents]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.016;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.82} metalness={0.04} />
      </mesh>

      {/* Continent color landmasses — the real tabs live on these */}
      <mesh scale={1.005}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          map={continents}
          transparent
          opacity={0.88}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={1.01}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          color="#7dd3fc"
          transparent
          opacity={0.12}
          roughness={0.15}
          metalness={0.2}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.02}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <mesh scale={1.09}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * One landmass tab: flat continent shape flush on the planet + clear name.
 * No orb / mini-planet geometry.
 */
function LandmassTab({
  hub,
  index,
  onOpen,
}: {
  hub: HubDef;
  index: number;
  onOpen: (h: HubDef) => void;
}) {
  const land = HUB_LAND[hub.id];
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => hubToSphere(hub, LAND_R), [hub]);
  const quat = useMemo(() => surfaceBasis(pos), [pos]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);
  const silhouette = useLandSilhouette(land?.glow || "#67e8f9", index + 3);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const facing = normal.dot(camera.position.clone().normalize());
    groupRef.current.visible = facing > 0.15;
  });

  if (!land) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(hub);
  };
  const setCursor = (on: boolean) => {
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  const s = 0.55 * land.scale;

  return (
    <group ref={groupRef} position={pos} quaternion={quat}>
      {/* Flat landmass shape — the tab itself */}
      <mesh
        position={[0, 0, 0.002]}
        renderOrder={3}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        <planeGeometry args={[s * 1.35, s * 1.15]} />
        <meshBasicMaterial
          map={silhouette}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          polygonOffset
          polygonOffsetFactor={-3}
        />
      </mesh>

      {/* Invisible larger hit target so tapping the land is easy */}
      <mesh
        position={[0, 0, 0.003]}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        <circleGeometry args={[s * 0.55, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Name on the landmass */}
      <Text
        position={[0, -s * 0.42, 0.012]}
        fontSize={0.12}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.016}
        outlineColor="#020617"
        maxWidth={1.35}
        textAlign="center"
        renderOrder={5}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        {land.label}
      </Text>
    </group>
  );
}

function Continents({ onOpen }: { onOpen: (h: HubDef) => void }) {
  return (
    <group>
      {GLOBE_HUBS.map((hub, i) => (
        <LandmassTab key={hub.id} hub={hub} index={i} onOpen={onOpen} />
      ))}
    </group>
  );
}

function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useTexture("/assets/sun-glow.png");
  const dsgMap = useDsgSphereTexture();
  const orbitPlane = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeRotationX(ORBIT_TILT);
    return m;
  }, []);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
  }, [glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const a = t * 0.55;
    const local = new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
    local.applyMatrix4(orbitPlane);

    if (group.current) group.current.position.copy(local);
    if (ring.current) ring.current.rotation.z = t * 3.2;
    if (core.current) {
      core.current.rotation.y = t * 1.4;
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        4.5 + Math.sin(t * 7) * 0.8;
    }
    if (light.current) {
      const front = THREE.MathUtils.clamp((local.z / ORBIT_R) * 0.5 + 0.5, 0.35, 1);
      light.current.intensity = (3.8 + Math.sin(t * 5) * 0.5) * front;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff6a00" intensity={4} distance={10} decay={2} />

      <mesh scale={1.55}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ring} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[0.48, 0.04, 10, 48]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={core}>
        <sphereGeometry args={[0.34, 48, 48]} />
        <meshStandardMaterial
          map={dsgMap}
          emissiveMap={dsgMap}
          emissive="#ff4500"
          emissiveIntensity={4.8}
          roughness={0.35}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function OrbitPath() {
  return (
    <mesh rotation={[Math.PI / 2 + ORBIT_TILT, 0, 0]}>
      <torusGeometry args={[ORBIT_R, 0.012, 8, 128]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.38} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 3, 4]} intensity={1.3} />
      <pointLight position={[-3, 2, 2]} intensity={0.35} color="#a78bfa" />

      <Suspense fallback={null}>
        <GalaxyBackdrop />
        <Stars radius={60} depth={40} count={2200} factor={2.4} fade speed={0.35} />
        <EarthGlobe />
        <Continents onOpen={onOpen} />
        <OrbitPath />
        <DsgFireball />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.22}
        minPolarAngle={Math.PI * 0.38}
        maxPolarAngle={Math.PI * 0.62}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.15} luminanceThreshold={0.26} luminanceSmoothing={0.55} mipmapBlur />
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
        camera={{ position: [0, 0.35, 9.5], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
      <p
        data-testid="landing-planet-cta"
        className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] font-black uppercase tracking-[0.28em] sm:text-[10px]"
        style={{
          background: "linear-gradient(90deg,#67e8f9,#f9a8d4,#fbbf24,#67e8f9)",
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
