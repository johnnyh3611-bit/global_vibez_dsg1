/**
 * LandingPlanet — premium glass Earth hub.
 *
 * Spec:
 * • Different glowing CONTINENTS inside the planet (unique shapes, not paper tabs)
 * • Tap a continent → that dashboard
 * • Galaxy around the globe
 * • Orbit ring + DSG fireball circling
 * • Second orbit + VIBES shooting star circling
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.25;
/** Continents sit under the glass shell — inside the planet */
const CONT_R = GLOBE_R * 1.002;
const GLASS_R = GLOBE_R * 1.028;

const DSG_ORBIT_R = 3.65;
const DSG_TILT = 0.4;
const VIBES_ORBIT_R = 4.05;
const VIBES_TILT = -0.52;

const HUB_CONTINENT: Partial<
  Record<HubId, { src: string; label: string; glow: string; w: number; h: number }>
> = {
  ridez: {
    src: "/assets/continent-ridez.png",
    label: "VibeRide",
    glow: "#22d3ee",
    w: 0.95,
    h: 0.78,
  },
  dating: {
    src: "/assets/continent-dating.png",
    label: "Dating",
    glow: "#fb7185",
    w: 0.88,
    h: 0.82,
  },
  hungry: {
    src: "/assets/continent-hungry.png",
    label: "Hungry Vibez",
    glow: "#fb923c",
    w: 0.92,
    h: 0.75,
  },
  viberise: {
    src: "/assets/continent-viberise.png",
    label: "VibeRise",
    glow: "#c084fc",
    w: 0.9,
    h: 0.8,
  },
  cdl: {
    src: "/assets/continent-cdl.png",
    label: "CDL / GDL",
    glow: "#fbbf24",
    w: 0.86,
    h: 0.72,
  },
  vineyards: {
    src: "/assets/continent-vineyards.png",
    label: "Vibe Vineyards",
    glow: "#f472b6",
    w: 0.9,
    h: 0.76,
  },
  vibe: {
    src: "/assets/continent-vibe.png",
    label: "Home",
    glow: "#2dd4bf",
    w: 0.84,
    h: 0.74,
  },
};

function hubToSphere(hub: HubDef, radius: number): THREE.Vector3 {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.15;
  const lat = (0.5 - top) * Math.PI * 0.75;
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon) * radius,
    Math.sin(lat) * radius,
    Math.cos(lat) * Math.cos(lon) * radius,
  );
}

/** Orient so +Z is the surface normal — continent lies on the crust */
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

function useGalaxyTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const space = ctx.createRadialGradient(512, 256, 40, 512, 256, 520);
    space.addColorStop(0, "#0f172a");
    space.addColorStop(0.35, "#0b1026");
    space.addColorStop(1, "#020617");
    ctx.fillStyle = space;
    ctx.fillRect(0, 0, 1024, 512);

    // Milky Way sweep
    ctx.save();
    ctx.translate(512, 256);
    ctx.rotate(-0.35);
    const band = ctx.createLinearGradient(0, -80, 0, 80);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.35, "rgba(125,211,252,0.16)");
    band.addColorStop(0.5, "rgba(255,255,255,0.28)");
    band.addColorStop(0.65, "rgba(216,180,254,0.18)");
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = band;
    ctx.fillRect(-600, -90, 1200, 180);
    ctx.restore();

    for (const [x, y, r, color] of [
      [280, 200, 220, "rgba(34,211,238,0.2)"],
      [620, 280, 260, "rgba(168,85,247,0.18)"],
      [820, 180, 180, "rgba(244,114,182,0.14)"],
      [420, 340, 160, "rgba(251,191,36,0.1)"],
    ] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.8})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, Math.random() * 1.8, Math.random() * 1.8);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function useDsgTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 240, 10, 256, 256, 250);
    g.addColorStop(0, "#fffbeb");
    g.addColorStop(0.2, "#fbbf24");
    g.addColorStop(0.5, "#f97316");
    g.addColorStop(0.8, "#dc2626");
    g.addColorStop(1, "#450a0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? "rgba(253,224,71,0.6)" : "rgba(249,115,22,0.55)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 70, 256 + Math.sin(a) * 70);
      ctx.lineTo(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.beginPath();
    ctx.ellipse(256, 268, 120, 88, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "900 84px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 8;
    ctx.strokeText("DSG", 256, 278);
    ctx.fillStyle = "#fff7ed";
    ctx.fillText("DSG", 256, 278);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function GalaxyBackdrop() {
  const map = useGalaxyTexture();
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.005;
  });
  return (
    <mesh ref={ref} position={[0, 0, -10]} scale={[22, 12, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function EarthGlobe({
  onOpen,
}: {
  onOpen: (h: HubDef) => void;
}) {
  const [earth, clouds] = useTexture(["/assets/earth-texture.jpg", "/assets/earth-clouds.jpg"]);
  const cloudRef = useRef<THREE.Mesh>(null);
  const spin = useRef<THREE.Group>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds]);

  useFrame((_, dt) => {
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.012;
    if (spin.current) spin.current.rotation.y += dt * 0.003;
  });

  return (
    <group>
      <group ref={spin}>
        {/* Ocean / crust */}
        <mesh>
          <sphereGeometry args={[GLOBE_R, 96, 96]} />
          <meshStandardMaterial
            map={earth}
            roughness={0.55}
            metalness={0.18}
            emissive="#0c4a6e"
            emissiveIntensity={0.12}
          />
        </mesh>

        {/* Soft night lights */}
        <mesh scale={1.001}>
          <sphereGeometry args={[GLOBE_R, 64, 64]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.06}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Continents on the crust — under glass */}
        <Continents onOpen={onOpen} />

        <mesh ref={cloudRef} scale={1.018}>
          <sphereGeometry args={[GLOBE_R, 64, 64]} />
          <meshStandardMaterial map={clouds} transparent opacity={0.18} depthWrite={false} />
        </mesh>
      </group>

      {/* Glass shell OVER continents — they read as inside the planet */}
      <mesh scale={GLASS_R / GLOBE_R}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial
          color="#bae6fd"
          transparent
          opacity={0.14}
          roughness={0.08}
          metalness={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere brim */}
      <mesh scale={1.12}>
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
      <mesh scale={1.18}>
        <sphereGeometry args={[GLOBE_R, 40, 40]} />
        <meshBasicMaterial
          color="#a78bfa"
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * One glowing continent landmass — unique shape, flush on the crust, under glass.
 * NOT a paper billboard / rim card.
 */
function ContinentLand({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_CONTINENT[hub.id];
  const map = useTexture(art?.src || "/assets/continent-vibe.png");
  const groupRef = useRef<THREE.Group>(null);
  const pos = useMemo(() => hubToSphere(hub, CONT_R), [hub]);
  const quat = useMemo(() => surfaceBasis(pos), [pos]);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    // Facing hemisphere in world space (parent Earth may be spinning)
    groupRef.current.getWorldPosition(worldPos);
    const facing = worldPos.normalize().dot(camera.position.clone().normalize());
    groupRef.current.visible = facing > 0.12;
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
      {/* Soft glow pad under the landmass */}
      <mesh position={[0, 0, 0.001]} renderOrder={2}>
        <planeGeometry args={[art.w * 1.15, art.h * 1.15]} />
        <meshBasicMaterial
          color={art.glow}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* The continent shape itself — lies on the planet surface */}
      <mesh
        position={[0, 0, 0.004]}
        renderOrder={3}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        <planeGeometry args={[art.w, art.h]} />
        <meshBasicMaterial
          map={map}
          transparent
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-3}
        />
      </mesh>

      {/* Invisible hit area */}
      <mesh
        position={[0, 0, 0.006]}
        onClick={click}
        onPointerOver={() => setCursor(true)}
        onPointerOut={() => setCursor(false)}
      >
        <circleGeometry args={[Math.max(art.w, art.h) * 0.38, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Name on the land */}
      <Text
        position={[0, -art.h * 0.38, 0.02]}
        fontSize={0.115}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#020617"
        maxWidth={1.3}
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
        <ContinentLand key={hub.id} hub={hub} onOpen={onOpen} />
      ))}
    </group>
  );
}

