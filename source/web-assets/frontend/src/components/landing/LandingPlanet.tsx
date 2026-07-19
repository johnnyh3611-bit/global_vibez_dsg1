/**
 * LandingPlanet — orbital architecture (locked).
 *
 * • Central fixed Sphere — /global-vibez-logo.png texture (no distortion mesh)
 * • Branding text mesh ("Globalize Digital") — renderOrder > planet, depthTest:false
 * • 4 orbiting Sphere meshes — Gaming, Dating, Streams, Earn — each with
 *   Billboard name labels (depthTest:false) so hubs stay identifiable
 * • DSG fireball — dark "DSG" painted on the sphere; fire rings orbit the body;
 *   satellite itself ellipses around the planet (no outer name tag)
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

/**
 * Paint dark "DSG" into the fireball sphere texture itself.
 * Not an outer Billboard label — the mark lives on the satellite face,
 * with fire filling the rest of the sun.
 */
function useDsgSatelliteTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d")!;

    // Fire fill across the sphere
    const fire = ctx.createRadialGradient(256, 230, 16, 256, 256, 255);
    fire.addColorStop(0, "#fff7ed");
    fire.addColorStop(0.18, "#fde68a");
    fire.addColorStop(0.4, "#f97316");
    fire.addColorStop(0.7, "#ea580c");
    fire.addColorStop(0.9, "#dc2626");
    fire.addColorStop(1, "#450a0a");
    ctx.fillStyle = fire;
    ctx.fillRect(0, 0, 512, 512);

    // Flame tongues around the rim
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = 256 + Math.cos(a) * 190;
      const y = 256 + Math.sin(a) * 190;
      const tipX = 256 + Math.cos(a) * 248;
      const tipY = 256 + Math.sin(a) * 248;
      const g = ctx.createLinearGradient(x, y, tipX, tipY);
      g.addColorStop(0, "rgba(255,247,237,0.95)");
      g.addColorStop(0.45, "rgba(249,115,22,0.85)");
      g.addColorStop(1, "rgba(127,29,29,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a + 0.35) * 28, y + Math.sin(a + 0.35) * 28);
      ctx.quadraticCurveTo(tipX, tipY, x + Math.cos(a - 0.35) * 28, y + Math.sin(a - 0.35) * 28);
      ctx.closePath();
      ctx.fill();
    }

    // Dark core — DSG reads from INSIDE the satellite
    ctx.fillStyle = "rgba(8, 8, 12, 0.92)";
    ctx.beginPath();
    ctx.ellipse(256, 262, 118, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 5;
    ctx.stroke();

    // Small flame mark above the letters
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.moveTo(256, 198);
    ctx.bezierCurveTo(236, 232, 228, 252, 246, 272);
    ctx.bezierCurveTo(238, 255, 256, 288, 268, 260);
    ctx.bezierCurveTo(286, 278, 280, 228, 256, 198);
    ctx.fill();

    // Dark-contrast DSG lettering inside the core
    ctx.font = "900 78px Arial Black, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1c1917";
    ctx.strokeText("DSG", 256, 292);
    ctx.fillStyle = "#fafaf9";
    ctx.fillText("DSG", 256, 292);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, []);
}

function DsgFireball() {
  const group = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const fireRing = useRef<THREE.Mesh>(null);
  const fireRing2 = useRef<THREE.Mesh>(null);
  const dsgMap = useDsgSatelliteTexture();
  const glow = useTexture("/assets/sun-glow.png");

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
  }, [glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * DSG_SPEED;
    // Satellite orbits the planet grouping
    const x = Math.cos(t) * DSG_A;
    const z = Math.sin(t) * DSG_B;
    const y = Math.sin(t * 1.4) * 0.45;
    if (group.current) {
      group.current.position.set(x, y, z);
    }
    if (coreMat.current) {
      coreMat.current.emissiveIntensity = 6.5 + Math.sin(t * 6) * 1.2;
    }
    // Fire rings spin around the satellite — DSG core stays camera-facing
    if (fireRing.current) fireRing.current.rotation.z = t * 3.4;
    if (fireRing2.current) fireRing2.current.rotation.z = -t * 2.6;
  });

  return (
    <group ref={group}>
      <pointLight color="#ff6a00" intensity={8} distance={12} decay={2} />

      {/* Soft corona */}
      <mesh scale={1.7} renderOrder={2}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Fire going around the satellite */}
      <mesh
        ref={fireRing}
        rotation={[Math.PI / 2.15, 0.25, 0]}
        renderOrder={3}
      >
        <torusGeometry args={[0.55, 0.045, 12, 64]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={6}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={fireRing2}
        rotation={[Math.PI / 2.6, -0.4, 0.5]}
        renderOrder={3}
      >
        <torusGeometry args={[0.48, 0.028, 10, 48]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={5}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/*
        Billboard keeps the dark DSG face toward the camera while the
        satellite orbits. Fire rings spin around it. No outer under-label.
      */}
      <Billboard follow>
        <mesh renderOrder={4}>
          <sphereGeometry args={[0.42, 64, 64]} />
          <meshStandardMaterial
            ref={coreMat}
            map={dsgMap}
            emissiveMap={dsgMap}
            emissive="#ff4500"
            emissiveIntensity={6.5}
            roughness={0.3}
            metalness={0.08}
            toneMapped={false}
          />
        </mesh>
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
