/**
 * LandingPlanet — high-fidelity R3F hub globe for the landing hero.
 *
 * • Textured continent sphere (Hunger Vibez, VibeRide, Logistics/CDL, …)
 * • Glassmorphism shell over the globe
 * • Fiery DSG moon with high emissiveIntensity + fire trail (drawn in front)
 * • Slow OrbitControls autoRotate + hub pins that open dashboards
 *
 * Textures load from /assets/ (CRA public/assets/).
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { GLOBE_HUBS, openHubPath, type HubDef } from "@/hubs/hubRegistry";

const GLOBE_RADIUS = 1.35;
const MOON_ORBIT = 2.15;
const AUTO_ROTATE_SPEED = 0.45;

/** Convert CSS % anchors (globeLeft / globeTop) → unit sphere position. */
function hubToSphere(hub: HubDef, radius: number): [number, number, number] {
  const left = parseFloat(String(hub.globeLeft ?? "50")) / 100;
  const top = parseFloat(String(hub.globeTop ?? "50")) / 100;
  const lon = (left - 0.5) * Math.PI * 1.35;
  const lat = (0.5 - top) * Math.PI * 0.9;
  const x = Math.cos(lat) * Math.sin(lon) * radius;
  const y = Math.sin(lat) * radius;
  const z = Math.cos(lat) * Math.cos(lon) * radius;
  return [x, y, z];
}

