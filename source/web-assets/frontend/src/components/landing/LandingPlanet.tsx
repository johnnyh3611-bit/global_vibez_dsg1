/**
 * LandingPlanet — orbital architecture (locked).
 *
 * • Central fixed Sphere — /global-vibez-logo.png texture (no distortion mesh)
 * • Branding text mesh ("Globalize Digital") — renderOrder > planet, depthTest:false
 * • 4 orbiting Sphere meshes — Gaming, Dating, Streams, Earn — each with
 *   Billboard name labels (depthTest:false) so hubs stay identifiable
 * • DSG fireball — dsg-emissive.png + "DSG" label, emissiveIntensity 15, ellipse
 * • Deep space #000000 · static camera · no blob continents
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

const ORBIT_R = 2.85;
const HUB_ORBIT_SPEED = 0.35;
const DSG_A = 4.1; // ellipse semi-major (X)
const DSG_B = 2.55; // ellipse semi-minor (Z)
const DSG_SPEED = 0.55;
const CAMERA_Z = 9.5;
/** Branding + hub labels always draw above planet geometry */
const BRAND_RENDER_ORDER = 100;
const HUB_LABEL_RENDER_ORDER = 90;
const PLANET_RENDER_ORDER = 0;

type HubPlanet = {
  id: "gaming" | "dating" | "streams" | "earn";
  src: string;
  neon: string;
  path: string;
  /** Display name — always readable on the orbiting subplanet */
  label: string;
  /** Fixed starting angle on the orbital ring (radians) */
  phase: number;
};

const HUB_PLANETS: HubPlanet[] = [
  {
    id: "gaming",
    src: "/assets/hub-gaming.png",
    neon: "#22d3ee",
    path: "/games",
    label: "Gaming",
    phase: 0,
  },
  {
    id: "dating",
    src: "/assets/hub-dating.png",
    neon: "#fb7185",
    path: "/dating",
    label: "Dating",
    phase: Math.PI / 2,
  },
  {
    id: "streams",
    src: "/assets/hub-streams.png",
    neon: "#c084fc",
    path: "/my-streams",
    label: "Streams",
    phase: Math.PI,
  },
  {
    id: "earn",
    src: "/assets/hub-earn.png",
    neon: "#fbbf24",
    path: "/wallet",
    label: "Earn",
    phase: (Math.PI * 3) / 2,
  },
];

/** Shared: force troika/Text materials to ignore depth so labels stay on top. */
function applyAlwaysOnTopMaterial(troika: {
  material?: THREE.Material | THREE.Material[];
}) {
  const mats = troika.material
    ? Array.isArray(troika.material)
      ? troika.material
      : [troika.material]
    : [];
  for (const mat of mats) {
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.transparent = true;
    mat.needsUpdate = true;
  }
}

function CentralLogoSphere() {
  const map = useTexture("/global-vibez-logo.png");
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  return (
    <mesh renderOrder={PLANET_RENDER_ORDER}>
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

/**
 * Branding text must stay readable over the planet at every rotation.
 * depthTest:false + high renderOrder wins the draw order; Billboard faces
 * the camera; frustumCulled:false + near padding avoids near-plane clips.
 */
function BrandingTextMesh() {
  return (
    <Billboard
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
      position={[0, -2.05, 1.6]}
      renderOrder={BRAND_RENDER_ORDER}
    >
      <Text
        fontSize={0.42}
        maxWidth={6}
        lineHeight={1.15}
        letterSpacing={0.04}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#e0f2fe"
        outlineWidth={0.028}
        outlineColor="#020617"
        outlineOpacity={0.9}
        fillOpacity={1}
        depthOffset={-2}
        renderOrder={BRAND_RENDER_ORDER}
        frustumCulled={false}
        onSync={applyAlwaysOnTopMaterial}
      >
        Globalize Digital
      </Text>
    </Billboard>
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
  const spin = useRef<THREE.Group>(null);
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
    // Spin only the globe mesh — keep the name billboard upright/readable
    if (spin.current) spin.current.rotation.y = t * 0.8;
  });

  return (
    <group ref={group}>
      <group ref={spin}>
        <mesh
          renderOrder={1}
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
        {/* Neon rim — emissive shell */}
        <mesh scale={1.12} renderOrder={1}>
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

      {/* Hub name — always on top of planet + sibling hubs */}
      <Billboard
        follow
        position={[0, -0.62, 0]}
        renderOrder={HUB_LABEL_RENDER_ORDER}
      >
        <Text
          fontSize={0.22}
          maxWidth={2.2}
          textAlign="center"
          anchorX="center"
          anchorY="top"
          color="#ffffff"
          outlineWidth={0.03}
          outlineColor="#020617"
          outlineOpacity={1}
          fillOpacity={1}
          depthOffset={-1}
          renderOrder={HUB_LABEL_RENDER_ORDER}
          frustumCulled={false}
          onSync={applyAlwaysOnTopMaterial}
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
          {hub.label}
        </Text>
      </Billboard>
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
      <mesh ref={core} renderOrder={2}>
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
      <mesh scale={1.45} renderOrder={2}>
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
      <Billboard
        follow
        position={[0, -0.68, 0]}
        renderOrder={HUB_LABEL_RENDER_ORDER}
      >
        <Text
          fontSize={0.24}
          textAlign="center"
          anchorX="center"
          anchorY="top"
          color="#ffe7c2"
          outlineWidth={0.032}
          outlineColor="#1a0500"
          outlineOpacity={1}
          fillOpacity={1}
          depthOffset={-1}
          renderOrder={HUB_LABEL_RENDER_ORDER}
          frustumCulled={false}
          onSync={applyAlwaysOnTopMaterial}
        >
          DSG
        </Text>
      </Billboard>
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
        <BrandingTextMesh />
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
      className="relative mx-auto h-[280px] w-full max-w-[520px] overflow-hidden sm:h-[380px] lg:h-[520px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez orbital hub"
    >
      <Canvas
        // near kept low so branding text at z≈1.6 never clips; far covers DSG ellipse
        camera={{ position: [0, 0.15, CAMERA_Z], fov: 42, near: 0.05, far: 120 }}
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
