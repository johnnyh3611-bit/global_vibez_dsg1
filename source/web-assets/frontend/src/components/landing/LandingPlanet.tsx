/**
 * LandingPlanet — home globe people tap for dashboards.
 *
 * • Looks like Earth (texture + drifting clouds + soft glass atmosphere)
 * • Continent tabs INSIDE/on the planet with clear names → dashboards
 * • ONE DSG fireball that truly CIRCLES the planet (full 3D orbit)
 * • DSG is a solid glowing 3D sun — not a flat paper sprite
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

    // dark badge oval
    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.ellipse(256, 270, 120, 88, 0, 0, Math.PI * 2);
    ctx.fill();

    // flame
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
  const [earth, clouds] = useTexture(["/assets/earth-texture.jpg", "/assets/earth-clouds.jpg"]);
  const cloudRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.018;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.78} metalness={0.05} />
      </mesh>

      {/* Soft hub glow patches under the tabs */}
      <mesh scale={1.002}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.02}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.42} depthWrite={false} />
      </mesh>

      {/* Atmosphere */}
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

function ContinentTab({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_ART[hub.id];
  const map = useTexture(art?.src || "/assets/hub-home.png");
  const pos = useMemo(() => hubToSphere(hub, GLOBE_R * 1.05), [hub]);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  if (!art) return null;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(hub);
  };

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={art.glow}
          emissive={art.glow}
          emissiveIntensity={2.8}
          toneMapped={false}
        />
      </mesh>
      <sprite
        scale={[0.7, 0.7, 1]}
        position={[0, 0.1, 0.04]}
        onClick={click}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <spriteMaterial map={map} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      {/* Large clear name */}
      <Text
        position={[0, -0.38, 0.1]}
        fontSize={0.16}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#020617"
        onClick={click}
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
    const a = t * 0.55; // angular speed

    // Full circle in XZ, then tilt the plane — true orbit around the globe
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
      // Dim a bit when behind the planet (negative z after tilt ≈ local.z)
      const front = THREE.MathUtils.clamp((local.z / ORBIT_R) * 0.5 + 0.5, 0.35, 1);
      light.current.intensity = (3.8 + Math.sin(t * 5) * 0.5) * front;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff6a00" intensity={4} distance={10} decay={2} />

      {/* Soft corona — additive sphere shell, still 3D (not a paper card) */}
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

      {/* Fire ring spinning around the sun */}
      <mesh ref={ring} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[0.48, 0.04, 10, 48]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>

      {/* Solid fiery core with DSG painted on the sphere */}
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
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 4]} intensity={1.25} />
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
        <Bloom intensity={1.25} luminanceThreshold={0.25} luminanceSmoothing={0.6} mipmapBlur />
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
          toneMappingExposure: 1.1,
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
