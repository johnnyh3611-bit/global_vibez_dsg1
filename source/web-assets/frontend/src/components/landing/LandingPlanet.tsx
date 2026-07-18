/**
 * LandingPlanet — matches founder screenshot:
 *  • One glass Earth hub (right side)
 *  • Continent “tabs” = dashboard links (VibeRide, Dating, Hungry, Logistics…)
 *  • ONE fiery DSG mini-sun orbiting (not multiple suns) with fire ring + trail
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef, type HubId } from "@/hubs/hubRegistry";

const GLOBE_R = 2.05;
const SUN_ORBIT = 3.2;

/** Continent tab art + dashboard label shown on the globe. */
const HUB_ART: Partial<Record<HubId, { src: string; label: string; glow: string }>> = {
  ridez: { src: "/assets/hub-viberide.png", label: "VibeRide", glow: "#22d3ee" },
  viberise: { src: "/assets/hub-logistics.png", label: "Logistics Hub", glow: "#c084fc" },
  dating: { src: "/assets/hub-dating.png", label: "Dating", glow: "#fb7185" },
  hungry: { src: "/assets/hub-hungry.png", label: "Hungry", glow: "#fb923c" },
  cdl: { src: "/assets/hub-cdl.png", label: "CDL / GDL", glow: "#38bdf8" },
  vibe: { src: "/assets/hub-home.png", label: "Home", glow: "#22d3ee" },
  vineyards: { src: "/assets/hub-vineyards.png", label: "Vineyards", glow: "#f9a8d4" },
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

function OrbitalGuideRings() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.05;
  });
  return (
    <group ref={g}>
      {[
        { r: 2.4, c: "#a78bfa", rot: [0.95, 0.15, 0.1] as const },
        { r: 2.65, c: "#f97316", rot: [1.15, -0.35, 0.05] as const },
        { r: 2.9, c: "#22d3ee", rot: [0.5, 0.55, -0.25] as const },
      ].map((ring) => (
        <mesh key={ring.r} rotation={[...ring.rot]}>
          <torusGeometry args={[ring.r, 0.012, 12, 180]} />
          <meshStandardMaterial
            color={ring.c}
            emissive={ring.c}
            emissiveIntensity={2.4}
            toneMapped={false}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

function GlassEarth() {
  const [earth, clouds] = useTexture(["/assets/earth-texture.jpg", "/assets/earth-clouds.jpg"]);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    earth.colorSpace = THREE.SRGBColorSpace;
    earth.anisotropy = 8;
    clouds.colorSpace = THREE.SRGBColorSpace;
  }, [earth, clouds]);

  useFrame((_, dt) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.012;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
        <meshStandardMaterial map={earth} roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh ref={cloudsRef} scale={1.015}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial map={clouds} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* Glass atmosphere shell */}
      <mesh scale={1.04}>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshPhysicalMaterial
          color="#7dd3fc"
          transparent
          opacity={0.2}
          transmission={0.75}
          thickness={0.9}
          roughness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.08}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.16}>
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
    </group>
  );
}

/** One continent tab = icon + label, clickable → dashboard. */
function ContinentTab({
  hub,
  onOpen,
}: {
  hub: HubDef;
  onOpen: (h: HubDef) => void;
}) {
  const art = HUB_ART[hub.id];
  const map = useTexture(art?.src || "/assets/hub-home.png");
  const pos = useMemo(() => hubToSphere(hub, GLOBE_R * 1.14), [hub]);

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
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={art.glow}
          emissive={art.glow}
          emissiveIntensity={3.5}
          toneMapped={false}
        />
      </mesh>
      <sprite
        scale={[0.95, 0.95, 1]}
        position={[0, 0.28, 0.08]}
        onClick={click}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <spriteMaterial map={map} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </sprite>
      <Text
        position={[0, -0.28, 0.12]}
        fontSize={0.14}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#000000"
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
 * SINGLE fiery DSG mini-sun.
 * One core + one logo badge + one fire ring (not multiple suns).
 */
function DsgFierySun() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const fireRing = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const [glow, badge] = useTexture(["/assets/sun-glow.png", "/assets/dsg-sun-badge.png"]);

  useMemo(() => {
    glow.colorSpace = THREE.SRGBColorSpace;
    badge.colorSpace = THREE.SRGBColorSpace;
  }, [glow, badge]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      const a = t * 0.45;
      // One body on a front-biased orbit
      group.current.position.set(
        Math.cos(a) * SUN_ORBIT,
        Math.sin(a * 0.65) * 0.75,
        1.2 + Math.abs(Math.sin(a)) * SUN_ORBIT * 0.5,
      );
    }
    if (fireRing.current) fireRing.current.rotation.z = t * 2.2;
    if (core.current) {
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        8 + Math.sin(t * 8) * 1.5;
    }
    if (light.current) light.current.intensity = 4.5 + Math.sin(t * 6) * 0.7;
  });

  return (
    <group ref={group}>
      <pointLight ref={light} color="#ff4500" intensity={4.5} distance={12} decay={2} />

      {/* Soft single corona (one sprite, not a chain of suns) */}
      <sprite scale={[1.9, 1.9, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.95}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {/* Fire ring circling the DSG sun */}
      <mesh ref={fireRing} rotation={[Math.PI / 2.6, 0.4, 0]}>
        <torusGeometry args={[0.55, 0.045, 12, 64]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={6}
          toneMapped={false}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Short flame wake — low opacity so it reads as fire, not extra suns */}
      <sprite position={[-0.55, 0.05, 0]} scale={[1.1, 0.4, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          opacity={0.55}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#ff6a00"
        />
      </sprite>

      <mesh ref={core}>
        <sphereGeometry args={[0.3, 48, 48]} />
        <meshStandardMaterial
          color="#ff4500"
          emissive="#ff4500"
          emissiveIntensity={10}
          toneMapped={false}
          roughness={0.1}
          depthTest={false}
        />
      </mesh>

      {/* DSG logo on the sun */}
      <sprite scale={[0.85, 0.85, 1]} position={[0, 0, 0.2]}>
        <spriteMaterial
          map={badge}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 4, 6]} intensity={1.15} />
      <pointLight position={[-4, -1, 3]} intensity={0.5} color="#a78bfa" />

      <Stars radius={55} depth={35} count={1400} factor={2.2} saturation={0.45} fade speed={0.3} />
      <Sparkles count={40} scale={8} size={2} speed={0.2} opacity={0.4} color="#c084fc" />

      <Suspense fallback={null}>
        <GlassEarth />
        <OrbitalGuideRings />
        <Continents onOpen={onOpen} />
        {/* Only one orbiting body: the DSG fiery sun */}
        <DsgFierySun />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.45}
        minPolarAngle={Math.PI * 0.35}
        maxPolarAngle={Math.PI * 0.65}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={1.7} luminanceThreshold={0.14} luminanceSmoothing={0.55} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[260px] w-full max-w-[520px] items-center justify-center sm:h-[360px] lg:h-[540px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Glass hub planet — tap a continent for its dashboard. DSG mini-sun orbits."
    >
      <Canvas
        camera={{ position: [0, 0.2, 10], fov: 45 }}
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
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] uppercase tracking-[0.32em] text-cyan-100/85 sm:text-[10px]">
        Tap a continent · your dashboard
      </p>
    </div>
  );
}

export default LandingPlanet;
