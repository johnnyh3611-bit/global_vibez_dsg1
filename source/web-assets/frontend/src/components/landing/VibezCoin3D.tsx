/**
 * VibezCoin3D — Real three.js spinning $VIBEZ coin used as the
 * "Animated $VIBEZ coin asset" cell in the Tokenomics accordion
 * (LandingPage_Enhancement.pdf §3).
 *
 * Tiny inline component — three.js + react-three/fiber are already
 * installed for the Lyric Glasshouse, so we add zero net bundle here.
 */
import React, { Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const Coin: React.FC = () => {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.4;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.2, 0, 0]} castShadow receiveShadow>
      {/* A flat cylinder makes a solid coin disc. */}
      <cylinderGeometry args={[1, 1, 0.22, 64]} />
      <meshStandardMaterial
        color="#fbbf24"
        metalness={1}
        roughness={0.18}
        emissive="#7c3aed"
        emissiveIntensity={0.18}
      />
    </mesh>
  );
};

const VibezCoin3D: React.FC<{ size?: number }> = ({ size = 120 }) => {
  return (
    <div
      data-testid="vibez-coin-3d"
      style={{ width: size, height: size }}
      aria-label="$VIBEZ coin (animated)"
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 4]} intensity={1.2} />
        <pointLight position={[-3, -2, 2]} intensity={0.6} color="#d946ef" />
        <Suspense fallback={null}>
          <Coin />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VibezCoin3D;
