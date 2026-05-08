import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion-3d';
import * as THREE from 'three';

/**
 * VR Avatar Component - Represents a user in the VR space
 * @param {string} userId - User identifier
 * @param {Array} position - [x, y, z] position
 * @param {boolean} isLocal - Is this the local user's avatar
 * @param {Function} onPositionUpdate - Callback for position changes
 */
export function VRAvatar({ userId, position = [0, 0, 0], isLocal = false, onPositionUpdate, color = '#ff69b4' }) {
  const avatarRef = useRef<any>(null);
  const headRef = useRef<any>(null);

  useFrame(({ camera }) => {
    if (isLocal && onPositionUpdate) {
      // Send local user's camera position
      const pos = [camera.position.x, camera.position.y, camera.position.z];
      onPositionUpdate(pos);
      
      // Update local avatar to follow camera
      if (avatarRef.current) {
        avatarRef.current.position.set(pos[0], pos[1] - 1.5, pos[2]);
      }
    } else if (!isLocal && avatarRef.current) {
      // Smooth interpolation for remote user
      avatarRef.current.position.lerp(
        new THREE.Vector3(position[0], position[1] - 1.5, position[2]),
        0.1
      );
    }
  });

  return (
    <group ref={avatarRef} position={[position[0], position[1] - 1.5, position[2]]}>
      {/* Body (capsule) */}
      <mesh castShadow>
        <capsuleGeometry args={[0.3, 1.4, 8, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color="#ffdbac" metalness={0.2} roughness={0.8} />
      </mesh>
      
      {/* Eyes */}
      <mesh position={[-0.12, 1.6, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0.12, 1.6, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      
      {/* Smile */}
      <mesh position={[0, 1.4, 0.32]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.12, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      
      {/* Name tag */}
      {!isLocal && (
        <group position={[0, 2.2, 0]}>
          <mesh>
            <planeGeometry args={[1, 0.3]} />
            <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
          </mesh>
        </group>
      )}
    </group>
  );
}