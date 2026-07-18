/**
 * LandingPlanet — R3F globe with a fiery DSG satellite in orbit.
 * Used on the landing hero opposite the GLOBAL VIBEZ DSG brand lockup.
 */
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial } from "@react-three/drei";
import type { Group, Mesh } from "three";

function FieryDsgSatellite() {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      // Orbit the planet rim (XZ plane, slight tilt)
      const r = 2.35;
      group.current.position.set(Math.cos(t * 0.85) * r, Math.sin(t * 0.4) * 0.35, Math.sin(t * 0.85) * r);
      group.current.rotation.y = t * 2.2;
    }
    if (core.current) {
      const mat = core.current.material as { emissiveIntensity?: number };
      if (mat.emissiveIntensity != null) {
        mat.emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.6;
      }
    }
  });

  return (
    <group ref={group}>
      {/* Soft fire trail / glow */}
      <mesh position={[-0.35, 0, 0]} scale={[1.8, 0.55, 0.55]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#ef4444"
          emissiveIntensity={1.4}
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh position={[-0.55, 0, 0]} scale={[1.4, 0.4, 0.4]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#fff7ed"
          emissive="#f97316"
          emissiveIntensity={1.2}
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Fiery DSG Satellite core */}
      <mesh ref={core}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color="#fb923c" emissive="#dc2626" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

export function LandingPlanet() {
  return (
    <div
      className="relative mx-auto h-[200px] w-[200px] sm:h-[280px] sm:w-[280px] lg:h-[400px] lg:w-[400px] shrink-0"
      data-testid="landing-planet"
      aria-label="Global Vibez planet with fiery DSG satellite in orbit"
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.1} />
        <pointLight position={[-4, -2, 2]} intensity={0.55} color="#ef4444" />
        {/* The Globe */}
        <Sphere args={[1.5, 64, 64]}>
          <MeshDistortMaterial color="#4f46e5" distort={0.2} speed={2} />
        </Sphere>
        {/* Fiery DSG Satellite */}
        <FieryDsgSatellite />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}

export default LandingPlanet;
