/**
 * LandingPlanet — home globe people tap for dashboards.
 *
 * • Looks like Earth (texture + drifting clouds + soft glass atmosphere)
 * • Continent landmasses + flat tabs sit INSIDE / flush on the planet (no bulging mini-planets)
 * • Clear name labels on each tab → dashboards
 * • ONE DSG fireball that truly CIRCLES the planet (full 3D orbit)
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.1;
/** Radius of the DSG orbit around the planet center */
const ORBIT_R = 3.35;
const ORBIT_TILT = 0.35; // radians — tilts the orbital plane
/** Tabs sit flush on the crust — never out past the silhouette as mini-planets */
const TAB_R = GLOBE_R * 1.006;
const TAB_SIZE = 0.28;

const HUB_ART: Partial<Record<HubId, { src: string; label: string; glow: string }>> = {
  ridez: { src: "/assets/hub-viberide.png", label: "VibeRide", glow: "#22d3ee" },
  vineyards: { src: "/assets/hub-vineyards.png", label: "Vibe Vineyards", glow: "#f9a8d4" },
  hungry: { src: "/assets/hub-hungry.png", label: "Hungry Vibez", glow: "#fb923c" },
  dating: { src: "/assets/hub-dating.png", label: "Dating", glow: "#fb7185" },
  viberise: { src: "/assets/hub-logistics.png", label: "Logistics Hub", glow: "#c084fc" },
  cdl: { src: "/assets/hub-cdl.png", label: "CDL / GDL", glow: "#fbbf24" },
  vibe: { src: "/assets/hub-home.png", label: "Home", glow: "#2dd4bf" },
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

/** Orient a group so +Z points along the surface normal (flat on the planet). */
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

/** Paint "DSG" onto a canvas so it wraps a real 3D sphere (no paper billboard). */
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
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.018;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.78} metalness={0.05} />
      </mesh>

      {/* Soft colored landmasses INSIDE the glass shell — the “little land” behind each tab */}
      <mesh scale={1.004}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          map={continents}
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Light glass sheen over landmasses */}
      <mesh scale={1.008}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          color="#7dd3fc"
          transparent
          opacity={0.16}
          roughness={0.2}
          metalness={0.15}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.018}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <mesh scale={1.08}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Flat continent tab painted onto the planet surface (no glowing sphere bulge).
 * Icon + name sit on / in the landmass so the silhouette stays a clean planet.
 * Limb/back-facing tabs fade out so they don't poke past the planet edge.
 */
function ContinentTab({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_ART[hub.id];
  const map = useTexture(art?.src || "/assets/hub-home.png");
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => hubToSphere(hub, TAB_R), [hub]);
  const quat = useMemo(() => surfaceBasis(pos), [pos]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    // Hide near the limb / back so tabs never poke past the planet edge
    const facing = normal.dot(camera.position.clone().normalize());
    groupRef.current.visible = facing > 0.18;
  });

  if (!art) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(hub);
  };

  const setCursor = (on: boolean) => {
    document.body.style.cursor = on ? "pointer" : "auto";
  };

  return (
    <group ref={groupRef} position={pos} quaternion={quat}>
      {/* Soft land pad under the icon — flush disk on the crust */}
      <mesh position={[0, 0, 0.001]} renderOrder={2}>
        <circleGeometry args={[TAB_SIZE * 0.85, 32]} />
        <meshBasicMaterial
          color={art.glow}
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>

      {/* Flat icon inset on that land — smaller so it reads as a tab, not a moon */}
      <mesh
        position={[0, 0.04, 0.003]}
        renderOrder={3}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        <circleGeometry args={[TAB_SIZE * 0.48, 32]} />
        <meshBasicMaterial
          map={map}
          transparent
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </mesh>

      {/* Name plate flush on the landmass */}
      <mesh position={[0, -TAB_SIZE * 0.72, 0.004]} renderOrder={4}>
        <planeGeometry args={[TAB_SIZE * 2.35, 0.14]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <Text
        position={[0, -TAB_SIZE * 0.72, 0.01]}
        fontSize={0.105}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#020617"
        maxWidth={1.2}
        textAlign="center"
        renderOrder={5}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        {art.label}
      </Text>
    </group>
  );
}

function Continents({ onOpen }: { onOpen: (h: HubDef) => void }) {
  return (
    <group>
      {GLOBE_HUBS.map((hub) => (
        <ContinentTab key={hub.id} hub={hub} onOpen={onOpen} />
      ))}
    </group>
  );
}

/**
 * Solid 3D DSG fireball on a FULL circular orbit around the planet.
 * (Previous abs(sin) path made it scrub back-and-forth in front.)
 */
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

    if (group.current) {
      group.current.position.copy(local);
    }
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

/** Visible thin orbit ring so the circle path reads clearly */
function OrbitPath() {
  return (
    <mesh rotation={[Math.PI / 2 + ORBIT_TILT, 0, 0]}>
      <torusGeometry args={[ORBIT_R, 0.012, 8, 128]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.4} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 3, 4]} intensity={1.35} />
      <pointLight position={[-3, 2, 2]} intensity={0.4} color="#a78bfa" />

      <Stars radius={50} depth={30} count={900} factor={2} fade speed={0.25} />

      <Suspense fallback={null}>
        <EarthGlobe />
        <Continents onOpen={onOpen} />
        <OrbitPath />
        <DsgFireball />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.25}
        minPolarAngle={Math.PI * 0.38}
        maxPolarAngle={Math.PI * 0.62}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.1} luminanceThreshold={0.28} luminanceSmoothing={0.6} mipmapBlur />
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