function OrbitalRings() {
  return (
    <group rotation={[0.55, 0.2, 0.15]}>
      {[1.55, 1.72, 1.92].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
          <torusGeometry args={[r, 0.008 + i * 0.002, 12, 128]} />
          <meshStandardMaterial
            color={i === 0 ? "#22d3ee" : i === 1 ? "#a78bfa" : "#fbbf24"}
            emissive={i === 0 ? "#0891b2" : i === 1 ? "#7c3aed" : "#f59e0b"}
            emissiveIntensity={0.85}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function HubPins({ onOpen }: { onOpen: (hub: HubDef) => void }) {
  const pins = useMemo(
    () =>
      GLOBE_HUBS.map((hub) => ({
        hub,
        position: hubToSphere(hub, GLOBE_RADIUS * 1.02),
      })),
    [],
  );

  return (
    <group>
      {pins.map(({ hub, position }) => (
        <group key={hub.id} position={position}>
          <mesh>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#67e8f9"
              emissiveIntensity={2.2}
            />
          </mesh>
          <Html center distanceFactor={6} zIndexRange={[40, 0]} style={{ pointerEvents: "auto" }}>
            <button
              type="button"
              data-testid={hub.testid}
              title={`${hub.label} dashboard`}
              onClick={(e) => {
                e.stopPropagation();
                onOpen(hub);
              }}
              className="flex flex-col items-center gap-0.5 rounded-md border border-white/25 bg-black/55 px-1.5 py-0.5 backdrop-blur-sm transition hover:scale-110 hover:border-cyan-300/60"
              style={{ whiteSpace: "nowrap" }}
            >
              <span
                className={`text-[9px] font-black uppercase tracking-wide ${hub.accent.split(" ")[0]}`}
                style={{ textShadow: "0 0 8px rgba(0,0,0,0.9)" }}
              >
                {hub.short === "Ridez"
                  ? "VibeRide"
                  : hub.short === "Hungry"
                    ? "Hungry"
                    : hub.short === "CDL"
                      ? "CDL/GDL"
                      : hub.short === "Rise"
                        ? "Logistics"
                        : hub.label.includes("Vineyards")
                          ? "Vineyards"
                          : hub.short}
              </span>
            </button>
          </Html>
        </group>
      ))}
    </group>
  );
}

function HubGlobe({ onOpen }: { onOpen: (hub: HubDef) => void }) {
  const continentMap = useTexture("/assets/hub-continents.png");
  const glassMap = useTexture("/assets/hub-glass.png");

  useMemo(() => {
    continentMap.colorSpace = THREE.SRGBColorSpace;
    continentMap.anisotropy = 8;
    glassMap.colorSpace = THREE.SRGBColorSpace;
  }, [continentMap, glassMap]);

  return (
    <group>
      {/* Main hub sphere — continent texture */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 96, 96]} />
        <meshStandardMaterial
          map={continentMap}
          roughness={0.45}
          metalness={0.35}
          emissive="#0e7490"
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Glassmorphism shell */}
      <mesh scale={1.035}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={glassMap}
          transparent
          opacity={0.32}
          roughness={0.12}
          metalness={0.55}
          color="#67e8f9"
          emissive="#0891b2"
          emissiveIntensity={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* Soft atmosphere rim */}
      <mesh scale={1.12}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <OrbitalRings />
      <HubPins onOpen={onOpen} />
    </group>
  );
}

/**
 * Fiery DSG moon — always drawn in front of the globe (depthTest off)
 * so it never disappears behind the planet while still orbiting.
 */
function FieryDsgMoon() {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const albedo = useTexture("/assets/dsg-albedo.png");
  const emissiveMap = useTexture("/assets/dsg-emissive.png");

  useMemo(() => {
    albedo.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }, [albedo, emissiveMap]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      // Orbit the rim, then bias the moon toward the camera so it stays a
      // glowing presence in front of the globe (depthTest is also off).
      const angle = t * 0.55;
      let x = Math.cos(angle) * MOON_ORBIT;
      let y = Math.sin(angle * 0.7) * 0.45;
      let z = Math.sin(angle) * MOON_ORBIT;
      const toCam = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 0, 0)).normalize();
      const pos = new THREE.Vector3(x, y, z);
      if (pos.dot(toCam) < 0.15) {
        pos.addScaledVector(toCam, MOON_ORBIT * 0.55);
        pos.setLength(MOON_ORBIT);
      }
      group.current.position.copy(pos);
      group.current.rotation.y = t * 1.8;
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 3.6 + Math.sin(t * 7) * 0.9;
    }
  });

  return (
    <group ref={group} renderOrder={20}>
      {/* Fire trail billboards (behind moon in local -X) */}
      {[0.28, 0.5, 0.75].map((offset, i) => (
        <mesh
          key={offset}
          position={[-offset, 0, 0]}
          scale={[1.6 - i * 0.25, 0.55 - i * 0.1, 0.55 - i * 0.1]}
          renderOrder={18 + i}
        >
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color={i === 0 ? "#fff7ed" : i === 1 ? "#fbbf24" : "#ef4444"}
            emissive={i === 0 ? "#f97316" : "#dc2626"}
            emissiveIntensity={2.8 - i * 0.5}
            transparent
            opacity={0.55 - i * 0.12}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      <mesh ref={core} renderOrder={22}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial
          map={albedo}
          emissiveMap={emissiveMap}
          emissive="#ef4444"
          emissiveIntensity={4}
          roughness={0.25}
          metalness={0.15}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* DSG label — always readable in front */}
      <Html center distanceFactor={5} zIndexRange={[60, 0]} style={{ pointerEvents: "none" }}>
        <div
          data-testid="landing-planet-dsg-label"
          className="rounded-sm border border-white/50 bg-gradient-to-r from-red-600/95 via-amber-500/90 to-orange-300/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.22em] text-white shadow-[0_0_14px_rgba(239,68,68,0.85)]"
        >
          DSG
        </div>
      </Html>
    </group>
  );
}

function Scene() {
  const navigate = useNavigate();
  const onOpen = (hub: HubDef) => navigate(openHubPath(hub));

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.35} color="#e0f2fe" />
      <pointLight position={[-6, -2, 8]} intensity={1.1} color="#fb923c" />
      <pointLight position={[0, 4, 3]} intensity={0.55} color="#a78bfa" />

      <Suspense fallback={null}>
        <HubGlobe onOpen={onOpen} />
        <FieryDsgMoon />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.68}
      />
    </>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto flex h-[220px] w-full max-w-[420px] items-center justify-center sm:h-[300px] lg:h-[480px] lg:max-w-none"
      data-testid="landing-planet"
      aria-label="Global Vibez hub planet — tap a continent to open its dashboard"
    >
      <Canvas
        camera={{ position: [0, 0.15, 4.6], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
      <p className="pointer-events-none absolute -bottom-1 left-0 right-0 text-center text-[9px] uppercase tracking-[0.28em] text-cyan-200/70 sm:text-[10px]">
        Tap a continent · your dashboard
      </p>
    </div>
  );
}

export default LandingPlanet;
