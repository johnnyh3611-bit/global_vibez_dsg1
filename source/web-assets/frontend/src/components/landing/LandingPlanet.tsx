/**
 * LandingPlanet — orbital architecture (locked).
 *
 * • Central fixed Sphere — /global-vibez-logo.png texture (no distortion mesh)
 * • 4 orbiting Sphere meshes — Gaming, Dating, Streams, Earn
 * • DSG fireball — dsg-emissive.png, emissiveIntensity 15, elliptical path
 * • Deep space #000000 · static camera · no blob continents · no auto labels
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

const ORBIT_R = 2.85;
const HUB_ORBIT_SPEED = 0.35;
const DSG_A = 4.1; // ellipse semi-major (X)
const DSG_B = 2.55; // ellipse semi-minor (Z)
const DSG_SPEED = 0.55;
const CAMERA_Z = 9.5;

type HubPlanet = {
  id: "gaming" | "dating" | "streams" | "earn";
  src: string;
  neon: string;
  path: string;
  /** Fixed starting angle on the orbital ring (radians) */
  phase: number;
};

const HUB_PLANETS: HubPlanet[] = [
  {
    id: "gaming",
    src: "/assets/hub-gaming.png",
    neon: "#22d3ee",
    path: "/games",
    phase: 0,
  },
  {
    id: "dating",
    src: "/assets/hub-dating.png",
    neon: "#fb7185",
    path: "/dating",
    phase: Math.PI / 2,
  },
  {
    id: "streams",
    src: "/assets/hub-streams.png",
    neon: "#c084fc",
    path: "/my-streams",
    phase: Math.PI,
  },
  {
    id: "earn",
    src: "/assets/hub-earn.png",
    neon: "#fbbf24",
    path: "/wallet",
    phase: (Math.PI * 3) / 2,
  },
];

function CentralLogoSphere() {
  const map = useTexture("/global-vibez-logo.png");
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  return (
    <mesh>
      <sphereGeometry args={[1.35, 64, 64]} />
      <meshStandardMaterial
        map={map}
        roughness={0.45}
        metalness={0.25}
        emissive="#0ea5e9"
        emissiveIntensity={0.35}
        emissiveMap={map}
      />
    </mesh>
  );
}

function OrbitHubSphere({
  hub,
  onOpen,
}: {
  hub: HubPlanet;
  onOpen: (path: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const map = useTexture(hub.src);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime() * HUB_ORBIT_SPEED + hub.phase;
    group.current.position.set(
      Math.cos(t) * ORBIT_R,
      Math.sin(t * 0.35) * 0.35,
      Math.sin(t) * ORBIT_R,
    );
    group.current.rotation.y = t * 0.8;
  });

  return (
    <group ref={group}>
      <mesh
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
        <sphereGeometry args={[0.38, 48, 48]} />
        <meshStandardMaterial
          map={map}
          emissive={hub.neon}
          emissiveMap={map}
          emissiveIntensity={2.8}
          roughness={0.3}
          metalness={0.15}
          toneMapped={false}
        />
      </mesh>
      {/* Neon rim — emissive shell, no labels */}
      <mesh scale={1.12}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial
          color={hub.neon}
          emissive={hub.neon}
          emissiveIntensity={1.6}
          transparent
          opacity={0.22}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const map = useTexture("/assets/dsg-emissive.png");

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * DSG_SPEED;
    // Elliptical path around the entire central grouping
    const x = Math.cos(t) * DSG_A;
    const z = Math.sin(t) * DSG_B;
    const y = Math.sin(t * 1.4) * 0.45;
    if (group.current) {
      group.current.position.set(x, y, z);
    }
    if (core.current) {
      core.current.rotation.y = t * 2.2;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 15 + Math.sin(t * 6) * 2;
    }
  });

  return (
    <group ref={group}>
      <pointLight color="#ff6a00" intensity={8} distance={12} decay={2} />
      <mesh ref={core}>
        <sphereGeometry args={[0.42, 48, 48]} />
        <meshStandardMaterial
          map={map}
          emissiveMap={map}
          emissive="#ff4500"
          emissiveIntensity={15}
          roughness={0.25}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.45}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial
          color="#ff6a00"
          emissive="#ff4500"
          emissiveIntensity={4}
          transparent
          opacity={0.28}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (path: string) => navigate(path);

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 3, 5]} intensity={1.1} />

      <Suspense fallback={null}>
        <CentralLogoSphere />
        {HUB_PLANETS.map((hub) => (
          <OrbitHubSphere key={hub.id} hub={hub} onOpen={onOpen} />
        ))}
        <DsgFireball />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.35} luminanceThreshold={0.15} luminanceSmoothing={0.45} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto h-[280px] w-full max-w-[520px] sm:h-[380px] lg:h-[520px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez orbital hub"
    >
      <Canvas
        camera={{ position: [0, 0.4, CAMERA_Z], fov: 40, near: 0.1, far: 100 }}
        dpr={1.25}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        style={{ width: "100%", height: "100%", background: "#000000" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

export default LandingPlanet;
