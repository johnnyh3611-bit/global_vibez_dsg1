import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Interactive Objects for VR Dating
 * Objects users can interact with in the environment
 */

// Throwable Ball
export function InteractiveBall({ position = [0, 1, -2] as any, onThrow }: { position?: any; [k: string]: any }) {
  const ballRef = useRef<any>(null);
  const [velocity, setVelocity] = useState([0, 0, 0]);
  const [isMoving, setIsMoving] = useState(false);

  useFrame(() => {
    if (isMoving && ballRef.current) {
      // Simple physics
      ballRef.current.position.x += velocity[0];
      ballRef.current.position.y += velocity[1];
      ballRef.current.position.z += velocity[2];
      
      // Gravity
      setVelocity([velocity[0], velocity[1] - 0.01, velocity[2]]);
      
      // Stop when hits ground
      if (ballRef.current.position.y < 0.2) {
        ballRef.current.position.y = 0.2;
        setIsMoving(false);
        setVelocity([0, 0, 0]);
      }
    }
  });

  const handleClick = () => {
    // Throw ball forward
    setVelocity([0, 0.15, -0.1]);
    setIsMoving(true);
    if (onThrow) onThrow();
  };

  return (
    <mesh 
      ref={ballRef} 
      position={position} 
      onClick={handleClick}
      castShadow
    >
      <sphereGeometry args={[0.15, 32, 32]} />
      <meshStandardMaterial 
        color="#ff4444" 
        metalness={0.4} 
        roughness={0.6} 
      />
    </mesh>
  );
}

// Rose flower
export function Rose({ position = [0, 0.75, 0] as any }: { position?: any; [k: string]: any }) {
  return (
    <group position={position}>
      {/* Stem */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#2d5016" />
      </mesh>
      
      {/* Petals */}
      <mesh castShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial 
          color="#ff1744" 
          metalness={0.3} 
          roughness={0.7} 
        />
      </mesh>
      
      {/* Outer petals */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <mesh 
          key={angle}
          position={[
            Math.cos((angle * Math.PI) / 180) * 0.08,
            0,
            Math.sin((angle * Math.PI) / 180) * 0.08
          ]}
          rotation={[0, (angle * Math.PI) / 180, 0]}
          castShadow
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial 
            color="#ff1744" 
            metalness={0.2} 
            roughness={0.8} 
          />
        </mesh>
      ))}
    </group>
  );
}

// Floating hearts
export function FloatingHeart({ position = [0, 2, 0] as any, delay = 0 }: { position?: any; [k: string]: any }) {
  const heartRef = useRef<any>(null);

  useFrame(({ clock }) => {
    if (heartRef.current) {
      const time = clock.getElapsedTime() + delay;
      heartRef.current.position.y = position[1] + Math.sin(time) * 0.2;
      heartRef.current.rotation.y = time * 0.5;
    }
  });

  return (
    <mesh ref={heartRef} position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial 
        color="#ff69b4" 
        emissive="#ff69b4" 
        emissiveIntensity={0.5}
        transparent 
        opacity={0.8} 
      />
    </mesh>
  );
}

// Champagne glasses
export function ChampagneGlasses({ position = [0, 0.76, 0] as any }: { position?: any; [k: string]: any }) {
  return (
    <group position={position}>
      {/* Glass 1 */}
      <group position={[-0.15, 0, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.06, 0.15, 16]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.3} 
            roughness={0.1} 
            metalness={0.1}
            transmission={0.9}
          />
        </mesh>
        {/* Stem */}
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
        {/* Champagne */}
        <mesh position={[0, 0.05, 0]}>
          <coneGeometry args={[0.05, 0.08, 16]} />
          <meshStandardMaterial 
            color="#ffeb3b" 
            emissive="#ffeb3b" 
            emissiveIntensity={0.3}
            transparent 
            opacity={0.7} 
          />
        </mesh>
      </group>
      
      {/* Glass 2 */}
      <group position={[0.15, 0, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.06, 0.15, 16]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.3} 
            roughness={0.1} 
            metalness={0.1}
            transmission={0.9}
          />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.1, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <coneGeometry args={[0.05, 0.08, 16]} />
          <meshStandardMaterial 
            color="#ffeb3b" 
            emissive="#ffeb3b" 
            emissiveIntensity={0.3}
            transparent 
            opacity={0.7} 
          />
        </mesh>
      </group>
    </group>
  );
}

// Particles system for effects
export function ParticleEffect({ position = [0, 2, 0] as any, type = 'hearts' }: { position?: any; [k: string]: any }) {
  const particlesRef = useRef<any>(null);
  const particleCount = 20;

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      const time = clock.getElapsedTime();
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.5;
        
        positions[i3] = position[0] + Math.cos(angle + time) * radius;
        positions[i3 + 1] = position[1] + Math.sin(time * 2 + i) * 0.3;
        positions[i3 + 2] = position[2] + Math.sin(angle + time) * radius;
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = position[0];
    positions[i * 3 + 1] = position[1];
    positions[i * 3 + 2] = position[2];
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.05} 
        color={type === 'hearts' ? '#ff69b4' : '#ffeb3b'}
        transparent 
        opacity={0.6}
        sizeAttenuation 
      />
    </points>
  );
}
