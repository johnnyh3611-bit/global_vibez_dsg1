import { Environment, Sky, Stars } from '@react-three/drei';
import { useRef } from 'react';

/**
 * VR Environment Component - Creates the 3D dating environment
 * @param {string} location - Environment type (restaurant, beach, rooftop, space)
 */
export function VREnvironment({ location = 'restaurant' }: { location?: any }) {
  
  const environments = {
    restaurant: <RestaurantScene />,
    beach: <BeachScene />,
    rooftop: <RooftopScene />,
    space: <SpaceScene />
  };

  return (
    <>
      {environments[location] || environments.restaurant}
      <ambientLight intensity={0.5} />
      <Environment preset="sunset" />
    </>
  );
}

// Restaurant Scene
function RestaurantScene() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>
      
      {/* Table */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.05, 32]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      
      {/* Table Leg */}
      <mesh position={[0, 0.375, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.75, 16]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      
      {/* Candle Light */}
      <pointLight position={[0, 1.5, 0]} intensity={0.8} color="#ffaa00" distance={5} />
      
      {/* Candle */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
        <meshStandardMaterial color="#ffe4b5" emissive="#ffaa00" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Walls */}
      <mesh position={[0, 2, -5]} receiveShadow>
        <planeGeometry args={[20, 4]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
    </group>
  );
}

// Beach Scene
function BeachScene() {
  return (
    <group>
      {/* Sand Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#F4A460" roughness={0.9} />
      </mesh>
      
      {/* Sky */}
      <Sky sunPosition={[100, 20, 100]} />
      
      {/* Ocean in distance */}
      <mesh position={[0, 0, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 20]} />
        <meshStandardMaterial color="#1E90FF" roughness={0.3} metalness={0.6} />
      </mesh>
      
      {/* Palm Tree */}
      <mesh position={[-3, 2, -2]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 4, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[-3, 4.5, -2]} castShadow>
        <coneGeometry args={[1.5, 2, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  );
}

// Rooftop Scene  
function RooftopScene() {
  return (
    <group>
      {/* Rooftop Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[15, 15]} />
        <meshStandardMaterial color="#696969" roughness={0.8} />
      </mesh>
      
      {/* City lights in background */}
      <pointLight position={[-5, 1, -8]} intensity={0.5} color="#00ffff" />
      <pointLight position={[5, 1, -8]} intensity={0.5} color="#ff00ff" />
      <pointLight position={[0, 1, -10]} intensity={0.5} color="#ffff00" />
      
      {/* Railing */}
      {[-7, -3.5, 0, 3.5, 7].map((x, i) => (
        <mesh key={`item-${i}`} position={[x, 0.5, 7]} castShadow>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
        </mesh>
      ))}
      
      {/* Stars */}
      <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
    </group>
  );
}

// Space Scene
function SpaceScene() {
  return (
    <group>
      {/* Platform */}
      <mesh position={[0, -0.5, 0]} castShadow>
        <cylinderGeometry args={[3, 3, 0.2, 32]} />
        <meshStandardMaterial color="#4169E1" metalness={0.9} roughness={0.1} emissive="#0000ff" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Stars */}
      <Stars radius={100} depth={50} count={8000} factor={6} fade speed={2} />
      
      {/* Ambient space lights */}
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#00ffff" />
      <pointLight position={[-5, 5, 5]} intensity={0.3} color="#ff00ff" />
      <pointLight position={[0, 10, -5]} intensity={0.3} color="#ffff00" />
    </group>
  );
}