/** DSG fireball — full circular orbit, on fire */
function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useTexture("/assets/sun-glow.png");
  const dsgMap = useDsgTexture();
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
    const a = t * 0.5;
    const local = new THREE.Vector3(Math.cos(a) * DSG_ORBIT_R, 0, Math.sin(a) * DSG_ORBIT_R);
    local.applyMatrix4(orbitPlane);
    if (group.current) group.current.position.copy(local);
    if (ring.current) ring.current.rotation.z = t * 4.5;
    if (ring2.current) ring2.current.rotation.z = -t * 3.2;
    if (core.current) {
      core.current.rotation.y = t * 1.5;
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        5.4 + Math.sin(t * 10) * 1.2;
    }
    if (light.current) {
      const front = THREE.MathUtils.clamp((local.z / DSG_ORBIT_R) * 0.5 + 0.5, 0.4, 1);
      light.current.intensity = (5.5 + Math.sin(t * 6) * 0.9) * front;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff4500" intensity={5.5} distance={13} decay={2} />
      <mesh scale={2.2}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          map={glow}
          color="#ff6a00"
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.1, 0.2, 0]}>
        <torusGeometry args={[0.58, 0.06, 12, 56]} />
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={6.5} toneMapped={false} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2.5, 0.7, 0.2]}>
        <torusGeometry args={[0.68, 0.03, 10, 48]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={5.5} toneMapped={false} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.4, 48, 48]} />
        <meshStandardMaterial
          map={dsgMap}
          emissiveMap={dsgMap}
          emissive="#ff4500"
          emissiveIntensity={5.4}
          roughness={0.28}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** VIBES shooting star — full circular orbit with comet trail */
function VibesShootingStar() {
  const group = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Mesh>(null);
  const orbitPlane = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeRotationX(VIBES_TILT);
    m.multiply(new THREE.Matrix4().makeRotationZ(0.55));
    return m;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const a = -t * 0.38 + 1.2;
    const local = new THREE.Vector3(Math.cos(a) * VIBES_ORBIT_R, 0, Math.sin(a) * VIBES_ORBIT_R);
    local.applyMatrix4(orbitPlane);
    if (group.current) {
      group.current.position.copy(local);
      // Point trail opposite velocity
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).applyMatrix4(orbitPlane).normalize();
      const look = local.clone().add(tangent);
      group.current.lookAt(look);
    }
    if (trail.current) {
      const mat = trail.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.45 + Math.sin(t * 8) * 0.12;
    }
  });

  return (
    <group ref={group}>
      <pointLight color="#a78bfa" intensity={2.4} distance={9} decay={2} />

      {/* Comet trail */}
      <mesh ref={trail} position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 1.1, 16, 1, true]} />
        <meshBasicMaterial
          color="#c084fc"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.7, 12, 1, true]} />
        <meshBasicMaterial
          color="#f0abfc"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Star head */}
      <mesh>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color="#f5d0fe"
          emissive="#e879f9"
          emissiveIntensity={4.5}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.8}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshBasicMaterial
          color="#d946ef"
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <Text
        position={[0, 0.32, 0]}
        fontSize={0.14}
        color="#fdf4ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#3b0764"
      >
        VIBES
      </Text>
    </group>
  );
}

function OrbitPaths() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2 + DSG_TILT, 0, 0]}>
        <torusGeometry args={[DSG_ORBIT_R, 0.014, 8, 140]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.42} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2 + VIBES_TILT, 0, 0.55]}>
        <torusGeometry args={[VIBES_ORBIT_R, 0.01, 8, 140]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.32} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.55} />
      <pointLight position={[-4, 2, 3]} intensity={0.45} color="#a78bfa" />
      <pointLight position={[2, -2, 4]} intensity={0.25} color="#22d3ee" />

      <Suspense fallback={null}>
        <GalaxyBackdrop />
        <Stars radius={80} depth={50} count={3200} factor={2.8} fade speed={0.45} />
        <EarthGlobe onOpen={onOpen} />
        <OrbitPaths />
        <DsgFireball />
        <VibesShootingStar />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.16}
        minPolarAngle={Math.PI * 0.42}
        maxPolarAngle={Math.PI * 0.58}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.45} luminanceThreshold={0.18} luminanceSmoothing={0.48} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[280px] w-full max-w-[520px] items-center justify-center sm:h-[380px] lg:h-[560px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez Earth hub — tap a continent for its dashboard"
    >
      <Canvas
        camera={{ position: [0, 0.2, 9.6], fov: 40 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
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
