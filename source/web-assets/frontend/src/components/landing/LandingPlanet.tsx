/**
 * LandingPlanet — founder-target home globe.
 *
 * Match the reference mock closely:
 * • Clear Earth in deep space (Milky Way / constellation behind)
 * • Recognizable neon shapes ON the planet (car, heart, truck, towers…) — tappable tabs
 * • Thin constellation links between hubs
 * • ONE DSG fireball sun circling the planet
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, OrbitControls, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.15;
const ORBIT_R = 3.45;
const ORBIT_TILT = 0.32;
/** Shapes sit on the front crust — close enough to read as “on” the planet */
const SHAPE_R = GLOBE_R * 1.018;

const HUB_SHAPE: Partial<
  Record<HubId, { src: string; label: string; glow: string; scale: number }>
> = {
  ridez: {
    src: "/assets/shape-viberide.png",
    label: "VibeRide",
    glow: "#22d3ee",
    scale: 0.72,
  },
  dating: {
    src: "/assets/shape-dating.png",
    label: "Dating",
    glow: "#fb7185",
    scale: 0.68,
  },
  hungry: {
    src: "/assets/shape-hungry.png",
    label: "Hungry Vibez",
    glow: "#fb923c",
    scale: 0.7,
  },
  viberise: {
    src: "/assets/shape-viberise.png",
    label: "VibeRise",
    glow: "#c084fc",
    scale: 0.7,
  },
  cdl: {
    src: "/assets/shape-cdl.png",
    label: "CDL / GDL",
    glow: "#fbbf24",
    scale: 0.72,
  },
  vineyards: {
    src: "/assets/shape-vineyards.png",
    label: "Vibe Vineyards",
    glow: "#f9a8d4",
    scale: 0.66,
  },
  vibe: {
    src: "/assets/shape-home.png",
    label: "Home",
    glow: "#2dd4bf",
    scale: 0.62,
  },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.25;
  const lat = (0.5 - top) * Math.PI * 0.8;
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

    const nebulae: Array<[number, number, number, string]> = [
      [240, 220, 200, "rgba(56,189,248,0.18)"],
      [540, 250, 240, "rgba(168,85,247,0.16)"],
      [800, 200, 180, "rgba(244,114,182,0.12)"],
    ];
    for (const [x, y, r, color] of nebulae) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.75})`;
      ctx.fillRect(x, y, Math.random() * 1.7, Math.random() * 1.7);
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
    const g = ctx.createRadialGradient(256, 240, 20, 256, 256, 250);
    g.addColorStop(0, "#fff7ed");
    g.addColorStop(0.25, "#fbbf24");
    g.addColorStop(0.55, "#f97316");
    g.addColorStop(0.85, "#dc2626");
    g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.beginPath();
    ctx.ellipse(256, 270, 118, 86, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.moveTo(256, 175);
    ctx.bezierCurveTo(230, 220, 220, 245, 245, 270);
    ctx.bezierCurveTo(235, 250, 256, 290, 270, 255);
    ctx.bezierCurveTo(290, 275, 285, 220, 256, 175);
    ctx.fill();

    ctx.font = "900 78px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 7;
    ctx.strokeText("DSG", 256, 300);
    ctx.fillText("DSG", 256, 300);

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

/** Thin neon links between hubs — constellation web from the reference */
function ConstellationLinks() {
  const positions = useMemo(() => GLOBE_HUBS.map((h) => hubToSphere(h, GLOBE_R * 1.01)), []);
  const geom = useMemo(() => {
    const pts: number[] = [];
    // Connect each hub to its two nearest neighbors for a clean web
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      const scored = positions
        .map((p, j) => ({ j, d: a.distanceTo(p) }))
        .filter((x) => x.j !== i)
        .sort((u, v) => u.d - v.d)
        .slice(0, 2);
      for (const { j } of scored) {
        if (j < i) continue; // draw each edge once
        pts.push(a.x, a.y, a.z, positions[j].x, positions[j].y, positions[j].z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [positions]);

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#e2e8f0" transparent opacity={0.35} toneMapped={false} />
    </lineSegments>
  );
}

function EarthGlobe() {
  const [earth, clouds] = useTexture(["/assets/earth-texture.jpg", "/assets/earth-clouds.jpg"]);
  const cloudRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.014;
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.004;
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.7} metalness={0.08} />
      </mesh>

      {/* Soft city-light sheen so continents read under the icons */}
      <mesh scale={1.003}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudRef} scale={1.018}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <mesh scale={1.1}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

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
    groupRef.current.visible = facing > 0.08;
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
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Soft neon halo behind the shape */}
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[s * 0.42, 32]} />
          <meshBasicMaterial
            color={art.glow}
            transparent
            opacity={0.28}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* The recognizable shape itself (car / heart / truck…) */}
        <sprite
          scale={[s, s, 1]}
          onClick={click}
          onPointerOver={() => setCursor(true)}
          onPointerOut={() => setCursor(false)}
        >
          <spriteMaterial
            map={map}
            transparent
            depthWrite={false}
            toneMapped={false}
            opacity={1}
          />
        </sprite>

        <Text
          position={[0, -s * 0.52, 0.02]}
          fontSize={0.125}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#020617"
          maxWidth={1.4}
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
      <ConstellationLinks />
      {GLOBE_HUBS.map((hub) => (
        <HubShape key={hub.id} hub={hub} onOpen={onOpen} />
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
    const a = t * 0.52;
    const local = new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
    local.applyMatrix4(orbitPlane);

    if (group.current) group.current.position.copy(local);
    if (ring.current) ring.current.rotation.z = t * 3.2;
    if (core.current) {
      core.current.rotation.y = t * 1.4;
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        4.6 + Math.sin(t * 7) * 0.8;
    }
    if (light.current) {
      const front = THREE.MathUtils.clamp((local.z / ORBIT_R) * 0.5 + 0.5, 0.35, 1);
      light.current.intensity = (4 + Math.sin(t * 5) * 0.5) * front;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff6a00" intensity={4} distance={11} decay={2} />

      <mesh scale={1.7}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ring} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[0.52, 0.045, 10, 48]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={5}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={core}>
        <sphereGeometry args={[0.36, 48, 48]} />
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
      <torusGeometry args={[ORBIT_R, 0.01, 8, 128]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.32} toneMapped={false} />
    </mesh>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.45} />
      <pointLight position={[-4, 2, 2]} intensity={0.4} color="#a78bfa" />

      <Suspense fallback={null}>
        <GalaxyBackdrop />
        <Stars radius={70} depth={45} count={2800} factor={2.6} fade speed={0.4} />
        <EarthGlobe />
        <Continents onOpen={onOpen} />
        <OrbitPath />
        <DsgFireball />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.2}
        minPolarAngle={Math.PI * 0.4}
        maxPolarAngle={Math.PI * 0.6}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.35} luminanceThreshold={0.22} luminanceSmoothing={0.55} mipmapBlur />
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
        camera={{ position: [0, 0.25, 9.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
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
          textShadow: "0 0 18px rgba(251,191,36,0.35)",
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
