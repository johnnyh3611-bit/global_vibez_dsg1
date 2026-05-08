import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Enhanced VR Avatar with Gestures and Animations
 */
export function VRAvatarEnhanced({ 
  userId, 
  position = [0, 0, 0], 
  isLocal = false, 
  onPositionUpdate, 
  color = '#ff69b4',
  gesture = null, // 'wave', 'heart', 'thumbsup', 'dance'
  userName = 'User'
}) {
  const avatarRef = useRef<any>(null);
  const headRef = useRef<any>(null);
  const leftArmRef = useRef<any>(null);
  const rightArmRef = useRef<any>(null);
  const gestureTimer = useRef<number>(0);

  useFrame(({ camera, clock }) => {
    if (isLocal && onPositionUpdate) {
      const pos = [camera.position.x, camera.position.y, camera.position.z];
      onPositionUpdate(pos);
      
      if (avatarRef.current) {
        avatarRef.current.position.set(pos[0], pos[1] - 1.5, pos[2]);
      }
    } else if (!isLocal && avatarRef.current) {
      avatarRef.current.position.lerp(
        new THREE.Vector3(position[0], position[1] - 1.5, position[2]),
        0.1
      );
    }

    // Animate gestures
    if (gesture && leftArmRef.current && rightArmRef.current) {
      gestureTimer.current += 0.05;
      
      switch (gesture) {
        case 'wave':
          rightArmRef.current.rotation.z = Math.sin(gestureTimer.current * 5) * 0.5 - 0.3;
          rightArmRef.current.position.y = 0.5 + Math.sin(gestureTimer.current * 5) * 0.2;
          break;
          
        case 'heart':
          leftArmRef.current.rotation.z = 0.5;
          rightArmRef.current.rotation.z = -0.5;
          leftArmRef.current.position.y = 0.8;
          rightArmRef.current.position.y = 0.8;
          break;
          
        case 'thumbsup':
          rightArmRef.current.rotation.z = -0.8;
          rightArmRef.current.position.y = 0.8;
          break;
          
        case 'dance':
          const bounce = Math.sin(clock.getElapsedTime() * 4) * 0.1;
          avatarRef.current.position.y += bounce;
          headRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 2) * 0.2;
          leftArmRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 3) * 0.5;
          rightArmRef.current.rotation.z = -Math.sin(clock.getElapsedTime() * 3) * 0.5;
          break;
          
        default:
          break;
      }
    } else {
      // Reset to neutral pose
      gestureTimer.current = 0;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.z = 0.3;
        rightArmRef.current.rotation.z = -0.3;
        leftArmRef.current.position.y = 0.3;
        rightArmRef.current.position.y = 0.3;
      }
    }

    // Subtle idle breathing animation
    if (headRef.current && !gesture) {
      headRef.current.position.y = 1.5 + Math.sin(clock.getElapsedTime()) * 0.02;
    }
  });

  return (
    <group ref={avatarRef} position={[position[0], position[1] - 1.5, position[2]]}>
      {/* Body */}
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
      
      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.4, 0.3, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.08, 0.6, 8, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[0.4, 0.3, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.08, 0.6, 8, 16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* Name tag */}
      {!isLocal && (
        <group position={[0, 2.2, 0]}>
          <mesh>
            <planeGeometry args={[1.2, 0.3]} />
            <meshBasicMaterial color="#1a1a1a" opacity={0.8} transparent />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            {/* Text would go here with troika-three-text in production */}
          </mesh>
        </group>
      )}
      
      {/* Gesture indicator */}
      {gesture && (
        <group position={[0, 2.5, 0]}>
          <mesh>
            <sphereGeometry args={[0.15]} />
            <meshBasicMaterial 
              color={gesture === 'heart' ? '#ff69b4' : '#ffff00'} 
              opacity={0.8} 
              transparent 
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
